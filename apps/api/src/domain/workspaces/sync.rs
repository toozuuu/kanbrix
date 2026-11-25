use crate::common::auth::{verify_workspace_membership, AuthenticatedUser};
use crate::common::error::AppError;
use crate::common::state::AppState;
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeSet, HashMap};
use std::time::Duration;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct SyncPreviewRequest {
    pub provider: String,
    pub base_url: Option<String>,
    pub email: Option<String>,
    pub token: String,
    pub target: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SyncIssueItem {
    pub external_id: String,
    pub title: String,
    pub description: Option<String>,
    pub issue_type: String,
    pub priority: String,
    pub status: String,
    #[serde(default)]
    pub labels: Vec<String>,
}

#[derive(Serialize)]
pub struct SyncPreviewResponse {
    pub provider: String,
    pub project_name: String,
    pub project_key: String,
    pub description: Option<String>,
    pub statuses: Vec<String>,
    pub issues: Vec<SyncIssueItem>,
}

#[derive(Deserialize)]
pub struct SyncImportRequest {
    pub target_project_id: Option<Uuid>,
    pub project_name: String,
    pub project_key: String,
    pub description: Option<String>,
    #[serde(default)]
    pub status_map: HashMap<String, String>,
    pub issues: Vec<SyncIssueItem>,
}

#[derive(Serialize)]
pub struct SyncImportResponse {
    pub project_id: Uuid,
    pub project_key: String,
    pub imported_count: usize,
    pub updated_count: usize,
    pub outcomes: Vec<serde_json::Value>,
    pub skipped_count: usize,
}

fn normalize_key(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_uppercase())
        .take(10)
        .collect();
    if cleaned.len() >= 2 {
        cleaned
    } else {
        "SYNC".to_string()
    }
}

fn normalize_priority(raw: &str) -> String {
    match raw.trim().to_ascii_lowercase().as_str() {
        "highest" | "critical" | "urgent" | "p0" => "critical".to_string(),
        "high" | "p1" => "high".to_string(),
        "low" | "lowest" | "p3" | "p4" => "low".to_string(),
        _ => "medium".to_string(),
    }
}

fn normalize_type(raw: &str) -> String {
    match raw.trim().to_ascii_lowercase().as_str() {
        "bug" | "defect" | "incident" => "bug".to_string(),
        "story" | "feature" | "enhancement" => "feature".to_string(),
        "epic" => "epic".to_string(),
        _ => "task".to_string(),
    }
}

fn http_client() -> Result<reqwest::Client, AppError> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("Kanbrix-Sync/1.0")
        .build()
        .map_err(|_| AppError::Internal("Failed to initialize HTTP client".into()))
}

pub async fn preview(
    user: AuthenticatedUser,
    State(state): State<AppState>,
    Path(ws): Path<Uuid>,
    Json(req): Json<SyncPreviewRequest>,
) -> Result<Json<SyncPreviewResponse>, AppError> {
    let role = verify_workspace_membership(&state.pool, ws, user.id).await?;
    if !role.can_manage_workspace() {
        return Err(AppError::Forbidden("Administrator access required".into()));
    }

    let token = req.token.trim();
    let target = req.target.trim();
    if token.is_empty() || target.is_empty() {
        return Err(AppError::BadRequest(
            "API token and project/repository target are required".into(),
        ));
    }

    let client = http_client()?;
    let result = match req.provider.trim().to_ascii_lowercase().as_str() {
        "jira" => preview_jira(&client, req.base_url.as_deref(), req.email.as_deref(), token, target).await?,
        "github" => preview_github(&client, token, target).await?,
        "linear" => preview_linear(&client, token, target).await?,
        _ => {
            return Err(AppError::BadRequest(
                "Unsupported sync provider. Use jira, github, or linear.".into(),
            ))
        }
    };

    Ok(Json(result))
}

fn jira_description(value: &Value) -> Option<String> {
    if let Some(text) = value.as_str() {
        return Some(text.to_owned());
    }
    if let Some(text) = value.get("text").and_then(Value::as_str) {
        return Some(text.to_owned());
    }
    if value.get("type").and_then(Value::as_str) == Some("hardBreak") {
        return Some("\n".into());
    }
    let parts: Vec<_> = value.get("content")?.as_array()?.iter().filter_map(jira_description).collect();
    let separator = match value.get("type").and_then(Value::as_str) {
        Some("paragraph" | "heading") => "",
        _ => "\n",
    };
    Some(parts.join(separator))
}

async fn preview_jira(
    client: &reqwest::Client,
    base_url: Option<&str>,
    email: Option<&str>,
    token: &str,
    project_key: &str,
) -> Result<SyncPreviewResponse, AppError> {
    let base = base_url
        .map(str::trim)
        .filter(|s| s.starts_with("https://") || s.starts_with("http://"))
        .map(|s| s.trim_end_matches('/'))
        .ok_or_else(|| AppError::BadRequest("Valid Jira base URL (http/https) is required".into()))?;

    let apply_auth = |builder: reqwest::RequestBuilder| -> reqwest::RequestBuilder {
        let builder = builder.header("Accept", "application/json");
        if let Some(mail) = email.map(str::trim).filter(|s| !s.is_empty()) {
            builder.basic_auth(mail, Some(token))
        } else {
            builder.bearer_auth(token)
        }
    };

    let mut api_ver = "3";
    let mut proj_resp = apply_auth(client.get(format!("{base}/rest/api/3/project/{project_key}")))
        .send()
        .await
        .map_err(|e| AppError::BadRequest(format!("Could not reach Jira: {e}")))?;

    if proj_resp.status() == reqwest::StatusCode::NOT_FOUND {
        api_ver = "2";
        proj_resp = apply_auth(client.get(format!("{base}/rest/api/2/project/{project_key}")))
            .send()
            .await
            .map_err(|e| AppError::BadRequest(format!("Could not reach Jira: {e}")))?;
    }

    if !proj_resp.status().is_success() {
        let status = proj_resp.status();
        let body = proj_resp.text().await.unwrap_or_default();
        let detail = serde_json::from_str::<Value>(&body)
            .ok()
            .and_then(|v| {
                v.get("errorMessages")
                    .and_then(Value::as_array)
                    .and_then(|a| a.first())
                    .and_then(Value::as_str)
                    .or_else(|| v.get("message").and_then(Value::as_str))
                    .map(str::to_string)
            })
            .filter(|s| !s.is_empty());
        let hint = if status == reqwest::StatusCode::FORBIDDEN {
            " For Jira Cloud, use your Atlassian email with an unscoped (classic) API token and ensure your account has Browse Projects permission."
        } else {
            ""
        };
        let msg = match detail {
            Some(d) => format!("Jira project lookup failed (HTTP {status}): {d}.{hint}"),
            None => format!("Jira project lookup failed (HTTP {status}).{hint}"),
        };
        return Err(AppError::BadRequest(msg));
    }
    let proj_json: Value = proj_resp
        .json()
        .await
        .map_err(|_| AppError::BadRequest("Invalid Jira project response".into()))?;

    let search_url = if api_ver == "3" {
        format!("{base}/rest/api/3/search/jql")
    } else {
        format!("{base}/rest/api/2/search")
    };
    let mut statuses = BTreeSet::new();
    let mut issues = Vec::new();
    let mut next_page_token: Option<String> = None;
    let mut start_at: usize = 0;

    let mut seen_tokens = BTreeSet::new();
    loop {
        if issues.len() >= 10_000 {
            return Err(AppError::BadRequest("Jira preview exceeds 10,000 issues".into()));
        }
        let mut params = vec![
            ("jql", format!("project = \"{project_key}\"")),
            ("maxResults", "100".into()),
            (
                "fields",
                "summary,description,issuetype,priority,status,labels".into(),
            ),
        ];
        if api_ver == "3" {
            if let Some(ref token) = next_page_token {
                params.push(("nextPageToken", token.clone()));
            }
        } else {
            params.push(("startAt", start_at.to_string()));
        }

        let search_resp = apply_auth(client.get(&search_url).query(&params))
            .send()
            .await
            .map_err(|e| AppError::BadRequest(format!("Could not query Jira issues: {e}")))?;

        if !search_resp.status().is_success() {
            return Err(AppError::BadRequest(format!(
                "Jira issue search failed (HTTP {})",
                search_resp.status()
            )));
        }
        let search_json: Value = search_resp
            .json()
            .await
            .map_err(|_| AppError::BadRequest("Invalid Jira search response".into()))?;

        let items = search_json
            .get("issues")
            .and_then(Value::as_array)
            .ok_or_else(|| AppError::BadRequest("Jira search response is missing its issues list".into()))?;
        let count = items.len();
        if issues.len() + count > 10_000 {
            return Err(AppError::BadRequest("Jira preview exceeds 10,000 issues".into()));
        }
        for item in items {
            let key = item.get("key").and_then(Value::as_str).filter(|key| !key.is_empty()).ok_or_else(|| AppError::BadRequest("Jira returned an issue without a key".into()))?.to_string();
            let fields = item.get("fields").unwrap_or(&Value::Null);
            let title = fields
                .get("summary")
                .and_then(Value::as_str)
                .unwrap_or("Untitled issue")
                .to_string();
            let description = fields.get("description").and_then(jira_description);
            let status = fields
                .pointer("/status/name")
                .and_then(Value::as_str)
                .unwrap_or("Todo")
                .to_string();
            let priority = normalize_priority(
                fields
                    .pointer("/priority/name")
                    .and_then(Value::as_str)
                    .unwrap_or("medium"),
            );
            let issue_type = normalize_type(
                fields
                    .pointer("/issuetype/name")
                    .and_then(Value::as_str)
                    .unwrap_or("task"),
            );
            let labels = fields
                .get("labels")
                .and_then(Value::as_array)
                .map(|arr| {
                    arr.iter()
                        .filter_map(Value::as_str)
                        .map(str::to_string)
                        .collect()
                })
                .unwrap_or_default();
            statuses.insert(status.clone());
            issues.push(SyncIssueItem {
                external_id: key,
                title,
                description,
                issue_type,
                priority,
                status,
                labels,
            });
        }

        if api_ver == "3" {
            next_page_token = search_json
                .get("nextPageToken")
                .and_then(Value::as_str)
                .map(str::to_string);
            if let Some(token) = &next_page_token {
                if !seen_tokens.insert(token.clone()) {
                    return Err(AppError::BadRequest("Jira repeated a page token".into()));
                }
            }
            if next_page_token.is_none() || count == 0 {
                break;
            }
        } else {
            start_at += count;
            let total = search_json.get("total").and_then(Value::as_u64);
            if count == 0 || total.is_some_and(|total| start_at as u64 >= total) {
                break;
            }
        }
    }

    Ok(SyncPreviewResponse {
        provider: "jira".into(),
        project_name: proj_json
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or(project_key)
            .to_string(),
        project_key: normalize_key(
            proj_json
                .get("key")
                .and_then(Value::as_str)
                .unwrap_or(project_key),
        ),
        description: proj_json
            .get("description")
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty())
            .map(str::to_string),
        statuses: statuses.into_iter().collect(),
        issues,
    })
}

async fn preview_github(
    client: &reqwest::Client,
    token: &str,
    repo: &str,
) -> Result<SyncPreviewResponse, AppError> {
    let (owner, name) = repo
        .split_once('/')
        .map(|(o, n)| (o.trim(), n.trim()))
        .filter(|(o, n)| !o.is_empty() && !n.is_empty())
        .ok_or_else(|| AppError::BadRequest("GitHub target must be in owner/repo format".into()))?;

    let repo_resp = client
        .get(format!("https://api.github.com/repos/{owner}/{name}"))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| AppError::BadRequest(format!("Could not reach GitHub: {e}")))?;

    if !repo_resp.status().is_success() {
        return Err(AppError::BadRequest(format!(
            "GitHub repository lookup failed (HTTP {})",
            repo_resp.status()
        )));
    }
    let repo_json: Value = repo_resp
        .json()
        .await
        .map_err(|_| AppError::BadRequest("Invalid GitHub repository response".into()))?;

    let mut statuses = BTreeSet::new();
    let mut issues = Vec::new();
    for page in 1..=5 {
        let issues_resp = client
            .get(format!("https://api.github.com/repos/{owner}/{name}/issues"))
            .query(&[
                ("state", "all".to_string()),
                ("per_page", "100".to_string()),
                ("page", page.to_string()),
            ])
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| AppError::BadRequest(format!("Could not fetch GitHub issues: {e}")))?;

        if !issues_resp.status().is_success() {
            return Err(AppError::BadRequest(format!(
                "GitHub issues lookup failed (HTTP {})",
                issues_resp.status()
            )));
        }
        let issues_json: Value = issues_resp
            .json()
            .await
            .map_err(|_| AppError::BadRequest("Invalid GitHub issues response".into()))?;

        let items = issues_json.as_array().cloned().unwrap_or_default();
        let raw_count = items.len();
        for item in &items {
            if item.get("pull_request").is_some() {
                continue;
            }
            let num = item.get("number").and_then(Value::as_i64).unwrap_or(0);
            let title = item
                .get("title")
                .and_then(Value::as_str)
                .unwrap_or("Untitled issue")
                .to_string();
            let description = item
                .get("body")
                .and_then(Value::as_str)
                .filter(|s| !s.is_empty())
                .map(str::to_string);
            let state = item.get("state").and_then(Value::as_str).unwrap_or("open");
            let status = if state == "closed" { "Done" } else { "Todo" }.to_string();
            let labels: Vec<String> = item
                .get("labels")
                .and_then(Value::as_array)
                .map(|arr| {
                    arr.iter()
                        .filter_map(|l| l.get("name").and_then(Value::as_str))
                        .map(str::to_string)
                        .collect()
                })
                .unwrap_or_default();
            let issue_type = if labels.iter().any(|l| l.eq_ignore_ascii_case("bug")) {
                "bug"
            } else if labels.iter().any(|l| l.eq_ignore_ascii_case("enhancement")) {
                "feature"
            } else {
                "task"
            }
            .to_string();
            statuses.insert(status.clone());
            issues.push(SyncIssueItem {
                external_id: format!("#{num}"),
                title,
                description,
                issue_type,
                priority: "medium".into(),
                status,
                labels,
            });
        }
        if raw_count < 100 {
            break;
        }
    }

    Ok(SyncPreviewResponse {
        provider: "github".into(),
        project_name: repo_json
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or(name)
            .to_string(),
        project_key: normalize_key(name),
        description: repo_json
            .get("description")
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty())
            .map(str::to_string),
        statuses: statuses.into_iter().collect(),
        issues,
    })
}

async fn preview_linear(
    client: &reqwest::Client,
    token: &str,
    team_key: &str,
) -> Result<SyncPreviewResponse, AppError> {
    let query = r#"
      query($key: String!) {
        teams(filter: { key: { eq: $key } }, first: 1) {
          nodes {
            name
            key
            description
            issues(first: 100) {
              nodes {
                identifier
                title
                description
                priorityLabel
                state { name }
                labels { nodes { name } }
              }
            }
          }
        }
      }
    "#;

    let resp = client
        .post("https://api.linear.app/graphql")
        .header("Authorization", token)
        .json(&json!({ "query": query, "variables": { "key": team_key.to_ascii_uppercase() } }))
        .send()
        .await
        .map_err(|e| AppError::BadRequest(format!("Could not reach Linear: {e}")))?;

    if !resp.status().is_success() {
        return Err(AppError::BadRequest(format!(
            "Linear query failed (HTTP {})",
            resp.status()
        )));
    }
    let body: Value = resp
        .json()
        .await
        .map_err(|_| AppError::BadRequest("Invalid Linear response".into()))?;

    let team = body
        .pointer("/data/teams/nodes/0")
        .ok_or_else(|| AppError::NotFound(format!("Linear team '{team_key}' not found")))?;

    let mut statuses = BTreeSet::new();
    let mut issues = Vec::new();
    if let Some(items) = team.pointer("/issues/nodes").and_then(Value::as_array) {
        for item in items {
            let external_id = item
                .get("identifier")
                .and_then(Value::as_str)
                .unwrap_or("LIN-0")
                .to_string();
            let title = item
                .get("title")
                .and_then(Value::as_str)
                .unwrap_or("Untitled issue")
                .to_string();
            let description = item
                .get("description")
                .and_then(Value::as_str)
                .filter(|s| !s.is_empty())
                .map(str::to_string);
            let status = item
                .pointer("/state/name")
                .and_then(Value::as_str)
                .unwrap_or("Todo")
                .to_string();
            let priority = normalize_priority(
                item.get("priorityLabel")
                    .and_then(Value::as_str)
                    .unwrap_or("medium"),
            );
            let labels = item
                .pointer("/labels/nodes")
                .and_then(Value::as_array)
                .map(|arr| {
                    arr.iter()
                        .filter_map(|l| l.get("name").and_then(Value::as_str))
                        .map(str::to_string)
                        .collect()
                })
                .unwrap_or_default();
            statuses.insert(status.clone());
            issues.push(SyncIssueItem {
                external_id,
                title,
                description,
                issue_type: "task".into(),
                priority,
                status,
                labels,
            });
        }
    }

    Ok(SyncPreviewResponse {
        provider: "linear".into(),
        project_name: team
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or(team_key)
            .to_string(),
        project_key: normalize_key(
            team.get("key")
                .and_then(Value::as_str)
                .unwrap_or(team_key),
        ),
        description: team
            .get("description")
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty())
            .map(str::to_string),
        statuses: statuses.into_iter().collect(),
        issues,
    })
}

pub async fn import_project(
    user: AuthenticatedUser,
    State(state): State<AppState>,
    Path(ws): Path<Uuid>,
    Json(req): Json<SyncImportRequest>,
) -> Result<Json<SyncImportResponse>, AppError> {
    let role = verify_workspace_membership(&state.pool, ws, user.id).await?;
    if !role.can_manage_workspace() {
        return Err(AppError::Forbidden("Administrator access required".into()));
    }

    let project_name = req.project_name.trim();
    if project_name.is_empty() {
        return Err(AppError::BadRequest("Project name is required".into()));
    }
    let project_key = normalize_key(&req.project_key);

    let mut tx = state.pool.begin().await.map_err(AppError::DatabaseError)?;

    let (project_id, final_key, mut issue_counter): (Uuid, String, i32) =
        if let Some(pid) = req.target_project_id {
            let row = sqlx::query_as::<_, (Uuid, String, i32)>(
                "SELECT id, project_key, issue_counter FROM projects WHERE id = $1 AND workspace_id = $2 FOR UPDATE",
            )
            .bind(pid)
            .bind(ws)
            .fetch_optional(&mut *tx)
            .await
            .map_err(AppError::DatabaseError)?
            .ok_or_else(|| AppError::NotFound("Target project not found in workspace".into()))?;
            row
        } else {
            let created = sqlx::query_as::<_, (Uuid, String, i32)>(
                "INSERT INTO projects (workspace_id, name, project_key, description) VALUES ($1, $2, $3, $4) RETURNING id, project_key, issue_counter",
            )
            .bind(ws)
            .bind(project_name)
            .bind(&project_key)
            .bind(&req.description)
            .fetch_one(&mut *tx)
            .await
            .map_err(AppError::DatabaseError)?;

            let default_cols = [
                ("Todo", "Todo", 0),
                ("In Progress", "InProgress", 1),
                ("In Review", "InReview", 2),
                ("Done", "Done", 3),
            ];
            for (name, category, pos) in default_cols {
                sqlx::query(
                    "INSERT INTO issue_statuses (project_id, name, category, position) VALUES ($1, $2, $3, $4)",
                )
                .bind(created.0)
                .bind(name)
                .bind(category)
                .bind(pos)
                .execute(&mut *tx)
                .await
                .map_err(AppError::DatabaseError)?;
            }
            created
        };

    let status_rows = sqlx::query_as::<_, (Uuid, String, String)>(
        "SELECT id, name, category FROM issue_statuses WHERE project_id = $1 ORDER BY position ASC",
    )
    .bind(project_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    let fallback_status_id = status_rows
        .first()
        .map(|r| r.0)
        .ok_or_else(|| AppError::Internal("Project has no workflow statuses".into()))?;

    let resolve_status = |ext_status: &str| -> Uuid {
        let mapped_name = req
            .status_map
            .get(ext_status)
            .map(String::as_str)
            .unwrap_or(ext_status);
        let lower = mapped_name.trim().to_ascii_lowercase();
        if let Some(exact) = status_rows.iter().find(|(_, n, _)| n.to_ascii_lowercase() == lower) {
            return exact.0;
        }
        let target_cat = if lower.contains("done") || lower.contains("closed") || lower.contains("resolved") {
            "Done"
        } else if lower.contains("review") {
            "InReview"
        } else if lower.contains("progress") || lower.contains("doing") || lower.contains("active") {
            "InProgress"
        } else {
            "Todo"
        };
        status_rows
            .iter()
            .find(|(_, _, cat)| cat == target_cat)
            .map(|r| r.0)
            .unwrap_or(fallback_status_id)
    };

    let existing_labels = sqlx::query_as::<_, (Uuid, String)>(
        "SELECT id, name FROM labels WHERE workspace_id = $1",
    )
    .bind(ws)
    .fetch_all(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;
    let mut label_map: HashMap<String, Uuid> = existing_labels
        .into_iter()
        .map(|(id, name)| (name.to_ascii_lowercase(), id))
        .collect();

    let mut imported_count = 0usize;
    let mut updated_count = 0usize;
    let mut outcomes = Vec::with_capacity(req.issues.len());
    for (idx, item) in req.issues.iter().enumerate() {
        let title = item.title.trim();
        if title.is_empty() {
            outcomes.push(json!({"row":idx+1,"external_id":item.external_id,"result":"skipped","reason":"Empty title"}));
            continue;
        }
        let ext_id = item.external_id.trim();
        let ext_opt = if ext_id.is_empty() { None } else { Some(ext_id) };
        let status_id = resolve_status(&item.status);
        let norm_type = normalize_type(&item.issue_type);
        let norm_prio = normalize_priority(&item.priority);

        let existing_id: Option<Uuid> = if let Some(eid) = ext_opt {
            sqlx::query_scalar(
                "SELECT id FROM issues WHERE project_id = $1 AND external_id = $2",
            )
            .bind(project_id)
            .bind(eid)
            .fetch_optional(&mut *tx)
            .await
            .map_err(AppError::DatabaseError)?
        } else {
            None
        };

        let issue_id = if let Some(eid) = existing_id {
            updated_count += 1;
            sqlx::query(
                r#"
                UPDATE issues
                SET title = $1, description = $2, type = $3, priority = $4, status_id = $5, updated_at = NOW()
                WHERE id = $6
                "#,
            )
            .bind(title)
            .bind(&item.description)
            .bind(&norm_type)
            .bind(&norm_prio)
            .bind(status_id)
            .bind(eid)
            .execute(&mut *tx)
            .await
            .map_err(AppError::DatabaseError)?;
            eid
        } else {
            issue_counter += 1;
            let position = ((idx as f64) + 1.0) * 1000.0;
            sqlx::query_scalar::<_, Uuid>(
                r#"
                INSERT INTO issues (project_id, issue_number, title, description, type, priority, status_id, position, reporter_id, external_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
                "#,
            )
            .bind(project_id)
            .bind(issue_counter)
            .bind(title)
            .bind(&item.description)
            .bind(&norm_type)
            .bind(&norm_prio)
            .bind(status_id)
            .bind(position)
            .bind(user.id)
            .bind(ext_opt)
            .fetch_one(&mut *tx)
            .await
            .map_err(AppError::DatabaseError)?
        };

        let mut attached_ids = Vec::new();
        for raw_label in &item.labels {
            let trimmed = raw_label.trim();
            if trimmed.is_empty() {
                continue;
            }
            let key = trimmed.to_ascii_lowercase();
            let label_id = if let Some(&id) = label_map.get(&key) {
                id
            } else {
                let id = sqlx::query_scalar::<_, Uuid>(
                    "INSERT INTO labels (workspace_id, name, color) VALUES ($1, $2, '#64748b') RETURNING id",
                )
                .bind(ws)
                .bind(trimmed)
                .fetch_one(&mut *tx)
                .await
                .map_err(AppError::DatabaseError)?;
                label_map.insert(key, id);
                id
            };
            attached_ids.push(label_id);
        }

        if !attached_ids.is_empty() {
            sqlx::query(
                "INSERT INTO issue_labels (issue_id, label_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING",
            )
            .bind(issue_id)
            .bind(&attached_ids)
            .execute(&mut *tx)
            .await
            .map_err(AppError::DatabaseError)?;
        }

        outcomes.push(json!({"row":idx+1,"external_id":item.external_id,"issue_id":issue_id,
            "result":if existing_id.is_some() { "updated" } else { "created" }}));
        imported_count += 1;
    }

    sqlx::query("UPDATE projects SET issue_counter = $1 WHERE id = $2")
        .bind(issue_counter)
        .bind(project_id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::DatabaseError)?;

    tx.commit().await.map_err(AppError::DatabaseError)?;

    Ok(Json(SyncImportResponse {
        project_id,
        project_key: final_key,
        imported_count,
        updated_count,
        outcomes,
        skipped_count: req.issues.len() - imported_count,
    }))
}

pub async fn seed_demo(
    user: AuthenticatedUser,
    State(state): State<AppState>,
    Path(ws): Path<Uuid>,
) -> Result<Json<SyncImportResponse>, AppError> {
    let demo_issues = vec![
        SyncIssueItem {
            external_id: "DEMO-1".into(),
            title: "Set up PostgreSQL connection pool and health checks".into(),
            description: Some("Verify /ready checks database and Redis connectivity.".into()),
            issue_type: "task".into(),
            priority: "high".into(),
            status: "Done".into(),
            labels: vec!["backend".into()],
        },
        SyncIssueItem {
            external_id: "DEMO-2".into(),
            title: "Configure organization workflow templates".into(),
            description: Some("Create default Kanban and Support Desk templates.".into()),
            issue_type: "feature".into(),
            priority: "medium".into(),
            status: "Done".into(),
            labels: vec!["frontend".into()],
        },
        SyncIssueItem {
            external_id: "DEMO-3".into(),
            title: "Review sprint burndown and cumulative flow reports".into(),
            description: Some("Check daily snapshot chart on the Dashboard.".into()),
            issue_type: "feature".into(),
            priority: "medium".into(),
            status: "In Review".into(),
            labels: vec!["frontend".into(), "design".into()],
        },
        SyncIssueItem {
            external_id: "DEMO-4".into(),
            title: "Implement webhook retry backoff for external integrations".into(),
            description: Some("Exponential backoff up to 5 delivery attempts.".into()),
            issue_type: "bug".into(),
            priority: "critical".into(),
            status: "In Progress".into(),
            labels: vec!["backend".into()],
        },
        SyncIssueItem {
            external_id: "DEMO-5".into(),
            title: "Refine mobile Kanban column drag-and-drop".into(),
            description: Some("Ensure smooth touch scrolling and drop targets on mobile.".into()),
            issue_type: "bug".into(),
            priority: "high".into(),
            status: "In Progress".into(),
            labels: vec!["frontend".into(), "design".into()],
        },
        SyncIssueItem {
            external_id: "DEMO-6".into(),
            title: "Import existing Jira tickets into Kanbrix".into(),
            description: Some("Test Settings -> Integrations -> Sync & Import.".into()),
            issue_type: "task".into(),
            priority: "medium".into(),
            status: "Todo".into(),
            labels: vec!["backend".into(), "frontend".into()],
        },
    ];

    let suffix = &Uuid::new_v4().simple().to_string()[..4].to_uppercase();
    import_project(
        user,
        State(state),
        Path(ws),
        Json(SyncImportRequest {
            target_project_id: None,
            project_name: format!("Sample Product ({suffix})"),
            project_key: format!("DM{suffix}"),
            description: Some("Sample project seeded with realistic issues, labels, and workflow states.".into()),
            status_map: HashMap::new(),
            issues: demo_issues,
        }),
    )
    .await
}

fn extract_issue_refs(text: &str) -> Vec<(String, i32)> {
    let mut refs = Vec::new();
    let bytes = text.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i].is_ascii_alphanumeric() {
            let start = i;
            while i < bytes.len() && bytes[i].is_ascii_alphanumeric() {
                i += 1;
            }
            if i < bytes.len() && bytes[i] == b'-' && (2..=10).contains(&(i - start)) {
                let key = &text[start..i];
                if key.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
                    && key.chars().any(|c| c.is_ascii_uppercase())
                {
                    let num_start = i + 1;
                    let mut j = num_start;
                    while j < bytes.len() && bytes[j].is_ascii_digit() {
                        j += 1;
                    }
                    if j > num_start {
                        if let Ok(num) = text[num_start..j].parse::<i32>() {
                            let pair = (key.to_string(), num);
                            if !refs.contains(&pair) {
                                refs.push(pair);
                            }
                        }
                        i = j;
                        continue;
                    }
                }
            }
        } else {
            i += 1;
        }
    }
    refs
}

#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct GitSettings {
    opened: Option<Uuid>,
    merged: Option<Uuid>,
}

pub async fn git_settings(user: AuthenticatedUser, State(state): State<AppState>, Path((ws, project)): Path<(Uuid, Uuid)>) -> Result<Json<GitSettings>, AppError> {
    verify_workspace_membership(&state.pool, ws, user.id).await?;
    let settings = sqlx::query_as("SELECT git_opened_status AS opened, git_merged_status AS merged FROM projects WHERE id=$1 AND workspace_id=$2")
        .bind(project).bind(ws).fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound("Project".into()))?;
    Ok(Json(settings))
}

pub async fn save_git_settings(user: AuthenticatedUser, State(state): State<AppState>, Path((ws, project)): Path<(Uuid, Uuid)>, Json(settings): Json<GitSettings>) -> Result<Json<GitSettings>, AppError> {
    if !verify_workspace_membership(&state.pool, ws, user.id).await?.can_manage_workspace() {
        return Err(AppError::Forbidden("Administrator access required".into()));
    }
    let updated = sqlx::query("UPDATE projects SET git_opened_status=$3, git_merged_status=$4 WHERE id=$1 AND workspace_id=$2 AND ($3::uuid IS NULL OR EXISTS(SELECT 1 FROM issue_statuses WHERE project_id=$1 AND id=$3)) AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM issue_statuses WHERE project_id=$1 AND id=$4))")
        .bind(project).bind(ws).bind(settings.opened).bind(settings.merged).execute(&state.pool).await?;
    if updated.rows_affected() == 0 {
        return Err(AppError::BadRequest("Choose a status from the selected project".into()));
    }
    Ok(Json(settings))
}

pub async fn git_webhook(
    State(state): State<AppState>,
    Path(ws): Path<Uuid>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, AppError> {
    let raw = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or_else(|| AppError::Unauthorized("Integration token required".into()))?;

    let valid: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM integration_settings WHERE workspace_id=$1 AND token_hash=$2)",
    )
    .bind(ws)
    .bind(crate::common::auth::hash_token(raw))
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    if !valid {
        return Err(AppError::Unauthorized("Invalid integration token".into()));
    }

    let pr_title = payload
        .pointer("/pull_request/title")
        .or_else(|| payload.pointer("/object_attributes/title"))
        .or_else(|| payload.get("title"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let pr_url = payload
        .pointer("/pull_request/html_url")
        .or_else(|| payload.pointer("/object_attributes/url"))
        .or_else(|| payload.get("url"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let merged = payload
        .pointer("/pull_request/merged")
        .or_else(|| payload.get("merged"))
        .and_then(Value::as_bool)
        .unwrap_or(false)
        || payload
            .pointer("/object_attributes/state")
            .or_else(|| payload.get("state"))
            .and_then(Value::as_str)
            .is_some_and(|s| s.eq_ignore_ascii_case("merged"));
    let action = payload
        .get("action")
        .or_else(|| payload.pointer("/object_attributes/action"))
        .or_else(|| payload.get("state"))
        .and_then(Value::as_str)
        .unwrap_or(if merged { "merged" } else { "updated" });

    let mut search_text = pr_title.to_string();
    if let Some(commits) = payload.get("commits").and_then(Value::as_array) {
        for c in commits {
            if let Some(msg) = c.get("message").and_then(Value::as_str) {
                search_text.push(' ');
                search_text.push_str(msg);
            }
        }
    }

    let refs = extract_issue_refs(&search_text);
    let mut linked = Vec::new();

    let mut tx = state.pool.begin().await?;
    for (proj_key, issue_num) in refs {
        let found = sqlx::query_as::<_, (Uuid, Uuid, Uuid)>(
            r#"
            SELECT i.id, i.project_id, i.reporter_id
            FROM issues i
            JOIN projects p ON p.id = i.project_id
            WHERE p.workspace_id = $1 AND p.project_key = $2 AND i.issue_number = $3
            "#,
        )
        .bind(ws)
        .bind(&proj_key)
        .bind(issue_num)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AppError::DatabaseError)?;

        let Some((issue_id, project_id, reporter_id)) = found else {
            continue;
        };

        let comment_body = if pr_url.is_empty() {
            format!("Git activity ({action}): {pr_title}")
        } else {
            format!("Git PR ({action}): [{pr_title}]({pr_url})")
        };

        sqlx::query("INSERT INTO comments (issue_id, author_id, body) VALUES ($1, $2, $3)")
            .bind(issue_id)
            .bind(reporter_id)
            .bind(comment_body)
            .execute(&mut *tx)
            .await
            .map_err(AppError::DatabaseError)?;

        let target_cat = if merged {
            Some("Done")
        } else if matches!(action, "opened" | "open") {
            Some("InReview")
        } else {
            None
        };
        if let Some(cat) = target_cat {
            if let Some(status_id) = sqlx::query_scalar::<_, Option<Uuid>>(
                "SELECT COALESCE(CASE WHEN $2 = 'Done' THEN git_merged_status ELSE git_opened_status END, (SELECT id FROM issue_statuses WHERE project_id=$1 AND category=$2 ORDER BY position LIMIT 1)) FROM projects WHERE id=$1",
            )
            .bind(project_id)
            .bind(cat)
            .fetch_one(&mut *tx)
            .await
            .map_err(AppError::DatabaseError)?
            {
                sqlx::query("UPDATE issues SET status_id = $1, updated_at = NOW() WHERE id = $2")
                    .bind(status_id)
                    .bind(issue_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }
        }

        linked.push(format!("{proj_key}-{issue_num}"));
    }

    tx.commit().await?;
    Ok(Json(json!({ "linked_issues": linked })))
}
#[cfg(test)]
mod jira_tests {
    use super::*;
    use axum::{extract::Query, routing::get, Router};

    #[tokio::test]
    async fn cloud_preview_reads_six_pages_and_preserves_description_text() {
        async fn page(Query(params): Query<HashMap<String, String>>) -> Json<Value> {
            let page = params.get("nextPageToken").map(|v| v.parse::<usize>().unwrap()).unwrap_or(0);
            let issues: Vec<_> = (1..=100).map(|index| json!({
                "key": format!("SRC-{}", page * 100 + index),
                "fields": {"summary": "Pilot ticket", "description": {
                    "type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Details"}]}]
                }}
            })).collect();
            Json(json!({"issues":issues, "nextPageToken":(page < 5).then(|| (page + 1).to_string())}))
        }

        let app = Router::new()
            .route("/rest/api/3/project/SRC", get(|| async { Json(json!({"name":"Pilot", "key":"SRC"})) }))
            .route("/rest/api/3/search/jql", get(page));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let server = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        let result = preview_jira(&reqwest::Client::new(), Some(&base), None, "fixture", "SRC").await.unwrap();
        server.abort();
        assert_eq!(result.issues.len(), 600);
        assert_eq!(result.issues[599].external_id, "SRC-600");
        assert_eq!(result.issues[599].description.as_deref(), Some("Details"));
    }
}

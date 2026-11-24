use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use validator::Validate;

use crate::{
    common::{
        auth::{verify_workspace_membership, AuthenticatedUser},
        error::AppError,
        state::AppState,
    },
    domain::projects::dto::{
        CreateProjectRequest, ProjectResponse, StatusSummary, UpdateProjectRequest,
    },
};

#[utoipa::path(get,path="/api/v1/workspaces/{workspace_id}/projects",params(("workspace_id"=Uuid,Path,description="workspace id")),responses((status=200,body=[ProjectResponse])))]
pub async fn list_workspace_projects(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<Vec<ProjectResponse>>, AppError> {
    verify_workspace_membership(&state.pool, workspace_id, auth_user.id).await?;

    let rows = sqlx::query!(
        r#"
        SELECT id, workspace_id, name, project_key, description, issue_counter,
               archived_at, created_at, updated_at
        FROM projects
        WHERE workspace_id = $1 AND archived_at IS NULL
        ORDER BY created_at ASC
        "#,
        workspace_id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let projects = rows
        .into_iter()
        .map(|r| ProjectResponse {
            id: r.id,
            workspace_id: r.workspace_id,
            name: r.name,
            project_key: r.project_key,
            description: r.description,
            issue_counter: r.issue_counter,
            archived_at: r.archived_at,
            created_at: r.created_at,
            updated_at: r.updated_at,
            statuses: None,
        })
        .collect();

    Ok(Json(projects))
}

#[utoipa::path(post,path="/api/v1/workspaces/{workspace_id}/projects",params(("workspace_id"=Uuid,Path,description="workspace id")),request_body=CreateProjectRequest,responses((status=201,body=ProjectResponse)))]
pub async fn create_project(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<CreateProjectRequest>,
) -> Result<(StatusCode, Json<ProjectResponse>), AppError> {
    let role = verify_workspace_membership(&state.pool, workspace_id, auth_user.id).await?;
    crate::domain::workspaces::configuration::permit(
        &state.pool,
        workspace_id,
        role.to_str(),
        "create_projects",
    )
    .await?;
    if !role.can_edit_project() {
        return Err(AppError::Forbidden(
            "Insufficient permissions to create project in this workspace".into(),
        ));
    }

    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    let key = payload.project_key.trim().to_uppercase();

    let mut tx = state.pool.begin().await.map_err(AppError::DatabaseError)?;

    let proj = sqlx::query!(
        r#"
        INSERT INTO projects (workspace_id, name, project_key, description)
        VALUES ($1, $2, $3, $4)
        RETURNING id, workspace_id, name, project_key, description, issue_counter,
                  archived_at, created_at, updated_at
        "#,
        workspace_id,
        payload.name,
        key,
        payload.description
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err) if db_err.is_unique_violation() => {
            AppError::Conflict("A project with this key already exists in this workspace".into())
        }
        other => AppError::DatabaseError(other),
    })?;

    let (_, cfg) = crate::domain::workspaces::configuration::current(&mut tx, workspace_id).await?;
    let owned_builtin = payload.template.as_deref().and_then(builtin_template);
    let template = match payload.template.as_deref() {
        Some(name) => cfg
            .templates
            .iter()
            .find(|t| t.name == name)
            .or(owned_builtin.as_ref()),
        None => cfg.templates.first(),
    }
    .ok_or_else(|| AppError::BadRequest("Unknown project template".into()))?;
    sqlx::query("UPDATE projects SET sprint_enabled=$1,form_overrides=$3 WHERE id=$2")
        .bind(template.sprints)
        .bind(proj.id)
        .bind(sqlx::types::Json(&template.form))
        .execute(&mut *tx)
        .await?;
    let mut created_statuses = Vec::new();
    for (index, column) in template.columns.iter().enumerate() {
        let name = &column.name;
        let category = &column.category;
        let pos = (index + 1) as f64 * 1000.;
        let status_row = sqlx::query!(
            r#"
            INSERT INTO issue_statuses (project_id, name, category, position)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, category, position
            "#,
            proj.id,
            name,
            category,
            pos
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(AppError::DatabaseError)?;

        created_statuses.push(StatusSummary {
            id: status_row.id,
            name: status_row.name,
            category: status_row.category,
            position: status_row.position,
            wip_limit: None,
        });
    }

    let mut transitions = Vec::new();
    for [from, to] in &template.transitions {
        if let (Some(a), Some(b)) = (
            created_statuses.iter().find(|s| &s.name == from),
            created_statuses.iter().find(|s| &s.name == to),
        ) {
            transitions.push([a.id, b.id]);
        }
    }
    sqlx::query("UPDATE projects SET transitions=$1 WHERE id=$2")
        .bind(serde_json::json!(transitions))
        .bind(proj.id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await.map_err(AppError::DatabaseError)?;

    Ok((
        StatusCode::CREATED,
        Json(ProjectResponse {
            id: proj.id,
            workspace_id: proj.workspace_id,
            name: proj.name,
            project_key: proj.project_key,
            description: proj.description,
            issue_counter: proj.issue_counter,
            archived_at: proj.archived_at,
            created_at: proj.created_at,
            updated_at: proj.updated_at,
            statuses: Some(created_statuses),
        }),
    ))
}

#[utoipa::path(get,path="/api/v1/projects/{project_id}",params(("project_id"=Uuid,Path,description="project id")),responses((status=200,body=ProjectResponse)))]
pub async fn get_project(
    auth_user: AuthenticatedUser,
    Path(project_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<ProjectResponse>, AppError> {
    let proj = sqlx::query!(
        r#"
        SELECT p.workflow_revision,p.id, p.workspace_id, p.name, p.project_key, p.description,
               p.issue_counter, p.archived_at, p.created_at, p.updated_at
        FROM projects p
        JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
        WHERE p.id = $1 AND wm.user_id = $2
        "#,
        project_id,
        auth_user.id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?
    .ok_or_else(|| AppError::NotFound("Project not found or access denied".into()))?;

    let key = format!(
        "kanbrix:v1:project:{}:{}:{}:{}",
        project_id,
        proj.updated_at.timestamp_micros(),
        proj.workflow_revision,
        proj.issue_counter
    );
    if let Some(value) = state.cache.get(&key).await {
        return Ok(Json(value));
    }
    let statuses = sqlx::query!(
        r#"
        SELECT id, name, category, position, wip_limit
        FROM issue_statuses
        WHERE project_id = $1
        ORDER BY position ASC
        "#,
        project_id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let status_summaries = statuses
        .into_iter()
        .map(|s| StatusSummary {
            id: s.id,
            name: s.name,
            category: s.category,
            position: s.position,
            wip_limit: s.wip_limit,
        })
        .collect();

    let response = ProjectResponse {
        id: proj.id,
        workspace_id: proj.workspace_id,
        name: proj.name,
        project_key: proj.project_key,
        description: proj.description,
        issue_counter: proj.issue_counter,
        archived_at: proj.archived_at,
        created_at: proj.created_at,
        updated_at: proj.updated_at,
        statuses: Some(status_summaries),
    };
    state.cache.put(&key, &response).await;
    Ok(Json(response))
}

#[utoipa::path(patch,path="/api/v1/projects/{project_id}",params(("project_id"=Uuid,Path,description="project id")),request_body=UpdateProjectRequest,responses((status=200,body=ProjectResponse)))]
pub async fn update_project(
    auth_user: AuthenticatedUser,
    Path(project_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<UpdateProjectRequest>,
) -> Result<Json<ProjectResponse>, AppError> {
    let existing = sqlx::query!(
        r#"
        SELECT p.workspace_id, wm.role
        FROM projects p
        JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
        WHERE p.id = $1 AND wm.user_id = $2
        "#,
        project_id,
        auth_user.id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?
    .ok_or_else(|| AppError::NotFound("Project not found".into()))?;

    if existing.role != "Owner" && existing.role != "Admin" {
        return Err(AppError::Forbidden(
            "Only workspace owners and admins can modify projects".into(),
        ));
    }

    let updated = sqlx::query!(
        r#"
        UPDATE projects
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            updated_at = NOW()
        WHERE id = $3
        RETURNING id, workspace_id, name, project_key, description, issue_counter,
                  archived_at, created_at, updated_at
        "#,
        payload.name,
        payload.description,
        project_id
    )
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    state.cache.del(&format!("project:{project_id}")).await;

    Ok(Json(ProjectResponse {
        id: updated.id,
        workspace_id: updated.workspace_id,
        name: updated.name,
        project_key: updated.project_key,
        description: updated.description,
        issue_counter: updated.issue_counter,
        archived_at: updated.archived_at,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        statuses: None,
    }))
}

pub async fn delete_project(
    auth_user: AuthenticatedUser,
    Path(project_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<axum::http::StatusCode, AppError> {
    let existing = sqlx::query!(
        r#"
        SELECT p.workspace_id, wm.role
        FROM projects p
        JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
        WHERE p.id = $1 AND wm.user_id = $2
        "#,
        project_id,
        auth_user.id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?
    .ok_or_else(|| AppError::NotFound("Project not found".into()))?;

    if existing.role != "Owner" && existing.role != "Admin" {
        return Err(AppError::Forbidden(
            "Only workspace owners and admins can delete projects".into(),
        ));
    }

    sqlx::query("DELETE FROM projects WHERE id = $1 AND workspace_id = $2")
        .bind(project_id)
        .bind(existing.workspace_id)
        .execute(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    state.cache.del(&format!("project:{project_id}")).await;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[derive(serde::Serialize)]
pub struct SavedFilterResponse {
    pub id: Uuid,
    pub name: String,
    pub query_params: serde_json::Value,
}

#[derive(serde::Deserialize)]
pub struct CreateSavedFilterRequest {
    pub name: String,
    pub query_params: serde_json::Value,
}

pub async fn list_filters(
    auth_user: AuthenticatedUser,
    Path(project_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<Vec<SavedFilterResponse>>, AppError> {
    let rows = sqlx::query_as::<_, (Uuid, String, serde_json::Value)>(
        r#"
        SELECT f.id, f.name, f.query_params
        FROM project_saved_filters f
        JOIN projects p ON p.id = f.project_id
        JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
        WHERE f.project_id = $1 AND f.user_id = $2 AND wm.user_id = $2
        ORDER BY f.created_at ASC
        "#,
    )
    .bind(project_id)
    .bind(auth_user.id)
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(Json(
        rows.into_iter()
            .map(|(id, name, query_params)| SavedFilterResponse {
                id,
                name,
                query_params,
            })
            .collect(),
    ))
}

pub async fn create_filter(
    auth_user: AuthenticatedUser,
    Path(project_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(req): Json<CreateSavedFilterRequest>,
) -> Result<(StatusCode, Json<SavedFilterResponse>), AppError> {
    let name = req.name.trim();
    if name.is_empty() || name.len() > 80 {
        return Err(AppError::BadRequest(
            "Filter name must be between 1 and 80 characters".into(),
        ));
    }

    let has_access = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM projects p
            JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
            WHERE p.id = $1 AND wm.user_id = $2
        )
        "#,
    )
    .bind(project_id)
    .bind(auth_user.id)
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    if !has_access {
        return Err(AppError::NotFound("Project not found".into()));
    }

    let id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO project_saved_filters (project_id, user_id, name, query_params) VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(project_id)
    .bind(auth_user.id)
    .bind(name)
    .bind(&req.query_params)
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok((
        StatusCode::CREATED,
        Json(SavedFilterResponse {
            id,
            name: name.to_string(),
            query_params: req.query_params,
        }),
    ))
}

pub async fn delete_filter(
    auth_user: AuthenticatedUser,
    Path((project_id, filter_id)): Path<(Uuid, Uuid)>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    sqlx::query("DELETE FROM project_saved_filters WHERE id = $1 AND project_id = $2 AND user_id = $3")
        .bind(filter_id)
        .bind(project_id)
        .bind(auth_user.id)
        .execute(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok(StatusCode::NO_CONTENT)
}

fn builtin_template(name: &str) -> Option<crate::domain::workspaces::configuration::Template> {
    use crate::domain::workspaces::configuration::{Column, FormOverrides, Template};
    let col = |n: &str, cat: &str| Column {
        name: n.to_string(),
        category: cat.to_string(),
    };
    let (sprints, cols) = match name {
        "Kanban" => (
            false,
            vec![
                col("Backlog", "Backlog"),
                col("To Do", "Todo"),
                col("In Progress", "InProgress"),
                col("Done", "Done"),
            ],
        ),
        "Scrum" => (
            true,
            vec![
                col("Backlog", "Backlog"),
                col("To Do", "Todo"),
                col("In Progress", "InProgress"),
                col("In Review", "InReview"),
                col("Done", "Done"),
            ],
        ),
        "Prioritization" => (
            false,
            vec![
                col("Ideas", "Backlog"),
                col("Evaluating", "Todo"),
                col("Committed", "InProgress"),
                col("Shipped", "Done"),
            ],
        ),
        "Development requests" => (
            true,
            vec![
                col("Triage", "Backlog"),
                col("Accepted", "Todo"),
                col("In Development", "InProgress"),
                col("In Review", "InReview"),
                col("Released", "Done"),
            ],
        ),
        "Cross-team planning" => (
            true,
            vec![
                col("Proposed", "Backlog"),
                col("Aligned", "Todo"),
                col("In Execution", "InProgress"),
                col("Completed", "Done"),
            ],
        ),
        "Process control" => (
            false,
            vec![
                col("Queued", "Todo"),
                col("In Progress", "InProgress"),
                col("QA Check", "InReview"),
                col("Completed", "Done"),
            ],
        ),
        "IT Service Desk" => (
            false,
            vec![
                col("New", "Backlog"),
                col("Triaged", "Todo"),
                col("Investigating", "InProgress"),
                col("Pending User", "InReview"),
                col("Resolved", "Done"),
            ],
        ),
        "Incident Management" => (
            false,
            vec![
                col("Detected", "Backlog"),
                col("Acknowledged", "Todo"),
                col("Mitigating", "InProgress"),
                col("Postmortem", "InReview"),
                col("Closed", "Done"),
            ],
        ),
        "Change Management" => (
            false,
            vec![
                col("Requested", "Backlog"),
                col("CAB Review", "Todo"),
                col("Scheduled", "InProgress"),
                col("Validating", "InReview"),
                col("Deployed", "Done"),
            ],
        ),
        "DevOps & CI/CD" => (
            true,
            vec![
                col("Backlog", "Backlog"),
                col("Ready", "Todo"),
                col("Building", "InProgress"),
                col("Staging QA", "InReview"),
                col("Production", "Done"),
            ],
        ),
        "Security & Compliance" => (
            false,
            vec![
                col("Reported", "Backlog"),
                col("Triaged", "Todo"),
                col("Patching", "InProgress"),
                col("Verification", "InReview"),
                col("Remediated", "Done"),
            ],
        ),
        "Bug Tracking" => (
            true,
            vec![
                col("Reported", "Backlog"),
                col("Confirmed", "Todo"),
                col("Fixing", "InProgress"),
                col("QA Testing", "InReview"),
                col("Verified", "Done"),
            ],
        ),
        "Infrastructure & Cloud" => (
            false,
            vec![
                col("Proposed", "Backlog"),
                col("Approved", "Todo"),
                col("Provisioning", "InProgress"),
                col("Audit", "InReview"),
                col("Live", "Done"),
            ],
        ),
        "Release Management" => (
            true,
            vec![
                col("Planned", "Backlog"),
                col("Code Freeze", "Todo"),
                col("QA Sign-off", "InProgress"),
                col("Canary", "InReview"),
                col("Released", "Done"),
            ],
        ),
        _ => return None,
    };
    Some(Template {
        name: name.to_string(),
        sprints,
        columns: cols,
        transitions: Vec::new(),
        form: FormOverrides::default(),
    })
}

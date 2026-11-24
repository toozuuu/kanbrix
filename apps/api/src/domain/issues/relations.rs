use crate::common::{auth::AuthenticatedUser, error::AppError, state::AppState};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize)]
pub struct SubtaskSummary {
    pub id: Uuid,
    pub identifier: String,
    pub title: String,
    pub priority: String,
    pub status_name: String,
    pub status_category: String,
}

#[derive(Serialize)]
pub struct LinkedIssueSummary {
    pub id: Uuid,
    pub link_type: String,
    pub issue_id: Uuid,
    pub identifier: String,
    pub title: String,
    pub status_name: String,
}

#[derive(Serialize)]
pub struct IssueRelationsResponse {
    pub subtasks: Vec<SubtaskSummary>,
    pub links: Vec<LinkedIssueSummary>,
}

#[derive(Deserialize)]
pub struct CreateIssueLinkRequest {
    pub target_identifier: String,
    pub link_type: String,
}

async fn ensure_issue_access(
    pool: &sqlx::PgPool,
    issue_id: Uuid,
    user_id: Uuid,
) -> Result<(Uuid, String), AppError> {
    sqlx::query_as::<_, (Uuid, String)>(
        r#"
        SELECT p.workspace_id, wm.role
        FROM issues i
        JOIN projects p ON p.id = i.project_id
        JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
        WHERE i.id = $1 AND wm.user_id = $2 AND i.archived_at IS NULL
        "#,
    )
    .bind(issue_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::DatabaseError)?
    .ok_or_else(|| AppError::NotFound("Issue not found or access denied".into()))
}

pub async fn get_relations(
    user: AuthenticatedUser,
    Path(issue_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<IssueRelationsResponse>, AppError> {
    ensure_issue_access(&state.pool, issue_id, user.id).await?;

    let subtask_rows = sqlx::query_as::<_, (Uuid, String, i32, String, String, String, String)>(
        r#"
        SELECT i.id, p.project_key, i.issue_number, i.title, i.priority, s.name, s.category
        FROM issues i
        JOIN projects p ON p.id = i.project_id
        JOIN issue_statuses s ON s.id = i.status_id
        WHERE i.parent_issue_id = $1 AND i.archived_at IS NULL
        ORDER BY i.position ASC, i.created_at ASC
        "#,
    )
    .bind(issue_id)
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let subtasks = subtask_rows
        .into_iter()
        .map(|(id, key, num, title, priority, status_name, status_category)| SubtaskSummary {
            id,
            identifier: format!("{key}-{num}"),
            title,
            priority,
            status_name,
            status_category,
        })
        .collect();

    let link_rows = sqlx::query_as::<_, (Uuid, String, Uuid, String, i32, String, String)>(
        r#"
        SELECT l.id, l.link_type, tgt.id, p.project_key, tgt.issue_number, tgt.title, s.name
        FROM issue_links l
        JOIN issues tgt ON tgt.id = l.target_issue_id
        JOIN projects p ON p.id = tgt.project_id
        JOIN issue_statuses s ON s.id = tgt.status_id
        WHERE l.source_issue_id = $1 AND tgt.archived_at IS NULL
        UNION ALL
        SELECT l.id,
               CASE l.link_type
                 WHEN 'blocks' THEN 'is_blocked_by'
                 WHEN 'is_blocked_by' THEN 'blocks'
                 ELSE l.link_type
               END AS link_type,
               src.id, p.project_key, src.issue_number, src.title, s.name
        FROM issue_links l
        JOIN issues src ON src.id = l.source_issue_id
        JOIN projects p ON p.id = src.project_id
        JOIN issue_statuses s ON s.id = src.status_id
        WHERE l.target_issue_id = $1 AND src.archived_at IS NULL
        "#,
    )
    .bind(issue_id)
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let links = link_rows
        .into_iter()
        .map(|(id, link_type, target_id, key, num, title, status_name)| LinkedIssueSummary {
            id,
            link_type,
            issue_id: target_id,
            identifier: format!("{key}-{num}"),
            title,
            status_name,
        })
        .collect();

    Ok(Json(IssueRelationsResponse { subtasks, links }))
}

pub async fn add_link(
    user: AuthenticatedUser,
    Path(issue_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(req): Json<CreateIssueLinkRequest>,
) -> Result<StatusCode, AppError> {
    let (workspace_id, role) = ensure_issue_access(&state.pool, issue_id, user.id).await?;
    if role == "Viewer" {
        return Err(AppError::Forbidden("Viewers cannot link issues".into()));
    }

    let link_type = req.link_type.trim();
    if !matches!(
        link_type,
        "blocks" | "is_blocked_by" | "relates_to" | "duplicates"
    ) {
        return Err(AppError::BadRequest("Invalid link_type".into()));
    }

    let ident = req.target_identifier.trim().to_ascii_uppercase();
    let (proj_key, num_str) = ident
        .rsplit_once('-')
        .ok_or_else(|| AppError::BadRequest("Target identifier must look like CORE-12".into()))?;
    let issue_num: i32 = num_str
        .parse()
        .map_err(|_| AppError::BadRequest("Invalid issue number in identifier".into()))?;

    let target_id: Uuid = sqlx::query_scalar(
        r#"
        SELECT i.id
        FROM issues i
        JOIN projects p ON p.id = i.project_id
        WHERE p.workspace_id = $1 AND p.project_key = $2 AND i.issue_number = $3 AND i.archived_at IS NULL
        "#,
    )
    .bind(workspace_id)
    .bind(proj_key)
    .bind(issue_num)
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?
    .ok_or_else(|| AppError::NotFound(format!("Issue {ident} not found in workspace")))?;

    if target_id == issue_id {
        return Err(AppError::BadRequest("Cannot link an issue to itself".into()));
    }

    sqlx::query(
        r#"
        INSERT INTO issue_links (source_issue_id, target_issue_id, link_type)
        VALUES ($1, $2, $3)
        ON CONFLICT (source_issue_id, target_issue_id, link_type) DO NOTHING
        "#,
    )
    .bind(issue_id)
    .bind(target_id)
    .bind(link_type)
    .execute(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(StatusCode::CREATED)
}

pub async fn remove_link(
    user: AuthenticatedUser,
    Path((issue_id, link_id)): Path<(Uuid, Uuid)>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    let (_ws, role) = ensure_issue_access(&state.pool, issue_id, user.id).await?;
    if role == "Viewer" {
        return Err(AppError::Forbidden("Viewers cannot unlink issues".into()));
    }

    sqlx::query(
        "DELETE FROM issue_links WHERE id = $1 AND (source_issue_id = $2 OR target_issue_id = $2)",
    )
    .bind(link_id)
    .bind(issue_id)
    .execute(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(StatusCode::NO_CONTENT)
}

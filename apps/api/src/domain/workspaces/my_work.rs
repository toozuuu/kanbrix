use axum::{
    extract::{Path, Query, State},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::common::{
    auth::{verify_workspace_membership, AuthenticatedUser},
    error::AppError,
    state::AppState,
};

const PAGE_SIZE: i64 = 30;

#[derive(Deserialize)]
pub struct WorkFilters {
    #[serde(default)]
    offset: i64,
}

#[derive(Serialize, ToSchema)]
pub struct WorkItem {
    id: Uuid,
    identifier: String,
    title: String,
    project_name: String,
    status_name: String,
    due_date: Option<DateTime<Utc>>,
}

#[derive(Serialize, ToSchema)]
pub struct MyWork {
    items: Vec<WorkItem>,
    next_offset: Option<i64>,
}

#[utoipa::path(
    get, path = "/api/v1/workspaces/{workspace_id}/my-work",
    operation_id = "list_workspace_my_work",
    params(
        ("workspace_id" = Uuid, Path, description = "Workspace ID"),
        ("offset" = Option<i64>, Query, description = "Number of assignments to skip"),
    ),
    responses((status = 200, body = MyWork))
)]
pub async fn list(
    user: AuthenticatedUser,
    Path(workspace_id): Path<Uuid>,
    Query(filters): Query<WorkFilters>,
    State(state): State<AppState>,
) -> Result<Json<MyWork>, AppError> {
    verify_workspace_membership(&state.pool, workspace_id, user.id).await?;
    let mut items = sqlx::query_as!(
        WorkItem,
        r#"
        SELECT i.id, p.project_key || '-' || i.issue_number AS "identifier!",
               i.title, p.name AS project_name, s.name AS status_name, i.due_date
        FROM issues i
        JOIN projects p ON p.id = i.project_id
        JOIN issue_statuses s ON s.id = i.status_id
        WHERE p.workspace_id = $1 AND i.assignee_id = $2
          AND p.archived_at IS NULL AND i.archived_at IS NULL AND s.category <> 'Done'
        ORDER BY i.due_date ASC NULLS LAST, i.id
        LIMIT $3 OFFSET $4
        "#,
        workspace_id,
        user.id,
        PAGE_SIZE + 1,
        filters.offset.max(0),
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let next_offset = (items.len() > PAGE_SIZE as usize).then(|| filters.offset.max(0) + PAGE_SIZE);
    items.truncate(PAGE_SIZE as usize);
    Ok(Json(MyWork { items, next_offset }))
}

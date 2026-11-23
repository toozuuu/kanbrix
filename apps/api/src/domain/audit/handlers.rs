use axum::{
    extract::{Path, State},
    Json,
};
use uuid::Uuid;

use crate::{
    common::{
        auth::{verify_workspace_membership, AuthenticatedUser},
        error::AppError,
        state::AppState,
    },
    domain::audit::dto::ActivityLogResponse,
};

#[utoipa::path(get,path="/api/v1/workspaces/{workspace_id}/activity",params(("workspace_id"=Uuid,Path,description="workspace id")),responses((status=200,body=[ActivityLogResponse])))]
pub async fn list_workspace_activity(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<Vec<ActivityLogResponse>>, AppError> {
    verify_workspace_membership(&state.pool, workspace_id, auth_user.id).await?;

    let rows = sqlx::query!(
        r#"
        SELECT a.id, a.workspace_id, a.actor_id, u.name as "actor_name?",
               a.entity_type, a.entity_id, a.action, a.metadata, a.created_at
        FROM activity_logs a
        LEFT JOIN users u ON a.actor_id = u.id
        WHERE a.workspace_id = $1
        ORDER BY a.created_at DESC
        LIMIT 50
        "#,
        workspace_id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let logs = rows
        .into_iter()
        .map(|r| ActivityLogResponse {
            id: r.id,
            workspace_id: r.workspace_id,
            actor_id: r.actor_id,
            actor_name: r.actor_name,
            entity_type: r.entity_type,
            entity_id: r.entity_id,
            action: r.action,
            metadata: r.metadata,
            created_at: r.created_at,
        })
        .collect();

    Ok(Json(logs))
}

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

use crate::{
    common::{auth::AuthenticatedUser, error::AppError, state::AppState},
    domain::notifications::dto::NotificationResponse,
};

pub async fn list_notifications(
    auth_user: AuthenticatedUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<NotificationResponse>>, AppError> {
    let rows = sqlx::query!(
        r#"
        SELECT n.id, n.recipient_id, n.actor_id, u.name as actor_name,
               n.type, n.payload, n.read_at, n.created_at
        FROM notifications n
        LEFT JOIN users u ON n.actor_id = u.id
        WHERE n.recipient_id = $1
        ORDER BY n.created_at DESC
        LIMIT 50
        "#,
        auth_user.id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let notifications = rows
        .into_iter()
        .map(|r| NotificationResponse {
            id: r.id,
            recipient_id: r.recipient_id,
            actor_id: r.actor_id,
            actor_name: r.actor_name,
            r#type: r.r#type,
            payload: r.payload,
            read_at: r.read_at,
            created_at: r.created_at,
        })
        .collect();

    Ok(Json(notifications))
}

pub async fn mark_read(
    auth_user: AuthenticatedUser,
    Path(notification_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    sqlx::query!(
        r#"
        UPDATE notifications
        SET read_at = NOW()
        WHERE id = $1 AND recipient_id = $2
        "#,
        notification_id,
        auth_user.id
    )
    .execute(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(StatusCode::OK)
}

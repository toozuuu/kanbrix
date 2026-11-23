use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use validator::Validate;

use crate::{
    common::{auth::AuthenticatedUser, error::AppError, state::AppState},
    domain::comments::dto::{CommentResponse, CreateCommentRequest},
};

pub async fn list_comments(
    auth_user: AuthenticatedUser,
    Path(issue_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<Vec<CommentResponse>>, AppError> {
    // Verify membership
    let has_access = sqlx::query!(
        r#"
        SELECT 1 as ok
        FROM issues i
        JOIN projects p ON i.project_id = p.id
        JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
        WHERE i.id = $1 AND wm.user_id = $2
        "#,
        issue_id,
        auth_user.id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?
    .is_some();

    if !has_access {
        return Err(AppError::NotFound("Issue not found or access denied".into()));
    }

    let rows = sqlx::query!(
        r#"
        SELECT c.id, c.issue_id, c.author_id, u.name as author_name, u.avatar_url as author_avatar_url,
               c.body, c.created_at, c.updated_at
        FROM comments c
        JOIN users u ON c.author_id = u.id
        WHERE c.issue_id = $1
        ORDER BY c.created_at ASC
        "#,
        issue_id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let comments = rows
        .into_iter()
        .map(|r| CommentResponse {
            id: r.id,
            issue_id: r.issue_id,
            author_id: r.author_id,
            author_name: r.author_name,
            author_avatar_url: r.author_avatar_url,
            body: r.body,
            created_at: r.created_at,
            updated_at: r.updated_at,
        })
        .collect();

    Ok(Json(comments))
}

pub async fn create_comment(
    auth_user: AuthenticatedUser,
    Path(issue_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<CreateCommentRequest>,
) -> Result<(StatusCode, Json<CommentResponse>), AppError> {
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    // Verify membership
    let has_access = sqlx::query!(
        r#"
        SELECT 1 as ok
        FROM issues i
        JOIN projects p ON i.project_id = p.id
        JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
        WHERE i.id = $1 AND wm.user_id = $2
        "#,
        issue_id,
        auth_user.id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?
    .is_some();

    if !has_access {
        return Err(AppError::NotFound("Issue not found or access denied".into()));
    }

    let row = sqlx::query!(
        r#"
        INSERT INTO comments (issue_id, author_id, body)
        VALUES ($1, $2, $3)
        RETURNING id, issue_id, author_id, body, created_at, updated_at
        "#,
        issue_id,
        auth_user.id,
        payload.body
    )
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok((
        StatusCode::CREATED,
        Json(CommentResponse {
            id: row.id,
            issue_id: row.issue_id,
            author_id: row.author_id,
            author_name: auth_user.name,
            author_avatar_url: auth_user.avatar_url,
            body: row.body,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }),
    ))
}

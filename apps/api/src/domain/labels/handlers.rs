use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

use crate::{
    common::{auth::AuthenticatedUser, error::AppError, state::AppState},
};
use super::dto::{CreateLabelRequest, Label};

#[utoipa::path(get, path="/api/v1/workspaces/{workspace_id}/labels",
    params(("workspace_id"=Uuid,Path)),
    responses((status=200, body=[Label])))]
pub async fn list_labels(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<Vec<Label>>, AppError> {
    // Check workspace membership
    let has_access = sqlx::query!(
        "SELECT 1 as ok FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
        workspace_id,
        auth_user.id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?
    .is_some();

    if !has_access {
        return Err(AppError::NotFound("Workspace not found or access denied".into()));
    }

    let labels = sqlx::query_as::<_, Label>(
        r#"
        SELECT id, workspace_id, name, color
        FROM labels
        WHERE workspace_id = $1
        ORDER BY name
        "#
    )
    .bind(workspace_id)
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(Json(labels))
}

#[utoipa::path(post, path="/api/v1/workspaces/{workspace_id}/labels",
    params(("workspace_id"=Uuid,Path)),
    request_body=CreateLabelRequest,
    responses((status=201, body=Label)))]
pub async fn create_label(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<CreateLabelRequest>,
) -> Result<(StatusCode, Json<Label>), AppError> {
    // Check workspace membership and role
    let role = sqlx::query!(
        "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
        workspace_id,
        auth_user.id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?
    .map(|r| r.role);

    let role = role.ok_or_else(|| AppError::NotFound("Workspace not found or access denied".into()))?;

    if role != "Owner" && role != "Admin" {
        return Err(AppError::Forbidden("Only workspace owners and admins can create labels".into()));
    }

    let label = sqlx::query_as::<_, Label>(
        r#"
        INSERT INTO labels (workspace_id, name, color)
        VALUES ($1, $2, $3)
        RETURNING id, workspace_id, name, color
        "#
    )
    .bind(workspace_id)
    .bind(&payload.name)
    .bind(payload.color.unwrap_or_else(|| "#6366f1".to_string()))
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok((StatusCode::CREATED, Json(label)))
}

#[utoipa::path(delete, path="/api/v1/labels/{label_id}",
    params(("label_id"=Uuid,Path)),
    responses((status=204)))]
pub async fn delete_label(
    auth_user: AuthenticatedUser,
    Path(label_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    // Check workspace membership and role
    let row = sqlx::query!(
        r#"
        SELECT l.id, wm.role
        FROM labels l
        JOIN workspace_members wm ON l.workspace_id = wm.workspace_id
        WHERE l.id = $1 AND wm.user_id = $2
        "#,
        label_id,
        auth_user.id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?
    .ok_or_else(|| AppError::NotFound("Label not found or access denied".into()))?;

    if row.role != "Owner" && row.role != "Admin" {
        return Err(AppError::Forbidden("Only workspace owners and admins can delete labels".into()));
    }

    sqlx::query("DELETE FROM labels WHERE id = $1")
        .bind(label_id)
        .execute(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(post, path="/api/v1/issues/{issue_id}/labels",
    params(("issue_id"=Uuid,Path)),
    request_body=(description = "Add labels to issue", content_type = "application/json"),
    responses((status=200)))]
pub async fn add_labels_to_issue(
    auth_user: AuthenticatedUser,
    Path(issue_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<Vec<Uuid>>,
) -> Result<StatusCode, AppError> {
    // Check issue access
    let row = sqlx::query!(
        r#"
        SELECT i.id, p.workspace_id, wm.role
        FROM issues i
        JOIN projects p ON i.project_id = p.id
        JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
        WHERE i.id = $1 AND wm.user_id = $2 AND i.archived_at IS NULL
        "#,
        issue_id,
        auth_user.id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?
    .ok_or_else(|| AppError::NotFound("Issue not found or access denied".into()))?;

    let role = row.role;

    if role != "Owner" && role != "Admin" && role != "Member" {
        return Err(AppError::Forbidden("Access denied".into()));
    }

    // Verify all labels belong to the same workspace
    for label_id in &payload {
        let label_exists = sqlx::query!(
            "SELECT 1 FROM labels WHERE id = $1 AND workspace_id = $2",
            label_id,
            row.workspace_id
        )
        .fetch_optional(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?
        .is_some();

        if !label_exists {
            return Err(AppError::NotFound("Label not found or belongs to different workspace".into()));
        }
    }

    // Remove existing labels and add new ones
    sqlx::query("DELETE FROM issue_labels WHERE issue_id = $1")
        .bind(issue_id)
        .execute(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    for label_id in payload {
        sqlx::query("INSERT INTO issue_labels (issue_id, label_id) VALUES ($1, $2)")
            .bind(issue_id)
            .bind(label_id)
            .execute(&state.pool)
            .await
            .map_err(AppError::DatabaseError)?;
    }

    Ok(StatusCode::OK)
}

#[utoipa::path(get, path="/api/v1/issues/{issue_id}/labels",
    params(("issue_id"=Uuid,Path)),
    responses((status=200, body=[Label])))]
pub async fn get_issue_labels(
    auth_user: AuthenticatedUser,
    Path(issue_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<Vec<Label>>, AppError> {
    // Check issue access
    let has_access = sqlx::query!(
        r#"
        SELECT 1 as ok
        FROM issues i
        JOIN projects p ON i.project_id = p.id
        JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
        WHERE i.id = $1 AND wm.user_id = $2 AND i.archived_at IS NULL
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

    let labels = sqlx::query_as::<_, Label>(
        r#"
        SELECT l.id, l.workspace_id, l.name, l.color
        FROM labels l
        JOIN issue_labels il ON l.id = il.label_id
        WHERE il.issue_id = $1
        ORDER BY l.name
        "#
    )
    .bind(issue_id)
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(Json(labels))
}
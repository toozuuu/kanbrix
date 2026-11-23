use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use validator::Validate;

use crate::{
    common::{auth::AuthenticatedUser, error::AppError, state::AppState},
    domain::sprints::dto::{CreateSprintRequest, SprintResponse},
};

pub async fn list_project_sprints(
    auth_user: AuthenticatedUser,
    Path(project_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<Vec<SprintResponse>>, AppError> {
    let has_access = sqlx::query!(
        r#"
        SELECT 1 as ok
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
    .is_some();

    if !has_access {
        return Err(AppError::NotFound("Project not found or access denied".into()));
    }

    let rows = sqlx::query!(
        r#"
        SELECT id, project_id, name, goal, start_date, end_date, status, created_at
        FROM sprints
        WHERE project_id = $1
        ORDER BY created_at DESC
        "#,
        project_id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let sprints = rows
        .into_iter()
        .map(|r| SprintResponse {
            id: r.id,
            project_id: r.project_id,
            name: r.name,
            goal: r.goal,
            start_date: r.start_date,
            end_date: r.end_date,
            status: r.status,
            created_at: r.created_at,
        })
        .collect();

    Ok(Json(sprints))
}

pub async fn create_sprint(
    auth_user: AuthenticatedUser,
    Path(project_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<CreateSprintRequest>,
) -> Result<(StatusCode, Json<SprintResponse>), AppError> {
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

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
    .ok_or_else(|| AppError::NotFound("Project not found or access denied".into()))?;

    if existing.role == "Viewer" {
        return Err(AppError::Forbidden("Viewers cannot create sprints".into()));
    }

    let row = sqlx::query!(
        r#"
        INSERT INTO sprints (project_id, name, goal, start_date, end_date, status)
        VALUES ($1, $2, $3, $4, $5, 'planned')
        RETURNING id, project_id, name, goal, start_date, end_date, status, created_at
        "#,
        project_id,
        payload.name,
        payload.goal,
        payload.start_date,
        payload.end_date
    )
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok((
        StatusCode::CREATED,
        Json(SprintResponse {
            id: row.id,
            project_id: row.project_id,
            name: row.name,
            goal: row.goal,
            start_date: row.start_date,
            end_date: row.end_date,
            status: row.status,
            created_at: row.created_at,
        }),
    ))
}

pub async fn start_sprint(
    auth_user: AuthenticatedUser,
    Path(sprint_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    let existing = sqlx::query!(
        r#"
        SELECT s.project_id, wm.role
        FROM sprints s
        JOIN projects p ON s.project_id = p.id
        JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
        WHERE s.id = $1 AND wm.user_id = $2
        "#,
        sprint_id,
        auth_user.id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?
    .ok_or_else(|| AppError::NotFound("Sprint not found".into()))?;

    if existing.role == "Viewer" {
        return Err(AppError::Forbidden("Viewers cannot start sprints".into()));
    }

    sqlx::query!(
        r#"
        UPDATE sprints
        SET status = 'active',
            start_date = COALESCE(start_date, NOW())
        WHERE id = $1
        "#,
        sprint_id
    )
    .execute(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(StatusCode::OK)
}

pub async fn complete_sprint(
    auth_user: AuthenticatedUser,
    Path(sprint_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    let existing = sqlx::query!(
        r#"
        SELECT s.project_id, wm.role
        FROM sprints s
        JOIN projects p ON s.project_id = p.id
        JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
        WHERE s.id = $1 AND wm.user_id = $2
        "#,
        sprint_id,
        auth_user.id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?
    .ok_or_else(|| AppError::NotFound("Sprint not found".into()))?;

    if existing.role == "Viewer" {
        return Err(AppError::Forbidden("Viewers cannot complete sprints".into()));
    }

    sqlx::query!(
        r#"
        UPDATE sprints
        SET status = 'completed',
            end_date = NOW()
        WHERE id = $1
        "#,
        sprint_id
    )
    .execute(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(StatusCode::OK)
}

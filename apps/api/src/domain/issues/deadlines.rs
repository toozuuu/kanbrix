use axum::{
    extract::{Path, Query, State},
    Json,
};
use chrono::{DateTime, Days, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::common::{auth::AuthenticatedUser, error::AppError, state::AppState};

#[derive(Deserialize)]
pub struct DeadlineFilters {
    today: NaiveDate,
    #[serde(default)]
    only_mine: bool,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct ProjectDeadline {
    id: Uuid,
    identifier: String,
    title: String,
    due_date: DateTime<Utc>,
}

#[derive(Serialize, ToSchema)]
pub struct ProjectDeadlines {
    items: Vec<ProjectDeadline>,
    overdue_count: i64,
}

#[utoipa::path(
    get, path = "/api/v1/projects/{project_id}/deadlines",
    params(
        ("project_id" = Uuid, Path, description = "Project ID"),
        ("today" = NaiveDate, Query, description = "Current calendar date. Returns overdue items and items due within the seven-day window starting on this date."),
        ("only_mine" = Option<bool>, Query, description = "Restrict results to the signed-in user"),
    ),
    responses((status = 200, body = ProjectDeadlines))
)]
pub async fn list(
    user: AuthenticatedUser,
    Path(project_id): Path<Uuid>,
    Query(filters): Query<DeadlineFilters>,
    State(state): State<AppState>,
) -> Result<Json<ProjectDeadlines>, AppError> {
    let today = filters.today.and_time(chrono::NaiveTime::MIN).and_utc();
    let cutoff = today
        .checked_add_days(Days::new(7))
        .ok_or_else(|| AppError::ValidationError("Invalid deadline date".into()))?;
    let row = sqlx::query!(
        r#"
        WITH allowed_project AS (
            SELECT p.id, p.project_key
            FROM projects p
            JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
            WHERE p.id = $1 AND wm.user_id = $2
        ), matching AS (
            SELECT i.id, p.project_key || '-' || i.issue_number AS identifier,
                   i.title, i.due_date
            FROM allowed_project p
            JOIN issues i ON i.project_id = p.id
            JOIN issue_statuses s ON s.id = i.status_id
            WHERE i.archived_at IS NULL AND s.category <> 'Done'
              AND i.due_date < $3
              AND (NOT $5::boolean OR i.assignee_id = $2)
        )
        SELECT coalesce((
                   SELECT jsonb_agg(to_jsonb(page) ORDER BY page.due_date, page.id)
                   FROM (SELECT * FROM matching ORDER BY due_date, id LIMIT 20) page
               ), '[]'::jsonb) AS "items!: sqlx::types::Json<Vec<ProjectDeadline>>",
               (SELECT count(*) FROM matching WHERE due_date < $4) AS "overdue_count!"
        FROM allowed_project
        "#,
        project_id,
        user.id,
        cutoff,
        today,
        filters.only_mine,
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?
    .ok_or_else(|| AppError::NotFound("Project not found".into()))?;

    Ok(Json(ProjectDeadlines {
        items: row.items.0,
        overdue_count: row.overdue_count,
    }))
}

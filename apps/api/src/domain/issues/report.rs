use crate::common::{auth::AuthenticatedUser, error::AppError, state::AppState};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
#[derive(Deserialize)]
pub struct Filter {
    sprint_id: Option<Uuid>,
}
#[derive(Serialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct ReportDay {
    day: String,
    backlog: i64,
    todo: i64,
    active: i64,
    review: i64,
    done: i64,
    lead_days: Option<f64>,
    cycle_days: Option<f64>,
}
#[utoipa::path(get,path="/api/v1/projects/{project}/report",params(("project"=Uuid,Path,description="Project ID"),("sprint_id"=Option<Uuid>,Query,description="Sprint filter")),responses((status=200,body=[ReportDay])))]
pub async fn report(
    user: AuthenticatedUser,
    State(s): State<AppState>,
    Path(project): Path<Uuid>,
    Query(q): Query<Filter>,
) -> Result<Json<Vec<ReportDay>>, AppError> {
    let permitted:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM projects p JOIN workspace_members m ON m.workspace_id=p.workspace_id WHERE p.id=$1 AND m.user_id=$2 AND ($3::uuid IS NULL OR EXISTS(SELECT 1 FROM sprints WHERE id=$3 AND project_id=p.id)))").bind(project).bind(user.id).bind(q.sprint_id).fetch_one(&s.pool).await?;
    if !permitted {
        return Err(AppError::NotFound("Project or sprint unavailable".into()));
    }
    Ok(Json(
        sqlx::query_as(include_str!("report.sql"))
            .bind(project)
            .bind(q.sprint_id)
            .fetch_all(&s.pool)
            .await?,
    ))
}

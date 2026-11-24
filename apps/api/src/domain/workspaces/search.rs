use crate::common::{auth::AuthenticatedUser, error::AppError, state::AppState};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
#[derive(Deserialize)]
pub struct Search {
    q: String,
}
#[derive(sqlx::FromRow, Serialize, utoipa::ToSchema)]
pub struct Hit {
    id: Uuid,
    project_id: Uuid,
    title: String,
    identifier: String,
}
#[utoipa::path(get,path="/api/v1/workspaces/{workspace}/search",params(("workspace"=Uuid,Path,description="Workspace ID"),("q"=String,Query,description="Issue key or text")),responses((status=200,body=[Hit])))]
pub async fn search(
    user: AuthenticatedUser,
    State(s): State<AppState>,
    Path(workspace): Path<Uuid>,
    Query(input): Query<Search>,
) -> Result<Json<Vec<Hit>>, AppError> {
    let term = input.q.trim();
    if term.is_empty() || term.len() > 255 {
        return Ok(Json(vec![]));
    }
    Ok(Json(sqlx::query_as("SELECT i.id,i.project_id,i.title,p.project_key||'-'||i.issue_number AS identifier FROM projects p JOIN workspace_members m ON m.workspace_id=p.workspace_id AND m.user_id=$2 JOIN issues i ON i.project_id=p.id WHERE p.workspace_id=$1 AND p.archived_at IS NULL AND i.archived_at IS NULL AND (to_tsvector('english', i.title || ' ' || COALESCE(i.description, '')) @@ plainto_tsquery('english', $3) OR strpos(lower(p.project_key||'-'||i.issue_number),lower($3))>0) ORDER BY (lower(p.project_key||'-'||i.issue_number)=lower($3)) DESC,i.updated_at DESC,i.id LIMIT 12").bind(workspace).bind(user.id).bind(term).fetch_all(&s.pool).await?))
}

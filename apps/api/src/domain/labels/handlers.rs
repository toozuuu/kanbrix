use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct LabelFilterQuery {
    pub project_id: Option<Uuid>,
}

use super::dto::{CreateLabelRequest, Label};
use crate::common::{auth::AuthenticatedUser, error::AppError, state::AppState};

#[utoipa::path(get, path="/api/v1/workspaces/{workspace_id}/labels",
    params(("workspace_id"=Uuid,Path,description="workspace id")),
    responses((status=200, body=[Label])))]
pub async fn list_labels(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<Uuid>,
    Query(query): Query<LabelFilterQuery>,
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
        return Err(AppError::NotFound(
            "Workspace not found or access denied".into(),
        ));
    }

    let labels = if let Some(project_id) = query.project_id {
        sqlx::query_as::<_, Label>(
            r#"
            SELECT l.id, l.workspace_id, l.name, l.color
            FROM labels l
            WHERE l.workspace_id = $1 AND l.id IN (
                SELECT label_id FROM project_labels WHERE project_id = $2
                UNION ALL
                SELECT il.label_id FROM issues i JOIN issue_labels il ON il.issue_id = i.id
                WHERE i.project_id = $2
            )
            ORDER BY l.name
            "#,
        )
        .bind(workspace_id)
        .bind(project_id)
        .fetch_all(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?
    } else {
        sqlx::query_as::<_, Label>(
            r#"
            SELECT id, workspace_id, name, color
            FROM labels
            WHERE workspace_id = $1
            ORDER BY name
            "#,
        )
        .bind(workspace_id)
        .fetch_all(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?
    };

    Ok(Json(labels))
}

#[utoipa::path(post, path="/api/v1/workspaces/{workspace_id}/labels",
    params(("workspace_id"=Uuid,Path,description="workspace id")),
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

    let role =
        role.ok_or_else(|| AppError::NotFound("Workspace not found or access denied".into()))?;

    if role != "Owner" && role != "Admin" {
        return Err(AppError::Forbidden(
            "Only workspace owners and admins can create labels".into(),
        ));
    }

    let name = payload.name.trim();
    if name.is_empty() || name.chars().count() > 64 {
        return Err(AppError::BadRequest(
            "Label names must contain 1 to 64 characters".into(),
        ));
    }
    if let Some(project_id) = payload.project_id {
        let mut tx = state.pool.begin().await?;
        sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM projects WHERE id = $1 AND workspace_id = $2 FOR KEY SHARE",
        )
        .bind(project_id)
        .bind(workspace_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound("Project not found".into()))?;
        let label = sqlx::query_as::<_, Label>(
            "INSERT INTO labels (workspace_id, name, color) VALUES ($1,$2,$3)
             ON CONFLICT (workspace_id, name) DO UPDATE SET name = EXCLUDED.name
             RETURNING id, workspace_id, name, color",
        )
        .bind(workspace_id)
        .bind(name)
        .bind(payload.color.as_deref().unwrap_or("#477563"))
        .fetch_one(&mut *tx)
        .await?;
        sqlx::query("INSERT INTO project_labels (project_id, label_id) VALUES ($1,$2) ON CONFLICT DO NOTHING")
            .bind(project_id).bind(label.id).execute(&mut *tx).await?;
        tx.commit().await?;
        return Ok((StatusCode::CREATED, Json(label)));
    }

    let label = sqlx::query_as::<_, Label>(
        r#"
        INSERT INTO labels (workspace_id, name, color)
        VALUES ($1, $2, $3)
        RETURNING id, workspace_id, name, color
        "#,
    )
    .bind(workspace_id)
    .bind(name)
    .bind(payload.color.unwrap_or_else(|| "#6366f1".to_string()))
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok((StatusCode::CREATED, Json(label)))
}

#[utoipa::path(delete, path="/api/v1/labels/{label_id}",
    params(("label_id"=Uuid,Path,description="label id")),
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
        return Err(AppError::Forbidden(
            "Only workspace owners and admins can delete labels".into(),
        ));
    }

    sqlx::query("DELETE FROM labels WHERE id = $1")
        .bind(label_id)
        .execute(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(post, path="/api/v1/issues/{issue_id}/labels",
    params(("issue_id"=Uuid,Path,description="issue id")),
    request_body=[Uuid],
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

    let mut tx = state.pool.begin().await.map_err(AppError::DatabaseError)?;
    replace_issue_labels(&mut tx, issue_id, row.workspace_id, &payload, true).await?;
    tx.commit().await.map_err(AppError::DatabaseError)?;

    Ok(StatusCode::OK)
}

/// Validates that all `label_ids` belong to `workspace_id` in a single query
/// and batch-inserts them for `issue_id`, optionally replacing existing labels.
pub async fn replace_issue_labels(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    issue_id: Uuid,
    workspace_id: Uuid,
    label_ids: &[Uuid],
    replace_existing: bool,
) -> Result<(), AppError> {
    let mut seen = std::collections::HashSet::with_capacity(label_ids.len());
    let unique: Vec<Uuid> = label_ids
        .iter()
        .copied()
        .filter(|id| seen.insert(*id))
        .collect();

    if !unique.is_empty() {
        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*)::bigint FROM labels WHERE id = ANY($1) AND workspace_id = $2",
        )
        .bind(&unique)
        .bind(workspace_id)
        .fetch_one(&mut **tx)
        .await
        .map_err(AppError::DatabaseError)?;

        if count != unique.len() as i64 {
            return Err(AppError::NotFound(
                "Label not found or belongs to different workspace".into(),
            ));
        }
    }

    if replace_existing {
        sqlx::query("DELETE FROM issue_labels WHERE issue_id = $1")
            .bind(issue_id)
            .execute(&mut **tx)
            .await
            .map_err(AppError::DatabaseError)?;
    }

    if !unique.is_empty() {
        sqlx::query(
            "INSERT INTO issue_labels (issue_id, label_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING",
        )
        .bind(issue_id)
        .bind(&unique)
        .execute(&mut **tx)
        .await
        .map_err(AppError::DatabaseError)?;
    }

    Ok(())
}

#[utoipa::path(get, path="/api/v1/issues/{issue_id}/labels",
    params(("issue_id"=Uuid,Path,description="issue id")),
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
        return Err(AppError::NotFound(
            "Issue not found or access denied".into(),
        ));
    }

    let labels = sqlx::query_as::<_, Label>(
        r#"
        SELECT l.id, l.workspace_id, l.name, l.color
        FROM labels l
        JOIN issue_labels il ON l.id = il.label_id
        WHERE il.issue_id = $1
        ORDER BY l.name
        "#,
    )
    .bind(issue_id)
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(Json(labels))
}

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use validator::Validate;

use crate::{
    common::{
        auth::{verify_workspace_membership, AuthenticatedUser},
        error::AppError,
        state::AppState,
    },
    domain::projects::dto::{
        CreateProjectRequest, ProjectResponse, StatusSummary, UpdateProjectRequest,
    },
};

#[utoipa::path(get,path="/api/v1/workspaces/{workspace_id}/projects",params(("workspace_id"=Uuid,Path,description="workspace id")),responses((status=200,body=[ProjectResponse])))]
pub async fn list_workspace_projects(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<Vec<ProjectResponse>>, AppError> {
    verify_workspace_membership(&state.pool, workspace_id, auth_user.id).await?;

    let rows = sqlx::query!(
        r#"
        SELECT id, workspace_id, name, project_key, description, issue_counter,
               archived_at, created_at, updated_at
        FROM projects
        WHERE workspace_id = $1 AND archived_at IS NULL
        ORDER BY created_at ASC
        "#,
        workspace_id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let projects = rows
        .into_iter()
        .map(|r| ProjectResponse {
            id: r.id,
            workspace_id: r.workspace_id,
            name: r.name,
            project_key: r.project_key,
            description: r.description,
            issue_counter: r.issue_counter,
            archived_at: r.archived_at,
            created_at: r.created_at,
            updated_at: r.updated_at,
            statuses: None,
        })
        .collect();

    Ok(Json(projects))
}

#[utoipa::path(post,path="/api/v1/workspaces/{workspace_id}/projects",params(("workspace_id"=Uuid,Path,description="workspace id")),request_body=CreateProjectRequest,responses((status=201,body=ProjectResponse)))]
pub async fn create_project(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<CreateProjectRequest>,
) -> Result<(StatusCode, Json<ProjectResponse>), AppError> {
    let role = verify_workspace_membership(&state.pool, workspace_id, auth_user.id).await?;
    crate::domain::workspaces::configuration::permit(
        &state.pool,
        workspace_id,
        role.to_str(),
        "create_projects",
    )
    .await?;
    if !role.can_edit_project() {
        return Err(AppError::Forbidden(
            "Insufficient permissions to create project in this workspace".into(),
        ));
    }

    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    let key = payload.project_key.trim().to_uppercase();

    let mut tx = state.pool.begin().await.map_err(AppError::DatabaseError)?;

    let proj = sqlx::query!(
        r#"
        INSERT INTO projects (workspace_id, name, project_key, description)
        VALUES ($1, $2, $3, $4)
        RETURNING id, workspace_id, name, project_key, description, issue_counter,
                  archived_at, created_at, updated_at
        "#,
        workspace_id,
        payload.name,
        key,
        payload.description
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err) if db_err.is_unique_violation() => {
            AppError::Conflict("A project with this key already exists in this workspace".into())
        }
        other => AppError::DatabaseError(other),
    })?;

    let (_, cfg) = crate::domain::workspaces::configuration::current(&mut tx, workspace_id).await?;
    let template = match payload.template {
        Some(name) => cfg.templates.iter().find(|t| t.name == name),
        None => cfg.templates.first(),
    }
    .ok_or_else(|| AppError::BadRequest("Unknown project template".into()))?;
    sqlx::query("UPDATE projects SET sprint_enabled=$1,form_overrides=$3 WHERE id=$2")
        .bind(template.sprints)
        .bind(proj.id)
        .bind(sqlx::types::Json(&template.form))
        .execute(&mut *tx)
        .await?;
    let mut created_statuses = Vec::new();
    for (index, column) in template.columns.iter().enumerate() {
        let name = &column.name;
        let category = &column.category;
        let pos = (index + 1) as f64 * 1000.;
        let status_row = sqlx::query!(
            r#"
            INSERT INTO issue_statuses (project_id, name, category, position)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, category, position
            "#,
            proj.id,
            name,
            category,
            pos
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(AppError::DatabaseError)?;

        created_statuses.push(StatusSummary {
            id: status_row.id,
            name: status_row.name,
            category: status_row.category,
            position: status_row.position,
        });
    }

    let mut transitions = Vec::new();
    for [from, to] in &template.transitions {
        if let (Some(a), Some(b)) = (
            created_statuses.iter().find(|s| &s.name == from),
            created_statuses.iter().find(|s| &s.name == to),
        ) {
            transitions.push([a.id, b.id]);
        }
    }
    sqlx::query("UPDATE projects SET transitions=$1 WHERE id=$2")
        .bind(serde_json::json!(transitions))
        .bind(proj.id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await.map_err(AppError::DatabaseError)?;

    Ok((
        StatusCode::CREATED,
        Json(ProjectResponse {
            id: proj.id,
            workspace_id: proj.workspace_id,
            name: proj.name,
            project_key: proj.project_key,
            description: proj.description,
            issue_counter: proj.issue_counter,
            archived_at: proj.archived_at,
            created_at: proj.created_at,
            updated_at: proj.updated_at,
            statuses: Some(created_statuses),
        }),
    ))
}

#[utoipa::path(get,path="/api/v1/projects/{project_id}",params(("project_id"=Uuid,Path,description="project id")),responses((status=200,body=ProjectResponse)))]
pub async fn get_project(
    auth_user: AuthenticatedUser,
    Path(project_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<ProjectResponse>, AppError> {
    let proj = sqlx::query!(
        r#"
        SELECT p.workflow_revision,p.id, p.workspace_id, p.name, p.project_key, p.description,
               p.issue_counter, p.archived_at, p.created_at, p.updated_at
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

    let key = format!(
        "kanbrix:v1:project:{}:{}:{}:{}",
        project_id,
        proj.updated_at.timestamp_micros(),
        proj.workflow_revision,
        proj.issue_counter
    );
    if let Some(value) = state.cache.get(&key).await {
        return Ok(Json(value));
    }
    let statuses = sqlx::query!(
        r#"
        SELECT id, name, category, position
        FROM issue_statuses
        WHERE project_id = $1
        ORDER BY position ASC
        "#,
        project_id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let status_summaries = statuses
        .into_iter()
        .map(|s| StatusSummary {
            id: s.id,
            name: s.name,
            category: s.category,
            position: s.position,
        })
        .collect();

    let response = ProjectResponse {
        id: proj.id,
        workspace_id: proj.workspace_id,
        name: proj.name,
        project_key: proj.project_key,
        description: proj.description,
        issue_counter: proj.issue_counter,
        archived_at: proj.archived_at,
        created_at: proj.created_at,
        updated_at: proj.updated_at,
        statuses: Some(status_summaries),
    };
    state.cache.put(&key, &response).await;
    Ok(Json(response))
}

#[utoipa::path(patch,path="/api/v1/projects/{project_id}",params(("project_id"=Uuid,Path,description="project id")),request_body=UpdateProjectRequest,responses((status=200,body=ProjectResponse)))]
pub async fn update_project(
    auth_user: AuthenticatedUser,
    Path(project_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<UpdateProjectRequest>,
) -> Result<Json<ProjectResponse>, AppError> {
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
    .ok_or_else(|| AppError::NotFound("Project not found".into()))?;

    if existing.role == "Viewer" {
        return Err(AppError::Forbidden("Viewers cannot modify projects".into()));
    }

    let updated = sqlx::query!(
        r#"
        UPDATE projects
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            updated_at = NOW()
        WHERE id = $3
        RETURNING id, workspace_id, name, project_key, description, issue_counter,
                  archived_at, created_at, updated_at
        "#,
        payload.name,
        payload.description,
        project_id
    )
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(Json(ProjectResponse {
        id: updated.id,
        workspace_id: updated.workspace_id,
        name: updated.name,
        project_key: updated.project_key,
        description: updated.description,
        issue_counter: updated.issue_counter,
        archived_at: updated.archived_at,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        statuses: None,
    }))
}

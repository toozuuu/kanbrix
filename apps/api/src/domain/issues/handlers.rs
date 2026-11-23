use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use validator::Validate;

use crate::{
    common::{auth::AuthenticatedUser, error::AppError, state::AppState},
    domain::issues::dto::{
        CreateIssueRequest, IssueFilterQuery, IssueResponse, ReorderIssueRequest, UpdateIssueRequest,
    },
};

pub async fn list_project_issues(
    auth_user: AuthenticatedUser,
    Path(project_id): Path<Uuid>,
    Query(filters): Query<IssueFilterQuery>,
    State(state): State<AppState>,
) -> Result<Json<Vec<IssueResponse>>, AppError> {
    // Tenant check
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

    let search_pattern = filters.search.as_ref().map(|s| format!("%{}%", s.trim().to_lowercase()));

    let rows = sqlx::query!(
        r#"
        SELECT i.id, i.project_id, p.project_key, i.issue_number, i.title, i.description,
               i.type, i.priority, i.status_id, s.name as status_name, s.category as status_category,
               i.assignee_id, u_assignee.name as assignee_name,
               i.reporter_id, u_reporter.name as reporter_name,
               i.parent_issue_id, i.sprint_id, i.position, i.due_date,
               i.created_at, i.updated_at
        FROM issues i
        JOIN projects p ON i.project_id = p.id
        JOIN issue_statuses s ON i.status_id = s.id
        LEFT JOIN users u_assignee ON i.assignee_id = u_assignee.id
        JOIN users u_reporter ON i.reporter_id = u_reporter.id
        WHERE i.project_id = $1
          AND i.archived_at IS NULL
          AND ($2::uuid IS NULL OR i.status_id = $2)
          AND ($3::uuid IS NULL OR i.assignee_id = $3)
          AND ($4::varchar IS NULL OR i.type = $4)
          AND ($5::varchar IS NULL OR i.priority = $5)
          AND ($6::uuid IS NULL OR i.sprint_id = $6)
          AND ($7::varchar IS NULL OR (
                LOWER(i.title) LIKE $7 OR 
                LOWER(COALESCE(i.description, '')) LIKE $7 OR
                CONCAT(p.project_key, '-', i.issue_number) ILIKE $7
          ))
        ORDER BY i.position ASC, i.created_at ASC
        "#,
        project_id,
        filters.status_id,
        filters.assignee_id,
        filters.r#type,
        filters.priority,
        filters.sprint_id,
        search_pattern
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let issues = rows
        .into_iter()
        .map(|r| IssueResponse {
            id: r.id,
            project_id: r.project_id,
            project_key: r.project_key.clone(),
            issue_number: r.issue_number,
            identifier: format!("{}-{}", r.project_key, r.issue_number),
            title: r.title,
            description: r.description,
            r#type: r.r#type,
            priority: r.priority,
            status_id: r.status_id,
            status_name: r.status_name,
            status_category: r.status_category,
            assignee_id: r.assignee_id,
            assignee_name: r.assignee_name,
            reporter_id: r.reporter_id,
            reporter_name: r.reporter_name,
            parent_issue_id: r.parent_issue_id,
            sprint_id: r.sprint_id,
            position: r.position,
            due_date: r.due_date,
            created_at: r.created_at,
            updated_at: r.updated_at,
        })
        .collect();

    Ok(Json(issues))
}

pub async fn create_issue(
    auth_user: AuthenticatedUser,
    Path(project_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<CreateIssueRequest>,
) -> Result<(StatusCode, Json<IssueResponse>), AppError> {
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    // Check project and workspace membership
    let proj = sqlx::query!(
        r#"
        SELECT p.workspace_id, p.project_key, wm.role
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

    if proj.role == "Viewer" {
        return Err(AppError::Forbidden("Viewers cannot create issues".into()));
    }

    let issue_type = payload.r#type.unwrap_or_else(|| "Task".to_string());
    let issue_priority = payload.priority.unwrap_or_else(|| "Medium".to_string());

    let mut tx = state.pool.begin().await.map_err(AppError::DatabaseError)?;

    // Atomically increment project issue counter
    let updated_proj = sqlx::query!(
        r#"
        UPDATE projects
        SET issue_counter = issue_counter + 1
        WHERE id = $1
        RETURNING issue_counter
        "#,
        project_id
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    let issue_number = updated_proj.issue_counter;

    // Get next position in the column
    let max_pos_row = sqlx::query!(
        r#"
        SELECT COALESCE(MAX(position), 0.0) as max_pos
        FROM issues
        WHERE status_id = $1
        "#,
        payload.status_id
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    let new_pos = max_pos_row.max_pos.unwrap_or(0.0) + 1000.0;

    let issue = sqlx::query!(
        r#"
        INSERT INTO issues (
            project_id, issue_number, title, description, type, priority,
            status_id, assignee_id, reporter_id, parent_issue_id, sprint_id,
            position, due_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, project_id, issue_number, title, description, type, priority,
                  status_id, assignee_id, reporter_id, parent_issue_id, sprint_id,
                  position, due_date, created_at, updated_at
        "#,
        project_id,
        issue_number,
        payload.title,
        payload.description,
        issue_type,
        issue_priority,
        payload.status_id,
        payload.assignee_id,
        auth_user.id,
        payload.parent_issue_id,
        payload.sprint_id,
        new_pos,
        payload.due_date
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    // Log activity
    let log_metadata = serde_json::json!({
        "issue_number": issue.issue_number,
        "title": issue.title,
        "type": issue.r#type
    });

    sqlx::query!(
        r#"
        INSERT INTO activity_logs (workspace_id, actor_id, entity_type, entity_id, action, metadata)
        VALUES ($1, $2, 'issue', $3, 'created', $4)
        "#,
        proj.workspace_id,
        auth_user.id,
        issue.id,
        log_metadata
    )
    .execute(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    tx.commit().await.map_err(AppError::DatabaseError)?;

    // Fetch status name and details
    let status_info = sqlx::query!(
        "SELECT name, category FROM issue_statuses WHERE id = $1",
        issue.status_id
    )
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let assignee_name = if let Some(aid) = issue.assignee_id {
        sqlx::query!("SELECT name FROM users WHERE id = $1", aid)
            .fetch_optional(&state.pool)
            .await
            .map_err(AppError::DatabaseError)?
            .map(|u| u.name)
    } else {
        None
    };

    Ok((
        StatusCode::CREATED,
        Json(IssueResponse {
            id: issue.id,
            project_id: issue.project_id,
            project_key: proj.project_key.clone(),
            issue_number: issue.issue_number,
            identifier: format!("{}-{}", proj.project_key, issue.issue_number),
            title: issue.title,
            description: issue.description,
            r#type: issue.r#type,
            priority: issue.priority,
            status_id: issue.status_id,
            status_name: status_info.name,
            status_category: status_info.category,
            assignee_id: issue.assignee_id,
            assignee_name,
            reporter_id: issue.reporter_id,
            reporter_name: auth_user.name,
            parent_issue_id: issue.parent_issue_id,
            sprint_id: issue.sprint_id,
            position: issue.position,
            due_date: issue.due_date,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
        }),
    ))
}

pub async fn get_issue(
    auth_user: AuthenticatedUser,
    Path(issue_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<IssueResponse>, AppError> {
    let r = sqlx::query!(
        r#"
        SELECT i.id, i.project_id, p.project_key, i.issue_number, i.title, i.description,
               i.type, i.priority, i.status_id, s.name as status_name, s.category as status_category,
               i.assignee_id, u_assignee.name as assignee_name,
               i.reporter_id, u_reporter.name as reporter_name,
               i.parent_issue_id, i.sprint_id, i.position, i.due_date,
               i.created_at, i.updated_at
        FROM issues i
        JOIN projects p ON i.project_id = p.id
        JOIN workspace_members wm ON p.workspace_id = wm.workspace_id
        JOIN issue_statuses s ON i.status_id = s.id
        LEFT JOIN users u_assignee ON i.assignee_id = u_assignee.id
        JOIN users u_reporter ON i.reporter_id = u_reporter.id
        WHERE i.id = $1 AND wm.user_id = $2 AND i.archived_at IS NULL
        "#,
        issue_id,
        auth_user.id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?
    .ok_or_else(|| AppError::NotFound("Issue not found or access denied".into()))?;

    Ok(Json(IssueResponse {
        id: r.id,
        project_id: r.project_id,
        project_key: r.project_key.clone(),
        issue_number: r.issue_number,
        identifier: format!("{}-{}", r.project_key, r.issue_number),
        title: r.title,
        description: r.description,
        r#type: r.r#type,
        priority: r.priority,
        status_id: r.status_id,
        status_name: r.status_name,
        status_category: r.status_category,
        assignee_id: r.assignee_id,
        assignee_name: r.assignee_name,
        reporter_id: r.reporter_id,
        reporter_name: r.reporter_name,
        parent_issue_id: r.parent_issue_id,
        sprint_id: r.sprint_id,
        position: r.position,
        due_date: r.due_date,
        created_at: r.created_at,
        updated_at: r.updated_at,
    }))
}

pub async fn update_issue(
    auth_user: AuthenticatedUser,
    Path(issue_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<UpdateIssueRequest>,
) -> Result<Json<IssueResponse>, AppError> {
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    // Check workspace membership
    let existing = sqlx::query!(
        r#"
        SELECT p.workspace_id, wm.role
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
    .ok_or_else(|| AppError::NotFound("Issue not found or access denied".into()))?;

    if existing.role == "Viewer" {
        return Err(AppError::Forbidden("Viewers cannot edit issues".into()));
    }

    let mut tx = state.pool.begin().await.map_err(AppError::DatabaseError)?;

    sqlx::query!(
        r#"
        UPDATE issues
        SET title = COALESCE($1, title),
            description = COALESCE($2, description),
            type = COALESCE($3, type),
            priority = COALESCE($4, priority),
            status_id = COALESCE($5, status_id),
            assignee_id = CASE WHEN $6::boolean THEN $7 ELSE assignee_id END,
            sprint_id = CASE WHEN $8::boolean THEN $9 ELSE sprint_id END,
            position = COALESCE($10, position),
            due_date = COALESCE($11, due_date),
            updated_at = NOW()
        WHERE id = $12
        "#,
        payload.title,
        payload.description,
        payload.r#type,
        payload.priority,
        payload.status_id,
        payload.assignee_id.is_some(),
        payload.assignee_id,
        payload.sprint_id.is_some(),
        payload.sprint_id,
        payload.position,
        payload.due_date,
        issue_id
    )
    .execute(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    // Record audit log
    let audit_meta = serde_json::json!({
        "updated_by": auth_user.name,
        "payload": {
            "title": payload.title,
            "status_id": payload.status_id,
            "priority": payload.priority
        }
    });

    sqlx::query!(
        r#"
        INSERT INTO activity_logs (workspace_id, actor_id, entity_type, entity_id, action, metadata)
        VALUES ($1, $2, 'issue', $3, 'updated', $4)
        "#,
        existing.workspace_id,
        auth_user.id,
        issue_id,
        audit_meta
    )
    .execute(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    tx.commit().await.map_err(AppError::DatabaseError)?;

    get_issue(auth_user, Path(issue_id), State(state)).await
}

pub async fn reorder_issue(
    auth_user: AuthenticatedUser,
    Path(issue_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<ReorderIssueRequest>,
) -> Result<StatusCode, AppError> {
    let existing = sqlx::query!(
        r#"
        SELECT p.workspace_id, wm.role
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
    .ok_or_else(|| AppError::NotFound("Issue not found".into()))?;

    if existing.role == "Viewer" {
        return Err(AppError::Forbidden("Viewers cannot move issues".into()));
    }

    sqlx::query!(
        r#"
        UPDATE issues
        SET status_id = $1,
            position = $2,
            updated_at = NOW()
        WHERE id = $3
        "#,
        payload.status_id,
        payload.position,
        issue_id
    )
    .execute(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(StatusCode::OK)
}

pub async fn delete_issue(
    auth_user: AuthenticatedUser,
    Path(issue_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    let existing = sqlx::query!(
        r#"
        SELECT p.workspace_id, wm.role
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
    .ok_or_else(|| AppError::NotFound("Issue not found".into()))?;

    if existing.role == "Viewer" {
        return Err(AppError::Forbidden("Viewers cannot delete issues".into()));
    }

    sqlx::query!(
        "UPDATE issues SET archived_at = NOW() WHERE id = $1",
        issue_id
    )
    .execute(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(StatusCode::NO_CONTENT)
}

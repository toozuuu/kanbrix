use std::collections::HashMap;

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
        CreateIssueRequest, IssueFilterQuery, IssueResponse, ReorderIssueRequest,
        UpdateIssueRequest,
    },
    domain::labels::dto::Label,
};

async fn fetch_issue_labels(issue_id: Uuid, pool: &sqlx::PgPool) -> Result<Vec<Label>, AppError> {
    sqlx::query_as::<_, Label>(
        r#"
        SELECT l.id, l.workspace_id, l.name, l.color
        FROM labels l
        JOIN issue_labels il ON l.id = il.label_id
        WHERE il.issue_id = $1
        ORDER BY l.name
        "#,
    )
    .bind(issue_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::DatabaseError)
}

#[utoipa::path(get,path="/api/v1/projects/{project_id}/issues",params(("project_id"=Uuid,Path,description="project id"),("field_id"=Option<String>,Query,description="field id"),("field_value"=Option<String>,Query,description="field value"),("status_id"=Option<Uuid>,Query,description="status id"),("assignee_id"=Option<Uuid>,Query,description="assignee id"),("type"=Option<String>,Query,description="type"),("priority"=Option<String>,Query,description="priority"),("sprint_id"=Option<Uuid>,Query,description="sprint id"),("label_id"=Option<Uuid>,Query,description="filter by label id"),("label_ids"=Option<String>,Query,description="comma-separated label ids (issues having ALL specified labels)"),("search"=Option<String>,Query,description="search"),("limit"=Option<i64>,Query,description="limit"),("offset"=Option<i64>,Query,description="offset"),("unassigned"=Option<bool>,Query,description="unassigned"),("recently_updated"=Option<bool>,Query,description="Updated within the last 24 hours"),("due_before"=Option<String>,Query,description="due before")),responses((status=200,body=[IssueResponse])))]
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
        return Err(AppError::NotFound(
            "Project not found or access denied".into(),
        ));
    }

    let search_term = filters.search.as_ref().map(|s| s.trim().to_lowercase());

    let rows = sqlx::query!(
        r#"
        SELECT i.id, i.project_id, p.project_key, i.issue_number, i.title, i.description,
               i.type, i.priority, i.status_id, s.name as status_name, s.category as status_category,
               i.assignee_id, u_assignee.name as "assignee_name?",
               i.reporter_id, u_reporter.name as reporter_name,
               i.custom_values, i.parent_issue_id, i.sprint_id, i.story_points, i.position, i.due_date,
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
                strpos(LOWER(i.title), $7) > 0 OR
                strpos(LOWER(COALESCE(i.description, '')), $7) > 0 OR
                strpos(LOWER(CONCAT(p.project_key, '-', i.issue_number)), $7) > 0
          ))
          AND (NOT $8::boolean OR i.assignee_id IS NULL)
          AND ($9::timestamptz IS NULL OR (s.category <> 'Done' AND i.due_date < $9))
          AND (($10::text IS NULL OR $11::text IS NULL) OR (i.custom_values->>$10)=$11 OR (jsonb_typeof(i.custom_values->$10)='array' AND (i.custom_values->$10) ? $11))
          AND ($12::boolean IS NOT TRUE OR i.updated_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours')
          AND ($15::uuid IS NULL OR EXISTS (
              SELECT 1 FROM issue_labels il WHERE il.issue_id = i.id AND il.label_id = $15
          ))
          AND ($16::uuid[] IS NULL OR $16 <@ ARRAY(
              SELECT il.label_id FROM issue_labels il WHERE il.issue_id = i.id
          ))
        ORDER BY i.position, i.created_at, i.id
        LIMIT $13 OFFSET $14
        "#,
        project_id,
        filters.status_id,
        filters.assignee_id,
        filters.r#type,
        filters.priority,
        filters.sprint_id,
        search_term,
        filters.unassigned.unwrap_or(false),
        filters.due_before,
        filters.field_id,
        filters.field_value,
        filters.recently_updated.unwrap_or(false),
        filters.limit.map(|limit| limit.clamp(1, 101)),
        filters.offset.unwrap_or(0).max(0),
        filters.label_id,
        filters.label_ids.as_deref(),
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let issue_ids: Vec<Uuid> = rows.iter().map(|row| row.id).collect();
    let mut labels_map: HashMap<Uuid, Vec<Label>> = HashMap::new();
    if !issue_ids.is_empty() {
        let all_labels = sqlx::query_as::<_, (Uuid, Uuid, Uuid, String, String)>(
            r#"
            SELECT il.issue_id, l.id, l.workspace_id, l.name, l.color
            FROM issue_labels il
            JOIN labels l ON l.id = il.label_id
            WHERE il.issue_id = ANY($1)
            ORDER BY l.name
            "#,
        )
        .bind(&issue_ids)
        .fetch_all(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;
        for (issue_id, id, workspace_id, name, color) in all_labels {
            labels_map.entry(issue_id).or_default().push(Label {
                id,
                workspace_id,
                name,
                color,
            });
        }
    }

    let issues = rows
        .into_iter()
        .map(|r| {
            let labels = labels_map.remove(&r.id).unwrap_or_default();
            let identifier = format!("{}-{}", r.project_key, r.issue_number);
            IssueResponse {
                id: r.id,
                project_id: r.project_id,
                project_key: r.project_key,
                issue_number: r.issue_number,
                identifier,
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
                story_points: r.story_points,
                position: r.position,
                custom_values: r.custom_values,
                due_date: r.due_date,
                created_at: r.created_at,
                updated_at: r.updated_at,
                labels,
            }
        })
        .collect();

    Ok(Json(issues))
}

#[utoipa::path(post,path="/api/v1/projects/{project_id}/issues",params(("project_id"=Uuid,Path,description="project id")),request_body=CreateIssueRequest,responses((status=201,body=IssueResponse)))]
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

    crate::domain::workspaces::configuration::permit(
        &state.pool,
        proj.workspace_id,
        &proj.role,
        "edit_issues",
    )
    .await?;
    if proj.role == "Viewer" {
        return Err(AppError::Forbidden("Viewers cannot create issues".into()));
    }

    let mut tx = state.pool.begin().await?;
    let cfg =
        crate::domain::workspaces::configuration::effective(&mut tx, proj.workspace_id, project_id)
            .await?;
    let issue_type = payload.r#type.unwrap_or_else(|| cfg.types[0].clone());
    let issue_priority = payload
        .priority
        .unwrap_or_else(|| cfg.priorities[0].clone());
    if !cfg.types.contains(&issue_type) || !cfg.priorities.contains(&issue_priority) {
        return Err(AppError::BadRequest("Unknown type or priority".into()));
    }
    let values = payload
        .custom_values
        .unwrap_or_else(|| serde_json::json!({}));
    crate::domain::workspaces::configuration::validate_values(
        &cfg,
        &issue_type,
        &values,
        &serde_json::Value::Null,
    )?;
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
            story_points, position, due_date, custom_values
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id, project_id, issue_number, title, description, type, priority,
                  status_id, assignee_id, reporter_id, parent_issue_id, sprint_id,
                  story_points, position, due_date, custom_values, created_at, updated_at
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
        payload.story_points,
        new_pos,
        payload.due_date,
        values
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

    // Handle labels if provided
    if let Some(label_ids) = payload.labels {
        crate::domain::labels::handlers::replace_issue_labels(
            &mut tx,
            issue.id,
            proj.workspace_id,
            &label_ids,
            false,
        )
        .await?;
    }

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

    // Fetch labels for the issue
    let labels = fetch_issue_labels(issue.id, &state.pool).await?;

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
            story_points: issue.story_points,
            position: issue.position,
            custom_values: issue.custom_values,
            due_date: issue.due_date,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            labels,
        }),
    ))
}

#[utoipa::path(get,path="/api/v1/issues/{issue_id}",params(("issue_id"=Uuid,Path,description="issue id")),responses((status=200,body=IssueResponse)))]
pub async fn get_issue(
    auth_user: AuthenticatedUser,
    Path(issue_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<IssueResponse>, AppError> {
    let r = sqlx::query!(
        r#"
        SELECT i.id, i.project_id, p.project_key, i.issue_number, i.title, i.description,
               i.type, i.priority, i.status_id, s.name as status_name, s.category as status_category,
               i.assignee_id, u_assignee.name as "assignee_name?",
               i.reporter_id, u_reporter.name as reporter_name,
               i.custom_values, i.parent_issue_id, i.sprint_id, i.story_points, i.position, i.due_date,
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

    let labels = fetch_issue_labels(r.id, &state.pool).await?;

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
        story_points: r.story_points,
        position: r.position,
        custom_values: r.custom_values,
        due_date: r.due_date,
        created_at: r.created_at,
        updated_at: r.updated_at,
        labels,
    }))
}

#[utoipa::path(patch,path="/api/v1/issues/{issue_id}",params(("issue_id"=Uuid,Path,description="issue id")),request_body=UpdateIssueRequest,responses((status=200,body=IssueResponse)))]
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

    crate::domain::workspaces::configuration::permit(
        &state.pool,
        existing.workspace_id,
        &existing.role,
        "edit_issues",
    )
    .await?;
    if existing.role == "Viewer" {
        return Err(AppError::Forbidden("Viewers cannot edit issues".into()));
    }

    let mut tx = state.pool.begin().await.map_err(AppError::DatabaseError)?;

    let (ws,project_id,old_kind,old_priority,old_values):(Uuid,Uuid,String,String,serde_json::Value)=sqlx::query_as("SELECT p.workspace_id,p.id,i.type,i.priority,i.custom_values FROM issues i JOIN projects p ON p.id=i.project_id WHERE i.id=$1 FOR UPDATE OF i").bind(issue_id).fetch_one(&mut *tx).await?;
    let cfg = crate::domain::workspaces::configuration::effective(&mut tx, ws, project_id).await?;
    if payload
        .r#type
        .as_ref()
        .is_some_and(|k| k != &old_kind && !cfg.types.contains(k))
        || payload
            .priority
            .as_ref()
            .is_some_and(|v| v != &old_priority && !cfg.priorities.contains(v))
    {
        return Err(AppError::BadRequest("Unknown type or priority".into()));
    }
    let values = payload.custom_values.as_ref().unwrap_or(&old_values);
    crate::domain::workspaces::configuration::validate_values(
        &cfg,
        payload.r#type.as_deref().unwrap_or(&old_kind),
        values,
        &old_values,
    )?;
    sqlx::query!(
        r#"
        UPDATE issues
        SET custom_values=$13, title = COALESCE($1, title),
            description = COALESCE($2, description),
            type = COALESCE($3, type),
            priority = COALESCE($4, priority),
            status_id = COALESCE($5, status_id),
            assignee_id = CASE WHEN $6::boolean THEN $7 ELSE assignee_id END,
            sprint_id = CASE WHEN $8::boolean THEN $9 ELSE sprint_id END,
            position = COALESCE($10, position),
            due_date = CASE WHEN $14::boolean THEN $11 ELSE due_date END,
            story_points = CASE WHEN $15::boolean THEN $16 ELSE story_points END,
            updated_at = NOW()
        WHERE id = $12
        "#,
        payload.title,
        payload.description,
        payload.r#type,
        payload.priority,
        payload.status_id,
        payload.assignee_id.is_some(),
        payload.assignee_id.flatten(),
        payload.sprint_id.is_some(),
        payload.sprint_id.flatten(),
        payload.position,
        payload.due_date.flatten(),
        issue_id,
        values,
        payload.due_date.is_some(),
        payload.story_points.is_some(),
        payload.story_points.flatten()
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

    // Handle labels update if provided (inside transaction)
    if let Some(label_ids) = payload.labels {
        crate::domain::labels::handlers::replace_issue_labels(
            &mut tx,
            issue_id,
            existing.workspace_id,
            &label_ids,
            true,
        )
        .await?;
    }

    tx.commit().await.map_err(AppError::DatabaseError)?;

    get_issue(auth_user, Path(issue_id), State(state)).await
}

#[utoipa::path(post,path="/api/v1/issues/{issue_id}/reorder",params(("issue_id"=Uuid,Path,description="issue id")),request_body=ReorderIssueRequest,responses((status=200)))]
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

    crate::domain::workspaces::configuration::permit(
        &state.pool,
        existing.workspace_id,
        &existing.role,
        "edit_issues",
    )
    .await?;
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

#[utoipa::path(delete,path="/api/v1/issues/{issue_id}",params(("issue_id"=Uuid,Path,description="issue id")),responses((status=204)))]
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

    crate::domain::workspaces::configuration::permit(
        &state.pool,
        existing.workspace_id,
        &existing.role,
        "edit_issues",
    )
    .await?;
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

#[derive(serde::Serialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct IssueCounts {
    total: i64,
    assigned: i64,
    in_progress: i64,
    completed: i64,
}

#[utoipa::path(get,path="/api/v1/projects/{project_id}/issue-counts",params(("project_id"=Uuid,Path,description="project id")),responses((status=200,body=IssueCounts)))]
pub async fn issue_counts(
    auth_user: AuthenticatedUser,
    Path(project_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<IssueCounts>, AppError> {
    let counts = sqlx::query_as::<_, IssueCounts>(
        "SELECT count(i.id) AS total,
                count(*) FILTER (WHERE i.assignee_id = $2) AS assigned,
                count(*) FILTER (WHERE s.category = 'InProgress') AS in_progress,
                count(*) FILTER (WHERE s.category = 'Done') AS completed
         FROM projects p JOIN workspace_members m ON m.workspace_id = p.workspace_id AND m.user_id = $2
         LEFT JOIN issues i ON i.project_id = p.id AND i.archived_at IS NULL
         LEFT JOIN issue_statuses s ON s.id = i.status_id
         WHERE p.id = $1 GROUP BY p.id"
    ).bind(project_id).bind(auth_user.id).fetch_optional(&state.pool).await?
     .ok_or_else(|| AppError::NotFound("Project not found".into()))?;
    Ok(Json(counts))
}

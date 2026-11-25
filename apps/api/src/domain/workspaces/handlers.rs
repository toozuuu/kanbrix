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
    domain::workspaces::dto::{
        CreateWorkspaceRequest, InviteMemberRequest, UpdateWorkspaceRequest,
        WorkspaceMemberResponse, WorkspaceResponse,
    },
};

#[utoipa::path(get,path="/api/v1/workspaces",responses((status=200,body=[WorkspaceResponse])))]
pub async fn list_workspaces(
    auth_user: AuthenticatedUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<WorkspaceResponse>>, AppError> {
    let rows = sqlx::query!(
        r#"
        SELECT w.id, w.name, w.slug, w.owner_id, wm.role, w.created_at, w.updated_at
        FROM workspaces w
        JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE wm.user_id = $1
        ORDER BY w.name ASC
        "#,
        auth_user.id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let response = rows
        .into_iter()
        .map(|r| WorkspaceResponse {
            id: r.id,
            name: r.name,
            slug: r.slug,
            owner_id: r.owner_id,
            role: r.role,
            created_at: r.created_at,
            updated_at: r.updated_at,
        })
        .collect();

    Ok(Json(response))
}

#[utoipa::path(post,path="/api/v1/workspaces",request_body=CreateWorkspaceRequest,responses((status=201,body=WorkspaceResponse)))]
pub async fn create_workspace(
    auth_user: AuthenticatedUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateWorkspaceRequest>,
) -> Result<(StatusCode, Json<WorkspaceResponse>), AppError> {
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    let existing = sqlx::query!("SELECT id FROM workspaces WHERE slug = $1", payload.slug)
        .fetch_optional(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if existing.is_some() {
        return Err(AppError::Conflict("Workspace slug is already taken".into()));
    }

    let mut tx = state.pool.begin().await.map_err(AppError::DatabaseError)?;

    let ws = sqlx::query!(
        r#"
        INSERT INTO workspaces (name, slug, owner_id)
        VALUES ($1, $2, $3)
        RETURNING id, name, slug, owner_id, created_at, updated_at
        "#,
        payload.name,
        payload.slug,
        auth_user.id
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    sqlx::query!(
        r#"
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ($1, $2, 'Owner')
        "#,
        ws.id,
        auth_user.id
    )
    .execute(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    tx.commit().await.map_err(AppError::DatabaseError)?;

    Ok((
        StatusCode::CREATED,
        Json(WorkspaceResponse {
            id: ws.id,
            name: ws.name,
            slug: ws.slug,
            owner_id: ws.owner_id,
            role: "Owner".to_string(),
            created_at: ws.created_at,
            updated_at: ws.updated_at,
        }),
    ))
}

#[utoipa::path(get,path="/api/v1/workspaces/{workspace_id}",params(("workspace_id"=Uuid,Path,description="workspace id")),responses((status=200,body=WorkspaceResponse)))]
pub async fn get_workspace(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<WorkspaceResponse>, AppError> {
    let role = verify_workspace_membership(&state.pool, workspace_id, auth_user.id).await?;

    let ws = sqlx::query!(
        r#"
        SELECT id, name, slug, owner_id, created_at, updated_at
        FROM workspaces
        WHERE id = $1
        "#,
        workspace_id
    )
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(Json(WorkspaceResponse {
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        owner_id: ws.owner_id,
        role: role.to_str().to_string(),
        created_at: ws.created_at,
        updated_at: ws.updated_at,
    }))
}

#[utoipa::path(patch,path="/api/v1/workspaces/{workspace_id}",params(("workspace_id"=Uuid,Path,description="workspace id")),request_body=UpdateWorkspaceRequest,responses((status=200,body=WorkspaceResponse)))]
pub async fn update_workspace(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<UpdateWorkspaceRequest>,
) -> Result<Json<WorkspaceResponse>, AppError> {
    let role = verify_workspace_membership(&state.pool, workspace_id, auth_user.id).await?;
    crate::domain::workspaces::configuration::permit(
        &state.pool,
        workspace_id,
        role.to_str(),
        "manage_settings",
    )
    .await?;
    if !role.can_manage_workspace() {
        return Err(AppError::Forbidden(
            "Only workspace owners and admins can edit workspace details".into(),
        ));
    }

    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    let ws = sqlx::query!(
        r#"
        UPDATE workspaces
        SET name = COALESCE($1, name),
            updated_at = NOW()
        WHERE id = $2
        RETURNING id, name, slug, owner_id, created_at, updated_at
        "#,
        payload.name,
        workspace_id
    )
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(Json(WorkspaceResponse {
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        owner_id: ws.owner_id,
        role: role.to_str().to_string(),
        created_at: ws.created_at,
        updated_at: ws.updated_at,
    }))
}

pub async fn delete_workspace(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<axum::http::StatusCode, AppError> {
    let role = verify_workspace_membership(&state.pool, workspace_id, auth_user.id).await?;
    if !role.can_manage_workspace() {
        return Err(AppError::Forbidden(
            "Only workspace owners and admins can delete workspaces".into(),
        ));
    }

    sqlx::query("DELETE FROM workspaces WHERE id = $1")
        .bind(workspace_id)
        .execute(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[utoipa::path(get,path="/api/v1/workspaces/{workspace_id}/members",params(("workspace_id"=Uuid,Path,description="workspace id")),responses((status=200,body=[WorkspaceMemberResponse])))]
pub async fn list_members(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<Vec<WorkspaceMemberResponse>>, AppError> {
    verify_workspace_membership(&state.pool, workspace_id, auth_user.id).await?;

    let rows = sqlx::query!(
        r#"
        SELECT wm.user_id, u.name, u.email, u.avatar_url, wm.role, wm.joined_at
        FROM workspace_members wm
        JOIN users u ON wm.user_id = u.id
        WHERE wm.workspace_id = $1
        ORDER BY wm.joined_at ASC
        "#,
        workspace_id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let members = rows
        .into_iter()
        .map(|r| WorkspaceMemberResponse {
            user_id: r.user_id,
            name: r.name,
            email: r.email,
            avatar_url: r.avatar_url,
            role: r.role,
            joined_at: r.joined_at,
        })
        .collect();

    Ok(Json(members))
}

#[utoipa::path(post,path="/api/v1/workspaces/{workspace_id}/invitations",params(("workspace_id"=Uuid,Path,description="workspace id")),request_body=InviteMemberRequest,responses((status=200)))]
pub async fn invite_member(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<InviteMemberRequest>,
) -> Result<StatusCode, AppError> {
    let role = verify_workspace_membership(&state.pool, workspace_id, auth_user.id).await?;
    crate::domain::workspaces::configuration::permit(
        &state.pool,
        workspace_id,
        role.to_str(),
        "manage_members",
    )
    .await?;
    if !role.can_manage_workspace() {
        return Err(AppError::Forbidden(
            "Only workspace owners and admins can invite members".into(),
        ));
    }

    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    // Check if user already exists with that email
    let existing_user = sqlx::query!("SELECT id FROM users WHERE email = $1", payload.email)
        .fetch_optional(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if let Some(target_user) = existing_user {
        // Add directly as member
        sqlx::query!(
            r#"
            INSERT INTO workspace_members (workspace_id, user_id, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (workspace_id, user_id)
            DO UPDATE SET role = EXCLUDED.role
            "#,
            workspace_id,
            target_user.id,
            payload.role
        )
        .execute(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

        let ws_name: String = sqlx::query_scalar("SELECT name FROM workspaces WHERE id = $1")
            .bind(workspace_id)
            .fetch_optional(&state.pool)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| "Kanbrix".into());
        let pool = state.pool.clone();
        let recipient = payload.email.clone();
        let assigned_role = payload.role.clone();
        tokio::spawn(async move {
            let subject = format!("You were added to {ws_name} on Kanbrix");
            let body = format!(
                "You have been added to the {ws_name} workspace with the {assigned_role} role."
            );
            if let Err(err) = super::email::send_workspace_email(
                &pool,
                workspace_id,
                &recipient,
                &subject,
                &body,
                true,
            )
            .await
            {
                tracing::debug!("Skipped/failed workspace invite email: {err:?}");
            }
        });
    }

    Ok(StatusCode::CREATED)
}

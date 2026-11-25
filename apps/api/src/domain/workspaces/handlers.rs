use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use validator::Validate;

use crate::{
    common::{
        auth::{generate_session_token, verify_workspace_membership, AuthenticatedUser},
        error::AppError,
        state::AppState,
    },
    domain::workspaces::dto::{
        CreateWorkspaceRequest, InviteMemberRequest, InviteMemberResponse, UpdateWorkspaceRequest,
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

#[utoipa::path(post,path="/api/v1/workspaces/{workspace_id}/invitations",params(("workspace_id"=Uuid,Path,description="workspace id")),request_body=InviteMemberRequest,responses((status=201,body=InviteMemberResponse)))]
pub async fn invite_member(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<Uuid>,
    State(state): State<AppState>,
    Json(payload): Json<InviteMemberRequest>,
) -> Result<(StatusCode, Json<InviteMemberResponse>), AppError> {
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
    if !matches!(payload.role.as_str(), "Admin" | "Member" | "Viewer") {
        return Err(AppError::BadRequest("Invalid invitation role".into()));
    }

    let ws_name: String = sqlx::query_scalar("SELECT name FROM workspaces WHERE id = $1")
        .bind(workspace_id)
        .fetch_one(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;
    let (token, token_hash) = generate_session_token();
    sqlx::query(
        "INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, expires_at)
         VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')
         ON CONFLICT (workspace_id, email) WHERE accepted_at IS NULL
         DO UPDATE SET role = EXCLUDED.role, token_hash = EXCLUDED.token_hash,
                       expires_at = EXCLUDED.expires_at, created_at = NOW()",
    )
    .bind(workspace_id)
    .bind(payload.email.to_ascii_lowercase())
    .bind(&payload.role)
    .bind(token_hash)
    .execute(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let origin = state.config.client_origin.trim_end_matches('/');
    let link = format!("{origin}/register#invite={token}");
    let email_sent = super::email::send_workspace_email(
        &state.pool,
        workspace_id,
        &payload.email,
        &format!("Invitation to {ws_name} on Kanbrix"),
        &format!("Create your account with this email address to join {ws_name}.\n\n{link}\n\nThis link expires in 7 days."),
        true,
    )
    .await
    .unwrap_or(false);
    Ok((
        StatusCode::CREATED,
        Json(InviteMemberResponse {
            invitation_link: link,
            email_sent,
        }),
    ))
}

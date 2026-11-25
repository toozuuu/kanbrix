use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use chrono::{Duration, Utc};
use uuid::Uuid;
use validator::Validate;

use crate::{
    common::{
        auth::{
            generate_session_token, hash_password, hash_token, password_work, verify_password,
            AuthenticatedUser, SESSION_COOKIE_NAME,
        },
        error::AppError,
        state::AppState,
    },
    domain::auth::dto::{AuthResponse, LoginRequest, RegisterRequest, UserResponse},
};

#[utoipa::path(post,path="/api/v1/auth/register",request_body=RegisterRequest,responses((status=201,body=AuthResponse)))]
pub async fn register(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(payload): Json<RegisterRequest>,
) -> Result<(CookieJar, impl IntoResponse), AppError> {
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    let existing = sqlx::query!("SELECT id FROM users WHERE email = $1", payload.email)
        .fetch_optional(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if existing.is_some() {
        return Err(AppError::Conflict(
            "User with this email already exists".into(),
        ));
    }

    let password = payload.password;
    let password_hash = password_work(move || hash_password(&password)).await?;

    let mut tx = state.pool.begin().await.map_err(AppError::DatabaseError)?;

    let user_row = sqlx::query!(
        r#"
        INSERT INTO users (name, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, name, email, avatar_url, created_at
        "#,
        payload.name,
        payload.email,
        password_hash
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    // Create a default workspace for the newly registered user
    let default_slug = format!(
        "{}-{}",
        payload
            .name
            .to_lowercase()
            .chars()
            .filter(|c| c.is_alphanumeric())
            .take(12)
            .collect::<String>(),
        &user_row.id.to_string()[..6]
    );

    let workspace_row = sqlx::query!(
        r#"
        INSERT INTO workspaces (name, slug, owner_id)
        VALUES ($1, $2, $3)
        RETURNING id
        "#,
        format!("{}'s Workspace", payload.name),
        default_slug,
        user_row.id
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    sqlx::query!(
        r#"
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ($1, $2, 'Owner')
        "#,
        workspace_row.id,
        user_row.id
    )
    .execute(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    let joined_workspace_id = accept_invitation(
        &mut tx,
        user_row.id,
        &user_row.email,
        payload.invitation_token.as_deref(),
    )
    .await?;

    // Create session
    let (token, token_hash) = generate_session_token();
    let expires_at = Utc::now() + Duration::hours(state.config.session_ttl_hours);

    sqlx::query!(
        r#"
        INSERT INTO sessions (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        "#,
        user_row.id,
        token_hash,
        expires_at
    )
    .execute(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    tx.commit().await.map_err(AppError::DatabaseError)?;

    let mut cookie = Cookie::new(SESSION_COOKIE_NAME, token);
    cookie.set_path("/");
    cookie.set_http_only(true);
    cookie.set_same_site(SameSite::Lax);
    if state.config.cookie_secure {
        cookie.set_secure(true);
    }

    let updated_jar = jar.add(cookie);

    let user_resp = UserResponse {
        id: user_row.id,
        name: user_row.name,
        email: user_row.email,
        avatar_url: user_row.avatar_url,
        created_at: user_row.created_at,
    };

    Ok((
        updated_jar,
        (
            StatusCode::CREATED,
            Json(AuthResponse {
                user: user_resp,
                joined_workspace_id,
            }),
        ),
    ))
}

#[utoipa::path(post,path="/api/v1/auth/login",request_body=LoginRequest,responses((status=200,body=AuthResponse)))]
pub async fn login(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(payload): Json<LoginRequest>,
) -> Result<(CookieJar, impl IntoResponse), AppError> {
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    let user = sqlx::query!(
        r#"
        SELECT id, name, email, password_hash, avatar_url, created_at
        FROM users
        WHERE email = $1
        "#,
        payload.email
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?
    .ok_or_else(|| AppError::Unauthorized("Invalid email or password".into()))?;

    let password = payload.password;
    let attempt = sqlx::query!(
        "UPDATE users SET
        login_attempts = CASE WHEN login_window > now() - interval '1 minute'
                              THEN login_attempts + 1 ELSE 1 END,
        login_window = CASE WHEN login_window > now() - interval '1 minute'
                            THEN login_window ELSE now() END
        WHERE id = $1 AND (login_window IS NULL OR login_window <= now() - interval '1 minute'
                           OR login_attempts < 10)",
        user.id
    )
    .execute(&state.pool)
    .await?;
    if attempt.rows_affected() == 0 {
        return Err(AppError::AuthBusy);
    }
    let hash = user.password_hash;
    let is_valid = password_work(move || verify_password(&password, &hash)).await?;
    if !is_valid {
        return Err(AppError::Unauthorized("Invalid email or password".into()));
    }

    let mut tx = state.pool.begin().await?;
    let joined_workspace_id = accept_invitation(
        &mut tx,
        user.id,
        &user.email,
        payload.invitation_token.as_deref(),
    )
    .await?;

    let (token, token_hash) = generate_session_token();
    let expires_at = Utc::now() + Duration::hours(state.config.session_ttl_hours);

    sqlx::query!(
        r#"
        INSERT INTO sessions (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        "#,
        user.id,
        token_hash,
        expires_at
    )
    .execute(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    tx.commit().await?;

    let mut cookie = Cookie::new(SESSION_COOKIE_NAME, token);
    cookie.set_path("/");
    cookie.set_http_only(true);
    cookie.set_same_site(SameSite::Lax);
    if state.config.cookie_secure {
        cookie.set_secure(true);
    }

    let updated_jar = jar.add(cookie);

    let user_resp = UserResponse {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
    };

    Ok((
        updated_jar,
        (
            StatusCode::OK,
            Json(AuthResponse {
                user: user_resp,
                joined_workspace_id,
            }),
        ),
    ))
}

async fn accept_invitation(
    db: &mut sqlx::PgConnection,
    user_id: Uuid,
    email: &str,
    token: Option<&str>,
) -> Result<Option<Uuid>, AppError> {
    let Some(token) = token else { return Ok(None) };
    let (workspace_id, role) = sqlx::query_as::<_, (Uuid, String)>(
        "UPDATE workspace_invitations SET accepted_at = NOW()
         WHERE token_hash = $1 AND email = $2 AND expires_at > NOW()
           AND accepted_at IS NULL
         RETURNING workspace_id, role",
    )
    .bind(hash_token(token))
    .bind(email.to_ascii_lowercase())
    .fetch_optional(&mut *db)
    .await?
    .ok_or_else(|| {
        AppError::BadRequest("Use the email address on a valid invitation link.".into())
    })?;

    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role
         WHERE workspace_members.role <> 'Owner'",
    )
    .bind(workspace_id)
    .bind(user_id)
    .bind(role)
    .execute(&mut *db)
    .await?;
    Ok(Some(workspace_id))
}

#[utoipa::path(post,path="/api/v1/auth/logout",responses((status=204)))]
pub async fn logout(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<(CookieJar, impl IntoResponse), AppError> {
    if let Some(cookie) = jar.get(SESSION_COOKIE_NAME) {
        let token_hash = hash_token(cookie.value());
        sqlx::query!(
            "UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1",
            token_hash
        )
        .execute(&state.pool)
        .await?;
    }

    let mut removal_cookie = Cookie::new(SESSION_COOKIE_NAME, "");
    removal_cookie.set_path("/");
    removal_cookie.set_max_age(time::Duration::seconds(0));
    let updated_jar = jar.add(removal_cookie);

    Ok((updated_jar, StatusCode::NO_CONTENT))
}

#[utoipa::path(get,path="/api/v1/auth/me",responses((status=200,body=UserResponse)))]
pub async fn me(
    auth_user: AuthenticatedUser,
    State(state): State<AppState>,
) -> Result<Json<UserResponse>, AppError> {
    let user = sqlx::query!(
        r#"
        SELECT id, name, email, avatar_url, created_at
        FROM users
        WHERE id = $1
        "#,
        auth_user.id
    )
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(Json(UserResponse {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
    }))
}

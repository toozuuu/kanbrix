use crate::common::error::AppError;
use crate::common::state::AppState;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    async_trait,
    extract::FromRequestParts,
    http::request::Parts,
};
use axum_extra::extract::cookie::CookieJar;
use chrono::Utc;
use rand::RngCore;
use sha2::{Digest, Sha256};
use uuid::Uuid;

pub const SESSION_COOKIE_NAME: &str = "rusttrack_session";

#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WorkspaceRole {
    Owner,
    Admin,
    Member,
    Viewer,
}

impl WorkspaceRole {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "Owner" => Some(Self::Owner),
            "Admin" => Some(Self::Admin),
            "Member" => Some(Self::Member),
            "Viewer" => Some(Self::Viewer),
            _ => None,
        }
    }

    pub fn to_str(&self) -> &'static str {
        match self {
            Self::Owner => "Owner",
            Self::Admin => "Admin",
            Self::Member => "Member",
            Self::Viewer => "Viewer",
        }
    }

    pub fn can_manage_workspace(&self) -> bool {
        matches!(self, Self::Owner | Self::Admin)
    }

    pub fn can_edit_project(&self) -> bool {
        matches!(self, Self::Owner | Self::Admin | Self::Member)
    }

    pub fn can_edit_issues(&self) -> bool {
        matches!(self, Self::Owner | Self::Admin | Self::Member)
    }
}

pub fn hash_password(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| AppError::PasswordHashError(e.to_string()))
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| AppError::PasswordHashError(e.to_string()))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

pub fn generate_session_token() -> (String, String) {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let token = hex::encode(bytes);
    let hash = hash_token(&token);
    (token, hash)
}

pub fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

#[async_trait]
impl FromRequestParts<AppState> for AuthenticatedUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let jar = CookieJar::from_request_parts(parts, state)
            .await
            .map_err(|_| AppError::Unauthorized("Invalid cookie header".into()))?;

        let token = jar
            .get(SESSION_COOKIE_NAME)
            .map(|c| c.value().to_string())
            .or_else(|| {
                // Also support Bearer token for CLI/API clients
                parts
                    .headers
                    .get("Authorization")
                    .and_then(|h| h.to_str().ok())
                    .and_then(|h| h.strip_prefix("Bearer "))
                    .map(|t| t.to_string())
            })
            .ok_or_else(|| AppError::Unauthorized("Missing session authentication".into()))?;

        let token_hash = hash_token(&token);

        let user = sqlx::query_as!(
            UserRow,
            r#"
            SELECT u.id, u.name, u.email, u.avatar_url
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token_hash = $1
              AND s.revoked_at IS NULL
              AND s.expires_at > $2
            "#,
            token_hash,
            Utc::now()
        )
        .fetch_optional(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?
        .ok_or_else(|| AppError::Unauthorized("Session expired or invalid".into()))?;

        Ok(AuthenticatedUser {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar_url: user.avatar_url,
        })
    }
}

struct UserRow {
    id: Uuid,
    name: String,
    email: String,
    avatar_url: Option<String>,
}

pub async fn verify_workspace_membership(
    pool: &sqlx::PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<WorkspaceRole, AppError> {
    let row = sqlx::query!(
        r#"
        SELECT role FROM workspace_members
        WHERE workspace_id = $1 AND user_id = $2
        "#,
        workspace_id,
        user_id
    )
    .fetch_optional(pool)
    .await
    .map_err(AppError::DatabaseError)?
    .ok_or_else(|| AppError::Forbidden("You do not have access to this workspace".into()))?;

    WorkspaceRole::from_str(&row.role)
        .ok_or_else(|| AppError::Internal("Unknown workspace role in database".into()))
}

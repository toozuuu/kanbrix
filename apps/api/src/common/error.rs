use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: ErrorDetails,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorDetails {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Authentication service is busy")]
    AuthBusy,

    #[error("Authentication required")]
    Unauthorized(String),

    #[error("Forbidden: insufficient permissions")]
    Forbidden(String),

    #[error("Resource not found")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Validation failed")]
    ValidationError(String),

    #[error("Internal database error")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Internal server error")]
    Internal(String),

    #[error("Password hashing error")]
    PasswordHashError(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            AppError::AuthBusy => (
                StatusCode::TOO_MANY_REQUESTS,
                "AUTH_BUSY",
                "Please retry shortly".into(),
            ),
            AppError::DatabaseError(sqlx::Error::Database(e))
                if e.constraint() == Some("issue_transition") =>
            {
                (
                    StatusCode::BAD_REQUEST,
                    "INVALID_TRANSITION",
                    "This workflow does not allow that transition".into(),
                )
            }
            AppError::DatabaseError(sqlx::Error::Database(e))
                if matches!(
                    e.constraint(),
                    Some(
                        "issue_status_scope"
                            | "issue_parent_scope"
                            | "issue_sprint_scope"
                            | "issue_assignee_scope"
                            | "issues_status_id_fkey"
                            | "issues_sprint_id_fkey"
                            | "issues_parent_issue_id_fkey"
                            | "issues_assignee_id_fkey"
                    )
                ) =>
            {
                (
                    StatusCode::BAD_REQUEST,
                    "INVALID_ISSUE_REFERENCE",
                    "Invalid issue assignment or project reference".into(),
                )
            }
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED", msg.clone()),
            AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, "FORBIDDEN", msg.clone()),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, "NOT_FOUND", msg.clone()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, "BAD_REQUEST", msg.clone()),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, "CONFLICT", msg.clone()),
            AppError::ValidationError(msg) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                "VALIDATION_ERROR",
                msg.clone(),
            ),
            AppError::DatabaseError(err) => {
                tracing::error!("Database query failed: {:?}", err);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "DATABASE_ERROR",
                    "A database error occurred".to_string(),
                )
            }
            AppError::PasswordHashError(err) => {
                tracing::error!("Argon2 hashing error: {}", err);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "CRYPTO_ERROR",
                    "Internal cryptography error".to_string(),
                )
            }
            AppError::Internal(msg) => {
                tracing::error!("Internal error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_ERROR",
                    "An unexpected error occurred".to_string(),
                )
            }
        };

        let body = Json(ErrorResponse {
            error: ErrorDetails {
                code: code.to_string(),
                message,
                details: None,
            },
        });

        (status, body).into_response()
    }
}

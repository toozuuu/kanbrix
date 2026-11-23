use axum::{
    http::{header, HeaderValue, Method, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde_json::json;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::{
    common::state::AppState,
    domain::{audit, auth, comments, issues, notifications, projects, sprints, workspaces},
};

#[derive(OpenApi)]
#[openapi(
    paths(
    ),
    components(
        schemas(
            auth::dto::RegisterRequest,
            auth::dto::LoginRequest,
            auth::dto::UserResponse,
            auth::dto::AuthResponse,
            workspaces::dto::CreateWorkspaceRequest,
            workspaces::dto::UpdateWorkspaceRequest,
            workspaces::dto::WorkspaceResponse,
            workspaces::dto::WorkspaceMemberResponse,
            workspaces::dto::InviteMemberRequest,
            projects::dto::CreateProjectRequest,
            projects::dto::UpdateProjectRequest,
            projects::dto::ProjectResponse,
            projects::dto::StatusSummary,
            issues::dto::CreateIssueRequest,
            issues::dto::UpdateIssueRequest,
            issues::dto::ReorderIssueRequest,
            issues::dto::IssueResponse,
            comments::dto::CreateCommentRequest,
            comments::dto::CommentResponse,
            sprints::dto::CreateSprintRequest,
            sprints::dto::SprintResponse,
            notifications::dto::NotificationResponse,
            audit::dto::ActivityLogResponse
        )
    ),
    tags(
        (name = "auth", description = "Authentication and session management"),
        (name = "workspaces", description = "Workspaces and member roles"),
        (name = "projects", description = "Projects and workflow configurations"),
        (name = "issues", description = "Issues, Kanban items, and filters"),
        (name = "comments", description = "Issue discussions and replies"),
        (name = "sprints", description = "Agile sprint planning and execution"),
        (name = "notifications", description = "User notifications"),
        (name = "audit", description = "Workspace activity timeline")
    )
)]
pub struct ApiDoc;

pub fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(
            state
                .config
                .client_origin
                .parse::<HeaderValue>()
                .unwrap_or_else(|_| HeaderValue::from_static("http://localhost:5173")),
        )
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PATCH,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION, header::COOKIE])
        .allow_credentials(true);

    let api_v1 = Router::new()
        .nest("/auth", auth::routes())
        .nest("/workspaces", workspaces::routes())
        .nest("/workspaces", projects::workspace_routes())
        .nest("/workspaces", audit::routes())
        .nest("/projects", projects::routes())
        .nest("/projects", issues::project_routes())
        .nest("/projects", sprints::project_routes())
        .nest("/issues", issues::routes())
        .nest("/issues", comments::routes())
        .nest("/sprints", sprints::routes())
        .nest("/notifications", notifications::routes());

    Router::new()
        .route("/health", get(health_check))
        .route("/ready", get(ready_check))
        .nest("/api/v1", api_v1)
        .merge(SwaggerUi::new("/swagger-ui").url("/api/v1/openapi.json", ApiDoc::openapi()))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

async fn health_check() -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(json!({
            "status": "ok",
            "service": "rusttrack-api",
            "timestamp": chrono::Utc::now()
        })),
    )
}

async fn ready_check(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> impl IntoResponse {
    match sqlx::query("SELECT 1").execute(&state.pool).await {
        Ok(_) => (
            StatusCode::OK,
            Json(json!({
                "status": "ready",
                "database": "connected"
            })),
        ),
        Err(err) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "status": "unhealthy",
                "database": err.to_string()
            })),
        ),
    }
}

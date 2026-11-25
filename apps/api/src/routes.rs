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
    domain::{audit, auth, comments, issues, labels, notifications, projects, sprints, workspaces},
};

#[derive(OpenApi)]
#[openapi(
    paths(issues::report::report,issues::deadlines::list,issues::attachments::list,issues::attachments::upload,issues::attachments::download,workspaces::search::search,workspaces::my_work::list,auth::handlers::register,auth::handlers::login,auth::handlers::logout,auth::handlers::me,issues::handlers::list_project_issues,issues::handlers::create_issue,issues::handlers::get_issue,issues::handlers::update_issue,issues::handlers::reorder_issue,issues::handlers::delete_issue,issues::handlers::issue_counts,projects::handlers::create_project,projects::handlers::list_workspace_projects,projects::handlers::get_project,projects::handlers::update_project,workspaces::handlers::list_workspaces,workspaces::handlers::create_workspace,workspaces::handlers::get_workspace,workspaces::handlers::update_workspace,workspaces::handlers::list_members,workspaces::handlers::invite_member,sprints::handlers::list_project_sprints,sprints::handlers::create_sprint,sprints::handlers::start_sprint,sprints::handlers::complete_sprint,notifications::handlers::list_notifications,notifications::handlers::mark_read,audit::handlers::list_workspace_activity,comments::handlers::list_comments,comments::handlers::create_comment,issues::live::board,labels::handlers::list_labels,labels::handlers::create_label,labels::handlers::delete_label,labels::handlers::add_labels_to_issue,labels::handlers::get_issue_labels),
    components(
        schemas(
            issues::report::ReportDay,issues::attachments::Attachment,workspaces::search::Hit,issues::handlers::IssueCounts,
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
            audit::dto::ActivityLogResponse,
            labels::dto::Label,
            labels::dto::CreateLabelRequest
        )
    ),
    tags(
        (name = "auth", description = "Authentication and session management"),
        (name = "realtime", description = "WebSocket real-time board updates"),
        (name = "workspaces", description = "Workspaces and member roles"),
        (name = "projects", description = "Projects and workflow configurations"),
        (name = "issues", description = "Issues, Kanban items, and filters"),
        (name = "comments", description = "Issue discussions and replies"),
        (name = "sprints", description = "Agile sprint planning and execution"),
        (name = "notifications", description = "User notifications"),
        (name = "audit", description = "Workspace activity timeline"),
        (name = "labels", description = "Issue labels for organization and filtering")
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
        .merge(labels::routes())
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
        Err(_) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "status": "unhealthy",
                "database": "unavailable"
            })),
        ),
    }
}
#[cfg(test)]
mod http_tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use tower::ServiceExt;
    #[test]
    fn openapi_operation_ids_are_unique() {
        let spec = serde_json::to_value(ApiDoc::openapi()).unwrap();
        let mut operation_ids = std::collections::HashSet::new();
        for path in spec["paths"].as_object().unwrap().values() {
            for operation in path.as_object().unwrap().values() {
                if let Some(id) = operation["operationId"].as_str() {
                    assert!(operation_ids.insert(id), "Duplicate operation ID: {id}");
                }
            }
        }
    }

    fn router() -> Router {
        let pool = sqlx::postgres::PgPoolOptions::new()
            .connect_lazy("postgres://localhost/kanbrix_test")
            .unwrap();
        create_router(AppState::new(pool, crate::config::AppConfig::from_env()))
    }
    #[tokio::test]
    async fn health_returns_ok_without_database() {
        let response = router()
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }
    #[tokio::test]
    async fn anonymous_feature_requests_require_authentication() {
        let app = router();
        let id = uuid::Uuid::nil();
        for path in [
            format!("/api/v1/issues/{id}/attachments"),
            format!("/api/v1/projects/{id}/report"),
            format!("/api/v1/workspaces/{id}/search?q=test"),
        ] {
            let res = app
                .clone()
                .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
                .await
                .unwrap();
            assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
        }
    }
}

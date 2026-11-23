pub mod attachments;
pub mod dto;
pub mod handlers;
pub mod live;
pub mod report;

use crate::common::state::AppState;
use axum::{
    routing::{get, post},
    Router,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/:issue_id",
            get(handlers::get_issue)
                .patch(handlers::update_issue)
                .delete(handlers::delete_issue),
        )
        .route(
            "/:issue_id/attachments",
            get(attachments::list).post(attachments::upload).layer(
                axum::extract::DefaultBodyLimit::max(attachments::MAX_BYTES + 65536),
            ),
        )
        .route("/:issue_id/attachments/:id", get(attachments::download))
        .route("/:issue_id/reorder", post(handlers::reorder_issue))
}

pub fn project_routes() -> Router<AppState> {
    Router::new()
        .route("/:project_id/report", get(report::report))
        .route("/:project_id/live", get(live::board))
        .route("/:project_id/issue-counts", get(handlers::issue_counts))
        .route(
            "/:project_id/issues",
            get(handlers::list_project_issues).post(handlers::create_issue),
        )
}

pub mod dto;
pub mod handlers;

use axum::{
    routing::{delete, get, patch, post},
    Router,
};
use crate::common::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/:issue_id", get(handlers::get_issue).patch(handlers::update_issue).delete(handlers::delete_issue))
        .route("/:issue_id/reorder", post(handlers::reorder_issue))
}

pub fn project_routes() -> Router<AppState> {
    Router::new()
        .route("/:project_id/issues", get(handlers::list_project_issues).post(handlers::create_issue))
}

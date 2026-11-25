pub mod dto;
pub mod handlers;

use crate::common::state::AppState;
use axum::{routing::delete, routing::get, routing::post, Router};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/workspaces/{workspace_id}/labels",
            get(handlers::list_labels).post(handlers::create_label),
        )
        .route("/labels/{label_id}", delete(handlers::delete_label))
        .route(
            "/issues/{issue_id}/labels",
            post(handlers::add_labels_to_issue).get(handlers::get_issue_labels),
        )
}

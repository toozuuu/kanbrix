pub mod dto;
pub mod handlers;
pub mod workflow;

use crate::common::state::AppState;
use axum::{routing::get, Router};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/:project_id/workflow",
            get(workflow::read).put(workflow::publish),
        )
        .route(
            "/:project_id",
            get(handlers::get_project)
                .patch(handlers::update_project)
                .delete(handlers::delete_project),
        )
}

pub fn workspace_routes() -> Router<AppState> {
    Router::new().route(
        "/:workspace_id/projects",
        get(handlers::list_workspace_projects).post(handlers::create_project),
    )
}

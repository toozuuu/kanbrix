pub mod dto;
pub mod handlers;

use axum::{
    routing::{get, patch, post},
    Router,
};
use crate::common::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/:project_id", get(handlers::get_project).patch(handlers::update_project))
}

pub fn workspace_routes() -> Router<AppState> {
    Router::new()
        .route("/:workspace_id/projects", get(handlers::list_workspace_projects).post(handlers::create_project))
}

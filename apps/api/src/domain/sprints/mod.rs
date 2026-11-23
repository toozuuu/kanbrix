pub mod dto;
pub mod handlers;

use axum::{
    routing::{get, post},
    Router,
};
use crate::common::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/:sprint_id/start", post(handlers::start_sprint))
        .route("/:sprint_id/complete", post(handlers::complete_sprint))
}

pub fn project_routes() -> Router<AppState> {
    Router::new()
        .route("/:project_id/sprints", get(handlers::list_project_sprints).post(handlers::create_sprint))
}

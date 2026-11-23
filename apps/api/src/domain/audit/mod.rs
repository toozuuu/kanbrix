pub mod dto;
pub mod handlers;

use axum::{
    routing::get,
    Router,
};
use crate::common::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/:workspace_id/activity", get(handlers::list_workspace_activity))
}

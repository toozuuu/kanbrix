pub mod dto;
pub mod handlers;

use crate::common::state::AppState;
use axum::{routing::get, Router};

pub fn routes() -> Router<AppState> {
    Router::new().route(
        "/:workspace_id/activity",
        get(handlers::list_workspace_activity),
    )
}

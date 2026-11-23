pub mod dto;
pub mod handlers;

use axum::{
    routing::{get, post},
    Router,
};
use crate::common::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(handlers::list_notifications))
        .route("/:notification_id/read", post(handlers::mark_read))
}

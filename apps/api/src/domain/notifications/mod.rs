pub mod dto;
pub mod handlers;

use crate::common::state::AppState;
use axum::{
    routing::{get, post},
    Router,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(handlers::list_notifications))
        .route("/{notification_id}/read", post(handlers::mark_read))
}

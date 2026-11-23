pub mod dto;
pub mod handlers;

use axum::{
    routing::get,
    Router,
};
use crate::common::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/:issue_id/comments", get(handlers::list_comments).post(handlers::create_comment))
}

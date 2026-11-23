pub mod dto;
pub mod handlers;

use crate::common::state::AppState;
use axum::{routing::get, Router};

pub fn routes() -> Router<AppState> {
    Router::new().route(
        "/:issue_id/comments",
        get(handlers::list_comments).post(handlers::create_comment),
    )
}

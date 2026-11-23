pub mod dto;
pub mod handlers;

use axum::{
    routing::{get, post},
    Router,
};
use crate::common::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/register", post(handlers::register))
        .route("/login", post(handlers::login))
        .route("/logout", post(handlers::logout))
        .route("/me", get(handlers::me))
}

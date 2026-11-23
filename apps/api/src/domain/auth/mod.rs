pub mod dto;
pub mod handlers;
pub mod preferences;

use crate::common::state::AppState;
use axum::{
    routing::{get, post},
    Router,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/register", post(handlers::register))
        .route("/login", post(handlers::login))
        .route("/logout", post(handlers::logout))
        .route(
            "/preferences",
            get(preferences::read).put(preferences::save),
        )
        .route("/me", get(handlers::me))
}

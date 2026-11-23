pub mod dto;
pub mod handlers;

use axum::{
    routing::{get, patch, post},
    Router,
};
use crate::common::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(handlers::list_workspaces).post(handlers::create_workspace))
        .route("/:workspace_id", get(handlers::get_workspace).patch(handlers::update_workspace))
        .route("/:workspace_id/members", get(handlers::list_members))
        .route("/:workspace_id/invitations", post(handlers::invite_member))
}

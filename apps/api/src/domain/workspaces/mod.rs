pub mod configuration;
pub mod dto;
pub mod handlers;
pub mod integrations;
pub mod search;

use crate::common::state::AppState;
use axum::{
    routing::{get, post},
    Router,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            get(handlers::list_workspaces).post(handlers::create_workspace),
        )
        .route(
            "/:workspace_id",
            get(handlers::get_workspace).patch(handlers::update_workspace),
        )
        .route(
            "/:workspace_id/configuration",
            get(configuration::read).put(configuration::publish),
        )
        .route(
            "/:workspace_id/configuration/history",
            get(configuration::history),
        )
        .route(
            "/:workspace_id/configuration/validate",
            post(configuration::validate),
        )
        .route(
            "/:workspace_id/integrations",
            get(integrations::read).put(integrations::save),
        )
        .route(
            "/:workspace_id/integrations/credential",
            post(integrations::token),
        )
        .route(
            "/:workspace_id/integrations/events",
            get(integrations::feed),
        )
        .route(
            "/:workspace_id/integrations/events/:id/retry",
            post(integrations::retry),
        )
        .route(
            "/:workspace_id/configuration/preview",
            post(configuration::preview),
        )
        .route(
            "/:workspace_id/configuration/export",
            get(configuration::export),
        )
        .route("/:workspace_id/search", get(search::search))
        .route("/:workspace_id/members", get(handlers::list_members))
        .route("/:workspace_id/invitations", post(handlers::invite_member))
}

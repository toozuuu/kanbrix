pub mod configuration;
pub mod dto;
pub mod email;
pub mod handlers;
pub mod integrations;
pub mod my_work;
pub mod search;
pub mod sync;

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
            "/{workspace_id}",
            get(handlers::get_workspace)
                .patch(handlers::update_workspace)
                .delete(handlers::delete_workspace),
        )
        .route(
            "/{workspace_id}/configuration",
            get(configuration::read).put(configuration::publish),
        )
        .route(
            "/{workspace_id}/configuration/history",
            get(configuration::history),
        )
        .route(
            "/{workspace_id}/configuration/validate",
            post(configuration::validate),
        )
        .route(
            "/{workspace_id}/integrations",
            get(integrations::read).put(integrations::save),
        )
        .route(
            "/{workspace_id}/integrations/credential",
            post(integrations::token),
        )
        .route(
            "/{workspace_id}/integrations/events",
            get(integrations::feed),
        )
        .route(
            "/{workspace_id}/integrations/events/{id}/retry",
            post(integrations::retry),
        )
        .route(
            "/{workspace_id}/integrations/git-webhook",
            post(sync::git_webhook),
        )
        .route(
            "/{workspace_id}/projects/{project}/git-transitions",
            get(sync::git_settings).put(sync::save_git_settings),
        )
        .route("/{workspace_id}/sync/preview", post(sync::preview))
        .route("/{workspace_id}/sync/import", post(sync::import_project))
        .route("/{workspace_id}/sync/seed-demo", post(sync::seed_demo))
        .route("/{workspace_id}/email", get(email::read).put(email::save))
        .route("/{workspace_id}/email/test", post(email::send_test))
        .route(
            "/{workspace_id}/configuration/preview",
            post(configuration::preview),
        )
        .route(
            "/{workspace_id}/configuration/export",
            get(configuration::export),
        )
        .route("/{workspace_id}/search", get(search::search))
        .route("/{workspace_id}/my-work", get(my_work::list))
        .route("/{workspace_id}/members", get(handlers::list_members))
        .route("/{workspace_id}/invitations", post(handlers::invite_member))
}

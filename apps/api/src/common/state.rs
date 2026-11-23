use crate::config::AppConfig;
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub cache: super::cache::Cache,
    pub events: tokio::sync::broadcast::Sender<uuid::Uuid>,
    pub pool: PgPool,
    pub config: Arc<AppConfig>,
}

impl AppState {
    pub fn new(pool: PgPool, config: AppConfig) -> Self {
        Self {
            cache: super::cache::Cache::from_env(),
            events: tokio::sync::broadcast::channel(512).0,
            pool,
            config: Arc::new(config),
        }
    }
}

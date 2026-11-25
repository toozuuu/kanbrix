use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{timeout, Duration};

#[derive(Clone)]
pub struct Cache {
    client: Option<redis::Client>,
    conn: Arc<RwLock<Option<redis::aio::MultiplexedConnection>>>,
}

impl Cache {
    pub fn from_env() -> Self {
        Self {
            client: std::env::var("REDIS_URL")
                .ok()
                .and_then(|url| redis::Client::open(url).ok()),
            conn: Arc::new(RwLock::new(None)),
        }
    }

    async fn connection(&self) -> Option<redis::aio::MultiplexedConnection> {
        let client = self.client.as_ref()?;
        if let Some(existing) = self.conn.read().await.as_ref() {
            return Some(existing.clone());
        }
        let mut guard = self.conn.write().await;
        if let Some(existing) = guard.as_ref() {
            return Some(existing.clone());
        }
        let fresh = timeout(
            Duration::from_millis(150),
            client.get_multiplexed_async_connection(),
        )
        .await
        .ok()?
        .ok()?;
        *guard = Some(fresh.clone());
        Some(fresh)
    }

    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Option<T> {
        let mut conn = self.connection().await?;
        let raw = match timeout(
            Duration::from_millis(150),
            conn.get::<_, Option<String>>(key),
        )
        .await
        {
            Ok(Ok(val)) => val?,
            _ => {
                *self.conn.write().await = None;
                return None;
            }
        };
        serde_json::from_str(&raw).ok()
    }

    pub async fn put<T: Serialize>(&self, key: &str, value: &T) {
        let Some(mut conn) = self.connection().await else {
            return;
        };
        let Ok(raw) = serde_json::to_string(value) else {
            return;
        };
        if timeout(
            Duration::from_millis(150),
            conn.set_ex::<_, _, ()>(key, raw, 300),
        )
        .await
        .is_err()
        {
            *self.conn.write().await = None;
        }
    }

    pub async fn del(&self, key: &str) {
        let Some(mut conn) = self.connection().await else {
            return;
        };
        if timeout(Duration::from_millis(150), conn.del::<_, ()>(key))
            .await
            .is_err()
        {
            *self.conn.write().await = None;
        }
    }
}

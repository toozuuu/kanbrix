use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};
use tokio::time::{timeout, Duration};

#[derive(Clone)]
pub struct Cache(Option<redis::Client>);
impl Cache {
    pub fn from_env() -> Self {
        Self(
            std::env::var("REDIS_URL")
                .ok()
                .and_then(|url| redis::Client::open(url).ok()),
        )
    }
    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Option<T> {
        let client = self.0.as_ref()?;
        let raw = timeout(Duration::from_millis(150), async {
            let mut conn = client.get_multiplexed_async_connection().await?;
            conn.get::<_, Option<String>>(key).await
        })
        .await
        .ok()?
        .ok()??;
        serde_json::from_str(&raw).ok()
    }
    pub async fn put<T: Serialize>(&self, key: &str, value: &T) {
        let Some(client) = &self.0 else { return };
        let Ok(raw) = serde_json::to_string(value) else {
            return;
        };
        let _ = timeout(Duration::from_millis(150), async {
            let mut conn = client.get_multiplexed_async_connection().await?;
            conn.set_ex::<_, _, ()>(key, raw, 300).await
        })
        .await;
    }
}

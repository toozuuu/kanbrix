use std::env;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub app_env: String,
    pub server_host: String,
    pub server_port: u16,
    pub client_origin: String,
    pub database_url: String,
    pub session_ttl_hours: i64,
    pub cookie_secure: bool,
}

impl AppConfig {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        Self {
            app_env: env::var("APP_ENV").unwrap_or_else(|_| "development".to_string()),
            server_host: env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            server_port: env::var("SERVER_PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .expect("SERVER_PORT must be a valid port number"),
            client_origin: env::var("CLIENT_ORIGIN")
                .unwrap_or_else(|_| "http://localhost:5173".to_string()),
            database_url: env::var("DATABASE_URL").unwrap_or_else(|_| {
                "postgres://postgres:postgrespassword@localhost:5432/rusttrack".to_string()
            }),
            session_ttl_hours: env::var("SESSION_TTL_HOURS")
                .unwrap_or_else(|_| "168".to_string())
                .parse()
                .unwrap_or(168),
            cookie_secure: env::var("COOKIE_SECURE")
                .unwrap_or_else(|_| "false".to_string())
                .parse()
                .unwrap_or(false),
        }
    }
}

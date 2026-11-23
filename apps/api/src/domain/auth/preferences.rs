use crate::common::{auth::AuthenticatedUser, error::AppError, state::AppState};
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct Preferences {
    timezone: String,
    language: String,
    notify: bool,
}
pub async fn read(
    user: AuthenticatedUser,
    State(s): State<AppState>,
) -> Result<Json<Preferences>, AppError> {
    Ok(Json(
        sqlx::query_as(
            "SELECT timezone,language,notify FROM personal_preferences WHERE user_id=$1",
        )
        .bind(user.id)
        .fetch_optional(&s.pool)
        .await?
        .unwrap_or(Preferences {
            timezone: String::new(),
            language: String::new(),
            notify: true,
        }),
    ))
}
pub async fn save(
    user: AuthenticatedUser,
    State(s): State<AppState>,
    Json(p): Json<Preferences>,
) -> Result<Json<Preferences>, AppError> {
    let valid: bool =
        sqlx::query_scalar("SELECT $1='' OR EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=$1)")
            .bind(&p.timezone)
            .fetch_one(&s.pool)
            .await?;
    if !valid || !matches!(p.language.as_str(), "" | "en-US" | "en-GB" | "sv-SE") {
        return Err(AppError::BadRequest("Invalid calendar preference".into()));
    }
    sqlx::query("INSERT INTO personal_preferences(user_id,timezone,language,notify) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET timezone=excluded.timezone,language=excluded.language,notify=excluded.notify")
      .bind(user.id).bind(&p.timezone).bind(&p.language).bind(p.notify).execute(&s.pool).await?;
    Ok(Json(p))
}

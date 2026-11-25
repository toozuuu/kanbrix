use crate::common::auth::{verify_workspace_membership, AuthenticatedUser};
use crate::common::error::AppError;
use crate::common::state::AppState;
use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
use uuid::Uuid;

#[derive(Serialize)]
pub struct EmailSettingsResponse {
    pub enabled: bool,
    pub provider: String,
    pub from_email: String,
    pub from_name: String,
    pub reply_to: Option<String>,
    pub api_url: Option<String>,
    pub domain: Option<String>,
    pub has_api_key: bool,
    pub send_invites: bool,
    pub send_notifications: bool,
}

#[derive(Deserialize)]
pub struct SaveEmailSettingsRequest {
    pub enabled: bool,
    pub provider: String,
    pub from_email: String,
    pub from_name: String,
    pub reply_to: Option<String>,
    pub api_url: Option<String>,
    pub domain: Option<String>,
    pub api_key: Option<String>,
    pub clear_api_key: Option<bool>,
    pub send_invites: bool,
    pub send_notifications: bool,
}

#[derive(Deserialize)]
pub struct TestEmailRequest {
    pub to: Option<String>,
}

async fn require_admin(state: &AppState, ws: Uuid, user_id: Uuid) -> Result<(), AppError> {
    let role = verify_workspace_membership(&state.pool, ws, user_id).await?;
    super::configuration::permit(&state.pool, ws, role.to_str(), "manage_settings").await?;
    if !role.can_manage_workspace() {
        return Err(AppError::Forbidden("Administrator access required".into()));
    }
    Ok(())
}

pub async fn read(
    user: AuthenticatedUser,
    State(state): State<AppState>,
    Path(ws): Path<Uuid>,
) -> Result<Json<EmailSettingsResponse>, AppError> {
    require_admin(&state, ws, user.id).await?;

    let row = sqlx::query_as::<
        _,
        (
            bool,
            String,
            String,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            bool,
            bool,
            bool,
        ),
    >(
        r#"
        SELECT enabled, provider, from_email, from_name, reply_to, api_url, domain,
               (api_key IS NOT NULL AND api_key <> '') AS has_api_key,
               send_invites, send_notifications
        FROM workspace_email_settings
        WHERE workspace_id = $1
        "#,
    )
    .bind(ws)
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let res = match row {
        Some((
            enabled,
            provider,
            from_email,
            from_name,
            reply_to,
            api_url,
            domain,
            has_api_key,
            send_invites,
            send_notifications,
        )) => EmailSettingsResponse {
            enabled,
            provider,
            from_email,
            from_name,
            reply_to,
            api_url,
            domain,
            has_api_key,
            send_invites,
            send_notifications,
        },
        None => EmailSettingsResponse {
            enabled: false,
            provider: "resend".into(),
            from_email: String::new(),
            from_name: "Kanbrix".into(),
            reply_to: None,
            api_url: None,
            domain: None,
            has_api_key: false,
            send_invites: true,
            send_notifications: true,
        },
    };

    Ok(Json(res))
}

pub async fn save(
    user: AuthenticatedUser,
    State(state): State<AppState>,
    Path(ws): Path<Uuid>,
    Json(req): Json<SaveEmailSettingsRequest>,
) -> Result<Json<EmailSettingsResponse>, AppError> {
    require_admin(&state, ws, user.id).await?;

    let provider = req.provider.trim().to_ascii_lowercase();
    if !matches!(
        provider.as_str(),
        "resend" | "sendgrid" | "mailgun" | "postmark" | "webhook"
    ) {
        return Err(AppError::BadRequest(
            "Unsupported email provider. Choose resend, sendgrid, mailgun, postmark, or webhook."
                .into(),
        ));
    }

    let from_email = req.from_email.trim().to_string();
    let from_name = if req.from_name.trim().is_empty() {
        "Kanbrix".to_string()
    } else {
        req.from_name.trim().to_string()
    };

    if req.enabled && (from_email.is_empty() || !from_email.contains('@')) {
        return Err(AppError::BadRequest(
            "A valid From Email address is required when email delivery is enabled.".into(),
        ));
    }

    let api_url = req
        .api_url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    if let Some(ref url) = api_url {
        if !url.starts_with("https://") && !url.starts_with("http://") {
            return Err(AppError::BadRequest(
                "Provider API / Webhook URL must start with https:// or http://".into(),
            ));
        }
    }
    if req.enabled && provider == "webhook" && api_url.is_none() {
        return Err(AppError::BadRequest(
            "Webhook URL is required for the Custom HTTP Webhook provider.".into(),
        ));
    }

    let domain = req
        .domain
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    if req.enabled && provider == "mailgun" && domain.is_none() {
        return Err(AppError::BadRequest(
            "Sending domain is required for Mailgun.".into(),
        ));
    }

    let reply_to = req
        .reply_to
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);

    let new_key = if req.clear_api_key.unwrap_or(false) {
        Some(String::new())
    } else {
        req.api_key
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
    };

    sqlx::query(
        r#"
        INSERT INTO workspace_email_settings
            (workspace_id, enabled, provider, from_email, from_name, reply_to, api_url, domain, api_key, send_invites, send_notifications, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, ''), $10, $11, NOW())
        ON CONFLICT (workspace_id) DO UPDATE SET
            enabled = EXCLUDED.enabled,
            provider = EXCLUDED.provider,
            from_email = EXCLUDED.from_email,
            from_name = EXCLUDED.from_name,
            reply_to = EXCLUDED.reply_to,
            api_url = EXCLUDED.api_url,
            domain = EXCLUDED.domain,
            api_key = CASE WHEN $9 IS NULL THEN workspace_email_settings.api_key ELSE $9 END,
            send_invites = EXCLUDED.send_invites,
            send_notifications = EXCLUDED.send_notifications,
            updated_at = NOW()
        "#,
    )
    .bind(ws)
    .bind(req.enabled)
    .bind(&provider)
    .bind(&from_email)
    .bind(&from_name)
    .bind(&reply_to)
    .bind(&api_url)
    .bind(&domain)
    .bind(&new_key)
    .bind(req.send_invites)
    .bind(req.send_notifications)
    .execute(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    read(user, State(state), Path(ws)).await
}

pub async fn send_test(
    user: AuthenticatedUser,
    State(state): State<AppState>,
    Path(ws): Path<Uuid>,
    Json(req): Json<TestEmailRequest>,
) -> Result<Json<Value>, AppError> {
    require_admin(&state, ws, user.id).await?;

    let to = match req.to.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(addr) => addr.to_string(),
        None => sqlx::query_scalar::<_, String>("SELECT email FROM users WHERE id = $1")
            .bind(user.id)
            .fetch_optional(&state.pool)
            .await
            .map_err(AppError::DatabaseError)?
            .unwrap_or_default(),
    };

    if !to.contains('@') {
        return Err(AppError::BadRequest(
            "Valid recipient email is required".into(),
        ));
    }

    send_workspace_email(
        &state.pool,
        ws,
        &to,
        "Kanbrix email provider test",
        "Your Kanbrix organization email provider is configured and working.",
        false,
    )
    .await?;

    Ok(Json(json!({ "sent": true, "to": to })))
}

pub async fn send_workspace_email(
    pool: &sqlx::PgPool,
    workspace_id: Uuid,
    to: &str,
    subject: &str,
    text: &str,
    require_invite_flag: bool,
) -> Result<(), AppError> {
    let row = sqlx::query_as::<
        _,
        (
            bool,
            String,
            String,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            bool,
        ),
    >(
        r#"
        SELECT enabled, provider, from_email, from_name, reply_to, api_url, domain, api_key, send_invites
        FROM workspace_email_settings
        WHERE workspace_id = $1
        "#,
    )
    .bind(workspace_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let Some((
        enabled,
        provider,
        from_email,
        from_name,
        reply_to,
        api_url,
        domain,
        api_key,
        send_invites,
    )) = row
    else {
        return Err(AppError::BadRequest(
            "Email provider is not configured for this workspace".into(),
        ));
    };

    if !enabled {
        return Err(AppError::BadRequest(
            "Email delivery is disabled for this workspace".into(),
        ));
    }
    if require_invite_flag && !send_invites {
        return Ok(());
    }
    if from_email.trim().is_empty() {
        return Err(AppError::BadRequest("From email is not configured".into()));
    }

    let key = api_key.unwrap_or_default();
    let from_formatted = format!("{from_name} <{from_email}>");
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("Kanbrix-Mailer/1.0")
        .build()
        .map_err(|_| AppError::Internal("Failed to build email client".into()))?;

    let resp = match provider.as_str() {
        "resend" => {
            if key.is_empty() {
                return Err(AppError::BadRequest("Resend API key is required".into()));
            }
            let mut body = json!({
                "from": from_formatted,
                "to": [to],
                "subject": subject,
                "text": text,
            });
            if let Some(rt) = &reply_to {
                body["reply_to"] = json!(rt);
            }
            client
                .post("https://api.resend.com/emails")
                .bearer_auth(&key)
                .json(&body)
                .send()
                .await
        }
        "sendgrid" => {
            if key.is_empty() {
                return Err(AppError::BadRequest("SendGrid API key is required".into()));
            }
            let mut body = json!({
                "personalizations": [{ "to": [{ "email": to }] }],
                "from": { "email": from_email, "name": from_name },
                "subject": subject,
                "content": [{ "type": "text/plain", "value": text }],
            });
            if let Some(rt) = &reply_to {
                body["reply_to"] = json!({ "email": rt });
            }
            client
                .post("https://api.sendgrid.com/v3/mail/send")
                .bearer_auth(&key)
                .json(&body)
                .send()
                .await
        }
        "mailgun" => {
            let dom = domain.unwrap_or_default();
            if key.is_empty() || dom.is_empty() {
                return Err(AppError::BadRequest(
                    "Mailgun API key and domain are required".into(),
                ));
            }
            let base = api_url
                .as_deref()
                .unwrap_or("https://api.mailgun.net")
                .trim_end_matches('/');
            let mut form = vec![
                ("from", from_formatted.as_str()),
                ("to", to),
                ("subject", subject),
                ("text", text),
            ];
            if let Some(rt) = reply_to.as_deref() {
                form.push(("h:Reply-To", rt));
            }
            client
                .post(format!("{base}/v3/{dom}/messages"))
                .basic_auth("api", Some(&key))
                .form(&form)
                .send()
                .await
        }
        "postmark" => {
            if key.is_empty() {
                return Err(AppError::BadRequest(
                    "Postmark Server Token is required".into(),
                ));
            }
            let mut body = json!({
                "From": from_formatted,
                "To": to,
                "Subject": subject,
                "TextBody": text,
            });
            if let Some(rt) = &reply_to {
                body["ReplyTo"] = json!(rt);
            }
            client
                .post("https://api.postmarkapp.com/email")
                .header("X-Postmark-Server-Token", &key)
                .json(&body)
                .send()
                .await
        }
        "webhook" => {
            let url =
                api_url.ok_or_else(|| AppError::BadRequest("Webhook URL is required".into()))?;
            let mut req = client.post(url).json(&json!({
                "from_email": from_email,
                "from_name": from_name,
                "reply_to": reply_to,
                "to": to,
                "subject": subject,
                "text": text,
            }));
            if !key.is_empty() {
                req = req.bearer_auth(&key);
            }
            req.send().await
        }
        _ => {
            return Err(AppError::BadRequest("Unsupported email provider".into()));
        }
    }
    .map_err(|e| AppError::BadRequest(format!("Could not reach email provider: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let detail = resp.text().await.unwrap_or_default();
        return Err(AppError::BadRequest(format!(
            "Email provider returned HTTP {status}: {}",
            detail.chars().take(200).collect::<String>()
        )));
    }

    Ok(())
}

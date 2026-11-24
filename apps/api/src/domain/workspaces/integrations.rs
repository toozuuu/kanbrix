use crate::common::{
    auth::{generate_session_token, hash_token, verify_workspace_membership, AuthenticatedUser},
    error::AppError,
    state::AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{collections::HashMap, time::Duration};
use uuid::Uuid;

#[derive(Deserialize, Clone)]
struct Destination {
    url: String,
    bearer: Option<String>,
}
type Destinations = HashMap<Uuid, HashMap<String, Destination>>;
fn destinations() -> Result<Destinations, AppError> {
    serde_json::from_str(
        &std::env::var("KANBRIX_WEBHOOK_DESTINATIONS")
            .ok()
            .filter(|v| !v.trim().is_empty())
            .unwrap_or_else(|| "{}".into()),
    )
    .map_err(|_| AppError::Internal("Invalid webhook destination configuration".into()))
}
async fn admin(s: &AppState, ws: Uuid, user: Uuid) -> Result<(), AppError> {
    let role = verify_workspace_membership(&s.pool, ws, user).await?;
    super::configuration::permit(&s.pool, ws, role.to_str(), "manage_integrations").await?;
    if role.can_manage_workspace() {
        Ok(())
    } else {
        Err(AppError::Forbidden("Administrator access required".into()))
    }
}
pub async fn read(
    u: AuthenticatedUser,
    State(s): State<AppState>,
    Path(ws): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    admin(&s, ws, u.id).await?;
    let settings:Option<Value>=sqlx::query_scalar("SELECT jsonb_build_object('events',events,'destination',destination,'notify_assignee',notify_assignee,'credential',token_hash IS NOT NULL) FROM integration_settings WHERE workspace_id=$1").bind(ws).fetch_optional(&s.pool).await?;
    let history:Vec<Value>=sqlx::query_scalar("SELECT jsonb_build_object('id',id,'event',event,'attempts',attempts,'delivered',delivered,'destination',destination,'created_at',created_at) FROM integration_events WHERE workspace_id=$1 ORDER BY id DESC LIMIT 30").bind(ws).fetch_all(&s.pool).await?;
    let known = destinations()?.remove(&ws).unwrap_or_default();
    Ok(Json(
        json!({"settings":settings.unwrap_or(json!({"events":[],"destination":"","notify_assignee":false,"credential":false})), "destinations":known.keys().collect::<Vec<_>>(),"history":history}),
    ))
}
#[derive(Deserialize)]
pub struct Rules {
    events: Vec<String>,
    destination: String,
    notify_assignee: bool,
}
pub async fn save(
    u: AuthenticatedUser,
    State(s): State<AppState>,
    Path(ws): Path<Uuid>,
    Json(r): Json<Rules>,
) -> Result<Json<bool>, AppError> {
    admin(&s, ws, u.id).await?;
    if r.events.len() > 3
        || r.events.iter().any(|e| {
            !matches!(
                e.as_str(),
                "issue.created" | "issue.status_changed" | "issue.due"
            )
        })
        || (!r.destination.is_empty()
            && destinations()?
                .get(&ws)
                .and_then(|m| m.get(&r.destination))
                .is_none())
    {
        return Err(AppError::BadRequest("Unknown event or destination".into()));
    }
    sqlx::query("INSERT INTO integration_settings(workspace_id,events,destination,notify_assignee) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id) DO UPDATE SET events=excluded.events,destination=excluded.destination,notify_assignee=excluded.notify_assignee").bind(ws).bind(r.events).bind(r.destination).bind(r.notify_assignee).execute(&s.pool).await?;
    Ok(Json(true))
}
pub async fn token(
    u: AuthenticatedUser,
    State(s): State<AppState>,
    Path(ws): Path<Uuid>,
    Json(enable): Json<bool>,
) -> Result<Json<Value>, AppError> {
    admin(&s, ws, u.id).await?;
    let (raw, hash) = generate_session_token();
    sqlx::query("INSERT INTO integration_settings(workspace_id,token_hash) VALUES($1,$2) ON CONFLICT(workspace_id) DO UPDATE SET token_hash=excluded.token_hash").bind(ws).bind(enable.then_some(hash)).execute(&s.pool).await?;
    Ok(Json(json!({"token":enable.then_some(raw)})))
}
#[derive(Deserialize)]
pub struct Cursor {
    after: Option<i64>,
}
pub async fn feed(
    State(s): State<AppState>,
    Path(ws): Path<Uuid>,
    Query(q): Query<Cursor>,
    headers: HeaderMap,
) -> Result<Json<Vec<Value>>, AppError> {
    let raw = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or_else(|| AppError::Unauthorized("Integration token required".into()))?;
    let ok: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM integration_settings WHERE workspace_id=$1 AND token_hash=$2)",
    )
    .bind(ws)
    .bind(hash_token(raw))
    .fetch_one(&s.pool)
    .await?;
    if !ok {
        return Err(AppError::Unauthorized("Invalid integration token".into()));
    }
    Ok(Json(sqlx::query_scalar("SELECT jsonb_build_object('id',id,'payload',payload,'created_at',created_at) FROM integration_events WHERE workspace_id=$1 AND id>$2 ORDER BY id LIMIT 100").bind(ws).bind(q.after.unwrap_or(0)).fetch_all(&s.pool).await?))
}
pub async fn retry(
    u: AuthenticatedUser,
    State(s): State<AppState>,
    Path((ws, id)): Path<(Uuid, i64)>,
) -> Result<Json<bool>, AppError> {
    admin(&s, ws, u.id).await?;
    let n=sqlx::query("UPDATE integration_events SET attempts=0,next_attempt=now() WHERE workspace_id=$1 AND id=$2 AND NOT delivered AND attempts>=5").bind(ws).bind(id).execute(&s.pool).await?;
    Ok(Json(n.rows_affected() == 1))
}
pub async fn run(pool: sqlx::PgPool) {
    let client = match reqwest::Client::builder()
        .https_only(true)
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Webhook client initialization failed: {e}");
            return;
        }
    };
    let mut due = tokio::time::interval(Duration::from_secs(300));
    let mut notify = tokio::time::interval(Duration::from_secs(2));
    loop {
        tokio::select! {
            _=due.tick()=>{
                if let Err(e)=sqlx::query("SELECT queue_issue_event(i,'issue.due',(i.due_date AT TIME ZONE 'UTC')::date) FROM integration_settings r JOIN projects p USING(workspace_id) JOIN issues i ON i.project_id=p.id JOIN issue_statuses s ON s.id=i.status_id WHERE 'issue.due'=ANY(r.events) AND i.due_date>=now() AND i.due_date<now()+interval '1 day' AND i.archived_at IS NULL AND s.category<>'Done'").execute(&pool).await{tracing::warn!("Deadline notification failed: {e}")}
            },
            _=notify.tick()=>{if let Err(e)=deliver(&pool,&client).await{tracing::warn!("Webhook delivery worker failed: {e}")}}
        }
    }
}
async fn deliver(pool: &sqlx::PgPool, client: &reqwest::Client) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;
    let row:Option<(i64,Uuid,String,Value)>=sqlx::query_as("SELECT id,workspace_id,destination,payload FROM integration_events WHERE NOT delivered AND attempts<5 AND destination<>'' AND next_attempt<=now() ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED").fetch_optional(&mut *tx).await?;
    if let Some((id, ws, name, payload)) = row {
        let known = destinations()?;
        let mut success = false;
        if let Some(dest) = known.get(&ws).and_then(|m| m.get(&name)) {
            let mut request = client
                .post(&dest.url)
                .header("X-Kanbrix-Event-Id", id.to_string())
                .json(&payload);
            if let Some(bearer) = &dest.bearer {
                request = request.bearer_auth(bearer)
            }
            success = request.send().await.is_ok_and(|r| r.status().is_success());
        }
        sqlx::query("UPDATE integration_events SET delivered=$2,attempts=attempts+1,next_attempt=now()+interval '30 seconds'*(attempts+1) WHERE id=$1").bind(id).bind(success).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}

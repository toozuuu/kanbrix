use crate::common::{auth::AuthenticatedUser, error::AppError, state::AppState};
use axum::{
    extract::{
        ws::{Message, WebSocketUpgrade},
        Path, State,
    },
    http::HeaderMap,
    response::Response,
};
use sqlx::postgres::PgListener;
use tokio::{
    sync::broadcast,
    time::{sleep, Duration},
};
use uuid::Uuid;

pub async fn listen(pool: sqlx::PgPool, events: broadcast::Sender<Uuid>) {
    loop {
        if let Ok(mut listener) = PgListener::connect_with(&pool).await {
            if listener.listen("kanbrix_board").await.is_ok() {
                let _ = events.send(Uuid::nil());
                while let Ok(event) = listener.try_recv().await {
                    let Some(event) = event else { break };
                    if let Ok(id) = event.payload().parse() {
                        let _ = events.send(id);
                    }
                }
            }
        }
        sleep(Duration::from_secs(2)).await;
    }
}
#[utoipa::path(get, path="/api/v1/projects/{project}/live", params(("project"=Uuid,Path,description="Project ID")), responses((status=101,description="Board WebSocket connection established")))]
pub async fn board(
    user: AuthenticatedUser,
    State(s): State<AppState>,
    Path(project): Path<Uuid>,
    headers: HeaderMap,
    ws: WebSocketUpgrade,
) -> Result<Response, AppError> {
    if headers.get("origin").and_then(|h| h.to_str().ok()) != Some(s.config.client_origin.as_str())
    {
        return Err(AppError::Forbidden("Invalid board origin".into()));
    }
    let allowed = || {
        sqlx::query_scalar::<_,bool>("SELECT EXISTS(SELECT 1 FROM projects p JOIN workspace_members m ON p.workspace_id=m.workspace_id WHERE p.id=$1 AND m.user_id=$2)").bind(project).bind(user.id).fetch_one(&s.pool)
    };
    if !allowed().await? {
        return Err(AppError::NotFound("Project unavailable".into()));
    }
    let mut rx = s.events.subscribe();
    Ok(ws.on_upgrade(move |mut socket|async move{
        // Reauthenticate each reconnect and send only an invalidation signal.
        let expiry=sleep(Duration::from_secs(60));tokio::pin!(expiry);
        if socket.send(Message::Text("refresh".into())).await.is_err(){return}
        loop{tokio::select!{
            _=&mut expiry=>break,
            msg=socket.recv()=>if !matches!(msg,Some(Ok(Message::Pong(_)|Message::Ping(_)))){break},
            result=rx.recv()=>{
                match result {Ok(id) if id!=project && !id.is_nil()=>continue,Err(broadcast::error::RecvError::Closed)=>break,_=>{}}
                if socket.send(Message::Text("refresh".into())).await.is_err(){break}
            }
        }}
    }))
}

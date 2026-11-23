use crate::common::{auth::AuthenticatedUser, error::AppError, state::AppState};
use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const MAX_BYTES: usize = 10 * 1024 * 1024;
#[derive(Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]

pub struct Attachment {
    pub id: Uuid,
    pub filename: String,
    pub size: i64,
    #[serde(default)]
    pub content_type: Option<String>,
}
async fn access(s: &AppState, issue: Uuid, user: Uuid) -> Result<(Uuid, String), AppError> {
    sqlx::query_as("SELECT p.workspace_id,m.role FROM issues i JOIN projects p ON p.id=i.project_id JOIN workspace_members m ON m.workspace_id=p.workspace_id AND m.user_id=$2 WHERE i.id=$1 AND i.archived_at IS NULL")
        .bind(issue).bind(user).fetch_optional(&s.pool).await?.ok_or_else(||AppError::NotFound("Issue unavailable".into()))
}
fn directory() -> std::path::PathBuf {
    std::env::var_os("STORAGE_LOCAL_PATH")
        .unwrap_or_else(|| "uploads".into())
        .into()
}
fn storage_error(e: std::io::Error) -> AppError {
    tracing::error!("Attachment storage: {e}");
    AppError::Internal("Attachment storage unavailable".into())
}

#[utoipa::path(get,path="/api/v1/issues/{issue}/attachments",params(("issue"=Uuid,Path,description="Issue ID")),responses((status=200,body=[Attachment])))]
pub async fn list(
    u: AuthenticatedUser,
    State(s): State<AppState>,
    Path(issue): Path<Uuid>,
) -> Result<Json<Vec<Attachment>>, AppError> {
    access(&s, issue, u.id).await?;
    Ok(Json(
        sqlx::query_as(
            "SELECT id,filename,size,content_type FROM attachments WHERE issue_id=$1 ORDER BY created_at,id",
        )
        .bind(issue)
        .fetch_all(&s.pool)
        .await?,
    ))
}
#[utoipa::path(post,path="/api/v1/issues/{issue}/attachments",params(("issue"=Uuid,Path,description="Issue ID")),request_body(content=String,content_type="multipart/form-data",description="One binary file in the file form field"),responses((status=201,body=Attachment)))]
pub async fn upload(
    u: AuthenticatedUser,
    State(s): State<AppState>,
    Path(issue): Path<Uuid>,
    mut form: Multipart,
) -> Result<(StatusCode, Json<Attachment>), AppError> {
    let (ws, role) = access(&s, issue, u.id).await?;
    if role == "Viewer" {
        return Err(AppError::Forbidden("Edit access required".into()));
    }
    crate::domain::workspaces::configuration::permit(&s.pool, ws, &role, "edit_issues").await?;
    let field = form
        .next_field()
        .await
        .map_err(|_| AppError::BadRequest("Invalid multipart upload".into()))?
        .ok_or_else(|| AppError::BadRequest("Select a file".into()))?;
    let name = field
        .file_name()
        .unwrap_or("")
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or("")
        .to_owned();
    if field.name() != Some("file")
        || name.is_empty()
        || name.len() > 255
        || name.chars().any(char::is_control)
    {
        return Err(AppError::BadRequest("Invalid filename".into()));
    }
    let data = field
        .bytes()
        .await
        .map_err(|_| AppError::BadRequest("Upload exceeds 10 MiB or is incomplete".into()))?;
    if data.len() > MAX_BYTES || data.is_empty() {
        return Err(AppError::BadRequest(
            "Select a nonempty file up to 10 MiB".into(),
        ));
    }
    if form
        .next_field()
        .await
        .map_err(|_| AppError::BadRequest("Invalid upload".into()))?
        .is_some()
    {
        return Err(AppError::BadRequest("Upload one file per request".into()));
    }
    let id = Uuid::new_v4();
    let root = directory();
    let key = id.to_string();
    let path = root.join(&key);
    tokio::fs::create_dir_all(&root)
        .await
        .map_err(storage_error)?;
    if let Err(e) = tokio::fs::write(&path, &data).await {
        let _ = tokio::fs::remove_file(&path).await;
        return Err(storage_error(e));
    }
    let result=sqlx::query_as("INSERT INTO attachments(id,issue_id,uploader_id,storage_key,filename,content_type,size) VALUES($1,$2,$3,$4,$5,'application/octet-stream',$6) RETURNING id,filename,size,content_type")
        .bind(id).bind(issue).bind(u.id).bind(key).bind(name).bind(data.len() as i64).fetch_one(&s.pool).await;
    match result {
        Ok(row) => Ok((StatusCode::CREATED, Json(row))),
        Err(e) => {
            let _ = tokio::fs::remove_file(path).await;
            Err(e.into())
        }
    }
}
#[utoipa::path(get,path="/api/v1/issues/{issue}/attachments/{id}",params(("issue"=Uuid,Path,description="Issue ID"),("id"=Uuid,Path,description="Attachment ID")),responses((status=200,content_type="application/octet-stream")))]
pub async fn download(
    u: AuthenticatedUser,
    State(s): State<AppState>,
    Path((issue, id)): Path<(Uuid, Uuid)>,
) -> Result<Response, AppError> {
    access(&s, issue, u.id).await?;
    let name: String =
        sqlx::query_scalar("SELECT filename FROM attachments WHERE id=$1 AND issue_id=$2")
            .bind(id)
            .bind(issue)
            .fetch_optional(&s.pool)
            .await?
            .ok_or_else(|| AppError::NotFound("Attachment unavailable".into()))?;
    let data = tokio::fs::read(directory().join(id.to_string()))
        .await
        .map_err(storage_error)?;
    let encoded: String = name.bytes().map(|b| format!("%{b:02X}")).collect();
    Ok((
        [
            (header::CONTENT_TYPE, "application/octet-stream".to_owned()),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment; filename*=UTF-8''{encoded}"),
            ),
            (header::CACHE_CONTROL, "private, no-store".into()),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff".into()),
        ],
        Body::from(data),
    )
        .into_response())
}

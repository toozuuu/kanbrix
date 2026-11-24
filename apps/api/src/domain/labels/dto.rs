use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, ToSchema, FromRow, Clone)]
pub struct Label {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateLabelRequest {
    pub project_id: Option<Uuid>,
    pub name: String,
    pub color: Option<String>,
}

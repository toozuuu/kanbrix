use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateWorkspaceRequest {
    #[validate(length(
        min = 2,
        max = 100,
        message = "Name must be between 2 and 100 characters"
    ))]
    pub name: String,
    #[validate(length(
        min = 2,
        max = 50,
        message = "Slug must be between 2 and 50 characters"
    ))]
    pub slug: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateWorkspaceRequest {
    #[validate(length(
        min = 2,
        max = 100,
        message = "Name must be between 2 and 100 characters"
    ))]
    pub name: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct WorkspaceResponse {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub owner_id: Uuid,
    pub role: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct WorkspaceMemberResponse {
    pub user_id: Uuid,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub role: String,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct InviteMemberRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
    pub role: String, // Admin, Member, Viewer
}

#[derive(Debug, Serialize, ToSchema)]
pub struct InviteMemberResponse {
    pub invitation_link: String,
    pub email_sent: bool,
}

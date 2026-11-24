use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::domain::labels::dto::Label;

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateIssueRequest {
    pub custom_values: Option<serde_json::Value>,
    #[validate(length(
        min = 2,
        max = 255,
        message = "Title must be between 2 and 255 characters"
    ))]
    pub title: String,
    pub description: Option<String>,
    pub r#type: Option<String>,   // Task, Bug, Story, Epic
    pub priority: Option<String>, // Lowest, Low, Medium, High, Urgent
    pub status_id: Uuid,
    pub assignee_id: Option<Uuid>,
    pub parent_issue_id: Option<Uuid>,
    pub sprint_id: Option<Uuid>,
    pub story_points: Option<i32>,
    pub due_date: Option<DateTime<Utc>>,
    pub labels: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateIssueRequest {
    pub custom_values: Option<serde_json::Value>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub r#type: Option<String>,
    pub priority: Option<String>,
    pub status_id: Option<Uuid>,
    #[serde(default, deserialize_with = "explicit_nullable")]
    pub assignee_id: Option<Option<Uuid>>,
    #[serde(default, deserialize_with = "explicit_nullable")]
    pub sprint_id: Option<Option<Uuid>>,
    pub position: Option<f64>,
    #[serde(default, deserialize_with = "explicit_nullable")]
    pub due_date: Option<Option<DateTime<Utc>>>,
    #[serde(default, deserialize_with = "explicit_nullable")]
    pub story_points: Option<Option<i32>>,
    pub labels: Option<Vec<Uuid>>,
}

// A missing update field leaves the stored value alone; an explicit null clears it.
fn explicit_nullable<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

#[cfg(test)]
mod tests {
    use super::UpdateIssueRequest;

    #[test]
    fn issue_update_distinguishes_omitted_fields_from_explicit_null() {
        let omitted: UpdateIssueRequest = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(omitted.assignee_id.is_none());
        assert!(omitted.sprint_id.is_none());
        assert!(omitted.due_date.is_none());

        let cleared: UpdateIssueRequest = serde_json::from_value(serde_json::json!({
            "assignee_id": null,
            "sprint_id": null,
            "due_date": null
        }))
        .unwrap();
        assert_eq!(cleared.assignee_id, Some(None));
        assert_eq!(cleared.sprint_id, Some(None));
        assert_eq!(cleared.due_date, Some(None));
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ReorderIssueRequest {
    pub status_id: Uuid,
    pub position: f64,
}

fn deserialize_label_ids<'de, D>(deserializer: D) -> Result<Option<Vec<Uuid>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = String::deserialize(deserializer)?;
    value
        .split(',')
        .map(Uuid::parse_str)
        .collect::<Result<Vec<_>, _>>()
        .map(Some)
        .map_err(serde::de::Error::custom)
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct IssueFilterQuery {
    pub field_id: Option<String>,
    pub field_value: Option<String>,
    pub status_id: Option<Uuid>,
    pub assignee_id: Option<Uuid>,
    pub r#type: Option<String>,
    pub priority: Option<String>,
    pub sprint_id: Option<Uuid>,
    pub label_id: Option<Uuid>,
    #[serde(default, deserialize_with = "deserialize_label_ids")]
    pub label_ids: Option<Vec<Uuid>>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub unassigned: Option<bool>,
    pub recently_updated: Option<bool>,
    pub due_before: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct IssueResponse {
    pub custom_values: serde_json::Value,
    pub id: Uuid,
    pub project_id: Uuid,
    pub project_key: String,
    pub issue_number: i32,
    pub identifier: String, // e.g. "CORE-42"
    pub title: String,
    pub description: Option<String>,
    pub r#type: String,
    pub priority: String,
    pub status_id: Uuid,
    pub status_name: String,
    pub status_category: String,
    pub assignee_id: Option<Uuid>,
    pub assignee_name: Option<String>,
    pub reporter_id: Uuid,
    pub reporter_name: String,
    pub parent_issue_id: Option<Uuid>,
    pub sprint_id: Option<Uuid>,
    pub story_points: Option<i32>,
    pub position: f64,
    pub due_date: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub labels: Vec<Label>,
}

use crate::common::{auth::AuthenticatedUser, error::AppError, state::AppState};
use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

async fn access(
    conn: &mut sqlx::PgConnection,
    project: Uuid,
    user: Uuid,
) -> Result<(Uuid, String, bool), AppError> {
    sqlx::query_as("SELECT p.workspace_id,m.role,m.role='Member' AND EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=$2 AND pm.role='Admin') FROM projects p JOIN workspace_members m ON p.workspace_id=m.workspace_id AND m.user_id=$2 WHERE p.id=$1 FOR SHARE OF m")
      .bind(project).bind(user).fetch_optional(conn).await?.ok_or_else(||AppError::NotFound("Project unavailable".into()))
}
pub async fn read(
    user: AuthenticatedUser,
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    let mut conn = s.pool.acquire().await?;
    let (ws, role, delegate) = access(&mut conn, id, user.id).await?;
    let admin = matches!(role.as_str(), "Owner" | "Admin");
    let (_, cfg) = crate::domain::workspaces::configuration::current(&mut conn, ws).await?;
    let row:Value=sqlx::query_scalar("SELECT jsonb_build_object('form',form_overrides,'revision',workflow_revision,'sprints',sprint_enabled,'transitions',transitions,'columns',(SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'category',s.category,'issues',(SELECT count(*) FROM issues i WHERE i.status_id=s.id)) ORDER BY position,id) FROM issue_statuses s WHERE s.project_id=p.id),'delegates',(SELECT coalesce(jsonb_agg(user_id),'[]') FROM project_members WHERE project_id=p.id AND role='Admin')) FROM projects p WHERE id=$1").bind(id).fetch_one(&mut *conn).await?;
    let mut row = row;
    if row["columns"].is_null() {
        row["columns"] = json!([])
    }
    row["editable"] = json!(
        (admin || delegate && cfg.delegate_workflows)
            && !cfg
                .restrictions
                .get(&role)
                .is_some_and(|v| v.iter().any(|p| p == "manage_workflows"))
    );
    row["admin"] = json!(admin);
    Ok(Json(row))
}
#[derive(Deserialize)]
pub struct Column {
    id: Uuid,
    name: String,
    category: String,
}
#[derive(Deserialize)]
pub struct Draft {
    revision: i64,
    columns: Vec<Column>,
    transitions: Vec<[Uuid; 2]>,
    sprints: bool,
    #[serde(default)]
    replacements: HashMap<Uuid, Uuid>,
    delegates: Vec<Uuid>,
    #[serde(default)]
    form: crate::domain::workspaces::configuration::FormOverrides,
}
pub async fn publish(
    user: AuthenticatedUser,
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    Json(d): Json<Draft>,
) -> Result<Json<bool>, AppError> {
    let mut tx = s.pool.begin().await?;
    let (ws, role, delegate) = access(&mut tx, id, user.id).await?;
    let admin = matches!(role.as_str(), "Owner" | "Admin");
    let (_, cfg) = crate::domain::workspaces::configuration::current(&mut tx, ws).await?;
    if cfg
        .restrictions
        .get(&role)
        .is_some_and(|list| list.iter().any(|p| p == "manage_workflows"))
    {
        return Err(AppError::Forbidden(
            "Organization restricts workflow changes".into(),
        ));
    }
    if !(admin || delegate && cfg.delegate_workflows) {
        return Err(AppError::Forbidden(
            "Project administration required".into(),
        ));
    }
    let ids: HashSet<Uuid> = d.columns.iter().map(|c| c.id).collect();
    if ids.is_empty()
        || ids.len() > 64
        || ids.len() != d.columns.len()
        || d.columns
            .iter()
            .map(|c| c.name.trim())
            .collect::<HashSet<_>>()
            .len()
            != ids.len()
        || d.columns.iter().any(|c| {
            c.name.trim().is_empty()
                || c.name.len() > 64
                || !matches!(
                    c.category.as_str(),
                    "Todo" | "Backlog" | "InReview" | "InProgress" | "Done"
                )
        })
        || d.transitions.iter().flatten().any(|i| !ids.contains(i))
    {
        return Err(AppError::BadRequest("Invalid workflow".into()));
    }
    let rev: i64 =
        sqlx::query_scalar("SELECT workflow_revision FROM projects WHERE id=$1 FOR UPDATE")
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;
    if rev != d.revision {
        return Err(AppError::Conflict(
            "Workflow changed. Reload and review.".into(),
        ));
    }
    let existing: Vec<Uuid> =
        sqlx::query_scalar("SELECT id FROM issue_statuses WHERE project_id=$1 FOR UPDATE")
            .bind(id)
            .fetch_all(&mut *tx)
            .await?;
    sqlx::query("UPDATE projects SET transitions='[]' WHERE id=$1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    // Temporary names allow two retained columns to exchange names within the transaction.
    sqlx::query("UPDATE issue_statuses SET name=gen_random_uuid()::text WHERE project_id=$1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    for (i, c) in d.columns.iter().enumerate() {
        if existing.contains(&c.id) {
            sqlx::query("UPDATE issue_statuses SET name=$1,category=$2,position=$3 WHERE project_id=$4 AND id=$5")
                .bind(c.name.trim()).bind(&c.category).bind(i as f64*1000.).bind(id).bind(c.id).execute(&mut *tx).await?;
        } else {
            sqlx::query("INSERT INTO issue_statuses(id,project_id,name,category,position) VALUES($1,$2,$3,$4,$5)").bind(c.id).bind(id).bind(c.name.trim()).bind(&c.category).bind(i as f64*1000.).execute(&mut *tx).await?;
        }
    }
    for old in existing.iter().filter(|k| !ids.contains(*k)) {
        let dest = d.replacements.get(old).filter(|k| ids.contains(*k));
        if let Some(to) = dest {
            sqlx::query("UPDATE issues SET status_id=$1 WHERE project_id=$2 AND status_id=$3")
                .bind(to)
                .bind(id)
                .bind(old)
                .execute(&mut *tx)
                .await?;
        } else if sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM issues WHERE project_id=$1 AND status_id=$2)",
        )
        .bind(id)
        .bind(old)
        .fetch_one(&mut *tx)
        .await?
        {
            return Err(AppError::BadRequest(
                "Choose a destination for issues in removed columns".into(),
            ));
        }
        sqlx::query("DELETE FROM issue_statuses WHERE project_id=$1 AND id=$2")
            .bind(id)
            .bind(old)
            .execute(&mut *tx)
            .await?;
    }
    if admin {
        sqlx::query("DELETE FROM project_members WHERE project_id=$1 AND role='Admin'")
            .bind(id)
            .execute(&mut *tx)
            .await?;
        for u in &d.delegates {
            let result=sqlx::query("INSERT INTO project_members (project_id,user_id,role) SELECT $1,user_id,'Admin' FROM workspace_members WHERE workspace_id=$2 AND user_id=$3 AND role='Member' ON CONFLICT(project_id,user_id) DO UPDATE SET role='Admin'").bind(id).bind(ws).bind(u).execute(&mut *tx).await?;
            if result.rows_affected() != 1 {
                return Err(AppError::BadRequest(
                    "Delegate must be a workspace member".into(),
                ));
            }
        }
    }
    sqlx::query("UPDATE projects SET transitions=$1,sprint_enabled=$2,form_overrides=$4,workflow_revision=workflow_revision+1 WHERE id=$3").bind(json!(d.transitions)).bind(d.sprints).bind(id).bind(sqlx::types::Json(&d.form)).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO activity_logs(workspace_id,actor_id,entity_type,entity_id,action,metadata) VALUES($1,$2,'project',$3,'workflow_published',$4)").bind(ws).bind(user.id).bind(id).bind(json!({"revision":rev+1})).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(true))
}

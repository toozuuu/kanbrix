use crate::common::{
    auth::{verify_workspace_membership, AuthenticatedUser},
    error::AppError,
    state::AppState,
};
use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct Column {
    pub name: String,
    pub category: String,
}
#[derive(Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct Template {
    #[serde(default)]
    pub form: FormOverrides,
    #[serde(default)]
    pub transitions: Vec<[String; 2]>,
    pub name: String,
    pub columns: Vec<Column>,
    pub sprints: bool,
}
#[derive(Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct Field {
    pub id: Uuid,
    pub label: String,
    #[serde(default)]
    pub help: String,
    #[serde(default)]
    pub option_labels: std::collections::BTreeMap<String, String>,
    pub kind: String,
    pub required: bool,
    pub issue_type: String,
    pub options: Vec<String>,
}
#[derive(Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct Configuration {
    #[serde(default)]
    pub delegate_workflows: bool,
    #[serde(default)]
    pub allow_form_overrides: bool,
    #[serde(default)]
    pub restrictions: std::collections::BTreeMap<String, Vec<String>>,
    pub version: u8,
    pub brand: String,
    pub logo: String,
    pub accent: String,
    pub timezone: String,
    pub date_format: String,
    pub week_start: u8,
    pub types: Vec<String>,
    pub priorities: Vec<String>,
    pub fields: Vec<Field>,
    pub templates: Vec<Template>,
}
impl Default for Configuration {
    fn default() -> Self {
        Self {
            delegate_workflows: false,
            allow_form_overrides: false,
            restrictions: Default::default(),
            version: 1,
            brand: String::new(),
            logo: String::new(),
            accent: String::new(),
            timezone: "UTC".into(),
            date_format: "yyyy-MM-dd".into(),
            week_start: 1,
            types: ["Task", "Bug", "Story", "Epic"].map(String::from).into(),
            priorities: ["Medium", "Lowest", "Low", "High", "Urgent"]
                .map(String::from)
                .into(),
            fields: vec![],
            templates: vec![Template {
                form: Default::default(),
                transitions: vec![],
                name: "Engineering".into(),
                sprints: true,
                columns: [
                    ("Backlog", "Backlog"),
                    ("To Do", "Todo"),
                    ("In Progress", "InProgress"),
                    ("In Review", "InReview"),
                    ("Done", "Done"),
                ]
                .into_iter()
                .map(|(n, c)| Column {
                    name: n.into(),
                    category: c.into(),
                })
                .collect(),
            }],
        }
    }
}
fn invalid(msg: &str) -> AppError {
    AppError::BadRequest(msg.into())
}
fn names(values: &[String], max: usize) -> bool {
    !values.is_empty()
        && values.len() <= 64
        && values
            .iter()
            .all(|v| !v.is_empty() && v.trim() == v && v.len() <= max)
        && values.iter().collect::<HashSet<_>>().len() == values.len()
}
impl Configuration {
    fn validate(&self) -> Result<(), AppError> {
        if self.restrictions.iter().any(|(role, perms)| {
            !matches!(role.as_str(), "Member" | "Admin")
                || perms.iter().any(|p| {
                    !matches!(
                        p.as_str(),
                        "edit_issues"
                            | "create_projects"
                            | "manage_sprints"
                            | "manage_members"
                            | "manage_settings"
                            | "manage_workflows"
                            | "manage_integrations"
                            | "export_configuration"
                    )
                })
        }) {
            return Err(invalid("Unknown permission"));
        }
        if self.version != 1
            || self.brand.len() > 80
            || self.logo.len() > 2048
            || !(self.logo.is_empty() || self.logo.starts_with("https://"))
            || !(self.accent.is_empty()
                || (self.accent.len() == 7
                    && self.accent.starts_with('#')
                    && self.accent[1..].bytes().all(|b| b.is_ascii_hexdigit())))
            || !matches!(self.week_start, 0 | 1 | 6)
            || !matches!(
                self.date_format.as_str(),
                "yyyy-MM-dd" | "dd/MM/yyyy" | "MM/dd/yyyy"
            )
            || !names(&self.types, 32)
            || !names(&self.priorities, 32)
        {
            return Err(invalid(
                "Check branding, calendar, issue types and priorities",
            ));
        }
        if self.fields.len() > 64
            || self
                .fields
                .iter()
                .map(|f| f.id)
                .collect::<HashSet<_>>()
                .len()
                != self.fields.len()
        {
            return Err(invalid("Invalid or duplicate field IDs"));
        }
        for f in &self.fields {
            if f.help.len() > 500
                || f.option_labels.len() > 64
                || f.option_labels.values().any(|l| l.len() > 80)
                || f.label.trim().is_empty()
                || f.label.len() > 80
                || (!f.issue_type.is_empty() && !self.types.contains(&f.issue_type))
                || !matches!(
                    f.kind.as_str(),
                    "text" | "number" | "date" | "select" | "multi"
                )
                || (matches!(f.kind.as_str(), "select" | "multi") && !names(&f.options, 80))
            {
                return Err(invalid("Invalid custom field definition"));
            }
        }
        if !names(
            &self
                .templates
                .iter()
                .map(|t| t.name.clone())
                .collect::<Vec<_>>(),
            80,
        ) {
            return Err(invalid("Provide unique template names"));
        }
        for t in &self.templates {
            if t.transitions
                .iter()
                .flatten()
                .any(|n| !t.columns.iter().any(|c| c.name == *n))
            {
                return Err(invalid("Unknown template transition"));
            }
            if !names(
                &t.columns.iter().map(|c| c.name.clone()).collect::<Vec<_>>(),
                64,
            ) || t.columns.iter().any(|c| {
                !matches!(
                    c.category.as_str(),
                    "Backlog" | "Todo" | "InProgress" | "InReview" | "Done"
                )
            }) {
                return Err(invalid("Invalid workflow columns"));
            }
        }
        Ok(())
    }
}
pub async fn current(
    conn: &mut sqlx::PgConnection,
    ws: Uuid,
) -> Result<(i64, Configuration), AppError> {
    let last = sqlx::query_as::<_,(i64,sqlx::types::Json<Configuration>)>("SELECT revision,configuration FROM configuration_revisions WHERE workspace_id=$1 ORDER BY revision DESC LIMIT 1")
        .bind(ws).fetch_optional(conn).await?;
    Ok(last.map(|(v, c)| (v, c.0)).unwrap_or_default())
}
pub async fn read(
    user: AuthenticatedUser,
    State(s): State<AppState>,
    Path(ws): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    verify_workspace_membership(&s.pool, ws, user.id).await?;
    let revision: i64 = sqlx::query_scalar(
        "SELECT coalesce(max(revision),0) FROM configuration_revisions WHERE workspace_id=$1",
    )
    .bind(ws)
    .fetch_one(&s.pool)
    .await?;
    let key = format!("kanbrix:v1:configuration:{ws}:{revision}");
    if let Some(cached) = s.cache.get(&key).await {
        return Ok(Json(cached));
    }
    let (revision, configuration) = current(&mut *s.pool.acquire().await?, ws).await?;
    let response = json!({"revision":revision,"configuration":configuration});
    s.cache
        .put(
            &format!("kanbrix:v1:configuration:{ws}:{revision}"),
            &response,
        )
        .await;
    Ok(Json(response))
}
#[derive(Deserialize)]
pub struct Publish {
    revision: i64,
    configuration: Configuration,
}
pub async fn publish(
    user: AuthenticatedUser,
    State(s): State<AppState>,
    Path(ws): Path<Uuid>,
    Json(body): Json<Publish>,
) -> Result<Json<Value>, AppError> {
    let role = verify_workspace_membership(&s.pool, ws, user.id).await?;
    if !role.can_manage_workspace() {
        return Err(AppError::Forbidden("Administrator access required".into()));
    }
    body.configuration.validate()?;
    let mut tx = s.pool.begin().await?;
    sqlx::query("SELECT id FROM workspaces WHERE id=$1 FOR UPDATE")
        .bind(ws)
        .execute(&mut *tx)
        .await?;
    let (revision, previous) = current(&mut tx, ws).await?;
    if previous
        .restrictions
        .get(role.to_str())
        .is_some_and(|p| p.iter().any(|p| p == "manage_settings"))
    {
        return Err(AppError::Forbidden(
            "Organization restricts settings changes".into(),
        ));
    }
    if role.to_str() != "Owner" && previous.restrictions != body.configuration.restrictions {
        return Err(AppError::Forbidden(
            "Only the owner may change role permissions".into(),
        ));
    }
    if revision != body.revision {
        return Err(AppError::Conflict(
            "Settings changed. Reload before publishing.".into(),
        ));
    }
    let valid_zone: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=$1)")
            .bind(&body.configuration.timezone)
            .fetch_one(&mut *tx)
            .await?;
    if !valid_zone {
        return Err(invalid("Unknown time zone"));
    }
    for f in &body.configuration.fields {
        if previous
            .fields
            .iter()
            .any(|old| old.id == f.id && old.kind != f.kind)
        {
            return Err(invalid("Create a new field to change its data type"));
        }
    }
    let next = revision + 1;
    sqlx::query("INSERT INTO configuration_revisions(workspace_id,revision,configuration,author_id) VALUES($1,$2,$3,$4)")
      .bind(ws).bind(next).bind(sqlx::types::Json(&body.configuration)).bind(user.id).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(
        json!({"revision":next,"configuration":body.configuration}),
    ))
}
pub async fn history(
    user: AuthenticatedUser,
    State(s): State<AppState>,
    Path(ws): Path<Uuid>,
) -> Result<Json<Vec<Value>>, AppError> {
    let role = verify_workspace_membership(&s.pool, ws, user.id).await?;
    if !role.can_manage_workspace() {
        return Err(AppError::Forbidden("Administrator access required".into()));
    }
    permit(&s.pool, ws, role.to_str(), "manage_settings").await?;
    let rows=sqlx::query_scalar("SELECT jsonb_build_object('revision',r.revision,'configuration',configuration,'author',u.name,'created_at',r.created_at) FROM configuration_revisions r LEFT JOIN users u ON u.id=r.author_id WHERE workspace_id=$1 ORDER BY revision DESC LIMIT 50")
        .bind(ws).fetch_all(&s.pool).await?;
    let mut rows: Vec<Value> = rows;
    rows.push(json!({"revision":0,"configuration":Configuration::default(),"author":"Kanbrix defaults","created_at":null}));
    Ok(Json(rows))
}
pub fn validate_values(
    cfg: &Configuration,
    kind: &str,
    values: &Value,
    old: &Value,
) -> Result<(), AppError> {
    let map = values
        .as_object()
        .ok_or_else(|| invalid("Custom fields must be an object"))?;
    for (key, v) in map {
        if !cfg
            .fields
            .iter()
            .any(|f| f.id.to_string() == *key && (f.issue_type.is_empty() || f.issue_type == kind))
            && old.get(key) != Some(v)
        {
            return Err(invalid("Unknown custom field"));
        }
    }
    for f in cfg
        .fields
        .iter()
        .filter(|f| f.issue_type.is_empty() || f.issue_type == kind)
    {
        let v = map.get(&f.id.to_string()).unwrap_or(&Value::Null);
        if v.is_null()
            || v.as_str().is_some_and(|s| s.trim().is_empty())
            || v.as_array().is_some_and(Vec::is_empty)
        {
            if f.required {
                return Err(invalid(&format!("{} is required", f.label)));
            }
            continue;
        }
        let valid = match f.kind.as_str() {
            "number" => v.is_number(),
            "date" => v
                .as_str()
                .is_some_and(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok()),
            "text" => v.as_str().is_some_and(|s| s.len() <= 4000),
            "select" => v.as_str().is_some_and(|s| f.options.iter().any(|o| o == s)),
            "multi" => v.as_array().is_some_and(|a| {
                a.len() <= 64
                    && a.iter()
                        .all(|x| x.as_str().is_some_and(|s| f.options.iter().any(|o| o == s)))
            }),
            _ => false,
        };
        if !valid {
            return Err(invalid(&format!("Invalid value for {}", f.label)));
        }
    }
    Ok(())
}
pub async fn validate(
    user: AuthenticatedUser,
    State(s): State<AppState>,
    Path(ws): Path<Uuid>,
    Json(cfg): Json<Configuration>,
) -> Result<Json<bool>, AppError> {
    if !verify_workspace_membership(&s.pool, ws, user.id)
        .await?
        .can_manage_workspace()
    {
        return Err(AppError::Forbidden("Administrator access required".into()));
    }
    cfg.validate()?;
    Ok(Json(true))
}
pub async fn permit(
    pool: &sqlx::PgPool,
    ws: Uuid,
    role: &str,
    permission: &str,
) -> Result<(), AppError> {
    if role == "Owner" {
        return Ok(());
    }
    let denied:bool=sqlx::query_scalar("SELECT coalesce((SELECT (configuration->'restrictions'->$2::text) ? $3 FROM configuration_revisions WHERE workspace_id=$1 ORDER BY revision DESC LIMIT 1),false)")
       .bind(ws).bind(role).bind(permission).fetch_one(pool).await?;
    if denied {
        Err(AppError::Forbidden(
            "Your organization restricts this action".into(),
        ))
    } else {
        Ok(())
    }
}
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct FormOverrides {
    pub hidden_fields: Vec<Uuid>,
    pub types: Vec<String>,
    pub priorities: Vec<String>,
}
impl Configuration {
    pub fn apply(&mut self, overrides: &FormOverrides) {
        if !self.allow_form_overrides {
            return;
        }
        self.fields
            .retain(|f| f.required || !overrides.hidden_fields.contains(&f.id));
        for (list, subset) in [
            (&mut self.types, &overrides.types),
            (&mut self.priorities, &overrides.priorities),
        ] {
            let filtered: Vec<String> = list
                .iter()
                .filter(|v| subset.contains(v))
                .cloned()
                .collect();
            if !filtered.is_empty() {
                *list = filtered;
            }
        }
    }
}
pub async fn effective(
    conn: &mut sqlx::PgConnection,
    ws: Uuid,
    project: Uuid,
) -> Result<Configuration, AppError> {
    let (_, mut cfg) = current(conn, ws).await?;
    let form: sqlx::types::Json<FormOverrides> =
        sqlx::query_scalar("SELECT form_overrides FROM projects WHERE id=$1 AND workspace_id=$2")
            .bind(project)
            .bind(ws)
            .fetch_one(conn)
            .await?;
    cfg.apply(&form.0);
    Ok(cfg)
}
pub async fn preview(
    user: AuthenticatedUser,
    State(s): State<AppState>,
    Path(ws): Path<Uuid>,
    Json(cfg): Json<Configuration>,
) -> Result<Json<Value>, AppError> {
    let role = verify_workspace_membership(&s.pool, ws, user.id).await?;
    if !role.can_manage_workspace() {
        return Err(AppError::Forbidden("Administrator access required".into()));
    }
    permit(&s.pool, ws, role.to_str(), "manage_settings").await?;
    cfg.validate()?;
    let required: Vec<Value> = cfg
        .fields
        .iter()
        .filter(|f| f.required)
        .map(|f| json!({"id":f.id,"kind":f.issue_type}))
        .collect();
    let affected:i64=sqlx::query_scalar("SELECT count(*) FROM issues i JOIN projects p ON p.id=i.project_id WHERE p.workspace_id=$1 AND i.archived_at IS NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements($2) f WHERE (f->>'kind'='' OR f->>'kind'=i.type) AND (NOT i.custom_values ? (f->>'id') OR i.custom_values->(f->>'id') IN ('null'::jsonb,'[]'::jsonb,'\"\"'::jsonb)))")
      .bind(ws).bind(json!(required)).fetch_one(&s.pool).await?;
    Ok(Json(json!({"issues_missing_required_fields":affected})))
}
pub async fn export(
    user: AuthenticatedUser,
    State(s): State<AppState>,
    Path(ws): Path<Uuid>,
) -> Result<Json<Configuration>, AppError> {
    let role = verify_workspace_membership(&s.pool, ws, user.id).await?;
    if !role.can_manage_workspace() {
        return Err(AppError::Forbidden("Administrator access required".into()));
    }
    permit(&s.pool, ws, role.to_str(), "export_configuration").await?;
    let (_, cfg) = current(&mut *s.pool.acquire().await?, ws).await?;
    Ok(Json(cfg))
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_validate_and_round_trip() {
        let cfg = Configuration::default();
        cfg.validate().unwrap();
        let encoded = serde_json::to_value(&cfg).unwrap();
        let restored: Configuration = serde_json::from_value(encoded.clone()).unwrap();
        assert_eq!(serde_json::to_value(restored).unwrap(), encoded);
    }

    #[test]
    fn project_overrides_preserve_required_fields_and_validate_option_keys() {
        let id = Uuid::new_v4();
        let mut cfg = Configuration::default();
        cfg.allow_form_overrides = true;
        cfg.fields.push(Field {
            id,
            label: "Impact".into(),
            kind: "select".into(),
            required: true,
            issue_type: "Bug".into(),
            help: String::new(),
            options: vec!["critical".into()],
            option_labels: [("critical".into(), "Service outage".into())].into(),
        });
        cfg.apply(&FormOverrides {
            hidden_fields: vec![id],
            types: vec!["Bug".into()],
            priorities: vec![],
        });
        assert_eq!(cfg.fields.len(), 1);
        assert_eq!(cfg.types, vec!["Bug"]);
        assert!(validate_values(&cfg, "Bug", &json!({}), &Value::Null).is_err());
        assert!(validate_values(
            &cfg,
            "Bug",
            &json!({id.to_string():"critical"}),
            &Value::Null
        )
        .is_ok());
        assert!(validate_values(
            &cfg,
            "Bug",
            &json!({id.to_string():"some other value"}),
            &Value::Null
        )
        .is_err());
    }
}

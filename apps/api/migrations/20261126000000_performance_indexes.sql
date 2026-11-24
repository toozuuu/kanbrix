-- Add missing indexes for hot-path lookups and drop redundant indexes that duplicate UNIQUE constraints.

CREATE INDEX IF NOT EXISTS idx_issue_labels_label_id ON issue_labels(label_id);
CREATE INDEX IF NOT EXISTS idx_issues_status_id ON issues(status_id);
CREATE INDEX IF NOT EXISTS idx_issue_history_project_observed ON issue_history(project_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_created ON activity_logs(workspace_id, entity_type, entity_id, created_at DESC);

DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_workspaces_slug;
DROP INDEX IF EXISTS idx_invitations_token;

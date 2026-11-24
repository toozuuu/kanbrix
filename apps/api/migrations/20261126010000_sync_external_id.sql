ALTER TABLE issues ADD COLUMN IF NOT EXISTS external_id VARCHAR(128);
CREATE UNIQUE INDEX IF NOT EXISTS idx_issues_project_external_id
  ON issues(project_id, external_id)
  WHERE external_id IS NOT NULL;

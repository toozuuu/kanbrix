ALTER TABLE issues ADD COLUMN IF NOT EXISTS story_points INTEGER;
CREATE INDEX IF NOT EXISTS idx_issues_parent_issue_id ON issues(parent_issue_id) WHERE parent_issue_id IS NOT NULL;

ALTER TABLE issue_statuses ADD COLUMN IF NOT EXISTS wip_limit INTEGER;

CREATE TABLE IF NOT EXISTS issue_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    target_issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    link_type VARCHAR(32) NOT NULL CHECK (link_type IN ('blocks', 'is_blocked_by', 'relates_to', 'duplicates')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_issue_id, target_issue_id, link_type)
);
CREATE INDEX IF NOT EXISTS idx_issue_links_source ON issue_links(source_issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_links_target ON issue_links(target_issue_id);

CREATE TABLE IF NOT EXISTS project_saved_filters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    query_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_filters_project ON project_saved_filters(project_id, user_id);

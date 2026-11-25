ALTER TABLE projects
    ADD COLUMN git_opened_status UUID REFERENCES issue_statuses(id) ON DELETE SET NULL,
    ADD COLUMN git_merged_status UUID REFERENCES issue_statuses(id) ON DELETE SET NULL;

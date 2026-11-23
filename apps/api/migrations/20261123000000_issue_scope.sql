ALTER TABLE issue_statuses ADD UNIQUE (project_id, id);
ALTER TABLE sprints ADD UNIQUE (project_id, id);
ALTER TABLE issues ADD UNIQUE (project_id, id);

ALTER TABLE issues
    ADD CONSTRAINT issue_status_scope FOREIGN KEY (project_id, status_id)
        REFERENCES issue_statuses (project_id, id),
    ADD CONSTRAINT issue_sprint_scope FOREIGN KEY (project_id, sprint_id)
        REFERENCES sprints (project_id, id) ON DELETE SET NULL (sprint_id),
    ADD CONSTRAINT issue_parent_scope FOREIGN KEY (project_id, parent_issue_id)
        REFERENCES issues (project_id, id) ON DELETE SET NULL (parent_issue_id);

-- Fail the migration transaction if existing assignments require operator review.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM issues i JOIN projects p ON p.id = i.project_id
        WHERE i.assignee_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM workspace_members m WHERE m.workspace_id = p.workspace_id AND m.user_id = i.assignee_id
        )) THEN
        RAISE EXCEPTION 'Existing issues have assignees outside their workspace';
    END IF;
END;
$$;

CREATE FUNCTION clear_departed_assignments() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE issues i SET assignee_id = NULL, updated_at = now()
    FROM projects p WHERE p.id = i.project_id AND p.workspace_id = OLD.workspace_id
    AND i.assignee_id = OLD.user_id;
    RETURN OLD;
END;
$$;
CREATE TRIGGER clear_departed_assignments AFTER DELETE ON workspace_members
    FOR EACH ROW EXECUTE FUNCTION clear_departed_assignments();

CREATE FUNCTION check_issue_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.assignee_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM projects p JOIN workspace_members m USING (workspace_id)
        WHERE p.id = NEW.project_id AND m.user_id = NEW.assignee_id
        FOR KEY SHARE OF m
    ) THEN
        RAISE EXCEPTION 'Invalid assignee' USING ERRCODE = '23514', CONSTRAINT = 'issue_assignee_scope';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER check_issue_assignment BEFORE INSERT OR UPDATE OF assignee_id, project_id
    ON issues FOR EACH ROW EXECUTE FUNCTION check_issue_assignment();

CREATE INDEX issues_open_deadlines ON issues (project_id, due_date, id)
    WHERE archived_at IS NULL AND due_date IS NOT NULL;

ALTER TABLE users ADD COLUMN login_window timestamptz,
                  ADD COLUMN login_attempts integer NOT NULL DEFAULT 0;

CREATE FUNCTION check_new_sprint_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.sprint_id IS NULL THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' THEN
        IF OLD.sprint_id IS NOT DISTINCT FROM NEW.sprint_id THEN RETURN NEW; END IF;
    END IF;
    -- Serialize new assignments against the sprint completion transaction.
    PERFORM 1 FROM sprints WHERE id = NEW.sprint_id AND project_id = NEW.project_id
        AND status <> 'completed' FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sprint unavailable' USING ERRCODE = '23503', CONSTRAINT = 'issue_sprint_scope';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER check_new_sprint_assignment BEFORE INSERT OR UPDATE OF sprint_id ON issues
    FOR EACH ROW EXECUTE FUNCTION check_new_sprint_assignment();

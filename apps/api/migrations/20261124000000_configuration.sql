CREATE TABLE personal_preferences (
    user_id uuid PRIMARY KEY REFERENCES users ON DELETE CASCADE,
    timezone text NOT NULL DEFAULT '',
    language text NOT NULL DEFAULT '',
    notify boolean NOT NULL DEFAULT true
);

CREATE TABLE configuration_revisions (
    workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
    revision bigint NOT NULL,
    configuration jsonb NOT NULL,
    author_id uuid REFERENCES users ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(workspace_id, revision)
);
ALTER TABLE issues ADD COLUMN custom_values jsonb NOT NULL DEFAULT '{}';
ALTER TABLE projects ADD COLUMN sprint_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE projects ADD COLUMN workflow_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN transitions jsonb NOT NULL DEFAULT '[]';
CREATE FUNCTION check_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rules jsonb;
BEGIN
    IF NEW.status_id = OLD.status_id THEN RETURN NEW; END IF;
    SELECT transitions INTO rules FROM projects WHERE id=NEW.project_id;
    IF rules <> '[]' AND NOT rules @> jsonb_build_array(jsonb_build_array(OLD.status_id,NEW.status_id)) THEN
        RAISE EXCEPTION 'Transition unavailable' USING ERRCODE='23514', CONSTRAINT='issue_transition';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER check_transition BEFORE UPDATE OF status_id ON issues FOR EACH ROW EXECUTE FUNCTION check_transition();
CREATE TABLE integration_settings (
    workspace_id uuid PRIMARY KEY REFERENCES workspaces ON DELETE CASCADE,
    events text[] NOT NULL DEFAULT '{}',
    destination text NOT NULL DEFAULT '',
    token_hash text,
    notify_assignee boolean NOT NULL DEFAULT false
);
CREATE TABLE integration_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
    issue_id uuid NOT NULL REFERENCES issues ON DELETE CASCADE,
    event text NOT NULL, payload jsonb NOT NULL, destination text NOT NULL,
    attempts integer NOT NULL DEFAULT 0, next_attempt timestamptz NOT NULL DEFAULT now(),
    delivered boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
    due_key date
);
CREATE UNIQUE INDEX integration_due_once ON integration_events (issue_id,due_key) WHERE due_key IS NOT NULL;
CREATE INDEX integration_feed ON integration_events(workspace_id,id);
CREATE INDEX integration_pending ON integration_events(next_attempt,id) WHERE NOT delivered AND destination <> '' AND attempts<5;
CREATE FUNCTION queue_issue_event(issue issues, event_name text, deadline date DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE subscription integration_settings; event_id bigint;
BEGIN
    SELECT settings.* INTO subscription FROM integration_settings settings JOIN projects p USING(workspace_id)
        WHERE p.id=issue.project_id AND event_name=ANY(settings.events);
    IF NOT FOUND THEN RETURN; END IF;
    INSERT INTO integration_events(workspace_id,issue_id,event,payload,destination,due_key)
        VALUES(subscription.workspace_id,issue.id,event_name,jsonb_build_object('issue_id',issue.id,'project_id',issue.project_id,'status_id',issue.status_id,'event',event_name,'due_date',issue.due_date),subscription.destination,deadline)
        ON CONFLICT DO NOTHING RETURNING id INTO event_id;
    IF event_id IS NOT NULL AND subscription.notify_assignee AND issue.assignee_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM personal_preferences WHERE user_id=issue.assignee_id AND NOT notify) THEN
        INSERT INTO notifications(recipient_id,type,payload) VALUES(issue.assignee_id,event_name,jsonb_build_object('issue_id',issue.id,'message',issue.title));
    END IF;
END;
$$;
CREATE FUNCTION record_issue_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP='INSERT' THEN PERFORM queue_issue_event(NEW,'issue.created');
    ELSIF OLD.status_id<>NEW.status_id THEN PERFORM queue_issue_event(NEW,'issue.status_changed'); END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER record_issue_event AFTER INSERT OR UPDATE OF status_id ON issues FOR EACH ROW EXECUTE FUNCTION record_issue_event();
ALTER TABLE projects ADD COLUMN form_overrides jsonb NOT NULL DEFAULT '{}';

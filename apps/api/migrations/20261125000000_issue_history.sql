CREATE TABLE issue_history (
    seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    issue_id uuid NOT NULL,
    sprint_id uuid,
    category text NOT NULL,
    archived boolean NOT NULL,
    observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    baseline boolean NOT NULL DEFAULT false
);
CREATE INDEX issue_history_lookup ON issue_history(project_id,issue_id,observed_at DESC,seq DESC);
INSERT INTO issue_history(project_id,issue_id,sprint_id,category,archived,baseline)
SELECT i.project_id,i.id,i.sprint_id,s.category,i.archived_at IS NOT NULL,true
FROM issues i JOIN issue_statuses s ON s.id=i.status_id;

CREATE FUNCTION observe_issue() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_notify('kanbrix_board',NEW.project_id::text);
    IF TG_OP='INSERT' OR (NEW.sprint_id,NEW.status_id,NEW.archived_at) IS DISTINCT FROM (OLD.sprint_id,OLD.status_id,OLD.archived_at) THEN
        INSERT INTO issue_history(project_id,issue_id,sprint_id,category,archived)
        SELECT NEW.project_id,NEW.id,NEW.sprint_id,s.category,NEW.archived_at IS NOT NULL FROM issue_statuses s WHERE s.id=NEW.status_id;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER observe_issue AFTER INSERT OR UPDATE ON issues FOR EACH ROW EXECUTE FUNCTION observe_issue();

CREATE FUNCTION observe_workflow() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_notify('kanbrix_board',NEW.project_id::text);
    IF NEW.category<>OLD.category THEN
        INSERT INTO issue_history(project_id,issue_id,sprint_id,category,archived)
        SELECT project_id,id,sprint_id,NEW.category,archived_at IS NOT NULL FROM issues WHERE status_id=NEW.id;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER observe_workflow AFTER UPDATE ON issue_statuses FOR EACH ROW EXECUTE FUNCTION observe_workflow();

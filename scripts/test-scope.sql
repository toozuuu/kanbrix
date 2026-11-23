BEGIN;
DO $$
DECLARE
    project uuid; status uuid; sprint uuid; stranger uuid; parent uuid;
    issue uuid := 'f0000000-0000-0000-0000-000000000001';
BEGIN
    INSERT INTO projects (workspace_id,name,project_key)
        VALUES ('b0000000-0000-0000-0000-000000000001','Second project','SCOPE') RETURNING id INTO project;
    INSERT INTO issue_statuses (project_id,name) VALUES (project,'Open') RETURNING id INTO status;
    INSERT INTO sprints (project_id,name) VALUES (project,'Iteration') RETURNING id INTO sprint;
    INSERT INTO users (name,email,password_hash) VALUES ('Fixture','scope@example.test','fixture') RETURNING id INTO stranger;
    INSERT INTO issues (project_id,issue_number,title,status_id,reporter_id)
        VALUES (project,1,'Other project',status,stranger) RETURNING id INTO parent;
    BEGIN
        UPDATE issues SET status_id = status WHERE id = issue;
        RAISE EXCEPTION 'Cross-project status accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    BEGIN
        UPDATE issues SET sprint_id = sprint WHERE id = issue;
        RAISE EXCEPTION 'Cross-project sprint accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    BEGIN
        UPDATE issues SET parent_issue_id = parent WHERE id = issue;
        RAISE EXCEPTION 'Cross-project parent accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    BEGIN
        UPDATE issues SET assignee_id = stranger WHERE id = issue;
        RAISE EXCEPTION 'Non-member assignee accepted';
    EXCEPTION WHEN check_violation THEN NULL; END;
END;
$$;
ROLLBACK;

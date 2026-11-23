-- Run after the standard demo seed. Changes are isolated to this transaction.
BEGIN;
DO $$
DECLARE
    ws uuid := 'b0000000-0000-0000-0000-000000000001';
    project uuid := 'c0000000-0000-0000-0000-000000000001';
    todo uuid := 'd0000000-0000-0000-0000-000000000002';
    progress uuid := 'd0000000-0000-0000-0000-000000000003';
    done uuid := 'd0000000-0000-0000-0000-000000000005';
    actor uuid := 'a0000000-0000-0000-0000-000000000001';
    ticket issues;
BEGIN
    INSERT INTO integration_settings(workspace_id,events,notify_assignee)
    VALUES(ws,ARRAY['issue.created','issue.status_changed','issue.due'],true);
    UPDATE projects SET transitions=jsonb_build_array(jsonb_build_array(todo,progress)) WHERE id=project;
    INSERT INTO issues(project_id,status_id,reporter_id,assignee_id,issue_number,title,custom_values)
        VALUES(project,todo,actor,actor,999,'Scope fixture','{"impact":"high"}') RETURNING * INTO ticket;
    UPDATE issues SET status_id=progress WHERE id=ticket.id;
    BEGIN
        UPDATE issues SET status_id=done WHERE id=ticket.id;
        RAISE EXCEPTION 'Disallowed transition accepted';
    EXCEPTION WHEN check_violation THEN NULL; END;
    PERFORM queue_issue_event(ticket,'issue.due',current_date);
    PERFORM queue_issue_event(ticket,'issue.due',current_date);
    IF (SELECT count(*) FROM integration_events WHERE workspace_id=ws AND issue_id=ticket.id) <> 3 THEN
        RAISE EXCEPTION 'Expected one event per trigger and deadline';
    END IF;
    IF (SELECT count(*) FROM notifications WHERE recipient_id=actor AND payload->>'issue_id'=ticket.id::text) <> 3 THEN
        RAISE EXCEPTION 'Unexpected notification count';
    END IF;
    INSERT INTO personal_preferences(user_id,notify) VALUES(actor,false);
    PERFORM queue_issue_event(ticket,'issue.due',current_date+1);
    IF (SELECT count(*) FROM notifications WHERE recipient_id=actor AND payload->>'issue_id'=ticket.id::text) <> 3 THEN
        RAISE EXCEPTION 'Notification opt-out ignored';
    END IF;
END;
$$;
ROLLBACK;

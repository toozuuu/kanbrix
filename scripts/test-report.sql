-- Exercise a complete, timestamped transition sequence within a disposable fixture.
BEGIN;
DO $$
DECLARE
    ticket uuid;
    project uuid:='c0000000-0000-0000-0000-000000000001';
BEGIN
    INSERT INTO issues(project_id,status_id,reporter_id,issue_number,title)
    VALUES(project,'d0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001',777,'History fixture') RETURNING id INTO ticket;
    UPDATE issues SET title='Updated title' WHERE id=ticket;
    UPDATE issues SET status_id='d0000000-0000-0000-0000-000000000003' WHERE id=ticket;
    UPDATE issues SET status_id='d0000000-0000-0000-0000-000000000005' WHERE id=ticket;
    IF (SELECT array_agg(category ORDER BY seq) FROM issue_history WHERE issue_id=ticket) <> ARRAY['Todo','InProgress','Done'] THEN
        RAISE EXCEPTION 'Incorrect issue history';
    END IF;
END;
$$;
ROLLBACK;

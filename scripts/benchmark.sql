-- CI uses a seeded disposable PostgreSQL database. Each run rolls back its fixture.
BEGIN;
INSERT INTO issues (project_id, issue_number, title, status_id, reporter_id, position, due_date)
SELECT p.id, n + 3, 'Benchmark issue ' || n, s.id, w.owner_id, n * 1000, current_date + (n % 30)
FROM projects p JOIN workspaces w ON w.id = p.workspace_id
JOIN issue_statuses s ON s.project_id = p.id AND s.category = 'Todo'
CROSS JOIN generate_series(1, :size) n
WHERE p.id = 'c0000000-0000-0000-0000-000000000001';
ANALYZE issues;
EXPLAIN (ANALYZE, BUFFERS) SELECT id, title FROM issues
WHERE project_id = 'c0000000-0000-0000-0000-000000000001' AND archived_at IS NULL
AND status_id = 'd0000000-0000-0000-0000-000000000002'
ORDER BY position, created_at, id LIMIT 51;
EXPLAIN (ANALYZE, BUFFERS) SELECT i.id FROM issues i JOIN issue_statuses s ON s.id = i.status_id
WHERE i.project_id = 'c0000000-0000-0000-0000-000000000001' AND i.archived_at IS NULL
AND s.category <> 'Done' AND i.due_date < current_date + 7
ORDER BY due_date, i.position, i.created_at, i.id LIMIT 20;
ROLLBACK;

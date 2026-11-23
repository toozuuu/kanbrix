-- Seed data for RustTrack local development
-- Admin password is: Password123!
-- Argon2id hash for 'Password123!'
-- $argon2id$v=19$m=19456,t=2,p=1$ZGV2c2FsdDEyMzQ1Njc4OQ$9Jg8k41hI/f48c90rJ7YJ3g2W1VqYvXz8bY6bY8bY8Y

INSERT INTO users (id, name, email, password_hash)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Admin User', 'admin@rusttrack.local', '$argon2id$v=19$m=19456,t=2,p=1$ZGV2c2FsdDEyMzQ1Njc4OQ$9Jg8k41hI/f48c90rJ7YJ3g2W1VqYvXz8bY6bY8bY8Y'),
    ('a0000000-0000-0000-0000-000000000002', 'Sarah Connor', 'sarah@rusttrack.local', '$argon2id$v=19$m=19456,t=2,p=1$ZGV2c2FsdDEyMzQ1Njc4OQ$9Jg8k41hI/f48c90rJ7YJ3g2W1VqYvXz8bY6bY8bY8Y')
ON CONFLICT (email) DO NOTHING;

INSERT INTO workspaces (id, name, slug, owner_id)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'Acme Engineering', 'acme', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Owner'),
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Member')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO projects (id, workspace_id, name, project_key, description, issue_counter)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Core Platform', 'CORE', 'Main infrastructure and API services', 3)
ON CONFLICT (workspace_id, project_key) DO NOTHING;

INSERT INTO issue_statuses (id, project_id, name, category, position)
VALUES
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Backlog', 'Backlog', 1000.0),
    ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'To Do', 'Todo', 2000.0),
    ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'In Progress', 'InProgress', 3000.0),
    ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'In Review', 'InReview', 4000.0),
    ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'Done', 'Done', 5000.0)
ON CONFLICT (project_id, name) DO NOTHING;

INSERT INTO sprints (id, project_id, name, goal, status)
VALUES
    ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Sprint 1 - Foundation', 'Complete core authentication and API endpoints', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO issues (id, project_id, issue_number, title, description, type, priority, status_id, assignee_id, reporter_id, sprint_id, position)
VALUES
    ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1, 'Setup PostgreSQL schema migrations', 'Define initial tables with full workspace isolation', 'Task', 'High', 'd0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1000.0),
    ('f0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 2, 'Implement interactive Kanban drag and drop', 'Add visual card movement with optimistic updates', 'Story', 'Urgent', 'd0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 2000.0),
    ('f0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 3, 'Create dark mode palette and contrast tests', 'Ensure WCAG AA compliance across dashboard and boards', 'Task', 'Medium', 'd0000000-0000-0000-0000-000000000002', NULL, 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 3000.0)
ON CONFLICT (project_id, issue_number) DO NOTHING;

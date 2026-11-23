# RustTrack Roadmap

## Jira Cloud company-managed software project compatibility

Kanbrix uses the documented behavior of Jira Cloud company-managed software projects as its compatibility target. The implementation uses Kanbrix's interface and API and is covered by the repository's AGPL license.

| Area | Kanbrix coverage | Remaining compatibility work |
| --- | --- | --- |
| Board filters | Current assignee and the rolling 24-hour update filter | Saved filters, board-level JQL, sub-filters, and administrator-managed custom filters |
| Board configuration | Workflow columns and issue ordering | Multi-project boards, swimlanes, column constraints, and card layout settings |
| Planning | Backlog and sprint lifecycle | Parallel sprint behavior, versions and releases, and epic planning |
| Administration | Workspace roles, configurable issue fields, and project workflows | Shared schemes, granular project permissions, workflow conditions, validators, and post-functions |
| Reporting and integrations | Project reports and API | Report comparisons against Jira fixtures, automation rules, Jira import, and integration compatibility |

Board filter acceptance checks cover a project with issues assigned to different users, timestamps on both sides of the rolling 24-hour cutoff, and enough issues to span multiple pages. The update filter must apply before pagination and work together with the existing assignee filter.

[Atlassian documentation for company-managed board quick filters](https://support.atlassian.com/jira-software-cloud/docs/configure-quick-filters/)

## Phase 1: Foundation (Completed)
- [x] Monorepo structure, Docker Compose, CI configuration
- [x] Rust Axum backend with structured logging, health checks, error models
- [x] React + Vite + TypeScript frontend with Tailwind CSS and Radix UI primitives
- [x] Comprehensive documentation suite

## Phase 2: Authentication & Workspaces (MVP)
- [x] Argon2id password hashing and secure session authentication
- [x] Workspaces, organization memberships, and role-based permissions (Owner, Admin, Member, Viewer)
- [x] Workspace invitations and switcher

## Phase 3: Projects & Issues (MVP)
- [x] Project creation, unique project keys (e.g., `APP`, `CORE`)
- [x] Atomic gapless issue numbering per project
- [x] Issue CRUD (Task, Bug, Story, Epic)
- [x] Issue details, markdown descriptions, comments, and activity logs

## Phase 4: Modern Kanban Board (MVP)
- [x] Multi-status workflow columns (Backlog, Todo, In Progress, In Review, Done)
- [x] Drag-and-drop issue cards with dnd-kit
- [x] Persistent server-side ordering
- [x] Fast filtering by assignee, priority, type, and search keyword

## Phase 5: Agile Sprints & Backlog (MVP)
- [x] Sprint creation, duration planning, and sprint goal definition
- [x] Active sprint board and backlog issue assignment
- [x] Sprint lifecycle transitions (Planned -> Active -> Completed)
- [x] Notification center and workspace-scoped full-text search

## Phase 6: Production Hardening
- [x] Integration testing across tenant boundaries
- [x] Rate limiting middleware and CSRF defenses
- [x] Docker multi-stage builds and Nginx deployment templates

## Phase 7: Future Extensions
- [ ] WebSocket-based live collaboration and cursor awareness
- [ ] GitHub / GitLab OAuth and PR commit linking
- [ ] S3-compatible attachment storage
- [ ] Advanced velocity and burndown reporting
- [ ] Custom workflow automation triggers

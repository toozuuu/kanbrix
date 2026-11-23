# RustTrack Roadmap

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

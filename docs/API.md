# RustTrack API Reference

All RustTrack API endpoints are versioned under `/api/v1`.
The API accepts and returns JSON with standard HTTP status codes.

## Authentication & Sessions

Session authentication is cookie-based using `rusttrack_session` with `HttpOnly`, `SameSite=Lax`, and `Secure` (in production).

### POST /api/v1/auth/register
Creates a new user account and sets session cookie.

**Request Body:**
```json
{
  "name": "Alex Mercer",
  "email": "alex@example.com",
  "password": "SecurePassword123!"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "name": "Alex Mercer",
    "email": "alex@example.com",
    "avatar_url": null,
    "created_at": "2026-11-23T12:00:00Z"
  }
}
```

### POST /api/v1/auth/login
Authenticates a user and sets session cookie.

**Request Body:**
```json
{
  "email": "alex@example.com",
  "password": "SecurePassword123!"
}
```

### POST /api/v1/auth/logout
Revokes the current session and clears the session cookie.

### GET /api/v1/auth/me
Returns current authenticated user details.

---

## Workspaces

### GET /api/v1/workspaces
Lists all workspaces the authenticated user belongs to.

### POST /api/v1/workspaces
Creates a new workspace with the current user as `Owner`.

**Request Body:**
```json
{
  "name": "Acme Corp",
  "slug": "acme"
}
```

### GET /api/v1/workspaces/{workspace_id}
Returns workspace details if the user is a member.

### PATCH /api/v1/workspaces/{workspace_id}
Updates workspace name or settings (Owner or Admin role required).

### GET /api/v1/workspaces/{workspace_id}/members
Lists all members and their roles (`Owner`, `Admin`, `Member`, `Viewer`).

### POST /api/v1/workspaces/{workspace_id}/invitations
Invites a new member by email (Owner or Admin role required).

---

## Projects

### GET /api/v1/workspaces/{workspace_id}/projects
Lists active projects in the workspace.

### POST /api/v1/workspaces/{workspace_id}/projects
Creates a new project and initializes default issue workflow statuses.

**Request Body:**
```json
{
  "name": "Customer Portal",
  "project_key": "CP",
  "description": "Next-generation customer self-service portal"
}
```

### GET /api/v1/projects/{project_id}
Fetches project details, statuses, and sprint summaries.

---

## Issues

### GET /api/v1/projects/{project_id}/issues
Fetches issues for a project with optional filters (`status_id`, `assignee_id`, `type`, `priority`, `sprint_id`, `search`).

### POST /api/v1/projects/{project_id}/issues
Creates a new issue. Atomically generates an issue number (e.g. `CP-1`).

**Request Body:**
```json
{
  "title": "Implement OAuth2 login with GitHub",
  "description": "Allow developers to sign in using GitHub credentials.",
  "type": "Story",
  "priority": "High",
  "status_id": "...",
  "assignee_id": null,
  "sprint_id": null,
  "due_date": "2026-12-01T00:00:00Z"
}
```

### GET /api/v1/issues/{issue_id}
Fetches detailed issue information, comments, and activity timeline.

### PATCH /api/v1/issues/{issue_id}
Updates issue properties (title, description, status, position, priority, assignee, sprint).

### POST /api/v1/issues/{issue_id}/reorder
Reorders issue on Kanban board by updating `status_id` and float `position`.

---

## Comments

### GET /api/v1/issues/{issue_id}/comments
Lists comments in chronological order.

### POST /api/v1/issues/{issue_id}/comments
Adds a comment to an issue.

---

## Sprints

### GET /api/v1/projects/{project_id}/sprints
Lists project sprints.

### POST /api/v1/projects/{project_id}/sprints
Creates a sprint (`planned`, `active`, `completed`).

### POST /api/v1/sprints/{sprint_id}/start
Starts a planned sprint.

### POST /api/v1/sprints/{sprint_id}/complete
Completes an active sprint and moves unfinished issues to the backlog or next sprint.

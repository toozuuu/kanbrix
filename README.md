# Kanbrix · Open-source Jira alternative

Kanbrix is a self-hosted issue tracker for software teams. Run it with Docker Compose to get drag-and-drop Kanban boards, a sprint backlog, and configurable workflows on your own infrastructure.

Kanbrix is an independent Jira alternative. The [roadmap](docs/ROADMAP.md) tracks compatibility with Jira Cloud company-managed software projects.

## What you can do

- Create tasks, bugs, stories, and epics with priorities, due dates, and comments.
- Drag issues between workflow columns. Filter the board by assignment, priority, issue type, overdue status, or updates in the last 24 hours.
- Plan sprints from the backlog and follow project completion on the dashboard.
- Manage workspace members and keep project data on your own infrastructure.

## Run locally

Install Git and Docker with Compose. Then clone Kanbrix and start the database, API, and web interface.

```sh
git clone https://github.com/toozuuu/kanbrix.git
cd kanbrix
docker compose up --build -d
```

Open [Kanbrix](http://localhost:5173). The API exposes a [readiness check](http://localhost:8080/ready) and [Swagger UI](http://localhost:8080/swagger-ui).

## Working with issues

Issue descriptions and comments support Markdown with a preview and a rich-text editor. Open an issue to attach files by dropping them into the attachments area or using the file chooser. Each file can be up to 10 MiB. Self-hosted installations should back up the uploads volume alongside PostgreSQL.

Press **C** to create an issue, **.** to open the command palette, and **L** in an open issue to assign it to yourself. Search the palette for an issue key across the current workspace or jump to a settings section. Boards automatically refresh when a teammate changes an issue.

The dashboard reports show up to 90 days of recorded workflow history, with a sprint selector for burndown. Lead time starts at issue creation and cycle time starts at the first In Progress transition. Both finish at first completion. Issues predating history collection contribute to flow counts and are excluded from timing averages.

English and Swedish are available for the core issue and navigation flows in personal preferences. Redis caches workspace and project metadata when available. With the API running locally, run `npm run generate:api` in `apps/web` to refresh frontend types from the published OpenAPI document. Run `npm test` there for component and live-board hook tests.

## Configuring an organization

Sign in as the workspace owner and open **Settings**. Changes to branding, calendars, issue forms, roles and templates start as a draft. Review the affected settings and publish a revision. History supports exporting JSON, importing a draft, and restoring an earlier revision. Restoring creates a new revision. Existing project workflows and issue data have independent lifecycles.

For a support desk, add a Ticket type and a Customer impact field in **Issue forms**. Mark the field required for Ticket. In **Templates**, add a Support template with Triage and Resolved columns, assign Resolved to the Done category, and disable sprints. Choose Support when creating a project. To adapt an existing project, preview its workflow, choose destinations for any removed columns with issues, and publish. Required organization fields stay visible when project form overrides are enabled.

Project workflow delegation requires both the organization delegation switch and an individual member assignment. Owners control role restrictions. The issue type and priority lists use their stored text values. Changing those lists affects future selections and preserves the text on existing issues. Custom fields use IDs, and select options support separate display labels.

**Integration events** support issue creation, status changes and deadlines within the next 24 hours. Configure the events and assignee notifications under Settings. A workspace administrator can issue or revoke a read-only bearer token for the workspace event feed. Page through the feed with the last received event ID in the `after` query parameter.

For outbound delivery, the installation operator supplies `KANBRIX_WEBHOOK_DESTINATIONS` as a JSON object keyed by workspace UUID. Each workspace maps a destination name to an HTTPS URL and an optional bearer token. For example:

```json
{
  "00000000-0000-4000-8000-000000000001": {
    "team-events": { "url": "https://events.example.org/kanbrix" }
  }
}
```

Restart the API after changing the environment. Workspace admins can then select their destination by name. Delivery is asynchronous. Receivers should deduplicate the `X-Kanbrix-Event-Id` header. Failed deliveries can be retried from the recent-events list after five attempts. Organization configuration exports omit destinations, tokens, issue data and individual project permissions.

For local installation, VPS setup, HTTPS, backups, restore, upgrades, and troubleshooting, see the [self-hosting guide](docs/DEPLOYMENT.md).

## Syncing from Jira, GitHub, Linear & Git Webhooks

- **External Sync & Import**: Under **Settings → Integrations**, workspace admins can fetch and preview up to 500 tickets from **Jira** (Cloud REST v3 or Server/DC v2), **GitHub Issues**, **Linear**, or **CSV/JSON** exports, map external statuses to Kanbrix workflow columns, and import or re-sync without duplicates (deduplicated by `external_id`). You can also export any project's issues to CSV or JSON, or click **Load sample project** on **Projects** to seed a demo project in seconds.
- **Git PR Auto-Linking**: Point a GitHub or GitLab webhook at `POST /api/v1/workspaces/{workspace_id}/integrations/git-webhook` with `Authorization: Bearer <integration_feed_token>`. Issue keys like `CORE-12` in PR titles or commit messages automatically post a link comment and transition the issue (`opened` → `InReview`, `merged` → `Done`).

## Production deployment

Set `SITE_URL` to the public HTTPS origin and `POSTGRES_PASSWORD` to a randomly generated URL-safe secret in the deployment environment. Put the web service behind a TLS reverse proxy that forwards to `127.0.0.1:5173`, then start the production stack.

```sh
docker compose -f docker-compose.production.yml up --build -d
```

 The production configuration uses separate volumes, secure cookies, a private API and database, and starts with an empty workspace database. The first user can register from the web UI. Apply per-client request limits at the TLS proxy when it shares a single source address with Nginx.

CI checks a fresh local deployment and restores its PostgreSQL dump into a separate database. Back up the uploads volume separately when using local attachment storage. To compare board and deadline query plans on a disposable seeded database, run `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v size=1000 -f scripts/benchmark.sql`. The fixture rolls back after reporting the plans.

For a public site, set `SITE_URL` to its full HTTPS origin in your Compose environment or root `.env` file before building the web image. The build uses that origin for the homepage canonical URL and sitemap. The public landing page is rendered to HTML at build time. Account and workspace routes carry a noindex directive.

## Architecture and development

The Rust modular monolith lives in `apps/api`, with Axum routes and SQLx migrations. The Vite frontend lives in `apps/web`. Dockerfiles and the Nginx configuration live in `deploy`.

- [Architecture](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Contributing](CONTRIBUTING.md)

## Checks

Run `cargo test` from the workspace root with a migrated PostgreSQL database configured for SQLx. Run the frontend checks from the repository root.

```sh
cd apps/web
npm ci
npm run lint
npm test
npm run build
```

## License

Kanbrix is available under the [GNU Affero General Public License, version 3 or later](LICENSE).

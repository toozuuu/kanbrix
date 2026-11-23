# RustTrack 🦀⚡

> A fast, modern, self-hosted, open-source project and issue tracking platform powered by Rust and React.

RustTrack combines the speed and responsiveness of modern developer workflows with flexible project structures: workspaces, projects, multi-status workflows, Kanban boards with real-time manual ordering, sprint planning, and secure multi-tenant isolation.

---

## 🚀 Key Highlights

- **Backend**: Axum, Tokio, SQLx (PostgreSQL), Argon2id password hashing, server-side session authentication with secure cookies, structured tracing, and OpenAPI documentation.
- **Frontend**: React 18+, TypeScript, Vite, Tailwind CSS, accessible UI components, TanStack Query, React Hook Form + Zod, dnd-kit for Kanban drag-and-drop, and Lucide icons.
- **Security**: Workspace-level tenant isolation enforced on every query, argon2id hashing, secure session tokens, rate limiting, and parameterised SQLx queries.
- **Deployment**: Single command with Docker Compose, minimal resource usage, native binary compilation.

---

## 🏛️ System Architecture

RustTrack is designed as a **modular monolith** with clear domain boundaries:

```
rusttrack/
├── apps/
│   ├── api/                 # Rust Axum modular monolith API
│   │   ├── migrations/      # SQLx version-controlled migrations
│   │   └── src/
│   │       ├── common/      # Shared state, errors, auth middleware, pagination
│   │       ├── domain/      # Domain modules: auth, workspaces, projects, issues...
│   │       ├── config.rs    # Application configuration
│   │       ├── routes.rs    # Unified API routing table (/api/v1)
│   │       └── main.rs      # Server entrypoint and graceful shutdown
│   └── web/                 # React + TypeScript + Vite frontend
│       └── src/
│           ├── components/  # Kanban, Sprints, UI primitives, Layout
│           ├── context/     # Auth, Workspace, and Theme providers
│           ├── hooks/       # TanStack Query custom hooks
│           ├── lib/         # API client & helpers
│           └── pages/       # Dashboard, Kanban, Backlog, Issues, Settings
├── deploy/                  # Production Dockerfiles and reverse proxy configurations
├── docs/                    # Architecture, API, and Deployment documentation
└── docker-compose.yml       # Local development and self-hosted orchestration
```

---

## 🛠️ Quick Start (Local Development)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [Node.js](https://nodejs.org/) v18+ & npm / pnpm
- [Rust](https://rustup.rs/) stable (1.75+)

### 1. Clone & Setup Environment

```bash
# Clone the repository
git clone https://github.com/your-org/rusttrack.git
cd rusttrack

# Copy environment variables
cp .env.example .env
```

### 2. Start Database with Docker Compose

```bash
docker compose up -d postgres
```

The database will be accessible at `localhost:5432` with user `postgres` and database `rusttrack`.

### 3. Run the Backend API

```bash
cd apps/api
cargo run
```

The API starts on `http://localhost:8080`.
OpenAPI documentation is available at `http://localhost:8080/swagger-ui`.

### 4. Run the Web Application

```bash
cd apps/web
npm install
npm run dev
```

The web interface is available at `http://localhost:5173`.

---

## 🧪 Testing & Verification

```bash
# Run backend tests
cd apps/api
cargo test

# Run frontend tests & linting
cd apps/web
npm run lint
npm run build
```

---

## 📜 License

RustTrack is licensed under the [GNU Affero General Public License v3.0](LICENSE).

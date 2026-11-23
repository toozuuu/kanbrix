# Changelog

All notable changes to RustTrack will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-23

### Added
- Modular monolith backend architecture using Axum and Tokio.
- Database schema and migrations covering workspaces, projects, issues, comments, sprints, and activity logs.
- Multi-tenant workspace isolation on all database queries.
- Argon2id password hashing and server-side session authentication with secure cookies.
- React + TypeScript + Vite frontend with Tailwind CSS and accessible component library.
- Interactive Kanban board with drag-and-drop support and persistent ordering.
- Issue management (Task, Bug, Story, Epic) with status transitions and comments.
- Sprint planning and backlog management.
- Workspace switcher, project directory, and responsive modern dashboard.
- Docker Compose configuration for development and deployment.
- Complete documentation suite and GitHub Actions CI workflow.

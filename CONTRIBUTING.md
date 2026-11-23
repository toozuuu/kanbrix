# Contributing to RustTrack

Thank you for your interest in contributing to RustTrack! We welcome contributions of all kinds: code, documentation, bug reports, and UX feedback.

## Code of Conduct

All contributors are expected to uphold respectful, inclusive, and professional communication as outlined in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Development Setup

1. Fork and clone the repository.
2. Ensure you have Rust (stable), Node.js (v18+), and Docker installed.
3. Start the PostgreSQL instance: `docker compose up -d postgres`.
4. Run migrations and start the backend: `cd apps/api && cargo run`.
5. Start the frontend: `cd apps/web && npm install && npm run dev`.

## Pull Request Guidelines

- Ensure code passes `cargo clippy`, `cargo fmt --check`, and `cargo test`.
- Ensure frontend passes `npm run lint` and `npm run build`.
- Maintain test coverage for new endpoints, domain logic, and components.
- Keep commits descriptive and atomic.

# Contributing to Kanbrix

Thank you for your interest in contributing to Kanbrix! We welcome contributions of all kinds: code, documentation, bug reports, and UX feedback.

## Code of Conduct

All contributors are expected to uphold respectful, inclusive, and professional communication as outlined in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Development Setup

1. Fork [Kanbrix](https://github.com/toozuuu/kanbrix), clone your fork, and create a branch for your change.
2. Follow the [development guide](docs/DEVELOPMENT.md) to start PostgreSQL, the Rust API, and the web app. The frontend CI uses Node.js 20.
3. Open a pull request that describes the change and how you verified it. Include screenshots for visible UI changes.

Report ordinary bugs through [GitHub Issues](https://github.com/toozuuu/kanbrix/issues). Follow the [security policy](SECURITY.md) for vulnerability reports.

## Pull Request Guidelines

- Ensure code passes `cargo clippy`, `cargo fmt --check`, and `cargo test`.
- Ensure frontend passes `npm run lint`, `npm test`, and `npm run build`.
- Maintain test coverage for new endpoints, domain logic, and components.
- Keep commits descriptive and atomic.

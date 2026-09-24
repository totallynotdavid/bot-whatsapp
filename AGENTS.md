# Agent notes

- Most code needs no comment. A comment states a fact that names and structure cannot: an invariant, an external API's behavior, or a non-obvious decision. Explanations that need the general picture belong in [docs/](docs/readme.md), not in code comments.
- Layering rules: domain and application import nothing from infrastructure. process.env is read only under src/config/. See [architecture.md](docs/architecture.md).
- Tests live under `tests/`, written with `vitest` (`bun run test`). Static checks verify layering rules.
- Format and lint with `oxfmt` and `oxlint` (`bun run format`, `bun run lint`).
- Setup, configuration, commands, deployment, and architecture are documented in [docs/](docs/readme.md).

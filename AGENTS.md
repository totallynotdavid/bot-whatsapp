# Agent notes

- Most code needs no comment. A comment states a fact that names and structure
  cannot: an invariant, an external API's constraint, or a non-obvious decision.
  Explanations that need the general picture belong in [docs/](docs/README.md), not in code comments.
- Tests live under `tests/`, written with `vitest` (`bun run test`).
- Format and lint with `oxfmt` and `oxlint` (`bun run format`, `bun run lint`).
- Setup, configuration, commands and deployment are documented in
  [docs/](docs/README.md).

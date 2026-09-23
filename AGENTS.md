# Agent notes

- Comments state a current invariant beside the code they govern: why this
  shape is correct, a constraint an external API imposes, a non-obvious
  edge case. They never narrate control flow, and never describe history,
  provenance, or how the code got here.
- Tests live under `tests/`, written with `vitest` (`bun --bun vitest run`).
  There is no `demo/` folder.
- Format and lint with `oxfmt` and `oxlint` (`bun run format`,
  `bun run lint`), not biome.

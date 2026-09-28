# Agent notes

This repo is a bun workspace: `apps/whatsapp-bot` holds the bot,
`packages/whatsapp*` hold the WhatsApp transport contract and its adapters. See
the [root readme](readme.md#workspace-layout).

- Most code needs no comment. A comment states a fact that names and structure
  cannot: an invariant, an external API's behavior, or a non-obvious decision.
  Explanations that need the general picture belong in
  [docs/](apps/whatsapp-bot/docs/readme.md), not in code comments.
- Layering rules for `apps/whatsapp-bot`: domain and application import nothing
  from infrastructure. process.env is read only under src/config/. See
  [architecture.md](apps/whatsapp-bot/docs/architecture.md).
- Tests live under each package's `tests/`, written with `vitest`
  (`bun run test` from the repo root). Static checks in
  `apps/whatsapp-bot/tests/static/` verify the layering rules.
- Format and lint the whole workspace with `oxfmt` and `oxlint`
  (`bun run format`, `bun run lint`, both from the repo root). `mise run check`
  runs typecheck, lint and tests together.
- Setup, configuration, commands, deployment, and architecture are documented in
  [docs/](apps/whatsapp-bot/docs/readme.md).

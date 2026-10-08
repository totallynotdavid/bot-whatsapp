# Agent notes

This repo is a bun workspace: `apps/whatsapp-bot` and `apps/sumibot` hold the
bots, `packages/whatsapp*` hold the WhatsApp transport contract and its
adapters. See the [readme](readme.md#workspace-layout).

- Most code needs no comment. A comment states a fact that names and structure
  cannot: an invariant, an external API's behavior, or a non-obvious decision.
  Explanations that need the general picture belong in the
  [manual](apps/whatsapp-bot/docs/readme.md), not in code comments.
- The layering rules for both apps are in
  [architecture.md](apps/whatsapp-bot/docs/architecture.md). Tests in
  `tests/static/` enforce them.
- Run tests with `bun run test`, never `bun test`. Bun's own runner fails on
  these vitest files.
- Format, lint and check commands are in
  [contributing.md](.github/contributing.md).

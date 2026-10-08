# Architecture

This is the code map of `apps/whatsapp-bot`. `apps/sumibot` follows the same
layers and rules. The transport packages in `packages/` are shared by both apps.
[Contributing](../../../.github/contributing.md) covers how to change the code.

Three rules hold across the code. Tests in `tests/static/` fail when one breaks.

- `src/domain/` and `src/application/` import nothing from
  `src/infrastructure/`.
- `process.env` is read only under `src/config/`. Everything else receives
  validated config.
- Only `src/bootstrap/container.ts` names a transport package
  (`@bot-whatsapp/whatsapp-wwebjs`, `@bot-whatsapp/whatsapp-baileys`). Nothing
  imports a WhatsApp library directly.

## Layers

| Directory                | Holds                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `src/domain/`            | Types and pure rules: users and ranks, commands, messages, job payloads.                                                 |
| `src/application/`       | Commands, the command executor, the message handler and the ports they depend on.                                        |
| `src/application/ports/` | Interfaces for everything outside the process except WhatsApp: storage, caches, queues, APIs.                            |
| `src/infrastructure/`    | Adapters that implement the ports: Supabase, Redis, BullMQ, Spotify, Anna's Archive, Imgur, Amazon Polly, ffmpeg, Typst. |
| `src/presentation/`      | Turns a command result into a WhatsApp reply.                                                                            |
| `src/bootstrap/`         | `container.ts` builds and wires everything, including picking a WhatsApp transport. `lifecycle.ts` starts and stops it.  |
| `src/config/`            | Reads the environment and validates it with zod.                                                                         |
| `src/i18n/`              | Every reply text the bot sends, in Spanish.                                                                              |
| `src/lib/`               | Logging and resilience helpers (retry, timeout, circuit breaker).                                                        |

[How it works](how-it-works.md) follows a message through these layers.

## WhatsApp transport

The app depends only on the `WhatsAppTransport` contract from
`@bot-whatsapp/whatsapp` (`packages/whatsapp/src/index.ts`). It extends
`MessageSender` with `connect`, `disconnect`, `onMessage`, `onClose` and
`stopReceiving`. Two packages implement it, each against its own library:

| Package                     | Library                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `packages/whatsapp-wwebjs`  | [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) |
| `packages/whatsapp-baileys` | [Baileys](https://github.com/WhiskeySockets/Baileys)              |

`createTransport(config)` in `src/bootstrap/container.ts` reads
`config.WHATSAPP_TRANSPORT` ([configuration](configuration.md)) and returns one
of them. One contract test suite (`packages/whatsapp/src/testing.ts`) runs
against each adapter with its library faked.

`src/bootstrap/lifecycle.ts` registers the `onMessage` and `onClose` handlers
before it calls `connect()`, so nothing can arrive before something is
listening. What `onClose` triggers is in
[How it works](how-it-works.md#shutdown).

### Baileys message store

Baileys cannot look a message up by id, unlike whatsapp-web.js's
`getMessageById`. Reacting to, quoting or downloading media from a message needs
the adapter's own record of it. `packages/whatsapp-baileys/src/message-store.ts`
holds that record.

- It is an in-memory map from message id to `WAMessage`, capped at 2000 entries.
  The oldest entry goes first.
- `BaileysReceiver` writes to it. `BaileysSender` reads it.
- `BaileysReceiver` records every message in a live `notify` batch of
  `messages.upsert`, including the bot's own. History-sync batches are not
  recorded.
- A reply carries the message it quotes. The receiver records that message under
  its own id with `recordIfAbsent`, which never replaces an entry already there.
  A quoted message that arrived live keeps its full record.
- Nothing is persisted. After a restart the store is empty, so reactions, quotes
  and downloads miss until a message is seen again.

## Ports

A port is an interface in `src/application/ports/`, named for what the
application needs: `GroupStore`, `UserStore`, `TempStore`, `SearchCache`,
`JobScheduler`, `BookCatalog`, `TrackSearch`, `ImageHost`, `ImageEffects`,
`MediaConverter`, `TextToSpeech`, `LatexRenderer`. `MessageSender` is a port
too, but it lives in `@bot-whatsapp/whatsapp` with `WhatsAppTransport` because
the app and every transport adapter reference it.

Infrastructure implements each port. `TypstLatexRenderer`
(`src/infrastructure/latex/`) implements `LatexRenderer`. It compiles LaTeX to a
PNG with the Typst compiler and a vendored copy of the `mitex` Typst package
([`vendor/`](../src/infrastructure/latex/vendor/readme.md)). Both run through
native bindings that `bun install` installs, in the bot's own process. The
renderer escapes the input into one `mi("...")` call, and `\input` is rejected
as an unknown command (`tests/typst-latex-renderer.test.ts`).

Tests fake the database, not the repositories: the real repositories run over
`FakePostgres` (`tests/fixtures.ts`).

## CommandDeps

`src/application/command-deps.ts` lists every dependency a command can use.
`createCommands` in `src/application/commands/index.ts` gives that object to
each command. A command types its constructor with only what it uses, for
example `Pick<CommandDeps, "sender">`.

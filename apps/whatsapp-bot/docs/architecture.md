# Architecture

This app lives in a bun workspace alongside the WhatsApp transport packages it
depends on. See the [root readme](../../../readme.md) for the workspace layout;
this page covers the app itself.

Two rules hold across the code. Tests in `tests/static/` fail when either
breaks.

- `src/domain/` and `src/application/` import nothing from
  `src/infrastructure/`.
- `process.env` is read only under `src/config/`. Everything else receives
  validated config.

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

## WhatsApp transport

The app never imports a WhatsApp library directly. It depends only on the
`WhatsAppTransport` contract from `@bot-whatsapp/whatsapp` (a workspace package,
see the [root readme](../../../readme.md#workspace-layout)), which extends
`MessageSender` with `connect`, `disconnect`, `onMessage` and `stopReceiving`.

`src/bootstrap/container.ts` is the only file that names a transport package.
Its `createTransport(config)` reads `config.WHATSAPP_TRANSPORT` and returns
either `createWwebjsTransport()` from `@bot-whatsapp/whatsapp-wwebjs` or
`createBaileysTransport()` from `@bot-whatsapp/whatsapp-baileys`. Both packages
implement the same contract against their own library, verified by one shared
contract test suite (`packages/whatsapp/src/testing.ts`) that runs against each
adapter with its library faked. See [configuration.md](configuration.md) for the
`WHATSAPP_TRANSPORT` setting.

`src/bootstrap/lifecycle.ts` registers the `onMessage` handler before calling
`connect()`, so no message can arrive before anything is listening for it.

## Ports

A port is an interface in `src/application/ports/`, named for what the
application needs: `GroupStore`, `UserStore`, `TempStore`, `SearchCache`,
`JobScheduler`, `BookCatalog`, `TrackSearch`, `ImageHost`, `ImageEffects`,
`MediaConverter`, `TextToSpeech`, `LatexRenderer`. `MessageSender` is a port
too, but it lives in `@bot-whatsapp/whatsapp` alongside `WhatsAppTransport`
rather than in `src/application/ports/`, since both the app and every transport
adapter need to reference it.

Infrastructure implements each one. For example, `WwebjsSender` and
`BaileysSender` (in their respective transport packages) both implement
`MessageSender`. Tests fake the database, not the repositories: the real
repositories run over `FakePostgres` (`tests/fixtures.ts`).

`TypstLatexRenderer` (`src/infrastructure/latex/`) implements `LatexRenderer` by
compiling LaTeX to a PNG with the Typst compiler and a vendored copy of the
`mitex` Typst package (`src/infrastructure/latex/vendor/`, see its `README.md`).
Both run through native bindings installed by `bun install`; a render never
shells out, hits the network, or reads a file the caller did not name.

## CommandDeps

`src/application/command-deps.ts` lists every dependency a command can use.
`createCommands` in `src/application/commands/index.ts` gives that object to
each command. A command types its constructor with only what it uses, for
example `Pick<CommandDeps, "sender">`, so its tests build only those.

## Add a command

1. Create `src/application/commands/my-command.ts` that extends `BaseCommand`.
2. Add `new MyCommand(deps)` to the list in `createCommands`.

If the command needs a dependency that does not exist, add a port in
`src/application/ports/`, implement it in `src/infrastructure/`, and add it to
`CommandDeps` and `container.ts`.

Set `minRank` in the command's metadata. A command with `minRank: Rank.REGULAR`
answers in a group only when the group is registered and active. Set
`requiresActiveGroup: false` to skip that check, as `/kick` and `/subscription`
do.

## Add a job

Jobs run heavy work in a queue. See [How it works](how-it-works.md) for the
pipeline. A job is one definition in `src/infrastructure/queue/jobs/` plus a
payload schema and a name in `src/domain/job.ts`. The definition sets the
worker's concurrency, timeout and attempts.

# Contributing

This covers how to set up the workspace, check a change and add a command or a
job. [Architecture](../apps/whatsapp-bot/docs/architecture.md) is the code map.

## Set up

```bash
git clone https://github.com/totallynotdavid/bot-whatsapp
cd bot-whatsapp
mise install
mise run install
```

`mise install` installs Bun, ffmpeg and the other tools at the versions in
`mise.toml`. Some tests convert real media with ffmpeg.

## Check a change

Run these from the repo root. They cover every app and package.

| Command              | Description                                               |
| -------------------- | --------------------------------------------------------- |
| `mise run install`   | Installs from `bun.lock` without resolving.               |
| `mise run fix`       | Applies safe oxlint fixes and formats with oxfmt.         |
| `mise run lint`      | Checks oxlint (warnings are errors) and oxfmt. No writes. |
| `mise run typecheck` | Runs `tsc --noEmit` in every package.                     |
| `mise run test`      | Runs the tests with vitest.                               |
| `mise run check`     | Runs lint, typecheck and test. No writes.                 |

Use `mise run test`. `bun test` is Bun's own runner and fails on these files.

CI runs on pull requests and on pushes to `master`, on Linux
([`ci.yml`](workflows/ci.yml)). It runs `mise run install`, then
`mise run check`.

## Tests

Tests live in each package's `tests/`. The bots' tests use fakes for the ports
and run the real repositories over `FakePostgres` (`tests/fixtures.ts`). They
need no Redis, Chrome or WhatsApp session. Nothing in the suite talks to the
WhatsApp session, BullMQ over a real Redis, Chromium, Spotify, Anna's Archive or
Imgur.

The transport packages carry contract tests that fake the underlying library at
its boundary. See
[architecture.md](../apps/whatsapp-bot/docs/architecture.md#whatsapp-transport).

## Add a command

1. Create `apps/whatsapp-bot/src/application/commands/my-command.ts`:

   ```typescript
   import { BaseCommand } from "./base-command";
   import type { CommandContext, CommandResult } from "../../domain/command";
   import { Rank } from "../../domain/user";

   export class MyCommand extends BaseCommand {
     readonly metadata = {
       name: "mycommand",
       aliases: [],
       minRank: Rank.REGULAR,
       description: "Saluda al usuario",
       usage: "mycommand",
     };

     async execute(context: CommandContext): Promise<CommandResult> {
       return { type: "text", content: `Hola, ${context.user.name}` };
     }
   }
   ```

2. Add `new MyCommand()` to the list in `createCommands`
   (`apps/whatsapp-bot/src/application/commands/index.ts`).
3. Write a test in `apps/whatsapp-bot/tests/my-command.test.ts`.
4. Run `mise run check`.

A command that needs a dependency takes it in its constructor, typed with only
what it uses, for example `Pick<CommandDeps, "sender">`, so its test builds only
that. `createCommands` passes the whole `deps` object (`new SayCommand(deps)`).
If the dependency does not exist, add a port in `src/application/ports/`,
implement it in `src/infrastructure/`, and add it to `CommandDeps`
(`src/application/command-deps.ts`) and to `src/bootstrap/container.ts`.

Set `minRank` in the metadata. A command with `minRank: Rank.REGULAR` answers in
a group only when the group is registered and active. Set
`requiresActiveGroup: false` to skip that check, as `/kick` and `/subscription`
do. Reply texts live in `src/i18n/es.ts`.

## Add a job

Use a job for work that takes longer than a reply should wait. A job is one
definition in `src/infrastructure/queue/jobs/`, a payload schema and a name in
`src/domain/job.ts`, and an entry in the `JobQueues` call in
`src/bootstrap/container.ts`. The definition sets the worker's concurrency,
timeout and attempts.
[How it works](../apps/whatsapp-bot/docs/how-it-works.md#jobs) describes the
pipeline. `SpotifyCommand` and `spotifyJob` are a short example.

## Debug

Logs are JSON lines on stdout, with timestamp and level. From
`apps/whatsapp-bot`:

```bash
LOG_LEVEL=debug bun start
```

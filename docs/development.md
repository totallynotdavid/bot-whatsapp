# Development

## Tests

Tests run on Vitest, through the project script. `bun test` is Bun's own runner and fails on
these files.

```bash
bun run test
```

Tests live in `tests/`. They use fakes for ports, and the real repositories over `FakePostgres`
(`tests/fixtures.ts`). They need no Redis, Chrome or WhatsApp session, so nothing tests those live: the WhatsApp
session, BullMQ over a real Redis, Chromium, Spotify, Anna's Archive and Imgur.

## Static checks

Three checks run before push. Tests also verify layering: domain and application import nothing from infrastructure, and process.env is read only under `src/config/`.

```bash
bun run format    # oxfmt on src/ and tests/
bun run lint      # oxlint (warnings are errors)
bun run typecheck # tsc --noEmit
```

All three required before push.

## Flow

1. Start `bun start`. Bun loads `.env` automatically.
2. Scan the QR with WhatsApp.
3. Test commands in a chat.
4. Watch logs in the terminal.

To clean session during development:
```bash
bun run clean:session:dev
```

## Add a command

1. Create `src/application/commands/my-command.ts`:
   ```typescript
   import { BaseCommand } from "./base-command";
   import type { CommandMetadata, CommandContext, CommandResult } from "../../domain/command";
   import { Rank } from "../../domain/user";

   export class MyCommand extends BaseCommand {
     readonly metadata: CommandMetadata = {
       name: "mycommand",
       aliases: [],
       minRank: Rank.REGULAR,
       description: "Does something",
       usage: "mycommand",
       isHeavyOperation: false,
     };

     async execute(context: CommandContext): Promise<CommandResult> {
       return { type: "text", content: "Hello!" };
     }
   }
   ```

2. Register in `src/application/commands/index.ts` in the `createCommands()` function:
   ```typescript
   new MyCommand(deps),
   ```

3. If heavy (long-running), use `JobScheduler`. See `SpotifyCommand` as an example.

4. Write a test in `tests/my-command.test.ts` (optional but recommended).

5. Run tests and checks: `bun run test && bun run lint && bun run format`.

## Debug

JSON logs with timestamp and level:

```bash
LOG_LEVEL=debug bun start
```

Logs go to stdout. Use pipes or redirection to save.

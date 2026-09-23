# Instructions for agents

## Purpose

A modular WhatsApp bot implemented in TypeScript using Bun/Node and whatsapp-web.js. Core features include stickers, Spotify previews, document downloads (Anna's Archive), Google Drive integration, and paid-user commands.

## Core values:

- Performance
- Scalability
- Maintainability
- Code as documentation (explicit names, minimal comments, no cleverness)
- Simplicity (functions do one thing; architecture "dumb but scalable")
- Explicit code structure over clever abstractions

- **Big Picture Architecture** (why & how)
  - Entry point: [src/main.ts](src/main.ts) — loads config, builds DI container and starts the app lifecycle.
  - Dependency Injection: [src/bootstrap/container.ts](src/bootstrap/container.ts) constructs a `Container` object and registers core services. New features should be hooked into the container.
  - Lifecycle: [src/bootstrap/lifecycle.ts](src/bootstrap/lifecycle.ts) — starts circuit cleanup, queue worker, and WhatsApp message handler; defines graceful shutdown.
  - Message flow: Incoming messages are received by `WhatsAppReceiver` -> normalized into `Message` -> passed to `MessageProcessor` -> `CommandExecutor` routes to registered `CommandHandler`.
  - Heavy/Async work: `JobScheduler` pushes tasks to a BullMQ queue (`QueueClient`) and `JobHandler` delegates to processors under `src/infrastructure/queue/processors` (sticker, spotify, docs); results are sent with `WhatsAppSender`.

## Important files/dirs to inspect
- Core wiring: [src/bootstrap/container.ts](src/bootstrap/container.ts)
- App lifecycle: [src/bootstrap/lifecycle.ts](src/bootstrap/lifecycle.ts)
- Commands: [src/application/commands](src/application/commands) (extend `BaseCommand`)
- Command execution: [src/application/services/command-executor.ts](src/application/services/command-executor.ts)
- Message handling: [src/application/handlers/message-handler.ts](src/application/handlers/message-handler.ts)
- Job scheduling / processing: [src/application/services/job-scheduler.ts](src/application/services/job-scheduler.ts) and [src/application/handlers/job-handler.ts](src/application/handlers/job-handler.ts)
- WhatsApp integration: [src/infrastructure/whatsapp](src/infrastructure/whatsapp)
- External APIs: [src/infrastructure/external/*](src/infrastructure/external)
- Database + Cache: [src/infrastructure/database](src/infrastructure/database)
- Resilience: [src/lib/resilience/*](src/lib/resilience)
- Config & env validation: [src/config/schema.ts](src/config/schema.ts)

## Patterns & conventions
- Dependency injection: Instantiate objects only through `buildContainer()` for app runs (tests can mock individual clients). Do not globally `new` clients when container exists.
- Commands: Create a command by extending `BaseCommand` ([src/application/commands/base-command.ts](src/application/commands/base-command.ts)). Provide `metadata` with name, aliases, `minRank`, `isHeavyOperation` and implement `executeImpl(context)` returning `CommandResult`.
- Register commands: Add to the container’s `registerCommands(...)` helper in [src/bootstrap/container.ts](src/bootstrap/container.ts); this is how `CommandExecutor` finds commands.
- Command results: Use typed `CommandResult` values: `text`, `media`, `sticker`, `queued`, `error`, `none`. The `ResponseBuilder` handles mapping to WhatsApp calls.
- Heavy operations: For media-heavy or long-running tasks, schedule a job using `JobScheduler` (e.g., `scheduleStickerJob`) rather than executing inline. Always return `queued` to user.
- External calls resilience: Use `retry`, `withTimeout`, and `executeWithCircuitBreaker` helpers in `src/lib/resilience` to wrap all external network calls.
- Timeouts & constants: Use timeouts/limits from [src/config/constants.ts](src/config/constants.ts) instead of inline constants.
- Temporary files: Use `TempFileStore` and schedule cleanup after sending results (see `JobHandler.scheduleCleanup`) to avoid leaking temporary artifacts.

## Data flows (where to focus changes)
- Message -> processing: `WhatsAppReceiver` normalizes the inbound message into the domain `Message` shape and calls `MessageProcessor.process()` which handles ack, delegates to `CommandExecutor`, and then uses `ResponseBuilder` to reply. If you need to add handling for inbound content, update `WhatsAppReceiver` and `MessageProcessor`.
- Command execution -> side effects: `CommandExecutor` routes to `CommandHandler` instances (in `src/application/commands`). Command implementations operate in `executeImpl(context)` and should return a `CommandResult`. For heavy operations, return a `queued` result and schedule jobs via `JobScheduler`.
- Job flow: `JobScheduler` enqueues job types through `QueueClient`, the boomrq worker (started in `bootstrap/lifecycle.ts`) delegates to `JobHandler.processJob()`, which routes jobs to the appropriate `Processor` in `src/infrastructure/queue/processors` and then uses `WhatsAppSender` and `TempFileStore` to send and cleanup.
- External API flow: Add clients under `src/infrastructure/external`. They should use `retry`, `withTimeout`, and `executeWithCircuitBreaker` patterns and be registered into the DI container in `buildContainer()`.
- Storage -> DB/Cache: Use `UserRepository` and `CacheRepository` under `src/infrastructure/database/repositories` to access PostgreSQL (Supabase) and Redis. Wrap DB calls with `retry/withTimeout` via `PostgresClient` and `RedisClient`.

## Adding new command (concise steps)
1. Add `src/application/commands/my-command.ts` (extend `BaseCommand`).
2. Define `metadata` and `executeImpl` returning `CommandResult`.
3. If heavy, schedule via `JobScheduler` and create a processor under `src/infrastructure/queue/processors`.
4. Register the command in `registerCommands()` inside [src/bootstrap/container.ts](src/bootstrap/container.ts).
5. Add any external API logic behind a client in `src/infrastructure/external` using `retry/withTimeout/executeWithCircuitBreaker`.

## Change constraints & where to put changes
- Dependency injection only: Add new services, clients or processors in `buildContainer()` ([src/bootstrap/container.ts](src/bootstrap/container.ts)). Avoid `new` in runtime handlers or command classes — dependencies must be passed via constructors.
- Use `ResponseBuilder` when sending output: Commands should return `CommandResult` values and never directly call `WhatsAppSender` where not necessary. Exceptions: `Command` that must react immediately (rare) may call `WhatsAppSender` but should still use `ResponseBuilder` to keep consistent output formatting.
- No heavy work in main thread: Any media or long-running work should be moved to a `Processor` and scheduled via `JobScheduler` (update `job-handler` and `queue/client` as needed).
- Global config & env: Add env variables via `src/config/schema.ts` and reference them via `getConfig()`; avoid reading `process.env` directly in components. Use types from `Config` when needed.
- Logging: Use `log(level, message, metadata)` from `src/lib/logging/logger.ts` — do not `console.log` or `console.error` for production messages.
- Timeouts and retry: Use `TIMEOUTS` and `LIMITS` from `src/config/constants.ts`; wrap external calls with `retry`, `withTimeout`, and `executeWithCircuitBreaker`.
- Temporary files and cleanup: For any file written to disk, use `TempFileStore` to create, track and cleanup files. Call `scheduleCleanup` or rely on `JobHandler.scheduleCleanup`.
- Messaging & i18n: Use `MESSAGES` from `src/i18n/es.ts` for user-facing strings and `format` helpers to build messages.
- Tests & Type Safety: Add unit tests around pure logic such as `parseCommand` in `src/domain/message.ts` and `CommandExecutor`; keep side-effecting logic under integration tests.

## Quick mappings — change type -> files to edit
- Add Command: `src/application/commands/*` (new class), register in `registerCommands()` in `src/bootstrap/container.ts`, ensure permissions via `UserService` and `PermissionChecker`.
- Add Job Processor: `src/infrastructure/queue/processors/your-processor.ts`, update `JobHandler` and `JobHandler.processJob()` switch, and register new processor instance in `buildContainer()`.
- Add External API Client: `src/infrastructure/external/your-client.ts`, use resilience helpers and register the client in `buildContainer()`.
- Add DB access: `src/infrastructure/database/repositories/*`, use `PostgresClient` and return typed domain objects; update `UserRepository` or create a new repository.
- Add new cache entry: `src/infrastructure/database/repositories/cache-repository.ts`.
- Change message format / parsing: `src/domain/message.ts` (parseCommand) and `src/application/handlers/message-handler.ts`.
- Add temporary-file logic: `src/infrastructure/storage/temp-file-store.ts` (create and cleanup files here).

## Examples & patterns
- External call wrapper (Spotify example):
	- `executeWithCircuitBreaker("spotify", () => retry(() => withTimeout(async () => { /* fetch */ }, TIMEOUTS.EXTERNAL_API_MS, 'spotify')));`
- Command implementation (sticker example):
	- Use `requiresMedia` helpers in `BaseCommand`.
	- Check `sender.getMediaInfo` for validation.
	- Schedule job with `JobScheduler.scheduleStickerJob()` and return `{type: 'queued', queueMessage: '⏳ ...' }`.
- Job processor pattern: Create `process(jobData)` returning `{success: true, resultType: 'sticker'|'media'|'audio', outputFilePath}`, then `JobHandler.handleJobCompletion()` will forward results appropriately.

## PR checklist
- Formatting: Run `bun run format` and `bun run lint` (oxfmt and oxlint) and keep diffs small.
- Config & env: Add env entries to `src/config/schema.ts` and update `loadConfig` usage if needed.
- DI registration: Register any new service/client/processor in `buildContainer()` and add to the `Container` interface if used elsewhere.
- Use helpers: Prefer `retry`/`withTimeout`/`executeWithCircuitBreaker` for network calls, `TempFileStore` for files, `ResponseBuilder` for output.
- Logging: Use `log(...)` consistently, avoid console.* calls.
- Tests: Add/adjust unit tests for domain-only code (e.g., parsing, command routing) and integration tests for jobs where possible.


## Queue & job changes
- Add processor under `src/infrastructure/queue/processors` and accept typed `JobData`/`JobResult` from `src/domain/job.ts`.
- Register processor in `buildContainer()` and pass it to `JobHandler` so `bootstrap/lifecycle.ts`'s worker can call `processJob`.

## Resiliency & logging
- Use `log('info'|'warn'|'error')` from [src/lib/logging/logger.ts](src/lib/logging/logger.ts); logs are JSON with timestamp and level.
- Start circuit cleanup in `start()` and stop it in `stop()` (already handled in [src/bootstrap/lifecycle.ts](src/bootstrap/lifecycle.ts)).

## Environment / runtime
- Primary runtime: `bun` is used. Ensure `CHROME_PATH`, `REDIS_HOST`, `REDIS_PORT`, `SUPABASE_URL` and `SUPABASE_KEY` values in `.env` or environment (see [src/config/schema.ts](src/config/schema.ts)).
- Session clearing helper: `npm run clean:session:dev` to remove `.wwebjs_auth` and `.wwebjs_cache` during development.
- Heavy native dependencies: ffmpeg, yt-dlp, ImageMagick, TeXLive are required when using features like video->sticker or LaTeX rendering; `install-dependencies.sh` installs the main ones on Linux.
 
## Common dev commands
```
bun install
bun run format     # oxfmt format & check
bun run lint       # oxlint check
bun run typecheck  # TypeScript type check
bun run test       # Run tests with Vitest
bun start          # run in dev locally (uses bun via package.json)
bun run clean      # clean artifacts
```

## Testing & CI
- Tests run with `bun run test` (Vitest). See `tests/` for coverage.
- External API calls and WhatsApp operations are not mocked; they are either tested manually or covered by integration tests.

## Pitfalls & gotchas
- WhatsApp message ids and phone ids include `@c.us`. Use `normalizePhoneNumber`/`toWhatsAppId` helpers in [src/domain/message.ts](src/domain/message.ts).
- The `whatsapp-web.js` client uses `LocalAuth`; sessions persist in `.wwebjs_auth`. If tests or sessions fail, clear session state.
- Use `registerCommands()` in container; missing registration means commands won't be discoverable.
- Keep third-party API logic wrapped by resilience helpers; do not `fetch` unguarded.

## Examples to reference
- Adding sticker command: [src/application/commands/sticker-command.ts](src/application/commands/sticker-command.ts)
- Queue worker + job completion: [src/infrastructure/queue/client.ts](src/infrastructure/queue/client.ts), [src/application/handlers/job-handler.ts](src/application/handlers/job-handler.ts)
- External client patterns: [src/infrastructure/external/spotify-client.ts](src/infrastructure/external/spotify-client.ts) and [src/infrastructure/external/annas-archive-client.ts](src/infrastructure/external/annas-archive-client.ts)

## whatsapp-web.js

Core classes: `Client` (main instance), `Message` (received/sent), `Chat` (group or DM), `Contact`, `MessageMedia` (attachments). Refer to [whatsapp-web.js docs](https://docs.wwebjs.dev/) for full API reference. Key: `Client` initialization uses `LocalAuth` strategy, message IDs include `@c.us` or `@g.us` suffix, group operations require admin rights.
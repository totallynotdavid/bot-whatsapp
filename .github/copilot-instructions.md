Our philosophy: We care about:

- Code as documentation. comments should only be used when we do unintuitive
  things (which we shouldn't most of the time!).
- Code should be explicit.
- The codebase must be simple and dumb (functions should do one thing and do it
  well) to be scalable.

# High-Level overview

- What it does: This repo implements a WhatsApp bot. Messages are received via whatsapp-web.js, parsed into domain `Message` model, and processed by `MessageOrchestrator` which routes them to command handlers.
- Primary flow: src/main.ts -> `createContainer` (src/container.ts) -> `MessageReceiver` initializes and forwards domain `Message` objects to `MessageOrchestrator` (src/application/orchestrators/message-orchestrator.ts).

## Key Architectural Concepts

- Container/DI pattern: `createContainer(env)` registers things in a `Map<string, any>` and exposes `resolve(name)` to fetch dependencies. Add new services to `createContainer` and use `container.resolve` in `main.ts` or other bootstrap code.
- Application layer: Commands are registered through `CommandFactory` (src/application/commands/command-factory.ts). Handlers implement `ICommandHandler` and expose `metadata` (name, aliases, minRank, description).
- Command resolution: `CommandRegistry` normalizes names and supports aliases and fuzzy suggestions (src/application/commands/command-registry.ts). Use the registry's `resolve` and `suggestSimilar` functions.
- Persistence: Local caching is implemented in `LocalUserRepository` with periodic Postgres backups via `PostgresUserRepository` (src/infrastructure/persistence/local/local-user-repository.ts). If you need to read/write user ranks, prefer the repository interface methods.
- Messaging integration: `MessageSender` and `MessageReceiver` wrap whatsapp-web.js calls (src/infrastructure/whatsapp/message-sender.ts and src/infrastructure/whatsapp/message-receiver.ts). Use those wrappers rather than calling the `Client` directly.

## Data Flow (message lifecycle)
- Incoming raw message: whatsapp-web.js emits `message` -> `MessageReceiver` converts it into the domain `Message` object that includes `User`, `Chat`, `mentions`, `mediaType`, `quotedMessageId` (see src/infrastructure/whatsapp/message-receiver.ts).
- Orchestration: `MessageOrchestrator.handleMessage` acknowledges the message via `MessageSender.sendReaction`, parses the command via `parseCommand`, resolves the handler via `CommandRegistry`, and checks permissions with `PermissionChecker` which uses the Redis cache and `Rank` VO (see src/application/orchestrators/message-orchestrator.ts and src/application/services/permission-checker.service.ts).
- Command execution: The resolved `ICommandHandler.execute` runs with a `CommandContext`; handlers use `MessageSender` and `QueueClient` (or `LocalUserRepository`) via DI to send replies, upload media, or queue long-running work (see src/application/commands/handlers/sticker-handler.ts for the queuing pattern).
- Queuing & Workers: `QueueClient` (BullMQ) stores media jobs (e.g., `sticker`) in Redis; `startMediaWorker` (src/workers/media-worker.ts) starts a `Worker` that calls `MediaProcessor` to process jobs and deliver results back to users via `MessageSender`.
- Persistence: Handlers that update permission or rank call into `LocalUserRepository`, which keeps an in-memory cache + Redis and delegates persistent backups to `PostgresUserRepository` (src/infrastructure/persistence/local/local-user-repository.ts and src/infrastructure/persistence/postgres/user-repository.impl.ts). The local repo periodically syncs changes to Postgres.
- Media validations: `MediaValidator` talks to Whatsapp client to validate media size/mimetype before queuing/processing (src/infrastructure/whatsapp/media-validator.ts).
- Telemetry & Resilience: Each external operation should consider `RetryPolicy`, `TimeoutPolicy`, and `CircuitBreaker`. Logging (`logger`) and `PerformanceTracker` are used throughout to capture events and timing (src/infrastructure/monitoring).
- Error handling: Orchestrator catches exceptions, marks messages (reaction), sends an error reply, and attempts to notify owner via `userStateService` + `MessageSender`.

## Important Patterns & Conventions

- Commands must implement `ICommandHandler`: Provide `metadata` (name, aliases[], minRank, description, usage) and an `execute(context: CommandContext): Promise<CommandResult>` method. See `StickerHandler` (src/application/commands/handlers/sticker-handler.ts) for example.
- Dep injection for commands: Use `CommandFactory` to instantiate and register handlers. `CommandFactory` injects `CommandDependencies` (repository, queue client, message sender, media validator, owner phone).
- Resource wrappers: Use `RetryPolicy`, `TimeoutPolicy`, and `CircuitBreaker` wrappers for external calls. They are registered in the container and visible via names `retryPolicy`, `timeoutPolicy`, `circuitBreaker`.
- Queues & workers: Use `QueueClient` to enqueue media jobs (e.g., sticker generation), processed by `media-worker.ts` via `startMediaWorker`. The job types include `sticker` and may expand.
- Value Objects: Use `PhoneNumber` and `Rank` value objects consistently to represent phone/permission data.

## Error Handling & Monitoring
- Logging: Use `logger` from `src/infrastructure/monitoring/logger.ts`. Prefer `debug|info|warn|error` semantics and attach structured metadata.
- Performance tracking: `PerformanceTracker` is used to monitor phases in long operations. It logs timings for checkpoints, e.g., in `MessageOrchestrator`.
- Owner notifications: Critical errors attempt to notify the owner phone via `UserStateService` and `messageSender`. Preserve this behavior if adding new critical flows.

## Build, Run & Debug
- Run locally (dev): `bun run src/main.ts --env-file=.env`. `src/main.ts` calls `createContainer` and starts the bot.
- Production start: `npm run start:prod` uses `pm2` and expects a `dist` or compiled JS at `bot/main.js` — production runtime configuration may differ.
- Tests: `npm run test` uses `vitest` (Node environment). Use `npm run test:watch` for iterative development.
- Formatting & linting: `npm run format` uses `biome` and `prettier` for code formatting.

## Integration Points & External Dependencies

- Redis — Cache + queue (via `bullmq`): `REDIS_HOST` and `REDIS_PORT` in env.
- Supabase Postgres — Backing paid users table: `SUPABASE_URL` and `SUPABASE_KEY` in env. Postgres client in `src/infrastructure/persistence/postgres/postgres-client.ts`.
- WhatsApp client — `whatsapp-web.js` with puppeteer. Optionally set `CHROME_PATH` in env to control the executable path.
- BullMQ workers — `QueueClient` and `MediaWorker` start a `Worker` connected to Redis, process sticker/media jobs.

## Developer Conventions & Gotchas

- Use DI via `createContainer` rather than constructing `whatsapp-web.js` clients or repositories elsewhere.
- Do not hardcode owner phone: Use `PhoneNumber.create(env.OWNER_PHONE)` — the `OWNER_PHONE` env var validates via zod in `environment.ts`.
- Media size limits: Use `MEDIA` constants in `src/config/constants.ts`; `MediaValidator` enforces them — avoid bypassing validator.
- Command registration order: Register commands with `CommandFactory.registerCommand` (see `src/container.ts` where Help, Sticker, Kick, AddPremium are registered).
- Session cleanup: If you're developing, reset WhatsApp sessions with `bun run clean:session:dev`. For production session cleanup run `bun run clean:session:prod`.

## How to Add a Command
1. Create a new handler in `src/application/commands/handlers` implementing `ICommandHandler`.
2. Provide proper `metadata` fields: `name`, `aliases`, `minRank`, `description`, and `usage`.
3. Add any external dependencies you need to `CommandDependencies`, or rely on existing `messageSender`, `queueClient`, `mediaValidator`, `userRepository`.
4. Register it in `createContainer` using `commandFactory.registerCommand(YourHandler)`.
5. Add unit tests covering `execute()` and integration tests for orchestration if applicable.

## Where to Look

- Orchestrator: src/application/orchestrators/message-orchestrator.ts
- Commands: src/application/commands
- DI / composition root: src/container.ts
- WhatsApp integration: src/infrastructure/whatsapp
- Queues & workers: src/infrastructure/queue and src/workers/media-worker.ts
- Persistence: src/infrastructure/persistence/local and src/infrastructure/persistence/postgres

## Example quick tasks for agents

- Add new command that uses queue: implement handler and `addJob` to `queueClient`, follow `sticker` pattern. Test by adding unit tests for `execute` and verify queue receives job.
- Add a new repository method: update `IUserRepository` and implement both `LocalUserRepository` and `PostgresUserRepository` and include sync/backup logic.
- Add a new resilience wrapper or use existing ones: use `RetryPolicy` and `TimeoutPolicy` when calling 3rd-party APIs.

If this file is missing content you expect, please ask for additional details (run commands you’ll need, sensitive environment variables to set, or which credentials are required), and I’ll update this file.

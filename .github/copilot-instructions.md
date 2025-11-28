## Repo Overview

This repo is a TypeScript WhatsApp bot (whatsapp-web.js) with a layered architecture:
- Entry: [src/main.ts](../src/main.ts) composes adapters, stores, router, and workers.
- Adapters: [src/adapters/**](../src/adapters) wrap external systems (Redis, Supabase/Postgres, WhatsApp, BullMQ).
- Core: [src/core/**](../src/core) implements domain logic: command parsing, routing, permission checks, state caching.
- Commands: [src/commands/**](../src/commands) are small classes extending `BaseCommand` with `metadata` and `execute` semantics.
- Stores: [src/stores/**](../src/stores) hold in-memory caches and sync to external databases.
- Workers: [src/workers/**](../src/workers) process background jobs (media conversion, queues).

## Big Picture - Data & Execution Flow
- Incoming message -> [WhatsAppReceiver](../src/adapters/whatsapp-receiver.ts) converts to domain `Message`.
- [MessageHandler](../src/core/message-handler.ts) parses command with `parseCommand()`, checks permissions (`PermissionGuard`), fetches user via `StateManager`, then routes to a `CommandHandler`.
- Heavy tasks (e.g., media processing) are queued via `QueueAdapter` and executed by `MediaWorker`.
- Persisted data: Premium users are stored in Supabase/Postgres via `PostgresAdapter`; caches are stored in Redis.

## Key Patterns & Conventions
- Commands: Implement `BaseCommand` in `src/commands`. Provide `metadata` (name, aliases, minRank, isHeavyOperation) and implement `executeImpl()`.
- DI & Registrar: New commands should be added to `buildCommandRegistry()` in [src/commands/registry.ts](../src/commands/registry.ts).
- Adapters: All network operations use `retry`, `withTimeout`, and `executeWithCircuitBreaker` where appropriate (see [src/lib/retry.ts](../src/lib/retry.ts) and [src/lib/circuit-breaker.ts](../src/lib/circuit-breaker.ts)). Follow this pattern for new adapters.
- Logging: Use `log(level, message, meta)` from [src/lib/logger.ts](../src/lib/logger.ts) — logs are JSON; prefer structured metadata.
- Message types: Use normalized phone IDs with `normalizePhoneNumber()` and `toWhatsAppId()` from [src/core/types.ts](../src/core/types.ts).
- Configuration: Use `config` constants in [src/config.ts](../src/config.ts) (timeouts, limits, env validation via `zod`). Update `config.ts` instead of hardcoding values.

## Adding a Command (Concrete Example)
1. Create a new class in `src/commands` that extends `BaseCommand`.
2. Provide `metadata` (e.g., `name: "mycmd"`, `aliases:["m"]`, `minRank: Rank.REGULAR`).
3. Implement `executeImpl(context)` and return a `CommandResult` (see `src/core/types.ts`).
4. If the command queues work, call `queueAdapter.addJob()` and return `queued` result.
5. Register the command in [src/commands/registry.ts](../src/commands/registry.ts) so the `CommandRouter` recognizes it.

## Environment & Runtime
- Runtime in package.json uses `bun` for dev runs. `start` runs `bun run src/main.ts --env-file=.env` (see package.json `start`).
- Production uses `pm2` to run compiled or bundled code (see `start:prod` in package.json). Confirm the target `main`/`bot` tree if deploying.
- Required ENV (validated by `src/config.ts`): `OWNER_PHONE`, `COMMAND_PREFIX`, `SUPABASE_URL`, `SUPABASE_KEY`, `REDIS_HOST`, `REDIS_PORT`, and optionally `CHROME_PATH`.
- Format & test: `npm run format` and `npm run test` (vitest). Note: `npm` works but `bun` is used frequently in scripts.

## Debugging & Testing Tips
- To quickly run tests: `npm run test` or `bun run test`.
- For a clean session during dev, use `npm run clean:session:dev` (removes .wwebjs session files).
- Logs are JSON — use `LOG_LEVEL` env (config.LOG_LEVEL) to control verbosity.
- For local WhatsApp testing, you'll see a QR code logged by `qr` event; the session is persisted with `LocalAuth`.
- Memory monitoring: `Monitor` (src/lib/monitor.ts) will warn and attempt GC when memory usage exceeds `MEMORY.WARNING_THRESHOLD_PERCENT`.

## Integration Points & External Systems
- WhatsApp: whatsapp-web.js with `LocalAuth` ([src/main.ts](../src/main.ts)). Keep `puppeteer` `executablePath` in `CHROME_PATH` if running in custom environment.
- Redis: `ioredis` via `RedisAdapter` used for caching and queue backing.
- Postgres: Supabase client via `PostgresAdapter` for persistent storage of paid users.
- Queue: BullMQ for background tasks (see `QueueAdapter`, `MediaWorker`).
- Media store: Temporary files in OS temp directory via `MediaStore`.

## Notable Caveats & Outdated Docs
- README references Node `index.js` and `config.dev.js`/`config.prod.js`. The actual repo uses TypeScript, `src/main.ts`, and `zod`-validated env in `src/config.ts`. Prefer `src/config.ts` for canonical config.
- The `start:prod` script expects a compiled/bundled `bot/main.js` — confirm your deployment steps (no `build` script in package.json by default).

- Quick File Map (most-referenced during dev)
- Entry: [src/main.ts](../src/main.ts)
- Commands: [src/commands](../src/commands/registry.ts)
- Core: [src/core](../src/core/message-handler.ts)
- Adapters: [src/adapters](../src/adapters/whatsapp-sender.ts)
- Stores: [src/stores/user-store.ts](../src/stores/user-store.ts)
- Worker: [src/workers/media-worker.ts](../src/workers/media-worker.ts)
- Utilities: [src/lib/retry.ts](../src/lib/retry.ts), [src/lib/circuit-breaker.ts](../src/lib/circuit-breaker.ts)

If you'd like, I can also:
- Add a short dev checklist to README with `bun` vs `npm` guidance.
- Add a template for new commands (boilerplate `BaseCommand` class + tests).

Feedback request: Are these the areas you'd like the AI agent to prioritize, or should I include additional developer workflows (CI, Docker, deployment) in the instructions?

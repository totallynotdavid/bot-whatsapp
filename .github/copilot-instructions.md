# WhatsApp Bot Copilot Instructions

Our philosophy: We care about:

- Code as documentation. comments should only be used when we do unintuitive
  things (which we shouldn't most of the time!).
- Code should be explicit.
- The codebase must be simple and dumb (functions should do one thing and do it
  well) to be scalable.

## Architecture Overview

This is a WhatsApp bot built with Clean Architecture principles, organized into
layers:

- **Domain**: Core business logic (entities, value objects, services,
  repositories)
- **Application**: Use cases and commands that orchestrate domain logic
- **Infrastructure**: External concerns (WhatsApp client, database, cache, file
  system)
- **Shared**: Common utilities, logging, i18n

## Data Flow

### Bootstrap Sequence

1. `main.ts` loads and validates environment config with Zod
2. Initializes `FileManager` for temporary file handling
3. Creates infrastructure services: Redis client, Supabase client, WhatsApp
   client, BullMQ queue
4. Instantiates domain services: `PermissionService` with cache
5. Registers all commands in `CommandRegistry`
6. Starts BullMQ worker for media processing
7. Sets up queue completion handlers to send results back via WhatsApp
8. Initializes WhatsApp adapter and starts listening for messages

### Message Processing Flow

1. WhatsApp client receives message via `whatsapp-web.js`
2. `WhatsAppAdapter` converts WWebJS message to domain `Message` entity
3. `ProcessMessageUseCase.execute()` processes the message:
   - Extracts command using `extractCommand()` (checks prefix, splits name/args)
   - Resolves command via `CommandRegistry` (handles aliases)
   - Checks permissions via `PermissionService` (cache-first, DB fallback)
   - Executes command with injected services
4. Command returns `CommandResult` (text, error, or no-op)
5. Result sent back via WhatsApp client

### Media Processing Flow

1. Media command validates input (size, type) and adds job to BullMQ queue
2. Returns immediate "processing" response to user
3. Background worker picks up job and processes media (e.g., Sharp for stickers)
4. On job completion, queue handler sends result media/text back to chat
5. Temporary files cleaned up automatically via `FileManager`

### Permission Checking Flow

1. `PermissionService.checkCommand()` called with user/chat/command rank
2. Checks Redis cache first (TTL-based)
3. On cache miss, queries Supabase `paid_users` table
4. Caches result and returns allowed/denied with reason

### Error Handling Flow

1. Command execution errors caught in `ProcessMessageUseCase`
2. Logs error with context, notifies owner via WhatsApp
3. Returns user-friendly error message
4. Performance checkpoints logged throughout flow

## Key Patterns & Conventions

### Command System

- Commands implement `ICommand` interface with metadata (name, aliases, minRank,
  description)
- Registered in `CommandRegistry` during bootstrap
- Executed with `CommandContext` (message, user, args) and injected
  `CommandServices`
- Example:
  [src/application/commands/general/ping.command.ts](../src/application/commands/general/ping.command.ts)

### Asynchronous Media Processing

- Media-heavy commands add jobs to BullMQ queue instead of blocking
- Workers process jobs in background, results sent via queue completion handlers
- Use `FileManager` for temporary file handling with automatic cleanup
- Example:
  [src/application/commands/media/sticker.command.ts](../src/application/commands/media/sticker.command.ts)
  →
  [src/workers/processors/sticker.processor.ts](../src/workers/processors/sticker.processor.ts)

### Permissions & Ranks

- Commands have `minRank` from `Rank` enum (REGULAR, PREMIUM, ADMIN, OWNER)
- `PermissionService` checks user rank via cache (Redis) with TTL
- Owner phone number is special-cased for admin access

### Configuration & Validation

- Environment variables validated with Zod schemas in `env.config.ts`
- Bootstrap validates external connections (Redis, Supabase) before starting
- Use `loadConfig()` for typed config access

### Error Handling & Logging

- Use `logger` from shared/logger for structured logging
- Commands return `CommandResult` DTOs (text, error, no-op types)
- Critical errors notify owner via WhatsApp
- Performance logging via `PerformanceLogger` checkpoints

### External Integrations

- **WhatsApp**: `whatsapp-web.js` with LocalAuth, puppeteer headless
- **Database**: Supabase for user data, paid_users table
- **Cache/Queue**: Redis via ioredis/BullMQ
- **File System**: Custom `FileManager` for temp files with cleanup
- **Media Processing**: Sharp for image manipulation, ffmpeg implied

## Development Workflows

### Running & Testing

- `bun run start` - Start bot with hot reload
- `bun run test` - Run Vitest tests
- `bun run test:coverage` - Generate coverage reports
- `bun run format` - Format with Biome + Prettier

### Building

- No explicit build step; TypeScript compiled on-the-fly by Bun
- `tsconfig.json` configured for bundler mode with strict checks

### Debugging

- Logs to console and files (log.txt, debug_log.txt)
- QR code generated on first run for WhatsApp auth
- PM2 for production restarts (every 4 hours)

### Tool Management

- Mise manages tool versions (Bun 1.3.3, Biome 2.3.7, etc.)
- Biome handles linting/formatting with custom rules (noNonNullAssertion off,
  noExplicitAny off)

## Code Style & Best Practices

### TypeScript

- Strict mode enabled, noEmit for bundler
- Use ESNext features, preserve module syntax
- Explicit types preferred over inference for public APIs

### Dependency Injection

- Services injected in bootstrap, passed through use cases to commands
- Avoid singleton patterns; instantiate once in main.ts

### Async/Await

- All I/O operations async, proper error handling
- Use `Promise.all` for parallel operations where safe

### File Organization

- Group by feature in application layer (commands/admin, commands/general, etc.)
- Infrastructure mirrors domain interfaces
- Shared utilities in flat structure

### Internationalization

- Messages in Spanish (src/shared/i18n/messages.es.ts)
- Use message keys for consistency

### Testing

- Vitest with globals, Node environment
- Property-based testing with fast-check available
- Mock external services for unit tests

## Common Pitfalls

- Don't block on media processing; always use queue for heavy operations
- Validate media size/type before queuing jobs
- Handle WhatsApp disconnections gracefully (client auto-reconnects)
- Use absolute paths for file operations via `FileManager`
- Cache permissions to avoid DB hits on every command
- Notify owner on critical errors but don't crash the bot

## Key Files to Reference

- [src/main.ts](../src/main.ts) - Bootstrap and dependency wiring
- [src/application/use-cases/process-message.use-case.ts](../src/application/use-cases/process-message.use-case.ts) -
  Main message processing flow
- [src/application/commands/command.registry.ts](../src/application/commands/command.registry.ts) -
  Command registration and resolution
- [src/infrastructure/whatsapp/whatsapp.client.ts](../src/infrastructure/whatsapp/whatsapp.client.ts) -
  WhatsApp integration
- [src/workers/media.worker.ts](../src/workers/media.worker.ts) - Background job
  processing
- [src/config/env.config.ts](../src/config/env.config.ts) - Configuration schema

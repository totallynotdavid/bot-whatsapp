# Agent instructions

Core values:

* Performance
* Scalability
* Maintainability
* Code as documentation (explicit names, minimal comments, no cleverness)
* Simplicity (functions do one thing; architecture "dumb but scalable")
* Explicit code structure over clever abstractions

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

## Detailed Data Pipelines & Operation Paths
- Receive & normalize: `WhatsAppReceiver.convertToDomainMessage()` normalizes phone IDs, extracts quoted/mentions, and flags `hasMedia`.
- Command parsing & basic flow: `MessageHandler.handleMessage()`:
	- Acknowledge message (async) then parse using `parseCommand()`.
	- If `parseCommand()` returns null, clear reaction and stop.
	- `router.route(name)` finds handler; if none, respond using `MessageHandler.handleUnknownCommand()` with suggestions.
	- `StateManager.getUser()` reads from `userCache`, falls back to `UserStore.getUser()` — the latter queries Postgres via `PostgresAdapter`.
	- `PermissionGuard.checkPermission()` consults `PermissionStore` cache then `evaluatePermission()`.
	- Build `CommandContext` and call `handler.execute(context)` (see `BaseCommand.execute()` implementation).

- Response & post-processing: `ResponseWriter.writeResponse()` inspects `CommandResult` types (`text`,`media`,`sticker`,`queued`,`error`,`none`) and calls `WhatsAppSender` accordingly.
	- On error, `MessageHandler.handleCommandError()` logs and notifies the owner via `WhatsAppSender.sendText()` and calls `responseWriter.markError()`.

- Heavy/async pipeline (example: sticker):
	- Command (`StickerCommand`) validates media (via `WhatsAppSender.getMediaInfo()`), then queues a job with `QueueAdapter.addJob("sticker", data)`.
	- `QueueAdapter` pushes into a BullMQ queue; `QueueAdapter.startWorker()` creates a `Worker` that runs `MediaWorker.start()` processing functions.
	- `MediaWorker.processStickerJob()` downloads media via `WhatsAppSender.downloadMedia()`, writes temp files via `MediaStore.saveBuffer()`, and returns a `MediaJobResult`.
	- On completion, `MediaWorker.sendJobResult()` decides `sendSticker` or `sendMedia` and cleans up via `MediaStore.cleanup()`.

- Data/store paths & periodic sync:
	- `StateManager` caches per-request user objects for ~60s, while `UserStore` keeps a local in-memory map and persists to Postgres.
	- New premiums set `UserStore.updateRank()` (writes both local and Postgres via `saveToPostgres()`).
	- `UserStore.startPeriodicSync()` periodically calls `syncAllToPostgres()` based on `SYNC_INTERVAL.POSTGRES_BACKUP_MS`.

- Error handling & resilience:
	- Adapters should wrap network calls in `retry()` and `withTimeout()` and optionally `executeWithCircuitBreaker()` (see [src/lib/retry.ts](../src/lib/retry.ts) and [src/lib/circuit-breaker.ts](../src/lib/circuit-breaker.ts)).
	- Use structured `log()` metadata and `LOG_LEVEL` to reduce noise during tests.
	- `MessageHandler` notifies owner on unexpected errors and marks them (`responseWriter.markError`).

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

=== Quick Operation Checklist (where to operate):
- Add a new command: `src/commands/*` and register in `src/commands/registry.ts`.
- Add or modify `Adapter` behavior and resilience: edit `src/adapters/*` and use `retry.ts`, `timeout.ts`, and `circuit-breaker.ts`.
- Add background worker job types: modify `QueueAdapter`, `MediaWorker`, and `workers/*`.
- Modify persistence: change/extend `PostgresAdapter` and reflect in `UserStore` or `StateManager` flows.
- Add or update tests: `vitest` config is at `vitest.config.ts`; run `npm run test` or `bun run test`.

Feedback request: Are these the areas you'd like the AI agent to prioritize, or should I include additional developer workflows (CI, Docker, deployment) in the instructions?

# Docs for whatsapp-web.js

1. CLASS: Client
   Description: The main class to interact with the WhatsApp Web instance.

   Initialization:
   - new Client(options)
     Usage: const client = new Client({ authStrategy: new LocalAuth(), puppeteer: { ... } });
     Options used:
     - authStrategy: Instance of LocalAuth.
     - puppeteer: Object (headless, executablePath).

   Events (.on):
   - 'qr': (qrCodeString) => void
     Emitted when a QR code is received for authentication.
   - 'ready': () => void
     Emitted when the client is fully authenticated and ready.
   - 'auth_failure': (message) => void
     Emitted when authentication fails.
   - 'message': (messageInstance) => void
     Emitted when a new message is received.

   Properties:
   - info: Object
     - wid: Object
       - user: string (The bot's raw user ID).

   Methods:
   - initialize(): Promise<void>
     Starts the browser and the client.
   - sendMessage(chatId, content, options): Promise<Message>
     Sends a message, media, or contact.
     Arguments:
       - chatId: string (e.g., '12345@c.us' or '12345@g.us').
       - content: string | MessageMedia | Contact.
       - options: Object (optional).
         - caption: string (for media).
         - sendAudioAsVoice: boolean (sends audio as PTT).
         - sendVideoAsGif: boolean (sends video as looping GIF).
         - sendMediaAsSticker: boolean (converts image/video to sticker).
         - stickerName: string.
         - stickerAuthor: string.
         - mentions: Array<Contact>.
   - getContactById(contactId): Promise<Contact>
     Retrieves a contact object by ID.
   - getChatById(chatId): Promise<Chat>
     Retrieves a chat object by ID.
   - getProfilePicUrl(chatId): Promise<string>
     Retrieves the URL of a contact or group profile picture.
   - acceptInvite(inviteCode): Promise<string>
     Joins a group via invite code. Returns the new Group ID.

2. CLASS: Message
   Description: Represents a message received or sent.

   Properties:
   - id: Object
     - remote: string (ID of the chat the message is in).
     - participant: string (ID of the specific sender in a group).
     - fromMe: boolean (implied usage).
   - body: string (Text content of the message).
   - from: string (Sender ID).
   - to: string (Recipient ID).
   - type: string (e.g., 'chat', 'image', 'sticker').
   - timestamp: number.
   - author: string (Sender ID, useful in groups to identify who sent it).
   - hasMedia: boolean.
   - hasQuotedMsg: boolean.
   - mentionedIds: Array<string> (IDs of users mentioned).
   - vCards: Array<string> (List of vCard strings if the message contains contacts).
   - quotedMsg: Object (Direct access to the quoted message object, distinct from getQuotedMessage()).
   - _data: Object (Internal raw data accessed in code).
     - notifyName: string (Sender's display name).
     - quotedMsg: Object (Raw quoted message data).
     - deprecatedMms3Url: string (Internal media URL).

   Methods:
   - getChat(): Promise<Chat>
     Returns the Chat this message belongs to.
   - getContact(): Promise<Contact>
     Returns the Contact of the sender.
   - getQuotedMessage(): Promise<Message>
     Returns the full Message object that was replied to.
   - reply(content, chatId, options): Promise<Message>
     Replies to the message. chatId can be null/undefined to reply in the same chat.
   - react(emoji): Promise<void>
     Reacts to the message with an emoji string.
   - downloadMedia(): Promise<MessageMedia>
     Downloads the attachment from the message.
   - delete(everyone): Promise<void>
     Deletes the message.
     Arguments:
       - everyone: boolean (true to delete for everyone).

3. CLASS: Chat
   Description: Represents a conversation (User or Group).

   Properties:
   - id: Object
     - _serialized: string (Full unique Chat ID).
   - name: string (Title of the group or name of the contact).
   - isGroup: boolean.
   - participants: Array<Object> (List of group members).
     - id: Object
       - _serialized: string (User ID).
       - user: string (User number).
     - isAdmin: boolean (True if the participant is an admin).

   Methods:
   - sendMessage(content, options): Promise<Message>
     Sends a message to this chat context.
   - fetchMessages(options): Promise<Array<Message>>
     Loads message history.
     - options: { limit: number }.
   - setMessagesAdminsOnly(state): Promise<boolean>
     Toggles "Only Admins Send Messages" setting.
   - addParticipants(participantIds): Promise<void>
     Adds users to a group.
     - participantIds: Array<string>.
   - removeParticipants(participantIds): Promise<void>
     Removes/Bans users from a group.
   - promoteParticipants(participantIds): Promise<void>
     Promotes users to Admin.
   - demoteParticipants(participantIds): Promise<void>
     Demotes Admins to members.

4. CLASS: Contact
   Description: Represents a WhatsApp user/contact.

   Properties:
   - id: Object
     - _serialized: string (Full Contact ID).
   - pushname: string (The public name set by the user).
   - name: string (The name saved in your contact book).

5. CLASS: MessageMedia
   Description: Handles media data (Base64).

   Constructor:
   - new MessageMedia(mimetype, data, filename)
     - mimetype: string (e.g., 'video/mp4').
     - data: string (Base64 encoded content).
     - filename: string (Optional file name).

   Static Methods:
   - MessageMedia.fromFilePath(filePath): Promise<MessageMedia>
     Creates an instance from a local file.
   - MessageMedia.fromUrl(url, options): Promise<MessageMedia>
     Creates an instance from a URL.
     - options: { unsafeMime: boolean } (Used to force mime type acceptance).

   Properties:
   - mimetype: string.
   - data: string.
   - filename: string.

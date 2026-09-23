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

* Big Picture Architecture (why & how)
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
- Formatting: Run `npm run format` (per `package.json` using Biome) and keep diffs small.
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
bun run format     # biome format & check
bun start          # run in dev locally (uses bun via package.json)
bun run clean      # clean artifacts
```

Testing & CI
- There are no automated tests in the repository.

## Pitfalls & gotchas
- WhatsApp message ids and phone ids include `@c.us`. Use `normalizePhoneNumber`/`toWhatsAppId` helpers in [src/domain/message.ts](src/domain/message.ts).
- The `whatsapp-web.js` client uses `LocalAuth`; sessions persist in `.wwebjs_auth`. If tests or sessions fail, clear session state.
- Use `registerCommands()` in container; missing registration means commands won't be discoverable.
- Keep third-party API logic wrapped by resilience helpers; do not `fetch` unguarded.

## Examples to reference
- Adding sticker command: [src/application/commands/sticker-command.ts](src/application/commands/sticker-command.ts)
- Queue worker + job completion: [src/infrastructure/queue/client.ts](src/infrastructure/queue/client.ts), [src/application/handlers/job-handler.ts](src/application/handlers/job-handler.ts)
- External client patterns: [src/infrastructure/external/spotify-client.ts](src/infrastructure/external/spotify-client.ts) and [src/infrastructure/external/annas-archive-client.ts](src/infrastructure/external/annas-archive-client.ts)

## Docs for whatsapp-web.js

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
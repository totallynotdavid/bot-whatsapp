# Agent Instructions

## Project Overview
WhatsAppBot is a Node.js-based WhatsApp automation bot built with `whatsapp-web.js`. It provides a command-based system with both public and premium (admin) features, integrated with external services (Spotify, OpenAI, Supabase, AWS Polly, etc.).

**Key Architecture**: Event-driven command processor with dual-tier permission system (public/premium), Supabase for persistent state, and PM2 for production deployment.

## Data Flow Map

### Initialization Flow (index.js)
```
1. Env Validation (checkEnvironmentVariables)
   ↓
2. Folder Structure Check (checkStructure)
   ↓
3. Premium Data Refresh (refreshData) ← BOTTLENECK #1: 3 parallel Supabase queries
   - Fetches paid_users, physics_users, premium_groups
   - Filters expired users (Date comparison in-memory)
   - Updates premium_groups.isActive for expired users ← DB WRITE
   - Updates app_metadata.lastCheck ← DB WRITE
   ↓
4. State Injection (setFetchedData) ← ANTI-PATTERN: Mutates globals in whatsappClient.js
   - Updates module-level arrays: paidUsers, physicsUsers, premiumGroups
   ↓
5. Spotify Token Refresh (spotifyAPI.refreshAccessToken) ← BLOCKING
   ↓
6. WhatsApp Client Init (client.initialize) ← Puppeteer launch
```

**⚠️ Performance Issues:**
- No error recovery if refreshData fails - bot starts with empty premium lists
- Midnight refresh logic incomplete (setTimeout never re-schedules)
- Spotify refresh blocks WhatsApp initialization
- Global state mutation creates race conditions

### Message Processing Flow (whatsappClient.js)
```
WhatsApp Message Event
   ↓
1. Prefix Check (starts with prefix or prefix_admin?)
   NO → Ignore message (returns early)
   YES ↓
   ↓
2. Contact/Chat Fetch ← BOTTLENECK #2: 2 sequential await calls
   - message.getContact()
   - message.getChat()
   ↓
3. Permission Extraction
   - senderPhoneNumber from message.id
   - isSenderPaidUser from in-memory paidUsers array (linear search)
   ↓
4. DM Gate Check
   - If NOT group AND NOT paid user → send rejection → RETURN
   ↓
5. Command Parsing
   - stringifyMessage = body.split(/\s+/)
   - commandQuery = words after command
   ↓
6. Supabase Logging ← BOTTLENECK #3: Fire-and-forget write (no await)
   - insertMessage(phone, body, group, 'users')
   - Errors swallowed silently
   ↓
7. Permission Branch
   ├─ Regular Command (prefix):
   │  - Check group in premiumGroups array (linear search) ← ANTI-PATTERN
   │  - Check isActive flag
   │  - NO match → Silent return (no feedback to user)
   │  - YES → Execute command switch
   │
   └─ Admin Command (prefix_admin):
      - Check sender in paidUsers array (linear search)
      - NO match → Reply "premium only"
      - YES → Execute admin switch
   ↓
8. Command Execution (see below)
   ↓
9. React with ✅ (success indicator)
```

**⚠️ Performance Issues:**
- Every message triggers 2 API calls (getContact, getChat) even if not premium
- Linear array searches on EVERY message (O(n) for user/group checks)
- No caching of contact/chat info
- Logging failures are silent (no retry, no alerting)
- Giant try-catch swallows all errors with generic console.error

### Command Execution Patterns

#### Media-Heavy Commands (stickers, reddit, youtube, editImage)
```
Command Handler
   ↓
1. Download Media ← BOTTLENECK #4: Large files block event loop
   - downloadMedia() or MessageMedia.fromUrl()
   - No streaming - loads entire file into memory
   - No size check BEFORE download
   ↓
2. Process (varies by command)
   - Image manipulation (bimg, discord-image-generation)
   - Video conversion (ffmpeg, ytdlp_video_processor)
   - Sticker creation (whatsapp-web.js internal)
   ↓
3. File Size Check ← ANTI-PATTERN: After processing, not before
   - isFileSizeWithinLimit(path, 16MB)
   - If exceeds → Delete file → Reply error
   ↓
4. Send to WhatsApp
   - client.sendMessage(media, options)
   ↓
5. Cleanup (sometimes)
   - utilities.deleteFile(path) or cleanupDirectory()
   - NOT ALWAYS CALLED - temp files accumulate
```

**⚠️ Performance Issues:**
- Processes 16MB+ files only to reject them afterward
- Synchronous file operations block event loop
- Temp file cleanup is inconsistent
- No queue system - concurrent media requests cause memory spikes

#### Chat/AI Commands (chat, freeChat, resumen)
```
Command Handler
   ↓
1. Fetch Conversation History ← BOTTLENECK #5
   - fetchLastNMessages(phone, group, n) from Supabase
   - For 'resumen': fetches ALL messages (Infinity limit) ← CRITICAL ISSUE
   ↓
2. Message Processing
   - Split at summary boundaries
   - Calculate total conversation length
   ↓
3. Summarization Check
   - If length > MAX_CONVERSATION_LENGTH:
     - Format all messages as text
     - Call OpenAI API for summary ← BLOCKING, no timeout
     - Store summary as system message
   ↓
4. OpenAI Chat Completion ← BOTTLENECK #6
   - callOpenAI(messages, maxTokens)
   - No retry logic
   - No timeout handling
   - Errors return null
   ↓
5. Store Response
   - Two parallel addMessage calls (user + assistant)
   - Fire-and-forget (errors ignored)
   ↓
6. Process Mentions (for resumen only)
   - processMentions() extracts @names
   - Fetches ALL chat participants ← Redundant API call
   ↓
7. Reply to User
```

**⚠️ Performance Issues:**
- 'resumen' command fetches ENTIRE chat history (could be 100k+ messages)
- extractMessageData processes all messages in memory
- OpenAI calls have no timeout (can hang indefinitely)
- No rate limiting on AI features
- Failed AI responses still logged to DB as "No response"

#### External API Commands (spotify, youtube, doi, tex)
```
Command Handler
   ↓
1. Service Layer Call
   - spotify: searchAndDownloadSong() 
   - youtube: searchOnYoutube() or sendYoutubeVideo()
   - doi: handleDoiRequest() (calls Sci-Hub scraper)
   - tex: handleLatexToImage() (spawns pdflatex process)
   ↓
2. External API/Process ← BOTTLENECK #7: All synchronous
   - Spotify: Search API → Download preview MP3
   - YouTube: yt-dlp subprocess (blocks until complete)
   - Sci-Hub: Puppeteer scraper (full browser instance per request)
   - LaTeX: pdflatex subprocess → ImageMagick conversion
   ↓
3. File Handling
   - Write to temp directory
   - Create MessageMedia from file path
   ↓
4. Send & Cleanup
   - Send media to WhatsApp
   - Delete temp files (sometimes)
```

**⚠️ Performance Issues:**
- yt-dlp downloads entire videos before checking size limits
- Puppeteer instances not pooled (spawn new browser per Sci-Hub request)
- LaTeX compilation synchronous (blocks for complex equations)
- YouTube API key rotation manual (could hit rate limits)
- No queueing - concurrent yt-dlp calls can crash server

### Database Access Patterns

#### Supabase Client Architecture
```
supabaseCommunicationModule.js ← ANTI-PATTERN: Duplicate implementation
   ↓
supabase.js (services/) ← Different functions, same tables
   ↓
supabaseClient.js ← Single shared client (no connection pooling)
```

**Tables:**
- `users` - Command logging (write-only, never queried)
- `gpt_messages` - Conversation history (no TTL, infinite growth)
- `paid_users` - Premium users + expiry dates
- `physics_users` - Special user category (unclear purpose)
- `premium_groups` - Group subscriptions + isActive flag
- `app_metadata` - Last refresh timestamp

**⚠️ Data Issues:**
- No indices documented on conversation_id lookups
- No cleanup job for old gpt_messages
- Multiple Supabase wrapper implementations (2 different patterns)
- fetchLastNMessages in supabaseCommunicationModule returns different format than services/supabase.js
- Linear scans on premium user checks (should be hash map)

### State Management Anti-Patterns

#### Global Mutable State (functions/globals.js)
```javascript
let paidUsers = [];        // Mutated by setFetchedData()
let physicsUsers = [];     // Never used in permission checks
let premiumGroups = [];    // Searched on EVERY message
```

**Problems:**
- No synchronization between refreshData calls and message handler
- Race condition: User expires during message processing
- refreshDataCallback pattern creates circular dependency

#### Command Registration Fragmentation
```
1. Define in functions/globals.js (commands object)
2. Import handler in commands/index.js
3. Add switch case in whatsappClient.js (700+ line switch statement)
4. Duplicate help text in data/helpListCommands.json
```

**⚠️ Maintenance Issues:**
- Add command = edit 4 files
- No automatic command discovery
- Help text can desync from actual commands

### Critical Bottlenecks Summary

1. **Memory Leaks**: Temp files not cleaned, conversation history grows unbounded
2. **DB Performance**: Linear array searches instead of hash maps, no connection pooling
3. **Blocking Operations**: Media downloads, subprocess spawns, AI calls block event loop
4. **No Error Recovery**: Silent failures in logging, AI, external APIs
5. **Infinite Chat History**: 'resumen' command can OOM with large groups
6. **Puppeteer Abuse**: New browser instance per Sci-Hub request
7. **Global State Races**: Premium status can change mid-request

## Critical Architecture Patterns

### Command System
- **Two-tier command structure**: Regular commands (`prefix`) and admin commands (`prefix_admin`)
- Commands are defined in `functions/globals.js` as object keys (e.g., `commands.help`, `adminCommands.imagine`)
- All commands are registered in `commands/index.js` and dispatched in the main message handler (`functions/whatsappClient.js`)
- Commands must export handler functions, not classes
- **Example**: See `commands/stickers.js` for async media handling or `commands/admin/groups.js` for permission checks

### Configuration Management
- **Environment-based config**: `config.dev.js` and `config.prod.js` extend `config.base.js`
- Switch via `NODE_ENV` environment variable
- Use `CONFIG_KEYS` enum from `config.base.js` to reference config values
- **Dev defaults**: prefix `/`, admin prefix `#`
- **Always validate env vars** at startup via `checkEnvironmentVariables()` before initializing client

### State Management & Permissions
- **Premium user tracking**: Three arrays maintained in `functions/globals.js` - `paidUsers`, `physicsUsers`, `premiumGroups`
- Refreshed at startup via `refreshData()` in `index.js` and on-demand via admin commands
- Groups require active premium status (`premiumGroups` where `isActive === true`)
- Individual users checked via `isSenderPaidUser` in message handler
- **Pattern**: Always check group premium status before executing regular commands, user premium status for admin commands

### Service Layer
- Services in `services/` are stateless, pure async functions
- Return structured objects: `{ success: boolean, data?: any, error?: string }`
- **Example**: `services/reddit.js` returns `{ success: true, data: { caption, media: { urls: [] } } }`
- Handle errors internally, never throw to command handlers
- Use `utils/file-utils.js` for temporary file management and cleanup

### Database Integration (Supabase)
- All DB operations through `lib/api/supabaseCommunicationModule.js`
- Tables: `paid_users`, `physics_users`, `premium_groups`, `users` (logging), `gpt_messages` (conversations)
- **Critical**: Conversation context stored per `conversation_id` (format: `${group}_${phoneNumber}`)
- Use `fetchLastNMessages()` for chat history with automatic summary handling
- Always call `refreshDataCallback()` after modifying premium status

## Development Workflows

### Running the Bot
```bash
# Development (single run)
bun index.js

# Production (with PM2, auto-restart every 4 hours)
bun run start:prod

# View logs
bun run logs
```

### Code Quality
- **Formatter**: Biome (not Prettier for JS) - `bun run format`
- **Style rules**: Double quotes, semicolons always, 80 char line width (see `biome.json`)
- **Linting**: Run `bun test` (alias for lint check)

### Cleanup Commands
- `bun run clean` - Full reset (removes logs, temp files, node_modules, session data)
- Session data in `.wwebjs_auth` and `.wwebjs_cache` - clear when QR login fails

## Common Patterns & Conventions

### Message Handling
```javascript
// Always destructure whatsapp-web.js entities
const [contactInfo, chatInfo] = await Promise.all([
  message.getContact(),
  message.getChat()
]);

// Extract sender phone from message ID
const senderPhoneNumber = message.id.participant || message.id.remote;
```

### Command Registration
1. Create command file in `commands/` or `commands/admin/`
2. Export named functions (not default export)
3. Add to `commands/index.js` exports
4. Add command key to `commands` or `adminCommands` in `functions/globals.js`
5. Add switch case in `functions/whatsappClient.js` message handler

### Media Operations
- Use `MessageMedia.fromFilePath()` for local files
- Use `MessageMedia.fromUrl()` for remote URLs (add `{ unsafeMime: true }` for non-standard types)
- Always check file size limits: `utilities.isFileSizeWithinLimit(path, 16)` (WhatsApp limit: 16MB)
- Clean up temp files with `utilities.deleteFile()` or `cleanupDirectory()`

### External API Patterns
- Spotify: Refresh token at startup (`spotifyAPI.refreshAccessToken()`)
- YouTube: Multiple API keys rotated via `YOUTUBE_API_KEY_1`, `YOUTUBE_API_KEY_2`, etc.
- OpenAI: Use `services/openai.js` wrapper, not direct SDK calls
- AWS Polly: Credentials in `~/.aws/credentials` (not in `.env`)

## Critical Domain Knowledge

### WhatsApp Client Lifecycle
1. **Initialization**: `client.initialize()` in `index.js`
2. **QR Auth**: Displayed in terminal on first run
3. **Ready event**: Triggers after successful authentication
4. **Event filtering**: Use `client.on('message')` (not `message_create`) in production to avoid bot's own messages

### Premium System Flow
1. User added to `paid_users` table with `premium_expiry` date
2. `refreshData()` validates expiry dates and filters expired users
3. Expired users cause their groups' `isActive` flag to flip to `false`
4. Bot checks group active status before responding to commands
5. Reactivation: Update user expiry → call `refreshDataCallback()` → group becomes active again

### LaTeX to Image Pipeline
- Command: `!tex \frac{1}{2}`
- Service: `services/pdflatex.js` generates PDF → converts to PNG
- Requires: `pdflatex` binary in PATH (TeXLive installation)
- Cleanup: Remove temp directory after sending image

### Conversation Context Management
- Messages stored in `gpt_messages` with `sender` field (`user` or `bot`)
- System summaries injected as `system` role with `Summary: ` prefix
- `fetchLastNMessages()` splits conversations at summary boundaries
- Max conversation length enforced via `MAX_CONVERSATION_LENGTH` config

## File Organization
- **Commands**: Business logic, WhatsApp-specific interactions
- **Services**: Pure functions for external API calls (Spotify, OpenAI, Sci-Hub, etc.)
- **Utils**: Shared utilities (file ops, text processing, mention parsing)
- **Lib**: Core infrastructure (Supabase client, Puppeteer launcher)
- **Functions**: Bot initialization, validation, global state

## Debugging Notes
- Enable verbose logging: Check `debug_log.txt` (created during runtime)
- Common issues: Session corruption (clear `.wwebjs_auth`), memory leaks (PM2 auto-restart handles this)
- Test commands in non-premium groups to verify permission checks
- Use `message.react('✅')` as user feedback pattern for successful commands

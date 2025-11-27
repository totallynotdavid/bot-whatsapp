# WhatsApp Bot - AI Coding Assistant Instructions

## Architecture Overview

This is a modular WhatsApp bot built with Node.js and whatsapp-web.js. The architecture follows Go-inspired principles: fail-fast validation, simple functions, linear data flow, and explicit error handling.

### Core Components

- **`bot/main.js`**: Entry point that initializes all components and sets up the message handler
- **`bot/core/`**: Core logic modules
  - `parser.js`: Extracts command info from WhatsApp messages
  - `permissions.js`: Checks premium user/group access
  - `executor.js`: Routes commands to handlers (explicit imports, no auto-discovery)
  - `responder.js`: Sends text/media responses or errors
- **`bot/handlers/`**: Command handlers (one file per command, async `execute(ctx)` function)
- **`bot/services/`**: External API integrations (Spotify, YouTube, OpenAI, etc.)
- **`bot/storage/`**: Data layer
  - `database.js`: Supabase queries for premium users/groups and conversation history
  - `premium-cache.js`: In-memory Maps for O(1) permission checks with lazy expiry
- **`bot/utils/logger.js`**: Structured JSON logging with levels and timing

### Data Flow

```
WhatsApp Message → Parse → Check Permission → Execute Handler → Send Response → Log
```

Commands start with `/` (regular) or `#` (admin). Admin commands require premium users. Regular commands require premium users (DMs) or premium groups.

## Key Patterns & Conventions

### Handler Pattern
```javascript
// bot/handlers/example.js
async function execute(ctx) {
  const { parsed, db, client, config, cache, message } = ctx;
  // ... business logic
  return { text: 'response' }; // or { media: { path, type, caption } }
}
export { execute };
```

### Service Pattern
```javascript
// bot/services/example.js
function createExampleService(config) {
  return {
    async method() { /* ... */ }
  };
}
export { createExampleService };
```

### Configuration
- Fail-fast validation in `bot/config.js` at startup
- Required env vars: `NODE_ENV`, `SUPABASE_API_KEY`, `SUPABASE_BASE_URL`, `OPENAI_API_KEY`, `ADMIN_NUMBER`
- Optional: `COMMAND_PREFIX` (default `/`), `ADMIN_COMMAND_PREFIX` (default `#`)

### Error Handling
- Explicit try/catch in handlers
- User-friendly error messages via `sendError()`
- Structured logging with context
- Fail-fast: validate early, throw immediately

### Testing
- Vitest with globals, Node environment
- Property-based testing with fast-check
- Run: `npm test`, `npm run test:watch`, `npm run test:coverage`

### Code Quality
- Biome for linting/formatting (80 char width, spaces, double quotes)
- ES modules, async/await
- No shared state, pass data explicitly
- Temp files use `tmpdir()`

## Development Workflows

- **Start bot**: `npm start` (runs `node bot/main.js`)
- **Production**: `npm run start:prod` (uses pm2 with cron restart)
- **Test**: `npm test` (Vitest)
- **Format**: `biome format --write . && biome check --write .`
- **Clean**: `npm run clean` (removes logs, node_modules, sessions)
- **Logs**: `pm2 log` (in production)

## Integration Points

- **Database**: Supabase (premium users/groups, GPT conversations, command logs)
- **APIs**: OpenAI (GPT-3.5), Spotify, YouTube (yt-dlp), Wikipedia, AWS Polly, Google Drive, Bing Image Creator, Stability AI
- **External Tools**: ffmpeg, yt-dlp, ImageMagick, TeXLive
- **Deployment**: Ubuntu with pm2, AWS credentials for Polly

## Premium System

- Users and groups stored in Supabase
- Cached in memory with 15min refresh
- Lazy expiry cleanup for users
- Commands logged with success/failure

## Adding New Features

1. Create handler in `bot/handlers/` with `execute(ctx)` function
2. Explicitly import in `bot/core/executor.js`
3. Add to command list JSON in `data/`
4. Create service if external API needed
5. Add env vars to config validation if required
6. Write tests in Vitest

## Common Pitfalls

- Don't auto-discover handlers; import explicitly in executor.js
- Always validate config at startup
- Use absolute paths for file operations
- Handle media downloads to temp directory
- Log errors with full context but don't expose internals to users
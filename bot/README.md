# Bot Directory Structure

This directory contains the refactored WhatsApp bot implementation following Go-inspired principles: fail-fast, simple functions, clear data flow, and explicit error handling.

## Directory Structure

```
bot/
├── config.js              # Configuration with fail-fast validation
├── main.js               # Entry point (to be implemented)
├── core/                 # Core bot logic
│   ├── parser.js        # Message parsing
│   ├── permissions.js   # Permission checking
│   ├── executor.js      # Command execution
│   └── responder.js     # Response sending
├── storage/             # Data access layer
│   ├── premium-cache.js # In-memory premium user/group cache
│   ├── database.js      # Supabase database queries
│   └── conversation.js  # Chat history operations
├── handlers/            # Command handlers (one per command)
│   ├── help.js
│   ├── sticker.js
│   ├── spotify.js
│   └── ...
├── services/            # External API services
│   ├── openai.js
│   ├── spotify-api.js
│   ├── youtube-api.js
│   └── ...
└── utils/               # Pure utility functions
    ├── file.js
    ├── media.js
    └── logger.js
```

## Configuration

The configuration system (`config.js`) validates all required environment variables at startup and fails fast if any are missing.

### Required Environment Variables

- `NODE_ENV` - Environment (dev/prod)
- `SUPABASE_API_KEY` - Supabase API key
- `SUPABASE_BASE_URL` - Supabase base URL
- `OPENAI_API_KEY` - OpenAI API key
- `ADMIN_NUMBER` - Admin phone number

### Optional Environment Variables

- `COMMAND_PREFIX` - Command prefix (default: `/`)
- `ADMIN_COMMAND_PREFIX` - Admin command prefix (default: `#`)
- `CACHE_REFRESH_INTERVAL` - Cache refresh interval in ms (default: `900000` = 15 minutes)
- `LOG_LEVEL` - Logging level (default: `info`)

## Testing

Tests are written using Vitest and fast-check for property-based testing.

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Design Principles

1. **Fail Fast** - Validate early, return errors immediately
2. **Simple Functions** - Each function does one thing well
3. **Explicit Over Implicit** - No magic, no auto-discovery, clear dependencies
4. **Data Flow** - Linear, easy to trace from input to output
5. **No Shared State** - Pass data explicitly through function parameters

## Request Flow

```
WhatsApp Message
    ↓
1. Parse (extract command, args, sender)
    ↓ (return null if not a command)
2. Check Permission (lookup in Map)
    ↓ (return error if denied)
3. Execute Command (call handler function)
    ↓ (return error if fails)
4. Send Response
    ↓
5. Log Result (fire and forget)
```

## Next Steps

See `.kiro/specs/whatsapp-bot-refactor/tasks.md` for the implementation plan.

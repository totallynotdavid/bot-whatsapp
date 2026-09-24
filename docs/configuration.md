# Configuration

Environment variables are validated against `src/config/schema.ts` at startup. Bun loads `.env` automatically; no `--env-file` flag needed.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| NODE_ENV | No | `production` | Environment: `development`, `production`, `test` |
| LOG_LEVEL | No | `info` | Log level: `debug`, `info`, `warn`, `error` |
| OWNER_PHONE | **Yes** | — | Your WhatsApp number (10–15 digits, e.g. `34612345678`). You are the owner (Owner rank). |
| COMMAND_PREFIX | No | `/` | Character that triggers commands |
| SUPABASE_URL | **Yes** | — | URL of your Supabase project (e.g. `https://abc.supabase.co`) |
| SUPABASE_KEY | **Yes** | — | Supabase anon key (32+ characters) |
| REDIS_HOST | No | `localhost` | Redis host |
| REDIS_PORT | No | `6379` | Redis port |
| CHROME_PATH | No | — | Path to Chrome/Chromium binary. Empty = puppeteer downloads Chromium automatically |
| SPOTIFY_CLIENT_ID | No | — | Spotify credential. Without it, `/spot` doesn't work |
| SPOTIFY_CLIENT_SECRET | No | — | Spotify credential. Without it, `/spot` doesn't work |
| IMGUR_CLIENT_ID | No | — | Imgur credential. Without it, `/edit` fails |
| AWS_ACCESS_KEY_ID | No | — | AWS credential with Amazon Polly access. Without it, `/say` doesn't work |
| AWS_SECRET_ACCESS_KEY | No | — | AWS credential. Without it, `/say` doesn't work |
| AWS_REGION | No | `us-east-1` | AWS region for Polly. All the voices `/say` offers are available in `us-east-1` |

**Notes:**
- The 3 required variables must always be present.
- Variables with a default are omitted to use the default. A variable present but empty doesn't use the default: `REDIS_HOST=` and `REDIS_PORT=` fail validation.
- CHROME_PATH can be omitted: puppeteer uses its Chromium. SPOTIFY_*, IMGUR_CLIENT_ID and AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY can too; without them `/spot`, `/edit` and `/say` fail.

See [Getting started](getting-started.md) for initial setup.

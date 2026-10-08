# Configuration

The bot reads its settings from environment variables. Bun loads
`apps/whatsapp-bot/.env` on its own; `.env.example` lists every variable. The
schema is `src/config/schema.ts`. If a variable is invalid, the bot prints every
problem and exits.

Only `OWNER_PHONE`, `SUPABASE_URL` and `SUPABASE_KEY` are required. To use a
default, leave the line out: a variable that is present but empty does not fall
back to its default, so `REDIS_HOST=` and `REDIS_PORT=` fail validation.

| Variable                | Default      | Description                                                                                      |
| ----------------------- | ------------ | ------------------------------------------------------------------------------------------------ |
| `OWNER_PHONE`           | required     | Your WhatsApp number, 10 to 15 digits (for example `34612345678`). It has the Owner rank.        |
| `SUPABASE_URL`          | required     | URL of your Supabase project (for example `https://abc.supabase.co`).                            |
| `SUPABASE_KEY`          | required     | Supabase anon key, 32 characters or more.                                                        |
| `WHATSAPP_TRANSPORT`    | `wwebjs`     | WhatsApp library: `wwebjs` or `baileys`. See [architecture](architecture.md#whatsapp-transport). |
| `COMMAND_PREFIX`        | `/`          | Text that starts a command, 1 to 3 characters.                                                   |
| `REDIS_HOST`            | `localhost`  | Redis host.                                                                                      |
| `REDIS_PORT`            | `6379`       | Redis port.                                                                                      |
| `NODE_ENV`              | `production` | `development`, `production` or `test`.                                                           |
| `LOG_LEVEL`             | `info`       | `debug`, `info`, `warn` or `error`.                                                              |
| `CHROME_PATH`           | none         | Chrome or Chromium binary. Without it, puppeteer uses the Chromium it downloaded on install.     |
| `SPOTIFY_CLIENT_ID`     | none         | Spotify credential. `/spot` needs this and the secret.                                           |
| `SPOTIFY_CLIENT_SECRET` | none         | Spotify credential.                                                                              |
| `IMGUR_CLIENT_ID`       | none         | Imgur credential. `/edit` needs it.                                                              |
| `AWS_ACCESS_KEY_ID`     | none         | AWS credential with Amazon Polly access. `/say` needs this and the secret key.                   |
| `AWS_SECRET_ACCESS_KEY` | none         | AWS credential.                                                                                  |
| `AWS_REGION`            | `us-east-1`  | AWS region for Polly. Every voice `/say` offers exists in `us-east-1`.                           |

Without its credentials, `/spot`, `/say` or `/edit` replies "El comando /spot no
está disponible en este momento." (with the command's own name) and does nothing
else. The other commands are unaffected.

Chrome is used in two places: by `WHATSAPP_TRANSPORT=wwebjs`, and by `/docs`
downloads from `/slow_download/` mirrors, on either transport.

[Getting started](getting-started.md) shows the first run.

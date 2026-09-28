# Getting started

## Prerequisites

- **Bun** 1.0+: Download from [bun.sh](https://bun.sh)
- **Redis**: Cache and job queue
  ```bash
  sudo apt install redis-server
  ```
- **Chrome/Chromium**: Only if `WHATSAPP_TRANSPORT=wwebjs` (the default). Leave
  CHROME_PATH empty to use the Chromium that puppeteer downloads on install. Not
  needed with `WHATSAPP_TRANSPORT=baileys`.
- **ffmpeg**: Audio/video
  ```bash
  sudo apt install ffmpeg
  ```
- **build-essential, python3**: Canvas needs native builds
  ```bash
  sudo apt install build-essential python3
  ```
- **Supabase**: PostgreSQL database
- **Spotify API** (optional): For `/spot`
- **Imgur API** (optional): For `/edit`

## Steps

1. Clone:

   ```bash
   git clone https://github.com/totallynotdavid/bot-whatsapp
   cd bot-whatsapp
   ```

   This repo is a bun workspace. This bot lives in `apps/whatsapp-bot`; the
   WhatsApp transport packages it depends on live in `packages/`. See the
   [root readme](../../../readme.md#workspace-layout) for the layout.

2. Copy example:

   ```bash
   cp apps/whatsapp-bot/.env.example apps/whatsapp-bot/.env
   ```

3. Open `apps/whatsapp-bot/.env` and fill the 3 **required** variables:
   - **OWNER_PHONE**: Your WhatsApp number (10–15 digits, no spaces)
   - **SUPABASE_URL**: URL of your Supabase project
   - **SUPABASE_KEY**: Supabase anon key

   See [Configuration](configuration.md) for all variables and defaults,
   including `WHATSAPP_TRANSPORT` to choose between whatsapp-web.js and Baileys.

4. Create tables in Supabase (see [Database](database.md)):
   - `paid_users`
   - `premium_groups`

5. Install (from the repo root):

   ```bash
   bun install
   ```

6. Start (from `apps/whatsapp-bot`, or with
   `bun run --filter '@bot-whatsapp/whatsapp-bot' start` from the root):

   ```bash
   cd apps/whatsapp-bot
   bun start
   ```

   The logs show a `whatsapp_qr_generated` event when a QR is ready to scan.

7. Scan the QR with WhatsApp on your phone. The bot authenticates and connects.

8. In a private chat with the bot, type:

   ```
   /help
   ```

   You'll see the list of available commands.

   In a group, regular commands respond only if the group is registered and
   active. Register it with `/addgroup` (see [commands](commands.md)).

## Example: Your first command

In a chat, try:

```
/subscription
```

Response (user without premium):

```
No tienes una suscripción premium activa.
```

To test a queued command, reply to an image with:

```
/sticker
```

The bot converts the image to sticker. `/spot` and `/edit` need optional
credentials from [configuration](configuration.md).

## Notes

- WhatsApp session data is saved in `.wwebjs_auth` (whatsapp-web.js) or
  `.baileys_auth` (Baileys), depending on `WHATSAPP_TRANSPORT`. Do not commit
  either to git (already in `.gitignore`).
- Redis must be running: `redis-server` (or your init system).
- Logs in the terminal show what the bot is doing.

## Cleanup

To delete WhatsApp session during development:

```bash
bun run clean:session:dev
```

In production (PM2):

```bash
bun run clean:session:prod
```

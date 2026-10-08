# Getting started

This page takes you from a clone to the bot answering `/help` in WhatsApp.

## Prerequisites

- [Bun](https://bun.sh). `mise.toml` pins the version the project is tested
  with.
- Redis, for the job queues and the `/docs` search results. On Debian or Ubuntu:
  `sudo apt install redis-server`. `redis-cli ping` prints `PONG` when it runs.
- ffmpeg, to convert media for stickers. On Debian or Ubuntu:
  `sudo apt install ffmpeg`.
- Chrome or Chromium, with `WHATSAPP_TRANSPORT=wwebjs` (the default) and for
  `/docs` downloads from `/slow_download/` mirrors. `bun install` downloads a
  Chromium for puppeteer. Set `CHROME_PATH` to use your own.
- A [Supabase](https://supabase.com) project.
- A phone with WhatsApp, to scan the QR code. The bot logs in as that number.

`canvas`, used by `/edit`, installs a prebuilt binary on common platforms. If
none matches, `bun install` compiles it, which needs
`sudo apt install build-essential python3`.

## Steps

1. Clone and install. The repo is a bun workspace and the bot is in
   `apps/whatsapp-bot`.

   ```bash
   git clone https://github.com/totallynotdavid/bot-whatsapp
   cd bot-whatsapp
   bun install
   ```

2. Create the tables. Run [`sql/schema.sql`](../sql/schema.sql) in the Supabase
   SQL editor. [Database](database.md) describes them.

3. Create the configuration.

   ```bash
   cp apps/whatsapp-bot/.env.example apps/whatsapp-bot/.env
   ```

   Fill in the three required variables: `OWNER_PHONE` (your WhatsApp number,
   digits only), `SUPABASE_URL` and `SUPABASE_KEY`.
   [Configuration](configuration.md) lists the rest, including
   `WHATSAPP_TRANSPORT` to choose between whatsapp-web.js and Baileys.

4. Start the bot.

   ```bash
   cd apps/whatsapp-bot
   bun start
   ```

   The first start prints a QR code in the terminal. On your phone, open _Linked
   devices_ in WhatsApp and scan it. The bot logs `WhatsApp client ready` when
   it is connected. The login is saved in `.wwebjs_auth` or `.baileys_auth`, so
   the next start needs no QR code.

## First commands

Message the bot's number from another number. In a private chat every command
works.

```
/help
```

The bot lists the commands your rank can use. `OWNER_PHONE` has the Owner rank
and sees all of them. Try `/subscription`. A user without premium gets:

```
No tienes una suscripción premium activa.
```

Reply to an image with `/sticker` to run a command that goes through the job
queue. `/spot` and `/edit` need the optional credentials in
[configuration](configuration.md).

### Use the bot in a group

Add the bot's number to a group. A Regular command in a group answers only after
a Premium user or the owner registers the group:

```
/addgroup
```

`/bot off` and `/bot on` switch the bot off and on in a registered group.
[Commands](commands.md) lists the rest.

## Start again from scratch

To delete the WhatsApp login and the browser cache during development, from
`apps/whatsapp-bot`:

```bash
bun run clean:session:dev
```

The next start shows a new QR code. [Deployment](deployment.md) covers the
production equivalent.

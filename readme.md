# WhatsAppBot

A WhatsApp bot in TypeScript, run with Bun. It turns images and videos into
stickers, sends Spotify previews, downloads books from Anna's Archive, applies
meme effects to profile pictures, and limits groups to premium users. It replies
only in Spanish.

## Workspace layout

This repository is a bun workspace, with one lockfile, one oxlint/oxfmt config
and one `mise run check` for the whole thing:

- `apps/whatsapp-bot`: the bot itself (commands, jobs, the database and queue
  adapters). See its [docs](apps/whatsapp-bot/docs/readme.md).
- `apps/sumibot`: [SumiBot](apps/sumibot/readme.md), a small bot that logs a
  library's opening and closing from photos sent to a group. Its docs are in
  Spanish.
- `packages/whatsapp`: the `WhatsAppTransport` contract the app codes against —
  connect and disconnect, incoming messages, send text and media, and the group
  operations the commands need. It names no library.
- `packages/whatsapp-wwebjs`: a transport adapter over
  [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js).
- `packages/whatsapp-baileys`: a transport adapter over
  [Baileys](https://github.com/WhiskeySockets/Baileys).

Each app picks an adapter with one config value, `WHATSAPP_TRANSPORT` (`wwebjs`
or `baileys`), read in its `src/config/`. The default is `wwebjs` for
`apps/whatsapp-bot` and `baileys` for `apps/sumibot`.
`src/bootstrap/container.ts` is the only file in an app that names a transport
package. Both adapters are checked against the same contract test suite, run
with their library faked. See
[architecture.md](apps/whatsapp-bot/docs/architecture.md#whatsapp-transport).

## Get started

You need Bun, Redis, ffmpeg, and a Supabase project with two tables
([database](apps/whatsapp-bot/docs/database.md)). Chrome or Chromium is only
needed with the default `wwebjs` transport.

```bash
git clone https://github.com/totallynotdavid/bot-whatsapp
cd bot-whatsapp
bun install

cp apps/whatsapp-bot/.env.example apps/whatsapp-bot/.env
# Edit apps/whatsapp-bot/.env: OWNER_PHONE, SUPABASE_URL, SUPABASE_KEY (required)

cd apps/whatsapp-bot
bun start
# The first start draws a QR in the terminal: scan it with WhatsApp
```

Then, in a chat with the bot:

```
User: /help
Bot: 🤖 *Comandos del bot*

Comandos disponibles (REGULAR):

/docs
/edit
/help
/kick
/spot
/sticker
/subscription

Escribe /help <comando> para más detalles.
```

[Getting started](apps/whatsapp-bot/docs/getting-started.md) covers each step.

## Features

- `/sticker`: image or video to sticker.
- `/spot artist|song`: 30-second Spotify preview.
- `/say [-voice] text`: Spanish voice note from text or a replied message (needs
  AWS credentials for Amazon Polly).
- `/docs search`: search and download from Anna's Archive.
- `/edit effect @user`: meme effects on profile pictures (needs an Imgur client
  ID).
- `/tex <código LaTeX>`: renders LaTeX math as a PNG image.
- `/subscription`: premium status and expiry.
- `/addgroup`, `/bot on|off`: register a group and switch the bot on or off
  there.
- `/kick`: remove a user. Only WhatsApp group admins and the owner can use it.
- `/addpremium`, `/refresh`, `/global`: owner tools.

Stickers, Spotify and documents run as queue jobs (BullMQ on Redis) with retries
and one failure reply. See
[how it works](apps/whatsapp-bot/docs/how-it-works.md).

The bot has no HTTP server and opens no ports. It runs one WhatsApp session per
process, so one process serves one number. Premium is granted by hand with
`/addpremium`. There are no payments.

## Documentation

Start with [getting started](apps/whatsapp-bot/docs/getting-started.md). The
[manual](apps/whatsapp-bot/docs/readme.md) lists the rest: configuration,
database, commands, deployment, development, architecture and how it works.

## License

This project is licensed under the [MIT License](LICENSE).

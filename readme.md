# WhatsAppBot

A WhatsApp bot in TypeScript, run with Bun. It turns images and videos into stickers, sends
Spotify previews, downloads books from Anna's Archive, applies meme effects to profile pictures,
and limits groups to premium users. It replies only in Spanish.

## Get started

You need Bun, Redis, ffmpeg, Chrome or Chromium, and a Supabase project with two tables
([database](docs/database.md)).

```bash
git clone https://github.com/totallynotdavid/bot-whatsapp
cd bot-whatsapp
bun install

cp .env.example .env
# Edit .env: OWNER_PHONE, SUPABASE_URL, SUPABASE_KEY (required)

bun start
# Scan the QR in the terminal with WhatsApp
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

[Getting started](docs/getting-started.md) covers each step.

## Features

- `/sticker`: image or video to sticker.
- `/spot artist|song`: 30-second Spotify preview.
- `/say [-voice] text`: Spanish voice note from text or a replied message (needs AWS credentials for Amazon Polly).
- `/docs search`: search and download from Anna's Archive.
- `/edit effect @user`: meme effects on profile pictures (needs an Imgur client ID).
- `/subscription`: premium status and expiry.
- `/addgroup`, `/bot on|off`: register a group and switch the bot on or off there.
- `/kick`: remove a user. Only WhatsApp group admins and the owner can use it.
- `/addpremium`, `/refresh`, `/global`: owner tools.

Stickers, Spotify and documents run as queue jobs (BullMQ on Redis) with retries and one failure
reply. See [how it works](docs/how-it-works.md).

The bot has no HTTP server and opens no ports. It runs one WhatsApp session per process, so one
process serves one number. Premium is granted by hand with `/addpremium`. There are no payments.

## Documentation

Start with [getting started](docs/getting-started.md). The [manual](docs/readme.md) lists the
rest: configuration, database, commands, deployment, development, architecture and how it works.

## License

This project is licensed under the [MIT License](LICENSE).

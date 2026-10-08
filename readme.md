# WhatsAppBot

A WhatsApp bot for Spanish-speaking groups, written in TypeScript and run with
Bun. It turns images and videos into stickers, sends Spotify previews, downloads
books from Anna's Archive, reads text aloud, renders LaTeX and applies meme
effects to profile pictures. A group gets these commands after a premium user
registers it.

The bot replies only in Spanish. One process serves one WhatsApp number. It has
no HTTP server. Premium is granted by hand with `/addpremium`. There are no
payments.

```
User: /help
Bot: 🤖 *Comandos del bot*

Comandos disponibles (REGULAR):

/docs
/edit
/help
/kick
/say
/spot
/sticker
/subscription
/tex

Escribe /help <comando> para más detalles.
```

## Install

You need [Bun](https://bun.sh), Redis, ffmpeg and a Supabase project with two
tables ([`apps/whatsapp-bot/sql/schema.sql`](apps/whatsapp-bot/sql/schema.sql)).

```bash
git clone https://github.com/totallynotdavid/bot-whatsapp
cd bot-whatsapp
bun install

cp apps/whatsapp-bot/.env.example apps/whatsapp-bot/.env
# Edit apps/whatsapp-bot/.env: OWNER_PHONE, SUPABASE_URL, SUPABASE_KEY

cd apps/whatsapp-bot
bun start
```

The first start prints a QR code in the terminal. Scan it from WhatsApp under
_Linked devices_. [Getting started](apps/whatsapp-bot/docs/getting-started.md)
lists every prerequisite and walks through the first commands.

## Features

- `/sticker`: image or video to sticker.
- `/spot artist|song`: 30-second Spotify preview.
- `/say [-voice] text`: Spanish voice note, from text or a replied message.
- `/docs search`: search and download from Anna's Archive.
- `/edit effect @user`: meme effects on profile pictures.
- `/tex code`: LaTeX math as a PNG image.
- `/kick`: remove a user from a group.
- `/subscription`: premium status and expiry.
- `/addgroup`, `/bot on|off`: register a group, and switch the bot on or off
  there.
- `/addpremium`, `/refresh`, `/global`: owner tools.

Stickers, Spotify previews and document downloads run as queue jobs (BullMQ on
Redis) with retries and one failure reply.
[Commands](apps/whatsapp-bot/docs/commands.md) lists usage, aliases and ranks.

## Workspace layout

A bun workspace with one lockfile and one set of checks.

| Path                        | Holds                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `apps/whatsapp-bot`         | The bot above: commands, jobs, and the database and queue adapters.                 |
| `apps/sumibot`              | [SumiBot](apps/sumibot/readme.md): logs a library's opening and closing.            |
| `packages/whatsapp`         | The `WhatsAppTransport` contract the apps code against. It names no library.        |
| `packages/whatsapp-wwebjs`  | A transport over [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js). |
| `packages/whatsapp-baileys` | A transport over [Baileys](https://github.com/WhiskeySockets/Baileys).              |

## Documentation

- [Manual](apps/whatsapp-bot/docs/readme.md): setup, configuration, commands,
  deployment and how the bot works.
- [Architecture](apps/whatsapp-bot/docs/architecture.md): the code map and the
  layering rules.
- [Contributing](.github/contributing.md): set up, check and change the code.

## License

[MIT](LICENSE).

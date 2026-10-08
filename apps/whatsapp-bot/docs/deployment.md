# Deployment

In production, run the bot under [PM2](https://pm2.keymetrics.io/), which
restarts it when it exits. PM2 is not a project dependency. Install it on the
server:

```bash
bun add -g pm2
```

The server also needs what [Getting started](getting-started.md) lists and a
`.env` in `apps/whatsapp-bot` ([configuration](configuration.md)). `NODE_ENV`
defaults to `production`.

## Start

From the repo root:

```bash
bun run start:prod
```

This runs the `start:prod` script of `@bot-whatsapp/whatsapp-bot`:

```bash
pm2 start "bun src/main.ts" --name whatsapp-bot --exp-backoff-restart-delay=1000 && bun run logs
```

Bun runs the script from `apps/whatsapp-bot`, so PM2, `.env` and the WhatsApp
session directories all resolve there. The script starts the bot as
`whatsapp-bot`, then follows the PM2 logs.

On the first start the QR code appears in the logs. Scan it with WhatsApp.

## Restarts

The bot exits when its WhatsApp session ends
([when WhatsApp disconnects](how-it-works.md#when-whatsapp-disconnects)), and
PM2 starts it again. `--exp-backoff-restart-delay=1000` makes PM2 wait before
each restart, starting at about 1 second and growing while the bot keeps
exiting. A bot that cannot stay up does not hammer WhatsApp. Every disconnect is
logged as a `whatsapp_disconnected` event, on both transports:

```bash
pm2 log whatsapp-bot | grep whatsapp_disconnected
```

`pm2 stop` and `pm2 delete` stop it for good. PM2 sends a signal, the bot shuts
down and exits with code 0, and PM2 does not start it again.

## Manage the process

| Command                    | Does                                       |
| -------------------------- | ------------------------------------------ |
| `pm2 log whatsapp-bot`     | Shows the bot's logs.                      |
| `pm2 monit`                | Opens a live monitor.                      |
| `pm2 restart whatsapp-bot` | Restarts the bot.                          |
| `pm2 stop whatsapp-bot`    | Stops the bot.                             |
| `pm2 delete whatsapp-bot`  | Removes the bot from PM2.                  |
| `bun run clean:logs`       | Deletes `~/.pm2/logs`, from the repo root. |

Logs accumulate in `~/.pm2/logs/` until you clean them. `clean:logs` removes the
logs of every process PM2 manages.

## WhatsApp session data

The bot saves its login in `apps/whatsapp-bot/.wwebjs_auth` with
`WHATSAPP_TRANSPORT=wwebjs`, or `apps/whatsapp-bot/.baileys_auth` with
`baileys`. Both are in `.gitignore`.

- The directory survives restarts, and PM2 does not touch it.
- Delete it only to log in again with a new QR code.
- If the server fails you lose the session. Back the directory up if a new QR
  scan is a problem for you.

### Log in again

After an authentication failure, or when the session is stuck:

1. Stop the bot: `pm2 stop whatsapp-bot`
2. Delete the sessions: `bun run clean:session:prod` from `apps/whatsapp-bot`.
   It removes both `.wwebjs_auth` and `.baileys_auth`.
3. Start it: `pm2 restart whatsapp-bot`
4. Scan the QR code in `pm2 log whatsapp-bot`.

With Baileys, a revoked session (`loggedOut`) clears its own credentials. PM2
restarts the bot and a QR code appears, so steps 1 to 3 are not needed.

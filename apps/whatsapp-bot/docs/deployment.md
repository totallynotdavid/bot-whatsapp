# Deployment

In production, run with PM2 for automatic restarts. PM2 is not a project
dependency. Install it on the server:

```bash
bun add -g pm2
```

## Start

From `apps/whatsapp-bot`:

```bash
bun run start:prod
```

This runs
`pm2 start "bun src/main.ts" --name whatsapp-bot --cron-restart="0 */4 * * *"`
and tails the logs. It:

- Starts the bot named `whatsapp-bot`.
- Restarts every 4 hours (cron: `:00` at 0, 4, 8, 12, 16, 20 hours).

- View logs: `pm2 log whatsapp-bot`
- Live monitor: `pm2 monit`
- Stop: `pm2 stop whatsapp-bot`
- Remove from PM2: `pm2 delete whatsapp-bot`

## Environment variables

Create a `.env` on the server. [Configuration](configuration.md) lists every
variable. The three required ones are enough to start. `NODE_ENV` defaults to
`production`.

## WhatsApp session data

The bot saves authentication in `.wwebjs_auth` (whatsapp-web.js) or
`.baileys_auth` (Baileys), depending on `WHATSAPP_TRANSPORT` (directory in
`apps/whatsapp-bot`).

- **Don't delete** unless you want to re-authenticate (new QR).
- **Persists across restarts**: PM2 doesn't delete the directory.
- **Backup**: If server fails, you lose the session. Consider periodic backups.

If you lose connection or need to re-authenticate:

1. Stop: `pm2 stop whatsapp-bot`
2. Clean: `bun run clean:session:prod` (deletes both `.wwebjs_auth` and
   `.baileys_auth`)
3. Start: `pm2 restart whatsapp-bot`
4. Scan the new QR.

## Disconnections

Bot logs disconnections as a `whatsapp_disconnected` event, on both transports.
It doesn't try to reconnect automatically. If it happens:

1. Check logs: `pm2 log whatsapp-bot | grep -i disconnect`
2. If temporary, wait; PM2 will restart in 4 hours.
3. If persistent, restart: `pm2 restart whatsapp-bot`
4. If authentication, run `bun run clean:session:prod` and re-authenticate.

## PM2 cleanup

Logs accumulate in `~/.pm2/logs/`. Clean, from the repo root:

```bash
bun run clean:logs
```

# Deployment

In production, run with PM2 for automatic restarts. PM2 is not a project dependency. Install it on the server:

```bash
bun add -g pm2
```

## Start

```bash
pm2 start "bun src/main.ts" --name whatsapp-bot --cron-restart="0 */4 * * *"
```

This:
- Starts the bot named `whatsapp-bot`.
- Restarts every 4 hours (cron: `:00` at 0, 4, 8, 12, 16, 20 hours).

- View logs: `pm2 log whatsapp-bot`
- Live monitor: `pm2 monit`
- Stop: `pm2 stop whatsapp-bot`
- Remove from PM2: `pm2 delete whatsapp-bot`

## Environment variables

Create a `.env` on the server. [Configuration](configuration.md) lists every variable. The
three required ones are enough to start. `NODE_ENV` defaults to `production`.

## WhatsApp session data

Bot saves authentication in `.wwebjs_auth` (directory in project root).

- **Don't delete** unless you want to re-authenticate (new QR).
- **Persists across restarts**: PM2 doesn't delete the directory.
- **Backup**: If server fails, you lose the session. Consider periodic backups.

If you lose connection or need to re-authenticate:
1. Stop: `pm2 stop whatsapp-bot`
2. Clean: `bun run clean:session:prod` (deletes `.wwebjs_auth`)
3. Start: `pm2 restart whatsapp-bot`
4. Scan the new QR.

## Disconnections

Bot logs disconnections in logs (`"WhatsApp client disconnected"`). It doesn't try to reconnect automatically. If it happens:

1. Check logs: `pm2 log whatsapp-bot | grep -i disconnect`
2. If temporary, wait; PM2 will restart in 4 hours.
3. If persistent, restart: `pm2 restart whatsapp-bot`
4. If authentication, clean `.wwebjs_auth` and re-authenticate.

## PM2 cleanup

Logs accumulate in `~/.pm2/logs/`. Clean:
```bash
bun run clean:logs
```

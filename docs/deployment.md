# Deployment

En producción, ejecuta con PM2 para restarts automáticos.

## Ejecutar

```bash
pm2 start "bun src/main.ts" --name whatsapp-bot --cron-restart="0 */4 * * *"
```

Esto:
- Inicia el bot con el nombre `whatsapp-bot`.
- Reinicia cada 4 horas (cron: `:00` a las 0, 4, 8, 12, 16, 20 horas).

Ver logs: `pm2 log whatsapp-bot`  
Monitor en vivo: `pm2 monit`  
Detener: `pm2 stop whatsapp-bot`  
Eliminar de PM2: `pm2 delete whatsapp-bot`

## Variables de entorno

Crea un `.env` en el servidor con las variables de [Configuración](configuration.md). Ejemplo:

```
NODE_ENV=production
LOG_LEVEL=info
OWNER_PHONE=34612345678
COMMAND_PREFIX=/
SUPABASE_URL=https://abc.supabase.co
SUPABASE_KEY=anon-key-here
REDIS_HOST=localhost
REDIS_PORT=6379
CHROME_PATH=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
IMGUR_CLIENT_ID=
```

## Datos de sesión WhatsApp

El bot guarda autenticación en `.wwebjs_auth` (directorio en raíz del proyecto).

- **No elimines** a menos que quieras re-autenticar (nuevo QR).
- **Persiste entre restarts**: PM2 no borra el directorio.
- **Backup**: Si el servidor falla, perderás la sesión. Considera backup periódico.

Si pierdes la conexión o necesitas re-autenticar:
1. Detén: `pm2 stop whatsapp-bot`
2. Limpia: `bun run clean:session:prod` (elimina `.wwebjs_auth`)
3. Inicia: `pm2 restart whatsapp-bot`
4. Escanea el nuevo QR.

## Desconexiones

El bot registra desconexiones en los logs (`"WhatsApp client disconnected"`). No intenta reconectar automáticamente. Si ocurre:

1. Verifica los logs: `pm2 log whatsapp-bot | grep -i disconnect`
2. Si es temporal, espera; PM2 reiniciará a las 4 horas.
3. Si es persistente, reinicia: `pm2 restart whatsapp-bot`
4. Si es autenticación, limpia `.wwebjs_auth` y re-autentica.

## Cleanup de PM2

Logs acumulan en `~/.pm2/logs/`. Limpiar:
```bash
bun run clean:logs
```

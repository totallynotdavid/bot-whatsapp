# Configuración

Las variables de entorno se validan contra `src/config/schema.ts` al iniciar. Bun carga `.env` automáticamente; no es necesario `--env-file`.

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| NODE_ENV | No | `production` | Entorno: `development`, `production`, `test` |
| LOG_LEVEL | No | `info` | Nivel de logs: `debug`, `info`, `warn`, `error` |
| OWNER_PHONE | **Sí** | — | Tu número WhatsApp (10–15 dígitos, ej: `34612345678`). Eres el propietario (rango Owner). |
| COMMAND_PREFIX | No | `/` | Carácter que dispara comandos |
| SUPABASE_URL | **Sí** | — | URL de tu proyecto Supabase (ej: `https://abc.supabase.co`) |
| SUPABASE_KEY | **Sí** | — | Clave anon de Supabase (32+ caracteres) |
| REDIS_HOST | No | `localhost` | Host de Redis |
| REDIS_PORT | No | `6379` | Puerto de Redis |
| CHROME_PATH | No | — | Ruta a Chrome/Chromium binario. Vacío = puppeteer descarga Chromium automáticamente |
| SPOTIFY_CLIENT_ID | No | — | Credencial Spotify. Sin esto, `/spot` no funciona |
| SPOTIFY_CLIENT_SECRET | No | — | Credencial Spotify. Sin esto, `/spot` no funciona |
| IMGUR_CLIENT_ID | No | — | Credencial Imgur. Sin esto, `/edit` falla |

**Notas:**
- Las 3 variables requeridas deben estar siempre presentes.
- Las opcionales pueden dejarse vacías; los comandos que las usan fallarán con mensaje amigable.
- CHROME_PATH vacío es el caso común; puppeteer maneja el binario.

Ver [Inicio rápido](getting-started.md) para setup inicial.

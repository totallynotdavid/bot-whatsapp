# Inicio rápido

## Requisitos

- **Bun** 1.0+: Descarga de [bun.sh](https://bun.sh)
- **Node 18+** (para npm, si usas Bun via npm)
- **Redis**: Caché y cola de trabajos
  ```bash
  sudo apt install redis-server
  ```
- **Chrome/Chromium**: Para whatsapp-web.js (o dejar vacío CHROME_PATH para auto-detección)
- **ffmpeg**: Audio/video
  ```bash
  sudo apt install ffmpeg
  ```
- **build-essential, python3**: Canvas requiere nativos
  ```bash
  sudo apt install build-essential python3
  ```
- **Supabase**: Base de datos PostgreSQL
- **Spotify API** (opcional): Para `/spot`
- **Imgur API** (opcional): Para `/edit`

## Pasos

1. Clona:
   ```bash
   git clone https://github.com/totallynotdavid/bot-whatsapp
   cd bot-whatsapp
   ```

2. Copia ejemplo:
   ```bash
   cp .env.example .env
   ```

3. Abre `.env` y completa las 3 variables **requeridas**:
   - **OWNER_PHONE**: Tu número WhatsApp (10–15 dígitos, sin espacios)
   - **SUPABASE_URL**: URL de tu proyecto Supabase
   - **SUPABASE_KEY**: Clave anon de Supabase

   Ver [Configuración](configuration.md) para todas las variables y defaults.

4. Crea las tablas en Supabase (ver [Base de datos](database.md)):
   - `paid_users`
   - `premium_groups`

5. Instala:
   ```bash
   bun install
   ```

6. Inicia:
   ```bash
   bun start
   ```

   Verás un QR en la terminal.

7. Escanea el QR con WhatsApp en tu teléfono. El bot se autentica y conecta.

8. En un chat (privado o grupo), escribe:
   ```
   /help
   ```

   Verás la lista de comandos disponibles.

## Ejemplo: Tu primer comando

En un chat, prueba:

```
/subscription
```

Respuesta (usuario sin premium):
```
No tienes una suscripción premium activa.
```

Ahora prueba:

```
/spot queen bohemian rhapsody
```

El bot busca en Spotify, procesa, y envía un audio de 30 segundos.

## Notas

- Los datos de sesión WhatsApp se guardan en `.wwebjs_auth`. No commitees a git (ya está en `.gitignore`).
- Redis debe estar corriendo: `redis-server` (o tu init system).
- Logs en la terminal muestran lo que hace el bot.

## Limpieza

Para borrar sesión de WhatsApp durante desarrollo:
```bash
bun run clean:session:dev
```

En producción (PM2):
```bash
bun run clean:session:prod
```

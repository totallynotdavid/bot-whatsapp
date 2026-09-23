# WhatsAppBot

Un bot de WhatsApp multifuncional en TypeScript con Bun. Maneja comandos, convierte stickers, busca música en Spotify, descarga documentos, aplica efectos a fotos, y gestiona suscripciones premium. Corre localmente con un cliente WhatsApp; no requiere HTTP ni servidor externo.

## Ejecutar ahora

```bash
git clone https://github.com/totallynotdavid/bot-whatsapp
cd bot-whatsapp
bun install

cp .env.example .env
# Edita .env: OWNER_PHONE, SUPABASE_URL, SUPABASE_KEY (requeridas)

bun start
# Escanea el QR en la terminal con WhatsApp
```

Luego en un chat:

```
Usuario: /help
Bot: 🤖 *Comandos del bot*
/help: Muestra la lista de comandos...
...
```

## Alcance

- Responde solo en español.
- Usa una sesión de WhatsApp por proceso: un proceso, un número.
- No abre puertos. No hay servidor HTTP.
- El premium se otorga con `/addpremium`. No hay pagos automáticos.
- Los stickers, Spotify, documentos y efectos corren en una cola (BullMQ sobre Redis).

## Comandos

- **Stickers**: `/sticker` — imagen/video → sticker
- **Spotify**: `/spot artista|cancion` — preview de 30 segundos
- **Documentos**: `/docs busqueda` — descargar de Anna's Archive
- **Efectos**: `/edit efecto @usuario` — meme effects (requiere Imgur)
- **Suscripción**: `/subscription` — estado premium
- **Grupo**: `/addgroup`, `/bot on|off` — registra grupo, activa/desactiva
- **Admin**: `/kick` — expulsa usuario
- **Dueño**: `/addpremium`, `/refresh`, `/global` — gestión

Ver [docs/commands.md](docs/commands.md) para todos.

## Documentación

- [Docs](docs/README.md) — índice
- [Inicio rápido](docs/getting-started.md) — instalación paso a paso
- [Configuración](docs/configuration.md) — variables de entorno
- [Base de datos](docs/database.md) — tablas Supabase y SQL
- [Deployment](docs/deployment.md) — PM2, sesión, production
- [Desarrollo](docs/development.md) — tests, lint, agregar comandos

[Licencia MIT](LICENSE)

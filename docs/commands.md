# Referencia de comandos

Los comandos se disparan con un prefijo (default `/`). Cada usuario tiene un rango (Regular → Premium → Admin → Owner).

## Regular

Todos los usuarios.

| Comando | Alias | Uso | Descripción |
|---------|-------|-----|-------------|
| `/help` | `h`, `ayuda` | `/help` o `/help comando` | Muestra la lista de comandos o detalles de uno. |
| `/subscription` | `suscripcion`, `sub` | `/subscription` | Muestra tu estado premium y fecha de vencimiento. |
| `/sticker` | `s`, `stiker` | Envía con imagen/video adjunto o responde a una | Convierte una imagen o video en sticker. |
| `/spot` | `spotify`, `spt` | `/spot artista\|cancion` | Busca en Spotify y envía un preview de 30 segundos. **Requiere:** SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET. |
| `/docs` | `documentos`, `libros` | `/docs busqueda` o `/docs numero` | Busca y descarga documentos de Anna's Archive. Usa números para seleccionar de resultados previos (caché en Redis por usuario). |
| `/edit` | — | `/edit efecto @usuario1 @usuario2 [param]` | Aplica un efecto meme a fotos de perfil. **Requiere:** IMGUR_CLIENT_ID. Escribe `/help edit` para ver efectos. |

Pesadas (toman tiempo): sticker, spot, docs, edit.

## Premium

Usuarios con suscripción activa (fecha de vencimiento > ahora).

| Comando | Alias | Uso | Descripción |
|---------|-------|-----|-------------|
| `/addgroup` | — | `/addgroup` | Registra el grupo actual bajo tu número. Solo si lo administras en WhatsApp. |
| `/bot` | — | `/bot on` o `/bot off` | Activa o desactiva el bot en tu grupo registrado. |

## Admin

Rango `Admin`. Solo el owner lo cumple hoy (ver [Rangos](#rangos)).

| Comando | Alias | Uso | Descripción |
|---------|-------|-----|-------------|
| `/kick` | `ban`, `expulsar` | Responde a un mensaje o menciona al usuario | Expulsa a un usuario del grupo. |

## Owner

Solo el número en OWNER_PHONE.

| Comando | Alias | Uso | Descripción |
|---------|-------|-----|-------------|
| `/addpremium` | `darpremium`, `premium` | Responde a un mensaje con `/addpremium 30` | Otorga N días de premium. |
| `/refresh` | — | `/refresh` | Limpia la caché de usuarios en memoria. |
| `/global` | — | `/global tu mensaje` | Envía un mensaje a todos los usuarios premium activos. |

## Rangos

1. **Regular**: Todos.
2. **Premium**: Usuarios con `premium_expiry > ahora` en `paid_users`.
3. **Admin**: `/kick` exige este rango. Ningún usuario lo recibe, así que hoy solo el owner ejecuta `/kick`.
4. **Owner**: El número en OWNER_PHONE.

El rango sube automáticamente: si eres Owner, tienes acceso Owner+Admin+Premium+Regular.

# SumiBot

SumiBot es un bot de WhatsApp en TypeScript, ejecutado con Bun, que registra la
apertura y el cierre de una biblioteca. Quien abre o cierra envía una foto de la
biblioteca con el comando como pie de foto. El bot guarda la foto y anota quién
lo hizo y cuándo. Solo responde en grupos y en español.

Vive en este workspace junto a los paquetes de transporte de WhatsApp. Ver el
[readme raíz](../../readme.md#workspace-layout).

## Instalación

Necesitas [Bun](https://bun.sh) y un proyecto de Supabase con las tablas
descritas más abajo.

```bash
git clone https://github.com/totallynotdavid/bot-whatsapp
cd bot-whatsapp
bun install

cp apps/sumibot/.env.example apps/sumibot/.env
# Edita apps/sumibot/.env: OWNER_PHONE, SUPABASE_URL y SUPABASE_KEY son obligatorias

cd apps/sumibot
bun start
```

Bun carga el archivo `.env` solo. Con el transporte `baileys` (el
predeterminado) no hace falta Chrome.

### Vincular el número

En el primer arranque el bot dibuja un código QR en la terminal. Escanéalo desde
WhatsApp, en _Dispositivos vinculados_ > _Vincular un dispositivo_. Los
registros solo anotan que se generó un QR (el evento `whatsapp_qr_generated`),
nunca su contenido: quien lo escanee controla la cuenta, así que no lo compartas
ni lo copies a otro lugar.

La sesión queda en `.baileys_auth` (o en `.wwebjs_auth` con
`WHATSAPP_TRANSPORT=wwebjs`), así que el dispositivo se vincula una sola vez.
Para empezar de cero, borra la sesión con `bun run clean:session`.

Al conectarse, el bot envía `[INICIO]` al número del propietario.

## Configuración

Las variables se validan con zod al arrancar (`src/config/schema.ts`). Si alguna
es inválida, el bot lista todos los problemas y no arranca.

| Variable           | Obligatoria | Predeterminado | Descripción                                                             |
| ------------------ | ----------- | -------------- | ----------------------------------------------------------------------- |
| OWNER_PHONE        | **Sí**      | —              | Número del propietario, de 10 a 15 dígitos (por ejemplo `51999999999`). |
| SUPABASE_URL       | **Sí**      | —              | URL del proyecto de Supabase.                                           |
| SUPABASE_KEY       | **Sí**      | —              | Clave anon de Supabase (32 caracteres o más).                           |
| WHATSAPP_TRANSPORT | No          | `baileys`      | Biblioteca de WhatsApp: `baileys` o `wwebjs`.                           |
| COMMAND_PREFIX     | No          | `!`            | Carácter que activa los comandos (de 1 a 3 caracteres).                 |
| HTTP_HOST          | No          | `127.0.0.1`    | Interfaz donde escucha la API de envío. Usa `0.0.0.0` para exponerla.   |
| HTTP_PORT          | No          | `6000`         | Puerto de la API de envío.                                              |
| CHROME_PATH        | No          | —              | Ruta de Chrome o Chromium, solo con `WHATSAPP_TRANSPORT=wwebjs`.        |
| LOG_LEVEL          | No          | `info`         | `debug`, `info`, `warn` o `error`.                                      |
| NODE_ENV           | No          | `production`   | `development`, `production` o `test`.                                   |

Una variable presente pero vacía no usa el valor predeterminado: omite la línea.

### Base de datos

El bot usa estas tablas y este bucket de Supabase. Las personas se guardan por
su identificador de WhatsApp (`51999999999@s.whatsapp.net`), no por el número
solo.

| Tabla               | Columnas que usa                                                           |
| ------------------- | -------------------------------------------------------------------------- |
| `libraryAttendance` | `timestamp`, `action` (`open` o `close`), `managerNumber`, `imageUrl`      |
| `librarians`        | `managerNumber`, `fullName`                                                |
| `CommandsUsage`     | `command_id`, `user_phone_number`, `command_name`, `execution_timestamp`   |
| `ErrorLogs`         | `error_message`, `user_phone_number`, `error_timestamp`, `additional_info` |

El bucket público `collaborators` guarda las fotos, en una carpeta por número.

## Comandos

Los comandos funcionan solo en grupos, para cualquier miembro. Un mensaje que no
empieza con el prefijo se ignora.

| Comando    | Qué hace                                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `!abierto` | Registra la apertura. Envíalo como pie de una foto de la biblioteca. Sin foto, el bot la pide.                                |
| `!cerrado` | Registra el cierre. Igual que `!abierto`, con foto.                                                                           |
| `!estado`  | Dice si la biblioteca está abierta y quién la abrió. Está abierta si la última apertura es más reciente que el último cierre. |
| `!revisar` | Envía las fotos de las aperturas de hoy, cada una con el nombre de quien abrió y la hora.                                     |

El bot reacciona con ✅ solo a un comando que se cumplió. Si el comando falla
(falta la foto, no se pudo guardar o leer, o no se pudo enviar alguna foto), el
bot avisa con un mensaje y no reacciona. Un comando desconocido no recibe
respuesta y se anota en `ErrorLogs`.

Si `!revisar` no puede enviar una foto, sigue con las demás y al final lista las
que faltaron.

## API de envío

El bot escucha en `HTTP_HOST:HTTP_PORT` y acepta un envío de texto:

```bash
curl -X POST http://127.0.0.1:6000/send-message \
  -H 'content-type: application/json' \
  -d '{"text": "Hola", "recipientNumber": "51999999999"}'
```

`recipientNumber` acepta un número (solo dígitos, de 10 a 15), el identificador
de una persona (`51999999999@s.whatsapp.net` o `51999999999@c.us`) o el de un
grupo (`120363000000000000@g.us`, que se usa tal cual). Si se omite, el mensaje
va al propietario.

| Código | Cuándo                                                                  |
| ------ | ----------------------------------------------------------------------- |
| `200`  | El mensaje se envió.                                                    |
| `400`  | Falta `text`, o `recipientNumber` no es un número ni un identificador.  |
| `404`  | La ruta no es `/send-message`.                                          |
| `405`  | El método no es `POST`.                                                 |
| `500`  | El envío falló. No se reintenta, para no entregar el mensaje dos veces. |

La API no pide autenticación: mantenla en `127.0.0.1` o detrás de un proxy que
la proteja.

## Desarrollo

Los comandos para formatear, revisar y probar el código están en
[Contributing](../../.github/contributing.md#check-a-change) (en inglés) y valen
para este bot. Las pruebas nunca se conectan a WhatsApp: usan un transporte
falso que registra lo que el bot envía y entrega mensajes como lo haría un
adaptador.

El código sigue las capas y las reglas de
[whatsapp-bot](../whatsapp-bot/docs/architecture.md), que `tests/static/`
verifica.

## Licencia

MIT.

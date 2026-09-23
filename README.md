# WhatsAppBot

WhatsAppBot es una aplicación escrita en Javacript, utiliza Node.js junto a [whatsapp-web.js](https://docs.wwebjs.dev/) para iniciar un bot. El bot tiene funcionalidades variadas, entre ellas:

-   Convierte imágenes, gifs y vídeos en stickers y viceversa
-   Busca y reproduce canciones de Spotify (vista previa provista a través de sus [APIs](https://developer.spotify.com/documentation/web-api/reference/search)) y Youtube (a través de [yt-dlp](https://github.com/yt-dlp/yt-dlp) y [ffmpeg](https://ffmpeg.org/ffmpeg.html))
-   Busca y reproduce vídeos de YouTube a través de [yt-dlp](https://github.com/yt-dlp/yt-dlp)
-   Busca la letra de canciones a través de scraping gracias al paquete [fetch-lyrics](https://github.com/susudeepa/fetch-lyrics)
-   Obtén información de Wikipedia (a través de su [API](https://en.wikipedia.org/w/api.php))
-   Tranforma texto en audio a través de [Amazon Polly](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/polly-examples.html)
-   Obtén imágenes de Reddit a través de su API no oficial
-   Transforma código LaTeX en imágenes
-   Busca y descarga artículos científicos de Sci-Hub
-   Busca y descarga archivos de Google Drive

También se provee de comandos especiales para usuarios de pago:

-   Menciona a todos los miembros del grupo
-   Añade o elimina usuarios del grupo
-   Activa o desactiva el bot en grupos en particular
-   Conversa con el bot utilizando el [modelo 'gpt-3.5-turbo-instruct'](https://platform.openai.com/docs/models) de OpenAI
-   Genera imágenes a través de [Bing Create](https://www.bing.com/images/create/) o la [API de Stability AI](https://platform.stability.ai/docs/api-reference#tag/Text-to-Image)

## Prerrequisitos

Desarrollo en Windows, pero hago deploy en un servidor que utiliza Ubuntu 22.04 así que no deberías de tener mucho problema en caso de ser usuario de Windows.

-   Node.js (nvm)

    ```bash
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
    ```

-   ffmpeg

    ```bash
    sudo apt install ffmpeg
    ```

-   yt-dlp

    ```bash
    sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
    sudo chmod a+rx /usr/local/bin/yt-dlp  # Make executable
    ```

-   [ImageMagick](https://stackoverflow.com/questions/52998331/imagemagick-security-policy-pdf-blocking-conversion)

    ```bash
    sudo apt install imagemagick -y
    ```

-   TeXLive

    ```bash
    cd /tmp
    wget https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz
    tar -xf install-tl-unx.tar.gz
    cd install-tl-*/
    sudo perl install-tl --no-interaction
    echo 'export PATH="/usr/local/texlive/2023/bin/x86_64-linux:$PATH"' >> ~/.bashrc
    source ~/.bashrc
    pdflatex --version
    ```

## Instalación

1. Clonar el repositorio

    ```bash
    git clone https://github.com/totallynotdavid/WhatsAppBot
    ```

2. Crear un `.env` y agregar las siguientes variables:

    - `spotify_client_id`
    - `spotify_client_secret`
    - `supabase_api_key`
    - `supabase_base_url`
    - `folder_id`
    - `adminNumber`
    - `YOUTUBE_API_KEY_1` (puedes aumentar varias keys, el bot rotará entre ellas)
    - `NODE_ENV`
    - `IMGUR_CLIENT_ID`
    - `OPENAI_API_KEY`
    - `STABILITY_API_KEY`
    - `BING_IMAGE_COOKIE`

3. Instalar las dependencias:

    ```bash
    npm install
    ```

4. Necesitas añadir tus credenciales de Amazon. En Linux, Unix, y macOS: `~/.aws/credentials`. Para Windows: `\Users\{usuario}\.aws\credentials`.

    ```bash
    [default]
    aws_access_key_id =
    aws_secret_access_key =
    ```

5. Inicia el bot por primera vez:

    ```bash
    node index.js
    ```

6. Puedes usar pm2 para mantener el bot funcionando continuamente:
    ```
    pm2 start index.js --cron-restart="*/15 * * * *"
    ```

> [!TIP]
> En mi caso, reinicio el bot cada 45 minutos para evitar acumulación en la memoria RAM, antes, utilizaba un servidor gratuito de Digital Ocean y mucho antes de AWS y al llegar al tope, el servidor se caía y tenía que reiniciarlo manualmente.

## Uso

El bot funciona interpretando los comandos que empiezan por `!` o `@`. Puedes redefinirlos en el archivo `config.dev.js` y `config.prod.js`. Para cambiar entre modos, modifica el valor `NODE_ENV` en `.env`.

## Pruebas

`bun run test` ejecuta las pruebas de `tests/` con vitest. Los comandos que solo hacen una llamada a un servicio externo en vivo (sesión real de WhatsApp, YouTube, Polly, Wikipedia, etc.) no tienen pruebas automáticas a propósito: probarlos exigiría simular una frontera que nada más en el proyecto necesita simular.

## Licencia

Este proyecto se encuentra bajo la [licencia MIT](LICENSE), lo que significa que es de código abierto y cualquier persona puede utilizarlo, modificarlo y distribuirlo libremente.

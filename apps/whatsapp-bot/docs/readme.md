# WhatsAppBot manual

This manual is for whoever runs the bot, and for whoever reads its code. The
pages go from first run to internals. To change the code, read
[Contributing](../../../.github/contributing.md).

1. [Getting started](getting-started.md): install the bot and run it for the
   first time.
2. [Configuration](configuration.md): environment variables and their defaults.
3. [Database](database.md): the Supabase tables and how to create them.
4. [Commands](commands.md): every command with its aliases, usage and rank.
5. [Deployment](deployment.md): run the bot under PM2, keep its session, log in
   again.
6. [How it works](how-it-works.md): the path of a message, jobs, disconnects and
   shutdown.
7. [Architecture](architecture.md): layers, ports, the WhatsApp transports and
   the rules tests enforce.

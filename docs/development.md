# Desarrollo

## Tests

Escribe tests con Vitest:

```bash
bun run test
```

Los tests viven en `tests/`.

Los comandos que solo hacen una llamada a un servicio externo en vivo (sesión real de WhatsApp, Spotify, Anna's Archive, Imgur) no tienen pruebas automáticas a propósito: probarlos exigiría simular una frontera que nada más en el proyecto necesita simular.

## Format, lint, typecheck

```bash
bun run format    # oxfmt en src/ y tests/
bun run lint      # oxlint (warnings son errores)
bun run typecheck # tsc --noEmit
```

Los 3 son requeridos antes de push.

## Flujo

1. Inicia `bun start`. Bun carga `.env` automáticamente.
2. Escanea el QR con WhatsApp.
3. Prueba comandos en un chat.
4. Mira logs en la terminal.

Para limpiar sesión durante desarrollo:
```bash
bun run clean:session:dev
```

## Agregar un comando

1. Crea `src/application/commands/mi-comando.ts`:
   ```typescript
   import { BaseCommand } from "./base-command";
   import type { CommandMetadata, CommandContext, CommandResult } from "../../domain/command";
   import { Rank } from "../../domain/user";

   export class MiCommand extends BaseCommand {
     readonly metadata: CommandMetadata = {
       name: "micomando",
       aliases: [],
       minRank: Rank.REGULAR,
       description: "Hace algo",
       usage: "micomando",
       isHeavyOperation: false,
     };

     protected async executeImpl(context: CommandContext): Promise<CommandResult> {
       return { type: "text", content: "¡Hola!" };
     }
   }
   ```

2. Regístralo en `src/bootstrap/container.ts` en `registerCommands()`:
   ```typescript
   executor.registerCommand(new MiCommand(...deps));
   ```

3. Si es pesado (larga duración), úsalo con `JobScheduler`. Ver `SpotifyCommand` como ejemplo.

4. Escribe una prueba en `tests/mi-comando.test.ts` (opcional pero recomendado).

5. Corre tests y lint: `bun run test && bun run lint && bun run format`.

## Debug

Logs JSON con timestamp y nivel:

```bash
LOG_LEVEL=debug bun start
```

Los logs van a stdout. Usa pipes o redirección para guardar.

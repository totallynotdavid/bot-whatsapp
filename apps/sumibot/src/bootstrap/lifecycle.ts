import type { Logger, WhatsAppTransport } from "@bot-whatsapp/whatsapp";
import type { MessageHandler } from "../application/handlers/message-handler";
import type { ReplySender } from "../application/ports/reply-sender";
import { MESSAGES } from "../i18n/es";
import type { NotifyServer } from "../infrastructure/http/notify-server";

export interface StartTargets {
  readonly transport: Pick<
    WhatsAppTransport,
    "onMessage" | "onClose" | "connect"
  >;
  readonly sender: Pick<ReplySender, "toChatId" | "sendText">;
  readonly handler: Pick<MessageHandler, "handle" | "isCommand">;
  readonly notifyServer: Pick<NotifyServer, "start">;
  readonly ownerPhone: string;
}

export interface ShutdownTargets {
  readonly transport: Pick<WhatsAppTransport, "stopReceiving" | "disconnect">;
  readonly notifyServer: Pick<NotifyServer, "stop">;
}

export async function start(
  targets: StartTargets,
  log: Logger,
  shutdown: Shutdown
): Promise<void> {
  // A session the transport has given up on cannot recover in this process.
  // Exiting non-zero lets the process supervisor start a fresh one.
  targets.transport.onClose((error) => {
    log("error", "WhatsApp session ended; exiting", { error: error.message });
    void shutdown(1);
  });

  // Registered before connect() so no message can arrive before anything is
  // listening for it.
  targets.transport.onMessage(
    (message) => targets.handler.handle(message),
    (body) => targets.handler.isCommand(body)
  );
  await targets.transport.connect();
  targets.notifyServer.start();
  log("info", "Bot is ready");

  // The owner learns of a restart, but a failed notice must not stop the bot.
  await targets.sender
    .sendText(targets.sender.toChatId(targets.ownerPhone), MESSAGES.started)
    .catch((error: unknown) => {
      log("warn", "Could not notify the owner of the start", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

// Intake stops first and the connection closes last. A failing step is
// logged and the rest still run, so one stuck connection cannot leave the
// process hanging.
export async function stop(
  targets: ShutdownTargets,
  log: Logger
): Promise<void> {
  log("info", "Shutting down");

  const steps: readonly [string, () => Promise<void>][] = [
    ["whatsapp receiver", () => targets.transport.stopReceiving()],
    ["notify server", () => targets.notifyServer.stop()],
    ["whatsapp transport", () => targets.transport.disconnect()],
  ];

  for (const [name, step] of steps) {
    try {
      await step();
    } catch (error) {
      log("error", "Shutdown step failed", {
        step: name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  log("info", "Shutdown complete");
}

// A shutdown step that never settles must not keep a dead process alive.
const EXIT_DEADLINE_MS = 15_000;

async function exitAfter(
  stopping: Promise<void>,
  code: number
): Promise<never> {
  const deadline = new Promise<void>((resolve) => {
    setTimeout(resolve, EXIT_DEADLINE_MS);
  });
  await Promise.race([stopping, deadline]);
  process.exit(code);
}

// Ends the process with `code` once the shutdown is over.
export type Shutdown = (code: number) => Promise<void>;

/**
 * The one way the process ends. A signal (exit 0) and the transport's
 * `onClose` (exit 1, so PM2 restarts the bot) may call it at the same time.
 * The first call runs `stop` once and fixes the exit code; later calls return
 * at once. The process exits when `stop` settles, or after 15 seconds.
 */
export function createShutdown(
  targets: ShutdownTargets,
  log: Logger
): Shutdown {
  let begun = false;
  return async (code) => {
    if (begun) return;
    begun = true;
    await exitAfter(stop(targets, log), code);
  };
}

export function setupGracefulShutdown(shutdown: Shutdown): void {
  const onSignal = (): void => {
    void shutdown(0);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
}

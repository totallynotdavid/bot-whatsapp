import type { Logger, WhatsAppTransport } from "@bot-whatsapp/whatsapp";
import type { MessageHandler } from "../application/handlers/message-handler";
import type { ReplySender } from "../application/ports/reply-sender";
import { MESSAGES } from "../i18n/es";
import type { NotifyServer } from "../infrastructure/http/notify-server";

export interface StartTargets {
  readonly transport: Pick<WhatsAppTransport, "onMessage" | "connect">;
  readonly sender: Pick<ReplySender, "toChatId" | "sendText">;
  readonly handler: Pick<MessageHandler, "handle" | "isCommand">;
  readonly notifyServer: Pick<NotifyServer, "start">;
  readonly ownerPhone: string;
}

export interface ShutdownTargets {
  readonly transport: Pick<WhatsAppTransport, "stopReceiving" | "disconnect">;
  readonly notifyServer: Pick<NotifyServer, "stop">;
}

export async function start(targets: StartTargets, log: Logger): Promise<void> {
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

export function setupGracefulShutdown(
  targets: ShutdownTargets,
  log: Logger
): void {
  let stopping = false;
  const shutdown = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    await stop(targets, log);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

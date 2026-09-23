import type { Container } from "./container";
import {
  startCircuitBreakerCleanup,
  stopCircuitBreakerCleanup,
} from "../lib/resilience/circuit-breaker";
import { log } from "../lib/logging/logger";

interface Closeable {
  close(): Promise<void>;
}

export interface ShutdownTargets {
  readonly whatsappReceiver: { stop(): Promise<void> };
  readonly jobQueues: Closeable & { stopWorkers(): Promise<void> };
  readonly redis: Closeable;
  readonly annasClient: Closeable;
  readonly whatsappClient: Closeable;
}

export async function start(container: Container): Promise<void> {
  startCircuitBreakerCleanup();

  container.jobQueues.startWorkers();

  container.whatsappReceiver.onMessage(async (message) => {
    await container.messageProcessor.process(message);
  });

  log("info", "Application started successfully");
}

// Commands being handled may still enqueue jobs, and in-flight jobs still
// deliver through the WhatsApp client, so intake stops first and the browsers
// close last. A failing step is logged and the rest still run, so one stuck
// connection cannot leave Chrome processes behind.
export async function stop(targets: ShutdownTargets): Promise<void> {
  log("info", "Shutting down gracefully");

  stopCircuitBreakerCleanup();

  const steps: readonly [string, () => Promise<void>][] = [
    ["whatsapp receiver", () => targets.whatsappReceiver.stop()],
    ["job workers", () => targets.jobQueues.stopWorkers()],
    ["job queues", () => targets.jobQueues.close()],
    ["redis", () => targets.redis.close()],
    ["anna's archive browser", () => targets.annasClient.close()],
    ["whatsapp client", () => targets.whatsappClient.close()],
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

export function setupGracefulShutdown(container: Container): void {
  let stopping = false;
  const shutdown = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    await stop(container);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

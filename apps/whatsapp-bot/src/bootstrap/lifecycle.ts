import type { Container } from "./container";
import {
  startCircuitBreakerCleanup,
  stopCircuitBreakerCleanup,
} from "../lib/resilience/circuit-breaker";
import { log } from "../lib/logging/logger";
import { parseCommand } from "../domain/message";

interface Closeable {
  close(): Promise<void>;
}

export interface ShutdownTargets {
  readonly transport: {
    stopReceiving(): Promise<void>;
    disconnect(): Promise<void>;
  };
  readonly jobQueues: Closeable & { stopWorkers(): Promise<void> };
  readonly redis: Closeable;
  readonly annasClient: Closeable;
}

export async function start(container: Container): Promise<void> {
  startCircuitBreakerCleanup();

  // Registered before connect() so no message can arrive before anything is
  // listening for it.
  container.transport.onMessage(
    async (message) => {
      await container.messageProcessor.process(message);
    },
    (body) => parseCommand(body, container.commandPrefix) !== null
  );
  await container.transport.connect();

  container.jobQueues.startWorkers();

  log("info", "Application started successfully");
}

// Commands being handled may still enqueue jobs, and in-flight jobs still
// deliver through the transport, so intake stops first and the connection
// closes last. A failing step is logged and the rest still run, so one stuck
// connection cannot leave orphaned processes behind.
export async function stop(targets: ShutdownTargets): Promise<void> {
  log("info", "Shutting down gracefully");

  stopCircuitBreakerCleanup();

  const steps: readonly [string, () => Promise<void>][] = [
    ["whatsapp receiver", () => targets.transport.stopReceiving()],
    ["job workers", () => targets.jobQueues.stopWorkers()],
    ["job queues", () => targets.jobQueues.close()],
    ["redis", () => targets.redis.close()],
    ["anna's archive browser", () => targets.annasClient.close()],
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

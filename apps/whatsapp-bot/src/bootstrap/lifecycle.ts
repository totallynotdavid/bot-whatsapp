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

export async function start(
  container: Container,
  shutdown: Shutdown
): Promise<void> {
  startCircuitBreakerCleanup();

  container.transport.onClose((error) => {
    log("error", "WhatsApp session ended; exiting", { error: error.message });
    void shutdown(1);
  });

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

export type Shutdown = (code: number) => Promise<void>;

export function createShutdown(targets: ShutdownTargets): Shutdown {
  let begun = false;
  return async (code) => {
    if (begun) return;
    begun = true;
    await exitAfter(stop(targets), code);
  };
}

export function setupGracefulShutdown(shutdown: Shutdown): void {
  const onSignal = (): void => {
    void shutdown(0);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
}

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

  // A session the transport has given up on cannot recover in this process.
  // Exiting non-zero lets the process supervisor start a fresh one.
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

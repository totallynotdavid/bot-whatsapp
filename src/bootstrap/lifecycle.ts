import type { Container } from "./container";
import {
  startCircuitBreakerCleanup,
  stopCircuitBreakerCleanup,
} from "../lib/resilience/circuit-breaker";
import { log } from "../lib/logging/logger";

export async function start(container: Container): Promise<void> {
  startCircuitBreakerCleanup();

  container.queue.startWorker(async (job) => {
    return await container.jobHandler.processJob(job);
  });

  container.queue.onCompleted(async (job, result) => {
    await container.jobHandler.handleJobCompletion(job, result);
  });

  container.whatsappReceiver.onMessage(async (message) => {
    await container.messageProcessor.process(message);
  });

  log("info", "Application started successfully");
}

export async function stop(container: Container): Promise<void> {
  log("info", "Shutting down gracefully");

  stopCircuitBreakerCleanup();

  await container.redis.close();
  await container.queue.close();
  await container.annasClient.close();

  log("info", "Shutdown complete");
}

export function setupGracefulShutdown(container: Container): void {
  const shutdown = async (): Promise<void> => {
    await stop(container);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

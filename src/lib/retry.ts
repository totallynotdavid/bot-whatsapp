import { LIMITS } from "../config";
import { log } from "./logger";

export async function retry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxAttempts: number = LIMITS.RETRY_MAX_ATTEMPTS
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();

      if (attempt > 0) {
        log("info", "Operation succeeded after retry", {
          operation: operationName,
          attempt,
        });
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        const delay = Math.min(
          LIMITS.RETRY_INITIAL_DELAY_MS * 2 ** attempt,
          LIMITS.RETRY_MAX_DELAY_MS
        );

        log("warn", "Operation failed, retrying", {
          operation: operationName,
          attempt: attempt + 1,
          maxAttempts,
          delayMs: delay,
          error: lastError.message,
        });

        await sleep(delay);
      }
    }
  }

  log("error", "Operation failed after all retries", {
    operation: operationName,
    maxAttempts,
    error: lastError!.message,
    stack: lastError!.stack,
  });

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import { LIMITS } from "../../config/constants";
import { log } from "../logging/logger";

export async function retry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxAttempts: number = LIMITS.RETRY_MAX_ATTEMPTS
): Promise<T> {
  let lastError: Error | undefined;

  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++) {
    try {
      const result = await operation();

      if (attemptNumber > 1) {
        log("info", "Operation succeeded after retry", {
          operation: operationName,
          attemptNumber,
          totalAttempts: maxAttempts,
        });
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attemptNumber < maxAttempts) {
        const delayMs = Math.min(
          LIMITS.RETRY_INITIAL_DELAY_MS * 2 ** (attemptNumber - 1),
          LIMITS.RETRY_MAX_DELAY_MS
        );

        log("warn", "Operation failed, will retry", {
          operation: operationName,
          attemptNumber,
          maxAttempts,
          nextRetryDelayMs: delayMs,
          error: lastError.message,
        });

        await sleep(delayMs);
      }
    }
  }

  log("error", "Operation failed after all retry attempts", {
    operation: operationName,
    totalAttempts: maxAttempts,
    error: lastError!.message,
    stack: lastError!.stack,
  });

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import { RETRY } from "../../config/constants";
import { logger } from "../monitoring/logger";

interface RetryConfig {
  maxAttempts?: number;
  initialDelayMs?: number;
  shouldRetry?: (error: Error) => boolean;
}

export class RetryPolicy {
  async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
    config: RetryConfig = {}
  ): Promise<T> {
    const maxAttempts = config.maxAttempts ?? RETRY.MAX_ATTEMPTS;
    const initialDelay = config.initialDelayMs ?? RETRY.INITIAL_DELAY_MS;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();

        if (attempt > 0) {
          logger.info("Operation succeeded after retry", {
            operation: operationName,
            attempt,
          });
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxAttempts) {
          if (config.shouldRetry && !config.shouldRetry(lastError)) {
            logger.warn("Error is not retryable", {
              operation: operationName,
              error: lastError.message,
            });
            throw lastError;
          }

          const delay = Math.min(
            initialDelay * RETRY.EXPONENTIAL_BASE ** attempt,
            RETRY.MAX_DELAY_MS
          );

          logger.warn("Operation failed, retrying", {
            operation: operationName,
            attempt: attempt + 1,
            maxAttempts,
            delayMs: delay,
            error: lastError.message,
          });

          await this.sleep(delay);
        }
      }
    }

    logger.error("Operation failed after all retries", lastError, {
      operation: operationName,
      maxAttempts,
    });

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

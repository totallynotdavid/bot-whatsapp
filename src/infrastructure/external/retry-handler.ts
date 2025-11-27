import { logger } from "../../shared/logger";

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  shouldRetry?: (error: Error) => boolean;
}

// biome-ignore lint/complexity/noStaticOnlyClass: Utility class for infrastructure layer.
export class RetryHandler {
  private static defaultConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
  };

  static async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const finalConfig = { ...RetryHandler.defaultConfig, ...config };
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
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

        if (attempt < finalConfig.maxRetries) {
          if (finalConfig.shouldRetry && !finalConfig.shouldRetry(lastError)) {
            logger.warn("Error is not retryable", {
              operation: operationName,
              error: lastError.message,
            });
            throw lastError;
          }

          const delay = Math.min(
            finalConfig.initialDelayMs * 2 ** attempt,
            finalConfig.maxDelayMs
          );

          logger.warn("Operation failed, retrying", {
            operation: operationName,
            attempt: attempt + 1,
            maxRetries: finalConfig.maxRetries,
            delayMs: delay,
            error: lastError.message,
          });

          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    logger.error("Operation failed after all retries", lastError, {
      operation: operationName,
      maxRetries: finalConfig.maxRetries,
    });

    throw lastError;
  }
}

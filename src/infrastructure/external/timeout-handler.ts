export class TimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

// biome-ignore lint/complexity/noStaticOnlyClass: Utility class for infrastructure layer.
export class TimeoutHandler {
  static async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
    timeoutMs: number
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(operationName, timeoutMs));
      }, timeoutMs);
    });

    return Promise.race([operation(), timeoutPromise]);
  }
}

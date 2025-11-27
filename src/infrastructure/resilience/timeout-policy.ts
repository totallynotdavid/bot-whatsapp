export class TimeoutError extends Error {
  constructor(operationName: string, timeoutMs: number) {
    super(`Operation '${operationName}' timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

export class TimeoutPolicy {
  async execute<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError("operation", timeoutMs));
      }, timeoutMs);
    });

    return Promise.race([operation(), timeoutPromise]);
  }
}

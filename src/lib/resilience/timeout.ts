export class TimeoutError extends Error {
  constructor(timeoutMs: number, operationName?: string) {
    const name = operationName ? ` (${operationName})` : "";
    super(`Operation${name} timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName?: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(timeoutMs, operationName));
    }, timeoutMs);
  });

  return Promise.race([operation(), timeoutPromise]);
}

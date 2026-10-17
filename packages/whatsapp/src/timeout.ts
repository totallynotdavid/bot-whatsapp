export class TimeoutError extends Error {
  constructor(timeoutMs: number, operationName?: string) {
    const name = operationName ? ` (${operationName})` : "";
    super(`Operation${name} timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

// Rejects when the timeout fires or the parent signal aborts, whichever is
// first. The operation keeps running after that; it sees the abort only
// through the signal it is given.
export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  operationName?: string,
  parentSignal?: AbortSignal
): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = parentSignal
    ? AbortSignal.any([parentSignal, timeout])
    : timeout;
  signal.throwIfAborted();

  const aborted = new Promise<never>((_, reject) => {
    signal.addEventListener(
      "abort",
      () =>
        reject(
          timeout.aborted && !parentSignal?.aborted
            ? new TimeoutError(timeoutMs, operationName)
            : signal.reason
        ),
      { once: true }
    );
  });
  return await Promise.race([operation(signal), aborted]);
}

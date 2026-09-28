export class TimeoutError extends Error {
  constructor(timeoutMs: number, operationName?: string) {
    const name = operationName ? ` (${operationName})` : "";
    super(`Operation${name} timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

const EXTERNAL_API_TIMEOUT_MS = 30000;

// Rejects when the timeout fires or the parent signal aborts, whichever is
// first. The operation keeps running after that; it sees the abort only
// through the signal it is given.
export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  operationName?: string,
  parentSignal?: AbortSignal,
  timeoutMs: number = EXTERNAL_API_TIMEOUT_MS
): Promise<T> {
  parentSignal?.throwIfAborted();

  const controller = new AbortController();
  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener(
      "abort",
      () => reject(controller.signal.reason),
      { once: true }
    );
  });
  const timer = setTimeout(
    () => controller.abort(new TimeoutError(timeoutMs, operationName)),
    timeoutMs
  );
  const abortWithParent = () => controller.abort(parentSignal?.reason);
  parentSignal?.addEventListener("abort", abortWithParent, { once: true });

  try {
    return await Promise.race([operation(controller.signal), aborted]);
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", abortWithParent);
  }
}

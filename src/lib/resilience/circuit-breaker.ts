import { LIMITS, SYNC_INTERVAL_MS } from "../../config/constants";
import { log } from "../logging/logger";

enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

interface Circuit {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  nextAttemptTime: number;
  lastUsed: number;
}

const circuits = new Map<string, Circuit>();
let cleanupIntervalId: NodeJS.Timeout | null = null;

export class CircuitBreakerError extends Error {
  constructor(serviceName: string, nextAttemptTime: number) {
    const waitSeconds = Math.ceil((nextAttemptTime - Date.now()) / 1000);
    super(
      `Circuit breaker OPEN for service: ${serviceName}. Retry in ${waitSeconds}s`
    );
    this.name = "CircuitBreakerError";
  }
}

export function startCircuitBreakerCleanup(): void {
  if (cleanupIntervalId) return;

  cleanupIntervalId = setInterval(() => {
    cleanupStaleCircuits();
  }, SYNC_INTERVAL_MS.MEMORY_CHECK);

  log("info", "Circuit breaker cleanup started");
}

export function stopCircuitBreakerCleanup(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

function cleanupStaleCircuits(): void {
  const now = Date.now();
  const staleThresholdMs = LIMITS.CIRCUIT_BREAKER_RESET_TIMEOUT_MS * 2;
  let cleanedCount = 0;

  for (const [serviceName, circuit] of circuits.entries()) {
    if (now - circuit.lastUsed > staleThresholdMs) {
      circuits.delete(serviceName);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    log("debug", "Cleaned stale circuits", { count: cleanedCount });
  }
}

export async function executeWithCircuitBreaker<T>(
  serviceName: string,
  operation: () => Promise<T>
): Promise<T> {
  const circuit = getOrCreateCircuit(serviceName);
  circuit.lastUsed = Date.now();

  if (circuit.state === CircuitState.OPEN) {
    if (Date.now() < circuit.nextAttemptTime) {
      throw new CircuitBreakerError(serviceName, circuit.nextAttemptTime);
    }

    circuit.state = CircuitState.HALF_OPEN;
    circuit.successCount = 0;
    log("info", "Circuit breaker transitioning to HALF_OPEN", { serviceName });
  }

  try {
    const result = await operation();
    onSuccess(serviceName);
    return result;
  } catch (error) {
    onFailure(serviceName);
    throw error;
  }
}

function getOrCreateCircuit(serviceName: string): Circuit {
  if (!circuits.has(serviceName)) {
    circuits.set(serviceName, {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0,
      nextAttemptTime: 0,
      lastUsed: Date.now(),
    });
  }

  return circuits.get(serviceName)!;
}

function onSuccess(serviceName: string): void {
  const circuit = getOrCreateCircuit(serviceName);

  if (circuit.state === CircuitState.HALF_OPEN) {
    circuit.successCount++;

    if (circuit.successCount >= LIMITS.CIRCUIT_BREAKER_SUCCESS_THRESHOLD) {
      circuit.state = CircuitState.CLOSED;
      circuit.failureCount = 0;
      circuit.successCount = 0;
      log("info", "Circuit breaker CLOSED", { serviceName });
    }
  } else if (circuit.state === CircuitState.CLOSED) {
    circuit.failureCount = 0;
  }
}

function onFailure(serviceName: string): void {
  const circuit = getOrCreateCircuit(serviceName);
  circuit.failureCount++;

  if (circuit.failureCount >= LIMITS.CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
    circuit.state = CircuitState.OPEN;
    circuit.nextAttemptTime =
      Date.now() + LIMITS.CIRCUIT_BREAKER_RESET_TIMEOUT_MS;

    log("error", "Circuit breaker OPEN", {
      serviceName,
      failureCount: circuit.failureCount,
      resetInMs: LIMITS.CIRCUIT_BREAKER_RESET_TIMEOUT_MS,
    });
  }
}

import { CIRCUIT_BREAKER } from "../config";
import { log } from "./logger";

enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

interface Circuit {
  state: CircuitState;
  failures: number;
  successes: number;
  nextAttemptTime: number;
}

const circuits = new Map<string, Circuit>();

export class CircuitBreakerError extends Error {
  constructor(serviceName: string) {
    super(`Circuit breaker is OPEN for service: ${serviceName}`);
    this.name = "CircuitBreakerError";
  }
}

export async function executeWithCircuitBreaker<T>(
  serviceName: string,
  operation: () => Promise<T>
): Promise<T> {
  const circuit = getOrCreateCircuit(serviceName);

  if (circuit.state === CircuitState.OPEN) {
    if (Date.now() < circuit.nextAttemptTime) {
      throw new CircuitBreakerError(serviceName);
    }

    circuit.state = CircuitState.HALF_OPEN;
    circuit.successes = 0;
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
      failures: 0,
      successes: 0,
      nextAttemptTime: 0,
    });
  }

  return circuits.get(serviceName)!;
}

function onSuccess(serviceName: string): void {
  const circuit = getOrCreateCircuit(serviceName);

  if (circuit.state === CircuitState.HALF_OPEN) {
    circuit.successes++;

    if (circuit.successes >= CIRCUIT_BREAKER.SUCCESS_THRESHOLD) {
      circuit.state = CircuitState.CLOSED;
      circuit.failures = 0;
      circuit.successes = 0;
      log("info", "Circuit breaker closed", { serviceName });
    }
  } else if (circuit.state === CircuitState.CLOSED) {
    circuit.failures = 0;
  }
}

function onFailure(serviceName: string): void {
  const circuit = getOrCreateCircuit(serviceName);

  circuit.failures++;

  if (circuit.failures >= CIRCUIT_BREAKER.FAILURE_THRESHOLD) {
    circuit.state = CircuitState.OPEN;
    circuit.nextAttemptTime = Date.now() + CIRCUIT_BREAKER.RESET_TIMEOUT_MS;

    log("error", "Circuit breaker opened", {
      serviceName,
      failures: circuit.failures,
    });
  }
}

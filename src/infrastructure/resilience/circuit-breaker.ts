import { CIRCUIT_BREAKER } from "../../config/constants";
import { logger } from "../monitoring/logger";

enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export class CircuitBreakerError extends Error {
  constructor(serviceName: string) {
    super(`Circuit breaker is OPEN for service: ${serviceName}`);
    this.name = "CircuitBreakerError";
  }
}

export class CircuitBreaker {
  private readonly circuits = new Map<
    string,
    {
      state: CircuitState;
      failures: number;
      successes: number;
      nextAttemptTime: number;
    }
  >();

  async execute<T>(
    operation: () => Promise<T>,
    serviceName: string
  ): Promise<T> {
    const circuit = this.getOrCreateCircuit(serviceName);

    if (circuit.state === CircuitState.OPEN) {
      if (Date.now() < circuit.nextAttemptTime) {
        throw new CircuitBreakerError(serviceName);
      }

      circuit.state = CircuitState.HALF_OPEN;
      circuit.successes = 0;
      logger.info("Circuit breaker transitioning to HALF_OPEN", {
        serviceName,
      });
    }

    try {
      const result = await operation();

      this.onSuccess(serviceName);
      return result;
    } catch (error) {
      this.onFailure(serviceName);
      throw error;
    }
  }

  private getOrCreateCircuit(serviceName: string) {
    if (!this.circuits.has(serviceName)) {
      this.circuits.set(serviceName, {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        nextAttemptTime: 0,
      });
    }

    return this.circuits.get(serviceName)!;
  }

  private onSuccess(serviceName: string): void {
    const circuit = this.getOrCreateCircuit(serviceName);

    if (circuit.state === CircuitState.HALF_OPEN) {
      circuit.successes++;

      if (circuit.successes >= CIRCUIT_BREAKER.SUCCESS_THRESHOLD) {
        circuit.state = CircuitState.CLOSED;
        circuit.failures = 0;
        circuit.successes = 0;
        logger.info("Circuit breaker closed", { serviceName });
      }
    } else if (circuit.state === CircuitState.CLOSED) {
      circuit.failures = 0;
    }
  }

  private onFailure(serviceName: string): void {
    const circuit = this.getOrCreateCircuit(serviceName);

    circuit.failures++;

    if (circuit.failures >= CIRCUIT_BREAKER.FAILURE_THRESHOLD) {
      circuit.state = CircuitState.OPEN;
      circuit.nextAttemptTime = Date.now() + CIRCUIT_BREAKER.RESET_TIMEOUT_MS;

      logger.error("Circuit breaker opened", {
        serviceName,
        failures: circuit.failures,
      });
    }
  }

  getState(serviceName: string): string {
    return this.getOrCreateCircuit(serviceName).state;
  }
}

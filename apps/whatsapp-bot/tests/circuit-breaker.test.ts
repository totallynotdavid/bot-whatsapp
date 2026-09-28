import { describe, expect, test } from "vitest";
import { LIMITS } from "../src/config/constants";
import {
  CircuitBreakerError,
  executeWithCircuitBreaker,
} from "../src/lib/resilience/circuit-breaker";
import { loadTestConfig } from "./fixtures";

loadTestConfig();

const failing = async (): Promise<never> => {
  throw new Error("service down");
};

async function failTimes(
  service: string,
  times: number,
  signal?: AbortSignal
): Promise<void> {
  for (let i = 0; i < times; i++) {
    await expect(
      executeWithCircuitBreaker(service, failing, signal)
    ).rejects.toThrow("service down");
  }
}

describe("circuit breaker", () => {
  test("opens after the failure threshold and rejects without calling the service", async () => {
    await failTimes("breaker-opens", LIMITS.CIRCUIT_BREAKER_FAILURE_THRESHOLD);

    let called = false;
    await expect(
      executeWithCircuitBreaker("breaker-opens", async () => {
        called = true;
      })
    ).rejects.toBeInstanceOf(CircuitBreakerError);
    expect(called).toBe(false);
  });

  test("calls the caller aborted do not count as failures", async () => {
    const controller = new AbortController();
    controller.abort(new Error("job timed out"));

    await failTimes(
      "breaker-aborted",
      LIMITS.CIRCUIT_BREAKER_FAILURE_THRESHOLD * 2,
      controller.signal
    );

    await expect(
      executeWithCircuitBreaker("breaker-aborted", async () => "still closed")
    ).resolves.toBe("still closed");
  });

  test("a signal that never aborted leaves failures counted", async () => {
    const controller = new AbortController();

    await failTimes(
      "breaker-live-signal",
      LIMITS.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      controller.signal
    );

    await expect(
      executeWithCircuitBreaker("breaker-live-signal", async () => "x")
    ).rejects.toBeInstanceOf(CircuitBreakerError);
  });
});

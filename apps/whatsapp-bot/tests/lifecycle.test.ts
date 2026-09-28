import { expect, test } from "vitest";
import { start, stop, type ShutdownTargets } from "../src/bootstrap/lifecycle";
import { stopCircuitBreakerCleanup } from "../src/lib/resilience/circuit-breaker";
import type { Container } from "../src/bootstrap/container";
import { loadTestConfig } from "./fixtures";

loadTestConfig();

const SHUTDOWN_ORDER = [
  "receiver",
  "workers",
  "queues",
  "redis",
  "annas browser",
  "transport",
];

function recordingTargets(calls: string[], failing?: string): ShutdownTargets {
  const step = (name: string) => async () => {
    calls.push(name);
    if (name === failing) throw new Error(`${name} failed`);
  };
  return {
    transport: {
      stopReceiving: step("receiver"),
      disconnect: step("transport"),
    },
    jobQueues: { stopWorkers: step("workers"), close: step("queues") },
    redis: { close: step("redis") },
    annasClient: { close: step("annas browser") },
  };
}

test("shutdown stops intake, drains workers, then closes queues, redis and the browsers", async () => {
  const calls: string[] = [];

  await stop(recordingTargets(calls));

  expect(calls).toEqual(SHUTDOWN_ORDER);
});

test.each(SHUTDOWN_ORDER)(
  "a failing %s step does not skip the steps after it",
  async (failing) => {
    const calls: string[] = [];

    await stop(recordingTargets(calls, failing));

    expect(calls).toEqual(SHUTDOWN_ORDER);
  }
);

function recordingContainer(calls: string[]): Container {
  return {
    redis: {} as Container["redis"],
    annasClient: {} as Container["annasClient"],
    messageProcessor: {} as Container["messageProcessor"],
    commandPrefix: "!",
    jobQueues: {
      startWorkers: () => {
        calls.push("workers");
      },
    } as unknown as Container["jobQueues"],
    transport: {
      onMessage: () => {
        calls.push("onMessage");
      },
      connect: async () => {
        calls.push("connect");
      },
    } as unknown as Container["transport"],
  };
}

test("start registers onMessage, connects, then starts job workers", async () => {
  const calls: string[] = [];

  await start(recordingContainer(calls));
  stopCircuitBreakerCleanup();

  expect(calls).toEqual(["onMessage", "connect", "workers"]);
});

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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
      onClose: () => {
        calls.push("onClose");
      },
      onMessage: () => {
        calls.push("onMessage");
      },
      connect: async () => {
        calls.push("connect");
      },
    } as unknown as Container["transport"],
  };
}

test("start listens for messages and for the session ending, connects, then starts job workers", async () => {
  const calls: string[] = [];

  await start(recordingContainer(calls), async () => {});
  stopCircuitBreakerCleanup();

  expect(calls).toEqual(["onClose", "onMessage", "connect", "workers"]);
});

// Each case runs the app in a child process, since process.exit cannot be
// observed from inside the test runner.
function runUntilExit(...triggers: string[]) {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("./scripts/close-session.ts", import.meta.url)),
      ...triggers,
    ],
    { encoding: "utf8", timeout: 20_000 }
  );
  const steps = result.stdout
    .split("\n")
    .filter((line) => line.startsWith("step:"));
  return { status: result.status, steps };
}

const SHUTDOWN_STEPS = SHUTDOWN_ORDER.map((name) => `step:${name}`);

test("a session the transport ends for good shuts down and exits non-zero", () => {
  const result = runUntilExit("close");

  expect(result.steps).toEqual(SHUTDOWN_STEPS);
  expect(result.status).toBe(1);
});

test("a signal shuts down and exits zero", () => {
  const result = runUntilExit("signal");

  expect(result.steps).toEqual(SHUTDOWN_STEPS);
  expect(result.status).toBe(0);
});

test("a session close during a signal shutdown closes nothing twice and keeps the exit code", () => {
  const result = runUntilExit("signal", "close");

  expect(result.steps).toEqual(SHUTDOWN_STEPS);
  expect(result.status).toBe(0);
});

test("a signal during a session-close shutdown closes nothing twice and keeps the exit code", () => {
  const result = runUntilExit("close", "signal");

  expect(result.steps).toEqual(SHUTDOWN_STEPS);
  expect(result.status).toBe(1);
});

test("a session reported ended twice closes nothing twice", () => {
  const result = runUntilExit("close", "close");

  expect(result.steps).toEqual(SHUTDOWN_STEPS);
  expect(result.status).toBe(1);
});

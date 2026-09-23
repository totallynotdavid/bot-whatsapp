import { expect, test } from "vitest";
import { stop, type ShutdownTargets } from "../src/bootstrap/lifecycle";
import { loadTestConfig } from "./fixtures";

loadTestConfig();

const SHUTDOWN_ORDER = [
  "receiver",
  "workers",
  "queues",
  "redis",
  "annas browser",
  "whatsapp client",
];

function recordingTargets(calls: string[], failing?: string): ShutdownTargets {
  const step = (name: string) => async () => {
    calls.push(name);
    if (name === failing) throw new Error(`${name} failed`);
  };
  return {
    whatsappReceiver: { stop: step("receiver") },
    jobQueues: { stopWorkers: step("workers"), close: step("queues") },
    redis: { close: step("redis") },
    annasClient: { close: step("annas browser") },
    whatsappClient: { close: step("whatsapp client") },
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

// Run by lifecycle.test.ts as a child process: process.exit cannot be observed
// from inside the test runner. Starts the app the way main.ts does, prints
// each shutdown step, then fires the triggers named by the arguments in
// order: "close" (the transport reports its session ended) and "signal"
// (SIGTERM). The 5s timer exits 0, so a lifecycle that does not exit on its
// own fails the test by exit status.
import {
  createShutdown,
  setupGracefulShutdown,
  start,
} from "../../src/bootstrap/lifecycle";
import type { Container } from "../../src/bootstrap/container";
import { loadTestConfig } from "../fixtures";

loadTestConfig();

const step = (name: string) => async () => {
  console.log(`step:${name}`);
};

let closeSession: (error: Error) => void = () => {};

const container = {
  redis: { close: step("redis") },
  annasClient: { close: step("annas browser") },
  messageProcessor: {},
  commandPrefix: "!",
  jobQueues: {
    startWorkers: () => {},
    stopWorkers: step("workers"),
    close: step("queues"),
  },
  transport: {
    onMessage: () => {},
    connect: async () => {},
    onClose: (handler: (error: Error) => void) => {
      closeSession = handler;
    },
    stopReceiving: step("receiver"),
    disconnect: step("transport"),
  },
} as unknown as Container;

const shutdown = createShutdown(container);
await start(container, shutdown);
setupGracefulShutdown(shutdown);

for (const trigger of process.argv.slice(2)) {
  if (trigger === "close") closeSession(new Error("logged out"));
  else process.emit("SIGTERM");
}

setTimeout(() => process.exit(0), 5000);

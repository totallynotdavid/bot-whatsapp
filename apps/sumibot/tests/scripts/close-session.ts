// Run by lifecycle.test.ts as a child process: process.exit cannot be observed
// from inside the test runner. Starts the bot the way main.ts does, then fires
// the triggers named by the arguments in order: "close" (the transport
// reports its session ended) and "signal" (SIGTERM). On exit it prints the
// transport events the shutdown caused. The 5s timer exits 0, so a lifecycle
// that does not exit on its own fails the test by exit status.
import { setupGracefulShutdown } from "../../src/bootstrap/lifecycle";
import { run } from "../../src/bootstrap/run";
import { FakeTransport, OWNER_PHONE } from "../fixtures";

// A port nothing listens on: bind an ephemeral one, then release it.
const probe = Bun.serve({ port: 0, fetch: () => new Response() });
const port = probe.port!;
void probe.stop(true);

const transport = new FakeTransport();
const { shutdown } = await run({
  env: {
    OWNER_PHONE,
    SUPABASE_URL: "https://abc.supabase.co",
    SUPABASE_KEY: "k".repeat(32),
    LOG_LEVEL: "error",
    HTTP_PORT: String(port),
  },
  factories: {
    baileys: async () => transport,
    wwebjs: async () => transport,
  },
  renderQr: () => {},
});
setupGracefulShutdown(shutdown);
transport.events.length = 0;
process.on("exit", () => {
  console.log(`events:${transport.events.join(",")}`);
});

for (const trigger of process.argv.slice(2)) {
  if (trigger === "close") transport.endSession(new Error("logged out"));
  else process.emit("SIGTERM");
}

setTimeout(() => {
  console.log("did not exit");
  process.exit(0);
}, 5000);

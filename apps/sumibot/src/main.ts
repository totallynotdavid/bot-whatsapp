import { setupGracefulShutdown } from "./bootstrap/lifecycle";
import { run } from "./bootstrap/run";

try {
  const { shutdown } = await run();
  setupGracefulShutdown(shutdown);
} catch (error) {
  console.error(
    JSON.stringify({
      level: "error",
      message: "Fatal startup error",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
  );
  process.exit(1);
}

import { configSchema, type Config } from "./schema";

export type { Config };
export * from "./constants";

export function loadConfig(
  env: Record<string, string | undefined> = process.env
): Config {
  const result = configSchema.safeParse(env);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Configuration validation failed:\n${problems}`);
  }

  return result.data;
}

import { logger } from "../shared/logger";
import type { EnvConfig } from "./env.config";

export async function validateEnvironment(config: EnvConfig): Promise<void> {
  const checks: Array<{ name: string; fn: () => Promise<boolean> }> = [
    {
      name: "Redis connection",
      fn: async () => {
        try {
          const { default: Redis } = await import("ioredis");
          const client = new Redis({
            host: config.REDIS_HOST,
            port: config.REDIS_PORT,
            connectTimeout: 5000,
          });
          await client.ping();
          await client.quit();
          return true;
        } catch {
          return false;
        }
      },
    },
    {
      name: "Supabase connection",
      fn: async () => {
        try {
          const { createClient } = await import("@supabase/supabase-js");
          const client = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);
          const { error } = await client
            .from("paid_users")
            .select("count")
            .limit(1);
          return !error;
        } catch {
          return false;
        }
      },
    },
  ];

  for (const check of checks) {
    const success = await check.fn();
    if (!success) {
      logger.error(`Validation failed: ${check.name}`);
      process.exit(1);
    }
    logger.info(`✅ ${check.name}`);
  }

  logger.info("Environment validated successfully");
}

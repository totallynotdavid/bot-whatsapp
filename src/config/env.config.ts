import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  OWNER_PHONE: z.string().length(11),
  COMMAND_PREFIX: z.string().default("/"),

  SUPABASE_URL: z.url(),
  SUPABASE_KEY: z.string().min(1),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),

  CACHE_TTL_SECONDS: z.coerce.number().default(300),

  OPENAI_API_KEY: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment variables:");
    console.error(JSON.stringify(z.treeifyError(result.error), null, 2));
    process.exit(1);
  }

  return result.data;
}

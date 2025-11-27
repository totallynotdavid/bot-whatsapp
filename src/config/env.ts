import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  ADMIN_NUMBER: z.string().length(11),
  COMMAND_PREFIX: z.string().default("/"),

  SUPABASE_URL: z.url(),
  SUPABASE_KEY: z.string().min(1),

  OPENAI_API_KEY: z.string().optional(),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),

  CACHE_TTL_SECONDS: z.coerce.number().default(300), // 5 minutes
});

const rawEnv = process.env;
const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  process.exit(1);
}

export const config = parsed.data;

export const isProduction = config.NODE_ENV === "production";

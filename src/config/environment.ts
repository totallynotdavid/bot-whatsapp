import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  OWNER_PHONE: z.string().regex(/^\d{10,15}$/),
  COMMAND_PREFIX: z.string().default("/"),

  SUPABASE_URL: z.url(),
  SUPABASE_KEY: z.string().min(1),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  CHROME_PATH: z.string().optional(),
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(): Environment {
  const result = environmentSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    console.error("Invalid environment configuration:");
    console.error(JSON.stringify(formatted, null, 2));
    process.exit(1);
  }

  return result.data;
}

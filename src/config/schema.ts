import { z } from "zod";

export const configSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  OWNER_PHONE: z
    .string()
    .regex(/^\d{10,15}$/, "Must be 10-15 digits without formatting"),
  COMMAND_PREFIX: z.string().min(1).max(3).default("/"),

  SUPABASE_URL: z.url("Invalid Supabase URL"),
  SUPABASE_KEY: z.string().min(32, "Supabase key too short"),

  REDIS_HOST: z.string().min(1).default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().max(65535).default(6379),

  CHROME_PATH: z.string().optional(),

  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),

  ENABLE_MONITORING: z.coerce.boolean().default(true),
});

export type Config = z.infer<typeof configSchema>;

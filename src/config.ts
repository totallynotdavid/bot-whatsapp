import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  OWNER_PHONE: z
    .string()
    .regex(/^\d{10,15}$/, "Owner phone must be 10-15 digits"),
  COMMAND_PREFIX: z.string().min(1).default("/"),

  SUPABASE_URL: z.url(),
  SUPABASE_KEY: z.string().min(1),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  CHROME_PATH: z.string().optional(),

  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),

  ENABLE_MONITORING: z.coerce.boolean().default(true),
});

type Env = z.infer<typeof envSchema>;

function loadAndValidateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Configuration validation failed:");
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  return result.data;
}

export const config = loadAndValidateEnv();

export const TIMEOUTS = {
  ACKNOWLEDGMENT_MS: 500,
  PERMISSION_CHECK_MS: 10,
  CACHE_LOOKUP_MS: 100,
  DB_QUERY_MS: 5000,
  EXTERNAL_API_MS: 30000,
} as const;

export const LIMITS = {
  MEDIA_MAX_BYTES: 10_485_760,
  MEDIA_MAX_MB: 10,
  QUEUE_MAX_CONCURRENT: 5,
  QUEUE_JOB_TIMEOUT_MS: 120000,
  RETRY_MAX_ATTEMPTS: 3,
  RETRY_INITIAL_DELAY_MS: 1000,
  RETRY_MAX_DELAY_MS: 10000,
} as const;

export const CACHE_TTL = {
  USER_SECONDS: 300,
  PERMISSION_SECONDS: 300,
  MEDIA_INFO_SECONDS: 60,
} as const;

export const SYNC_INTERVAL = {
  POSTGRES_BACKUP_MS: 300000,
  STATS_REFRESH_MS: 60000,
} as const;

export const CIRCUIT_BREAKER = {
  FAILURE_THRESHOLD: 5,
  SUCCESS_THRESHOLD: 2,
  RESET_TIMEOUT_MS: 60000,
} as const;

export const MEMORY = {
  WARNING_THRESHOLD_PERCENT: 0.85,
  CHECK_INTERVAL_MS: 30000,
} as const;

export const MEDIA_TYPES = {
  ALLOWED_IMAGE: ["image/jpeg", "image/png", "image/webp"] as const,
  ALLOWED_VIDEO: ["video/mp4", "video/webm"] as const,
  ALLOWED_AUDIO: ["audio/mpeg", "audio/ogg"] as const,
} as const;

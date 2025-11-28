import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { retry } from "../../lib/resilience/retry";
import { withTimeout } from "../../lib/resilience/timeout";
import { executeWithCircuitBreaker } from "../../lib/resilience/circuit-breaker";
import { TIMEOUTS } from "../../config/constants";
import { log } from "../../lib/logging/logger";

const CIRCUIT_BREAKER_SERVICE_NAME = "postgres";

export class PostgresClient {
  private readonly client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  async queryOne<T>(
    table: string,
    select: string,
    filter?: { column: string; value: unknown }
  ): Promise<T | null> {
    const startTime = Date.now();
    const operationName = `postgres-query-${table}`;

    return executeWithCircuitBreaker(CIRCUIT_BREAKER_SERVICE_NAME, async () => {
      return retry(async () => {
        return withTimeout(
          async () => {
            let query = this.client.from(table).select(select);

            if (filter) {
              query = query.eq(filter.column, filter.value);
            }

            const { data, error } = await query.single();

            const durationMs = Date.now() - startTime;
            log("debug", "Postgres query executed", {
              table,
              select,
              hasFilter: !!filter,
              durationMs,
              found: !!data,
            });

            if (error) {
              throw error;
            }

            return data as T;
          },
          TIMEOUTS.DB_QUERY_MS,
          operationName
        );
      }, operationName);
    });
  }

  async upsert(
    table: string,
    data: unknown,
    conflictColumn: string
  ): Promise<void> {
    const startTime = Date.now();
    const operationName = `postgres-upsert-${table}`;

    return executeWithCircuitBreaker(CIRCUIT_BREAKER_SERVICE_NAME, async () => {
      return retry(async () => {
        return withTimeout(
          async () => {
            const { error } = await this.client.from(table).upsert(data, {
              onConflict: conflictColumn,
            });

            const durationMs = Date.now() - startTime;
            log("debug", "Postgres upsert executed", {
              table,
              conflictColumn,
              durationMs,
            });

            if (error) {
              throw error;
            }
          },
          TIMEOUTS.DB_QUERY_MS,
          operationName
        );
      }, operationName);
    });
  }
}

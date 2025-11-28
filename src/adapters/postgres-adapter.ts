import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { retry } from "../lib/retry";
import { withTimeout } from "../lib/timeout";
import { executeWithCircuitBreaker } from "../lib/circuit-breaker";
import { TIMEOUTS } from "../config";
import { log } from "../lib/logger";

export class PostgresAdapter {
  private readonly client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  async queryOne<T>(
    table: string,
    select: string,
    filter?: { column: string; value: any }
  ): Promise<T | null> {
    const startTime = Date.now();

    return executeWithCircuitBreaker("postgres", async () => {
      return retry(async () => {
        return withTimeout(async () => {
          let query = this.client.from(table).select(select);

          if (filter) {
            query = query.eq(filter.column, filter.value);
          }

          const { data, error } = await query.single();

          const duration = Date.now() - startTime;
          log("debug", "Postgres query completed", { table, duration });

          if (error) {
            throw error;
          }

          return data as T;
        }, TIMEOUTS.DB_QUERY_MS);
      }, "postgres-query");
    });
  }

  async upsert(table: string, data: any, conflict: string): Promise<void> {
    const startTime = Date.now();

    return executeWithCircuitBreaker("postgres", async () => {
      return retry(async () => {
        return withTimeout(async () => {
          const { error } = await this.client
            .from(table)
            .upsert(data, { onConflict: conflict });

          const duration = Date.now() - startTime;
          log("debug", "Postgres upsert completed", { table, duration });

          if (error) {
            throw error;
          }
        }, TIMEOUTS.DB_QUERY_MS);
      }, "postgres-upsert");
    });
  }
}

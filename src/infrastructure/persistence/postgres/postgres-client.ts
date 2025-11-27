import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RetryPolicy } from "../../resilience/retry-policy";
import type { TimeoutPolicy } from "../../resilience/timeout-policy";
import type { CircuitBreaker } from "../../resilience/circuit-breaker";
import { PERFORMANCE } from "../../../config/constants";
import { logger } from "../../monitoring/logger";

export class PostgresClient {
  private readonly client: SupabaseClient;

  constructor(
    url: string,
    key: string,
    private readonly retryPolicy: RetryPolicy,
    private readonly timeoutPolicy: TimeoutPolicy,
    private readonly circuitBreaker: CircuitBreaker
  ) {
    this.client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  async queryOne<T>(
    table: string,
    select: string,
    filter?: { column: string; value: any }
  ): Promise<T | null> {
    const start = Date.now();

    return this.circuitBreaker.execute(async () => {
      return this.retryPolicy.execute(async () => {
        return this.timeoutPolicy.execute(async () => {
          let query = this.client.from(table).select(select);

          if (filter) {
            query = query.eq(filter.column, filter.value);
          }

          const { data, error } = await query.single();

          const duration = Date.now() - start;
          logger.debug("Postgres query completed", { table, duration });

          if (error) {
            throw error;
          }

          return data as T;
        }, PERFORMANCE.DB_QUERY_TIMEOUT_MS);
      }, "postgres-query");
    }, "postgres");
  }

  async upsert(table: string, data: any, conflict: string): Promise<void> {
    const start = Date.now();

    return this.circuitBreaker.execute(async () => {
      return this.retryPolicy.execute(async () => {
        return this.timeoutPolicy.execute(async () => {
          const { error } = await this.client
            .from(table)
            .upsert(data, { onConflict: conflict });

          const duration = Date.now() - start;
          logger.debug("Postgres upsert completed", { table, duration });

          if (error) {
            throw error;
          }
        }, PERFORMANCE.DB_QUERY_TIMEOUT_MS);
      }, "postgres-upsert");
    }, "postgres");
  }
}

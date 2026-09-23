import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { retry } from "../../lib/resilience/retry";
import { withTimeout } from "../../lib/resilience/timeout";
import { executeWithCircuitBreaker } from "../../lib/resilience/circuit-breaker";
import { TIMEOUTS } from "../../config/constants";
import { log } from "../../lib/logging/logger";

const CIRCUIT_BREAKER_SERVICE_NAME = "postgres";

export class PostgresClient {
  private readonly client: SupabaseClient;

  constructor(
    url: string,
    key: string,
    client: SupabaseClient = createClient(url, key, {
      auth: { persistSession: false },
    })
  ) {
    this.client = client;
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

            // maybeSingle yields data: null without an error for zero rows.
            // Errors indicate multiple rows or a real failure, both worth retrying.
            const { data, error } = await query.maybeSingle();

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

  async queryMany<T>(
    table: string,
    select: string,
    filter?: { column: string; value: unknown }
  ): Promise<T[]> {
    const startTime = Date.now();
    const operationName = `postgres-query-many-${table}`;

    return executeWithCircuitBreaker(CIRCUIT_BREAKER_SERVICE_NAME, async () => {
      return retry(async () => {
        return withTimeout(
          async () => {
            let query = this.client.from(table).select(select);

            if (filter) {
              query = query.eq(filter.column, filter.value);
            }

            const { data, error } = await query;

            const durationMs = Date.now() - startTime;
            log("debug", "Postgres query executed", {
              table,
              select,
              hasFilter: !!filter,
              durationMs,
              count: data?.length ?? 0,
            });

            if (error) {
              throw error;
            }

            return (data as T[]) ?? [];
          },
          TIMEOUTS.DB_QUERY_MS,
          operationName
        );
      }, operationName);
    });
  }

  async update(
    table: string,
    data: Record<string, unknown>,
    filter: { column: string; value: unknown }
  ): Promise<void> {
    const startTime = Date.now();
    const operationName = `postgres-update-${table}`;

    return executeWithCircuitBreaker(CIRCUIT_BREAKER_SERVICE_NAME, async () => {
      return retry(async () => {
        return withTimeout(
          async () => {
            const { error } = await this.client
              .from(table)
              .update(data)
              .eq(filter.column, filter.value);

            const durationMs = Date.now() - startTime;
            log("debug", "Postgres update executed", {
              table,
              column: filter.column,
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

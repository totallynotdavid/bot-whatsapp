import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../shared/logger";
import { RetryHandler } from "../external/retry-handler";
import { TimeoutHandler } from "../external/timeout-handler";

export class SupabaseService {
  private client: SupabaseClient;
  private readonly queryTimeoutMs = 5000;

  constructor(url: string, key: string) {
    this.client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  async query<T>(
    table: string,
    select: string,
    filter?: { column: string; value: any }
  ): Promise<T | null> {
    const start = Date.now();

    return RetryHandler.execute(
      async () => {
        return TimeoutHandler.execute(
          async () => {
            let query = this.client.from(table).select(select);

            if (filter) {
              query = query.eq(filter.column, filter.value);
            }

            const { data, error } = await query.single();

            const duration = Date.now() - start;
            logger.debug("DB query completed", { table, duration });

            if (error) throw error;
            return data as T;
          },
          `query-${table}`,
          this.queryTimeoutMs
        );
      },
      `supabase-query-${table}`,
      {
        maxRetries: 3,
        initialDelayMs: 500,
      }
    );
  }

  async upsert(table: string, data: any, conflict: string): Promise<void> {
    const start = Date.now();

    return RetryHandler.execute(
      async () => {
        return TimeoutHandler.execute(
          async () => {
            const { error } = await this.client
              .from(table)
              .upsert(data, { onConflict: conflict });

            const duration = Date.now() - start;
            logger.debug("DB upsert completed", { table, duration });

            if (error) throw error;
          },
          `upsert-${table}`,
          this.queryTimeoutMs
        );
      },
      `supabase-upsert-${table}`,
      {
        maxRetries: 3,
        initialDelayMs: 500,
      }
    );
  }
}

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../shared/logger";

export class SupabaseService {
  private client: SupabaseClient;

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

    try {
      let query = this.client.from(table).select(select);

      if (filter) {
        query = query.eq(filter.column, filter.value);
      }

      const { data, error } = await query.single();

      const duration = Date.now() - start;
      logger.debug("DB query", { table, duration });

      if (error) throw error;
      return data as T;
    } catch (err) {
      logger.error("DB query failed", err, { table });
      throw err;
    }
  }

  async upsert(table: string, data: any, conflict: string): Promise<void> {
    const start = Date.now();

    try {
      const { error } = await this.client
        .from(table)
        .upsert(data, { onConflict: conflict });

      const duration = Date.now() - start;
      logger.debug("DB upsert", { table, duration });

      if (error) throw error;
    } catch (err) {
      logger.error("DB upsert failed", err, { table });
      throw err;
    }
  }
}

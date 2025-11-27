import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config/env";
import type { User } from "../types/models";
import { Rank } from "../types/permissions";
import { logger } from "../utils/logger";

export class DatabaseService {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(config.SUPABASE_URL, config.SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  }

  async getUser(phoneNumber: string, name: string): Promise<User> {
    const normalizedPhone = phoneNumber.replace("@c.us", "");
    if (normalizedPhone === config.ADMIN_NUMBER) {
      return { id: phoneNumber, phoneNumber, name, rank: Rank.OWNER };
    }

    try {
      const { data: premiumUser } = await this.client
        .from("paid_users")
        .select("premium_expiry")
        .eq("phone_number", phoneNumber)
        .single();

      let rank = Rank.REGULAR;
      let premiumExpiry: Date | undefined;

      if (premiumUser?.premium_expiry) {
        const expiry = new Date(premiumUser.premium_expiry);
        if (expiry > new Date()) {
          rank = Rank.PREMIUM;
          premiumExpiry = expiry;
        }
      }

      return {
        id: phoneNumber,
        phoneNumber,
        name,
        rank,
        premiumExpiry,
      };
    } catch (err) {
      logger.error("Database error fetching user", err);
      return { id: phoneNumber, phoneNumber, name, rank: Rank.REGULAR };
    }
  }

  /**
   * Set a user's bot rank (e.g. give them Premium via command)
   */
  async setUserRank(
    phoneNumber: string,
    rank: Rank,
    expiryDays?: number
  ): Promise<void> {
    if (rank === Rank.PREMIUM && expiryDays) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + expiryDays);

      const { error } = await this.client.from("paid_users").upsert(
        {
          phone_number: phoneNumber,
          premium_expiry: expiry.toISOString(),
          customer_name: "Manual add",
        },
        { onConflict: "phone_number" }
      );

      if (error) throw error;
    }
  }
}

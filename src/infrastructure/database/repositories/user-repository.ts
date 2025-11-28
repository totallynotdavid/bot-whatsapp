import type { User } from "../../../domain/user";
import { Rank, calculateDaysUntilExpiry } from "../../../domain/user";
import type { PostgresClient } from "../postgres";
import { log } from "../../../lib/logging/logger";

interface UserRow {
  phone_number: string;
  premium_expiry: string;
  customer_name: string;
}

const TABLE_NAME = "paid_users";
const CONFLICT_COLUMN = "phone_number";

export class UserRepository {
  constructor(private readonly postgres: PostgresClient) {}

  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    try {
      const row = await this.postgres.queryOne<UserRow>(
        TABLE_NAME,
        "phone_number, premium_expiry, customer_name",
        { column: "phone_number", value: phoneNumber }
      );

      if (!row || !row.premium_expiry) {
        return null;
      }

      const expiresAt = new Date(row.premium_expiry);
      const isActive = expiresAt > new Date();

      return {
        phoneNumber,
        name: row.customer_name || "Usuario",
        rank: isActive ? Rank.PREMIUM : Rank.REGULAR,
        premiumExpiresAt: isActive ? expiresAt : undefined,
      };
    } catch (error) {
      log("warn", "Failed to load user from Postgres", {
        phoneNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async upsertPremiumUser(user: User): Promise<void> {
    if (user.rank < Rank.PREMIUM || !user.premiumExpiresAt) {
      throw new Error("User must be premium with expiry date");
    }

    try {
      await this.postgres.upsert(
        TABLE_NAME,
        {
          phone_number: user.phoneNumber,
          premium_expiry: user.premiumExpiresAt.toISOString(),
          customer_name: user.name,
        },
        CONFLICT_COLUMN
      );
    } catch (error) {
      log("error", "Failed to upsert premium user to Postgres", {
        phoneNumber: user.phoneNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async syncPremiumUser(phoneNumber: string, expiryDate: Date): Promise<void> {
    const daysRemaining = calculateDaysUntilExpiry(expiryDate);

    if (daysRemaining <= 0) {
      return;
    }

    try {
      await this.postgres.upsert(
        TABLE_NAME,
        {
          phone_number: phoneNumber,
          premium_expiry: expiryDate.toISOString(),
          customer_name: "Sync",
        },
        CONFLICT_COLUMN
      );
    } catch (error) {
      log("warn", "Failed to sync premium user", {
        phoneNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

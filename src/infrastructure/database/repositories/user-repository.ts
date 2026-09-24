import type { UserStore } from "../../../application/ports/user-store";
import type { User } from "../../../domain/user";
import { Rank } from "../../../domain/user";
import type { PostgresClient } from "../postgres";
import { log } from "../../../lib/logging/logger";

interface UserRow {
  phone_number: string;
  premium_expiry: string;
  customer_name: string;
}

const TABLE_NAME = "paid_users";
const CONFLICT_COLUMN = "phone_number";

export class UserRepository implements UserStore {
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

  async findAllActivePremiumUsers(): Promise<User[]> {
    try {
      const rows = await this.postgres.queryMany<UserRow>(
        TABLE_NAME,
        "phone_number, premium_expiry, customer_name"
      );

      const now = new Date();

      return rows
        .filter(
          (row) => row.premium_expiry && new Date(row.premium_expiry) > now
        )
        .map((row) => ({
          phoneNumber: row.phone_number,
          name: row.customer_name || "Usuario",
          rank: Rank.PREMIUM,
          premiumExpiresAt: new Date(row.premium_expiry),
        }));
    } catch (error) {
      log("warn", "Failed to load active premium users from Postgres", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
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
}

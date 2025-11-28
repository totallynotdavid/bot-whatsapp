import type { User } from "../core/types";
import { Rank } from "../core/types";
import type { PostgresAdapter } from "../adapters/postgres-adapter";
import { SYNC_INTERVAL } from "../config";
import { log } from "../lib/logger";

export class UserStore {
  private localUsers = new Map<string, User>();
  private syncIntervalId?: NodeJS.Timeout;

  constructor(
    private readonly postgres: PostgresAdapter,
    private readonly ownerPhone: string
  ) {
    this.startPeriodicSync();
  }

  async getUser(phoneNumber: string): Promise<User> {
    if (phoneNumber === this.ownerPhone) {
      return {
        phoneNumber: this.ownerPhone,
        name: "Owner",
        rank: Rank.OWNER,
      };
    }

    const localUser = this.localUsers.get(phoneNumber);

    if (localUser) {
      return localUser;
    }

    try {
      const postgresUser = await this.loadFromPostgres(phoneNumber);
      this.localUsers.set(phoneNumber, postgresUser);
      return postgresUser;
    } catch {
      const regularUser = this.createRegularUser(phoneNumber);
      this.localUsers.set(phoneNumber, regularUser);
      return regularUser;
    }
  }

  async updateRank(
    phoneNumber: string,
    rank: Rank,
    expiryDays?: number
  ): Promise<void> {
    if (rank !== Rank.PREMIUM || !expiryDays) {
      throw new Error("Only premium rank with expiry days is supported");
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const user: User = {
      phoneNumber,
      name: "Premium User",
      rank: Rank.PREMIUM,
      premiumExpiresAt: expiresAt,
    };

    this.localUsers.set(phoneNumber, user);

    try {
      await this.saveToPostgres(phoneNumber, rank, expiryDays);
    } catch (error) {
      log("error", "Failed to sync rank to Postgres", {
        phoneNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async countPremiumUsers(): Promise<number> {
    const now = new Date();
    let count = 0;

    for (const user of this.localUsers.values()) {
      if (user.rank >= Rank.PREMIUM) {
        if (!user.premiumExpiresAt || user.premiumExpiresAt > now) {
          count++;
        }
      }
    }

    return count;
  }

  stopSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = undefined;
    }
  }

  private async loadFromPostgres(phoneNumber: string): Promise<User> {
    const row = await this.postgres.queryOne<{
      phone_number: string;
      premium_expiry: string;
      customer_name: string;
    }>("paid_users", "phone_number, premium_expiry, customer_name", {
      column: "phone_number",
      value: phoneNumber,
    });

    if (!row || !row.premium_expiry) {
      throw new Error("User not found in Postgres");
    }

    const expiresAt = new Date(row.premium_expiry);
    const isActive = expiresAt > new Date();

    return {
      phoneNumber,
      name: row.customer_name || "Usuario",
      rank: isActive ? Rank.PREMIUM : Rank.REGULAR,
      premiumExpiresAt: isActive ? expiresAt : undefined,
    };
  }

  private async saveToPostgres(
    phoneNumber: string,
    rank: Rank,
    expiryDays: number
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    await this.postgres.upsert(
      "paid_users",
      {
        phone_number: phoneNumber,
        premium_expiry: expiresAt.toISOString(),
        customer_name: "Manual",
      },
      "phone_number"
    );
  }

  private createRegularUser(phoneNumber: string): User {
    return {
      phoneNumber,
      name: "Usuario",
      rank: Rank.REGULAR,
    };
  }

  private startPeriodicSync(): void {
    this.syncIntervalId = setInterval(() => {
      this.syncAllToPostgres().catch((error) =>
        log("error", "Periodic Postgres sync failed", {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }, SYNC_INTERVAL.POSTGRES_BACKUP_MS);

    log("info", "Periodic Postgres sync started", {
      intervalMs: SYNC_INTERVAL.POSTGRES_BACKUP_MS,
    });
  }

  private async syncAllToPostgres(): Promise<void> {
    for (const [phoneNumber, user] of this.localUsers.entries()) {
      if (user.rank >= Rank.PREMIUM && user.premiumExpiresAt) {
        const now = new Date();
        const daysRemaining = Math.ceil(
          (user.premiumExpiresAt.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24)
        );

        if (daysRemaining > 0) {
          try {
            await this.saveToPostgres(phoneNumber, Rank.PREMIUM, daysRemaining);
          } catch (error) {
            log("warn", "Failed to sync user to Postgres", {
              phoneNumber,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }
  }
}

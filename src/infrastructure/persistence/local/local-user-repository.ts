import type { User } from "../../../domain/models/user.model";
import type { IUserRepository } from "../../../domain/repositories/user-repository.interface";
import type { PhoneNumber } from "../../../domain/value-objects/phone-number.vo";
import { Rank } from "../../../domain/value-objects/rank.vo";
import type { ICacheRepository } from "../cache/cache-repository.interface";
import { logger } from "../../monitoring/logger";
import { SYNC } from "../../../config/constants";

export class LocalUserRepository implements IUserRepository {
  private localUsers = new Map<string, User>();
  private syncIntervalId?: NodeJS.Timeout;

  constructor(
    private readonly cache: ICacheRepository,
    private readonly postgresBackup: IUserRepository,
    private readonly ownerPhone: PhoneNumber
  ) {
    this.startPeriodicSync();
  }

  async findByPhone(phone: PhoneNumber): Promise<User> {
    if (phone.equals(this.ownerPhone)) {
      return this.createOwnerUser();
    }

    const phoneKey = phone.toString();
    const localUser = this.localUsers.get(phoneKey);

    if (localUser) {
      return localUser;
    }

    try {
      const postgresUser = await this.postgresBackup.findByPhone(phone);
      this.localUsers.set(phoneKey, postgresUser);
      return postgresUser;
    } catch {
      return this.createRegularUser(phone);
    }
  }

  async updateRank(
    phone: PhoneNumber,
    rank: Rank,
    expiryDays?: number
  ): Promise<void> {
    if (rank !== Rank.PREMIUM || !expiryDays) {
      throw new Error("Only premium rank with expiry days is supported");
    }

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + expiryDays);

    const user: User = {
      phoneNumber: phone,
      name: "Manual",
      rank: Rank.PREMIUM,
      premiumExpiry: expiry,
    };

    this.localUsers.set(phone.toString(), user);

    try {
      await this.postgresBackup.updateRank(phone, rank, expiryDays);
    } catch (error) {
      logger.error("Failed to sync rank update to Postgres", error, {
        phone: phone.toString(),
      });
    }
  }

  async countPremiumUsers(): Promise<number> {
    const now = new Date();
    let count = 0;

    for (const user of this.localUsers.values()) {
      if (user.rank >= Rank.PREMIUM) {
        if (!user.premiumExpiry || user.premiumExpiry > now) {
          count++;
        }
      }
    }

    return count;
  }

  getOwnerPhone(): PhoneNumber {
    return this.ownerPhone;
  }

  private createOwnerUser(): User {
    return {
      phoneNumber: this.ownerPhone,
      name: "Owner",
      rank: Rank.OWNER,
    };
  }

  private createRegularUser(phone: PhoneNumber): User {
    const user: User = {
      phoneNumber: phone,
      name: "Usuario",
      rank: Rank.REGULAR,
    };

    this.localUsers.set(phone.toString(), user);
    return user;
  }

  private startPeriodicSync(): void {
    this.syncIntervalId = setInterval(() => {
      this.syncToPostgres().catch((error) =>
        logger.error("Periodic Postgres sync failed", error)
      );
    }, SYNC.POSTGRES_BACKUP_INTERVAL_MS);

    logger.info("Periodic Postgres sync started", {
      intervalMs: SYNC.POSTGRES_BACKUP_INTERVAL_MS,
    });
  }

  private async syncToPostgres(): Promise<void> {
    logger.debug("Starting Postgres sync");

    for (const [phoneStr, user] of this.localUsers.entries()) {
      if (user.rank >= Rank.PREMIUM && user.premiumExpiry) {
        try {
          const now = new Date();
          const daysRemaining = Math.ceil(
            (user.premiumExpiry.getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          );

          if (daysRemaining > 0) {
            await this.postgresBackup.updateRank(
              user.phoneNumber,
              Rank.PREMIUM,
              daysRemaining
            );
          }
        } catch (error) {
          logger.warn("Failed to sync user to Postgres", {
            phone: phoneStr,
            error,
          });
        }
      }
    }

    logger.debug("Postgres sync completed");
  }

  stopSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = undefined;
    }
  }
}

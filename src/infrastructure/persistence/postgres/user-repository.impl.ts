import type { User } from "../../../domain/models/user.model";
import type { IUserRepository } from "../../../domain/repositories/user-repository.interface";
import type { PhoneNumber } from "../../../domain/value-objects/phone-number.vo";
import { Rank } from "../../../domain/value-objects/rank.vo";
import type { PostgresClient } from "./postgres-client";

interface PremiumUserRow {
  phone_number: string;
  premium_expiry: string;
  customer_name: string;
}

export class PostgresUserRepository implements IUserRepository {
  constructor(
    private readonly db: PostgresClient,
    private readonly ownerPhone: PhoneNumber
  ) {}

  async findByPhone(phone: PhoneNumber): Promise<User> {
    if (phone.equals(this.ownerPhone)) {
      return {
        phoneNumber: phone,
        name: "Owner",
        rank: Rank.OWNER,
      };
    }

    try {
      const row = await this.db.queryOne<PremiumUserRow>(
        "paid_users",
        "phone_number, premium_expiry, customer_name",
        { column: "phone_number", value: phone.toString() }
      );

      if (row?.premium_expiry) {
        const expiry = new Date(row.premium_expiry);
        const isActive = expiry > new Date();

        return {
          phoneNumber: phone,
          name: row.customer_name || "Usuario",
          rank: isActive ? Rank.PREMIUM : Rank.REGULAR,
          premiumExpiry: isActive ? expiry : undefined,
        };
      }
    } catch {
      // User not found in premium table
    }

    return {
      phoneNumber: phone,
      name: "Usuario",
      rank: Rank.REGULAR,
    };
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

    await this.db.upsert(
      "paid_users",
      {
        phone_number: phone.toString(),
        premium_expiry: expiry.toISOString(),
        customer_name: "Manual",
      },
      "phone_number"
    );
  }

  async countPremiumUsers(): Promise<number> {
    const result = await this.db.queryOne<{ count: number }>(
      "paid_users",
      "count(*) as count",
      undefined
    );

    return result?.count || 0;
  }

  getOwnerPhone(): PhoneNumber {
    return this.ownerPhone;
  }
}

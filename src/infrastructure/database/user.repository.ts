import type { IUserRepository } from "../../domain/repositories/user.repository.interface";
import type { User } from "../../domain/entities/user";
import type { PhoneNumber } from "../../domain/value-objects/phone-number";
import { Rank } from "../../domain/value-objects/rank";
import type { SupabaseService } from "./supabase.client";

interface PremiumUserRow {
  phone_number: string;
  premium_expiry: string;
  customer_name: string;
}

export class UserRepository implements IUserRepository {
  constructor(
    private db: SupabaseService,
    private ownerPhone: PhoneNumber
  ) {}

  async getByPhone(phone: PhoneNumber): Promise<User> {
    if (phone.equals(this.ownerPhone)) {
      return {
        phoneNumber: phone,
        name: "Owner",
        rank: Rank.OWNER,
      };
    }

    try {
      const row = await this.db.query<PremiumUserRow>(
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
    } catch (_err) {
      // User not found in premium table
    }

    return {
      phoneNumber: phone,
      name: "Usuario",
      rank: Rank.REGULAR,
    };
  }

  async setRank(
    phone: PhoneNumber,
    rank: Rank,
    expiryDays?: number
  ): Promise<void> {
    if (rank !== Rank.PREMIUM || !expiryDays) {
      throw new Error(
        "Solo se puede establecer premium con días de expiración"
      );
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
}

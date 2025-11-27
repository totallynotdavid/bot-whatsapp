import type { User } from "../models/user.model";
import type { PhoneNumber } from "../value-objects/phone-number.vo";
import type { Rank } from "../value-objects/rank.vo";

export interface IUserRepository {
  findByPhone(phone: PhoneNumber): Promise<User>;
  updateRank(
    phone: PhoneNumber,
    rank: Rank,
    expiryDays?: number
  ): Promise<void>;
  countPremiumUsers(): Promise<number>;
  getOwnerPhone(): PhoneNumber;
}

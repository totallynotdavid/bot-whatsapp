import type { User } from "../entities/user";
import type { PhoneNumber } from "../value-objects/phone-number";
import type { Rank } from "../value-objects/rank";

export interface IUserRepository {
  getByPhone(phone: PhoneNumber): Promise<User>;
  setRank(phone: PhoneNumber, rank: Rank, expiryDays?: number): Promise<void>;
}

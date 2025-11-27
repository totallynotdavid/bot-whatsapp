import type { PhoneNumber } from "../value-objects/phone-number";
import { Rank } from "../value-objects/rank";

export interface User {
  readonly phoneNumber: PhoneNumber;
  readonly name: string;
  readonly rank: Rank;
  readonly premiumExpiry?: Date;
}

export function isPremiumActive(user: User): boolean {
  if (user.rank < Rank.PREMIUM) return false;
  if (!user.premiumExpiry) return user.rank >= Rank.PREMIUM;
  return user.premiumExpiry > new Date();
}

export function isOwner(user: User, ownerPhone: PhoneNumber): boolean {
  return user.phoneNumber.equals(ownerPhone);
}

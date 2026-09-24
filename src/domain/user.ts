export enum Rank {
  REGULAR = 10,
  PREMIUM = 20,
  OWNER = 100,
}

export interface User {
  readonly phoneNumber: string;
  readonly name: string;
  readonly rank: Rank;
  readonly premiumExpiresAt?: Date;
}

export function canExecuteCommand(userRank: Rank, requiredRank: Rank): boolean {
  return userRank >= requiredRank;
}

export function isPremiumActive(user: User): boolean {
  if (user.rank < Rank.PREMIUM) return false;
  if (!user.premiumExpiresAt) return user.rank >= Rank.PREMIUM;
  return user.premiumExpiresAt > new Date();
}

export function isOwner(user: User, ownerPhone: string): boolean {
  return user.phoneNumber === ownerPhone;
}

export function calculatePremiumExpiryDate(daysFromNow: number): Date {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + daysFromNow);
  return expiryDate;
}

export function createRegularUser(phoneNumber: string, name?: string): User {
  return {
    phoneNumber,
    name: name || "Usuario",
    rank: Rank.REGULAR,
  };
}

export function createOwnerUser(phoneNumber: string): User {
  return {
    phoneNumber,
    name: "Owner",
    rank: Rank.OWNER,
  };
}

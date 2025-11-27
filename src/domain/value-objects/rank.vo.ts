export enum Rank {
  BANNED = 0,
  REGULAR = 10,
  PREMIUM = 20,
  MODERATOR = 50,
  ADMIN = 90,
  OWNER = 100,
}

export function canExecuteCommand(userRank: Rank, requiredRank: Rank): boolean {
  return userRank >= requiredRank;
}

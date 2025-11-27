/**
 * Role-based access control.
 * Uses numeric values to allow >= comparisons (e.g., Rank.ADMIN > Rank.USER)
 */
export enum Rank {
  BANNED = 0,
  REGULAR = 10, // Standard user
  PREMIUM = 20, // Paid subscriber or premium group member
  MODERATOR = 50, // Bot moderator
  ADMIN = 90, // Bot administrator
  OWNER = 100, // Bot owner (system root)
}

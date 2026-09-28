import type { User } from "../../domain/user";

export interface UserStore {
  findByPhoneNumber(phoneNumber: string): Promise<User | null>;
  findAllActivePremiumUsers(): Promise<User[]>;
  upsertPremiumUser(user: User): Promise<void>;
}

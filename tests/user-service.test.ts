// Exercises UserService.grantPremium: the resulting user's rank and its
// persistence to Postgres.

import { describe, expect, test } from "vitest";
import { UserRepository } from "../src/infrastructure/database/repositories/user-repository";
import { UserService } from "../src/application/services/user-service";
import { Rank } from "../src/domain/user";
import { FakePostgres } from "./fixtures";

const OWNER_PHONE = "51900000000";
const PHONE = "51922222222";

function setup() {
  const postgres = new FakePostgres().asPostgresClient();

  const userRepo = new UserRepository(postgres);
  const userService = new UserService(userRepo, OWNER_PHONE);

  return { userService, userRepo };
}

describe("UserService.grantPremium", () => {
  test("returns a user with rank Rank.PREMIUM", async () => {
    const { userService } = setup();

    const user = await userService.grantPremium(PHONE, 30, "Ana");

    expect(user.rank).toBe(Rank.PREMIUM);
  });

  test("the granted rank is what gets persisted and read back", async () => {
    const { userService, userRepo } = setup();

    await userService.grantPremium(PHONE, 30, "Ana");

    const stored = await userRepo.findByPhoneNumber(PHONE);
    expect(stored?.rank).toBe(Rank.PREMIUM);
  });
});

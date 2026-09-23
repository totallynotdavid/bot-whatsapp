import { describe, expect, test } from "vitest";
import { Rank } from "../src/domain/user";
import { REGULAR_PHONE, makeBot } from "./fixtures";

describe("UserService.grantPremium", () => {
  test("returns a user with rank Rank.PREMIUM", async () => {
    const { userService } = makeBot();

    const user = await userService.grantPremium(REGULAR_PHONE, 30, "Ana");

    expect(user.rank).toBe(Rank.PREMIUM);
  });

  test("the granted rank is what gets persisted and read back", async () => {
    const { userService, userRepo } = makeBot();

    await userService.grantPremium(REGULAR_PHONE, 30, "Ana");

    const stored = await userRepo.findByPhoneNumber(REGULAR_PHONE);
    expect(stored?.rank).toBe(Rank.PREMIUM);
  });
});

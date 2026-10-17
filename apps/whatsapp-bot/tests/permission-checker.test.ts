import { describe, expect, test } from "vitest";
import { PermissionChecker } from "../src/application/services/permission-checker";
import { Rank } from "../src/domain/user";
import { formatPermissionDenied } from "../src/i18n/es";
import { OWNER_PHONE, REGULAR_PHONE } from "./fixtures";

describe("PermissionChecker.checkPermission", () => {
  const checker = new PermissionChecker(OWNER_PHONE);

  test.each([
    ["the owner, whatever their rank", OWNER_PHONE, Rank.REGULAR, Rank.OWNER],
    ["a rank above the requirement", REGULAR_PHONE, Rank.PREMIUM, Rank.REGULAR],
    [
      "a rank equal to the requirement",
      REGULAR_PHONE,
      Rank.PREMIUM,
      Rank.PREMIUM,
    ],
  ])("allows %s", (_name, phoneNumber, rank, required) => {
    const result = checker.checkPermission(
      { phoneNumber, name: "Ana", rank },
      required
    );

    expect(result).toEqual({ allowed: true });
  });

  test("denies a rank below the requirement with the denial message", () => {
    const result = checker.checkPermission(
      { phoneNumber: REGULAR_PHONE, name: "Ana", rank: Rank.REGULAR },
      Rank.PREMIUM
    );

    expect(result).toEqual({
      allowed: false,
      denialReason: formatPermissionDenied(Rank.PREMIUM),
    });
  });
});

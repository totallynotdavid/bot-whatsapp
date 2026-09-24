import { describe, expect, test } from "vitest";
import { PermissionChecker } from "../src/application/services/permission-checker";
import { Rank, createRegularUser } from "../src/domain/user";
import { formatPermissionDenied } from "../src/i18n/es";
import { OWNER_PHONE, REGULAR_PHONE } from "./fixtures";

describe("PermissionChecker.checkPermission", () => {
  test("the owner is always allowed, regardless of rank", () => {
    const checker = new PermissionChecker(OWNER_PHONE);
    const owner = {
      phoneNumber: OWNER_PHONE,
      name: "Owner",
      rank: Rank.BANNED,
    };

    const result = checker.checkPermission(owner, Rank.OWNER);

    expect(result).toEqual({ allowed: true });
  });

  test("a user with sufficient rank is allowed", () => {
    const checker = new PermissionChecker(OWNER_PHONE);
    const user = createRegularUser(REGULAR_PHONE);

    const result = checker.checkPermission(user, Rank.REGULAR);

    expect(result).toEqual({ allowed: true });
  });

  test("a user whose rank exactly equals the requirement is allowed", () => {
    const checker = new PermissionChecker(OWNER_PHONE);
    const user = {
      phoneNumber: REGULAR_PHONE,
      name: "Ana",
      rank: Rank.PREMIUM,
    };

    const result = checker.checkPermission(user, Rank.PREMIUM);

    expect(result).toEqual({ allowed: true });
  });

  test("a user one rank below the requirement is denied", () => {
    const checker = new PermissionChecker(OWNER_PHONE);
    const user = createRegularUser(REGULAR_PHONE);

    const result = checker.checkPermission(user, Rank.PREMIUM);

    expect(result).toEqual({
      allowed: false,
      denialReason: formatPermissionDenied(Rank.PREMIUM),
    });
  });

  test("a banned non-owner is denied even the lowest requirement", () => {
    const checker = new PermissionChecker(OWNER_PHONE);
    const banned = {
      phoneNumber: REGULAR_PHONE,
      name: "Bad",
      rank: Rank.BANNED,
    };

    const result = checker.checkPermission(banned, Rank.REGULAR);

    expect(result).toEqual({
      allowed: false,
      denialReason: formatPermissionDenied(Rank.REGULAR),
    });
  });

  test("a user with insufficient rank is denied with the i18n denial message", () => {
    const checker = new PermissionChecker(OWNER_PHONE);
    const user = createRegularUser(REGULAR_PHONE);

    const result = checker.checkPermission(user, Rank.PREMIUM);

    expect(result).toEqual({
      allowed: false,
      denialReason: formatPermissionDenied(Rank.PREMIUM),
    });
  });
});

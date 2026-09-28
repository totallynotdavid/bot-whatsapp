import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LIMITS } from "../src/config/constants";
import { PostgresClient } from "../src/infrastructure/database/postgres";
import { REGULAR_PHONE } from "./fixtures";

type QueryResult = { data: unknown; error: unknown };

function makeFakeSupabase(result: QueryResult) {
  const counter = { calls: 0 };
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => {
      counter.calls++;
      return result;
    },
  };
  const client = { from: () => builder } as unknown as SupabaseClient;
  return { client, counter };
}

function makePostgres(result: QueryResult) {
  const { client, counter } = makeFakeSupabase(result);
  return {
    postgres: new PostgresClient("http://unused", "unused", client),
    counter,
  };
}

// Rejects are attached before timers advance so backoff sleeps run instantly.
async function settle<T>(promise: Promise<T>) {
  const outcome = promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error })
  );
  await vi.runAllTimersAsync();
  return outcome;
}

const lookup = (postgres: PostgresClient) =>
  postgres.queryOne("paid_users", "*", {
    column: "phone",
    value: REGULAR_PHONE,
  });

describe("PostgresClient.queryOne", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns the row when exactly one matches", async () => {
    const { postgres, counter } = makePostgres({
      data: { phone: "1" },
      error: null,
    });

    const outcome = await settle(lookup(postgres));

    expect(outcome).toEqual({ value: { phone: "1" } });
    expect(counter.calls).toBe(1);
  });

  test("zero rows returns null after a single query, without retrying", async () => {
    const { postgres, counter } = makePostgres({ data: null, error: null });

    const outcome = await settle(lookup(postgres));

    expect(outcome).toEqual({ value: null });
    expect(counter.calls).toBe(1);
  });

  test("multiple rows throws after exhausting retries", async () => {
    const duplicateRows = {
      code: "PGRST116",
      message: "JSON object requested, multiple (or no) rows returned",
    };
    const { postgres, counter } = makePostgres({
      data: null,
      error: duplicateRows,
    });

    const outcome = await settle(lookup(postgres));

    expect(outcome).toHaveProperty("error");
    expect(counter.calls).toBe(LIMITS.RETRY_MAX_ATTEMPTS);
  });

  test("a transient error retries and then throws", async () => {
    const { postgres, counter } = makePostgres({
      data: null,
      error: new Error("fetch failed"),
    });

    const outcome = await settle(lookup(postgres));

    expect(outcome).toMatchObject({ error: { message: "fetch failed" } });
    expect(counter.calls).toBe(LIMITS.RETRY_MAX_ATTEMPTS);
  });
});

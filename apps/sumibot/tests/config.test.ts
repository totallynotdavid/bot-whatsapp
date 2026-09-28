import { describe, expect, test } from "vitest";
import { loadConfig } from "../src/config";

const REQUIRED = {
  OWNER_PHONE: "51999999999",
  SUPABASE_URL: "https://abc.supabase.co",
  SUPABASE_KEY: "k".repeat(32),
};

describe("loadConfig", () => {
  test("defaults to Baileys, the ! prefix and a loopback notify server", () => {
    const config = loadConfig(REQUIRED);

    expect(config).toMatchObject({
      WHATSAPP_TRANSPORT: "baileys",
      COMMAND_PREFIX: "!",
      HTTP_HOST: "127.0.0.1",
      HTTP_PORT: 6000,
      LOG_LEVEL: "info",
      NODE_ENV: "production",
    });
  });

  test("reads every optional value it is given", () => {
    const config = loadConfig({
      ...REQUIRED,
      WHATSAPP_TRANSPORT: "wwebjs",
      COMMAND_PREFIX: "#",
      HTTP_HOST: "0.0.0.0",
      HTTP_PORT: "7000",
      CHROME_PATH: "/usr/bin/chromium",
      LOG_LEVEL: "debug",
    });

    expect(config).toMatchObject({
      WHATSAPP_TRANSPORT: "wwebjs",
      COMMAND_PREFIX: "#",
      HTTP_HOST: "0.0.0.0",
      HTTP_PORT: 7000,
      CHROME_PATH: "/usr/bin/chromium",
      LOG_LEVEL: "debug",
    });
  });

  test.each(["OWNER_PHONE", "SUPABASE_URL", "SUPABASE_KEY"])(
    "requires %s",
    (name) => {
      const { [name as keyof typeof REQUIRED]: _omitted, ...rest } = REQUIRED;

      expect(() => loadConfig(rest)).toThrow(name);
    }
  );

  test.each([
    ["OWNER_PHONE", "+51 999 999 999"],
    ["SUPABASE_URL", "not a url"],
    ["SUPABASE_KEY", "short"],
    ["WHATSAPP_TRANSPORT", "telegram"],
    ["HTTP_PORT", "70000"],
    ["COMMAND_PREFIX", ""],
  ])("rejects an invalid %s", (name, value) => {
    expect(() => loadConfig({ ...REQUIRED, [name]: value })).toThrow(name);
  });

  test("lists every problem at once", () => {
    expect(() => loadConfig({})).toThrow(
      /OWNER_PHONE[\s\S]*SUPABASE_URL[\s\S]*SUPABASE_KEY/
    );
  });
});

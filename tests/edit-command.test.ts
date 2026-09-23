import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { EditCommand } from "../src/application/commands/edit-command";
import { EDIT_EFFECTS } from "../src/infrastructure/external/dig-effects";
import type { EditEffect } from "../src/infrastructure/external/dig-effects";
import { resolveEditArgs } from "../src/lib/utils/edit-args";
import { TempFileStore } from "../src/infrastructure/storage/temp-file-store";
import type {
  ImgurClient,
  ImgurUpload,
} from "../src/infrastructure/external/imgur-client";
import {
  MESSAGES,
  formatEditUnknownEffect,
  formatEditWrongAvatarCount,
  formatEditMinAvatarCount,
  formatEditMissingNumber,
  formatEditMissingText,
  formatEditMissingCurrency,
  formatEditWrongNameCount,
  formatEditCaption,
} from "../src/i18n/es";
import { REGULAR_PHONE, dm, makeBot } from "./fixtures";

describe("EDIT_EFFECTS registry", () => {
  test("is keyed by lowercase name for case-insensitive lookup", () => {
    for (const [key, effect] of EDIT_EFFECTS) {
      expect(key).toBe(effect.name.toLowerCase());
    }
  });

  test("every effect takes an avatar unless it is text-only", () => {
    const offenders = [...EDIT_EFFECTS.values()]
      .filter((e) => e.param.kind !== "text" && e.avatarCount < 1)
      .map((e) => e.name);
    expect(offenders).toEqual([]);
  });

  test("every effect declares a supported output format", () => {
    const offenders = [...EDIT_EFFECTS.values()]
      .filter((e) => e.outputFormat !== "image" && e.outputFormat !== "gif")
      .map((e) => e.name);
    expect(offenders).toEqual([]);
  });

  test("Podium requires exactly 3 avatars and 3 names", () => {
    const podium = EDIT_EFFECTS.get("podium")!;
    expect(podium.avatarCount).toBe(3);
    expect(podium.variableAvatars).toBe(false);
    expect(podium.param).toEqual({ kind: "names", count: 3 });
  });
});

describe("resolveEditArgs", () => {
  const gay = EDIT_EFFECTS.get("gay")!;

  test("rejects fewer mentions than required", () => {
    const result = resolveEditArgs(gay, ["gay"], []);
    expect(result).toEqual({
      ok: false,
      error: { type: "wrong-avatar-count", required: 1 },
    });
  });

  test("rejects more mentions than required", () => {
    const result = resolveEditArgs(gay, ["gay", "@1", "@2"], ["1", "2"]);
    expect(result).toEqual({
      ok: false,
      error: { type: "wrong-avatar-count", required: 1 },
    });
  });

  test("accepts exactly the required mentions", () => {
    const result = resolveEditArgs(gay, ["gay", "@1"], ["1"]);
    expect(result).toEqual({ ok: true, avatars: ["1"], extra: [] });
  });

  const blink = EDIT_EFFECTS.get("blink")!;

  test("Blink requires at least one mention", () => {
    const result = resolveEditArgs(blink, ["blink", "5"], []);
    expect(result).toEqual({
      ok: false,
      error: { type: "min-avatar-count", required: 1 },
    });
  });

  test("Blink accepts any number of mentions plus a trailing delay", () => {
    const result = resolveEditArgs(
      blink,
      ["blink", "@1", "@2", "@3", "7"],
      ["1", "2", "3"]
    );
    expect(result).toEqual({
      ok: true,
      avatars: ["1", "2", "3"],
      extra: ["7"],
    });
  });

  test("Blink rejects a non-numeric delay", () => {
    const result = resolveEditArgs(blink, ["blink", "@1", "fast"], ["1"]);
    expect(result).toEqual({ ok: false, error: { type: "missing-number" } });
  });

  const lisa = EDIT_EFFECTS.get("lisapresentation")!;

  test("LisaPresentation needs no avatars but requires non-empty text", () => {
    const missing = resolveEditArgs(lisa, ["lisapresentation"], []);
    expect(missing).toEqual({ ok: false, error: { type: "missing-text" } });

    const ok = resolveEditArgs(lisa, ["lisapresentation", "hola", "mundo"], []);
    expect(ok).toEqual({ ok: true, avatars: [], extra: ["hola", "mundo"] });
  });

  const wanted = EDIT_EFFECTS.get("wanted")!;

  test("Wanted requires a currency token after the mention", () => {
    const missing = resolveEditArgs(wanted, ["wanted", "@1"], ["1"]);
    expect(missing).toEqual({
      ok: false,
      error: { type: "missing-currency" },
    });

    const ok = resolveEditArgs(wanted, ["wanted", "@1", "USD"], ["1"]);
    expect(ok).toEqual({ ok: true, avatars: ["1"], extra: ["USD"] });
  });

  const podium = EDIT_EFFECTS.get("podium")!;

  test("Podium requires exactly 3 names after its 3 mentions", () => {
    const tooFew = resolveEditArgs(
      podium,
      ["podium", "@1", "@2", "@3", "A", "B"],
      ["1", "2", "3"]
    );
    expect(tooFew).toEqual({
      ok: false,
      error: { type: "wrong-name-count", required: 3 },
    });

    const tooMany = resolveEditArgs(
      podium,
      ["podium", "@1", "@2", "@3", "A", "B", "C", "D"],
      ["1", "2", "3"]
    );
    expect(tooMany).toEqual({
      ok: false,
      error: { type: "wrong-name-count", required: 3 },
    });

    const ok = resolveEditArgs(
      podium,
      ["podium", "@1", "@2", "@3", "A", "B", "C"],
      ["1", "2", "3"]
    );
    expect(ok).toEqual({
      ok: true,
      avatars: ["1", "2", "3"],
      extra: ["A", "B", "C"],
    });
  });

  test("Podium rejects the wrong avatar count before names are even checked", () => {
    const result = resolveEditArgs(podium, ["podium", "@1", "@2"], ["1", "2"]);
    expect(result).toEqual({
      ok: false,
      error: { type: "wrong-avatar-count", required: 3 },
    });
  });
});

class FakeImgurClient {
  private counter = 0;
  configured = true;
  failUploads = false;
  readonly uploadedUrls: string[] = [];
  readonly deletedHashes: string[] = [];

  isConfigured(): boolean {
    return this.configured;
  }

  async upload(imageUrl: string): Promise<ImgurUpload> {
    this.uploadedUrls.push(imageUrl);
    if (this.failUploads) throw new Error("simulated Imgur failure");
    this.counter++;
    return {
      link: `https://imgur.example/${this.counter}`,
      deleteHash: `hash-${this.counter}`,
    };
  }

  async deleteImage(deleteHash: string): Promise<void> {
    this.deletedHashes.push(deleteHash);
  }

  asImgurClient(): ImgurClient {
    return this as unknown as ImgurClient;
  }
}

interface RenderCall {
  readonly effect: string;
  readonly avatars: string[];
  readonly extra: string[];
}

interface ConvertCall {
  readonly input: string;
  readonly output: string;
}

function setup() {
  const imgur = new FakeImgurClient();
  const tempFileStore = new TempFileStore();

  const renderCalls: RenderCall[] = [];
  const convertCalls: ConvertCall[] = [];
  const failures = { render: false, convert: false };

  const fakeEffects = new Map<string, EditEffect>([
    [
      "gay",
      {
        name: "Gay",
        avatarCount: 1,
        variableAvatars: false,
        param: { kind: "none" },
        outputFormat: "image",
        render: async (avatars, extra) => {
          renderCalls.push({ effect: "Gay", avatars, extra });
          if (failures.render) throw new Error("simulated render failure");
          return Buffer.from("fake-png-bytes");
        },
      },
    ],
    [
      "caption",
      {
        name: "Caption",
        avatarCount: 0,
        variableAvatars: false,
        param: { kind: "text" },
        outputFormat: "image",
        render: async () => Buffer.from("fake-png-bytes"),
      },
    ],
    [
      "price",
      {
        name: "Price",
        avatarCount: 1,
        variableAvatars: false,
        param: { kind: "currency" },
        outputFormat: "image",
        render: async () => Buffer.from("fake-png-bytes"),
      },
    ],
    [
      "duo",
      {
        name: "Duo",
        avatarCount: 1,
        variableAvatars: false,
        param: { kind: "names", count: 2 },
        outputFormat: "image",
        render: async () => Buffer.from("fake-png-bytes"),
      },
    ],
    [
      "batslap",
      {
        name: "Batslap",
        avatarCount: 2,
        variableAvatars: false,
        param: { kind: "none" },
        outputFormat: "image",
        render: async (avatars, extra) => {
          renderCalls.push({ effect: "Batslap", avatars, extra });
          return Buffer.from("fake-png-bytes-2");
        },
      },
    ],
    [
      "blink",
      {
        name: "Blink",
        avatarCount: 1,
        variableAvatars: true,
        param: { kind: "number" },
        outputFormat: "gif",
        render: async (avatars, extra) => {
          renderCalls.push({ effect: "Blink", avatars, extra });
          return Buffer.from("fake-gif-bytes");
        },
      },
    ],
  ]);

  async function fakeConvertGif(input: string, output: string): Promise<void> {
    convertCalls.push({ input, output });
    await writeFile(output, "fake-mp4-bytes");
    if (failures.convert) throw new Error("simulated ffmpeg failure");
  }

  const { executor, sender } = makeBot((bot) => [
    new EditCommand(
      bot.sender.asWhatsAppSender(),
      imgur.asImgurClient(),
      tempFileStore,
      fakeEffects,
      fakeConvertGif
    ),
  ]);

  return {
    executor,
    sender,
    imgur,
    tempFileStore,
    renderCalls,
    convertCalls,
    failures,
  };
}

describe("/edit command", () => {
  test("no effect name shows usage", async () => {
    const { executor } = setup();
    const result = await executor.execute(dm(REGULAR_PHONE, "/edit"));
    expect(result).toEqual({
      type: "text",
      content: "Uso: /edit <efecto> @mención1 @mención2... [parámetro]",
    });
  });

  test("unknown effect name is rejected before any network work", async () => {
    const { executor, imgur } = setup();
    const result = await executor.execute(
      dm(REGULAR_PHONE, "/edit nonexistent")
    );
    expect(result).toEqual({
      type: "error",
      userMessage: formatEditUnknownEffect("nonexistent"),
    });
    expect(imgur.uploadedUrls).toEqual([]);
  });

  test("wrong mention count is rejected before any network work", async () => {
    const { executor, imgur } = setup();
    const result = await executor.execute(dm(REGULAR_PHONE, "/edit gay"));
    expect(result).toEqual({
      type: "error",
      userMessage: formatEditWrongAvatarCount("Gay", 1),
    });
    expect(imgur.uploadedUrls).toEqual([]);
  });

  const TARGET = "51911111111";

  test.each([
    {
      name: "no mention for a variable-avatar effect (min-avatar)",
      body: "/edit blink 5",
      mentions: [],
      message: formatEditMinAvatarCount("Blink"),
    },
    {
      name: "missing number",
      body: "/edit blink @51911111111",
      mentions: [TARGET],
      message: formatEditMissingNumber("Blink"),
    },
    {
      name: "missing text",
      body: "/edit caption",
      mentions: [],
      message: formatEditMissingText("Caption"),
    },
    {
      name: "missing currency",
      body: "/edit price @51911111111",
      mentions: [TARGET],
      message: formatEditMissingCurrency("Price"),
    },
    {
      name: "wrong name count",
      body: "/edit duo @51911111111 solo",
      mentions: [TARGET],
      message: formatEditWrongNameCount("Duo", 2),
    },
  ])(
    "$name is rejected with its own message before any network work",
    async ({ body, mentions, message }) => {
      const { executor, imgur } = setup();

      const result = await executor.execute(
        dm(REGULAR_PHONE, body, { mentionedUserIds: mentions })
      );

      expect(result).toEqual({ type: "error", userMessage: message });
      expect(imgur.uploadedUrls).toEqual([]);
    }
  );

  test("an Imgur upload failure surfaces the generic failure message", async () => {
    const { executor, sender, imgur } = setup();
    imgur.failUploads = true;
    sender.picUrls.set(`${TARGET}@c.us`, "https://pps.example/avatar.jpg");

    const result = await executor.execute(
      dm(REGULAR_PHONE, `/edit gay @${TARGET}`, { mentionedUserIds: [TARGET] })
    );

    expect(result).toEqual({
      type: "error",
      userMessage: MESSAGES.errors.editProcessingFailed,
    });
  });

  test("a render that throws surfaces the generic failure and still deletes the uploaded avatar", async () => {
    const { executor, sender, imgur, failures } = setup();
    failures.render = true;
    sender.picUrls.set(`${TARGET}@c.us`, "https://pps.example/avatar.jpg");

    const result = await executor.execute(
      dm(REGULAR_PHONE, `/edit gay @${TARGET}`, { mentionedUserIds: [TARGET] })
    );

    expect(result).toEqual({
      type: "error",
      userMessage: MESSAGES.errors.editProcessingFailed,
    });
    expect(imgur.deletedHashes).toEqual(["hash-1"]);
  });

  test("a failed gif-to-mp4 conversion surfaces the generic failure and removes the raw gif", async () => {
    const { executor, sender, imgur, failures, convertCalls } = setup();
    failures.convert = true;
    sender.picUrls.set(`${TARGET}@c.us`, "https://pps.example/blink.jpg");

    const result = await executor.execute(
      dm(REGULAR_PHONE, `/edit blink @${TARGET} 5`, {
        mentionedUserIds: [TARGET],
      })
    );

    expect(result).toEqual({
      type: "error",
      userMessage: MESSAGES.errors.editProcessingFailed,
    });
    expect(imgur.deletedHashes).toEqual(["hash-1"]);
    expect(existsSync(convertCalls[0]!.input)).toBe(false);
    expect(existsSync(convertCalls[0]!.output)).toBe(false);
  });

  test("returns unavailable when Imgur is not configured", async () => {
    const { executor, imgur } = setup();
    imgur.configured = false;

    const target = "51911111111";
    const result = await executor.execute(
      dm(REGULAR_PHONE, `/edit gay @${target}`, {
        mentionedUserIds: [target],
      })
    );

    expect(result).toEqual({
      type: "error",
      userMessage: MESSAGES.errors.editUnavailable,
    });
  });

  test("a missing profile picture surfaces the generic failure message", async () => {
    const { executor } = setup();
    const target = "51999999999";

    const result = await executor.execute(
      dm(REGULAR_PHONE, `/edit gay @${target}`, {
        mentionedUserIds: [target],
      })
    );

    expect(result).toEqual({
      type: "error",
      userMessage: MESSAGES.errors.editProcessingFailed,
    });
  });

  test("single-avatar effect end-to-end: avatar fetch, Imgur upload, DIG render, media result the reply deletes", async () => {
    const { executor, sender, imgur, tempFileStore, renderCalls } = setup();
    const target = "51911111111";
    sender.picUrls.set(`${target}@c.us`, "https://pps.example/avatar.jpg");

    const result = await executor.execute(
      dm(REGULAR_PHONE, `/edit gay @${target}`, { mentionedUserIds: [target] })
    );

    expect(result).toEqual({
      type: "media",
      filePath: expect.stringMatching(/\.png$/),
      caption: formatEditCaption(false),
      sendVideoAsGif: false,
      deleteAfterSend: true,
    });
    const media = result as { filePath: string };
    expect(await readFile(media.filePath, "utf8")).toBe("fake-png-bytes");
    expect(sender.sentMedia).toEqual([]);

    expect(imgur.uploadedUrls).toEqual(["https://pps.example/avatar.jpg"]);
    expect(imgur.deletedHashes).toEqual(["hash-1"]);
    expect(renderCalls).toEqual([
      { effect: "Gay", avatars: ["https://imgur.example/1"], extra: [] },
    ]);

    await tempFileStore.cleanup(media.filePath);
  });

  test("multi-avatar effect resolves each mention's own avatar, in order", async () => {
    const { executor, sender, imgur, tempFileStore, renderCalls } = setup();
    const p1 = "51911111111";
    const p2 = "51933333333";
    sender.picUrls.set(`${p1}@c.us`, "https://pps.example/1.jpg");
    sender.picUrls.set(`${p2}@c.us`, "https://pps.example/2.jpg");

    const result = await executor.execute(
      dm(REGULAR_PHONE, `/edit batslap @${p1} @${p2}`, {
        mentionedUserIds: [p1, p2],
      })
    );

    expect(result?.type).toBe("media");
    expect(imgur.uploadedUrls).toEqual([
      "https://pps.example/1.jpg",
      "https://pps.example/2.jpg",
    ]);
    expect(renderCalls).toEqual([
      {
        effect: "Batslap",
        avatars: ["https://imgur.example/1", "https://imgur.example/2"],
        extra: [],
      },
    ]);

    await tempFileStore.cleanup((result as { filePath: string }).filePath);
  });

  test("mentioning the same user twice only fetches/uploads their avatar once", async () => {
    const { executor, sender, imgur, tempFileStore } = setup();
    const p1 = "51911111111";
    sender.picUrls.set(`${p1}@c.us`, "https://pps.example/self.jpg");

    const result = await executor.execute(
      dm(REGULAR_PHONE, `/edit batslap @${p1} @${p1}`, {
        mentionedUserIds: [p1, p1],
      })
    );

    expect(result?.type).toBe("media");
    expect(imgur.uploadedUrls).toEqual(["https://pps.example/self.jpg"]);

    await tempFileStore.cleanup((result as { filePath: string }).filePath);
  });

  test("a GIF effect renders through DIG then converts to mp4 with sendVideoAsGif", async () => {
    const { executor, sender, tempFileStore, renderCalls, convertCalls } =
      setup();
    const target = "51911111111";
    sender.picUrls.set(`${target}@c.us`, "https://pps.example/blink.jpg");

    const result = await executor.execute(
      dm(REGULAR_PHONE, `/edit blink @${target} 5`, {
        mentionedUserIds: [target],
      })
    );

    expect(result).toEqual({
      type: "media",
      filePath: expect.stringMatching(/\.mp4$/),
      caption: formatEditCaption(true),
      sendVideoAsGif: true,
      deleteAfterSend: true,
    });
    const media = result as { filePath: string };
    expect(await readFile(media.filePath, "utf8")).toBe("fake-mp4-bytes");

    expect(renderCalls).toEqual([
      {
        effect: "Blink",
        avatars: ["https://imgur.example/1"],
        extra: ["5"],
      },
    ]);
    expect(convertCalls).toHaveLength(1);
    expect(convertCalls[0]!.input.endsWith(".gif")).toBe(true);
    expect(convertCalls[0]!.output).toBe(media.filePath);
    expect(existsSync(convertCalls[0]!.input)).toBe(false);

    await tempFileStore.cleanup(media.filePath);
  });
});

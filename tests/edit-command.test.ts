// Exercises the /edit command: the DIG effect registry (all 29 ported
// effects, including the Podium avatar/name-count fix), resolveEditArgs'
// pure validation logic, and EditCommand's pipeline end-to-end against fakes
// for the profile-picture fetch, the Imgur client, and the DIG render call
// (one single-avatar effect, one multi-avatar effect, and one of the two GIF
// effects, per the task's representative-coverage guidance).

import { describe, expect, test, vi } from "vitest";
import { UserRepository } from "../src/infrastructure/database/repositories/user-repository";
import { GroupRepository } from "../src/infrastructure/database/repositories/group-repository";
import { PermissionChecker } from "../src/application/services/permission-checker";
import { UserService } from "../src/application/services/user-service";
import { CommandExecutor } from "../src/application/services/command-executor";
import { EditCommand } from "../src/application/commands/edit-command";
import { EDIT_EFFECTS } from "../src/infrastructure/external/dig-effects";
import type { EditEffect } from "../src/infrastructure/external/dig-effects";
import { resolveEditArgs } from "../src/lib/utils/edit-args";
import { TempFileStore } from "../src/infrastructure/storage/temp-file-store";
import type { WhatsAppSender } from "../src/infrastructure/whatsapp/sender";
import type {
  ImgurClient,
  ImgurUpload,
} from "../src/infrastructure/external/imgur-client";
import {
  MESSAGES,
  formatEditUnknownEffect,
  formatEditWrongAvatarCount,
  formatEditCaption,
} from "../src/i18n/es";
import { FakePostgres, makeMessage } from "./fixtures";

const OWNER_PHONE = "51900000000";
const REGULAR_PHONE = "51922222222";

describe("EDIT_EFFECTS registry", () => {
  const expectedNames = [
    "Gay",
    "Greyscale",
    "Invert",
    "Blink",
    "Triggered",
    "Ad",
    "Batslap",
    "Beautiful",
    "Bed",
    "Bobross",
    "Clown",
    "ConfusedStonk",
    "Deepfry",
    "Delete",
    "DoubleStonk",
    "Facepalm",
    "Hitler",
    "Jail",
    "Kiss",
    "LisaPresentation",
    "Mikkelsen",
    "NotStonk",
    "Podium",
    "Poutine",
    "Rip",
    "Snyder",
    "Stonk",
    "Trash",
    "Wanted",
  ];

  test("contains exactly the 29 ported DIG effects", () => {
    const actualNames = [...EDIT_EFFECTS.values()].map((e) => e.name).sort();
    expect(actualNames).toEqual([...expectedNames].sort());
  });

  test("is keyed by lowercase name for case-insensitive lookup", () => {
    for (const [key, effect] of EDIT_EFFECTS) {
      expect(key).toBe(effect.name.toLowerCase());
    }
  });

  test("Podium requires exactly 3 avatars and exactly 3 names (legacy bug fixed)", () => {
    const podium = EDIT_EFFECTS.get("podium")!;
    expect(podium.avatarCount).toBe(3);
    expect(podium.variableAvatars).toBe(false);
    expect(podium.param).toEqual({ kind: "names", count: 3 });
  });

  test("only Blink and Triggered produce a gif", () => {
    const gifEffects = [...EDIT_EFFECTS.values()]
      .filter((e) => e.outputFormat === "gif")
      .map((e) => e.name)
      .sort();
    expect(gifEffects).toEqual(["Blink", "Triggered"]);
  });
});

describe("resolveEditArgs", () => {
  const gay: EditEffect = {
    name: "Gay",
    avatarCount: 1,
    variableAvatars: false,
    param: { kind: "none" },
    outputFormat: "image",
    render: async () => Buffer.from(""),
  };

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

class FakeSender {
  readonly picUrls = new Map<string, string>();

  async getProfilePicUrl(chatId: string): Promise<string | null> {
    return this.picUrls.get(chatId) ?? null;
  }

  asWhatsAppSender(): WhatsAppSender {
    return this as unknown as WhatsAppSender;
  }
}

class FakeImgurClient {
  private counter = 0;
  configured = true;
  readonly uploadedUrls: string[] = [];
  readonly deletedHashes: string[] = [];

  isConfigured(): boolean {
    return this.configured;
  }

  async upload(imageUrl: string): Promise<ImgurUpload | null> {
    this.uploadedUrls.push(imageUrl);
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
  const postgres = new FakePostgres().asPostgresClient();

  const userRepo = new UserRepository(postgres);
  const groupRepo = new GroupRepository(postgres);
  const permissionChecker = new PermissionChecker(OWNER_PHONE);
  const userService = new UserService(userRepo, OWNER_PHONE);
  const executor = new CommandExecutor(
    userService,
    permissionChecker,
    groupRepo,
    "/"
  );

  const sender = new FakeSender();
  const imgur = new FakeImgurClient();
  const tempFileStore = new TempFileStore();

  const renderCalls: RenderCall[] = [];
  const convertCalls: ConvertCall[] = [];

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
          return Buffer.from("fake-png-bytes");
        },
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
  }

  const editCommand = new EditCommand(
    sender.asWhatsAppSender(),
    imgur.asImgurClient(),
    tempFileStore,
    fakeEffects,
    fakeConvertGif
  );
  executor.registerCommand(editCommand);

  return {
    executor,
    sender,
    imgur,
    tempFileStore,
    renderCalls,
    convertCalls,
  };
}

describe("/edit command", () => {
  test("no effect name shows usage", async () => {
    const { executor } = setup();
    const result = await executor.execute(
      makeMessage({
        senderId: REGULAR_PHONE,
        chatId: `${REGULAR_PHONE}@c.us`,
        isGroup: false,
        body: "/edit",
      })
    );
    expect(result?.type).toBe("text");
  });

  test("unknown effect name is rejected before any network work", async () => {
    const { executor, imgur } = setup();
    const result = await executor.execute(
      makeMessage({
        senderId: REGULAR_PHONE,
        chatId: `${REGULAR_PHONE}@c.us`,
        isGroup: false,
        body: "/edit nonexistent",
      })
    );
    expect(result).toEqual({
      type: "error",
      userMessage: formatEditUnknownEffect("nonexistent"),
    });
    expect(imgur.uploadedUrls).toEqual([]);
  });

  test("wrong mention count is rejected before any network work", async () => {
    const { executor, imgur } = setup();
    const result = await executor.execute(
      makeMessage({
        senderId: REGULAR_PHONE,
        chatId: `${REGULAR_PHONE}@c.us`,
        isGroup: false,
        body: "/edit gay",
      })
    );
    expect(result).toEqual({
      type: "error",
      userMessage: formatEditWrongAvatarCount("Gay", 1),
    });
    expect(imgur.uploadedUrls).toEqual([]);
  });

  test("returns unavailable when Imgur is not configured", async () => {
    const { executor, imgur } = setup();
    imgur.configured = false;

    const target = "51911111111";
    const result = await executor.execute(
      makeMessage({
        senderId: REGULAR_PHONE,
        chatId: `${REGULAR_PHONE}@c.us`,
        isGroup: false,
        body: `/edit gay @${target}`,
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
      makeMessage({
        senderId: REGULAR_PHONE,
        chatId: `${REGULAR_PHONE}@c.us`,
        isGroup: false,
        body: `/edit gay @${target}`,
        mentionedUserIds: [target],
      })
    );

    expect(result).toEqual({
      type: "error",
      userMessage: MESSAGES.errors.editProcessingFailed,
    });
  });

  test("single-avatar effect end-to-end: avatar fetch, Imgur upload, DIG render, media result", async () => {
    vi.useFakeTimers();
    try {
      const { executor, sender, imgur, tempFileStore, renderCalls } = setup();
      const target = "51911111111";
      sender.picUrls.set(`${target}@c.us`, "https://pps.example/avatar.jpg");

      const result = await executor.execute(
        makeMessage({
          senderId: REGULAR_PHONE,
          chatId: `${REGULAR_PHONE}@c.us`,
          isGroup: false,
          body: `/edit gay @${target}`,
          mentionedUserIds: [target],
        })
      );

      expect(result?.type).toBe("media");
      const media = result as {
        filePath: string;
        caption?: string;
        sendVideoAsGif?: boolean;
      };
      expect(media.sendVideoAsGif).toBeFalsy();
      expect(media.caption).toBe(formatEditCaption(false));
      expect(media.filePath.endsWith(".png")).toBe(true);

      expect(imgur.uploadedUrls).toEqual(["https://pps.example/avatar.jpg"]);
      expect(imgur.deletedHashes).toEqual(["hash-1"]);
      expect(renderCalls).toEqual([
        { effect: "Gay", avatars: ["https://imgur.example/1"], extra: [] },
      ]);

      await tempFileStore.cleanup(media.filePath);
    } finally {
      vi.useRealTimers();
    }
  });

  test("multi-avatar effect resolves each mention's own avatar, in order", async () => {
    vi.useFakeTimers();
    try {
      const { executor, sender, imgur, tempFileStore, renderCalls } = setup();
      const p1 = "51911111111";
      const p2 = "51933333333";
      sender.picUrls.set(`${p1}@c.us`, "https://pps.example/1.jpg");
      sender.picUrls.set(`${p2}@c.us`, "https://pps.example/2.jpg");

      const result = await executor.execute(
        makeMessage({
          senderId: REGULAR_PHONE,
          chatId: `${REGULAR_PHONE}@c.us`,
          isGroup: false,
          body: `/edit batslap @${p1} @${p2}`,
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

      const media = result as { filePath: string };
      await tempFileStore.cleanup(media.filePath);
    } finally {
      vi.useRealTimers();
    }
  });

  test("mentioning the same user twice only fetches/uploads their avatar once", async () => {
    vi.useFakeTimers();
    try {
      const { executor, sender, imgur, tempFileStore } = setup();
      const p1 = "51911111111";
      sender.picUrls.set(`${p1}@c.us`, "https://pps.example/self.jpg");

      const result = await executor.execute(
        makeMessage({
          senderId: REGULAR_PHONE,
          chatId: `${REGULAR_PHONE}@c.us`,
          isGroup: false,
          body: `/edit batslap @${p1} @${p1}`,
          mentionedUserIds: [p1, p1],
        })
      );

      expect(result?.type).toBe("media");
      expect(imgur.uploadedUrls).toEqual(["https://pps.example/self.jpg"]);

      const media = result as { filePath: string };
      await tempFileStore.cleanup(media.filePath);
    } finally {
      vi.useRealTimers();
    }
  });

  test("a GIF effect renders through DIG then converts to mp4 with sendVideoAsGif", async () => {
    vi.useFakeTimers();
    try {
      const { executor, sender, tempFileStore, renderCalls, convertCalls } =
        setup();
      const target = "51911111111";
      sender.picUrls.set(`${target}@c.us`, "https://pps.example/blink.jpg");

      const result = await executor.execute(
        makeMessage({
          senderId: REGULAR_PHONE,
          chatId: `${REGULAR_PHONE}@c.us`,
          isGroup: false,
          body: `/edit blink @${target} 5`,
          mentionedUserIds: [target],
        })
      );

      expect(result?.type).toBe("media");
      const media = result as {
        filePath: string;
        caption?: string;
        sendVideoAsGif?: boolean;
      };
      expect(media.sendVideoAsGif).toBe(true);
      expect(media.caption).toBe(formatEditCaption(true));
      expect(media.filePath.endsWith(".mp4")).toBe(true);

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

      await tempFileStore.cleanup(media.filePath);
    } finally {
      vi.useRealTimers();
    }
  });
});

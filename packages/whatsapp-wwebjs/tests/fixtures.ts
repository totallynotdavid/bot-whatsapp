import { EventEmitter } from "node:events";
import type { Client } from "whatsapp-web.js";

interface FakeGroupParticipant {
  readonly userId: string;
  readonly isAdmin: boolean;
}

interface FakeMediaRecord {
  readonly mimeType: string;
  readonly content: string;
}

interface FakeMessageInput {
  readonly chatId: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly body: string;
  readonly isGroup: boolean;
  readonly mentionedUserIds?: string[];
}

// Fakes the whatsapp-web.js Client at the boundary the adapter calls: no
// network, no puppeteer, no real WhatsApp connection.
export class FakeWwebjsClient extends EventEmitter {
  readonly events: string[] = [];
  private readonly groups = new Map<string, FakeGroupParticipant[]>();
  private readonly media = new Map<string, FakeMediaRecord>();
  private readonly profilePics = new Map<string, string>();
  private messageCounter = 0;

  setGroup(chatId: string, participants: FakeGroupParticipant[]): void {
    this.groups.set(chatId, participants);
  }

  setMedia(messageId: string, media: FakeMediaRecord): void {
    this.media.set(messageId, media);
  }

  setProfilePic(userId: string, url: string): void {
    this.profilePics.set(userId, url);
  }

  async deliverMessage(input: FakeMessageInput): Promise<void> {
    const id = `msg-${++this.messageCounter}`;
    const raw = {
      id: { _serialized: id },
      body: input.body,
      timestamp: 1_700_000_000,
      hasMedia: false,
      hasQuotedMsg: false,
      type: "chat",
      getContact: async () => ({
        number: input.senderId,
        pushname: input.senderName,
        name: undefined,
      }),
      getChat: async () => ({
        id: { _serialized: input.chatId },
        isGroup: input.isGroup,
        name: input.isGroup ? "Group" : undefined,
      }),
      getMentions: async () =>
        (input.mentionedUserIds ?? []).map((userId) => ({
          id: { _serialized: `${userId}@c.us` },
        })),
    };
    // emit() does not await async listeners; the listeners registered by the
    // receiver are invoked and awaited directly here instead.
    await Promise.all(
      this.listeners("message").map((listener) => listener(raw))
    );
  }

  // -- whatsapp-web.js Client surface used by the adapter --

  async sendMessage(
    chatId: string,
    content: unknown,
    options: {
      caption?: string;
      sendMediaAsSticker?: boolean;
    } = {}
  ): Promise<void> {
    if (typeof content === "string") {
      this.events.push(`text:${chatId}:${content}`);
      return;
    }
    if (options.sendMediaAsSticker) {
      this.events.push(`sticker:${chatId}`);
      return;
    }
    this.events.push(`media:${chatId}:${options.caption ?? ""}`);
  }

  async getMessageById(messageId: string) {
    const media = this.media.get(messageId);
    return {
      hasMedia: media !== undefined,
      rawData: media && {
        size: media.content.length,
        mimetype: media.mimeType,
      },
      downloadMedia: async () =>
        media && {
          data: Buffer.from(media.content).toString("base64"),
          mimetype: media.mimeType,
        },
      react: async () => {},
    };
  }

  async getChatById(chatId: string) {
    const participants = this.groups.get(chatId);
    if (!participants) {
      return { isGroup: false };
    }
    return {
      isGroup: true,
      participants: participants.map((p) => ({
        id: { _serialized: `${p.userId}@c.us` },
        isAdmin: p.isAdmin,
        isSuperAdmin: false,
      })),
      removeParticipants: async (ids: string[]) => {
        for (const id of ids) {
          this.events.push(`remove:${chatId}:${id.replace("@c.us", "")}`);
        }
      },
    };
  }

  async getProfilePicUrl(chatId: string): Promise<string | undefined> {
    return this.profilePics.get(chatId.replace("@c.us", ""));
  }

  asClient(): Client {
    return this as unknown as Client;
  }
}

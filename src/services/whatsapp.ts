import {
  Client,
  LocalAuth,
  MessageMedia,
  type Message as WWebJSMessage,
  type GroupChat,
} from "whatsapp-web.js";
import { logger } from "../utils/logger";
import { Rank } from "../types/permissions";
import * as Models from "../types/models";
import type { CommandResult } from "../types/handler";
import { FileManager } from "../utils/file-manager";

type MessageCallback = (msg: Models.Message) => Promise<CommandResult | null>;

export class WhatsAppService {
  private client: Client;
  private messageHandler?: MessageCallback;

  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: process.env.CHROME_PATH || undefined,
      },
    });
    this.setupEvents();
  }

  async start(): Promise<void> {
    await this.client.initialize();
  }

  onMessage(handler: MessageCallback) {
    this.messageHandler = handler;
  }

  // Media handling

  /**
   * Downloads media from a message and saves it to disk
   * Returns the absolute file path
   */
  async downloadMedia(messageId: string): Promise<string> {
    try {
      const msg = await this.client.getMessageById(messageId);

      if (!msg) {
        throw new Error("Message not found in cache");
      }

      if (!msg.hasMedia) {
        throw new Error("Message does not contain media");
      }

      const media = await msg.downloadMedia();
      if (!media) {
        throw new Error("Failed to download media buffer");
      }

      const buffer = Buffer.from(media.data, "base64");
      const path = await FileManager.saveMedia(buffer, media.mimetype);

      return path;
    } catch (error) {
      logger.error("Failed to download media", error);
      throw error;
    }
  }

  async sendFile(
    chatId: string,
    filePath: string,
    caption?: string,
    replyToId?: string
  ): Promise<void> {
    try {
      const media = MessageMedia.fromFilePath(filePath);
      const options: any = { caption };

      if (replyToId) {
        options.quotedMessageId = replyToId;
      }

      await this.client.sendMessage(chatId, media, options);
    } catch (error) {
      logger.error("Failed to send file", error);
      throw error;
    }
  }

  // Admin tools

  async kickUser(chatId: string, userId: string): Promise<boolean> {
    try {
      const chat = await this.client.getChatById(chatId);
      if (chat.isGroup) {
        await (chat as GroupChat).removeParticipants([userId]);
        return true;
      }
      return false;
    } catch (e) {
      logger.error("Failed to kick user", e);
      return false;
    }
  }

  async promoteUser(chatId: string, userId: string): Promise<boolean> {
    try {
      const chat = await this.client.getChatById(chatId);
      if (chat.isGroup) {
        await (chat as GroupChat).promoteParticipants([userId]);
        return true;
      }
      return false;
    } catch (e) {
      logger.error("Failed to promote user", e);
      return false;
    }
  }

  async demoteUser(chatId: string, userId: string): Promise<boolean> {
    try {
      const chat = await this.client.getChatById(chatId);
      if (chat.isGroup) {
        await (chat as GroupChat).demoteParticipants([userId]);
        return true;
      }
      return false;
    } catch (e) {
      logger.error("Failed to demote user", e);
      return false;
    }
  }

  // Internal

  private setupEvents() {
    this.client.on("qr", (qr) => logger.info("QR Code generated."));
    this.client.on("ready", () => logger.info("WhatsApp Client Ready"));

    this.client.on("message", async (rawMsg) => {
      if (!this.messageHandler) return;
      try {
        const domainMsg = await this.normalizeMessage(rawMsg);
        const result = await this.messageHandler(domainMsg);
        if (result) await this.sendResult(rawMsg, result);
      } catch (err) {
        logger.error("Adapter Error", err);
      }
    });
  }

  private async normalizeMessage(raw: WWebJSMessage): Promise<Models.Message> {
    const contact = await raw.getContact();
    const chat = await raw.getChat();
    const mentions = await raw.getMentions();
    let quotedParticipant: string | undefined;

    if (raw.hasQuotedMsg) {
      const quoted = await raw.getQuotedMessage();
      quotedParticipant = quoted.author || quoted.from;
    }

    const user: Models.User = {
      id: contact.id._serialized,
      phoneNumber: contact.number,
      name: contact.pushname || contact.name || "Unknown",
      rank: Rank.REGULAR,
    };

    return {
      id: raw.id._serialized,
      remoteId: raw.id.id,
      body: raw.body,
      timestamp: raw.timestamp,
      hasMedia: raw.hasMedia,
      mentions: mentions.map((m) => m.id._serialized),
      quotedParticipant,
      from: user,
      chat: {
        id: chat.id._serialized,
        name: chat.name,
        isGroup: chat.isGroup,
        isActive: true,
      },
    };
  }

  private async sendResult(
    originalMsg: WWebJSMessage,
    result: CommandResult
  ): Promise<void> {
    switch (result.type) {
      case "text":
        await originalMsg.reply(result.content);
        break;
      case "reply":
        await originalMsg.reply(result.content);
        break;
      case "media":
        const media = MessageMedia.fromFilePath(result.path);
        await originalMsg.reply(media, undefined, {
          caption: result.caption,
        } as any);
        break;
      case "error":
        await originalMsg.reply(`❌ ${result.message}`);
        break;
    }
  }
}

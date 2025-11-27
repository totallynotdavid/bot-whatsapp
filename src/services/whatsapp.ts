import { Client, LocalAuth, MessageMedia, type Message } from "whatsapp-web.js";
import { logger } from "../utils/logger.js";
import { Rank } from "../types/permissions.js";
import * as Models from "../types/models.js";
import type { CommandResult } from "../types/handler.js";

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

  async kickUser(chatId: string, userId: string): Promise<boolean> {
    try {
      const chat = await this.client.getChatById(chatId);
      if (chat.isGroup) {
        await chat.removeParticipants([userId]);
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
        await chat.promoteParticipants([userId]);
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
        await chat.demoteParticipants([userId]);
        return true;
      }
      return false;
    } catch (e) {
      logger.error("Failed to demote user", e);
      return false;
    }
  }

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

  private async normalizeMessage(raw: Message): Promise<Models.Message> {
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
    originalMsg: Message,
    result: CommandResult
  ): Promise<void> {
    switch (result.type) {
      case "text":
        await originalMsg.reply(result.content);
        break;
      case "reply": // Specific reply type if needed
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

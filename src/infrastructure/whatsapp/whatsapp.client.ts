import {
  Client,
  type GroupChat,
  LocalAuth,
  MessageMedia,
  type Message as WWebJSMessage,
} from "whatsapp-web.js";
import { logger } from "../../shared/logger";

export class WhatsAppClient {
  private client: Client;

  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: process.env.CHROME_PATH,
      },
    });

    this.setupEvents();
  }

  async initialize(): Promise<void> {
    await this.client.initialize();

    return new Promise((resolve) => {
      this.client.once("ready", () => {
        resolve();
      });
    });
  }

  onMessage(handler: (msg: WWebJSMessage) => Promise<void>): void {
    this.client.on("message", handler);
  }

  async sendReaction(messageId: string, emoji: string): Promise<void> {
    try {
      const msg = await this.client.getMessageById(messageId);
      await msg.react(emoji);
    } catch (err) {
      logger.error("Failed to send reaction", err);
    }
  }

  async sendText(
    chatId: string,
    text: string,
    replyToId?: string
  ): Promise<void> {
    const options = replyToId ? { quotedMessageId: replyToId } : {};
    await this.client.sendMessage(chatId, text, options);
  }

  async sendMedia(
    chatId: string,
    path: string,
    caption?: string,
    replyToId?: string
  ): Promise<void> {
    const media = MessageMedia.fromFilePath(path);
    const options: any = { caption };

    if (replyToId) {
      options.quotedMessageId = replyToId;
    }

    await this.client.sendMessage(chatId, media, options);
  }

  async sendSticker(
    chatId: string,
    path: string,
    replyToId?: string
  ): Promise<void> {
    const media = MessageMedia.fromFilePath(path);
    const options: any = { sendMediaAsSticker: true };

    if (replyToId) {
      options.quotedMessageId = replyToId;
    }

    await this.client.sendMessage(chatId, media, options);
  }

  async downloadMedia(messageId: string): Promise<Buffer> {
    const msg = await this.client.getMessageById(messageId);

    if (!msg.hasMedia) {
      throw new Error("Message has no media");
    }

    const media = await msg.downloadMedia();
    return Buffer.from(media.data, "base64");
  }

  async getMediaInfo(
    messageId: string
  ): Promise<{ size: number; mimeType: string } | null> {
    try {
      const msg = await this.client.getMessageById(messageId);

      if (!msg.hasMedia) return null;

      return {
        size: msg.body.length, // Approximation
        mimeType: msg.type,
      };
    } catch {
      return null;
    }
  }

  async removeParticipant(chatId: string, userId: string): Promise<boolean> {
    try {
      const chat = await this.client.getChatById(chatId);
      if (chat.isGroup) {
        await (chat as GroupChat).removeParticipants([userId]);
        return true;
      }
      return false;
    } catch (err) {
      logger.error("Failed to remove participant", err);
      return false;
    }
  }

  async promoteParticipant(chatId: string, userId: string): Promise<boolean> {
    try {
      const chat = await this.client.getChatById(chatId);
      if (chat.isGroup) {
        await (chat as GroupChat).promoteParticipants([userId]);
        return true;
      }
      return false;
    } catch (err) {
      logger.error("Failed to promote participant", err);
      return false;
    }
  }

  private setupEvents(): void {
    this.client.on("qr", () => {
      logger.info("QR code generated. Scan with WhatsApp");
    });

    this.client.on("ready", () => {
      logger.info("WhatsApp client ready");
    });

    this.client.on("disconnected", (reason) => {
      logger.error("WhatsApp client disconnected", { reason });
    });
  }
}

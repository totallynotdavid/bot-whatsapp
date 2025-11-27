import { Client, LocalAuth, MessageMedia, type Message } from "whatsapp-web.js";
import { logger } from "../utils/logger";
import { Rank } from "../types/permissions";

import * as Models from "../types/models";
import type { CommandResult } from "../types/handler";

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
      },
    });

    this.setupEvents();
  }

  /**
   * Initialize the client connection
   */
  async start(): Promise<void> {
    logger.info("Initializing WhatsApp Client...");
    await this.client.initialize();
  }

  /**
   * Register the function that will process incoming messages (the dispatcher)
   */
  onMessage(handler: MessageCallback) {
    this.messageHandler = handler;
  }

  private setupEvents() {
    this.client.on("qr", (qr) => {
      logger.info("QR Code generated. Scan to login.");
      import("qrcode-terminal").then((q) => q.generate(qr, { small: true }));
    });

    this.client.on("ready", () => logger.info("WhatsApp Client is Ready! 🚀"));

    this.client.on("message", async (rawMsg) => {
      if (!this.messageHandler) return;

      try {
        // Adapter: Convert raw -> domain model
        const domainMsg = await this.normalizeMessage(rawMsg);

        // Pipeline: Run the dispatcher
        const result = await this.messageHandler(domainMsg);

        // Adapter: Convert result -> raw output
        if (result) {
          await this.sendResult(rawMsg, result);
        }
      } catch (err) {
        logger.error("Error in WhatsApp Adapter", err);
      }
    });
  }

  /**
   * Input: Library message
   * Output: Domain model
   */
  private async normalizeMessage(raw: Message): Promise<Models.Message> {
    const contact = await raw.getContact();
    const chat = await raw.getChat();

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
      from: user,
      chat: {
        id: chat.id._serialized,
        name: chat.name,
        isGroup: chat.isGroup,
        isActive: true,
      },
    };
  }

  /**
   * Adapter: Executes the result on the actual WhatsApp client
   */
  private async sendResult(
    originalMsg: Message,
    result: CommandResult
  ): Promise<void> {
    switch (result.type) {
      case "text":
        await originalMsg.reply(result.content);
        break;

      case "media":
        const media = MessageMedia.fromFilePath(result.path);
        await originalMsg.reply(media, undefined, {
          caption: result.caption,
        });
        break;

      case "error":
        await originalMsg.reply(`❌ ${result.message}`);
        break;

      case "no-op":
        break;
    }
  }
}

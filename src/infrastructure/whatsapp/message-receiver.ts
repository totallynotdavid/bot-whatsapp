import type { Client, Message as WWebJSMessage } from "whatsapp-web.js";
import type { Message } from "../../domain/models/message.model";
import type { Chat } from "../../domain/models/chat.model";
import type { User } from "../../domain/models/user.model";
import { PhoneNumber } from "../../domain/value-objects/phone-number.vo";
import { Rank } from "../../domain/value-objects/rank.vo";
import { logger } from "../monitoring/logger";

export class MessageReceiver {
  constructor(private readonly client: Client) {}

  async initialize(): Promise<void> {
    await this.client.initialize();

    return new Promise((resolve) => {
      this.client.once("ready", () => {
        logger.info("MessageReceiver ready");
        resolve();
      });
    });
  }

  onMessage(handler: (message: Message) => Promise<void>): void {
    this.client.on("message", async (rawMessage) => {
      try {
        const domainMessage = await this.convertToDomainMessage(rawMessage);
        await handler(domainMessage);
      } catch (error) {
        logger.error("Failed to process incoming message", error, {
          messageId: rawMessage.id._serialized,
        });
      }
    });
  }

  private async convertToDomainMessage(raw: WWebJSMessage): Promise<Message> {
    const [contact, chat, mentions] = await Promise.all([
      raw.getContact(),
      raw.getChat(),
      raw.getMentions(),
    ]);

    let quotedUserId: string | undefined;
    let quotedMessageId: string | undefined;

    if (raw.hasQuotedMsg) {
      try {
        const quoted = await raw.getQuotedMessage();
        quotedUserId = quoted.author || quoted.from;
        quotedMessageId = quoted.id._serialized;
      } catch {
        // Quoted message not accessible
      }
    }

    const phoneNumber = PhoneNumber.create(contact.number);

    const user: User = {
      phoneNumber,
      name: contact.pushname || contact.name || "Usuario",
      rank: Rank.REGULAR,
    };

    const domainChat: Chat = {
      id: chat.id._serialized,
      name: chat.name,
      isGroup: chat.isGroup,
    };

    const mediaType = this.extractMediaType(raw);

    return {
      id: raw.id._serialized,
      body: raw.body,
      timestamp: new Date(raw.timestamp * 1000),
      from: user,
      chat: domainChat,
      hasMedia: raw.hasMedia,
      mediaType,
      mentions: mentions.map((m) => m.id._serialized),
      quotedUserId,
      quotedMessageId,
    };
  }

  private extractMediaType(message: WWebJSMessage): Message["mediaType"] {
    if (!message.hasMedia) return undefined;

    const type = message.type;
    if (type === "image") return "image";
    if (type === "video") return "video";
    if (type === "audio" || type === "ptt") return "audio";
    if (type === "document") return "document";

    return undefined;
  }
}

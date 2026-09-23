import type { Client, Message as WWebJSMessage } from "whatsapp-web.js";
import type { Message, MediaType } from "../../domain/message";
import { normalizePhoneNumber } from "../../domain/message";
import { log } from "../../lib/logging/logger";

export class WhatsAppReceiver {
  constructor(private readonly client: Client) {}

  onMessage(handler: (message: Message) => Promise<void>): void {
    this.client.on("message", async (rawMessage) => {
      try {
        const domainMessage = await this.convertToDomainMessage(rawMessage);
        await handler(domainMessage);
      } catch (error) {
        log("error", "Failed to process incoming message", {
          messageId: rawMessage.id._serialized,
          error: error instanceof Error ? error.message : String(error),
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
        quotedUserId = normalizePhoneNumber(quoted.author || quoted.from);
        quotedMessageId = quoted.id._serialized;
      } catch {
        // Quoted message not accessible
      }
    }

    const senderId = normalizePhoneNumber(contact.number);
    const mediaType = this.extractMediaType(raw);

    return {
      id: raw.id._serialized,
      chatId: chat.id._serialized,
      senderId,
      senderName: contact.pushname || contact.name || "Usuario",
      body: raw.body,
      timestamp: new Date(raw.timestamp * 1000),
      isGroup: chat.isGroup,
      hasMedia: raw.hasMedia,
      mediaType,
      mentionedUserIds: mentions.map((m) =>
        normalizePhoneNumber(m.id._serialized)
      ),
      quotedMessageId,
      quotedUserId,
    };
  }

  private extractMediaType(message: WWebJSMessage): MediaType | undefined {
    if (!message.hasMedia) return undefined;

    const messageType = message.type;
    if (messageType === "image") return "image";
    if (messageType === "video") return "video";
    if (messageType === "audio" || messageType === "ptt") return "audio";
    if (messageType === "document") return "document";

    return undefined;
  }
}

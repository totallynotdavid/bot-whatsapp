import type { Message as WWebJSMessage } from "whatsapp-web.js";
import type { Message } from "../../domain/entities/message";
import type { Chat } from "../../domain/entities/chat";
import type { IUserRepository } from "../../domain/repositories/user.repository.interface";
import { PhoneNumber } from "../../domain/value-objects/phone-number";
import type { WhatsAppClient } from "./whatsapp.client";
import type { CommandResult } from "../../application/dto/command-result.dto";
import { logger } from "../../shared/logger";

export class WhatsAppAdapter {
  constructor(
    private client: WhatsAppClient,
    private userRepository: IUserRepository
  ) {}

  async start(
    messageHandler: (msg: Message) => Promise<CommandResult | null>
  ): Promise<void> {
    await this.client.initialize();

    this.client.onMessage(async (rawMsg) => {
      try {
        await this.client.sendReaction(rawMsg.id._serialized, "⏳");

        const domainMsg = await this.toDomainMessage(rawMsg);
        const result = await messageHandler(domainMsg);

        // Remove processing reaction
        await this.client.sendReaction(rawMsg.id._serialized, "");

        if (result) {
          await this.sendResult(rawMsg.id._serialized, rawMsg.from, result);
        }
      } catch (err) {
        logger.error("Message handling failed", err);
        await this.client.sendReaction(rawMsg.id._serialized, "❌");
      }
    });
  }

  private async toDomainMessage(raw: WWebJSMessage): Promise<Message> {
    const contact = await raw.getContact();
    const chat = await raw.getChat();
    const mentions = await raw.getMentions();

    let quotedUserId: string | undefined;
    if (raw.hasQuotedMsg) {
      const quoted = await raw.getQuotedMessage();
      quotedUserId = quoted.author || quoted.from;
    }

    const phone = PhoneNumber.create(contact.number);
    const user = await this.userRepository.getByPhone(phone);

    const domainChat: Chat = {
      id: chat.id._serialized,
      name: chat.name,
      isGroup: chat.isGroup,
    };

    const mediaType = this.getMediaType(raw);

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
    };
  }

  private getMediaType(msg: WWebJSMessage): Message["mediaType"] {
    if (!msg.hasMedia) return undefined;

    const type = msg.type;
    if (type === "image") return "image";
    if (type === "video") return "video";
    if (type === "audio" || type === "ptt") return "audio";
    if (type === "document") return "document";

    return undefined;
  }

  private async sendResult(
    messageId: string,
    chatId: string,
    result: CommandResult
  ): Promise<void> {
    switch (result.type) {
      case "text":
        await this.client.sendText(chatId, result.content, messageId);
        break;

      case "media":
        await this.client.sendMedia(
          chatId,
          result.path,
          result.caption,
          messageId
        );
        break;

      case "error":
        await this.client.sendText(chatId, `❌ ${result.message}`, messageId);
        break;

      case "no-op":
        // Do nothing
        break;
    }
  }
}

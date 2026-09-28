import type { WAMessage } from "@whiskeysockets/baileys";
import type { IncomingMessage } from "@bot-whatsapp/whatsapp";
import {
  extractBody,
  extractContextInfo,
  extractMediaType,
  toDate,
} from "./message-content";
import { normalizePhoneNumber, parseCommand } from "./message-mapping";
import type { MessageStore } from "./message-store";
import type { BaileysSocket, MessagesUpsertEvent } from "./socket-types";

export class BaileysReceiver {
  private listener?: (event: MessagesUpsertEvent) => Promise<void>;
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly socket: BaileysSocket,
    private readonly commandPrefix: string,
    private readonly store: MessageStore
  ) {}

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.listener = async ({ messages }) => {
      const handled: Promise<void>[] = [];
      for (const raw of messages) {
        this.store.record(raw);
        // Own outgoing messages come back through the same event.
        if (raw.key.fromMe) continue;

        const body = extractBody(raw.message);
        if (!parseCommand(body, this.commandPrefix)) continue;

        const promise = this.handle(raw, body, handler);
        this.inFlight.add(promise);
        promise.finally(() => this.inFlight.delete(promise));
        handled.push(promise);
      }
      await Promise.all(handled);
    };
    this.socket.ev.on("messages.upsert", this.listener);
  }

  // Stops taking messages, then waits for the ones already being handled.
  async stop(): Promise<void> {
    if (this.listener) {
      this.socket.ev.off("messages.upsert", this.listener);
      this.listener = undefined;
    }
    await Promise.all(this.inFlight);
  }

  private async handle(
    raw: WAMessage,
    body: string,
    handler: (message: IncomingMessage) => Promise<void>
  ): Promise<void> {
    try {
      const message = await this.toIncomingMessage(raw, body);
      await handler(message);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "whatsapp_message_processing_failed",
          messageId: raw.key.id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  private async toIncomingMessage(
    raw: WAMessage,
    body: string
  ): Promise<IncomingMessage> {
    const chatId = raw.key.remoteJid ?? "";
    // Baileys sets `participant` only for group (and broadcast) messages; a
    // direct message's remoteJid is the sender's own jid.
    const isGroup = Boolean(raw.key.participant);
    const senderId = normalizePhoneNumber(
      isGroup ? (raw.key.participant ?? "") : chatId
    );

    let groupName: string | undefined;
    if (isGroup) {
      try {
        const metadata = await this.socket.groupMetadata(chatId);
        groupName = metadata.subject;
      } catch {
        // Group metadata unavailable; the message still carries useful data.
      }
    }

    const context = extractContextInfo(raw.message);
    const mediaType = extractMediaType(raw.message);

    return {
      id: raw.key.id ?? "",
      chatId,
      senderId,
      senderName: raw.pushName || "Usuario",
      body,
      timestamp: toDate(raw.messageTimestamp),
      isGroup,
      groupName,
      hasMedia: mediaType !== undefined,
      mediaType,
      mentionedUserIds: (context?.mentionedJid ?? []).map(normalizePhoneNumber),
      quotedMessageId: context?.stanzaId ?? undefined,
      quotedUserId: context?.participant
        ? normalizePhoneNumber(context.participant)
        : undefined,
      quotedBody: context?.quotedMessage
        ? extractBody(context.quotedMessage)
        : undefined,
    };
  }
}

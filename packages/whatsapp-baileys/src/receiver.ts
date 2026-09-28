import { isJidGroup, type WAMessage } from "@whiskeysockets/baileys";
import type { IncomingMessage, Logger } from "@bot-whatsapp/whatsapp";
import {
  buildQuotedMessage,
  extractBody,
  extractContextInfo,
  extractMediaType,
  toDate,
} from "./message-content";
import { normalizePhoneNumber, preferPhoneNumberJid } from "./message-mapping";
import type { MessageStore } from "./message-store";
import type { BaileysSocket, MessagesUpsertEvent } from "./socket-types";

export class BaileysReceiver {
  private listener?: (event: MessagesUpsertEvent) => Promise<void>;
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly socket: BaileysSocket,
    private readonly store: MessageStore,
    private readonly logger: Logger
  ) {}

  onMessage(
    handler: (message: IncomingMessage) => Promise<void>,
    isCommand?: (body: string) => boolean
  ): void {
    this.listener = async ({ messages, type }) => {
      // History-sync and other replayed batches also arrive through
      // messages.upsert; only "notify" is a live message.
      if (type !== "notify") return;

      const handled: Promise<void>[] = [];
      for (const raw of messages) {
        this.store.record(raw);
        const quoted = buildQuotedMessage(
          raw.key.remoteJid ?? "",
          extractContextInfo(raw.message)
        );
        if (quoted) this.store.recordIfAbsent(quoted);
        // Own outgoing messages come back through the same event.
        if (raw.key.fromMe) continue;

        const body = extractBody(raw.message);
        if (isCommand && !isCommand(body)) continue;

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
      this.logger("error", "WhatsApp message processing failed", {
        event: "whatsapp_message_processing_failed",
        messageId: raw.key.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async toIncomingMessage(
    raw: WAMessage,
    body: string
  ): Promise<IncomingMessage> {
    const chatId = raw.key.remoteJid ?? "";
    // isJidGroup checks the jid's own suffix (@g.us), so status@broadcast is
    // never a group even though it also carries a `participant`.
    const isGroup = Boolean(isJidGroup(chatId));
    const senderJid = isGroup ? (raw.key.participant ?? "") : chatId;
    const senderId = normalizePhoneNumber(
      preferPhoneNumberJid(senderJid, raw.key)
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
      mentionedUserIds: (context?.mentionedJid ?? []).map((jid) =>
        normalizePhoneNumber(preferPhoneNumberJid(jid, raw.key))
      ),
      quotedMessageId: context?.stanzaId ?? undefined,
      quotedUserId: context?.participant
        ? normalizePhoneNumber(
            preferPhoneNumberJid(context.participant, raw.key)
          )
        : undefined,
      quotedBody: context?.quotedMessage
        ? extractBody(context.quotedMessage)
        : undefined,
    };
  }
}

import type { WAMessage } from "@whiskeysockets/baileys";

const MAX_ENTRIES = 2000;

// Baileys has no built-in lookup from a message id back to its full message:
// reacting to, quoting, or downloading media from a message the app didn't
// just receive needs the raw WAMessage, so the receiver records every
// message it sees here and the sender reads it back by id.
export class MessageStore {
  private readonly messages = new Map<string, WAMessage>();

  record(message: WAMessage): void {
    const id = message.key.id;
    if (!id) return;
    if (!this.messages.has(id) && this.messages.size >= MAX_ENTRIES) {
      const oldest = this.messages.keys().next().value;
      if (oldest !== undefined) this.messages.delete(oldest);
    }
    this.messages.set(id, message);
  }

  get(messageId: string): WAMessage | undefined {
    return this.messages.get(messageId);
  }
}

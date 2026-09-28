import type { WAMessage } from "@whiskeysockets/baileys";

const MAX_ENTRIES = 2000;

// Baileys has no built-in lookup from a message id back to its full message:
// reacting to, quoting, or downloading media from a message the app didn't
// just receive needs the raw WAMessage, so the receiver records every
// message it sees here, plus the quoted message embedded in a reply's
// contextInfo (see buildQuotedMessage), and the sender reads either back by
// id. See architecture.md for its states and transitions.
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

  // Like record(), but never overwrites an id already present. Used for a
  // reply's quoted message (see buildQuotedMessage), which is only a
  // reconstructed stub: if the quoted message was itself received live and
  // is already stored under its real key, that real record must win.
  recordIfAbsent(message: WAMessage): void {
    const id = message.key.id;
    if (id && this.messages.has(id)) return;
    this.record(message);
  }

  get(messageId: string): WAMessage | undefined {
    return this.messages.get(messageId);
  }
}

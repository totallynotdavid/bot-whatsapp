import type { MessageSender } from "@bot-whatsapp/whatsapp";

// What the commands and the message handler use of the transport.
export type ReplySender = Pick<
  MessageSender,
  "toChatId" | "sendText" | "sendMedia" | "sendReaction" | "downloadMedia"
>;

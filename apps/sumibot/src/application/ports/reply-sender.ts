import type { MessageSender } from "@bot-whatsapp/whatsapp";

export type ReplySender = Pick<
  MessageSender,
  "toChatId" | "sendText" | "sendMedia" | "sendReaction" | "downloadMedia"
>;

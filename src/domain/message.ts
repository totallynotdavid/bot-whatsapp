export type MediaType = "image" | "video" | "audio" | "document";

export interface Message {
  readonly id: string;
  readonly chatId: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly body: string;
  readonly timestamp: Date;
  readonly isGroup: boolean;
  readonly hasMedia: boolean;
  readonly mediaType?: MediaType;
  readonly mentionedUserIds: string[];
  readonly quotedMessageId?: string;
  readonly quotedUserId?: string;
}

export interface ParsedCommand {
  readonly name: string;
  readonly args: string[];
}

export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[@c.us]/g, "");
}

export function toWhatsAppId(phone: string): string {
  return `${normalizePhoneNumber(phone)}@c.us`;
}

export function isPhoneNumberValid(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return /^\d{10,15}$/.test(normalized);
}

export function parseCommand(
  body: string,
  prefix: string
): ParsedCommand | null {
  const trimmed = body.trim();

  if (!trimmed.startsWith(prefix)) {
    return null;
  }

  const withoutPrefix = trimmed.slice(prefix.length).trim();

  if (withoutPrefix.length === 0) {
    return null;
  }

  const parts = withoutPrefix.split(/\s+/);
  const commandName = parts[0]!.toLowerCase();
  const commandArgs = parts.slice(1);

  return { name: commandName, args: commandArgs };
}

import type { User } from "./user.model";
import type { Chat } from "./chat.model";

export interface Message {
  readonly id: string;
  readonly body: string;
  readonly timestamp: Date;
  readonly from: User;
  readonly chat: Chat;
  readonly hasMedia: boolean;
  readonly mediaType?: "image" | "video" | "audio" | "document";
  readonly mentions: string[];
  readonly quotedUserId?: string;
  readonly quotedMessageId?: string;
}

export interface ParsedCommand {
  name: string;
  args: string[];
}

export function parseCommand(
  body: string,
  prefix: string
): ParsedCommand | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith(prefix)) return null;

  const withoutPrefix = trimmed.slice(prefix.length).trim();
  if (!withoutPrefix) return null;

  const parts = withoutPrefix.split(/\s+/);

  return {
    name: parts[0]!.toLowerCase(),
    args: parts.slice(1),
  };
}

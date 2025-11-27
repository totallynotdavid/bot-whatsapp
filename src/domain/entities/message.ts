import type { Chat } from "./chat";
import type { User } from "./user";

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
}

export function extractCommand(
  message: Message,
  prefix: string
): ParsedCommand | null {
  const trimmed = message.body.trim();
  if (!trimmed.startsWith(prefix)) return null;

  const withoutPrefix = trimmed.slice(prefix.length).trim();
  if (!withoutPrefix) return null;

  const parts = withoutPrefix.split(/\s+/);

  return {
    name: parts[0]!.toLowerCase(),
    args: parts.slice(1),
  };
}

export interface ParsedCommand {
  name: string;
  args: string[];
}

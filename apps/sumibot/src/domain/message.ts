export type { IncomingMessage as Message } from "@bot-whatsapp/whatsapp";

export interface ParsedCommand {
  readonly name: string;
  readonly args: string[];
}

export function parseCommand(
  body: string,
  prefix: string
): ParsedCommand | null {
  const trimmed = body.trim();

  if (!trimmed.startsWith(prefix)) {
    return null;
  }

  const [name, ...args] = trimmed.slice(prefix.length).trim().split(/\s+/);

  if (!name) {
    return null;
  }

  return { name: name.toLowerCase(), args };
}

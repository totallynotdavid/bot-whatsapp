export type {
  IncomingMessage as Message,
  MediaType,
} from "@bot-whatsapp/whatsapp";

export interface ParsedCommand {
  readonly name: string;
  readonly args: string[];
}

export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[@c.us]/g, "");
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

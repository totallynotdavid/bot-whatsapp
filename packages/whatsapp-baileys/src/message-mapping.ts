export interface ParsedCommand {
  readonly name: string;
  readonly args: string[];
}

export function normalizePhoneNumber(jidOrPhone: string): string {
  return jidOrPhone.replace(/@.*$/, "").replace(/\D/g, "");
}

export function toJid(phoneNumber: string): string {
  return `${normalizePhoneNumber(phoneNumber)}@s.whatsapp.net`;
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

import type { ParsedCommand } from "./types";

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
  const name = parts[0]!.toLowerCase();
  const args = parts.slice(1);

  return { name, args };
}

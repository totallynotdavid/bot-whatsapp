import type { Message, User } from "./models.ts";

/**
 * Service container
 * holds dependencies to inject into handlers (db, queue, AI, etc.)
 */
export interface ServiceContainer {
  database: any;
  queue: any;
  whatsapp: any;
  ai: any;
}

/**
 * Context passed to command handlers
 */
export interface CommandContext {
  message: Message;
  user: User;
  args: string[];
  services: ServiceContainer;
}

/**
 * Handlers return data, they do not send messages directly
 */
export type CommandResult =
  | { type: "text"; content: string; options?: { mentions?: string[] } }
  | { type: "media"; path: string; caption?: string; mimeType: string }
  | { type: "reply"; content: string }
  | { type: "error"; message: string; code?: string }
  | { type: "no-op" }; // Handler completed but sends no response

export type CommandHandler = (ctx: CommandContext) => Promise<CommandResult>;

import type { Message, User } from "./models";
import type { DatabaseService } from "../services/database";
import type { WhatsAppService } from "../services/whatsapp";

export interface ServiceContainer {
  database: DatabaseService;
  whatsapp: WhatsAppService;
  queue: any;
  ai: any;
}

export interface CommandContext {
  message: Message;
  user: User;
  args: string[];
  services: ServiceContainer;
}

export type CommandResult =
  | { type: "text"; content: string; options?: { mentions?: string[] } }
  | { type: "media"; path: string; caption?: string; mimeType: string }
  | { type: "reply"; content: string }
  | { type: "error"; message: string; code?: string }
  | { type: "no-op" };

export type CommandHandler = (ctx: CommandContext) => Promise<CommandResult>;

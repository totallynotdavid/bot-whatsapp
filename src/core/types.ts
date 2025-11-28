export enum Rank {
  BANNED = 0,
  REGULAR = 10,
  PREMIUM = 20,
  MODERATOR = 50,
  ADMIN = 90,
  OWNER = 100,
}

export interface User {
  readonly phoneNumber: string;
  readonly name: string;
  readonly rank: Rank;
  readonly premiumExpiresAt?: Date;
}

export interface Message {
  readonly id: string;
  readonly chatId: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly body: string;
  readonly timestamp: Date;
  readonly isGroup: boolean;
  readonly hasMedia: boolean;
  readonly mediaType?: "image" | "video" | "audio" | "document";
  readonly mentionedUserIds: string[];
  readonly quotedMessageId?: string;
  readonly quotedUserId?: string;
}

export interface ParsedCommand {
  readonly name: string;
  readonly args: string[];
}

export interface CommandMetadata {
  readonly name: string;
  readonly aliases: string[];
  readonly minRank: Rank;
  readonly description: string;
  readonly usage: string;
  readonly isHeavyOperation: boolean;
}

export interface CommandContext {
  readonly message: Message;
  readonly user: User;
  readonly args: string[];
}

export type CommandResult =
  | { type: "text"; content: string }
  | {
      type: "media";
      filePath: string;
      caption?: string;
      sendAudioAsVoice?: boolean;
    }
  | { type: "sticker"; filePath: string }
  | { type: "queued"; queueMessage: string }
  | { type: "error"; userMessage: string }
  | { type: "none" };

export interface PermissionCheckResult {
  readonly allowed: boolean;
  readonly denialReason?: string;
}

export interface MediaJobData {
  readonly messageId: string;
  readonly chatId: string;
  readonly userId: string;
  readonly targetMessageId: string;
}

export interface BaseJobData {
  readonly messageId: string;
  readonly chatId: string;
  readonly userId: string;
}

export interface DocsJobData extends BaseJobData {
  readonly mirror: string;
  readonly md5: string;
  readonly format: string;
  readonly title: string;
  readonly author?: string;
}

export interface MediaJobResult {
  readonly success: boolean;
  readonly outputFilePath?: string;
  readonly caption?: string;
  readonly errorMessage?: string;
  readonly resultType?: "sticker" | "media";
}

export function canExecuteCommand(userRank: Rank, requiredRank: Rank): boolean {
  return userRank >= requiredRank;
}

export function isPhoneNumberValid(phone: string): boolean {
  const normalized = phone.replace(/[@c.us]/g, "");
  return /^\d{10,15}$/.test(normalized);
}

export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[@c.us]/g, "");
}

export function toWhatsAppId(phone: string): string {
  return `${normalizePhoneNumber(phone)}@c.us`;
}

export function isPremiumActive(user: User): boolean {
  if (user.rank < Rank.PREMIUM) return false;
  if (!user.premiumExpiresAt) return user.rank >= Rank.PREMIUM;
  return user.premiumExpiresAt > new Date();
}

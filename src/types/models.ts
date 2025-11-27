import { Rank } from "./permissions";

export interface User {
  id: string;
  phoneNumber: string;
  name: string;
  rank: Rank;
  premiumExpiry?: Date;
}

export interface Chat {
  id: string;
  name: string;
  isGroup: boolean;
  isActive: boolean;
}

export interface Message {
  id: string;
  remoteId: string;
  body: string;
  timestamp: number;
  from: User;
  chat: Chat;
  hasMedia: boolean;
  mediaType?: "image" | "video" | "audio" | "document" | "sticker";
  mentions: string[];
}

import type {
  AnyMessageContent,
  GroupMetadata,
  MiscMessageGenerationOptions,
  ParticipantAction,
  WAMessage,
} from "@whiskeysockets/baileys";

export interface MessagesUpsertEvent {
  readonly messages: WAMessage[];
  readonly type: string;
}

// The slice of WASocket (the real makeWASocket() return value, which is
// structurally compatible) that this adapter calls. Kept narrow so fakes in
// tests only need to implement what the adapter actually uses.
export interface BaileysSocket {
  readonly ev: {
    on(
      event: "messages.upsert",
      listener: (arg: MessagesUpsertEvent) => Promise<void>
    ): void;
    off(
      event: "messages.upsert",
      listener: (arg: MessagesUpsertEvent) => Promise<void>
    ): void;
  };
  sendMessage(
    jid: string,
    content: AnyMessageContent,
    options?: MiscMessageGenerationOptions
  ): Promise<WAMessage | undefined>;
  groupMetadata(jid: string): Promise<GroupMetadata>;
  groupParticipantsUpdate(
    jid: string,
    participants: string[],
    action: ParticipantAction
  ): Promise<unknown>;
  profilePictureUrl(
    jid: string,
    type?: "preview" | "image",
    timeoutMs?: number
  ): Promise<string | undefined>;
  end(error: Error | undefined): Promise<void>;
}

// The library boundary for reading media off a message: real code downloads
// and decrypts it, fakes just hand back fixed bytes.
export type MediaDownloader = (message: WAMessage) => Promise<Buffer>;

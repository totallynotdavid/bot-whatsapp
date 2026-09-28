import { EventEmitter } from "node:events";
import type {
  AnyMessageContent,
  GroupMetadata,
  MiscMessageGenerationOptions,
  ParticipantAction,
  WAMessage,
} from "@whiskeysockets/baileys";
import type { BaileysSocket, MessagesUpsertEvent } from "../src/socket-types";

interface FakeGroupParticipant {
  readonly userId: string;
  readonly isAdmin: boolean;
}

interface FakeMessageInput {
  readonly chatId: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly body: string;
  readonly isGroup: boolean;
  readonly mentionedUserIds?: string[];
}

const toJid = (phoneNumber: string): string => `${phoneNumber}@s.whatsapp.net`;

// Fakes the baileys WASocket at the boundary the adapter calls: no network,
// no real WhatsApp connection.
export class FakeBaileysSocket extends EventEmitter implements BaileysSocket {
  readonly events: string[] = [];
  readonly ev: BaileysSocket["ev"];
  private readonly groups = new Map<string, FakeGroupParticipant[]>();
  private readonly profilePics = new Map<string, string>();
  private messageCounter = 0;

  constructor() {
    super();
    this.ev = {
      on: (event, listener) => {
        this.on(event, listener);
      },
      off: (event, listener) => {
        this.off(event, listener);
      },
    };
  }

  setGroup(chatId: string, participants: FakeGroupParticipant[]): void {
    this.groups.set(chatId, participants);
  }

  setProfilePic(userId: string, url: string): void {
    this.profilePics.set(userId, url);
  }

  async deliverMessage(input: FakeMessageInput): Promise<void> {
    const id = `msg-${++this.messageCounter}`;
    const mentionedJid = (input.mentionedUserIds ?? []).map(toJid);
    const raw: WAMessage = {
      key: {
        remoteJid: input.chatId,
        id,
        fromMe: false,
        participant: input.isGroup ? toJid(input.senderId) : undefined,
      },
      pushName: input.senderName,
      messageTimestamp: 1_700_000_000,
      message:
        mentionedJid.length > 0
          ? {
              extendedTextMessage: {
                text: input.body,
                contextInfo: { mentionedJid },
              },
            }
          : { conversation: input.body },
    };

    const event: MessagesUpsertEvent = { messages: [raw], type: "notify" };
    await Promise.all(
      this.listeners("messages.upsert").map((listener) => listener(event))
    );
  }

  // -- BaileysSocket surface used by the adapter --

  async sendMessage(
    jid: string,
    content: AnyMessageContent,
    options: MiscMessageGenerationOptions = {}
  ): Promise<WAMessage | undefined> {
    void options;
    const record = content as Record<string, unknown>;
    if ("react" in record) {
      const reaction = record["react"] as { text: string };
      this.events.push(`react:${jid}:${reaction.text}`);
    } else if ("text" in record) {
      this.events.push(`text:${jid}:${record["text"]}`);
    } else if ("sticker" in record) {
      this.events.push(`sticker:${jid}`);
    } else {
      this.events.push(`media:${jid}:${record["caption"] ?? ""}`);
    }
    return undefined;
  }

  async groupMetadata(jid: string): Promise<GroupMetadata> {
    const participants = this.groups.get(jid) ?? [];
    return {
      id: jid,
      subject: "Group",
      participants: participants.map((p) => ({
        id: toJid(p.userId),
        admin: p.isAdmin ? "admin" : null,
      })),
    } as GroupMetadata;
  }

  async groupParticipantsUpdate(
    jid: string,
    participants: string[],
    action: ParticipantAction
  ): Promise<unknown> {
    for (const participant of participants) {
      this.events.push(
        `${action}:${jid}:${participant.replace("@s.whatsapp.net", "")}`
      );
    }
    return [];
  }

  async profilePictureUrl(jid: string): Promise<string | undefined> {
    return this.profilePics.get(jid.replace("@s.whatsapp.net", ""));
  }
}

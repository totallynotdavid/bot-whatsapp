import type {
  AnyMessageContent,
  GroupMetadata,
  MiscMessageGenerationOptions,
  ParticipantAction,
  WAMessage,
} from "@whiskeysockets/baileys";
import type { BaileysSocket, MessagesUpsertEvent } from "./socket-types";

type MessageListener = (arg: MessagesUpsertEvent) => Promise<void>;

// Wraps whichever raw socket is currently connected, so the receiver and
// sender can hold one long-lived reference across reconnects instead of a
// direct handle to a socket that gets torn down and rebuilt. `swap`
// re-attaches every listener registered through `ev.on` onto the new
// socket; the old socket is already closed by the time a reconnect
// happens, so nothing needs detaching from it.
export class ReconnectingBaileysSocket implements BaileysSocket {
  private current?: BaileysSocket;
  private readonly messageListeners = new Set<MessageListener>();

  readonly ev: BaileysSocket["ev"] = {
    on: (event, listener) => {
      this.messageListeners.add(listener);
      this.current?.ev.on(event, listener);
    },
    off: (event, listener) => {
      this.messageListeners.delete(listener);
      this.current?.ev.off(event, listener);
    },
  };

  swap(next: BaileysSocket): void {
    this.current = next;
    for (const listener of this.messageListeners) {
      next.ev.on("messages.upsert", listener);
    }
  }

  private require(): BaileysSocket {
    if (!this.current) {
      throw new Error("WhatsApp transport is not connected");
    }
    return this.current;
  }

  sendMessage(
    jid: string,
    content: AnyMessageContent,
    options?: MiscMessageGenerationOptions
  ): Promise<WAMessage | undefined> {
    return this.require().sendMessage(jid, content, options);
  }

  groupMetadata(jid: string): Promise<GroupMetadata> {
    return this.require().groupMetadata(jid);
  }

  groupParticipantsUpdate(
    jid: string,
    participants: string[],
    action: ParticipantAction
  ): Promise<unknown> {
    return this.require().groupParticipantsUpdate(jid, participants, action);
  }

  profilePictureUrl(
    jid: string,
    type?: "preview" | "image",
    timeoutMs?: number
  ): Promise<string | undefined> {
    return this.require().profilePictureUrl(jid, type, timeoutMs);
  }

  end(error: Error | undefined): Promise<void> {
    return this.require().end(error);
  }
}

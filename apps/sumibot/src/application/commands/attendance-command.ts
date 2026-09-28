import type { AttendanceAction } from "../../domain/attendance";
import type { Command, CommandReply } from "../../domain/command";
import type { Message } from "../../domain/message";
import { MESSAGES } from "../../i18n/es";
import type { CommandDeps } from "../command-deps";

const NAMES: Record<AttendanceAction, string> = {
  open: "abierto",
  close: "cerrado",
};

const CONFIRMATIONS: Record<AttendanceAction, string> = {
  open: MESSAGES.opened,
  close: MESSAGES.closed,
};

// Opening or closing is confirmed with a photo of the library, sent with the
// command as its caption.
export function createAttendanceCommand(
  action: AttendanceAction,
  deps: CommandDeps
): Command {
  const { sender, attendance, photos, log, now } = deps;

  async function register(message: Message): Promise<CommandReply> {
    if (message.mediaType !== "image") {
      return { text: MESSAGES.photoRequired, outcome: "failed" };
    }

    try {
      const media = await sender.downloadMedia(message.id);
      if (!media) {
        throw new Error("The message has no downloadable media");
      }

      const imageUrl = await photos.upload(message.senderId, media.buffer);
      await attendance.record({
        action,
        managerNumber: message.senderId,
        imageUrl,
        timestamp: now(),
      });

      return { text: CONFIRMATIONS[action], outcome: "completed" };
    } catch (error) {
      log("error", "Could not register attendance", {
        action,
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return { text: MESSAGES.problem, outcome: "failed" };
    }
  }

  return {
    name: NAMES[action],
    async run(message) {
      const { text, outcome } = await register(message);
      await sender.sendText(message.chatId, text);
      return outcome;
    },
  };
}

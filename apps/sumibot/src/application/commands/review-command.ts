import type { OpeningPhoto } from "../../domain/attendance";
import type { Command } from "../../domain/command";
import { MESSAGES } from "../../i18n/es";
import type { CommandDeps } from "../command-deps";

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
}

// Sends the photo of every opening today, captioned with who opened and when.
export function createReviewCommand(deps: CommandDeps): Command {
  const { sender, attendance, images, log, now } = deps;

  async function describe(opening: OpeningPhoto): Promise<string> {
    const name =
      (await attendance.librarianName(opening.managerNumber)) ??
      opening.managerNumber;
    return `${name}: ${formatTime(opening.timestamp)}`;
  }

  async function sendPhoto(
    chatId: string,
    opening: OpeningPhoto
  ): Promise<void> {
    const caption = await describe(opening);
    const image = await images.download(opening.imageUrl);
    try {
      await sender.sendMedia(chatId, image.filePath, caption);
    } finally {
      await image.dispose();
    }
  }

  return {
    name: "revisar",
    async run(message) {
      try {
        const today = now();
        const openings = await attendance.openingsBetween(
          startOfDay(today),
          endOfDay(today)
        );

        if (openings.length === 0) {
          await sender.sendText(message.chatId, MESSAGES.nobodyOpened);
          return;
        }

        for (const opening of openings) {
          await sendPhoto(message.chatId, opening);
        }
      } catch (error) {
        log("error", "Could not review today's openings", {
          error: error instanceof Error ? error.message : String(error),
        });
        await sender.sendText(message.chatId, MESSAGES.reviewFailed);
      }
    },
  };
}

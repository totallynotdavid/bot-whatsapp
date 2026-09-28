import type { OpeningPhoto } from "../../domain/attendance";
import type { Command } from "../../domain/command";
import { MESSAGES, reviewPhotosFailed } from "../../i18n/es";
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

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createReviewCommand(deps: CommandDeps): Command {
  const { sender, attendance, images, log, now } = deps;

  async function caption(opening: OpeningPhoto): Promise<string> {
    const name = await attendance
      .librarianName(opening.managerNumber)
      .catch((error: unknown) => {
        log("warn", "Could not look up the librarian", {
          error: describeError(error),
        });
        return null;
      });
    return `${name ?? opening.managerNumber}: ${formatTime(opening.timestamp)}`;
  }

  async function sendPhoto(
    chatId: string,
    opening: OpeningPhoto,
    text: string
  ): Promise<void> {
    const image = await images.download(opening.imageUrl);
    try {
      await sender.sendMedia(chatId, image.filePath, text);
    } finally {
      await image.dispose();
    }
  }

  async function openingsToday(): Promise<OpeningPhoto[]> {
    const today = now();
    return attendance.openingsBetween(startOfDay(today), endOfDay(today));
  }

  return {
    name: "revisar",
    async run(message) {
      let openings: OpeningPhoto[];
      try {
        openings = await openingsToday();
      } catch (error) {
        log("error", "Could not read today's openings", {
          error: describeError(error),
        });
        await sender.sendText(message.chatId, MESSAGES.reviewFailed);
        return "failed";
      }

      if (openings.length === 0) {
        await sender.sendText(message.chatId, MESSAGES.nobodyOpened);
        return "completed";
      }

      const unsent: string[] = [];
      for (const opening of openings) {
        const text = await caption(opening);
        try {
          await sendPhoto(message.chatId, opening, text);
        } catch (error) {
          log("error", "Could not send an opening photo", {
            imageUrl: opening.imageUrl,
            error: describeError(error),
          });
          unsent.push(text);
        }
      }

      if (unsent.length === 0) {
        return "completed";
      }
      await sender.sendText(message.chatId, reviewPhotosFailed(unsent));
      return "failed";
    },
  };
}

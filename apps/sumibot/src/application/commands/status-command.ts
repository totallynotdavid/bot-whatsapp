import { isOpen } from "../../domain/attendance";
import type { Command } from "../../domain/command";
import { libraryOpenBy, MESSAGES } from "../../i18n/es";
import type { CommandDeps } from "../command-deps";

export function createStatusCommand(deps: CommandDeps): Command {
  const { sender, attendance, log } = deps;

  async function describe(): Promise<string> {
    try {
      const [opening, closing] = await Promise.all([
        attendance.latest("open"),
        attendance.latest("close"),
      ]);

      if (!opening || !isOpen(opening, closing)) {
        return MESSAGES.libraryClosed;
      }

      const name = await attendance
        .librarianName(opening.managerNumber)
        .catch((error: unknown) => {
          log("warn", "Could not look up the librarian", {
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        });

      return name ? libraryOpenBy(name) : MESSAGES.libraryOpen;
    } catch (error) {
      log("error", "Could not read the library status", {
        error: error instanceof Error ? error.message : String(error),
      });
      return MESSAGES.statusFailed;
    }
  }

  return {
    name: "estado",
    async run(message) {
      await sender.sendText(message.chatId, await describe());
    },
  };
}

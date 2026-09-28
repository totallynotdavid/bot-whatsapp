import { isOpen } from "../../domain/attendance";
import type { Command, CommandReply } from "../../domain/command";
import { libraryOpenBy, MESSAGES } from "../../i18n/es";
import type { CommandDeps } from "../command-deps";

export function createStatusCommand(deps: CommandDeps): Command {
  const { sender, attendance, log } = deps;

  async function describe(): Promise<CommandReply> {
    try {
      const [opening, closing] = await Promise.all([
        attendance.latest("open"),
        attendance.latest("close"),
      ]);

      if (!opening || !isOpen(opening, closing)) {
        return { text: MESSAGES.libraryClosed, outcome: "completed" };
      }

      const name = await attendance
        .librarianName(opening.managerNumber)
        .catch((error: unknown) => {
          log("warn", "Could not look up the librarian", {
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        });

      return {
        text: name ? libraryOpenBy(name) : MESSAGES.libraryOpen,
        outcome: "completed",
      };
    } catch (error) {
      log("error", "Could not read the library status", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { text: MESSAGES.statusFailed, outcome: "failed" };
    }
  }

  return {
    name: "estado",
    async run(message) {
      const { text, outcome } = await describe();
      await sender.sendText(message.chatId, text);
      return outcome;
    },
  };
}

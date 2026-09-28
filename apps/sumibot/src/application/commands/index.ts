import type { Command } from "../../domain/command";
import type { CommandDeps } from "../command-deps";
import { createAttendanceCommand } from "./attendance-command";
import { createReviewCommand } from "./review-command";
import { createStatusCommand } from "./status-command";

export function createCommands(deps: CommandDeps): Command[] {
  return [
    createAttendanceCommand("open", deps),
    createAttendanceCommand("close", deps),
    createStatusCommand(deps),
    createReviewCommand(deps),
  ];
}

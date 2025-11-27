import type { CommandContext, CommandResult } from "../../types/handler";

export async function ping(_ctx: CommandContext): Promise<CommandResult> {
  return {
    type: "text",
    content: "🏓 Pong! The bot is online and the pipeline is working.",
  };
}

import type { CommandMetadata } from "../../domain/models/command-metadata.model";
import type { CommandContext } from "./dto/command-context.dto";
import type { CommandResult } from "./dto/command-result.dto";

export interface ICommandHandler {
  readonly metadata: CommandMetadata;
  execute(context: CommandContext): Promise<CommandResult>;
}

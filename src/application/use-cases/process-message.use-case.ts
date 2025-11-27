import type { Message } from "../../domain/entities/message";
import type { CommandResult } from "../dto/command-result.dto";
import type { CommandRegistry } from "../commands/command.registry";
import type { PermissionService } from "../../domain/services/permission.service";
import type { CommandServices } from "../commands/command.interface";
import { extractCommand } from "../../domain/entities/message";
import { logger } from "../../shared/logger";

export class ProcessMessageUseCase {
  constructor(
    private registry: CommandRegistry,
    private permissions: PermissionService,
    private services: CommandServices,
    private commandPrefix: string
  ) {}

  async execute(message: Message): Promise<CommandResult | null> {
    const parsed = extractCommand(message, this.commandPrefix);
    if (!parsed) return null;

    const command = this.registry.resolve(parsed.name);
    if (!command) {
      const suggestions = this.registry.suggestSimilar(parsed.name);

      if (suggestions.length > 0) {
        return {
          type: "error",
          message: `Comando no encontrado. ¿Quisiste decir: ${suggestions.map((s) => `/${s}`).join(", ")}?`,
        };
      }

      return { type: "no-op" };
    }

    const permCheck = await this.permissions.checkCommand(
      message.from,
      message.chat,
      command.metadata.minRank
    );

    if (!permCheck.allowed) {
      return {
        type: "error",
        message: permCheck.reason || "No tienes permiso para este comando.",
      };
    }

    const start = Date.now();
    try {
      const result = await command.execute(
        {
          message,
          user: message.from,
          args: parsed.args,
        },
        this.services
      );

      const duration = Date.now() - start;
      logger.info("Command executed", {
        command: command.metadata.name,
        user: message.from.phoneNumber.toString(),
        duration,
        success: result.type !== "error",
      });

      return result;
    } catch (error) {
      logger.error("Error executing command", error, {
        command: command.metadata.name,
        user: message.from.phoneNumber.toString(),
      });

      return {
        type: "error",
        message: "Error interno. El equipo ha sido notificado.",
      };
    }
  }
}

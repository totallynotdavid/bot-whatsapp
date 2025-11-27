import type { Message } from "../../domain/entities/message";
import { extractCommand } from "../../domain/entities/message";
import type { PermissionService } from "../../domain/services/permission.service";
import { logger } from "../../shared/logger";
import { PerformanceLogger } from "../../shared/logger/performance-logger";
import type { CommandResult } from "../dto/command-result.dto";
import type { ICommandRegistry } from "../interfaces/command-registry.interface";
import type { ICommandServices } from "../interfaces/command-services.interface";

export class ProcessMessageUseCase {
  constructor(
    private registry: ICommandRegistry,
    private permissions: PermissionService,
    private services: ICommandServices,
    private commandPrefix: string
  ) {}

  async execute(message: Message): Promise<CommandResult | null> {
    const perf = new PerformanceLogger("process-message");

    const parsed = extractCommand(message, this.commandPrefix);
    if (!parsed) return null;

    perf.checkpoint("command-parsed");

    const command = this.registry.resolve(parsed.name);
    if (!command) {
      return this.handleUnknownCommand(parsed.name);
    }

    perf.checkpoint("command-resolved");

    const permCheck = await this.permissions.checkCommand(
      message.from,
      message.chat,
      command.metadata.minRank
    );

    perf.checkpoint("permission-checked");

    if (!permCheck.allowed) {
      perf.finish({ success: false, reason: "permission-denied" });
      return {
        type: "error",
        message: permCheck.reason || "No tienes permiso para este comando.",
      };
    }

    try {
      const result = await command.execute(
        {
          message,
          user: message.from,
          args: parsed.args,
        },
        this.services
      );

      perf.checkpoint("command-executed");
      perf.finish({
        success: result.type !== "error",
        command: command.metadata.name,
        userId: message.from.phoneNumber.toString(),
      });

      logger.info("Command executed", {
        command: command.metadata.name,
        user: message.from.phoneNumber.toString(),
        success: result.type !== "error",
      });

      return result;
    } catch (error) {
      perf.finish({
        success: false,
        command: command.metadata.name,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      logger.error("Command execution failed", error, {
        command: command.metadata.name,
        user: message.from.phoneNumber.toString(),
      });

      await this.notifyOwnerOnCriticalError(error, command.metadata.name);

      return {
        type: "error",
        message: "Error interno. El equipo ha sido notificado.",
      };
    }
  }

  private handleUnknownCommand(commandName: string): CommandResult {
    const suggestions = this.registry.suggestSimilar(commandName);

    if (suggestions.length > 0) {
      return {
        type: "error",
        message: `Comando no encontrado. ¿Quisiste decir: ${suggestions.map((s) => `/${s}`).join(", ")}?`,
      };
    }

    return { type: "no-op" };
  }

  private async notifyOwnerOnCriticalError(
    error: unknown,
    commandName: string
  ): Promise<void> {
    try {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Critical error notification", error, {
        command: commandName,
      });

      await this.services.whatsappClient.sendText(
        this.services.ownerPhone.toString(),
        `⚠️ Error crítico en comando: ${commandName}\n\n${errorMessage}`
      );
    } catch (notifyError) {
      logger.error("Failed to notify owner", notifyError);
    }
  }
}

import type { Message } from "../../domain/models/message.model";
import { parseCommand } from "../../domain/models/message.model";
import type { CommandResult } from "../commands/dto/command-result.dto";
import type { CommandRegistry } from "../commands/command-registry";
import type { PermissionChecker } from "../services/permission-checker.service";
import type { UserStateService } from "../services/user-state.service";
import type { MessageSender } from "../../infrastructure/whatsapp/message-sender";
import { logger } from "../../infrastructure/monitoring/logger";
import { PerformanceTracker } from "../../infrastructure/monitoring/performance-tracker";
import { PERFORMANCE } from "../../config/constants";
import { MESSAGES_ES } from "../../shared/i18n/messages-es";

export class MessageOrchestrator {
  constructor(
    private readonly commandRegistry: CommandRegistry,
    private readonly permissionChecker: PermissionChecker,
    private readonly userStateService: UserStateService,
    private readonly messageSender: MessageSender,
    private readonly commandPrefix: string
  ) {}

  async handleMessage(message: Message): Promise<void> {
    const tracker = new PerformanceTracker("handle-message");

    try {
      await this.acknowledgeMessage(message.id);
      tracker.checkpoint("acknowledged");

      const parsedCommand = parseCommand(message.body, this.commandPrefix);
      if (!parsedCommand) {
        await this.clearReaction(message.id);
        return;
      }

      tracker.checkpoint("parsed");

      const command = this.commandRegistry.resolve(parsedCommand.name);
      if (!command) {
        await this.handleUnknownCommand(message, parsedCommand.name);
        tracker.finish({ success: false, reason: "unknown-command" });
        return;
      }

      tracker.checkpoint("resolved");

      const permissionResult = await this.permissionChecker.checkPermission(
        message.from,
        message.chat,
        command.metadata.minRank
      );
      tracker.checkpoint("permission-checked");

      if (!permissionResult.allowed) {
        await this.sendErrorResponse(
          message,
          permissionResult.reason || MESSAGES_ES.errors.permissionDenied
        );
        tracker.finish({ success: false, reason: "permission-denied" });
        return;
      }

      const result = await command.execute({
        message,
        user: message.from,
        args: parsedCommand.args,
      });
      tracker.checkpoint("executed");

      await this.sendCommandResult(message, result);
      tracker.checkpoint("response-sent");

      await this.clearReaction(message.id);

      tracker.finish({
        success: result.type !== "error",
        command: command.metadata.name,
        userId: message.from.phoneNumber.toString(),
      });

      logger.info("Command completed", {
        command: command.metadata.name,
        user: message.from.phoneNumber.toString(),
        success: result.type !== "error",
      });
    } catch (error) {
      tracker.finish({
        success: false,
        error: error instanceof Error ? error.message : "unknown",
      });

      logger.error("Message handling failed", error, {
        messageId: message.id,
        userId: message.from.phoneNumber.toString(),
      });

      await this.sendErrorResponse(message, MESSAGES_ES.errors.internalError);
      await this.markError(message.id);
      await this.notifyOwnerOnCriticalError(error, message);
    }
  }

  private async acknowledgeMessage(messageId: string): Promise<void> {
    const start = Date.now();

    try {
      await this.messageSender.sendReaction(messageId, "⏳");

      const duration = Date.now() - start;
      if (duration > PERFORMANCE.ACKNOWLEDGMENT_TIMEOUT_MS) {
        logger.warn("Acknowledgment exceeded threshold", {
          messageId,
          duration,
          threshold: PERFORMANCE.ACKNOWLEDGMENT_TIMEOUT_MS,
        });
      }
    } catch (error) {
      logger.error("Failed to acknowledge message", error, { messageId });
    }
  }

  private async clearReaction(messageId: string): Promise<void> {
    try {
      await this.messageSender.sendReaction(messageId, "");
    } catch (error) {
      logger.error("Failed to clear reaction", error, { messageId });
    }
  }

  private async markError(messageId: string): Promise<void> {
    try {
      await this.messageSender.sendReaction(messageId, "❌");
    } catch (error) {
      logger.error("Failed to mark error", error, { messageId });
    }
  }

  private async handleUnknownCommand(
    message: Message,
    commandName: string
  ): Promise<void> {
    const suggestions = this.commandRegistry.suggestSimilar(commandName);

    let errorMessage = MESSAGES_ES.errors.commandNotFound;
    if (suggestions.length > 0) {
      errorMessage += `\n\n¿Quisiste decir: ${suggestions.map((s) => `${this.commandPrefix}${s}`).join(", ")}?`;
    }

    await this.sendErrorResponse(message, errorMessage);
    await this.clearReaction(message.id);
  }

  private async sendCommandResult(
    message: Message,
    result: CommandResult
  ): Promise<void> {
    switch (result.type) {
      case "text":
        await this.messageSender.sendText(
          message.chat.id,
          result.content,
          message.id
        );
        break;

      case "media":
        await this.messageSender.sendMedia(
          message.chat.id,
          result.path,
          result.caption,
          message.id
        );
        break;

      case "sticker":
        await this.messageSender.sendSticker(
          message.chat.id,
          result.path,
          message.id
        );
        break;

      case "error":
        await this.sendErrorResponse(message, result.message);
        break;

      case "no-op":
        break;
    }
  }

  private async sendErrorResponse(
    message: Message,
    errorMessage: string
  ): Promise<void> {
    try {
      await this.messageSender.sendText(
        message.chat.id,
        `❌ ${errorMessage}`,
        message.id
      );
    } catch (error) {
      logger.error("Failed to send error response", error, {
        messageId: message.id,
      });
    }
  }

  private async notifyOwnerOnCriticalError(
    error: unknown,
    message: Message
  ): Promise<void> {
    try {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const ownerPhone = await this.userStateService.getOwnerPhone();

      await this.messageSender.sendText(
        `${ownerPhone.toString()}@c.us`,
        `⚠️ *Error Crítico*\n\nUsuario: ${message.from.phoneNumber.toString()}\nChat: ${message.chat.id}\n\n${errorMessage}`
      );
    } catch (notifyError) {
      logger.error("Failed to notify owner", notifyError);
    }
  }
}

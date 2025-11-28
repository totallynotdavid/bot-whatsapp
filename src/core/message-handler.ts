import type { Message, ParsedCommand } from "./types";
import { parseCommand } from "./command-parser";
import type { CommandRouter } from "./command-router";
import type { PermissionGuard } from "./permission-guard";
import type { ResponseWriter } from "./response-writer";
import type { StateManager } from "./state-manager";
import type { WhatsAppSender } from "../adapters/whatsapp-sender";
import { log } from "../lib/logger";
import { config } from "../config";
import { MESSAGES } from "../i18n/es";

export class MessageHandler {
  constructor(
    private readonly router: CommandRouter,
    private readonly permissionGuard: PermissionGuard,
    private readonly stateManager: StateManager,
    private readonly responseWriter: ResponseWriter,
    private readonly sender: WhatsAppSender,
    private readonly commandPrefix: string
  ) {}

  async handleMessage(message: Message): Promise<void> {
    const startTime = Date.now();

    this.acknowledgeAsync(message.id);

    const parsed = parseCommand(message.body, this.commandPrefix);

    if (!parsed) {
      this.clearReactionAsync(message.id);
      return;
    }

    try {
      await this.processCommand(message, parsed, startTime);
    } catch (error) {
      await this.handleCommandError(error, message);
    }
  }

  private async processCommand(
    message: Message,
    parsed: ParsedCommand,
    startTime: number
  ): Promise<void> {
    const handler = this.router.route(parsed.name);

    if (!handler) {
      await this.handleUnknownCommand(message, parsed.name);
      this.clearReactionAsync(message.id);
      return;
    }

    const user = await this.stateManager.getUser(message.senderId);

    const permissionResult = await this.permissionGuard.checkPermission(
      user,
      handler.metadata.minRank
    );

    if (!permissionResult.allowed) {
      await this.responseWriter.writeResponse(
        {
          type: "error",
          userMessage:
            permissionResult.denialReason || MESSAGES.errors.permissionDenied,
        },
        message
      );
      this.clearReactionAsync(message.id);
      return;
    }

    const context = {
      message,
      user,
      args: parsed.args,
    };

    const result = await handler.execute(context);

    await this.responseWriter.writeResponse(result, message);
    this.clearReactionAsync(message.id);

    const duration = Date.now() - startTime;

    log("info", "Command completed", {
      command: handler.metadata.name,
      userId: user.phoneNumber,
      success: result.type !== "error",
      durationMs: duration,
    });
  }

  private async handleUnknownCommand(
    message: Message,
    commandName: string
  ): Promise<void> {
    const suggestions = this.router.suggestSimilar(commandName);

    let errorMessage = MESSAGES.errors.commandNotFound;

    if (suggestions.length > 0) {
      const formattedSuggestions = suggestions
        .map((s) => `${this.commandPrefix}${s}`)
        .join(", ");
      errorMessage += `\n\n¿Quisiste decir: ${formattedSuggestions}?`;
    }

    await this.responseWriter.writeResponse(
      { type: "error", userMessage: errorMessage },
      message
    );
  }

  private async handleCommandError(
    error: unknown,
    message: Message
  ): Promise<void> {
    log("error", "Command execution failed", {
      messageId: message.id,
      userId: message.senderId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    await this.responseWriter.writeResponse(
      { type: "error", userMessage: MESSAGES.errors.internalError },
      message
    );

    await this.responseWriter.markError(message.id);
    await this.notifyOwnerAsync(error, message);
  }

  private acknowledgeAsync(messageId: string): void {
    this.responseWriter.acknowledgeMessage(messageId).catch((error) => {
      log("warn", "Failed to acknowledge", { messageId, error });
    });
  }

  private clearReactionAsync(messageId: string): void {
    this.responseWriter.clearReaction(messageId).catch((error) => {
      log("warn", "Failed to clear reaction", { messageId, error });
    });
  }

  private notifyOwnerAsync(error: unknown, message: Message): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const notificationText =
      `⚠️ *Error Crítico*\n\n` +
      `Usuario: ${message.senderId}\n` +
      `Chat: ${message.chatId}\n\n` +
      `${errorMessage}`;

    this.sender
      .sendText(`${config.OWNER_PHONE}@c.us`, notificationText)
      .catch((notifyError) => {
        log("error", "Failed to notify owner", {
          originalError: errorMessage,
          notifyError:
            notifyError instanceof Error
              ? notifyError.message
              : String(notifyError),
        });
      });
  }
}

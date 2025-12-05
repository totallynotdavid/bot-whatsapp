import type { Message } from "../../domain/message";
import { toWhatsAppId } from "../../domain/message";
import type { ResponseBuilder } from "../../presentation/response-builder";
import { MESSAGES } from "../../i18n/es";
import { log } from "../../lib/logging/logger";

export class ErrorHandler {
  constructor(
    private readonly responseBuilder: ResponseBuilder,
    private readonly ownerPhone: string
  ) {}

  async handleError(error: unknown, message: Message): Promise<void> {
    log("error", "Command execution failed", {
      messageId: message.id,
      userId: message.senderId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    await this.responseBuilder.send(
      { type: "error", userMessage: MESSAGES.errors.internalError },
      message
    );

    this.notifyOwnerAsync(error, message);
  }

  private notifyOwnerAsync(error: unknown, message: Message): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    const notificationText =
      `⚠️ *Error Crítico*\n\n` +
      `Usuario: ${message.senderId}\n` +
      `Chat: ${message.chatId}\n` +
      `Mensaje: ${message.body}\n\n` +
      `Error: ${errorMessage}\n\n` +
      `Stack: ${stack?.slice(0, 500) || "N/A"}`;

    this.responseBuilder
      .send(
        { type: "text", content: notificationText },
        {
          ...message,
          chatId: toWhatsAppId(this.ownerPhone),
        }
      )
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

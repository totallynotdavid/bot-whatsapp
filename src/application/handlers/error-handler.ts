import type { Message } from "../../domain/message";
import type { ResponseBuilder } from "../../presentation/response-builder";
import type { OwnerNotifier } from "../services/owner-notifier";
import { MESSAGES } from "../../i18n/es";
import { log } from "../../lib/logging/logger";

export class ErrorHandler {
  constructor(
    private readonly responseBuilder: ResponseBuilder,
    private readonly ownerNotifier: OwnerNotifier
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

    void this.ownerNotifier.notify(error, message);
  }
}

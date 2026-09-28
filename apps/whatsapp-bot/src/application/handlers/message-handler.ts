import type { Message } from "../../domain/message";
import type { CommandExecutor } from "../services/command-executor";
import type { ResponseBuilder } from "../../presentation/response-builder";
import type { Acknowledgment } from "../../presentation/acknowledgment";
import type { ErrorHandler } from "./error-handler";
import { log } from "../../lib/logging/logger";

export class MessageProcessor {
  constructor(
    private readonly commandExecutor: CommandExecutor,
    private readonly responseBuilder: ResponseBuilder,
    private readonly acknowledgment: Acknowledgment,
    private readonly errorHandler: ErrorHandler
  ) {}

  async process(message: Message): Promise<void> {
    const startTime = Date.now();

    this.acknowledgeAsync(message.id);

    try {
      const result = await this.commandExecutor.execute(message);

      if (!result) {
        this.clearAckAsync(message.id);
        return;
      }

      await this.responseBuilder.send(result, message);
      this.clearAckAsync(message.id);

      const durationMs = Date.now() - startTime;
      log("info", "Message processed", {
        messageId: message.id,
        userId: message.senderId,
        success: result.type !== "error",
        durationMs,
      });
    } catch (error) {
      await this.errorHandler.handleError(error, message);
      this.markErrorAsync(message.id);
    }
  }

  private acknowledgeAsync(messageId: string): void {
    this.acknowledgment.acknowledge(messageId).catch((error) => {
      log("warn", "Async acknowledgment failed", { messageId, error });
    });
  }

  private clearAckAsync(messageId: string): void {
    this.acknowledgment.clear(messageId).catch((error) => {
      log("warn", "Async clear ack failed", { messageId, error });
    });
  }

  private markErrorAsync(messageId: string): void {
    this.acknowledgment.markError(messageId).catch((error) => {
      log("warn", "Async mark error failed", { messageId, error });
    });
  }
}

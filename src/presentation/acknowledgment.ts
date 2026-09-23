import type { WhatsAppSender } from "../infrastructure/whatsapp/sender";
import { TIMEOUTS } from "../config/constants";
import { log } from "../lib/logging/logger";

const ACK_EMOJI = "⏳";
const CLEAR_EMOJI = "";

export class Acknowledgment {
  constructor(private readonly sender: WhatsAppSender) {}

  async acknowledge(messageId: string): Promise<void> {
    const startTime = Date.now();

    try {
      await this.sender.sendReaction(messageId, ACK_EMOJI);

      const durationMs = Date.now() - startTime;
      if (durationMs > TIMEOUTS.COMMAND_ACK_MS) {
        log("warn", "Acknowledgment exceeded target latency", {
          messageId,
          durationMs,
          targetMs: TIMEOUTS.COMMAND_ACK_MS,
        });
      }
    } catch (error) {
      log("warn", "Failed to acknowledge message", {
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async clear(messageId: string): Promise<void> {
    try {
      await this.sender.sendReaction(messageId, CLEAR_EMOJI);
    } catch (error) {
      log("warn", "Failed to clear acknowledgment", {
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async markError(messageId: string): Promise<void> {
    try {
      await this.sender.sendReaction(messageId, "❌");
    } catch (error) {
      log("warn", "Failed to mark error", {
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

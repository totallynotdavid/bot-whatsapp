import type { Message } from "../../domain/message";
import type { MessageSender } from "@bot-whatsapp/whatsapp";
import { log } from "../../lib/logging/logger";

const STACK_EXCERPT_LENGTH = 500;

export class OwnerNotifier {
  constructor(
    private readonly sender: Pick<MessageSender, "sendText" | "toChatId">,
    private readonly ownerPhone: string
  ) {}

  // Never rejects; failures are logged and dropped to avoid breaking the user reply.
  async notify(error: unknown, message: Message): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    const text =
      `⚠️ *Error Crítico*\n\n` +
      `Usuario: ${message.senderId}\n` +
      `Chat: ${message.chatId}\n` +
      `Mensaje: ${message.body}\n\n` +
      `Error: ${errorMessage}\n\n` +
      `Stack: ${stack?.slice(0, STACK_EXCERPT_LENGTH) || "N/A"}`;

    try {
      await this.sender.sendText(this.sender.toChatId(this.ownerPhone), text);
    } catch (notifyError) {
      log("error", "Failed to notify owner", {
        originalError: errorMessage,
        notifyError:
          notifyError instanceof Error
            ? notifyError.message
            : String(notifyError),
      });
    }
  }
}

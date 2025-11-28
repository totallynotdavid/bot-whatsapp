import type { CommandContext, CommandResult, DocsJobData } from "../core/types";
import { BaseCommand } from "./base-command";
import type { AnnasSearchAdapter } from "../adapters/annas-search-adapter";
import type { SearchStore } from "../stores/search-store";
import type { QueueAdapter } from "../adapters/queue-adapter";
import { Rank } from "../core/types";

export class DocsCommand extends BaseCommand {
  readonly metadata = {
    name: "docs",
    aliases: ["documentos", "libros"],
    minRank: Rank.REGULAR,
    description: "Buscar y descargar documentos de Anna's Archive",
    usage: "/docs <búsqueda> o /docs <número>",
    isHeavyOperation: true,
  };

  constructor(
    private readonly searchAdapter: AnnasSearchAdapter,
    private readonly searchStore: SearchStore,
    private readonly queueAdapter: QueueAdapter
  ) {
    super();
  }

  protected async executeImpl(context: CommandContext): Promise<CommandResult> {
    const input = context.args.join(" ").trim();

    if (!input) {
      return {
        type: "error",
        userMessage:
          "Uso: /docs <búsqueda> para buscar, o /docs <número> para descargar.",
      };
    }

    const num = parseInt(input, 10);
    if (!Number.isNaN(num)) {
      return await this.handleDownload(context, num - 1);
    } else {
      return await this.handleSearch(context.user.phoneNumber, input);
    }
  }

  private async handleSearch(
    userId: string,
    query: string
  ): Promise<CommandResult> {
    const books = await this.searchAdapter.searchBooks(query, 5);

    if (books.length === 0) {
      return {
        type: "text",
        content: `No se encontraron resultados para "${query}".`,
      };
    }

    await this.searchStore.storePendingSearch(userId, books);

    const list = books
      .map((book, index) => {
        const sizeMatch = book.info?.match(/(\d+(?:\.\d+)?)\s*(MB|KB|GB)/i);
        const size = sizeMatch ? ` (${sizeMatch[1]} ${sizeMatch[2]})` : "";
        return `${index + 1}. ${book.title}${book.author ? ` - ${book.author}` : ""}${size}`;
      })
      .join("\n");

    return {
      type: "text",
      content: `Resultados para "${query}":\n\n${list}\n\nResponde con "/docs <número>" para descargar.`,
    };
  }

  private async handleDownload(
    context: CommandContext,
    index: number
  ): Promise<CommandResult> {
    const userId = context.user.phoneNumber;
    const pending = await this.searchStore.getPendingSearch(userId);

    if (!pending || index < 0 || index >= pending.length) {
      return {
        type: "error",
        userMessage:
          "Número inválido o no hay búsqueda pendiente. Busca primero con /docs <búsqueda>.",
      };
    }

    const book = pending[index]!;

    const info = await this.searchAdapter.getBookInfo(book.link);

    if (!info || !info.mirror) {
      return {
        type: "error",
        userMessage: "No se pudo obtener la información del libro.",
      };
    }

    const data: DocsJobData = {
      messageId: context.message.id,
      chatId: context.message.chatId,
      userId: context.user.phoneNumber,
      mirror: info.mirror,
      md5: info.md5,
      format: info.format,
      title: info.title,
      author: info.author,
    };

    await this.queueAdapter.addJob("docs", data);

    await this.searchStore.clearPendingSearch(userId);

    return {
      type: "queued",
      queueMessage: `Descargando "${info.title}"...`,
    };
  }
}

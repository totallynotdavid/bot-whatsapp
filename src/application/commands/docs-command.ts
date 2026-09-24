import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import { Rank } from "../../domain/user";
import type { CommandDeps } from "../command-deps";

export class DocsCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "docs",
    aliases: ["documentos", "libros"],
    minRank: Rank.REGULAR,
    description: "Buscar y descargar documentos de Anna's Archive",
    usage: "docs <búsqueda> o docs <número>",
    isHeavyOperation: true,
  };

  constructor(
    private readonly deps: Pick<CommandDeps, "books" | "searchCache" | "jobs">
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

    const selectedIndex = parseInt(input, 10);

    if (!Number.isNaN(selectedIndex)) {
      return await this.handleDownload(context, selectedIndex - 1);
    }

    return await this.handleSearch(context.user.phoneNumber, input);
  }

  private async handleSearch(
    userId: string,
    query: string
  ): Promise<CommandResult> {
    const books = await this.deps.books.searchBooks(query, 5);

    if (books.length === 0) {
      return {
        type: "text",
        content: `No se encontraron resultados para "${query}".`,
      };
    }

    await this.deps.searchCache.setSearchResults(userId, books);

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
    const pending = await this.deps.searchCache.getSearchResults(userId);

    if (!pending || index < 0 || index >= pending.length) {
      return {
        type: "error",
        userMessage:
          "Número inválido o no hay búsqueda pendiente. Busca primero con /docs <búsqueda>.",
      };
    }

    const book = pending[index]!;
    const bookInfo = await this.deps.books.getBookInfo(book.link);

    if (!bookInfo || !bookInfo.mirror) {
      return {
        type: "error",
        userMessage: "No se pudo obtener la información del libro.",
      };
    }

    await this.deps.jobs.enqueue("docs", {
      messageId: context.message.id,
      chatId: context.message.chatId,
      userId,
      mirror: bookInfo.mirror,
      format: bookInfo.format,
      title: bookInfo.title,
      author: bookInfo.author,
    });
    await this.deps.searchCache.clearSearchResults(userId);

    return {
      type: "queued",
      queueMessage: `📚 Descargando "${bookInfo.title}"...`,
    };
  }
}

import type { BookData, BookInfo } from "../../domain/book";

export interface BookCatalog {
  searchBooks(query: string, limit?: number): Promise<BookData[]>;
  getBookInfo(url: string): Promise<BookInfo | null>;
}

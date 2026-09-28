import type { BookData } from "../../domain/book";

export interface SearchCache {
  getSearchResults(userId: string): Promise<BookData[] | null>;
  setSearchResults(userId: string, results: BookData[]): Promise<void>;
  clearSearchResults(userId: string): Promise<void>;
}

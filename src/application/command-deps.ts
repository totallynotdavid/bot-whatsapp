import type { BookCatalog } from "./ports/book-catalog";
import type { GroupStore } from "./ports/group-store";
import type { ImageEffects } from "./ports/image-effects";
import type { ImageHost } from "./ports/image-host";
import type { JobScheduler } from "./ports/job-scheduler";
import type { MediaConverter } from "./ports/media-converter";
import type { MessageSender } from "./ports/message-sender";
import type { SearchCache } from "./ports/search-cache";
import type { TempStore } from "./ports/temp-store";
import type { TrackSearch } from "./ports/track-search";
import type { UserStore } from "./ports/user-store";
import type { CommandExecutor } from "./services/command-executor";
import type { UserService } from "./services/user-service";

export interface CommandDeps {
  readonly sender: MessageSender;
  readonly groups: GroupStore;
  readonly users: UserStore;
  readonly userService: UserService;
  readonly tempFiles: TempStore;
  readonly searchCache: SearchCache;
  readonly jobs: JobScheduler;
  readonly books: BookCatalog;
  readonly tracks: TrackSearch;
  readonly imageHost: ImageHost;
  readonly effects: ImageEffects;
  readonly converter: MediaConverter;
  readonly executor: CommandExecutor;
}

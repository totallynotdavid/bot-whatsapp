import type { Logger } from "@bot-whatsapp/whatsapp";
import type { AttendanceStore } from "./ports/attendance-store";
import type { ImageDownloader, PhotoStorage } from "./ports/photo-storage";
import type { ReplySender } from "./ports/reply-sender";

export interface CommandDeps {
  readonly sender: ReplySender;
  readonly attendance: AttendanceStore;
  readonly photos: PhotoStorage;
  readonly images: ImageDownloader;
  readonly log: Logger;
  readonly now: () => Date;
}

import type { EditEffect } from "../../domain/edit-effect";

export interface ImageEffects {
  find(name: string): EditEffect | undefined;
  // Resolves to an encoded image, or a GIF when the effect's outputFormat is
  // "gif". `avatars` are image URLs.
  render(
    effect: EditEffect,
    avatars: string[],
    extra: string[]
  ): Promise<Buffer>;
}

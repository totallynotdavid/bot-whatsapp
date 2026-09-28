import type { SupabaseClient } from "@supabase/supabase-js";
import type { PhotoStorage } from "../../application/ports/photo-storage";
import { ATTENDANCE_PHOTO } from "../../config/constants";

export class SupabasePhotoStorage implements PhotoStorage {
  constructor(private readonly client: SupabaseClient) {}

  async upload(managerNumber: string, photo: Buffer): Promise<string> {
    const path = `${managerNumber}/${crypto.randomUUID()}.${ATTENDANCE_PHOTO.EXTENSION}`;
    const bucket = this.client.storage.from(ATTENDANCE_PHOTO.BUCKET);

    const { error } = await bucket.upload(path, photo, {
      contentType: ATTENDANCE_PHOTO.CONTENT_TYPE,
      upsert: false,
    });
    if (error) {
      throw new Error(`upload to ${ATTENDANCE_PHOTO.BUCKET}: ${error.message}`);
    }

    return bucket.getPublicUrl(path).data.publicUrl;
  }
}

export const COMPLETE_EMOJI = "✅";

// A failed reply is retried with a doubling delay, so a dropped connection
// gets time to come back.
export const SEND_RETRY = {
  RETRIES: 5,
  INITIAL_DELAY_MS: 1000,
} as const;

export const ATTENDANCE_PHOTO = {
  BUCKET: "collaborators",
  CONTENT_TYPE: "image/jpeg",
  EXTENSION: "jpg",
} as const;

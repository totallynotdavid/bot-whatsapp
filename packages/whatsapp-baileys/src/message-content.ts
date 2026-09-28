import { getContentType, type proto } from "@whiskeysockets/baileys";
import type { MediaInfo, MediaType } from "@bot-whatsapp/whatsapp";

type IMessage = proto.IMessage;

const MEDIA_TYPE_BY_CONTENT_KEY: Partial<Record<string, MediaType>> = {
  imageMessage: "image",
  videoMessage: "video",
  audioMessage: "audio",
  documentMessage: "document",
};

export function extractBody(content: IMessage | null | undefined): string {
  if (!content) return "";
  if (content.conversation) return content.conversation;
  if (content.extendedTextMessage?.text)
    return content.extendedTextMessage.text;
  if (content.imageMessage) return content.imageMessage.caption ?? "";
  if (content.videoMessage) return content.videoMessage.caption ?? "";
  if (content.documentMessage) return content.documentMessage.caption ?? "";
  return "";
}

export function extractContextInfo(
  content: IMessage | null | undefined
): proto.IContextInfo | undefined {
  if (!content) return undefined;
  return (
    content.extendedTextMessage?.contextInfo ??
    content.imageMessage?.contextInfo ??
    content.videoMessage?.contextInfo ??
    content.audioMessage?.contextInfo ??
    content.documentMessage?.contextInfo ??
    content.stickerMessage?.contextInfo ??
    undefined
  );
}

export function extractMediaType(
  content: IMessage | null | undefined
): MediaType | undefined {
  const key = getContentType(content ?? undefined);
  return key ? MEDIA_TYPE_BY_CONTENT_KEY[key] : undefined;
}

// Reads the size and mimetype the message already carries, without
// downloading the file.
export function extractMediaInfo(
  content: IMessage | null | undefined
): MediaInfo | null {
  const key = getContentType(content ?? undefined);
  const media =
    key === "imageMessage"
      ? content?.imageMessage
      : key === "videoMessage"
        ? content?.videoMessage
        : key === "audioMessage"
          ? content?.audioMessage
          : key === "documentMessage"
            ? content?.documentMessage
            : undefined;
  if (!media?.mimetype) return null;
  return { sizeBytes: toNumber(media.fileLength), mimeType: media.mimetype };
}

// proto fields typed as `number | Long | null` carry a `long` package
// instance for values that may exceed 2^53; this codebase never needs that
// precision, so it is narrowed straight to `number`.
type LongLike = { toNumber(): number };

export function toDate(timestamp: number | LongLike | null | undefined): Date {
  return new Date(toNumber(timestamp) * 1000);
}

function toNumber(value: number | LongLike | null | undefined): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toNumber" in value) {
    return value.toNumber();
  }
  return 0;
}

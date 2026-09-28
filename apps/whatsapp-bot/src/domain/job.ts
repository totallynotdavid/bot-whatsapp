import { z } from "zod";

export const jobReplyTargetSchema = z.object({
  messageId: z.string().min(1),
  chatId: z.string().min(1),
  userId: z.string().min(1),
});

// Payloads outlive a deploy in Redis, so workers parse them with these
// schemas instead of trusting the enqueue-time types.
export const jobPayloadSchemas = {
  sticker: jobReplyTargetSchema.extend({
    targetMessageId: z.string().min(1),
  }),
  spotify: jobReplyTargetSchema.extend({
    query: z.string().min(1),
  }),
  docs: jobReplyTargetSchema.extend({
    mirror: z.url(),
    // Becomes the temp file's extension, so it must not carry a path.
    format: z.string().regex(/^[a-z0-9]+$/),
    title: z.string(),
    author: z.string().optional(),
  }),
};

export type JobName = keyof typeof jobPayloadSchemas;

export type JobPayload<N extends JobName> = z.infer<
  (typeof jobPayloadSchemas)[N]
>;

import type { Logger, MessageSender } from "@bot-whatsapp/whatsapp";

export type NotifySender = Pick<MessageSender, "toChatId" | "sendText">;

const NOTIFY_PATH = "/send-message";

function reply(status: number, body: Record<string, string>): Response {
  return Response.json(body, { status });
}

// POST /send-message {"text": "...", "recipientNumber": "51999999999"} sends
// a text to a phone number, or to the owner when no number is given.
export function createNotifyHandler(
  sender: NotifySender,
  ownerPhone: string,
  log: Logger
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (new URL(request.url).pathname !== NOTIFY_PATH) {
      return reply(404, { status: "not found" });
    }
    if (request.method !== "POST") {
      return reply(405, { status: "method not allowed" });
    }

    const body: unknown = await request.json().catch(() => null);
    const { text, recipientNumber = ownerPhone } =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)
        : {};

    if (
      typeof text !== "string" ||
      text.length === 0 ||
      typeof recipientNumber !== "string" ||
      !/^\d{10,15}$/.test(recipientNumber)
    ) {
      return reply(400, { status: "invalid request" });
    }

    try {
      await sender.sendText(sender.toChatId(recipientNumber), text);
      return reply(200, { status: "sent" });
    } catch (error) {
      log("error", "Could not send the requested message", {
        error: error instanceof Error ? error.message : String(error),
      });
      return reply(500, { status: "error" });
    }
  };
}

export interface NotifyServer {
  // Returns the port it listens on, which differs from the requested one when
  // that is 0.
  start(): number;
  stop(): Promise<void>;
}

export function createNotifyServer(
  handler: (request: Request) => Promise<Response>,
  host: string,
  port: number
): NotifyServer {
  let server: Bun.Server<undefined> | undefined;

  return {
    start() {
      server = Bun.serve({ hostname: host, port, fetch: handler });
      return server.port ?? port;
    },
    async stop() {
      // Forced: a graceful stop leaves keep-alive connections answering, and
      // the transport they send through is about to disconnect.
      await server?.stop(true);
      server = undefined;
    },
  };
}

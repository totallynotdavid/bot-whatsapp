import { createClient } from "@supabase/supabase-js";
import type { Logger, WhatsAppTransport } from "@bot-whatsapp/whatsapp";
import { createCommands } from "../application/commands";
import { MessageHandler } from "../application/handlers/message-handler";
import type { ReplySender } from "../application/ports/reply-sender";
import type { Config } from "../config";
import {
  createNotifyHandler,
  createNotifyServer,
  type NotifyServer,
} from "../infrastructure/http/notify-server";
import { RemoteImageDownloader } from "../infrastructure/storage/remote-image-downloader";
import { SupabaseAttendanceStore } from "../infrastructure/supabase/supabase-attendance-store";
import { SupabaseEventLog } from "../infrastructure/supabase/supabase-event-log";
import { SupabasePhotoStorage } from "../infrastructure/supabase/supabase-photo-storage";
import { withRetry } from "../lib/resilience/with-retry";

export interface Container {
  transport: WhatsAppTransport;
  sender: ReplySender;
  handler: MessageHandler;
  notifyServer: NotifyServer;
  ownerPhone: string;
}

// The only place that names a WhatsApp library: swapping WHATSAPP_TRANSPORT
// swaps the adapter package, nothing else in the app.
async function createTransport(
  config: Config,
  log: Logger
): Promise<WhatsAppTransport> {
  switch (config.WHATSAPP_TRANSPORT) {
    case "wwebjs": {
      const { createWwebjsTransport } =
        await import("@bot-whatsapp/whatsapp-wwebjs");
      return createWwebjsTransport({
        chromePath: config.CHROME_PATH,
        logger: log,
      });
    }
    case "baileys": {
      const { createBaileysTransport } =
        await import("@bot-whatsapp/whatsapp-baileys");
      return createBaileysTransport({ logger: log });
    }
  }
}

export async function buildContainer(
  config: Config,
  log: Logger
): Promise<Container> {
  // Not connected yet: lifecycle.ts connects only after onMessage is
  // registered, so no message can arrive before anything is listening.
  const transport = await createTransport(config, log);
  const sender = withRetry(transport);

  const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY, {
    auth: { persistSession: false },
  });
  const now = () => new Date();

  const commands = createCommands({
    sender,
    attendance: new SupabaseAttendanceStore(supabase),
    photos: new SupabasePhotoStorage(supabase),
    images: new RemoteImageDownloader(),
    log,
    now,
  });

  return {
    transport,
    sender,
    handler: new MessageHandler(
      commands,
      sender,
      new SupabaseEventLog(supabase),
      config.COMMAND_PREFIX,
      log,
      now
    ),
    notifyServer: createNotifyServer(
      createNotifyHandler(sender, config.OWNER_PHONE, log),
      config.HTTP_HOST,
      config.HTTP_PORT
    ),
    ownerPhone: config.OWNER_PHONE,
  };
}

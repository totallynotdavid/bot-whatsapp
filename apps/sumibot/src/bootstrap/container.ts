import { createClient } from "@supabase/supabase-js";
import type {
  Logger,
  QrHandler,
  WhatsAppTransport,
} from "@bot-whatsapp/whatsapp";
import { renderQrToTerminal } from "@bot-whatsapp/whatsapp/terminal-qr";
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
import {
  retryingImageDownloads,
  retryingMediaDownloads,
  retryingReads,
} from "../lib/resilience/with-retry";

export interface Container {
  transport: WhatsAppTransport;
  sender: ReplySender;
  handler: MessageHandler;
  notifyServer: NotifyServer;
  ownerPhone: string;
}

interface TransportOptions {
  readonly logger: Logger;
  readonly onQr: QrHandler;
}

export interface TransportFactories {
  wwebjs(
    options: TransportOptions & { chromePath?: string }
  ): Promise<WhatsAppTransport>;
  baileys(options: TransportOptions): Promise<WhatsAppTransport>;
}

const adapterFactories: TransportFactories = {
  async wwebjs(options) {
    const { createWwebjsTransport } =
      await import("@bot-whatsapp/whatsapp-wwebjs");
    return createWwebjsTransport(options);
  },
  async baileys(options) {
    const { createBaileysTransport } =
      await import("@bot-whatsapp/whatsapp-baileys");
    return createBaileysTransport(options);
  },
};

export interface ContainerOverrides {
  readonly factories?: TransportFactories;
  readonly renderQr?: QrHandler;
}

export async function buildContainer(
  config: Config,
  log: Logger,
  {
    factories = adapterFactories,
    renderQr = renderQrToTerminal,
  }: ContainerOverrides = {}
): Promise<Container> {
  const options = { logger: log, onQr: renderQr };
  const transport =
    config.WHATSAPP_TRANSPORT === "wwebjs"
      ? await factories.wwebjs({ ...options, chromePath: config.CHROME_PATH })
      : await factories.baileys(options);
  const sender = retryingMediaDownloads(transport);

  const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY, {
    auth: { persistSession: false },
  });
  const now = () => new Date();

  const commands = createCommands({
    sender,
    attendance: retryingReads(new SupabaseAttendanceStore(supabase)),
    photos: new SupabasePhotoStorage(supabase),
    images: retryingImageDownloads(new RemoteImageDownloader()),
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

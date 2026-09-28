import type { WhatsAppTransport } from "@bot-whatsapp/whatsapp";
import { createClient, type WwebjsClientOptions } from "./client";
import { WwebjsTransport } from "./transport";

export interface WwebjsTransportOptions extends WwebjsClientOptions {
  readonly commandPrefix: string;
}

export function createWwebjsTransport(
  options: WwebjsTransportOptions
): WhatsAppTransport {
  const client = createClient(options);
  return new WwebjsTransport(client, options.commandPrefix);
}

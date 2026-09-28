import {
  consoleLogger,
  type Logger,
  type WhatsAppTransport,
} from "@bot-whatsapp/whatsapp";
import { createClient, type WwebjsClientOptions } from "./client";
import { WwebjsTransport } from "./transport";

export interface WwebjsTransportOptions extends WwebjsClientOptions {
  readonly logger?: Logger;
}

export function createWwebjsTransport(
  options: WwebjsTransportOptions
): WhatsAppTransport {
  const logger = options.logger ?? consoleLogger;
  const client = createClient(options, logger);
  return new WwebjsTransport(client, logger);
}

import { logger } from "./utils/logger";
import { DatabaseService } from "./services/database";
import { WhatsAppService } from "./services/whatsapp";
import { CommandRouter } from "./core/router";
import { Dispatcher } from "./core/dispatcher";
import type { ServiceContainer } from "./types/handler";
import { Rank } from "./types/permissions";

import * as general from "./handlers/general/ping";
import { createHelpHandler } from "./handlers/general/help";

async function bootstrap() {
  logger.info("Bootstrapping Ironclad Bot...");

  const db = new DatabaseService();
  const whatsapp = new WhatsAppService();

  const services: ServiceContainer = {
    database: db,
    whatsapp: whatsapp,
    queue: null,
    ai: null,
  };

  const router = new CommandRouter();

  router.register("ping", Rank.REGULAR, general.ping, {
    description: "Check if the bot is responsive",
    aliases: ["p"],
  });

  router.register(
    "help",
    Rank.REGULAR,
    createHelpHandler(router), // Inject router into the handler
    {
      description: "Show available commands",
      usage: "help [command]",
      aliases: ["h", "menu"],
    }
  );

  const dispatcher = new Dispatcher(router, services);

  // Bind Dispatcher to WhatsApp Adapter
  // Input -> Dispatcher -> Output
  whatsapp.onMessage(async (msg) => {
    const fullUser = await db.getUser(msg.from.phoneNumber, msg.from.name);
    msg.from = fullUser;

    return dispatcher.dispatch(msg);
  });

  await whatsapp.start();
}

bootstrap().catch((err) => {
  logger.error("Fatal Bootstrap Error", err);
  process.exit(1);
});

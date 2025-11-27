import { logger } from "./utils/logger";
import { DatabaseService } from "./services/database";
import { WhatsAppService } from "./services/whatsapp";
import { CommandRouter } from "./core/router";
import { Dispatcher } from "./core/dispatcher";
import type { ServiceContainer } from "./types/handler";

async function bootstrap() {
  logger.info("Bootstrapping Ironclad Bot...");

  const db = new DatabaseService();
  const whatsapp = new WhatsAppService();

  const services: ServiceContainer = {
    database: db,
    whatsapp: whatsapp,
    queue: null, // PR #6
    ai: null, // PR #7
  };

  const router = new CommandRouter();

  const dispatcher = new Dispatcher(router, services);

  // Bind Dispatcher to WhatsApp Adapter
  // Input -> Dispatcher -> Output
  whatsapp.onMessage(async (msg) => {
    // Hydrate User Rank before dispatching
    // This ensures permissions are always up to date
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

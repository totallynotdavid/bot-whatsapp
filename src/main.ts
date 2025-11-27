import { logger } from "./utils/logger";
import { DatabaseService } from "./services/database";
import { WhatsAppService } from "./services/whatsapp";
import { QueueService } from "./services/queue";
import { mediaWorkerProcessor } from "./workers/media-worker";
import { CommandRouter } from "./core/router";
import { Dispatcher } from "./core/dispatcher";
import type { ServiceContainer } from "./types/handler";
import { Rank } from "./types/permissions";

import * as general from "./handlers/general/ping";
import { createHelpHandler } from "./handlers/general/help";
import * as groupAdmin from "./handlers/admin/group";
import * as botAdmin from "./handlers/admin/rank";

async function bootstrap() {
  logger.info("Bootstrapping Ironclad Bot...");

  const db = new DatabaseService();
  const whatsapp = new WhatsAppService();
  const queue = new QueueService();

  queue.startWorker(mediaWorkerProcessor);

  const services: ServiceContainer = {
    database: db,
    whatsapp: whatsapp,
    queue: queue,
    ai: null,
  };

  const router = new CommandRouter();

  router.register("ping", Rank.REGULAR, general.ping, {
    description: "Check status",
  });
  router.register("help", Rank.REGULAR, createHelpHandler(router), {
    description: "Show commands",
  });
  router.register("ban", Rank.ADMIN, groupAdmin.kickUser, {
    description: "Kick user",
  });
  router.register("promote", Rank.ADMIN, groupAdmin.promoteUser, {
    description: "Promote user",
  });
  router.register("addpremium", Rank.OWNER, botAdmin.addPremium, {
    description: "Give premium",
  });

  const dispatcher = new Dispatcher(router, services);

  whatsapp.onMessage(async (msg) => {
    const fullUser = await db.getUser(msg.from.phoneNumber, msg.from.name);
    msg.from = fullUser;
    return dispatcher.dispatch(msg);
  });

  await whatsapp.start();
}

bootstrap().catch((err) => {
  logger.error("Fatal bootstrap error", err);
  process.exit(1);
});

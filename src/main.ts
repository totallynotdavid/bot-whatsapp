import { logger } from "./utils/logger";
import { DatabaseService } from "./services/database";
import { WhatsAppService } from "./services/whatsapp";
import { CommandRouter } from "./core/router";
import { Dispatcher } from "./core/dispatcher";
import type { ServiceContainer } from "./types/handler";
import { Rank } from "./types/permissions";

import * as general from "./handlers/general/ping";
import { createHelpHandler } from "./handlers/general/help";
import * as groupAdmin from "./handlers/admin/group";
import * as botAdmin from "./handlers/admin/rank";

async function bootstrap() {
  logger.info("Bootstrapping bot...");

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
    description: "Check status",
  });

  router.register("help", Rank.REGULAR, createHelpHandler(router), {
    description: "Show commands",
    aliases: ["h", "menu"],
  });

  router.register("ban", Rank.ADMIN, groupAdmin.kickUser, {
    description: "Remove a user from the group",
    usage: "ban @user",
  });

  router.register("promote", Rank.ADMIN, groupAdmin.promoteUser, {
    description: "Promote a user to group admin",
    usage: "promote @user",
  });

  router.register("addpremium", Rank.OWNER, botAdmin.addPremium, {
    description: "Give premium status to a user",
    usage: "addpremium <days>",
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

import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import { Rank } from "../../domain/user";
import type { CacheRepository } from "../../infrastructure/database/repositories/cache-repository";
import { MESSAGES } from "../../i18n/es";
import { log } from "../../lib/logging/logger";

export class RefreshCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "refresh",
    aliases: [],
    minRank: Rank.OWNER,
    description: "Limpia la caché de permisos",
    usage: "refresh",
    isHeavyOperation: false,
  };

  constructor(private readonly cacheRepo: CacheRepository) {
    super();
  }

  protected async executeImpl(context: CommandContext): Promise<CommandResult> {
    await this.cacheRepo.invalidateAllPermissions();

    log("info", "Permission cache refreshed", {
      requestedBy: context.user.phoneNumber,
    });

    return {
      type: "text",
      content: MESSAGES.success.cacheRefreshed,
    };
  }
}

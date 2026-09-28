import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import { Rank, isPremiumActive } from "../../domain/user";
import type { CommandDeps } from "../command-deps";
import { MESSAGES, formatSubscriptionInfo } from "../../i18n/es";

export class SubscriptionCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "subscription",
    aliases: ["suscripcion", "sub"],
    minRank: Rank.REGULAR,
    description: "Muestra el estado de tu suscripción premium",
    usage: "subscription",
    isHeavyOperation: false,
    requiresActiveGroup: false,
  };

  constructor(private readonly deps: Pick<CommandDeps, "groups">) {
    super();
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { user } = context;

    if (!isPremiumActive(user)) {
      return {
        type: "text",
        content: MESSAGES.info.noSubscription,
      };
    }

    const groups = await this.deps.groups.findByContactNumber(user.phoneNumber);

    return {
      type: "text",
      content: formatSubscriptionInfo(user, groups),
    };
  }
}

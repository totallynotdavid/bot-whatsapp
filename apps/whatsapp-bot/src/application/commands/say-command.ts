import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import { Rank } from "../../domain/user";
import { VOICES, findVoice } from "../../domain/voice";
import type { CommandDeps } from "../command-deps";
import { MESSAGES, formatSayVoiceUsed } from "../../i18n/es";

const MAX_TEXT_LENGTH = 1000;

export class SayCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "say",
    aliases: [],
    minRank: Rank.REGULAR,
    description: "Convierte texto en una nota de voz en español",
    usage: "say [-voz] <texto> (o responde a un mensaje)",
    isHeavyOperation: true,
  };

  constructor(private readonly deps: Pick<CommandDeps, "speech">) {
    super();
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const [first = "", ...rest] = context.args;
    const voiceArg = first.startsWith("-") && first.length > 1 ? first : null;
    const words = voiceArg ? rest : context.args;
    const text = (words.join(" ") || context.message.quotedBody || "").trim();

    if (!text) {
      return { type: "text", content: `Uso: /${this.metadata.usage}` };
    }

    if (!this.deps.speech.isConfigured()) {
      return { type: "error", userMessage: MESSAGES.errors.sayUnavailable };
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return { type: "error", userMessage: MESSAGES.errors.sayTextTooLong };
    }

    const requested = voiceArg ? findVoice(voiceArg.slice(1)) : undefined;
    const voice =
      requested ?? VOICES[Math.floor(Math.random() * VOICES.length)]!;

    const filePath = await this.deps.speech.synthesize(text, voice);

    return {
      type: "media",
      filePath,
      sendAudioAsVoice: true,
      deleteAfterSend: true,
      followUpText: formatSayVoiceUsed(
        voice.name,
        voiceArg !== null && !requested
      ),
    };
  }
}

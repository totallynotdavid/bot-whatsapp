import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import { Rank } from "../../domain/user";
import type { CommandDeps } from "../command-deps";
import { LatexCompileError } from "../ports/latex-renderer";
import { MESSAGES } from "../../i18n/es";

// Typst compiles synchronously, so a timeout cannot preempt a compile
// already running. This length is what bounds worst-case render time.
const MAX_LATEX_LENGTH = 4000;

export class TexCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "tex",
    aliases: [],
    minRank: Rank.REGULAR,
    description: "Renderiza código LaTeX como imagen",
    usage: "tex <código LaTeX>",
  };

  constructor(private readonly deps: Pick<CommandDeps, "latex" | "tempFiles">) {
    super();
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const code = context.args.join(" ").trim();

    if (!code) {
      return { type: "error", userMessage: MESSAGES.errors.texMissingCode };
    }

    if (code.length > MAX_LATEX_LENGTH) {
      return { type: "error", userMessage: MESSAGES.errors.texTooLong };
    }

    try {
      const png = await this.deps.latex.render(
        `\\begin{align*} ${code} \\end{align*}`
      );
      const filePath = await this.deps.tempFiles.saveBuffer(png, "png");
      return { type: "media", filePath, deleteAfterSend: true };
    } catch (error) {
      if (error instanceof LatexCompileError) {
        return { type: "error", userMessage: MESSAGES.errors.texCompileFailed };
      }
      throw error;
    }
  }
}

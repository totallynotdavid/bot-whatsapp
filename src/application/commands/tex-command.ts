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

// Matches the legacy bot's guard: the command wraps the input in its own
// align* environment, so a user-supplied \begin{...} would nest environments
// or, for \begin{document}, break the standalone page entirely.
const BEGIN_ENVIRONMENT = /\\begin\{[a-z]*\}/;

// Typst compiles synchronously, so a timeout cannot preempt a compile
// already running; this length is what actually bounds worst-case render
// time (measured: ~4ms per 1000 chars of LaTeX for the densest constructs
// tried, so this stays well under a second even in an adversarial case).
const MAX_LATEX_LENGTH = 4000;

export class TexCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "tex",
    aliases: [],
    minRank: Rank.REGULAR,
    description: "Renderiza código LaTeX como imagen",
    usage: "tex <código LaTeX>",
    isHeavyOperation: false,
  };

  constructor(private readonly deps: Pick<CommandDeps, "latex" | "tempFiles">) {
    super();
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const code = context.args.join(" ").trim();

    if (!code) {
      return { type: "error", userMessage: MESSAGES.errors.texMissingCode };
    }

    if (BEGIN_ENVIRONMENT.test(code)) {
      return { type: "error", userMessage: MESSAGES.errors.texBeginNotAllowed };
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

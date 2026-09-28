import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { Resvg } from "@resvg/resvg-js";
import {
  LatexCompileError,
  type LatexRenderer,
} from "../../application/ports/latex-renderer";
import { TIMEOUTS } from "../../config/constants";
import { withTimeout } from "../../lib/resilience/timeout";

// mitex (vendored under ./vendor/mitex, see vendor/README.md) turns LaTeX
// into Typst markup; Typst then typesets it. Both run in-process through
// native bindings, so a render never shells out, touches the network, or
// reads a file the caller did not name.
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

const FONT_SIZE_PT = 22;
const RENDER_ZOOM = 6;

function escapeTypstString(latex: string): string {
  return latex.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export class TypstLatexRenderer implements LatexRenderer {
  private readonly compiler: NodeCompiler;

  constructor(workspace: string = MODULE_DIR) {
    this.compiler = NodeCompiler.create({ workspace });
  }

  async render(latex: string, signal?: AbortSignal): Promise<Buffer> {
    return withTimeout(
      async () => this.renderSync(latex),
      TIMEOUTS.LATEX_RENDER_MS,
      "typst-render",
      signal
    );
  }

  private renderSync(latex: string): Buffer {
    const source = [
      `#import "/vendor/mitex/lib.typ": mi`,
      `#set page(width: auto, height: auto, margin: 0.7em, fill: white)`,
      `#set text(size: ${FONT_SIZE_PT}pt)`,
      `#mi("${escapeTypstString(latex)}")`,
    ].join("\n");

    const compiled = this.compiler.compile({ mainFileContent: source });
    if (compiled.hasError()) {
      const diagnostics = compiled.takeError()?.shortDiagnostics ?? [];
      throw new LatexCompileError(JSON.stringify(diagnostics));
    }

    const svg = this.compiler.svg(compiled.result!);
    const png = new Resvg(svg, {
      fitTo: { mode: "zoom", value: RENDER_ZOOM },
    }).render();
    return png.asPng();
  }
}

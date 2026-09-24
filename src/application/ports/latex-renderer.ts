// Thrown when the LaTeX itself is unparsable or uses a command mitex does
// not support. Anything else (a crashed compiler, a broken vendor package)
// is an infrastructure failure and propagates as a plain Error instead.
export class LatexCompileError extends Error {
  constructor(reason: string) {
    super(`LaTeX compilation failed: ${reason}`);
    this.name = "LatexCompileError";
  }
}

export interface LatexRenderer {
  // Renders LaTeX math to a PNG. Throws LatexCompileError for invalid LaTeX.
  render(latex: string, signal?: AbortSignal): Promise<Buffer>;
}

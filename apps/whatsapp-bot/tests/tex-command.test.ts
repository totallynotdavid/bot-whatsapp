import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { TexCommand } from "../src/application/commands/tex-command";
import {
  LatexCompileError,
  type LatexRenderer,
} from "../src/application/ports/latex-renderer";
import { TempFileStore } from "../src/infrastructure/storage/temp-file-store";
import { MESSAGES } from "../src/i18n/es";
import { REGULAR_PHONE, dm, makeBot } from "./fixtures";

const FAKE_PNG = Buffer.from("fake-png-bytes");

class FakeLatexRenderer implements LatexRenderer {
  readonly calls: string[] = [];
  failWith: Error | null = null;

  async render(latex: string): Promise<Buffer> {
    this.calls.push(latex);
    if (this.failWith) throw this.failWith;
    return FAKE_PNG;
  }
}

function setup() {
  const latex = new FakeLatexRenderer();
  const tempFiles = new TempFileStore();
  const bot = makeBot(() => [new TexCommand({ latex, tempFiles })]);
  return { ...bot, latex, tempFiles };
}

describe("/tex command", () => {
  test("valid math is wrapped in align* and returns a media result", async () => {
    const { executor, latex, tempFiles } = setup();

    const result = await executor.execute(
      dm(REGULAR_PHONE, String.raw`/tex \frac{1}{2} + x^2`)
    );

    expect(latex.calls).toEqual([
      String.raw`\begin{align*} \frac{1}{2} + x^2 \end{align*}`,
    ]);
    expect(result).toEqual({
      type: "media",
      filePath: expect.stringMatching(/\.png$/),
      deleteAfterSend: true,
    });

    const filePath = (result as { filePath: string }).filePath;
    expect(await readFile(filePath)).toEqual(FAKE_PNG);
    await tempFiles.cleanup(filePath);
  });

  test("empty input is refused before the renderer runs", async () => {
    const { executor, latex } = setup();

    const result = await executor.execute(dm(REGULAR_PHONE, "/tex"));

    expect(result).toEqual({
      type: "error",
      userMessage: "Falta el código LaTeX.",
    });
    expect(latex.calls).toEqual([]);
  });

  test("whitespace-only input is refused the same as empty", async () => {
    const { executor, latex } = setup();

    const result = await executor.execute(dm(REGULAR_PHONE, "/tex    "));

    expect(result).toEqual({
      type: "error",
      userMessage: "Falta el código LaTeX.",
    });
    expect(latex.calls).toEqual([]);
  });

  test.each([
    String.raw`\begin{document} x \end{document}`,
    String.raw`\begin{pmatrix} 1 & 0 \\ 0 & 1 \end{pmatrix}`,
    String.raw`x + \begin{align} y \end{align}`,
  ])("a user-supplied \\begin{...} is refused: %s", async (body) => {
    const { executor, latex } = setup();

    const result = await executor.execute(dm(REGULAR_PHONE, `/tex ${body}`));

    expect(result).toEqual({
      type: "error",
      userMessage:
        "No uses \\begin{document} ni \\end{document}. No hacen falta.",
    });
    expect(latex.calls).toEqual([]);
  });

  test("input over the length limit is refused before the renderer runs", async () => {
    const { executor, latex } = setup();

    const result = await executor.execute(
      dm(REGULAR_PHONE, `/tex ${"x".repeat(4001)}`)
    );

    expect(result).toEqual({
      type: "error",
      userMessage: "El código LaTeX es demasiado largo.",
    });
    expect(latex.calls).toEqual([]);
  });

  test("invalid LaTeX gives the LaTeX-specific error, not the internal error", async () => {
    const { executor, latex } = setup();
    latex.failWith = new LatexCompileError("unknown command: \\foo");

    const result = await executor.execute(
      dm(REGULAR_PHONE, String.raw`/tex \foo{x}`)
    );

    expect(result).toEqual({
      type: "error",
      userMessage: MESSAGES.errors.texCompileFailed,
    });
  });

  test("an infrastructure failure gives the internal-error reply", async () => {
    const { executor, latex } = setup();
    latex.failWith = new Error("compiler crashed");

    const result = await executor.execute(
      dm(REGULAR_PHONE, String.raw`/tex \frac{1}{2}`)
    );

    expect(result).toEqual({
      type: "error",
      userMessage: MESSAGES.errors.internalError,
    });
  });
});

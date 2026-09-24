import { describe, expect, test } from "vitest";
import { TypstLatexRenderer } from "../src/infrastructure/latex/typst-latex-renderer";
import { LatexCompileError } from "../src/application/ports/latex-renderer";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

describe("TypstLatexRenderer", () => {
  const renderer = new TypstLatexRenderer();

  test.each([
    ["a fraction", String.raw`\frac{1}{2} + x^2`],
    [
      "a sum and an integral",
      String.raw`\sum_{i=1}^{n} x_i^2 = \int_0^\infty e^{-x} \, dx`,
    ],
    [
      "\\text and Greek letters",
      String.raw`\text{sea } \alpha + \beta = \gamma\pi`,
    ],
    // A plain literal, not String.raw: Bun's String.raw mishandles a raw
    // non-ASCII byte inside the tag (see the feedback filed for this), so a
    // real accented character has to come through a normal string here, the
    // same way it would from an actual WhatsApp message.
    [
      "accented Spanish text",
      "\\text{tambi\u00e9n hay que probar \u00f1 y \u00e1}",
    ],
  ])("renders %s to a real PNG", async (_name, latex) => {
    const png = await renderer.render(`\\begin{align*} ${latex} \\end{align*}`);
    expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    expect(png.length).toBeGreaterThan(500);
  });

  test("an unsupported command is rejected as a compile error, not a hang", async () => {
    await expect(
      renderer.render(String.raw`\begin{align*} \foobarcommand{x} \end{align*}`)
    ).rejects.toBeInstanceOf(LatexCompileError);
  });

  // mitex has no \input command in its spec, so this is rejected the same
  // way as any other unknown command: the filesystem is never touched.
  test("\\input is rejected as an unknown command, never read from disk", async () => {
    await expect(
      renderer.render(
        String.raw`\begin{align*} \input{/etc/passwd} \end{align*}`
      )
    ).rejects.toBeInstanceOf(LatexCompileError);
  });

  test("a long but in-limit input renders well under a second", async () => {
    const body = String.raw`\frac{1}{2}`.repeat(300);
    const start = Date.now();
    const png = await renderer.render(`\\begin{align*} ${body} \\end{align*}`);
    expect(Date.now() - start).toBeLessThan(1000);
    expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  });
});

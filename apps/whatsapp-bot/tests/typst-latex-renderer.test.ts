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

  // mitex has no \input command in its spec, so \input is rejected like any
  // unknown command and the filesystem is never touched.
  test.each([
    ["an unsupported command", String.raw`\foobarcommand{x}`],
    ["\\input", String.raw`\input{/etc/passwd}`],
  ])("%s is rejected as a compile error", async (_name, body) => {
    await expect(
      renderer.render(`\\begin{align*} ${body} \\end{align*}`)
    ).rejects.toBeInstanceOf(LatexCompileError);
  });

  test("render time grows about linearly with input size", async () => {
    // Use CPU time so host contention does not affect this complexity check.
    const cpuMsOf = async (repeats: number) => {
      const body = String.raw`\frac{1}{2}`.repeat(repeats);
      const timings: number[] = [];
      for (let run = 0; run < 2; run++) {
        const before = process.cpuUsage();
        const png = await renderer.render(
          `\\begin{align*} ${body} \\end{align*}`
        );
        const used = process.cpuUsage(before);
        timings.push((used.user + used.system) / 1000);
        expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
      }
      return Math.min(...timings);
    };

    await cpuMsOf(1);
    const small = await cpuMsOf(150);
    const large = await cpuMsOf(600);

    // Four times the input should take less than six times as much CPU time.
    // A quadratic path approaches sixteen times as much.
    expect(large / small).toBeLessThan(6);
  });
});

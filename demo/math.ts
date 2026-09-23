// Usage:
//   bun typst-demo.ts "Hello, *Typst*"
//   bun typst-demo.ts "$ ∫_0^∞ e^(-x^2) d x = √π / 2 $"
//
// This compiles Typst markup to an SVG image (typst-output.svg) using the
// all‑in‑one Node compiler from typst.ts.

import { writeFile } from "fs/promises";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";

async function main() {
  const text = process.argv.slice(2).join(" ").trim();

  if (!text) {
    console.error(
      'Usage:\n  bun typst-demo.ts "Your Typst markup here"\n' +
        "Example:\n  bun typst-demo.ts '#set text(size: 24pt) Hello, typst!'",
    );
    process.exit(1);
  }

  const source = `
#set page(width: auto, height: auto, margin: 10pt)
#set text(size: 18pt)
${text}
`.trimStart();

  try {
    // Create a compiler instance (all-in-one Node library)
    const $typst = NodeCompiler.create();

    // Render as SVG string
    const svg = await $typst.svg({
      mainFileContent: source,
    });

    const outPath = "typst-output.svg";
    await writeFile(outPath, svg, "utf8");

    console.log("Compiled Typst to SVG image:");
    console.log(outPath);
  } catch (err) {
    console.error("Failed to compile Typst with typst.ts:", err);
    process.exit(1);
  }
}

main();

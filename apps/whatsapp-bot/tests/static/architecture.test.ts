import { join, sep } from "node:path";
import { describe, expect, test } from "vitest";
import {
  SRC_DIR,
  describeViolations,
  importsInto,
  readSourceFiles,
  readsEnvironment,
  type SourceFile,
} from "./scan";

const INFRASTRUCTURE_DIR = join(SRC_DIR, "infrastructure");
const CONFIG_DIR = join(SRC_DIR, "config");

function sourceAt(relativePath: string, source: string): SourceFile {
  return { path: join(SRC_DIR, relativePath), source };
}

describe("layer boundaries", () => {
  const inner = [
    ...readSourceFiles(join(SRC_DIR, "domain")),
    ...readSourceFiles(join(SRC_DIR, "application")),
  ];

  test("the scan sees the inner layers", () => {
    expect(inner.length).toBeGreaterThan(20);
  });

  test("domain and application import nothing from infrastructure", () => {
    const violations = inner.flatMap((file) =>
      importsInto(file, INFRASTRUCTURE_DIR).map((specifier) => ({
        file,
        detail: `imports ${specifier}`,
      }))
    );

    expect(describeViolations(violations)).toEqual([]);
  });

  test.each([
    `import { X } from "../../infrastructure/whatsapp/sender";`,
    `import type { X } from "../../infrastructure/whatsapp/sender";`,
    `export { X } from "../../infrastructure/whatsapp/sender";`,
    `import "../../infrastructure/whatsapp/sender";`,
    `const x = await import("../../infrastructure/whatsapp/sender");`,
    `import {\n  X,\n} from "../../infrastructure";`,
  ])("an import into infrastructure is caught: %s", (source) => {
    const file = sourceAt("application/commands/x.ts", source);

    expect(importsInto(file, INFRASTRUCTURE_DIR)).toHaveLength(1);
  });

  test("imports that stay inside the inner layers, or are only mentioned in comments, pass", () => {
    const file = sourceAt(
      "application/commands/x.ts",
      [
        `import type { Y } from "../ports/message-sender";`,
        `import { z } from "zod";`,
        `// import { X } from "../../infrastructure/whatsapp/sender";`,
        `/* import { X } from "../../infrastructure/whatsapp/sender"; */`,
      ].join("\n")
    );

    expect(importsInto(file, INFRASTRUCTURE_DIR)).toEqual([]);
  });

  test("a sibling directory that merely starts with the same name is not infrastructure", () => {
    const file = sourceAt(
      "application/x.ts",
      `import { X } from "../infrastructure-notes/a";`
    );

    expect(importsInto(file, INFRASTRUCTURE_DIR)).toEqual([]);
  });
});

describe("environment access", () => {
  const files = readSourceFiles(SRC_DIR);
  const outsideConfig = files.filter(
    (file) => !file.path.startsWith(CONFIG_DIR + sep)
  );

  test("the scan sees the whole source tree and config", () => {
    expect(outsideConfig.length).toBeGreaterThan(50);
    expect(files.length).toBeGreaterThan(outsideConfig.length);
  });

  test("process.env is read only under src/config", () => {
    const violations = outsideConfig
      .filter(readsEnvironment)
      .map((file) => ({ file, detail: "reads the environment" }));

    expect(describeViolations(violations)).toEqual([]);
  });

  test.each([
    `const a = process.env.HOME;`,
    `const a = process.env["HOME"];`,
    `const a = process["env"].HOME;`,
    `const a = Bun.env.HOME;`,
    `const a = import.meta.env.HOME;`,
    `const { HOME } = process\n  .env;`,
  ])("reading the environment is caught: %s", (source) => {
    expect(readsEnvironment(sourceAt("lib/x.ts", source))).toBe(true);
  });

  test("mentions in comments and unrelated properties are not reads", () => {
    const file = sourceAt(
      "lib/x.ts",
      [
        `// process.env is read in config only`,
        `/* process.env.HOME */`,
        `const a = config.env;`,
        `process.exit(1);`,
      ].join("\n")
    );

    expect(readsEnvironment(file)).toBe(false);
  });
});

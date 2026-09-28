import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const SRC_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../src"
);

export interface SourceFile {
  readonly path: string;
  readonly source: string;
}

export function readSourceFiles(dir: string): SourceFile[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".ts"))
    .map((name) => join(dir, name))
    .map((path) => ({ path, source: readFileSync(path, "utf8") }));
}

export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const IMPORT_SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;

export function importSpecifiers(source: string): string[] {
  return [...stripComments(source).matchAll(IMPORT_SPECIFIER)].map(
    (match) => match[1]!
  );
}

// Relative imports of `file` that resolve inside `forbiddenDir`.
export function importsInto(file: SourceFile, forbiddenDir: string): string[] {
  return importSpecifiers(file.source).filter((specifier) => {
    if (!specifier.startsWith(".")) return false;
    const target = resolve(dirname(file.path), specifier);
    return target === forbiddenDir || target.startsWith(forbiddenDir + sep);
  });
}

const ENV_ACCESS =
  /\b(?:process\s*\.\s*env(?![\w$])|process\s*\[\s*["']env["']\s*\]|Bun\s*\.\s*env(?![\w$])|import\s*\.\s*meta\s*\.\s*env(?![\w$]))/;

export function readsEnvironment(file: SourceFile): boolean {
  return ENV_ACCESS.test(stripComments(file.source));
}

export function describeViolations(
  violations: readonly { file: SourceFile; detail: string }[]
): string[] {
  return violations.map(
    ({ file, detail }) => `${relative(SRC_DIR, file.path)}: ${detail}`
  );
}

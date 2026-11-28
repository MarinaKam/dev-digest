/**
 * The web app may import only types from `@devdigest/shared`. A value import
 * makes Next's webpack bundle `src/vendor/shared/index.ts`, whose `./x.js`
 * specifiers it cannot resolve: every page then fails with "Module not found",
 * while `tsc` and Vitest stay green. Keep runtime values in the client.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === "vendor" ? [] : sourceFiles(path);
    // Tests are not bundled by Next, so they may import values.
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

/**
 * Value bindings that `import`/`export … from "@devdigest/shared"` pulls in:
 * default and namespace imports, `export *`, side-effect imports, and any
 * braced name not marked `type`. `import type …` / `export type …` are skipped.
 */
function valueImports(source: string): string[] {
  const found: string[] = [];
  if (/(?:^|[;\s])import\s+["']@devdigest\/shared["']/.test(source)) found.push("(side effect)");
  const re = /\b(?:import|export)\s+(type\s+)?([^;"']*?)\s*from\s*["']@devdigest\/shared["']/g;
  for (const m of source.matchAll(re)) {
    if (m[1]) continue;
    const clause = (m[2] ?? "").trim();
    const braces = /\{([^}]*)\}/.exec(clause);
    const outside = clause.replace(/\{[^}]*\}/, "").replace(/,/g, " ").trim();
    if (outside) found.push(outside);
    const names = (braces?.[1] ?? "").split(",").map((n) => n.trim()).filter(Boolean);
    found.push(...names.filter((n) => !/^type\s/.test(n)));
  }
  return found;
}

describe("valueImports", () => {
  const from = '"@devdigest/shared"';
  it("allows type-only forms", () => {
    expect(valueImports(`import type { A } from ${from};`)).toEqual([]);
    expect(valueImports(`import { type A, type B } from ${from};`)).toEqual([]);
    expect(valueImports(`export type { A } from ${from};`)).toEqual([]);
    expect(valueImports(`import type X from ${from};`)).toEqual([]);
    expect(valueImports(`import type * as X from ${from};`)).toEqual([]);
  });
  it("flags braced value names, also mixed with type names", () => {
    expect(valueImports(`import { A, type B } from ${from};`)).toEqual(["A"]);
    expect(valueImports(`import {\n  A,\n  B,\n} from ${from};`)).toEqual(["A", "B"]);
  });
  it("flags default and namespace imports", () => {
    expect(valueImports(`import X from ${from};`)).toEqual(["X"]);
    expect(valueImports(`import * as X from ${from};`)).toEqual(["* as X"]);
    expect(valueImports(`import X, { type A, B } from ${from};`)).toEqual(["X", "B"]);
  });
  it("flags re-exports of values", () => {
    expect(valueImports(`export { A } from ${from};`)).toEqual(["A"]);
    expect(valueImports(`export * from ${from};`)).toEqual(["*"]);
    expect(valueImports(`export { type A, B } from ${from};`)).toEqual(["B"]);
  });
  it("flags a side-effect import and ignores other packages", () => {
    expect(valueImports(`import ${from};`)).toEqual(["(side effect)"]);
    expect(valueImports(`import X from "other"; import { A } from "@devdigest/ui";`)).toEqual([]);
  });
});

describe("imports from @devdigest/shared", () => {
  it("are type-only everywhere outside src/vendor", () => {
    const offenders = sourceFiles(SRC)
      .map((file) => ({ file, names: valueImports(readFileSync(file, "utf8")) }))
      .filter((r) => r.names.length > 0)
      .map((r) => `${r.file.slice(SRC.length + 1)}: ${r.names.join(", ")}`);
    expect(offenders).toEqual([]);
  });
});

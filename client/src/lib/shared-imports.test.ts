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

/** `import { … } from "@devdigest/shared"` where any name is not marked `type`. */
function valueImports(source: string): string[] {
  const found: string[] = [];
  const re = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+["']@devdigest\/shared["']/g;
  for (const m of source.matchAll(re)) {
    if (m[1]) continue;
    const names = (m[2] ?? "").split(",").map((n) => n.trim()).filter(Boolean);
    found.push(...names.filter((n) => !n.startsWith("type ")));
  }
  return found;
}

describe("imports from @devdigest/shared", () => {
  it("are type-only everywhere outside src/vendor", () => {
    const offenders = sourceFiles(SRC)
      .map((file) => ({ file, names: valueImports(readFileSync(file, "utf8")) }))
      .filter((r) => r.names.length > 0)
      .map((r) => `${r.file.slice(SRC.length + 1)}: ${r.names.join(", ")}`);
    expect(offenders).toEqual([]);
  });
});

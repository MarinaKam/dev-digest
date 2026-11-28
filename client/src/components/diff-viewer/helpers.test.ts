import { describe, it, expect } from "vitest";
import { parsePatch } from "./helpers";

describe("parsePatch", () => {
  it("returns no lines for a file without a patch", () => {
    expect(parsePatch(null)).toEqual([]);
    expect(parsePatch(undefined)).toEqual([]);
    expect(parsePatch("")).toEqual([]);
  });

  it("numbers added, deleted and context lines from the hunk header", () => {
    const patch = "@@ -10,3 +20,4 @@\n keep\n-old\n+new\n+extra\n tail";
    expect(parsePatch(patch)).toEqual([
      { kind: "hunk", text: "@@ -10,3 +20,4 @@" },
      { kind: "ctx", text: "keep", oldNo: 10, newNo: 20 },
      { kind: "del", text: "old", oldNo: 11 },
      { kind: "add", text: "new", newNo: 21 },
      { kind: "add", text: "extra", newNo: 22 },
      { kind: "ctx", text: "tail", oldNo: 12, newNo: 23 },
    ]);
  });

  it("restarts the numbering at every hunk", () => {
    const lines = parsePatch("@@ -1 +1 @@\n-a\n+b\n@@ -40,2 +41,2 @@\n c");
    expect(lines.at(-1)).toEqual({ kind: "ctx", text: "c", oldNo: 40, newNo: 41 });
  });

  it("keeps a hunk header without a line count", () => {
    expect(parsePatch("@@ -5 +7 @@\n+x")[1]).toEqual({ kind: "add", text: "x", newNo: 7 });
  });
});

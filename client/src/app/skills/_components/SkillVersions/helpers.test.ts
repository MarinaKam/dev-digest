import { describe, it, expect } from "vitest";
import { diffPrefix, hasChanges, lineDiff } from "./helpers";

describe("lineDiff", () => {
  it("marks identical texts as all same", () => {
    const diff = lineDiff("a\nb", "a\nb");
    expect(diff).toEqual([
      { kind: "same", text: "a" },
      { kind: "same", text: "b" },
    ]);
    expect(hasChanges(diff)).toBe(false);
  });

  it("marks a line only in the old text as removed and only in the new as added", () => {
    const diff = lineDiff("keep\nold\nend", "keep\nnew\nend");
    expect(diff).toEqual([
      { kind: "same", text: "keep" },
      { kind: "removed", text: "old" },
      { kind: "added", text: "new" },
      { kind: "same", text: "end" },
    ]);
    expect(hasChanges(diff)).toBe(true);
  });

  it("handles a line added at the end and one removed at the start", () => {
    expect(lineDiff("a", "a\nb")).toEqual([
      { kind: "same", text: "a" },
      { kind: "added", text: "b" },
    ]);
    expect(lineDiff("x\na", "a")).toEqual([
      { kind: "removed", text: "x" },
      { kind: "same", text: "a" },
    ]);
  });

  it("keeps the longest common run when lines move", () => {
    const diff = lineDiff("a\nb\nc\nd", "b\nc\nd\na");
    expect(diff.filter((l) => l.kind === "same").map((l) => l.text)).toEqual(["b", "c", "d"]);
    expect(diff.filter((l) => l.kind === "removed")).toEqual([{ kind: "removed", text: "a" }]);
    expect(diff.filter((l) => l.kind === "added")).toEqual([{ kind: "added", text: "a" }]);
  });

  it("diffs against an empty text", () => {
    expect(lineDiff("", "x")).toEqual([
      { kind: "removed", text: "" },
      { kind: "added", text: "x" },
    ]);
  });
});

describe("diffPrefix", () => {
  it("prints - for removed, + for added and a space otherwise", () => {
    expect(diffPrefix("removed")).toBe("-");
    expect(diffPrefix("added")).toBe("+");
    expect(diffPrefix("same")).toBe(" ");
  });
});

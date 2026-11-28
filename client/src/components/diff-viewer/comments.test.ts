import { describe, it, expect } from "vitest";
import type { PrReviewComment } from "@devdigest/shared";
import {
  buildThreads,
  commentTargetFor,
  keysForLine,
  lineKey,
  partitionThreads,
} from "./comments";

function comment(o: Partial<PrReviewComment> & { id: number }): PrReviewComment {
  return {
    in_reply_to_id: null,
    path: "src/a.ts",
    line: 5,
    side: "RIGHT",
    body: "note",
    user: "ada",
    created_at: "2026-06-01T10:00:00Z",
    html_url: "https://example.test/c",
    ...o,
  } as PrReviewComment;
}

describe("lineKey", () => {
  it("joins side and line, and has no key for a missing line", () => {
    expect(lineKey("RIGHT", 7)).toBe("RIGHT:7");
    expect(lineKey("LEFT", null)).toBeNull();
    expect(lineKey("LEFT", undefined)).toBeNull();
  });
});

describe("buildThreads", () => {
  it("groups replies under their root, oldest first", () => {
    const threads = buildThreads([
      comment({ id: 2, in_reply_to_id: 1, created_at: "2026-06-01T12:00:00Z" }),
      comment({ id: 1, created_at: "2026-06-01T10:00:00Z" }),
      comment({ id: 3, in_reply_to_id: 1, created_at: "2026-06-01T11:00:00Z" }),
    ]);
    expect(threads).toHaveLength(1);
    expect(threads[0]!.rootId).toBe(1);
    expect(threads[0]!.comments.map((c) => c.id)).toEqual([1, 3, 2]);
  });

  it("anchors a thread on its root's line and side", () => {
    const [thread] = buildThreads([comment({ id: 1, line: 9, side: "LEFT" })]);
    expect(thread).toMatchObject({ line: 9, side: "LEFT", isOutdated: false });
  });

  it("marks a thread whose root lost its line as outdated", () => {
    const [thread] = buildThreads([comment({ id: 1, line: null })]);
    expect(thread).toMatchObject({ line: null, isOutdated: true });
  });

  it("still builds a thread when the root comment itself is missing", () => {
    const [thread] = buildThreads([comment({ id: 2, in_reply_to_id: 1, line: 4 })]);
    expect(thread).toMatchObject({ rootId: 1, line: 4 });
  });
});

describe("keysForLine and commentTargetFor", () => {
  it("an added line is commented on the new side", () => {
    const ln = { kind: "add", text: "x", newNo: 3 } as const;
    expect(keysForLine(ln)).toEqual(["RIGHT:3"]);
    expect(commentTargetFor(ln)).toEqual({ line: 3, side: "RIGHT" });
  });

  it("a deleted line is commented on the old side", () => {
    const ln = { kind: "del", text: "x", oldNo: 8 } as const;
    expect(keysForLine(ln)).toEqual(["LEFT:8"]);
    expect(commentTargetFor(ln)).toEqual({ line: 8, side: "LEFT" });
  });

  it("a context line hosts threads of both sides and takes new comments on the new side", () => {
    const ln = { kind: "ctx", text: "x", oldNo: 8, newNo: 9 } as const;
    expect(keysForLine(ln)).toEqual(["RIGHT:9", "LEFT:8"]);
    expect(commentTargetFor(ln)).toEqual({ line: 9, side: "RIGHT" });
  });

  it("a hunk header takes no comments", () => {
    const ln = { kind: "hunk", text: "@@ -1 +1 @@" } as const;
    expect(keysForLine(ln)).toEqual([]);
    expect(commentTargetFor(ln)).toBeNull();
  });
});

describe("partitionThreads", () => {
  it("keeps threads on rendered lines and sets the rest aside as outdated", () => {
    const threads = buildThreads([
      comment({ id: 1, line: 5, side: "RIGHT" }),
      comment({ id: 2, line: 5, side: "RIGHT" }),
      comment({ id: 3, line: 99, side: "RIGHT" }),
      comment({ id: 4, line: null }),
    ]);
    const { matched, outdated } = partitionThreads(threads, new Set(["RIGHT:5"]));
    expect(matched.get("RIGHT:5")!.map((t) => t.rootId)).toEqual([1, 2]);
    expect(outdated.map((t) => t.rootId)).toEqual([3, 4]);
  });
});

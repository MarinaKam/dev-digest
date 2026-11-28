import { describe, it, expect } from "vitest";
import type { Skill } from "@devdigest/shared";
import { fileToBase64, skillCountsByAgent } from "./skills";

const skill = (id: string, usedBy: string[]): Skill => ({
  id,
  name: id,
  description: "d",
  type: "rubric",
  source: "manual",
  body: "b",
  enabled: true,
  version: 1,
  used_by: usedBy.map((a) => ({ id: a, name: a })),
});

describe("skillCountsByAgent", () => {
  it("counts every skill an agent links", () => {
    const counts = skillCountsByAgent([skill("s1", ["a1", "a2"]), skill("s2", ["a1"]), skill("s3", [])]);
    expect(counts.get("a1")).toBe(2);
    expect(counts.get("a2")).toBe(1);
    expect(counts.has("a3")).toBe(false);
  });

  it("is empty without skills", () => {
    expect(skillCountsByAgent(undefined).size).toBe(0);
  });
});

describe("fileToBase64", () => {
  it("encodes the file's bytes, not its text", async () => {
    const file = new File([new Uint8Array([0, 255, 104, 105])], "x.zip");
    expect(await fileToBase64(file)).toBe(btoa(String.fromCharCode(0, 255, 104, 105)));
  });
});

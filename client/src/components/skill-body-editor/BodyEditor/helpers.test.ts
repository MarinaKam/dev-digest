import { describe, it, expect } from "vitest";
import { countLines, estimateTokens } from "./helpers";

describe("estimateTokens", () => {
  it("is the character count over four, rounded up", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});

describe("countLines", () => {
  it("counts an empty text as one line", () => {
    expect(countLines("")).toBe(1);
    expect(countLines("a\nb\nc")).toBe(3);
  });
});

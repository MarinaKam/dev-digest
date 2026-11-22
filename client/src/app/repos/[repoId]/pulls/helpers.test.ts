import { describe, it, expect } from "vitest";
import { formatCost, formatTokensCompact } from "./helpers";

describe("formatCost", () => {
  it("renders an em dash when there is no cost data", () => {
    expect(formatCost(null)).toBe("—");
    expect(formatCost(undefined)).toBe("—");
  });

  it("renders a real zero as a price, not as missing data", () => {
    expect(formatCost(0)).toBe("$0.00");
    expect(formatCost(0)).not.toBe(formatCost(null));
  });

  it.each([
    [0.0004, "$0.0004"],
    [0.000412, "$0.000412"],
    [0.0013, "$0.0013"],
    [0.014, "$0.014"],
    [0.01234, "$0.0123"],
    [0.06, "$0.060"],
    [0.5, "$0.500"],
    [0.9996, "$1.00"],
    [1.5, "$1.50"],
    [12.345, "$12.35"],
  ])("formats %s as %s", (usd, expected) => {
    expect(formatCost(usd)).toBe(expected);
  });

  it("never collapses a tiny non-zero cost to zero", () => {
    expect(formatCost(0.0004)).not.toBe("$0.000");
    expect(formatCost(0.00000123)).toBe("$0.00000123");
  });

  it("renders an em dash for a value that is not a finite, non-negative number", () => {
    expect(formatCost(Number.NaN)).toBe("—");
    expect(formatCost(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatCost(-0.01)).toBe("—");
  });
});

describe("formatTokensCompact", () => {
  it("formats in→out in thousands with one decimal", () => {
    expect(formatTokensCompact(8200, 1300)).toBe("8.2K→1.3K");
    expect(formatTokensCompact(9119, 1240)).toBe("9.1K→1.2K");
    expect(formatTokensCompact(0, 0)).toBe("0.0K→0.0K");
  });
});

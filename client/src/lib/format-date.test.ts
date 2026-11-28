import { describe, it, expect } from "vitest";
import { formatDateTime, formatTime } from "./format-date";

describe("formatDateTime", () => {
  it("formats a timestamp in the user's locale", () => {
    const iso = "2026-06-11T18:44:34.000Z";
    expect(formatDateTime(iso)).toBe(new Date(iso).toLocaleString());
  });

  it("returns a value it cannot parse unchanged", () => {
    expect(formatDateTime("yesterday")).toBe("yesterday");
  });
});

describe("formatTime", () => {
  it("formats the time of day in the user's locale", () => {
    const iso = "2026-06-11T18:44:34.000Z";
    expect(formatTime(iso)).toBe(new Date(iso).toLocaleTimeString());
  });

  it.each([[null], [undefined], [""], ["not a date"]])("gives an empty string for %j", (value) => {
    expect(formatTime(value)).toBe("");
  });
});

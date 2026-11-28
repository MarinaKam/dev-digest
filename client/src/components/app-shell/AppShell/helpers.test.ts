import { describe, it, expect } from "vitest";
import { activeKeyFor, followsActiveRepo } from "./helpers";

describe("followsActiveRepo", () => {
  it("is true only for pages without a repo id in the URL that use the active repo", () => {
    expect(followsActiveRepo("/conventions")).toBe(true);
    expect(followsActiveRepo("/conventions/anything")).toBe(true);
    expect(followsActiveRepo("/repos/r1/pulls")).toBe(false);
    expect(followsActiveRepo("/skills")).toBe(false);
    expect(followsActiveRepo("/conventions-old")).toBe(false);
  });
});

describe("activeKeyFor", () => {
  it("highlights Conventions on /conventions", () => {
    expect(activeKeyFor("/conventions")).toBe("conventions");
  });
});

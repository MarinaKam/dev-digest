import { describe, it, expect } from "vitest";
import { withCurrentModel } from "./helpers";

describe("withCurrentModel", () => {
  it("leaves the list as is when it already holds the model", () => {
    expect(withCurrentModel(["a", "b"], "b")).toEqual(["a", "b"]);
    expect(withCurrentModel([{ value: "a", label: "A" }], "a")).toEqual([{ value: "a", label: "A" }]);
  });

  it("puts a model the provider does not list first", () => {
    expect(withCurrentModel(["a"], "custom")).toEqual(["custom", "a"]);
    expect(withCurrentModel([], "custom")).toEqual(["custom"]);
  });

  it("does not change the list it was given", () => {
    const options = ["a"];
    withCurrentModel(options, "custom");
    expect(options).toEqual(["a"]);
  });
});

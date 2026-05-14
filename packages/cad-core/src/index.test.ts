import { describe, expect, it } from "vitest";
import { corePackage } from "./index";

describe("cad-core placeholder", () => {
  it("exports package status", () => {
    expect(corePackage).toEqual({
      name: "@web-cad/cad-core",
      status: "ready"
    });
  });
});

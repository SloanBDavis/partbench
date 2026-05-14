import { describe, expect, it } from "vitest";
import { rendererPackage } from "./index";

describe("renderer placeholder", () => {
  it("exports package status", () => {
    expect(rendererPackage).toEqual({
      name: "@web-cad/renderer",
      status: "ready"
    });
  });
});

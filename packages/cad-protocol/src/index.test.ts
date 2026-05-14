import { describe, expect, it } from "vitest";
import { protocolPackage } from "./index";

describe("cad-protocol placeholder", () => {
  it("exports package status", () => {
    expect(protocolPackage).toEqual({
      name: "@web-cad/cad-protocol",
      status: "ready"
    });
  });
});

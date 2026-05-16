import { describe, expect, it } from "vitest";
import { formatDimensionFieldLabel } from "./fieldLabels";

describe("FormFields", () => {
  it("formats dimension labels for modeling forms", () => {
    expect(formatDimensionFieldLabel("width", "mm")).toBe("Width (mm)");
    expect(formatDimensionFieldLabel("majorRadius", "in")).toBe(
      "Major radius (in)"
    );
    expect(formatDimensionFieldLabel("minorRadius")).toBe("Minor radius");
  });
});

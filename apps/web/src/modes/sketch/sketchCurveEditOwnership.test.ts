import { describe, expect, it } from "vitest";
import { getSketchCurveEditOwnershipPolicy } from "./sketchCurveEditOwnership";

describe("V19 curve-edit UI ownership", () => {
  it("guards navigation and suppresses parallel source mutations while dirty", () => {
    expect(
      getSketchCurveEditOwnershipPolicy({ active: true, dirty: true })
    ).toEqual({
      guardNavigation: true,
      closeBeforeCleanNavigation: false,
      suppressTreeSourceMutations: true,
      suppressContextSourceMutations: true
    });
  });

  it("preserves clean navigation after closing the clean editor", () => {
    expect(
      getSketchCurveEditOwnershipPolicy({ active: true, dirty: false })
    ).toEqual({
      guardNavigation: false,
      closeBeforeCleanNavigation: true,
      suppressTreeSourceMutations: false,
      suppressContextSourceMutations: true
    });
    expect(
      getSketchCurveEditOwnershipPolicy({ active: false, dirty: false })
    ).toEqual({
      guardNavigation: false,
      closeBeforeCleanNavigation: false,
      suppressTreeSourceMutations: false,
      suppressContextSourceMutations: false
    });
  });
});

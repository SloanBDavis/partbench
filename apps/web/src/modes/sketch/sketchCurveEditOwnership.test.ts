import { describe, expect, it } from "vitest";
import {
  getSketchCurveEditOwnershipPolicy,
  getSketchEditorActionNotice
} from "./sketchCurveEditOwnership";

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

  it("uses intent-specific review copy for the shared editor ownership path", () => {
    expect(getSketchEditorActionNotice("intent")).toBe(
      "Choose targets and values, review measurement and solver state, then Apply."
    );
    expect(getSketchEditorActionNotice("curve")).toContain(
      "geometry and constraint consequences"
    );
    expect(
      getSketchEditorActionNotice("intent", "sketch.point-line-distance")
    ).toBe(
      "Set up point line distance: choose targets and values, review measurement and solver state, then Apply."
    );
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

import type {
  SketchConstraintEntry,
  SketchDimensionEntryV22,
  SketchEntitySnapshot
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import {
  getSketchConstraintKindFeasibility,
  getSketchDimensionFamilyFeasibility
} from "./sketchIntentAvailability";
import {
  createDefaultDimensionDraftV19,
  getConstraintCreationAvailabilityV19,
  getDimensionCreationAvailabilityV19
} from "./modes/sketch/sketchIntentEditorModel";

describe("V19 shared sketch intent availability", () => {
  it("rejects aligned and parallel relational domains without family fallback", () => {
    const aligned: readonly SketchEntitySnapshot[] = [
      {
        id: "vertical_1",
        kind: "line",
        start: [0, 0],
        end: [0, 4],
        construction: false
      },
      {
        id: "vertical_2",
        kind: "line",
        start: [2, 0],
        end: [2, 4],
        construction: false
      }
    ];
    expect(
      getSketchDimensionFamilyFeasibility("horizontalDistance", [aligned[0]!])
        .available
    ).toBe(false);
    expect(
      createDefaultDimensionDraftV19(
        [aligned[0]!],
        undefined,
        "horizontalDistance"
      )
    ).toBeUndefined();
    expect(
      getSketchDimensionFamilyFeasibility("lineAngle", aligned).available
    ).toBe(false);
    expect(
      createDefaultDimensionDraftV19(aligned, undefined, "lineAngle")
    ).toBeUndefined();
  });

  it("blocks exhausted duplicate dimension and constraint targets", () => {
    const circle: SketchEntitySnapshot = {
      id: "circle_1",
      kind: "circle",
      center: [0, 0],
      radius: 2,
      construction: false
    };
    const diameter: SketchDimensionEntryV22 = {
      sourceShape: "v22",
      id: "diameter_1",
      name: "Diameter",
      sketchId: "sketch_1",
      target: {
        kind: "entityScalar",
        entityId: "circle_1",
        entityKind: "circle",
        role: "diameter"
      },
      valueSource: { type: "literal", value: 4 },
      effectiveValue: 4,
      status: "healthy",
      issues: []
    };
    expect(
      getDimensionCreationAvailabilityV19("radius", [circle], "circle_1", [
        diameter
      ]).status
    ).toBe("blocked");

    const lines: readonly SketchEntitySnapshot[] = [
      {
        id: "line_1",
        kind: "line",
        start: [0, 0],
        end: [4, 0],
        construction: false
      },
      {
        id: "line_2",
        kind: "line",
        start: [0, 2],
        end: [4, 2],
        construction: false
      }
    ];
    const parallel: SketchConstraintEntry = {
      id: "parallel_1",
      name: "Parallel",
      sketchId: "sketch_1",
      entityId: "line_2",
      kind: "parallel",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2",
      status: "healthy",
      issues: []
    };
    expect(
      getSketchConstraintKindFeasibility("parallel", lines).available
    ).toBe(true);
    expect(
      getConstraintCreationAvailabilityV19("perpendicular", lines, "line_1", [
        parallel
      ]).status
    ).toBe("blocked");
  });
});

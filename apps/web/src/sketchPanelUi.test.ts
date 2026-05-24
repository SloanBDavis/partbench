import { describe, expect, it } from "vitest";
import type {
  CadBodySnapshot,
  CadFeatureSummary,
  SketchConstraintEntry,
  SketchDimensionEntry,
  SketchEvaluationQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import {
  chooseSketchEntitySelection,
  chooseSketchPanelSelection,
  createAvailableCoincidentPointTargetOptions,
  createAvailableFixedPointTargetOptions,
  createAvailableSketchDimensionTargetOptions,
  createAvailableSketchConstraintKindOptions,
  createAddTargetBodyOptions,
  createCutTargetBodyOptions,
  createParameterBindingOptions,
  createSketchPointTargetOptionsForEntity,
  createSketchDimensionTargetOptions,
  formatSketchPointCoordinate,
  formatSketchPointTarget,
  formatSketchDimensionEffectiveValue,
  formatSketchConstraintStatus,
  formatSketchDimensionStatus,
  formatSketchDimensionValueSource,
  formatSketchEvaluationIssue,
  formatSketchEvaluationStatus,
  getAddOperationStatus,
  getCutOperationStatus,
  getDefaultSketchEntityKind,
  getParameterDimensionUsageCount,
  getSketchConstraintKindLabel,
  getSketchConstraintStatusDisplay,
  getSketchDimensionStatusDisplay,
  getSketchDimensionTargetLabel,
  getSketchDimensionTargetValue,
  getSketchEntityOptionLabel,
  getSketchEvaluationStatusDisplay,
  isSketchConstraintRelatedToEntity,
  isExtrudableSketchEntity
} from "./sketchPanelUi";

describe("sketch panel UI helpers", () => {
  it("focuses a newly created sketch when there is no current selection", () => {
    const sketches = [createSketch("sketch_1"), createSketch("sketch_face_1")];

    expect(
      chooseSketchPanelSelection(sketches, undefined, "sketch_face_1")
    ).toBe("sketch_face_1");
  });

  it("keeps current selection before focus and falls back when focus is stale", () => {
    const sketches = [createSketch("sketch_1"), createSketch("sketch_2")];

    expect(chooseSketchPanelSelection(sketches, "sketch_2", "sketch_1")).toBe(
      "sketch_2"
    );
    expect(
      chooseSketchPanelSelection(sketches, "sketch_2", "missing_sketch")
    ).toBe("sketch_2");
    expect(
      chooseSketchPanelSelection(sketches, "missing_sketch", undefined)
    ).toBe("sketch_1");
    expect(chooseSketchPanelSelection([], "sketch_1", "sketch_2")).toBe(
      undefined
    );
  });

  it("defaults empty attached sketches to rectangle entity creation", () => {
    expect(getDefaultSketchEntityKind(createSketch("sketch_1"))).toBe("point");
    expect(
      getDefaultSketchEntityKind(
        createSketch("sketch_face_1", {
          attachment: {
            kind: "generatedFace",
            bodyId: "body_1",
            faceStableId: "generated:face:body_1:endCap",
            sourceFeatureId: "feat_1",
            sourceSketchId: "sketch_1",
            sourceSketchEntityId: "rect_1",
            faceRole: "endCap"
          }
        })
      )
    ).toBe("rectangle");
    expect(
      getDefaultSketchEntityKind(
        createSketch("sketch_face_1", {
          attachment: {
            kind: "generatedFace",
            bodyId: "body_1",
            faceStableId: "generated:face:body_1:endCap",
            sourceFeatureId: "feat_1",
            sourceSketchId: "sketch_1",
            sourceSketchEntityId: "rect_1",
            faceRole: "endCap"
          },
          entities: [
            {
              id: "circle_1",
              kind: "circle",
              center: [0, 0],
              radius: 1
            }
          ]
        })
      )
    ).toBe("point");
  });

  it("keeps selected entities compact and falls back when stale", () => {
    const entities: SketchSnapshot["entities"] = [
      {
        id: "rect_1",
        kind: "rectangle",
        center: [0, 0],
        width: 4,
        height: 2
      },
      { id: "circle_1", kind: "circle", center: [1, 1], radius: 2 }
    ];

    expect(chooseSketchEntitySelection(entities, "circle_1")).toBe("circle_1");
    expect(chooseSketchEntitySelection(entities, "missing")).toBe("rect_1");
    expect(chooseSketchEntitySelection([], "missing")).toBeUndefined();
    expect(getSketchEntityOptionLabel(entities[0])).toBe(
      "rect_1 / rectangle 4 x 2"
    );
    expect(getSketchEntityOptionLabel(entities[1])).toBe(
      "circle_1 / circle r 2"
    );
    expect(isExtrudableSketchEntity(entities[0])).toBe(true);
    expect(isExtrudableSketchEntity(entities[1])).toBe(true);
    expect(
      isExtrudableSketchEntity({
        id: "point_1",
        kind: "point",
        point: [0, 0]
      })
    ).toBe(false);
  });

  it("derives sketch constraint options and status display", () => {
    const line: SketchSnapshot["entities"][number] = {
      id: "line_1",
      kind: "line",
      start: [0, 0],
      end: [3, 4]
    };
    const rectangle: SketchSnapshot["entities"][number] = {
      id: "rect_1",
      kind: "rectangle",
      center: [0, 0],
      width: 4,
      height: 2
    };
    const circle: SketchSnapshot["entities"][number] = {
      id: "circle_1",
      kind: "circle",
      center: [7, 8],
      radius: 2
    };
    const point: SketchSnapshot["entities"][number] = {
      id: "point_1",
      kind: "point",
      point: [5, 6]
    };
    const horizontalConstraint = {
      id: "con_horizontal",
      name: "Horizontal",
      sketchId: "sketch_1",
      entityId: "line_1",
      kind: "horizontal" as const,
      status: "healthy" as const,
      issues: []
    };
    const fixedConstraint = {
      id: "fix_start",
      name: "Fixed start",
      sketchId: "sketch_1",
      entityId: "line_1",
      kind: "fixed" as const,
      target: { entityId: "line_1", role: "start" as const },
      coordinate: [0, 0] as const,
      currentCoordinate: [0, 0] as const,
      status: "healthy" as const,
      issues: []
    };
    const coincidentConstraint = {
      id: "co_start_point",
      name: "Start to point",
      sketchId: "sketch_1",
      entityId: "line_1",
      kind: "coincident" as const,
      primaryTarget: { entityId: "line_1", role: "start" as const },
      secondaryTarget: { entityId: "point_1", role: "position" as const },
      status: "healthy" as const,
      issues: []
    };
    const midpointConstraint: SketchConstraintEntry = {
      id: "mid_point",
      name: "Line midpoint",
      sketchId: "sketch_1",
      entityId: "line_1",
      kind: "midpoint",
      lineEntityId: "line_1",
      target: { entityId: "point_1", role: "position" },
      currentCoordinate: [1.5, 2],
      resolvedCoordinate: [1.5, 2],
      status: "healthy",
      issues: []
    };
    const invalidConstraint = {
      ...horizontalConstraint,
      status: "invalid-value" as const,
      issues: [
        {
          code: "INVALID_VALUE" as const,
          message: "Line constraint target cannot be zero length.",
          sketchConstraintId: "con_horizontal"
        }
      ]
    };
    const missingConstraint: SketchConstraintEntry = {
      id: "fix_missing",
      name: "Missing fixed",
      sketchId: "sketch_1",
      entityId: "missing_point",
      kind: "fixed",
      target: { entityId: "missing_point", role: "position" },
      coordinate: [0, 0],
      status: "missing-target",
      issues: [
        {
          code: "SKETCH_ENTITY_NOT_FOUND",
          message: "Sketch entity does not exist: missing_point",
          sketchConstraintId: "fix_missing",
          sketchEntityId: "missing_point"
        }
      ]
    };
    const unsupportedConstraint: SketchConstraintEntry = {
      id: "fix_bad_role",
      name: "Bad fixed",
      sketchId: "sketch_1",
      entityId: "point_1",
      kind: "fixed",
      target: { entityId: "point_1", role: "start" },
      coordinate: [0, 0],
      status: "unsupported",
      issues: [
        {
          code: "UNSUPPORTED_TARGET",
          message:
            "Fixed sketch constraint target role is not supported for this entity.",
          sketchConstraintId: "fix_bad_role",
          sketchEntityId: "point_1"
        }
      ]
    };
    const inconsistentConstraint: SketchConstraintEntry = {
      id: "co_conflict",
      name: "Conflict",
      sketchId: "sketch_1",
      entityId: "line_1",
      kind: "coincident",
      primaryTarget: { entityId: "line_1", role: "start" },
      secondaryTarget: { entityId: "point_1", role: "position" },
      status: "inconsistent",
      issues: [
        {
          code: "INCONSISTENT_CONSTRAINT",
          message:
            "Coincident sketch constraint cannot satisfy two different fixed coordinates.",
          sketchConstraintId: "co_conflict"
        }
      ]
    };
    const conflictingConstraint: SketchConstraintEntry = {
      id: "con_vertical",
      name: "Vertical",
      sketchId: "sketch_1",
      entityId: "line_1",
      kind: "vertical",
      status: "inconsistent",
      issues: [
        {
          code: "CONFLICTING_CONSTRAINT",
          message:
            "Line has a conflicting horizontal constraint: con_horizontal.",
          sketchConstraintId: "con_vertical"
        }
      ]
    };

    expect(
      createSketchPointTargetOptionsForEntity(line).map(
        (option) => option.label
      )
    ).toEqual(["line_1 start", "line_1 end"]);
    expect(createSketchPointTargetOptionsForEntity(point)).toEqual([
      {
        target: { entityId: "point_1", role: "position" },
        label: "point_1 position",
        detail: "Point position",
        coordinate: [5, 6]
      }
    ]);
    expect(createSketchPointTargetOptionsForEntity(rectangle)).toEqual([
      {
        target: { entityId: "rect_1", role: "center" },
        label: "rect_1 center",
        detail: "Rectangle center",
        coordinate: [0, 0]
      }
    ]);
    expect(createSketchPointTargetOptionsForEntity(circle)).toEqual([
      {
        target: { entityId: "circle_1", role: "center" },
        label: "circle_1 center",
        detail: "Circle center",
        coordinate: [7, 8]
      }
    ]);
    expect(
      createAvailableSketchConstraintKindOptions(line, [], [line, point])
    ).toEqual([
      { kind: "horizontal", label: "Horizontal" },
      { kind: "vertical", label: "Vertical" },
      { kind: "fixed", label: "Fixed point" },
      { kind: "coincident", label: "Coincident" }
    ]);
    expect(
      createAvailableSketchConstraintKindOptions(
        line,
        [horizontalConstraint, fixedConstraint, coincidentConstraint],
        [line, point]
      )
    ).toEqual([
      { kind: "fixed", label: "Fixed point" },
      { kind: "coincident", label: "Coincident" }
    ]);
    expect(
      createAvailableSketchConstraintKindOptions(rectangle, [], [rectangle])
    ).toEqual([{ kind: "fixed", label: "Fixed point" }]);
    expect(
      createAvailableFixedPointTargetOptions(line, [fixedConstraint])
    ).toEqual([
      {
        target: { entityId: "line_1", role: "end" },
        label: "line_1 end",
        detail: "Line end",
        coordinate: [3, 4]
      }
    ]);
    expect(
      createAvailableCoincidentPointTargetOptions(
        { entityId: "line_1", role: "start" },
        [line, point],
        [coincidentConstraint]
      )
    ).toEqual([
      {
        target: { entityId: "line_1", role: "end" },
        label: "line_1 end",
        detail: "Line end",
        coordinate: [3, 4]
      }
    ]);
    expect(
      createAvailableCoincidentPointTargetOptions(
        { entityId: "point_1", role: "position" },
        [line, point],
        [coincidentConstraint]
      )
    ).toEqual([
      {
        target: { entityId: "line_1", role: "end" },
        label: "line_1 end",
        detail: "Line end",
        coordinate: [3, 4]
      }
    ]);
    expect(
      isSketchConstraintRelatedToEntity(coincidentConstraint, "point_1")
    ).toBe(true);
    expect(
      isSketchConstraintRelatedToEntity(midpointConstraint, "point_1")
    ).toBe(true);
    expect(getSketchConstraintKindLabel("vertical")).toBe("Vertical");
    expect(getSketchConstraintKindLabel("fixed")).toBe("Fixed point");
    expect(getSketchConstraintKindLabel("coincident")).toBe("Coincident");
    expect(getSketchConstraintKindLabel("midpoint")).toBe("Midpoint");
    expect(formatSketchPointTarget({ entityId: "line_1", role: "start" })).toBe(
      "line_1 start"
    );
    expect(formatSketchPointCoordinate([1, 2])).toBe("1, 2");
    expect(formatSketchConstraintStatus(horizontalConstraint)).toBe(
      "Horizontal · line_1 · Healthy"
    );
    expect(formatSketchConstraintStatus(fixedConstraint)).toBe(
      "Fixed point · line_1 start at 0, 0 · Healthy"
    );
    expect(formatSketchConstraintStatus(coincidentConstraint)).toBe(
      "Coincident · line_1 start to point_1 position · Healthy"
    );
    expect(formatSketchConstraintStatus(midpointConstraint)).toBe(
      "Midpoint · point_1 position at midpoint of line_1 · Healthy"
    );
    expect(formatSketchConstraintStatus(invalidConstraint)).toBe(
      "Horizontal · line_1 · Line constraint target cannot be zero length."
    );
    expect(formatSketchConstraintStatus(missingConstraint)).toBe(
      "Fixed point · missing_point position at 0, 0 · Sketch entity does not exist: missing_point"
    );
    expect(formatSketchConstraintStatus(unsupportedConstraint)).toBe(
      "Fixed point · point_1 start at 0, 0 · Fixed sketch constraint target role is not supported for this entity."
    );
    expect(formatSketchConstraintStatus(inconsistentConstraint)).toBe(
      "Coincident · line_1 start to point_1 position · Coincident sketch constraint cannot satisfy two different fixed coordinates."
    );
    expect(formatSketchConstraintStatus(conflictingConstraint)).toBe(
      "Vertical · line_1 · Line has a conflicting horizontal constraint: con_horizontal."
    );
    expect(getSketchConstraintStatusDisplay(invalidConstraint)).toEqual({
      label: "Invalid value",
      detail:
        "Horizontal · line_1 · Line constraint target cannot be zero length.",
      tone: "error"
    });
    expect(getSketchConstraintStatusDisplay(inconsistentConstraint)).toEqual({
      label: "Inconsistent",
      detail:
        "Coincident · line_1 start to point_1 position · Coincident sketch constraint cannot satisfy two different fixed coordinates.",
      tone: "error"
    });
  });

  it("derives supported dimension targets from the active sketch entity", () => {
    const rectangle: SketchSnapshot["entities"][number] = {
      id: "rect_1",
      kind: "rectangle",
      center: [0, 0],
      width: 4,
      height: 2
    };
    const circle: SketchSnapshot["entities"][number] = {
      id: "circle_1",
      kind: "circle",
      center: [0, 0],
      radius: 3
    };
    const line: SketchSnapshot["entities"][number] = {
      id: "line_1",
      kind: "line",
      start: [0, 0],
      end: [3, 4]
    };

    expect(createSketchDimensionTargetOptions(rectangle)).toEqual([
      {
        target: { entityKind: "rectangle", role: "width" },
        label: "Width",
        currentValue: 4
      },
      {
        target: { entityKind: "rectangle", role: "height" },
        label: "Height",
        currentValue: 2
      }
    ]);
    expect(createSketchDimensionTargetOptions(circle)).toEqual([
      {
        target: { entityKind: "circle", role: "radius" },
        label: "Radius",
        currentValue: 3
      }
    ]);
    expect(createSketchDimensionTargetOptions(line)).toEqual([
      {
        target: { entityKind: "line", role: "length" },
        label: "Length",
        currentValue: 5
      }
    ]);
    expect(
      createSketchDimensionTargetOptions({
        id: "point_1",
        kind: "point",
        point: [0, 0]
      })
    ).toEqual([]);
    expect(
      getSketchDimensionTargetLabel({ entityKind: "rectangle", role: "height" })
    ).toBe("Height");
    expect(
      getSketchDimensionTargetValue(rectangle, {
        entityKind: "rectangle",
        role: "width"
      })
    ).toBe(4);
    expect(
      getSketchDimensionTargetValue(line, {
        entityKind: "line",
        role: "length"
      })
    ).toBe(5);
  });

  it("filters already-driven dimension targets and formats binding state", () => {
    const rectangle: SketchSnapshot["entities"][number] = {
      id: "rect_1",
      kind: "rectangle",
      center: [0, 0],
      width: 4,
      height: 2
    };
    const dimensions = [
      {
        id: "dim_width",
        name: "Width",
        sketchId: "sketch_1",
        entityId: "rect_1",
        target: { entityKind: "rectangle" as const, role: "width" as const },
        valueSource: { type: "parameter" as const, parameterId: "p_width" },
        status: "healthy" as const,
        issues: [],
        effectiveValue: 6
      }
    ];

    expect(
      createAvailableSketchDimensionTargetOptions(rectangle, dimensions)
    ).toEqual([
      {
        target: { entityKind: "rectangle", role: "height" },
        label: "Height",
        currentValue: 2
      }
    ]);
    expect(
      createParameterBindingOptions([
        { id: "p_width", name: "Width", value: 6 }
      ])
    ).toEqual([{ parameterId: "p_width", label: "Width (6)" }]);
    expect(getParameterDimensionUsageCount("p_width", dimensions)).toBe(1);
    expect(
      formatSketchDimensionValueSource(dimensions[0], [
        { id: "p_width", name: "Width", value: 6 }
      ])
    ).toBe("Width = 6");
    expect(formatSketchDimensionEffectiveValue(dimensions[0])).toBe(
      "Effective 6"
    );
    expect(formatSketchDimensionStatus(dimensions[0])).toBe(
      "Healthy · Effective 6"
    );
    expect(getSketchDimensionStatusDisplay(dimensions[0])).toEqual({
      label: "Healthy",
      detail: "Healthy · Effective 6",
      tone: "healthy"
    });
    expect(formatSketchDimensionValueSource(dimensions[0], [])).toBe(
      "Missing parameter p_width"
    );
  });

  it("formats sketch evaluation and dimension issue status compactly", () => {
    const widthDimension: SketchDimensionEntry = {
      id: "dim_width",
      name: "Width",
      sketchId: "sketch_1",
      entityId: "rect_1",
      target: { entityKind: "rectangle", role: "width" },
      valueSource: { type: "literal", value: 6 },
      status: "healthy",
      issues: [],
      effectiveValue: 6
    };
    const badDimension: SketchDimensionEntry = {
      id: "dim_missing_parameter",
      name: "Missing parameter",
      sketchId: "sketch_1",
      entityId: "rect_1",
      target: { entityKind: "rectangle", role: "height" },
      valueSource: { type: "parameter", parameterId: "missing_parameter" },
      status: "missing-target",
      issues: [
        {
          code: "PARAMETER_NOT_FOUND",
          message: "Parameter does not exist: missing_parameter",
          parameterId: "missing_parameter",
          sketchDimensionId: "dim_missing_parameter"
        }
      ]
    };
    const healthyEvaluation: SketchEvaluationQueryResponse = {
      ok: true,
      query: "sketch.evaluation",
      cadOpsVersion: "cadops.v1",
      sketchId: "sketch_1",
      sketchName: "Profile",
      plane: "XY",
      status: "healthy",
      drivenEntityCount: 1,
      drivenEntityIds: ["rect_1"],
      dimensionCount: 1,
      dimensions: [widthDimension],
      constraintCount: 0,
      constraints: [],
      issueCount: 0,
      issues: []
    };
    const invalidEvaluation: SketchEvaluationQueryResponse = {
      ...healthyEvaluation,
      status: "missing-target",
      dimensionCount: 2,
      dimensions: [widthDimension, badDimension],
      issueCount: 1,
      issues: badDimension.issues
    };

    expect(formatSketchEvaluationStatus(undefined)).toBe(
      "Evaluation unavailable"
    );
    expect(formatSketchEvaluationStatus(healthyEvaluation)).toBe(
      "1 driving dimension · 0 constraints · 1 driven entity"
    );
    expect(formatSketchEvaluationStatus(invalidEvaluation)).toBe(
      "Missing target · 1 issue"
    );
    expect(getSketchEvaluationStatusDisplay(invalidEvaluation)).toEqual({
      label: "Missing target",
      detail: "Missing target · 1 issue",
      tone: "error"
    });
    expect(formatSketchEvaluationIssue(badDimension.issues[0])).toBe(
      "dim_missing_parameter: Parameter does not exist: missing_parameter"
    );
    expect(getSketchDimensionStatusDisplay(badDimension)).toEqual({
      label: "Missing target",
      detail: "Parameter does not exist: missing_parameter",
      tone: "error"
    });
  });

  it("offers active rectangle newBody authored bodies as add targets", () => {
    const features: CadFeatureSummary[] = [
      createExtrudeFeature("feat_rect", "body_rect", "rectangle", "newBody"),
      createExtrudeFeature("feat_circle", "body_circle", "circle", "newBody"),
      createExtrudeFeature("feat_add", "body_add", "rectangle", "add")
    ];
    const bodies: CadBodySnapshot[] = [
      createBody("body_rect", "feat_rect"),
      createBody("body_circle", "feat_circle"),
      createBody("body_add", "feat_add")
    ];

    expect(createAddTargetBodyOptions(bodies, features, "body_rect")).toEqual([
      {
        bodyId: "body_rect",
        featureId: "feat_rect",
        profileKind: "rectangle",
        label: "body_rect / feat_rect",
        detail: "Rectangle new body / 1 / positive"
      }
    ]);
  });

  it("offers active rectangle and circle newBody authored bodies as cut targets", () => {
    const features: CadFeatureSummary[] = [
      createExtrudeFeature("feat_rect", "body_rect", "rectangle", "newBody"),
      createExtrudeFeature("feat_circle", "body_circle", "circle", "newBody"),
      createExtrudeFeature(
        "feat_circle_consumed",
        "body_circle_consumed",
        "circle",
        "newBody"
      ),
      createExtrudeFeature("feat_cut", "body_cut", "rectangle", "cut")
    ];
    const bodies: CadBodySnapshot[] = [
      createBody("body_rect", "feat_rect"),
      createBody("body_circle", "feat_circle"),
      createBody("body_circle_consumed", "feat_circle_consumed", "feat_cut"),
      createBody("body_consumed", "feat_consumed", "feat_cut"),
      createBody("body_cut", "feat_cut")
    ];

    expect(createCutTargetBodyOptions(bodies, features, "body_rect")).toEqual([
      {
        bodyId: "body_rect",
        featureId: "feat_rect",
        profileKind: "rectangle",
        label: "body_rect / feat_rect",
        detail: "Rectangle new body / 1 / positive"
      },
      {
        bodyId: "body_circle",
        featureId: "feat_circle",
        profileKind: "circle",
        label: "body_circle / feat_circle",
        detail: "Circle new body / 1 / positive"
      }
    ]);
  });

  it("explains cut availability without requiring React state", () => {
    const rectangle: SketchSnapshot["entities"][number] = {
      id: "rect_1",
      kind: "rectangle",
      center: [0, 0],
      width: 4,
      height: 2
    };
    const circle: SketchSnapshot["entities"][number] = {
      id: "circle_1",
      kind: "circle",
      center: [0, 0],
      radius: 1
    };
    const targets = [
      {
        bodyId: "body_rect",
        featureId: "feat_rect",
        profileKind: "rectangle" as const,
        label: "body_rect / feat_rect",
        detail: "Rectangle new body / 1 / positive"
      }
    ];

    expect(getCutOperationStatus(undefined, targets)).toEqual({
      available: false,
      message: "Select a rectangle profile to cut an existing body."
    });
    expect(getCutOperationStatus(circle, targets)).toEqual({
      available: false,
      message:
        "Cut currently supports rectangle profiles only. This profile can still create a new body."
    });
    expect(getCutOperationStatus(rectangle, [])).toEqual({
      available: false,
      message:
        "Create an active rectangle or circle new body before using Cut body."
    });
    expect(getCutOperationStatus(rectangle, targets)).toEqual({
      available: true,
      message: "1 eligible cut target body."
    });
  });

  it("explains add availability without requiring React state", () => {
    const rectangle: SketchSnapshot["entities"][number] = {
      id: "rect_1",
      kind: "rectangle",
      center: [0, 0],
      width: 4,
      height: 2
    };
    const circle: SketchSnapshot["entities"][number] = {
      id: "circle_1",
      kind: "circle",
      center: [0, 0],
      radius: 1
    };
    const targets = [
      {
        bodyId: "body_rect",
        featureId: "feat_rect",
        profileKind: "rectangle" as const,
        label: "body_rect / feat_rect",
        detail: "Rectangle new body / 1 / positive"
      }
    ];

    expect(getAddOperationStatus(undefined, targets)).toEqual({
      available: false,
      message: "Select a rectangle profile to add to an existing body."
    });
    expect(getAddOperationStatus(circle, targets)).toEqual({
      available: false,
      message:
        "Add currently supports rectangle profiles and rectangle targets only. This profile can still create a new body."
    });
    expect(getAddOperationStatus(rectangle, [])).toEqual({
      available: false,
      message: "Create an active rectangle new body before using Add to body."
    });
    expect(getAddOperationStatus(rectangle, targets)).toEqual({
      available: true,
      message: "1 eligible add target body."
    });
  });
});

function createSketch(
  id: string,
  overrides: Partial<SketchSnapshot> = {}
): SketchSnapshot {
  return {
    id,
    name: id,
    plane: "XY",
    entities: [],
    ...overrides
  };
}

function createExtrudeFeature(
  id: string,
  bodyId: string,
  profileKind: "rectangle" | "circle",
  operationMode: "newBody" | "add" | "cut"
): Extract<CadFeatureSummary, { kind: "extrude" }> {
  return {
    id,
    kind: "extrude",
    partId: "part:default",
    bodyId,
    sketchId: "sketch_1",
    entityId: profileKind === "rectangle" ? "rect_1" : "circle_1",
    profileKind,
    depth: 1,
    side: "positive",
    operationMode,
    ...(operationMode === "add" || operationMode === "cut"
      ? { targetBodyId: "body_rect" }
      : {}),
    source: {
      type: "sketchEntity",
      sketchId: "sketch_1",
      entityId: profileKind === "rectangle" ? "rect_1" : "circle_1"
    }
  };
}

function createBody(
  id: string,
  featureId: string,
  consumedByFeatureId?: string
): CadBodySnapshot {
  return {
    id,
    kind: "solid",
    partId: "part:default",
    featureId,
    ...(consumedByFeatureId ? { consumedByFeatureId } : {}),
    source: {
      type: "sketchExtrudeFeature",
      featureId,
      sketchId: "sketch_1",
      entityId: "rect_1",
      profileKind: "rectangle"
    }
  };
}

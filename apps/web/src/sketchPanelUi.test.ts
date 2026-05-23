import { describe, expect, it } from "vitest";
import type {
  CadBodySnapshot,
  CadFeatureSummary,
  SketchDimensionEntry,
  SketchEvaluationQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import {
  chooseSketchEntitySelection,
  chooseSketchPanelSelection,
  createAvailableSketchDimensionTargetOptions,
  createAvailableSketchConstraintKindOptions,
  createAddTargetBodyOptions,
  createCutTargetBodyOptions,
  createParameterBindingOptions,
  createSketchDimensionTargetOptions,
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

  it("derives line orientation constraint options and status display", () => {
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
    const horizontalConstraint = {
      id: "con_horizontal",
      name: "Horizontal",
      sketchId: "sketch_1",
      entityId: "line_1",
      kind: "horizontal" as const,
      status: "healthy" as const,
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

    expect(createAvailableSketchConstraintKindOptions(line, [])).toEqual([
      { kind: "horizontal", label: "Horizontal" },
      { kind: "vertical", label: "Vertical" }
    ]);
    expect(
      createAvailableSketchConstraintKindOptions(line, [horizontalConstraint])
    ).toEqual([]);
    expect(createAvailableSketchConstraintKindOptions(rectangle, [])).toEqual(
      []
    );
    expect(getSketchConstraintKindLabel("vertical")).toBe("Vertical");
    expect(formatSketchConstraintStatus(horizontalConstraint)).toBe(
      "Horizontal · Healthy"
    );
    expect(formatSketchConstraintStatus(invalidConstraint)).toBe(
      "Line constraint target cannot be zero length."
    );
    expect(getSketchConstraintStatusDisplay(invalidConstraint)).toEqual({
      label: "Invalid value",
      detail: "Line constraint target cannot be zero length.",
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

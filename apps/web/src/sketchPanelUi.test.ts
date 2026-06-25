import { describe, expect, it } from "vitest";
import type {
  CadBodySnapshot,
  CadFeatureSummary,
  SketchConstraintEntry,
  SketchDimensionEntry,
  SketchEvaluationQueryResponse,
  SketchSolverStatusQueryResponse,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import {
  chooseInitialSketchPanelSelection,
  chooseSketchEntitySelection,
  chooseSketchPanelSelection,
  createAvailableCoincidentPointTargetOptions,
  createAvailableFixedPointTargetOptions,
  createAvailableMidpointTargetOptions,
  createAvailableParallelLineTargetOptions,
  createAvailableSketchDimensionTargetOptions,
  createAvailableSketchConstraintKindOptions,
  createAddTargetBodyOptions,
  createCutTargetBodyOptions,
  createEffectiveHoleTargetForm,
  createHoleTargetBodyOptions,
  createParameterBindingOptions,
  createRevolveAxisOptions,
  createSketchEntityListItems,
  createSketchEntityIntentSummary,
  createSketchEntitySelectionId,
  createSketchPointTargetOptionsForEntity,
  createSketchDimensionTargetOptions,
  createSketchSelectionId,
  formatSketchPointCoordinate,
  formatSketchPointTarget,
  formatSketchDimensionEffectiveValue,
  formatSketchConstraintStatus,
  formatSketchDimensionStatus,
  formatSketchDimensionValueSource,
  formatSketchEvaluationIssue,
  formatSketchEvaluationStatus,
  formatSketchProfileValidity,
  formatSketchSolverDiagnostic,
  formatSketchSolverStatus,
  getAddOperationStatus,
  getAttachedSketchBooleanTargetHint,
  getCutOperationStatus,
  getDefaultSketchEntityKind,
  getHoleOperationStatus,
  getHoleTargetGuidance,
  getInitialSketchExtrudeOperationMode,
  getRevolveOperationStatus,
  getPreferredBooleanTargetBodyId,
  getPreferredBooleanTargetBodyOption,
  getParameterDimensionUsageCount,
  getSketchConstraintKindLabel,
  getSketchConstraintStatusDisplay,
  getSketchDimensionStatusDisplay,
  getSketchDimensionTargetLabel,
  getSketchDimensionTargetValue,
  getSketchEntityOptionLabel,
  getSketchEvaluationStatusDisplay,
  getSketchSolverStatusDisplay,
  isSketchConstraintRelatedToEntity,
  isExtrudableSketchEntity,
  isHoleSketchEntity,
  isRevolvableSketchEntity
} from "./sketchPanelUi";

describe("sketch panel UI helpers", () => {
  it("focuses a newly created sketch when there is no current selection", () => {
    const sketches = [createSketch("sketch_1"), createSketch("sketch_face_1")];

    expect(
      chooseSketchPanelSelection(sketches, undefined, "sketch_face_1")
    ).toBe("sketch_face_1");
  });

  it("initializes remounted sketch panels from the focused sketch", () => {
    const sketches = [createSketch("sketch_1"), createSketch("sketch_face_1")];

    expect(chooseInitialSketchPanelSelection(sketches, "sketch_face_1")).toBe(
      "sketch_face_1"
    );
    expect(chooseInitialSketchPanelSelection(sketches, "missing")).toBe(
      "sketch_1"
    );
    expect(chooseInitialSketchPanelSelection([], "sketch_face_1")).toBe(
      undefined
    );
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
    expect(createSketchEntityListItems(entities, "circle_1")).toEqual([
      {
        id: "rect_1",
        kind: "rectangle",
        kindLabel: "Rectangle",
        detail: "Center 0, 0 / 4 x 2",
        selected: false
      },
      {
        id: "circle_1",
        kind: "circle",
        kindLabel: "Circle",
        detail: "Center 1, 1 / radius 2",
        selected: true
      }
    ]);
    expect(createSketchSelectionId("sketch_1")).toBe("sketch:sketch_1");
    expect(createSketchEntitySelectionId("sketch_1", "circle_1")).toBe(
      "sketch:sketch_1:entity:circle_1"
    );
    expect(isExtrudableSketchEntity(entities[0])).toBe(true);
    expect(isExtrudableSketchEntity(entities[1])).toBe(true);
    expect(isRevolvableSketchEntity(entities[0])).toBe(true);
    expect(isRevolvableSketchEntity(entities[1])).toBe(true);
    expect(
      isExtrudableSketchEntity({
        id: "point_1",
        kind: "point",
        point: [0, 0]
      })
    ).toBe(false);
    expect(
      isRevolvableSketchEntity({
        id: "line_1",
        kind: "line",
        start: [0, 0],
        end: [1, 0]
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
    const secondLine: SketchSnapshot["entities"][number] = {
      id: "line_2",
      kind: "line",
      start: [10, 10],
      end: [10, 12]
    };
    const zeroLine: SketchSnapshot["entities"][number] = {
      id: "line_zero",
      kind: "line",
      start: [2, 2],
      end: [2, 2]
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
    const parallelConstraint: SketchConstraintEntry = {
      id: "parallel_1",
      name: "Parallel",
      sketchId: "sketch_1",
      entityId: "line_1",
      kind: "parallel",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2",
      primaryDirection: [0.6, 0.8],
      secondaryDirection: [0.6, 0.8],
      status: "healthy",
      issues: []
    };
    const perpendicularConstraint: SketchConstraintEntry = {
      id: "perpendicular_1",
      name: "Perpendicular",
      sketchId: "sketch_1",
      entityId: "line_2",
      kind: "perpendicular",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2",
      primaryDirection: [0.6, 0.8],
      secondaryDirection: [-0.8, 0.6],
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
      { kind: "coincident", label: "Coincident" },
      { kind: "midpoint", label: "Midpoint" }
    ]);
    expect(
      createAvailableSketchConstraintKindOptions(
        line,
        [],
        [line, secondLine, zeroLine, point]
      )
    ).toEqual([
      { kind: "horizontal", label: "Horizontal" },
      { kind: "vertical", label: "Vertical" },
      { kind: "fixed", label: "Fixed point" },
      { kind: "coincident", label: "Coincident" },
      { kind: "midpoint", label: "Midpoint" },
      { kind: "parallel", label: "Parallel" },
      { kind: "perpendicular", label: "Perpendicular" }
    ]);
    expect(
      createAvailableSketchConstraintKindOptions(
        zeroLine,
        [],
        [line, zeroLine, point]
      )
    ).toEqual([
      { kind: "fixed", label: "Fixed point" },
      { kind: "coincident", label: "Coincident" },
      { kind: "midpoint", label: "Midpoint" }
    ]);
    expect(
      createAvailableSketchConstraintKindOptions(
        line,
        [perpendicularConstraint],
        [line, secondLine]
      )
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
      { kind: "coincident", label: "Coincident" },
      { kind: "midpoint", label: "Midpoint" }
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
      createAvailableMidpointTargetOptions(
        line,
        [line, point, rectangle, circle],
        []
      )
    ).toEqual([
      {
        target: { entityId: "point_1", role: "position" },
        label: "point_1 position",
        detail: "Point position",
        coordinate: [5, 6]
      },
      {
        target: { entityId: "rect_1", role: "center" },
        label: "rect_1 center",
        detail: "Rectangle center",
        coordinate: [0, 0]
      },
      {
        target: { entityId: "circle_1", role: "center" },
        label: "circle_1 center",
        detail: "Circle center",
        coordinate: [7, 8]
      }
    ]);
    expect(createAvailableMidpointTargetOptions(line, [line], [])).toEqual([]);
    expect(
      createAvailableMidpointTargetOptions(
        line,
        [line, point],
        [midpointConstraint]
      )
    ).toEqual([]);
    expect(
      createAvailableParallelLineTargetOptions(
        line,
        [line, secondLine, zeroLine, point],
        []
      )
    ).toEqual([
      {
        entityId: "line_2",
        label: "line_2",
        detail: "10, 10 to 10, 12"
      }
    ]);
    expect(
      createAvailableParallelLineTargetOptions(
        zeroLine,
        [line, secondLine, zeroLine],
        []
      )
    ).toEqual([]);
    expect(
      createAvailableParallelLineTargetOptions(
        line,
        [line, secondLine],
        [parallelConstraint]
      )
    ).toEqual([]);
    expect(
      createAvailableParallelLineTargetOptions(
        line,
        [line, secondLine],
        [perpendicularConstraint]
      )
    ).toEqual([]);
    expect(
      isSketchConstraintRelatedToEntity(coincidentConstraint, "point_1")
    ).toBe(true);
    expect(
      isSketchConstraintRelatedToEntity(midpointConstraint, "point_1")
    ).toBe(true);
    expect(
      isSketchConstraintRelatedToEntity(parallelConstraint, "line_2")
    ).toBe(true);
    expect(
      isSketchConstraintRelatedToEntity(perpendicularConstraint, "line_2")
    ).toBe(true);
    expect(getSketchConstraintKindLabel("vertical")).toBe("Vertical");
    expect(getSketchConstraintKindLabel("fixed")).toBe("Fixed point");
    expect(getSketchConstraintKindLabel("coincident")).toBe("Coincident");
    expect(getSketchConstraintKindLabel("midpoint")).toBe("Midpoint");
    expect(getSketchConstraintKindLabel("parallel")).toBe("Parallel");
    expect(getSketchConstraintKindLabel("perpendicular")).toBe("Perpendicular");
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
    expect(formatSketchConstraintStatus(parallelConstraint)).toBe(
      "Parallel · line_2 parallel to line_1 · Healthy"
    );
    expect(formatSketchConstraintStatus(perpendicularConstraint)).toBe(
      "Perpendicular · line_2 perpendicular to line_1 · Healthy"
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
    const underDefinedEvaluation: SketchEvaluationQueryResponse = {
      ...healthyEvaluation,
      status: "under-defined",
      issueCount: 1,
      issues: [
        {
          code: "UNDER_DEFINED_SKETCH",
          message: "Sketch sketch_1 is under-defined.",
          sketchId: "sketch_1"
        }
      ]
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
    expect(formatSketchEvaluationStatus(underDefinedEvaluation)).toBe(
      "Under-defined · 1 issue"
    );
    expect(getSketchEvaluationStatusDisplay(invalidEvaluation)).toEqual({
      label: "Missing target",
      detail: "Missing target · 1 issue",
      tone: "error"
    });
    expect(getSketchEvaluationStatusDisplay(underDefinedEvaluation)).toEqual({
      label: "Under-defined",
      detail: "Under-defined · 1 issue",
      tone: "warning"
    });
    expect(formatSketchEvaluationIssue(underDefinedEvaluation.issues[0])).toBe(
      "sketch_1: Sketch sketch_1 is under-defined."
    );
    expect(formatSketchEvaluationIssue(badDimension.issues[0])).toBe(
      "dim_missing_parameter: Parameter does not exist: missing_parameter"
    );
    expect(getSketchDimensionStatusDisplay(badDimension)).toEqual({
      label: "Missing target",
      detail: "Parameter does not exist: missing_parameter",
      tone: "error"
    });
  });

  it("formats sketch solver status and entity intent compactly", () => {
    const solverStatus = createSolverStatus({
      status: "under-defined",
      numericalSolverStatus: "under-defined",
      dimensionCount: 1,
      constraintCount: 2,
      validProfileCount: 1,
      profileCount: 1
    });
    const failedStatus = createSolverStatus({
      status: "conflicting",
      numericalSolverStatus: "conflicting",
      diagnostics: [
        {
          code: "SKETCH_SOLVER_CONFLICTING",
          severity: "blocker",
          message: "Line length conflicts with fixed endpoints.",
          sketchId: "sketch_1",
          sketchConstraintId: "constraint_conflict"
        }
      ]
    });
    const dimension: SketchDimensionEntry = {
      id: "dim_length",
      name: "Length",
      sketchId: "sketch_1",
      entityId: "line_1",
      target: { entityKind: "line", role: "length" },
      valueSource: { type: "literal", value: 4 },
      status: "healthy",
      issues: [],
      effectiveValue: 4
    };
    const constraint: SketchConstraintEntry = {
      id: "constraint_horizontal",
      name: "Horizontal",
      sketchId: "sketch_1",
      kind: "horizontal",
      entityId: "line_1",
      status: "healthy",
      issues: []
    };

    expect(formatSketchProfileValidity(solverStatus)).toBe(
      "1/1 feature-ready profile"
    );
    expect(formatSketchSolverStatus(solverStatus)).toBe(
      "Numerical under-defined · 1/1 feature-ready profile"
    );
    expect(getSketchSolverStatusDisplay(solverStatus)).toEqual({
      label: "Under-defined",
      detail: "Numerical under-defined · 1/1 feature-ready profile",
      tone: "warning"
    });
    expect(formatSketchSolverStatus(failedStatus)).toBe(
      "Conflicting · 1 diagnostic · 0/0 unsupported profiles"
    );
    expect(formatSketchSolverDiagnostic(failedStatus.diagnostics[0])).toBe(
      "constraint_conflict: Line length conflicts with fixed endpoints."
    );
    expect(
      createSketchEntityIntentSummary("line_1", [dimension], [constraint])
    ).toEqual({
      dimensionCount: 1,
      constraintCount: 1,
      label: "1 dim · 1 constraint"
    });
    expect(createSketchEntityIntentSummary("point_1", [dimension], [])).toEqual(
      {
        dimensionCount: 0,
        constraintCount: 0,
        label: "No dimensions or constraints"
      }
    );
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
        label: "Rectangle target 1 / 1 mm",
        detail: "Rectangle new body / 1 mm / positive / body_rect"
      }
    ]);
  });

  it("offers active topology-backed rectangle result bodies as add targets", () => {
    const features: CadFeatureSummary[] = [
      createExtrudeFeature("feat_rect", "body_rect", "rectangle", "newBody"),
      createExtrudeFeature("feat_cut", "body_cut", "rectangle", "cut")
    ];
    const bodies: CadBodySnapshot[] = [
      createBody("body_rect", "feat_rect", "feat_cut"),
      createBody("body_cut", "feat_cut")
    ];

    expect(
      createAddTargetBodyOptions(bodies, features, "body_cut", [
        {
          anchorId: "anchor_body_cut",
          entityKind: "body",
          bodyId: "body_cut",
          checkpointId: "checkpoint_body_cut",
          checkpointEntityId: "checkpoint_body_cut_body",
          stableId: "generated:body:body_cut",
          state: "active",
          diagnostics: []
        }
      ])
    ).toEqual([
      {
        bodyId: "body_cut",
        featureId: "feat_cut",
        targetTopologyAnchorId: "anchor_body_cut",
        profileKind: "rectangle",
        label: "Rectangle result 1 / 1 mm",
        detail: "Rectangle topology result / cut / body_cut"
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
        label: "Rectangle target 1 / 1 mm",
        detail: "Rectangle new body / 1 mm / positive / body_rect"
      },
      {
        bodyId: "body_circle",
        featureId: "feat_circle",
        profileKind: "circle",
        label: "Circle target 2 / 1 mm",
        detail: "Circle new body / 1 mm / positive / body_circle"
      }
    ]);
  });

  it("offers active topology-backed boolean result bodies as cut targets", () => {
    const features: CadFeatureSummary[] = [
      createExtrudeFeature("feat_rect", "body_rect", "rectangle", "newBody"),
      createExtrudeFeature("feat_cut", "body_cut", "rectangle", "cut", {
        targetTopologyAnchorId: "anchor_body_rect"
      }),
      createExtrudeFeature(
        "feat_unanchored_cut",
        "body_unanchored_cut",
        "rectangle",
        "cut"
      )
    ];
    const bodies: CadBodySnapshot[] = [
      createBody("body_rect", "feat_rect", "feat_cut"),
      createBody("body_cut", "feat_cut"),
      createBody("body_unanchored_cut", "feat_unanchored_cut")
    ];

    expect(createCutTargetBodyOptions(bodies, features, "body_cut")).toEqual([
      {
        bodyId: "body_cut",
        featureId: "feat_cut",
        targetTopologyAnchorId: "anchor_body_rect",
        profileKind: "rectangle",
        label: "Rectangle result 1 / 1 mm",
        detail: "Rectangle topology result / cut / body_cut"
      }
    ]);
  });

  it("defaults attached sketch extrudes to cut when the attached body is an eligible target", () => {
    const rectangle: SketchSnapshot["entities"][number] = {
      id: "rect_1",
      kind: "rectangle",
      center: [0, 0],
      width: 1,
      height: 1
    };
    const sketch = createSketch("sketch_attached", {
      attachment: {
        kind: "generatedFace",
        bodyId: "body_rect",
        faceStableId: "generated:face:body_rect:side:uMin",
        sourceFeatureId: "feat_rect",
        sourceSketchId: "sketch_source",
        sourceSketchEntityId: "rect_source",
        faceRole: "side:uMin"
      },
      entities: [rectangle]
    });
    const targets = [
      {
        bodyId: "body_other",
        featureId: "feat_other",
        profileKind: "rectangle" as const,
        label: "Other target",
        detail: "Rectangle new body / 1 / positive"
      },
      {
        bodyId: "body_rect",
        featureId: "feat_rect",
        profileKind: "rectangle" as const,
        label: "Attached target",
        detail: "Rectangle new body / 1 / positive"
      }
    ];

    expect(
      getInitialSketchExtrudeOperationMode(sketch, rectangle, targets)
    ).toBe("cut");
    expect(
      getPreferredBooleanTargetBodyId(targets, sketch.attachment?.bodyId)
    ).toBe("body_rect");
    expect(getAttachedSketchBooleanTargetHint(sketch, rectangle, targets)).toBe(
      undefined
    );
  });

  it("defaults attached result sketches to cut when the result body is topology-backed", () => {
    const rectangle: SketchSnapshot["entities"][number] = {
      id: "rect_1",
      kind: "rectangle",
      center: [0, 0],
      width: 1,
      height: 1
    };
    const sketch = createSketch("sketch_result_face", {
      attachment: {
        kind: "generatedFace",
        bodyId: "body_boolean_result",
        faceStableId: "generated:face:body_boolean_result:side:uMin",
        sourceFeatureId: "feat_cut",
        sourceSketchId: "sketch_source",
        sourceSketchEntityId: "rect_source",
        faceRole: "side:uMin"
      },
      entities: [rectangle]
    });
    const targets = [
      {
        bodyId: "body_other",
        featureId: "feat_other",
        profileKind: "rectangle" as const,
        label: "Other target",
        detail: "Rectangle new body / 1 / positive"
      },
      {
        bodyId: "body_boolean_result",
        featureId: "feat_cut",
        targetTopologyAnchorId: "anchor_body_rect",
        profileKind: "rectangle" as const,
        label: "Result target",
        detail: "Rectangle topology result / cut / body_boolean_result"
      }
    ];

    expect(
      getInitialSketchExtrudeOperationMode(sketch, rectangle, targets)
    ).toBe("cut");
    expect(
      getPreferredBooleanTargetBodyOption(targets, sketch.attachment?.bodyId)
    ).toMatchObject({
      bodyId: "body_boolean_result",
      targetTopologyAnchorId: "anchor_body_rect"
    });
    expect(getAttachedSketchBooleanTargetHint(sketch, rectangle, targets)).toBe(
      undefined
    );
  });

  it("offers active rectangle and circle newBody authored bodies as hole targets", () => {
    const features: CadFeatureSummary[] = [
      createExtrudeFeature("feat_rect", "body_rect", "rectangle", "newBody"),
      createExtrudeFeature("feat_circle", "body_circle", "circle", "newBody"),
      createExtrudeFeature(
        "feat_consumed_target",
        "body_consumed_target",
        "rectangle",
        "newBody"
      ),
      createExtrudeFeature("feat_add", "body_add", "rectangle", "add"),
      createExtrudeFeature("feat_cut", "body_cut", "rectangle", "cut")
    ];
    const bodies: CadBodySnapshot[] = [
      createBody("body_rect", "feat_rect"),
      createBody("body_circle", "feat_circle"),
      createBody("body_consumed_target", "feat_consumed_target", "feat_cut"),
      createBody("body_add", "feat_add"),
      createBody("body_cut", "feat_cut")
    ];

    expect(
      createHoleTargetBodyOptions(bodies, features, "body_circle")
    ).toEqual([
      {
        bodyId: "body_circle",
        featureId: "feat_circle",
        profileKind: "circle",
        label: "Circle target 2 / 1 mm",
        detail: "Circle new body / 1 mm / positive / body_circle"
      },
      {
        bodyId: "body_rect",
        featureId: "feat_rect",
        profileKind: "rectangle",
        label: "Rectangle target 1 / 1 mm",
        detail: "Rectangle new body / 1 mm / positive / body_rect"
      }
    ]);
  });

  it("offers active topology-backed boolean result bodies as hole targets", () => {
    const features: CadFeatureSummary[] = [
      createExtrudeFeature("feat_rect", "body_rect", "rectangle", "newBody"),
      createExtrudeFeature("feat_cut", "body_cut", "rectangle", "cut", {
        targetTopologyAnchorId: "anchor_body_rect"
      }),
      createExtrudeFeature(
        "feat_unanchored_cut",
        "body_unanchored_cut",
        "rectangle",
        "cut"
      )
    ];
    const bodies: CadBodySnapshot[] = [
      createBody("body_rect", "feat_rect", "feat_cut"),
      createBody("body_cut", "feat_cut"),
      createBody("body_unanchored_cut", "feat_unanchored_cut")
    ];

    expect(createHoleTargetBodyOptions(bodies, features, "body_cut")).toEqual([
      {
        bodyId: "body_cut",
        featureId: "feat_cut",
        targetTopologyAnchorId: "anchor_body_rect",
        profileKind: "rectangle",
        label: "Rectangle result 1 / 1 mm",
        detail: "Rectangle topology result / cut / body_cut"
      }
    ]);
  });

  it("prefers active result-body topology anchors for hole targets", () => {
    const features: CadFeatureSummary[] = [
      createExtrudeFeature("feat_rect", "body_rect", "rectangle", "newBody"),
      createExtrudeFeature("feat_cut", "body_cut", "rectangle", "cut")
    ];
    const bodies: CadBodySnapshot[] = [
      createBody("body_rect", "feat_rect", "feat_cut"),
      createBody("body_cut", "feat_cut")
    ];

    expect(
      createHoleTargetBodyOptions(bodies, features, "body_cut", [
        {
          anchorId: "anchor_body_cut",
          entityKind: "body",
          bodyId: "body_cut",
          checkpointId: "checkpoint_body_cut",
          checkpointEntityId: "checkpoint_body_cut_body",
          stableId: "generated:body:body_cut",
          state: "active",
          diagnostics: []
        }
      ])
    ).toEqual([
      {
        bodyId: "body_cut",
        featureId: "feat_cut",
        targetTopologyAnchorId: "anchor_body_cut",
        profileKind: "rectangle",
        label: "Rectangle result 1 / 1 mm",
        detail: "Rectangle topology result / cut / body_cut"
      }
    ]);
  });

  it("offers active topology-backed circle-origin result bodies as hole targets", () => {
    const features: CadFeatureSummary[] = [
      createExtrudeFeature("feat_circle", "body_circle", "circle", "newBody"),
      createExtrudeFeature("feat_cut", "body_cut", "rectangle", "cut", {
        targetBodyId: "body_circle",
        targetTopologyAnchorId: "anchor_body_circle"
      })
    ];
    const bodies: CadBodySnapshot[] = [
      createBody("body_circle", "feat_circle", "feat_cut"),
      createBody("body_cut", "feat_cut")
    ];

    expect(createHoleTargetBodyOptions(bodies, features, "body_cut")).toEqual([
      {
        bodyId: "body_cut",
        featureId: "feat_cut",
        targetTopologyAnchorId: "anchor_body_circle",
        profileKind: "circle",
        label: "Circle result 1 / 1 mm",
        detail: "Circle topology result / cut / body_cut"
      }
    ]);
  });

  it("preserves topology anchors when building effective hole target forms", () => {
    const form = {
      id: "feature_hole_1",
      bodyId: "body_hole_1",
      targetBodyId: "stale_body",
      targetTopologyAnchorId: "stale_anchor",
      name: "Result body hole",
      depthMode: "throughAll" as const,
      depth: 1,
      direction: "negative" as const
    };

    expect(
      createEffectiveHoleTargetForm(form, {
        bodyId: "body_cut",
        targetTopologyAnchorId: "anchor_body_circle"
      })
    ).toEqual({
      ...form,
      targetBodyId: "body_cut",
      targetTopologyAnchorId: "anchor_body_circle"
    });
    expect(
      createEffectiveHoleTargetForm(form, {
        bodyId: "body_source"
      })
    ).toEqual({
      ...form,
      targetBodyId: "body_source",
      targetTopologyAnchorId: undefined
    });
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
      message: "Select a rectangle or circle profile to cut an existing body."
    });
    expect(getCutOperationStatus(rectangle, [])).toEqual({
      available: false,
      message:
        "Create an active rectangle, circle, or topology-backed result body before using Cut body."
    });
    expect(getCutOperationStatus(rectangle, targets)).toEqual({
      available: true,
      message: "1 eligible cut target body."
    });
    expect(getCutOperationStatus(circle, targets)).toEqual({
      available: true,
      message: "1 eligible cut target body."
    });
  });

  it("explains hole availability without requiring React state", () => {
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

    expect(isHoleSketchEntity(circle)).toBe(true);
    expect(isHoleSketchEntity(rectangle)).toBe(false);
    expect(
      getHoleOperationStatus(undefined, targets, {
        depthMode: "blind",
        depth: 1
      })
    ).toEqual({
      available: false,
      message: "Select a circle profile to create a hole."
    });
    expect(
      getHoleOperationStatus(rectangle, targets, {
        depthMode: "blind",
        depth: 1
      })
    ).toEqual({
      available: false,
      message: "Hole currently supports circle profiles only."
    });
    expect(
      getHoleOperationStatus(
        circle,
        targets,
        { depthMode: "blind", depth: 1 },
        { kind: "unresolved" }
      )
    ).toEqual({
      available: false,
      message: "Resolve the attached sketch face before creating a hole."
    });
    expect(
      getHoleOperationStatus(circle, targets, {
        depthMode: "blind",
        depth: 0
      })
    ).toEqual({
      available: false,
      message: "Blind hole depth must be a positive finite value."
    });
    expect(
      getHoleOperationStatus(circle, [], {
        depthMode: "throughAll",
        depth: Number.NaN
      })
    ).toEqual({
      available: false,
      message:
        "Create an eligible rectangle, circle, or stable result target before creating a hole."
    });
    expect(
      getHoleOperationStatus(circle, targets, {
        depthMode: "throughAll",
        depth: Number.NaN
      })
    ).toEqual({
      available: true,
      message: "1 eligible hole target body."
    });
  });

  it("describes circular side-plane hole targets without topology jargon", () => {
    const circleTarget = {
      bodyId: "body_circle_result",
      featureId: "feat_circle_result",
      targetTopologyAnchorId: "anchor_body_circle",
      profileKind: "circle" as const,
      label: "Circle result",
      detail: "Circle topology result / cut / body_circle_result"
    };
    const rectangleTarget = {
      bodyId: "body_rect",
      featureId: "feat_rect",
      profileKind: "rectangle" as const,
      label: "Rectangle target",
      detail: "Rectangle new body / 1 mm / positive / body_rect"
    };

    expect(getHoleTargetGuidance(circleTarget, "XZ")).toBe(
      "Creates a side hole through the circular target from the XZ sketch plane."
    );
    expect(getHoleTargetGuidance(circleTarget, "XY")).toBe(
      "Creates an axial hole through the circular target. Use an XZ or YZ sketch for a side hole."
    );
    expect(getHoleTargetGuidance(rectangleTarget, "YZ")).toBe(
      "Creates a hole from the YZ sketch plane through the selected target."
    );
    expect(getHoleTargetGuidance(undefined, "XZ")).toBeUndefined();
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
      message:
        "Select a rectangle or circle profile to add to an existing body."
    });
    expect(getAddOperationStatus(rectangle, [])).toEqual({
      available: false,
      message:
        "Create an active rectangle source body or topology-backed result body before using Add to body."
    });
    expect(getAddOperationStatus(rectangle, targets)).toEqual({
      available: true,
      message: "1 eligible add target body."
    });
    expect(getAddOperationStatus(circle, targets)).toEqual({
      available: true,
      message: "1 eligible add target body."
    });
  });

  it("filters revolve axes and explains revolve availability", () => {
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
    const point: SketchSnapshot["entities"][number] = {
      id: "point_1",
      kind: "point",
      point: [0, 0]
    };
    const validLine: SketchSnapshot["entities"][number] = {
      id: "axis_1",
      kind: "line",
      start: [0, -2],
      end: [0, 2]
    };
    const zeroLine: SketchSnapshot["entities"][number] = {
      id: "axis_zero",
      kind: "line",
      start: [1, 1],
      end: [1, 1]
    };

    expect(
      createRevolveAxisOptions(
        createSketch("sketch_1", {
          entities: [rectangle, validLine, zeroLine, circle]
        })
      )
    ).toEqual([
      {
        entityId: "axis_1",
        label: "Axis 1 / 4 mm",
        detail: "0, -2 to 0, 2"
      }
    ]);
    expect(getRevolveOperationStatus(point, [], 360)).toEqual({
      available: false,
      message: "Select a rectangle or circle profile to revolve."
    });
    expect(getRevolveOperationStatus(rectangle, [], 0)).toEqual({
      available: false,
      message: "Revolve angle must be a positive finite value <= 360."
    });
    expect(getRevolveOperationStatus(rectangle, [], 361)).toEqual({
      available: false,
      message: "Revolve angle must be a positive finite value <= 360."
    });
    expect(getRevolveOperationStatus(rectangle, [], Number.NaN)).toEqual({
      available: false,
      message: "Revolve angle must be a positive finite value <= 360."
    });
    expect(getRevolveOperationStatus(rectangle, [], 180, 0)).toEqual({
      available: false,
      message:
        "Add a non-zero line entity in this sketch to use as the revolve axis."
    });
    expect(getRevolveOperationStatus(circle, [], 180, 1)).toEqual({
      available: false,
      message: "Edit the sketch line axis so it has non-zero length."
    });
    expect(
      getRevolveOperationStatus(
        circle,
        createRevolveAxisOptions(
          createSketch("sketch_1", { entities: [validLine] })
        ),
        180
      )
    ).toEqual({
      available: true,
      message: "1 eligible revolve axis."
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

function createSolverStatus({
  status = "solved",
  numericalSolverStatus = "converged",
  dimensionCount = 0,
  constraintCount = 0,
  validProfileCount = 0,
  profileCount = 0,
  diagnostics = []
}: {
  readonly status?: SketchSolverStatusQueryResponse["status"];
  readonly numericalSolverStatus?: SketchSolverStatusQueryResponse["solver"]["numericalSolverStatus"];
  readonly dimensionCount?: number;
  readonly constraintCount?: number;
  readonly validProfileCount?: number;
  readonly profileCount?: number;
  readonly diagnostics?: SketchSolverStatusQueryResponse["diagnostics"];
} = {}): SketchSolverStatusQueryResponse {
  return {
    ok: true,
    query: "sketch.solverStatus",
    cadOpsVersion: "cadops.v1",
    sketchId: "sketch_1",
    sketchName: "Sketch 1",
    plane: "XY",
    status,
    readiness:
      status === "conflicting" || status === "failed" ? "blocked" : "ready",
    solver: {
      engine: "current-direct-evaluator",
      numericalSolverStatus,
      numericalSolverEngine: "@web-cad/sketch-solver",
      numericalSolverModelVersion: "partbench.sketch-solver.v1",
      modelBuilt: true,
      solverRan: numericalSolverStatus !== "not-run",
      canSolveNumerically:
        numericalSolverStatus !== "failed" &&
        numericalSolverStatus !== "unsupported" &&
        numericalSolverStatus !== "not-run" &&
        numericalSolverStatus !== "deferred",
      deterministic: true,
      workerReady: false,
      diagnostic: {
        code: "SKETCH_SOLVER_NUMERICAL_STATUS_READY",
        severity: "info",
        message: "Numerical solver status is available.",
        sketchId: "sketch_1"
      }
    },
    entityCount: 0,
    entities: [],
    dimensionCount,
    dimensions: [],
    constraintCount,
    constraints: [],
    deferredConstraintCount: 0,
    deferredConstraints: [],
    profileValidity: {
      status: validProfileCount > 0 ? "valid" : "unsupported",
      profileCount,
      validProfileCount,
      profiles: [],
      diagnosticCount: 0,
      diagnostics: []
    },
    preview: {
      status: "deferred",
      willMutateDocument: false,
      supportedPreviewKinds: [],
      deferredPreviewKinds: ["entity.drag"],
      diagnosticCount: 0,
      diagnostics: []
    },
    sourceContract: {
      currentProjectSchemaVersion: "web-cad.project.v16",
      emittedProjectSchemaVersion: "web-cad.project.v16",
      packageVersion: "partbench.wcad.v1",
      queryOnly: true,
      requiresProjectSchemaMigration: false,
      nextProjectSchemaVersion: "web-cad.project.v17",
      sourceRecordRequirements: []
    },
    diagnosticCount: diagnostics.length,
    diagnostics,
    sourceBoundaryNote: "source",
    derivedBoundaryNote: "derived",
    requiresProjectSchemaMigration: false
  };
}

function createExtrudeFeature(
  id: string,
  bodyId: string,
  profileKind: "rectangle" | "circle",
  operationMode: "newBody" | "add" | "cut",
  options: {
    readonly targetBodyId?: string;
    readonly targetTopologyAnchorId?: string;
  } = {}
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
      ? { targetBodyId: options.targetBodyId ?? "body_rect" }
      : {}),
    ...(options.targetTopologyAnchorId
      ? { targetTopologyAnchorId: options.targetTopologyAnchorId }
      : {}),
    source: {
      type: "sketchEntity",
      sketchId: "sketch_1",
      entityId: profileKind === "rectangle" ? "rect_1" : "circle_1",
      ...(options.targetTopologyAnchorId
        ? { targetTopologyAnchorId: options.targetTopologyAnchorId }
        : {})
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

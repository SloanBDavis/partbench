import type {
  SketchConstraintEntry,
  SketchDimensionEntryV22,
  SketchEntitySnapshot
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import {
  CONSTRAINT_KIND_OPTIONS_V19,
  DIMENSION_FAMILY_OPTIONS_V19,
  constraintEntryToDraftV19,
  createAvailableConstraintKindOptionsV19,
  createAvailableDimensionFamilyOptionsV19,
  createDefaultConstraintDraftV19,
  createDefaultDimensionDraftV19,
  createPointTargetOptionsV19,
  dimensionTargetKeyV19,
  dimensionEntryToDraftV19,
  measureDimensionTargetV19,
  validateConstraintDraftV19,
  validateDimensionDraftV19
} from "./sketchIntentEditorModel";
import {
  buildCreateConstraintOpsV19,
  buildCreateDimensionOpsV19,
  buildDeleteConstraintOpV19,
  buildDeleteDimensionOpV19,
  buildEditConstraintOpsV19,
  buildEditDimensionOpsV19
} from "./sketchIntentEditorOps";

describe("V19 sketch intent editor model", () => {
  it("exposes every normalized dimension family with exact target collectors", () => {
    const available = createAvailableDimensionFamilyOptionsV19(entities);
    expect(available.map((item) => item.value)).toEqual(
      DIMENSION_FAMILY_OPTIONS_V19.map((item) => item.value)
    );
    expect(createPointTargetOptionsV19(entities)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: {
            entityId: "line_1",
            entityKind: "line",
            role: "start"
          }
        }),
        expect.objectContaining({
          value: {
            entityId: "arc_1",
            entityKind: "arc",
            role: "end"
          }
        })
      ])
    );

    for (const family of DIMENSION_FAMILY_OPTIONS_V19) {
      const draft = createDefaultDimensionDraftV19(
        entities,
        undefined,
        family.value
      );
      expect(draft, family.value).toBeDefined();
      expect(validateDimensionDraftV19(draft!, entities, parameters)).toEqual({
        valid: true,
        message: "Ready to apply."
      });
      const [op] = buildCreateDimensionOpsV19("sketch_1", draft!);
      expect(op).toMatchObject({
        op: "sketch.dimension.create",
        sketchId: "sketch_1",
        target: draft!.target
      });
      expect(op).not.toHaveProperty("entityId");
    }
  });

  it("keeps line angle literal-only and emits explicit direction, side, sense, and diameter intent", () => {
    const lineAngle = createDefaultDimensionDraftV19(
      entities,
      undefined,
      "lineAngle"
    )!;
    expect(
      validateDimensionDraftV19(
        { ...lineAngle, valueSourceType: "parameter", parameterId: "length" },
        entities,
        parameters
      )
    ).toEqual({
      valid: false,
      message: "Line angle dimensions require a literal value."
    });

    expect(
      createDefaultDimensionDraftV19(entities, undefined, "horizontalDistance")
        ?.target
    ).toMatchObject({ measurement: "horizontal", direction: "negative" });
    expect(
      createDefaultDimensionDraftV19(entities, undefined, "pointLineDistance")
        ?.target
    ).toMatchObject({ kind: "pointLineDistance", side: "left" });
    expect(lineAngle.target).toMatchObject({
      kind: "lineAngle",
      sense: "counterclockwise"
    });
    expect(
      createDefaultDimensionDraftV19(entities, "circle_1", "diameter")?.target
    ).toEqual({
      kind: "entityScalar",
      entityId: "circle_1",
      entityKind: "circle",
      role: "diameter"
    });
  });

  it("selects relational branches and submits a positive sweep without changing authored direction", () => {
    const reversed = [
      {
        id: "line_right",
        kind: "line",
        start: [4, 0],
        end: [0, 0],
        construction: false
      },
      {
        id: "line_down",
        kind: "line",
        start: [0, 0],
        end: [0, 4],
        construction: false
      },
      {
        id: "point_right",
        kind: "point",
        point: [2, 2],
        construction: false
      },
      {
        id: "arc_clockwise",
        kind: "arc",
        center: [0, 0],
        radius: 2,
        startAngleDegrees: 90,
        sweepAngleDegrees: -70,
        construction: false
      }
    ] satisfies readonly SketchEntitySnapshot[];

    const horizontal = createDefaultDimensionDraftV19(
      reversed,
      "line_right",
      "horizontalDistance"
    )!;
    expect(horizontal.target).toMatchObject({ direction: "negative" });
    expect(horizontal.value).toBeGreaterThan(0);

    const pointLine = createDefaultDimensionDraftV19(
      reversed,
      "point_right",
      "pointLineDistance"
    )!;
    expect(
      measureDimensionTargetV19(pointLine.target, reversed)
    ).toBeGreaterThan(0);

    const angle = createDefaultDimensionDraftV19(
      reversed,
      "line_right",
      "lineAngle"
    )!;
    expect(angle.target).toMatchObject({ sense: "clockwise" });
    expect(angle.value).toBe(90);

    const sweep = createDefaultDimensionDraftV19(
      reversed,
      "arc_clockwise",
      "arcSweep"
    )!;
    expect(sweep.value).toBe(70);
    expect(reversed[3]!.sweepAngleDegrees).toBe(-70);
  });

  it("measures signed arc start and end roles at their authored endpoints", () => {
    const arc = entities.find((entity) => entity.id === "arc_1")!;
    expect(
      measureDimensionTargetV19(
        {
          kind: "pointPair",
          primary: {
            entityId: "arc_1",
            entityKind: "arc",
            role: "start"
          },
          secondary: {
            entityId: "arc_1",
            entityKind: "arc",
            role: "end"
          },
          measurement: "distance"
        },
        entities
      )
    ).toBeCloseTo(Math.sqrt(18));
    expect(arc).toMatchObject({ sweepAngleDegrees: 90 });
  });

  it("enforces exact domains and rejects duplicate driving intent", () => {
    const diameter = createDefaultDimensionDraftV19(
      entities,
      "circle_1",
      "diameter"
    )!;
    expect(
      validateDimensionDraftV19(
        { ...diameter, value: 2e-7 },
        entities,
        parameters
      ).message
    ).toContain("greater than 2e-7");

    const sweep = createDefaultDimensionDraftV19(
      entities,
      "arc_1",
      "arcSweep"
    )!;
    expect(
      validateDimensionDraftV19(
        { ...sweep, value: -359.9 },
        entities,
        parameters
      ).valid
    ).toBe(false);

    const angle = createDefaultDimensionDraftV19(
      entities,
      undefined,
      "lineAngle"
    )!;
    expect(
      validateDimensionDraftV19(
        { ...angle, value: 179.9 },
        entities,
        parameters
      ).valid
    ).toBe(false);

    const existing: SketchDimensionEntryV22 = {
      sourceShape: "v22",
      id: "diameter_1",
      name: "Existing diameter",
      sketchId: "sketch_1",
      target: diameter.target,
      valueSource: { type: "literal", value: 4 },
      effectiveValue: 4,
      status: "healthy",
      issues: []
    };
    expect(
      dimensionTargetKeyV19(dimensionEntryToDraftV19(existing).target)
    ).toBe(dimensionTargetKeyV19(diameter.target));
    expect(
      validateDimensionDraftV19(diameter, entities, parameters, [existing])
        .message
    ).toContain("already has a driving dimension");
    expect(
      createDefaultDimensionDraftV19(entities, "circle_1", "diameter", [
        existing
      ])?.target
    ).toMatchObject({ entityId: "arc_1", role: "diameter" });
    expect(
      createAvailableDimensionFamilyOptionsV19(entities, [existing]).map(
        ({ value }) => value
      )
    ).toContain("diameter");

    const constraint = createDefaultConstraintDraftV19(
      entities,
      undefined,
      "parallel"
    )!;
    const loaded: SketchConstraintEntry = {
      id: "parallel_1",
      name: "Existing parallel",
      sketchId: "sketch_1",
      entityId: "line_2",
      kind: "parallel",
      primaryLineEntityId:
        "primaryLineEntityId" in constraint.definition
          ? constraint.definition.primaryLineEntityId
          : "line_1",
      secondaryLineEntityId:
        "secondaryLineEntityId" in constraint.definition
          ? constraint.definition.secondaryLineEntityId
          : "line_2",
      status: "healthy",
      issues: []
    };
    expect(
      validateConstraintDraftV19(constraint, entities, [loaded]).message
    ).toContain("already have this constraint");
    expect(
      createDefaultConstraintDraftV19(entities, "line_1", "parallel", [loaded])
        ?.definition
    ).toMatchObject({
      kind: "parallel",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_3"
    });
  });

  it("builds normalized create and structural edit batches without losing V22 targets", () => {
    const current: SketchDimensionEntryV22 = {
      sourceShape: "v22",
      id: "dim_1",
      name: "Separation",
      sketchId: "sketch_1",
      target: {
        kind: "pointPair",
        primary: {
          entityId: "point_1",
          entityKind: "point",
          role: "position"
        },
        secondary: {
          entityId: "line_1",
          entityKind: "line",
          role: "start"
        },
        measurement: "distance"
      },
      valueSource: { type: "literal", value: 2 },
      effectiveValue: 2,
      status: "healthy",
      issues: []
    };
    const draft = dimensionEntryToDraftV19(current);
    const next = {
      ...draft,
      name: "Horizontal separation",
      target: {
        ...draft.target,
        measurement: "horizontal",
        direction: "negative"
      } as const,
      valueSourceType: "parameter" as const,
      parameterId: "length"
    };

    expect(buildEditDimensionOpsV19(current, next)).toEqual([
      {
        op: "sketch.dimension.rename",
        id: "dim_1",
        name: "Horizontal separation"
      },
      {
        op: "sketch.dimension.update",
        id: "dim_1",
        target: next.target,
        parameterId: "length"
      }
    ]);
    expect(buildDeleteDimensionOpV19("dim_1")).toEqual({
      op: "sketch.dimension.delete",
      id: "dim_1"
    });
  });

  it("builds exact create/update/rename/delete coverage for every Decision 14 row", () => {
    const available = createAvailableConstraintKindOptionsV19(entities);
    expect(available.map((item) => item.value)).toEqual(
      CONSTRAINT_KIND_OPTIONS_V19.map((item) => item.value)
    );
    for (const option of available) {
      const draft = createDefaultConstraintDraftV19(
        entities,
        undefined,
        option.value
      )!;
      expect(validateConstraintDraftV19(draft, entities)).toEqual({
        valid: true,
        message: "Ready to apply."
      });
      expect(buildCreateConstraintOpsV19("sketch_1", draft)[0]).toMatchObject({
        op: "sketch.constraint.create",
        sketchId: "sketch_1",
        kind: option.value
      });
    }

    const loaded: SketchConstraintEntry = {
      id: "constraint_1",
      name: "Parallel",
      sketchId: "sketch_1",
      entityId: "line_2",
      kind: "parallel",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2",
      status: "healthy",
      issues: []
    };
    const draft = constraintEntryToDraftV19(loaded, entities);
    const next = {
      ...draft,
      name: "Aligned",
      definition: {
        kind: "parallel" as const,
        primaryLineEntityId: "line_2",
        secondaryLineEntityId: "line_3"
      }
    };
    expect(buildEditConstraintOpsV19(loaded, next, entities)).toEqual([
      {
        op: "sketch.constraint.rename",
        id: "constraint_1",
        name: "Aligned"
      },
      {
        op: "sketch.constraint.update",
        id: "constraint_1",
        definition: next.definition
      }
    ]);
    expect(buildDeleteConstraintOpV19("constraint_1")).toEqual({
      op: "sketch.constraint.delete",
      id: "constraint_1"
    });
  });

  it("keeps legacy angle update-only while preserving structural editing", () => {
    const loaded: SketchConstraintEntry = {
      id: "angle_1",
      name: "Legacy angle",
      sketchId: "sketch_1",
      entityId: "line_2",
      kind: "angle",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2",
      angleDegrees: 45,
      status: "healthy",
      issues: []
    };
    const draft = constraintEntryToDraftV19(loaded, entities);
    expect(draft.definition.kind).toBe("angle");
    expect(() => buildCreateConstraintOpsV19("sketch_1", draft)).toThrow(
      /update-only/
    );
    const next = {
      ...draft,
      definition: {
        kind: "angle" as const,
        primaryLineEntityId: "line_2",
        secondaryLineEntityId: "line_3",
        angleDegrees: 60
      }
    };
    expect(buildEditConstraintOpsV19(loaded, next, entities)).toEqual([
      {
        op: "sketch.constraint.update",
        id: "angle_1",
        definition: next.definition
      }
    ]);
  });
});

const parameters = [
  { id: "length", name: "Length", value: 5, description: "" }
] as const;

const entities: readonly SketchEntitySnapshot[] = [
  {
    id: "point_1",
    kind: "point",
    point: [2, 3],
    construction: false
  },
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
    start: [0, 0],
    end: [0, 4],
    construction: false
  },
  {
    id: "line_3",
    kind: "line",
    start: [1, 1],
    end: [4, 4],
    construction: false
  },
  {
    id: "rectangle_1",
    kind: "rectangle",
    center: [0, 0],
    width: 8,
    height: 4,
    construction: false
  },
  {
    id: "circle_1",
    kind: "circle",
    center: [4, 4],
    radius: 2,
    construction: false
  },
  {
    id: "arc_1",
    kind: "arc",
    center: [8, 8],
    radius: 3,
    startAngleDegrees: 0,
    sweepAngleDegrees: 90,
    construction: false
  }
];

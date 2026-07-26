import { describe, expect, it } from "vitest";
import {
  CadEngine,
  exportCadProject,
  importCadProject,
  parseCadProjectJson
} from "./index";

function createDimensionEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
    {
      op: "sketch.addPoint",
      sketchId: "sketch_1",
      id: "point_1",
      point: [0, 3]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_1",
      start: [0, 0],
      end: [4, 0]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_2",
      start: [0, 3],
      end: [0, 7]
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "circle_1",
      center: [8, 0],
      radius: 2
    }
  ]);
  return engine;
}

describe("V19 normalized dimension commands", () => {
  it("creates and updates diameter dimensions with exact radius conversion", () => {
    const engine = createDimensionEngine();

    engine.apply({
      op: "sketch.dimension.create",
      id: "diameter_1",
      name: "Diameter",
      sketchId: "sketch_1",
      target: {
        kind: "entityScalar",
        entityId: "circle_1",
        entityKind: "circle",
        role: "diameter"
      },
      value: 10
    });

    expect(
      engine.getDocument().sketches.get("sketch_1")?.entities.get("circle_1")
    ).toMatchObject({ kind: "circle", radius: 5 });
    expect(exportCadProject(engine)).toMatchObject({
      schemaVersion: "web-cad.project.v22",
      document: {
        sketchDimensions: [
          {
            id: "diameter_1",
            target: { kind: "entityScalar", role: "diameter" },
            valueSource: { type: "literal", value: 10 }
          }
        ]
      }
    });

    engine.apply({
      op: "sketch.dimension.update",
      id: "diameter_1",
      value: 6
    });
    expect(
      engine.getDocument().sketches.get("sketch_1")?.entities.get("circle_1")
    ).toMatchObject({ kind: "circle", radius: 3 });
  });

  it("rejects mismatched kinds, coincident points, owning-line distance, and parameter angles", () => {
    const invalidOps = [
      {
        op: "sketch.dimension.create" as const,
        id: "kind",
        name: "Kind",
        sketchId: "sketch_1",
        target: {
          kind: "entityScalar" as const,
          entityId: "circle_1",
          entityKind: "line" as const,
          role: "length" as const
        },
        value: 1
      },
      {
        op: "sketch.dimension.create" as const,
        id: "same",
        name: "Same",
        sketchId: "sketch_1",
        target: {
          kind: "pointPair" as const,
          primary: {
            entityId: "point_1",
            entityKind: "point" as const,
            role: "position" as const
          },
          secondary: {
            entityId: "point_1",
            entityKind: "point" as const,
            role: "position" as const
          },
          measurement: "distance" as const
        },
        value: 1
      },
      {
        op: "sketch.dimension.create" as const,
        id: "owner",
        name: "Owner",
        sketchId: "sketch_1",
        target: {
          kind: "pointLineDistance" as const,
          point: {
            entityId: "line_1",
            entityKind: "line" as const,
            role: "start" as const
          },
          lineEntityId: "line_1",
          side: "left" as const
        },
        value: 1
      },
      {
        op: "sketch.dimension.create" as const,
        id: "angle",
        name: "Angle",
        sketchId: "sketch_1",
        target: {
          kind: "lineAngle" as const,
          primaryLineEntityId: "line_1",
          secondaryLineEntityId: "line_2",
          sense: "counterclockwise" as const
        },
        parameterId: "parameter_1"
      }
    ];

    for (const op of invalidOps) {
      const result = createDimensionEngine().executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [op]
      });
      expect(result.ok).toBe(false);
    }

    const mixed = createDimensionEngine().executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "sketch.dimension.create",
          id: "mixed",
          name: "Mixed",
          sketchId: "sketch_1",
          entityId: "line_1",
          target: {
            kind: "entityScalar",
            entityId: "line_1",
            entityKind: "line",
            role: "length"
          },
          value: 1
        }
      ]
    } as never);
    expect(mixed).toMatchObject({
      ok: false,
      error: { code: "COMMAND_INPUT_AMBIGUOUS" }
    });
  });

  it("retargets an existing dimension atomically", () => {
    const engine = createDimensionEngine();
    engine.apply({
      op: "sketch.dimension.create",
      id: "scalar_1",
      name: "Circle radius",
      sketchId: "sketch_1",
      target: {
        kind: "entityScalar",
        entityId: "circle_1",
        entityKind: "circle",
        role: "radius"
      },
      value: 3
    });

    engine.apply({
      op: "sketch.dimension.update",
      id: "scalar_1",
      target: {
        kind: "entityScalar",
        entityId: "line_1",
        entityKind: "line",
        role: "length"
      },
      value: 8
    });

    expect(
      engine.getDocument().sketches.get("sketch_1")?.entities.get("line_1")
    ).toMatchObject({ kind: "line", start: [-2, 0], end: [6, 0] });
    expect(engine.getDocument().sketchDimensions.get("scalar_1")).toMatchObject(
      {
        target: { kind: "entityScalar", entityId: "line_1", role: "length" },
        valueSource: { type: "literal", value: 8 }
      }
    );
  });

  it.each([
    {
      id: "distance",
      target: {
        kind: "pointPair" as const,
        primary: {
          entityId: "point_1",
          entityKind: "point" as const,
          role: "position" as const
        },
        secondary: {
          entityId: "circle_1",
          entityKind: "circle" as const,
          role: "center" as const
        },
        measurement: "distance" as const
      },
      value: 5
    },
    {
      id: "horizontal-negative",
      target: {
        kind: "pointPair" as const,
        primary: {
          entityId: "circle_1",
          entityKind: "circle" as const,
          role: "center" as const
        },
        secondary: {
          entityId: "point_1",
          entityKind: "point" as const,
          role: "position" as const
        },
        measurement: "horizontal" as const,
        direction: "negative" as const
      },
      value: 6
    },
    {
      id: "point-line",
      target: {
        kind: "pointLineDistance" as const,
        point: {
          entityId: "point_1",
          entityKind: "point" as const,
          role: "position" as const
        },
        lineEntityId: "line_1",
        side: "left" as const
      },
      value: 5
    },
    {
      id: "angle",
      target: {
        kind: "lineAngle" as const,
        primaryLineEntityId: "line_1",
        secondaryLineEntityId: "line_2",
        sense: "counterclockwise" as const
      },
      value: 60
    }
  ])(
    "solves the normalized $id target through the command path",
    ({ id, target, value }) => {
      const engine = createDimensionEngine();
      const result = engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "sketch.dimension.create",
            id: `dimension_${id}`,
            name: id,
            sketchId: "sketch_1",
            target,
            value
          }
        ]
      });

      expect(result).toMatchObject({ ok: true });
      expect(
        engine.executeQuery({
          version: "cadops.v1",
          query: { query: "sketch.dimension.get", id: `dimension_${id}` }
        })
      ).toMatchObject({
        ok: true,
        dimension: {
          sourceShape: "v22",
          id: `dimension_${id}`,
          status: "healthy",
          effectiveValue: value
        }
      });
    }
  );

  it("rejects a line-angle update that crosses the stored sense branch", () => {
    const engine = createDimensionEngine();
    engine.apply({
      op: "sketch.dimension.create",
      id: "angle_1",
      name: "Angle",
      sketchId: "sketch_1",
      target: {
        kind: "lineAngle",
        primaryLineEntityId: "line_1",
        secondaryLineEntityId: "line_2",
        sense: "counterclockwise"
      },
      value: 90
    });

    const result = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "sketch.dimension.update",
          id: "angle_1",
          target: {
            kind: "lineAngle",
            primaryLineEntityId: "line_1",
            secondaryLineEntityId: "line_2",
            sense: "clockwise"
          },
          value: 90
        }
      ]
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "SKETCH_DIMENSION_ANGLE_SENSE_INVALID" }
    });
  });

  it("round-trips relational history and preserves one-step undo/redo", () => {
    const engine = createDimensionEngine();
    engine.apply({
      op: "sketch.dimension.create",
      id: "distance_1",
      name: "Distance",
      sketchId: "sketch_1",
      target: {
        kind: "pointPair",
        primary: {
          entityId: "point_1",
          entityKind: "point",
          role: "position"
        },
        secondary: {
          entityId: "circle_1",
          entityKind: "circle",
          role: "center"
        },
        measurement: "distance"
      },
      value: 5
    });
    const saved = exportCadProject(engine);
    const restored = importCadProject(
      parseCadProjectJson(JSON.stringify(saved))
    );

    expect(exportCadProject(restored)).toEqual(saved);
    restored.undo();
    expect(restored.getDocument().sketchDimensions.has("distance_1")).toBe(
      false
    );
    restored.redo();
    expect(restored.getDocument().sketchDimensions.get("distance_1")).toEqual(
      engine.getDocument().sketchDimensions.get("distance_1")
    );
    expect(exportCadProject(restored)).toEqual(saved);
  });

  it("scales linear literals and parameters but not angular literals", () => {
    const engine = createDimensionEngine();
    engine.applyBatch([
      { op: "parameter.create", id: "distance_p", name: "Distance", value: 5 },
      {
        op: "sketch.dimension.create",
        id: "diameter_1",
        name: "Diameter",
        sketchId: "sketch_1",
        target: {
          kind: "entityScalar",
          entityId: "circle_1",
          entityKind: "circle",
          role: "diameter"
        },
        value: 4
      },
      {
        op: "sketch.dimension.create",
        id: "distance_1",
        name: "Distance",
        sketchId: "sketch_1",
        target: {
          kind: "pointPair",
          primary: {
            entityId: "point_1",
            entityKind: "point",
            role: "position"
          },
          secondary: {
            entityId: "circle_1",
            entityKind: "circle",
            role: "center"
          },
          measurement: "distance"
        },
        parameterId: "distance_p"
      },
      {
        op: "sketch.dimension.create",
        id: "angle_1",
        name: "Angle",
        sketchId: "sketch_1",
        target: {
          kind: "lineAngle",
          primaryLineEntityId: "line_1",
          secondaryLineEntityId: "line_2",
          sense: "counterclockwise"
        },
        value: 90
      }
    ]);

    engine.apply({
      op: "document.updateUnits",
      units: "cm",
      mode: "preservePhysicalSize"
    });
    expect(engine.getDocument().parameters.get("distance_p")?.value).toBe(0.5);
    expect(
      engine.getDocument().sketchDimensions.get("diameter_1")
    ).toMatchObject({ valueSource: { type: "literal", value: 0.4 } });
    expect(engine.getDocument().sketchDimensions.get("angle_1")).toMatchObject({
      valueSource: { type: "literal", value: 90 }
    });

    const metadataOnly = createDimensionEngine();
    metadataOnly.apply({
      op: "sketch.dimension.create",
      id: "distance_1",
      name: "Distance",
      sketchId: "sketch_1",
      target: {
        kind: "pointLineDistance",
        point: {
          entityId: "point_1",
          entityKind: "point",
          role: "position"
        },
        lineEntityId: "line_1",
        side: "left"
      },
      value: 3
    });
    metadataOnly.apply({
      op: "document.updateUnits",
      units: "cm",
      mode: "metadataOnly"
    });
    expect(
      metadataOnly.getDocument().sketchDimensions.get("distance_1")
    ).toMatchObject({ valueSource: { type: "literal", value: 3 } });
  });
});

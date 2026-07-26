import { describe, expect, it } from "vitest";
import {
  CAD_PROJECT_FORMAT_VERSION_V21,
  CadEngine,
  exportCadProject,
  importCadProject,
  type CadProject
} from "./index";

function createLineEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_1",
      start: [0, 0],
      end: [2, 0]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_2",
      start: [0, 2],
      end: [4, 2]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_3",
      start: [0, 4],
      end: [6, 4]
    }
  ]);
  return engine;
}

function lineLength(engine: CadEngine, id: string): number {
  const entity = engine
    .getDocument()
    .sketches.get("sketch_1")
    ?.entities.get(id);
  if (!entity || entity.kind !== "line") {
    throw new Error(`Missing line: ${id}`);
  }
  return Math.hypot(
    entity.end[0] - entity.start[0],
    entity.end[1] - entity.start[1]
  );
}

describe("V19 constraint create and structural update commands", () => {
  it("creates equal-length constraints and structurally retargets them", () => {
    const engine = createLineEngine();
    engine.apply({
      op: "sketch.constraint.create",
      id: "equal_1",
      name: "Equal pair",
      sketchId: "sketch_1",
      kind: "equalLength",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2"
    });

    expect(lineLength(engine, "line_1")).toBeCloseTo(
      lineLength(engine, "line_2"),
      6
    );

    const updated = engine.apply({
      op: "sketch.constraint.update",
      id: "equal_1",
      definition: {
        kind: "equalLength",
        primaryLineEntityId: "line_1",
        secondaryLineEntityId: "line_3"
      }
    });

    expect(lineLength(engine, "line_1")).toBeCloseTo(
      lineLength(engine, "line_3"),
      6
    );
    expect(engine.getDocument().sketchConstraints.get("equal_1")).toMatchObject(
      {
        id: "equal_1",
        name: "Equal pair",
        sketchId: "sketch_1",
        kind: "equalLength",
        entityId: "line_3",
        primaryLineEntityId: "line_1",
        secondaryLineEntityId: "line_3"
      }
    );
    expect(updated.transaction.diff).toMatchObject({
      sketchConstraints: {
        modified: [
          {
            id: "equal_1",
            kind: "equalLength",
            primaryLineEntityId: "line_1",
            secondaryLineEntityId: "line_3"
          }
        ]
      }
    });

    engine.undo();
    expect(engine.getDocument().sketchConstraints.get("equal_1")).toMatchObject(
      { secondaryLineEntityId: "line_2" }
    );
    engine.redo();
    expect(engine.getDocument().sketchConstraints.get("equal_1")).toMatchObject(
      { secondaryLineEntityId: "line_3" }
    );
    const saved = exportCadProject(engine);
    expect(exportCadProject(importCadProject(saved))).toEqual(saved);
  });

  it("updates an orientation target without changing the stored kind", () => {
    const engine = createLineEngine();
    engine.apply({
      op: "sketch.constraint.create",
      id: "horizontal_1",
      name: "Horizontal",
      sketchId: "sketch_1",
      kind: "horizontal",
      entityId: "line_1"
    });
    engine.apply({
      op: "sketch.constraint.update",
      id: "horizontal_1",
      definition: { kind: "horizontal", entityId: "line_2" }
    });

    expect(
      engine.getDocument().sketchConstraints.get("horizontal_1")
    ).toMatchObject({
      id: "horizontal_1",
      name: "Horizontal",
      kind: "horizontal",
      entityId: "line_2"
    });
  });

  it("rejects kind changes atomically", () => {
    const engine = createLineEngine();
    engine.apply({
      op: "sketch.constraint.create",
      id: "horizontal_1",
      name: "Horizontal",
      sketchId: "sketch_1",
      kind: "horizontal",
      entityId: "line_1"
    });

    const result = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "sketch.constraint.update",
          id: "horizontal_1",
          definition: { kind: "vertical", entityId: "line_1" }
        }
      ]
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_SKETCH_CONSTRAINT" }
    });
    expect(
      engine.getDocument().sketchConstraints.get("horizontal_1")
    ).toMatchObject({ kind: "horizontal", entityId: "line_1" });
  });

  it("keeps dry-run updates immutable", () => {
    const engine = createLineEngine();
    engine.apply({
      op: "sketch.constraint.create",
      id: "horizontal_1",
      name: "Horizontal",
      sketchId: "sketch_1",
      kind: "horizontal",
      entityId: "line_1"
    });
    const before = exportCadProject(engine);
    const result = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [
        {
          op: "sketch.constraint.update",
          id: "horizontal_1",
          definition: { kind: "horizontal", entityId: "line_2" }
        }
      ]
    });

    expect(result).toMatchObject({ ok: true, mode: "dryRun" });
    expect(exportCadProject(engine)).toEqual(before);
  });

  it("allows independent parallel and equal-length rows while rejecting reversed duplicates", () => {
    const engine = createLineEngine();
    engine.apply({
      op: "sketch.constraint.create",
      id: "parallel_1",
      name: "Parallel",
      sketchId: "sketch_1",
      kind: "parallel",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2"
    });
    engine.apply({
      op: "sketch.constraint.create",
      id: "equal_1",
      name: "Equal",
      sketchId: "sketch_1",
      kind: "equalLength",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2"
    });

    const duplicate = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "sketch.constraint.create",
          id: "equal_2",
          name: "Equal reversed",
          sketchId: "sketch_1",
          kind: "equalLength",
          primaryLineEntityId: "line_2",
          secondaryLineEntityId: "line_1"
        }
      ]
    });
    expect(duplicate).toMatchObject({
      ok: false,
      error: { code: "INVALID_SKETCH_CONSTRAINT" }
    });
  });

  it("stores normalized fixed-point updates in the existing V21 source shape", () => {
    const engine = createLineEngine();
    engine.apply({
      op: "sketch.constraint.create",
      id: "fixed_1",
      name: "Fixed",
      sketchId: "sketch_1",
      kind: "fixed",
      target: {
        entityId: "line_1",
        entityKind: "line",
        role: "start"
      },
      coordinate: [0, 0]
    });
    engine.apply({
      op: "sketch.constraint.update",
      id: "fixed_1",
      definition: {
        kind: "fixed",
        target: {
          entityId: "line_2",
          entityKind: "line",
          role: "end"
        },
        coordinate: [4, 2]
      }
    });

    expect(engine.getDocument().sketchConstraints.get("fixed_1")).toEqual({
      id: "fixed_1",
      name: "Fixed",
      sketchId: "sketch_1",
      entityId: "line_2",
      kind: "fixed",
      target: { entityId: "line_2", role: "end" },
      coordinate: [4, 2]
    });
  });

  it("updates retained legacy angle constraints without exposing angle create", () => {
    const base = exportCadProject(createLineEngine());
    const withAngle = {
      ...base,
      schemaVersion: CAD_PROJECT_FORMAT_VERSION_V21,
      history: [],
      redoStack: [],
      document: {
        ...base.document,
        sketches: base.document.sketches.map((sketch) => ({
          ...sketch,
          entities: sketch.entities.map((entity) =>
            entity.id === "line_3" && entity.kind === "line"
              ? {
                  ...entity,
                  start: [0, 0],
                  end: [0, 6],
                  construction: false
                }
              : { ...entity, construction: false }
          )
        })),
        sketchConstraints: [
          {
            id: "angle_1",
            name: "Legacy angle",
            sketchId: "sketch_1",
            entityId: "line_3",
            kind: "angle",
            primaryLineEntityId: "line_1",
            secondaryLineEntityId: "line_3",
            angleDegrees: 90
          }
        ],
        nextSketchConstraintNumber: 2
      }
    } as CadProject;
    const engine = importCadProject(withAngle);

    const result = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "sketch.constraint.update",
          id: "angle_1",
          definition: {
            kind: "angle",
            primaryLineEntityId: "line_1",
            secondaryLineEntityId: "line_3",
            angleDegrees: 60
          }
        }
      ]
    });
    if (!result.ok) {
      throw new Error(JSON.stringify(result.error));
    }
    expect(result).toMatchObject({ ok: true });
    expect(engine.getDocument().sketchConstraints.get("angle_1")).toMatchObject(
      { kind: "angle", angleDegrees: 60 }
    );
  });
});

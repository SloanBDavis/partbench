import { describe, expect, it } from "vitest";
import type { CadOp } from "@web-cad/cad-protocol";
import {
  CadEngine,
  createCadProjectSourceIdentity,
  exportCadProject,
  importCadProject
} from "./index";

const source = () => {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "a", name: "A", plane: "XY" },
    { op: "sketch.create", id: "b", name: "B", plane: "XY" },
    { op: "sketch.addPoint", sketchId: "a", id: "shared", point: [0, 0] }
  ]);
  return engine;
};
const duplicateOps: CadOp[] = [
  { op: "sketch.addPoint", sketchId: "b", id: "shared", point: [1, 1] },
  {
    op: "sketch.addLine",
    sketchId: "b",
    id: "shared",
    start: [0, 0],
    end: [1, 1]
  },
  {
    op: "sketch.addRectangle",
    sketchId: "b",
    id: "shared",
    center: [0, 0],
    width: 2,
    height: 2
  },
  {
    op: "sketch.addCircle",
    sketchId: "b",
    id: "shared",
    center: [0, 0],
    radius: 2
  },
  {
    op: "sketch.addArc",
    sketchId: "b",
    id: "shared",
    definition: {
      kind: "centerAngles",
      center: [0, 0],
      radius: 2,
      startAngleDegrees: 0,
      sweepAngleDegrees: 90
    }
  },
  {
    op: "sketch.addSpline",
    sketchId: "b",
    id: "shared",
    definition: {
      kind: "interpolation",
      points: [
        [0, 0],
        [1, 1],
        [2, 0]
      ]
    }
  }
];

describe("document-wide authored sketch entity identity", () => {
  it("rejects cross-sketch duplicate creation atomically for every ordinary entity family", () => {
    const engine = source();
    const before = createCadProjectSourceIdentity(exportCadProject(engine));
    for (const op of duplicateOps) {
      const result = engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "parameter.create",
            id: "rollback",
            name: "Rollback",
            value: 1
          },
          op
        ]
      });
      expect(result, op.op).toMatchObject({
        ok: false,
        error: {
          code: "SKETCH_ENTITY_ALREADY_EXISTS",
          opIndex: 1,
          path: "$.ops[1].id",
          sketchEntityId: "shared",
          expected: "document-wide unique sketch entity id"
        }
      });
      expect(createCadProjectSourceIdentity(exportCadProject(engine))).toEqual(
        before
      );
    }
  });
  it("preserves same-entity updates and globally generated IDs through native project reopening", () => {
    const engine = source();
    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "a",
      entity: { id: "shared", kind: "point", point: [2, 3] }
    });
    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "sketch.updateEntity",
            sketchId: "b",
            entity: { id: "shared", kind: "point", point: [9, 9] }
          }
        ]
      })
    ).toMatchObject({ ok: false, error: { code: "SKETCH_ENTITY_NOT_FOUND" } });
    engine.applyBatch([
      { op: "sketch.addPoint", sketchId: "a", point: [1, 1] },
      { op: "sketch.addPoint", sketchId: "b", point: [2, 2] }
    ]);
    const ids = [...engine.getDocument().sketches.values()].flatMap(
      (sketch) => [...sketch.entities.keys()]
    );
    expect(new Set(ids).size).toBe(ids.length);
    const saved = exportCadProject(engine);
    expect(exportCadProject(importCadProject(saved))).toEqual(saved);
  });
});

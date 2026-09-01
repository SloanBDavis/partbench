import { describe, expect, it } from "vitest";
import type { CadOp, SketchRegionsProfileRef } from "@web-cad/cad-protocol";

import {
  CAD_PROJECT_FORMAT_VERSION_V21,
  CAD_PROJECT_FORMAT_VERSION_V22,
  CadEngine,
  exportCadProject,
  importCadProject
} from "./index";

const CLOSED_BLOB = [
  [8, 0],
  [4, 6],
  [-4, 6],
  [-8, 0],
  [-4, -6],
  [4, -6]
] as const;

const REVOLVE_BLOB = [
  [8, 2],
  [14, 6],
  [8, 10],
  [10, 6]
] as const;

const SWEEP_BLOB = [
  [3, 0],
  [0, 2],
  [-3, 0],
  [0, -2]
] as const;

function regionsProfile(
  sketchId: string,
  entityId: string
): SketchRegionsProfileRef {
  return {
    kind: "regions",
    sketchId,
    regions: [
      {
        outer: { kind: "entity", entityId },
        holes: []
      }
    ]
  };
}

describe("sketch.addSpline", () => {
  it("creates interpolation spline source records, consumes them on the region path, and stays on v22", () => {
    const engine = new CadEngine();
    const create = engine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_extrude",
        name: "Extrude",
        plane: "XY"
      },
      {
        op: "sketch.addSpline",
        id: "spline_extrude",
        sketchId: "sketch_extrude",
        definition: {
          kind: "interpolation",
          points: [...CLOSED_BLOB],
          closed: true
        }
      }
    ] satisfies readonly CadOp[]);

    expect(create.transaction.ops.map((op) => op.op)).toEqual([
      "sketch.create",
      "sketch.addSpline"
    ]);
    expect(create.transaction.diff).toMatchObject({
      sketches: {
        entitiesCreated: [
          {
            sketchId: "sketch_extrude",
            id: "spline_extrude",
            kind: "spline"
          }
        ],
        entityChanges: [
          {
            sketchId: "sketch_extrude",
            entityId: "spline_extrude",
            action: "added",
            entityKind: "spline"
          }
        ]
      }
    });

    const spline = engine
      .getDocument()
      .sketches.get("sketch_extrude")
      ?.entities.get("spline_extrude");
    expect(spline).toMatchObject({
      kind: "spline",
      form: "interpolation",
      closed: true,
      degree: 3,
      construction: false
    });

    const features = engine.applyBatch([
      {
        op: "feature.extrude",
        id: "feat_extrude",
        bodyId: "body_extrude",
        profile: regionsProfile("sketch_extrude", "spline_extrude"),
        depth: 10,
        operationMode: "newBody"
      },
      {
        op: "sketch.create",
        id: "sketch_revolve",
        name: "Revolve",
        plane: "XY"
      },
      {
        op: "sketch.addSpline",
        id: "spline_revolve",
        sketchId: "sketch_revolve",
        definition: {
          kind: "interpolation",
          points: [...REVOLVE_BLOB],
          closed: true
        }
      },
      {
        op: "sketch.addLine",
        id: "axis_revolve",
        sketchId: "sketch_revolve",
        start: [0, 0],
        end: [0, 12]
      },
      {
        op: "feature.revolve",
        id: "feat_revolve",
        bodyId: "body_revolve",
        profile: regionsProfile("sketch_revolve", "spline_revolve"),
        axis: {
          type: "sketchLine",
          sketchId: "sketch_revolve",
          entityId: "axis_revolve"
        },
        angleDegrees: 360,
        operationMode: "newBody"
      },
      {
        op: "sketch.create",
        id: "sketch_sweep_profile",
        name: "Sweep profile",
        plane: "XY"
      },
      {
        op: "sketch.addSpline",
        id: "spline_sweep",
        sketchId: "sketch_sweep_profile",
        definition: {
          kind: "interpolation",
          points: [...SWEEP_BLOB],
          closed: true
        }
      },
      {
        op: "sketch.create",
        id: "sketch_sweep_path",
        name: "Sweep path",
        plane: "XZ"
      },
      {
        op: "sketch.addLine",
        id: "path_sweep",
        sketchId: "sketch_sweep_path",
        start: [0, 0],
        end: [0, 20]
      },
      {
        op: "feature.sweep",
        id: "feat_sweep",
        bodyId: "body_sweep",
        profile: regionsProfile("sketch_sweep_profile", "spline_sweep"),
        path: {
          kind: "entity",
          sketchId: "sketch_sweep_path",
          entityId: "path_sweep",
          orientation: "forward"
        }
      }
    ] satisfies readonly CadOp[]);

    expect(features.transaction.ops.map((op) => op.op)).toEqual([
      "feature.extrude",
      "sketch.create",
      "sketch.addSpline",
      "sketch.addLine",
      "feature.revolve",
      "sketch.create",
      "sketch.addSpline",
      "sketch.create",
      "sketch.addLine",
      "feature.sweep"
    ]);
    expect(features.transaction.diff).toMatchObject({
      features: {
        created: [
          { id: "feat_extrude", kind: "extrude", bodyId: "body_extrude" },
          { id: "feat_revolve", kind: "revolve", bodyId: "body_revolve" },
          { id: "feat_sweep", kind: "sweep", bodyId: "body_sweep" }
        ]
      }
    });

    const exported = exportCadProject(engine);
    expect(exported.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V22);
    expect(exported.schemaVersion).not.toBe("web-cad.project.v23");
    expect(exported.schemaVersion).not.toBe(CAD_PROJECT_FORMAT_VERSION_V21);

    const roundTrip = importCadProject(exported);
    expect(
      roundTrip.getDocument().sketches.get("sketch_extrude")?.entities.get(
        "spline_extrude"
      )
    ).toMatchObject({ kind: "spline", form: "interpolation", closed: true });
    expect(roundTrip.getDocument().features.get("feat_sweep")).toMatchObject({
      kind: "sweep",
      profile: { kind: "regions" }
    });
  });

  it("rejects a v21-labeled project that stores a spline entity", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_extrude",
        name: "Extrude",
        plane: "XY"
      },
      {
        op: "sketch.addSpline",
        id: "spline_extrude",
        sketchId: "sketch_extrude",
        definition: {
          kind: "interpolation",
          points: [...CLOSED_BLOB],
          closed: true
        }
      }
    ]);
    const exported = exportCadProject(engine);
    expect(() =>
      importCadProject({
        ...exported,
        schemaVersion: CAD_PROJECT_FORMAT_VERSION_V21
      })
    ).toThrow(/spline|INVALID_SKETCH_ENTITY|kind/i);
  });
});

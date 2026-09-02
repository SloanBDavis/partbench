import { describe, expect, it } from "vitest";
import type { CadOp, SketchPathRef } from "@web-cad/cad-protocol";

import {
  CAD_PROJECT_FORMAT_VERSION_V21,
  CAD_PROJECT_FORMAT_VERSION_V22,
  CadEngine,
  createResolvedSweepSource,
  DEFAULT_PART_ID,
  exportCadProject,
  importCadProject
} from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

const COMPOSITE_PATH: SketchPathRef = {
  kind: "chain",
  sketchId: "sketch_path",
  segments: [
    { entityId: "path_line", orientation: "forward" },
    { entityId: "path_spline", orientation: "forward" }
  ]
};

const DISCONNECTED_PATH: SketchPathRef = {
  kind: "chain",
  sketchId: "sketch_path",
  segments: [
    { entityId: "path_line", orientation: "forward" },
    { entityId: "path_disconnected", orientation: "forward" }
  ]
};

function seedCompositeSweepDocument(engine: CadEngine): void {
  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_profile",
      name: "Sweep profile",
      plane: "XY"
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_profile",
      id: "profile_circle",
      center: [0, 0],
      radius: 1
    },
    {
      op: "sketch.create",
      id: "sketch_path",
      name: "Sweep path",
      plane: "XZ"
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_path",
      id: "path_line",
      start: [0, 0],
      end: [0, 10]
    },
    {
      op: "sketch.addSpline",
      id: "path_spline",
      sketchId: "sketch_path",
      definition: {
        kind: "interpolation",
        points: [
          [0, 10],
          [0, 16],
          [0, 22],
          [8, 28]
        ],
        closed: false
      }
    },
    {
      op: "sketch.addSpline",
      id: "path_disconnected",
      sketchId: "sketch_path",
      definition: {
        kind: "interpolation",
        points: [
          [10, 0],
          [14, 2],
          [18, 4]
        ],
        closed: false
      }
    }
  ] satisfies readonly CadOp[]);
}

describe("feature.sweep composite path", () => {
  it("sweeps along a line-plus-spline path, fails illegal geometry structured, and stays on v22", () => {
    const engine = new CadEngine();
    seedCompositeSweepDocument(engine);

    const disconnected = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.sweep",
          id: "feat_sweep_disconnected",
          bodyId: "body_sweep_disconnected",
          profile: {
            kind: "entity",
            sketchId: "sketch_profile",
            entityId: "profile_circle"
          },
          path: DISCONNECTED_PATH
        }
      ]
    });
    expect(disconnected).toMatchObject({
      ok: false,
      error: { code: "SKETCH_PATH_DISCONNECTED" }
    });
    expect(engine.getDocument().features.size).toBe(0);

    const created = engine.apply({
      op: "feature.sweep",
      id: "feat_sweep_composite",
      bodyId: "body_sweep_composite",
      profile: {
        kind: "entity",
        sketchId: "sketch_profile",
        entityId: "profile_circle"
      },
      path: COMPOSITE_PATH
    });

    expect(created.transaction.ops.map((op) => op.op)).toEqual(["feature.sweep"]);
    expect(created.transaction.diff).toMatchObject({
      features: {
        created: [
          {
            id: "feat_sweep_composite",
            kind: "sweep",
            bodyId: "body_sweep_composite"
          }
        ]
      }
    });

    const feature = engine.getDocument().features.get("feat_sweep_composite");
    expect(feature).toMatchObject({
      kind: "sweep",
      path: COMPOSITE_PATH
    });
    if (feature?.kind !== "sweep") {
      throw new Error("Expected a sweep feature.");
    }
    const recipe = createResolvedSweepSource(
      engine.getDocument(),
      feature,
      DEFAULT_PART_ID
    );
    expect(recipe?.pathEntityIds).toEqual(["path_line", "path_spline"]);
    expect(recipe?.path.segments.map((segment) => segment.kind)).toEqual([
      "line",
      "spline"
    ]);
    expect(recipe?.path.segments[0]).toMatchObject({
      kind: "line",
      start: [0, 0],
      end: [0, 10]
    });
    expect(recipe?.path.segments[1]).toMatchObject({
      kind: "spline",
      sourceEntityId: "path_spline"
    });
    const splinePoints = recipe?.path.segments[1];
    if (splinePoints?.kind !== "spline") {
      throw new Error("Expected a spline path segment.");
    }
    expect(splinePoints.points[0]).toEqual([0, 10]);
    expect(splinePoints.points.at(-1)?.[0]).toBeGreaterThan(0);

    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(JSON.stringify(structure)).not.toMatch(PRIVATE_ID_PATTERN);
    expect(structure).toMatchObject({
      ok: true,
      query: "project.structure",
      bodies: [{ id: "body_sweep_composite", featureId: "feat_sweep_composite" }]
    });

    const exported = exportCadProject(engine);
    expect(exported.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V22);
    expect(exported.schemaVersion).not.toBe("web-cad.project.v23");
    expect(exported.schemaVersion).not.toBe(CAD_PROJECT_FORMAT_VERSION_V21);

    const roundTrip = importCadProject(exported);
    expect(roundTrip.getDocument().features.get("feat_sweep_composite")).toMatchObject({
      kind: "sweep",
      path: COMPOSITE_PATH
    });
  });

  it("still accepts a single-line path after the leftover blocker is dropped", () => {
    const engine = new CadEngine();
    seedCompositeSweepDocument(engine);
    engine.apply({
      op: "feature.sweep",
      id: "feat_sweep_line",
      bodyId: "body_sweep_line",
      profileSketchId: "sketch_profile",
      profileEntityId: "profile_circle",
      pathSketchId: "sketch_path",
      pathEntityIds: ["path_line"]
    });
    expect(engine.getDocument().features.get("feat_sweep_line")).toMatchObject({
      kind: "sweep",
      path: {
        kind: "entity",
        sketchId: "sketch_path",
        entityId: "path_line"
      }
    });
  });
});

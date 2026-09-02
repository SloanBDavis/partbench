import { describe, expect, it } from "vitest";
import type { CadOp, LoftSection } from "@web-cad/cad-protocol";

import {
  CAD_PROJECT_FORMAT_VERSION_V20,
  CAD_PROJECT_FORMAT_VERSION_V21,
  CAD_PROJECT_FORMAT_VERSION_V22,
  CadEngine,
  DEFAULT_PART_ID,
  exportCadProject,
  importCadProject
} from "./index";
import { createSourceMeasurementFrame } from "./sourceMeasurementGeometry";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

const NON_PARALLEL_SECTIONS: readonly LoftSection[] = [
  { sketchId: "sketch_xy", entityId: "xy_circle" },
  { sketchId: "sketch_xz", entityId: "xz_circle" }
];

function seedNonParallelLoftDocument(engine: CadEngine): void {
  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_xy",
      name: "XY section",
      plane: "XY"
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_xy",
      id: "xy_circle",
      center: [0, 0],
      radius: 1
    },
    {
      op: "sketch.create",
      id: "sketch_xz",
      name: "XZ section",
      plane: "XZ"
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_xz",
      id: "xz_circle",
      center: [0, 10],
      radius: 1
    },
    {
      op: "sketch.create",
      id: "sketch_xy_coplanar",
      name: "XY coplanar",
      plane: "XY"
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_xy_coplanar",
      id: "xy_coplanar_circle",
      center: [4, 0],
      radius: 1
    }
  ] satisfies readonly CadOp[]);
}

function loftFrameNormal(frame: {
  readonly uAxis: readonly [number, number, number];
  readonly vAxis: readonly [number, number, number];
}): readonly [number, number, number] {
  const normal: [number, number, number] = [
    frame.uAxis[1] * frame.vAxis[2] - frame.uAxis[2] * frame.vAxis[1],
    frame.uAxis[2] * frame.vAxis[0] - frame.uAxis[0] * frame.vAxis[2],
    frame.uAxis[0] * frame.vAxis[1] - frame.uAxis[1] * frame.vAxis[0]
  ];
  const length = Math.hypot(...normal);
  return [normal[0] / length, normal[1] / length, normal[2] / length];
}

describe("feature.loft non-parallel sections", () => {
  it("lofts XY and XZ sections, fails coplanar geometry structured, and stays on v22", () => {
    const engine = new CadEngine();
    seedNonParallelLoftDocument(engine);

    const coplanar = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.loft",
          id: "feat_loft_coplanar",
          bodyId: "body_loft_coplanar",
          sections: [
            { sketchId: "sketch_xy", entityId: "xy_circle" },
            { sketchId: "sketch_xy_coplanar", entityId: "xy_coplanar_circle" }
          ]
        }
      ]
    });
    expect(coplanar).toMatchObject({
      ok: false,
      error: { code: "LOFT_SECTIONS_COPLANAR" }
    });
    expect(engine.getDocument().features.size).toBe(0);

    const created = engine.apply({
      op: "feature.loft",
      id: "feat_loft_nonparallel",
      bodyId: "body_loft_nonparallel",
      sections: [...NON_PARALLEL_SECTIONS]
    });

    expect(created.transaction.ops.map((op) => op.op)).toEqual(["feature.loft"]);
    expect(created.transaction.diff).toMatchObject({
      features: {
        created: [
          {
            id: "feat_loft_nonparallel",
            kind: "loft",
            bodyId: "body_loft_nonparallel"
          }
        ]
      }
    });

    const feature = engine.getDocument().features.get("feat_loft_nonparallel");
    expect(feature).toMatchObject({
      kind: "loft",
      sections: [
        {
          profile: {
            kind: "entity",
            sketchId: "sketch_xy",
            entityId: "xy_circle"
          }
        },
        {
          profile: {
            kind: "entity",
            sketchId: "sketch_xz",
            entityId: "xz_circle"
          }
        }
      ]
    });

    const xy = engine.getDocument().sketches.get("sketch_xy");
    const xz = engine.getDocument().sketches.get("sketch_xz");
    expect(xy?.plane).toBe("XY");
    expect(xz?.plane).toBe("XZ");
    const xyFrame = createSourceMeasurementFrame(
      engine.getDocument(),
      xy!,
      DEFAULT_PART_ID
    );
    const xzFrame = createSourceMeasurementFrame(
      engine.getDocument(),
      xz!,
      DEFAULT_PART_ID
    );
    expect(xyFrame).toBeDefined();
    expect(xzFrame).toBeDefined();
    const xyNormal = loftFrameNormal(xyFrame!);
    const xzNormal = loftFrameNormal(xzFrame!);
    const alignment = Math.abs(
      xyNormal[0] * xzNormal[0] +
        xyNormal[1] * xzNormal[1] +
        xyNormal[2] * xzNormal[2]
    );
    expect(alignment).toBeLessThan(Math.cos((5 * Math.PI) / 180));

    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(JSON.stringify(structure)).not.toMatch(PRIVATE_ID_PATTERN);
    expect(structure).toMatchObject({
      ok: true,
      query: "project.structure",
      bodies: [
        { id: "body_loft_nonparallel", featureId: "feat_loft_nonparallel" }
      ]
    });

    const exported = exportCadProject(engine);
    expect(exported.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);
    expect(exported.schemaVersion).not.toBe("web-cad.project.v23");
    expect(exported.schemaVersion).not.toBe("web-cad.project.v25");
    expect(CAD_PROJECT_FORMAT_VERSION_V22).toBe("web-cad.project.v22");
    expect(CAD_PROJECT_FORMAT_VERSION_V21).toBe("web-cad.project.v21");

    const roundTrip = importCadProject(exported);
    expect(
      roundTrip.getDocument().features.get("feat_loft_nonparallel")
    ).toMatchObject({
      kind: "loft",
      sections: [
        {
          profile: {
            kind: "entity",
            sketchId: "sketch_xy",
            entityId: "xy_circle"
          }
        },
        {
          profile: {
            kind: "entity",
            sketchId: "sketch_xz",
            entityId: "xz_circle"
          }
        }
      ]
    });
  });

  it("still accepts a parallel face-attached leftover after the blocker is dropped", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_base", name: "Base", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_base",
        id: "base_profile",
        center: [0, 0],
        width: 4,
        height: 3
      }
    ]);
    engine.apply({
      op: "feature.extrude",
      id: "feat_pedestal",
      bodyId: "body_pedestal",
      sketchId: "sketch_base",
      entityId: "base_profile",
      depth: 5
    });
    engine.apply({
      op: "sketch.createOnFace",
      id: "sketch_top",
      name: "Top",
      bodyId: "body_pedestal",
      faceStableId: "generated:face:body_pedestal:endCap"
    });
    engine.apply({
      op: "sketch.addCircle",
      sketchId: "sketch_top",
      id: "top_circle",
      center: [0, 0],
      radius: 1
    });
    engine.apply({
      op: "feature.loft",
      id: "feat_loft_parallel",
      bodyId: "body_loft_parallel",
      sections: [
        { sketchId: "sketch_base", entityId: "base_profile" },
        { sketchId: "sketch_top", entityId: "top_circle" }
      ]
    });
    expect(engine.getDocument().features.get("feat_loft_parallel")).toMatchObject({
      kind: "loft",
      bodyId: "body_loft_parallel"
    });
  });
});

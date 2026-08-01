import type { CadOp, SketchRegionsProfileRef } from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";

import {
  CadEngine,
  exportCadProject,
  exportCadProjectJson,
  importCadProject
} from "./index";

const profile: SketchRegionsProfileRef = {
  kind: "regions",
  sketchId: "sketch_1",
  regions: [
    {
      outer: { kind: "entity", entityId: "outer" },
      holes: [{ kind: "entity", entityId: "hole" }]
    }
  ]
};

describe("V19 region revolve command and axis policy", () => {
  it("preserves dry-run/commit parity, audit metadata, stable diff, and one-step undo/redo", () => {
    const engine = createEngine([
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "axis",
        start: [0, -5],
        end: [0, 5],
        construction: true
      }
    ]);
    const op = regionRevolveOp("axis", 360);
    const request = {
      version: "cadops.v1" as const,
      actor: { type: "agent" as const, id: "gate-g-agent" },
      ops: [op]
    };
    const audit = {
      operationCount: 1,
      source: "gate-g-region-revolve",
      requestId: "request-g1",
      toolName: "cad.batch"
    };
    const dryRun = engine.executeBatch({
      ...request,
      mode: "dryRun",
      audit: { ...audit, intent: "dryRun" }
    });
    const committed = engine.executeBatch({
      ...request,
      mode: "commit",
      audit: { ...audit, intent: "commit" }
    });

    expect(dryRun.ok).toBe(true);
    expect(committed.ok).toBe(true);
    if (!dryRun.ok || !committed.ok) return;
    expect(dryRun.semanticDiff).toEqual(committed.semanticDiff);
    expect(committed.actor).toEqual({
      type: "agent",
      id: "gate-g-agent"
    });
    expect(committed.audit).toMatchObject({
      requestId: "request-g1",
      source: "gate-g-region-revolve"
    });
    expect(committed.semanticDiff.features?.inputReferences).toEqual([
      expect.objectContaining({
        featureId: "feature_region_revolve",
        inputKind: "profile",
        after: profile
      })
    ]);
    const saved = exportCadProject(engine);
    expect(saved).toMatchObject({
      schemaVersion: "web-cad.project.v22",
      document: {
        features: [
          expect.objectContaining({
            id: "feature_region_revolve",
            profile,
            angleDegrees: 360,
            operationMode: "newBody"
          })
        ]
      }
    });
    expect(() => importCadProject(saved)).not.toThrow();

    const committedJson = exportCadProjectJson(engine);
    expect(engine.undo()).toBeDefined();
    expect(engine.getDocument().features.has("feature_region_revolve")).toBe(
      false
    );
    expect(engine.redo()).toBeDefined();
    expect(exportCadProjectJson(engine)).toBe(committedJson);
  });

  it("accepts separated and outer-vertex-contact axes for partial and full angles", () => {
    const separated = createEngine([
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "axis",
        start: [0, -5],
        end: [0, 5]
      }
    ]);
    expect(() => separated.apply(regionRevolveOp("axis", 120))).not.toThrow();

    const vertexContact = createEngine([
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "axis",
        start: [0, 1],
        end: [1, 0],
        construction: true
      }
    ]);
    expect(() =>
      vertexContact.apply(regionRevolveOp("axis", 360))
    ).not.toThrow();
  });

  it("projects source-semantic references, exact export source, editability, and topology health", () => {
    const engine = createEngine([
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "axis",
        start: [0, -5],
        end: [0, 5],
        construction: true
      }
    ]);
    engine.apply(regionRevolveOp("axis", 270));

    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.generatedReferences",
          bodyId: "body_region_revolve"
        }
      })
    ).toMatchObject({
      ok: true,
      body: {
        stableId: "generated:body:body_region_revolve",
        profileKind: "regions",
        sourceSketchEntityIds: ["outer", "hole"],
        geometricSignature: {
          sourceKind: "revolve",
          profileKind: "regions",
          revolveAngleDegrees: 270,
          axisRole: "revolveAxis"
        }
      },
      faceCount: 0,
      edgeCount: 0,
      vertexCount: 0,
      axisCount: 1,
      axes: [
        {
          stableId: "generated:axis:body_region_revolve:revolveAxis",
          sourceSketchEntityId: "axis"
        }
      ]
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "feature.editability",
          featureId: "feature_region_revolve",
          proposedEdit: { kind: "revolve", angleDegrees: 180 }
        }
      })
    ).toMatchObject({
      ok: true,
      status: "editable",
      dryRun: { status: "valid" }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.exportExact",
          format: "step",
          bodyIds: ["body_region_revolve"]
        }
      })
    ).toMatchObject({
      ok: true,
      status: "deferred",
      exportSources: [
        {
          bodyId: "body_region_revolve",
          sourceKind: "authoredRevolve",
          profile: {
            kind: "region",
            outer: expect.any(Object),
            holes: [expect.any(Object)]
          },
          angleDegrees: 270
        }
      ]
    });

    const topology = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "body.topology",
        bodyId: "body_region_revolve"
      }
    });
    expect(topology).toMatchObject({
      ok: true,
      topology: {
        status: "unsupported",
        sourceKind: "authoredRevolve",
        sourceIdentity: {
          profileKind: "regions",
          sourceSketchEntityIds: ["outer", "hole"]
        }
      }
    });
    if (!topology.ok || topology.query !== "body.topology") return;
    const derivedExactMetadata = {
      bodyId: "body_region_revolve",
      sourceIdentitySignature: topology.topology.sourceIdentity.signature,
      status: "ready" as const,
      metadata: {
        source: "kernel-derived" as const,
        confidence: "kernel-derived" as const,
        bounds: {
          min: [0, -4, -4] as const,
          max: [4, 4, 4] as const,
          size: [4, 8, 8] as const,
          center: [2, 0, 0] as const
        },
        volume: 64 * Math.PI - 2 * Math.PI ** 2,
        surfaceArea: 100,
        centroid: [2, 0, 0] as const,
        topologyCounts: {
          solidCount: 1,
          faceCount: 6,
          edgeCount: 12,
          vertexCount: 8
        },
        diagnostics: []
      }
    };
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.topology",
          bodyId: "body_region_revolve",
          derivedExactMetadata
        }
      })
    ).toMatchObject({
      ok: true,
      topology: {
        status: "healthy",
        topologyModel: "kernel-derived",
        topologyAvailable: true,
        exactMeasurementsAvailable: true,
        issues: []
      }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.health",
          derivedExactMetadata: [derivedExactMetadata]
        }
      })
    ).toMatchObject({
      ok: true,
      authoredRevolves: [
        {
          featureId: "feature_region_revolve",
          profileKind: "regions",
          sourceEntityIds: ["outer", "hole"],
          topologyStatus: "healthy",
          status: "healthy",
          issues: []
        }
      ]
    });
  });

  it.each([
    {
      label: "outer edge overlap",
      start: [3, -5] as const,
      end: [3, 5] as const
    },
    {
      label: "material crossing",
      start: [4, -5] as const,
      end: [4, 5] as const
    },
    {
      label: "hole-tangent line through outer material",
      start: [3.5, -5] as const,
      end: [3.5, 5] as const
    }
  ])("rejects $label", ({ start, end }) => {
    const engine = createEngine([
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "axis",
        start,
        end
      }
    ]);
    expect(() => engine.apply(regionRevolveOp("axis", 180))).toThrow(
      /crosses|touches|overlaps|axis/i
    );
  });

  it("rejects wrong-sketch axes and multiple regions", () => {
    const engine = createEngine([
      {
        op: "sketch.create",
        id: "sketch_2",
        name: "Other",
        plane: "XY"
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_2",
        id: "axis_other",
        start: [0, -5],
        end: [0, 5]
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        id: "other_region",
        center: [10, 0],
        radius: 1
      }
    ]);
    expect(() =>
      engine.apply({
        ...regionRevolveOp("axis_other", 180),
        axis: {
          type: "sketchLine",
          sketchId: "sketch_2",
          entityId: "axis_other"
        }
      })
    ).toThrow(/same sketch|profile sketch/i);
    expect(() =>
      engine.apply({
        ...regionRevolveOp("axis_other", 180),
        profile: {
          ...profile,
          regions: [
            profile.regions[0],
            {
              outer: { kind: "entity", entityId: "other_region" },
              holes: []
            }
          ]
        }
      })
    ).toThrow(/one material region/i);
  });

  it("retargets explicitly between every supported new-body profile family", () => {
    const regionEngine = createEngine([
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "axis",
        start: [0, -5],
        end: [0, 5]
      }
    ]);
    regionEngine.apply(regionRevolveOp("axis", 180));
    regionEngine.apply({
      op: "feature.updateRevolve",
      id: "feature_region_revolve",
      profile: {
        kind: "entity",
        sketchId: "sketch_1",
        entityId: "outer"
      }
    });
    expect(exportCadProject(regionEngine).document.features[0]).toMatchObject({
      id: "feature_region_revolve",
      profile: {
        kind: "entity",
        sketchId: "sketch_1",
        entityId: "outer"
      }
    });

    const legacyEngine = createEngine([
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "axis",
        start: [0, -5],
        end: [0, 5]
      }
    ]);
    legacyEngine.apply({
      op: "feature.revolve",
      id: "feature_legacy_revolve",
      bodyId: "body_legacy_revolve",
      profile: {
        kind: "entity",
        sketchId: "sketch_1",
        entityId: "outer"
      },
      axis: {
        type: "sketchLine",
        sketchId: "sketch_1",
        entityId: "axis"
      },
      angleDegrees: 180,
      operationMode: "newBody"
    });
    legacyEngine.apply({
      op: "feature.updateRevolve",
      id: "feature_legacy_revolve",
      profile
    });
    expect(exportCadProject(legacyEngine).document.features[0]).toMatchObject({
      id: "feature_legacy_revolve",
      profile
    });
  });

  it("rejects a retained region after source invalidation without allocation or mutation", () => {
    const engine = createEngine([
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "axis",
        start: [0, -5],
        end: [0, 5]
      }
    ]);
    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "hole",
        kind: "circle",
        center: [4.75, 0],
        radius: 0.5,
        construction: false
      }
    });
    const before = exportCadProject(engine);
    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [regionRevolveOp("axis", 180)]
    });

    expect(response).toMatchObject({ ok: false });
    if (response.ok) return;
    expect(response.error.code).toMatch(
      /SKETCH_REGION_HOLE_OUTSIDE|SKETCH_REGION_BOUNDARY_TOUCHING/
    );
    expect(exportCadProject(engine)).toEqual(before);
  });
});

function createEngine(extraOps: readonly CadOp[]): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Hollow", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "outer",
      center: [4, 0],
      width: 2,
      height: 4
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "hole",
      center: [4, 0],
      radius: 0.5
    },
    ...extraOps
  ]);
  return engine;
}

function regionRevolveOp(axisEntityId: string, angleDegrees: number) {
  return {
    op: "feature.revolve" as const,
    id: "feature_region_revolve",
    bodyId: "body_region_revolve",
    profile,
    axis: {
      type: "sketchLine" as const,
      sketchId: "sketch_1",
      entityId: axisEntityId
    },
    angleDegrees,
    operationMode: "newBody" as const
  };
}

import { describe, expect, it } from "vitest";
import type {
  CadBodyGeneratedReferenceEvidenceSnapshot,
  SketchPathRef,
  SketchProfileRef
} from "@web-cad/cad-protocol";
import { CadEngine, exportCadProject } from "./index";

const wireProfile: SketchProfileRef = {
  kind: "wire",
  sketchId: "wire_sketch",
  segments: [
    { entityId: "bottom", orientation: "forward" },
    { entityId: "right", orientation: "forward" },
    { entityId: "top", orientation: "forward" },
    { entityId: "left", orientation: "forward" }
  ]
};

function createCompositeProfileEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "wire_sketch", name: "Wire", plane: "XY" },
    {
      op: "sketch.addLine",
      sketchId: "wire_sketch",
      id: "bottom",
      start: [1, -1],
      end: [3, -1]
    },
    {
      op: "sketch.addLine",
      sketchId: "wire_sketch",
      id: "right",
      start: [3, -1],
      end: [3, 1]
    },
    {
      op: "sketch.addLine",
      sketchId: "wire_sketch",
      id: "top",
      start: [3, 1],
      end: [1, 1]
    },
    {
      op: "sketch.addLine",
      sketchId: "wire_sketch",
      id: "left",
      start: [1, 1],
      end: [1, -1]
    },
    {
      op: "sketch.addLine",
      sketchId: "wire_sketch",
      id: "axis",
      start: [0, -4],
      end: [0, 4],
      construction: true
    },
    {
      op: "feature.extrude",
      id: "wire_extrude",
      bodyId: "wire_extrude_body",
      profile: wireProfile,
      depth: 2,
      side: "positive",
      operationMode: "newBody"
    },
    {
      op: "feature.revolve",
      id: "wire_revolve",
      bodyId: "wire_revolve_body",
      profile: wireProfile,
      axis: {
        type: "sketchLine",
        sketchId: "wire_sketch",
        entityId: "axis"
      },
      angleDegrees: 180,
      operationMode: "newBody"
    }
  ]);
  return engine;
}

function createChainSweepEngine(): CadEngine {
  const path: SketchPathRef = {
    kind: "chain",
    sketchId: "path_sketch",
    segments: [
      { entityId: "path_first", orientation: "forward" },
      { entityId: "path_second", orientation: "forward" }
    ]
  };
  const engine = new CadEngine();
  engine.applyBatch([
    {
      op: "sketch.create",
      id: "profile_sketch",
      name: "Profile",
      plane: "XY"
    },
    {
      op: "sketch.addCircle",
      sketchId: "profile_sketch",
      id: "profile",
      center: [0, 0],
      radius: 0.25
    },
    {
      op: "sketch.create",
      id: "path_sketch",
      name: "Path",
      plane: "XZ"
    },
    {
      op: "sketch.addLine",
      sketchId: "path_sketch",
      id: "path_first",
      start: [0, 0],
      end: [0, 2]
    },
    {
      op: "sketch.addLine",
      sketchId: "path_sketch",
      id: "path_second",
      start: [0, 2],
      end: [0, 5]
    },
    {
      op: "feature.sweep",
      id: "chain_sweep",
      bodyId: "chain_sweep_body",
      profile: {
        kind: "entity",
        sketchId: "profile_sketch",
        entityId: "profile"
      },
      path
    }
  ]);
  return engine;
}

describe("V17 dependency, failure, and generated-reference health", () => {
  it("preserves composite source intent across invalid edits and blocks referenced deletes atomically", () => {
    const engine = createCompositeProfileEngine();
    const beforeDelete = exportCadProject(engine);
    const deleteResult = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "sketch.deleteEntity",
          sketchId: "wire_sketch",
          entityId: "bottom"
        }
      ]
    });
    expect(deleteResult).toMatchObject({
      ok: false,
      error: { code: "SKETCH_ENTITY_IN_USE", sketchEntityId: "bottom" }
    });
    expect(exportCadProject(engine)).toEqual(beforeDelete);

    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "wire_sketch",
      entity: {
        id: "bottom",
        kind: "line",
        start: [1, -1],
        end: [2.5, -1],
        construction: false
      }
    });
    expect(engine.getDocument().features.get("wire_extrude")).toMatchObject({
      profile: wireProfile
    });
    expect(engine.getDocument().features.get("wire_revolve")).toMatchObject({
      profile: wireProfile
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.rebuildPlan" }
      })
    ).toMatchObject({
      ok: true,
      affected: {
        sketchIds: ["wire_sketch"],
        sketchEntityIds: ["bottom", "right", "top", "left", "axis"],
        featureIds: expect.arrayContaining(["wire_extrude", "wire_revolve"]),
        bodyIds: expect.arrayContaining([
          "wire_extrude_body",
          "wire_revolve_body"
        ])
      },
      bodyLifecycles: expect.arrayContaining([
        expect.objectContaining({
          bodyId: "wire_extrude_body",
          primaryState: "stale",
          commandReady: false
        }),
        expect.objectContaining({
          bodyId: "wire_revolve_body",
          rebuildRequired: true,
          commandReady: false
        })
      ])
    });
  });

  it("includes ordered sweep profile and path refs in rebuild impact while construction paths stay valid", () => {
    const engine = createChainSweepEngine();
    for (const entityId of ["path_first", "path_second"]) {
      engine.apply({
        op: "sketch.setEntityConstruction",
        sketchId: "path_sketch",
        entityId,
        construction: true
      });
    }
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "sketch.pathReadiness",
          path: {
            kind: "chain",
            sketchId: "path_sketch",
            segments: [
              { entityId: "path_first", orientation: "forward" },
              { entityId: "path_second", orientation: "forward" }
            ]
          },
          sweepProfile: {
            kind: "entity",
            sketchId: "profile_sketch",
            entityId: "profile"
          }
        }
      })
    ).toMatchObject({ ok: true, status: "ready" });

    engine.apply({
      op: "sketch.setEntityConstruction",
      sketchId: "profile_sketch",
      entityId: "profile",
      construction: true
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.rebuildPlan" }
      })
    ).toMatchObject({
      ok: true,
      affected: {
        sketchIds: ["profile_sketch", "path_sketch"],
        sketchEntityIds: ["profile", "path_first", "path_second"],
        featureIds: ["chain_sweep"],
        bodyIds: ["chain_sweep_body"]
      },
      bodyLifecycles: [
        expect.objectContaining({
          bodyId: "chain_sweep_body",
          primaryState: "stale",
          commandReady: false
        })
      ]
    });
  });

  it("reports explicit unavailable or ambiguous correspondence for composite revolves and curved sweeps", () => {
    const engine = createCompositeProfileEngine();
    engine.applyBatch([
      {
        op: "sketch.create",
        id: "sweep_profile_sketch",
        name: "Sweep profile",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "sweep_profile_sketch",
        id: "sweep_profile",
        center: [0, 0],
        radius: 0.25
      },
      {
        op: "sketch.create",
        id: "sweep_path_sketch",
        name: "Sweep path",
        plane: "XZ"
      },
      {
        op: "sketch.addArc",
        sketchId: "sweep_path_sketch",
        id: "sweep_arc",
        definition: {
          kind: "centerAngles",
          center: [1, 0],
          radius: 1,
          startAngleDegrees: 180,
          sweepAngleDegrees: -90
        }
      },
      {
        op: "feature.sweep",
        id: "curved_sweep",
        bodyId: "curved_sweep_body",
        profile: {
          kind: "entity",
          sketchId: "sweep_profile_sketch",
          entityId: "sweep_profile"
        },
        path: {
          kind: "entity",
          sketchId: "sweep_path_sketch",
          entityId: "sweep_arc",
          orientation: "forward"
        }
      }
    ]);

    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.generatedReferences",
          bodyId: "wire_revolve_body"
        }
      })
    ).toMatchObject({
      ok: false,
      error: {
        code: "GENERATED_REFERENCE_CORRESPONDENCE_UNPROVEN",
        generatedReferencesStatus: "unavailable"
      }
    });

    const ambiguousEvidence: CadBodyGeneratedReferenceEvidenceSnapshot = {
      bodyId: "curved_sweep_body",
      sourceIdentitySignature: "unproven",
      status: "ambiguous",
      faces: [],
      edges: [],
      diagnostic: "Kernel correspondence was not unique."
    };
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.resolveGeneratedReference",
          bodyId: "curved_sweep_body",
          stableId: "generated:body:curved_sweep_body",
          derivedGeneratedReferences: ambiguousEvidence
        }
      })
    ).toMatchObject({
      ok: false,
      error: {
        code: "GENERATED_REFERENCE_CORRESPONDENCE_UNPROVEN",
        generatedReferencesStatus: "ambiguous"
      }
    });
  });
});

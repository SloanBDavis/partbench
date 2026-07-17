import {
  CadEngine,
  type CadFeatureSummary,
  type SketchSnapshot
} from "@web-cad/cad-core";
import type { CadBodyGeneratedReferenceEvidenceSnapshot } from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";

import type {
  DerivedExtrudeGeometrySource,
  DerivedGeometryReadyEntry
} from "./derivedGeometry";
import { createCompositeGeneratedFaceFrames } from "./compositeGeneratedFaceFrames";
import { createBodyGeneratedReferenceEvidence } from "./derivedGeneratedReferences";
import {
  createAuthoredFeatureDerivedGeometrySources,
  createExtrudeDerivedGeometrySources
} from "./derivedGeometrySources";
import { createGeneratedFaceReferenceKey } from "./sketchDisplayFrames";

describe("composite generated face frames", () => {
  it("derives exact cap and planar line-side frames from the wire recipe", () => {
    const frames = createCompositeGeneratedFaceFrames(
      [wireSource()],
      new Map([["body_wire", readyEvidence()]])
    );

    expect(
      frames.get(
        createGeneratedFaceReferenceKey(
          "body_wire",
          "generated:face:body_wire:startCap"
        )
      )
    ).toEqual({
      origin: [10, 20, 28],
      uAxis: [-1, 0, 0],
      vAxis: [0, 1, 0]
    });
    expect(
      frames.get(
        createGeneratedFaceReferenceKey(
          "body_wire",
          "generated:face:body_wire:endCap"
        )
      )
    ).toEqual({
      origin: [10, 20, 32],
      uAxis: [1, 0, 0],
      vAxis: [0, 1, 0]
    });
    expect(
      frames.get(
        createGeneratedFaceReferenceKey(
          "body_wire",
          "generated:face:body_wire:side:line_1"
        )
      )
    ).toEqual({
      origin: [10, 20, 28],
      uAxis: [1, 0, 0],
      vAxis: [0, 0, 1]
    });
    expect(
      frames.has(
        createGeneratedFaceReferenceKey(
          "body_wire",
          "generated:face:body_wire:side:arc_1"
        )
      )
    ).toBe(false);
  });

  it("places one downstream extrude on a proven composite planar side in pass two", () => {
    const frames = createCompositeGeneratedFaceFrames(
      [wireSource()],
      new Map([["body_wire", readyEvidence()]])
    );
    const sketch: SketchSnapshot = {
      id: "sketch_downstream",
      name: "Downstream sketch",
      plane: "XZ",
      attachment: {
        kind: "generatedFace",
        bodyId: "body_wire",
        faceStableId: "generated:face:body_wire:side:line_1",
        sourceFeatureId: "feature_wire",
        sourceSketchId: "sketch_wire",
        sourceSketchEntityId: "line_1",
        faceRole: "side:segment:line_1"
      },
      entities: [
        {
          id: "rect_downstream",
          kind: "rectangle",
          center: [0, 0],
          width: 1,
          height: 1,
          construction: false
        }
      ]
    };
    const feature: Extract<CadFeatureSummary, { kind: "extrude" }> = {
      id: "feature_downstream",
      kind: "extrude",
      partId: "part:default",
      bodyId: "body_downstream",
      sketchId: sketch.id,
      entityId: "rect_downstream",
      profileKind: "rectangle",
      depth: 1,
      side: "positive",
      operationMode: "newBody",
      source: {
        type: "sketchEntity",
        sketchId: sketch.id,
        entityId: "rect_downstream"
      }
    };

    const [downstream] = createExtrudeDerivedGeometrySources(
      [feature],
      [sketch],
      new Map(),
      new Set(),
      frames
    );

    expect(downstream).toMatchObject({
      id: "body_downstream",
      kind: "extrude",
      placementFrame: {
        origin: [10, 20, 28],
        uAxis: [1, 0, 0],
        vAxis: [0, 0, 1]
      }
    });
    expect(downstream).not.toHaveProperty("placementError");
  });

  it("carries current kernel correspondence through the core query into line-side placement", () => {
    const engine = createWireEngine();
    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(structure).toMatchObject({ ok: true, query: "project.structure" });
    if (!structure.ok || structure.query !== "project.structure") return;

    const sketches = [...engine.getDocument().sketches.values()].map(
      (sketch) => ({
        id: sketch.id,
        name: sketch.name,
        plane: sketch.plane,
        attachment: sketch.attachment,
        entities: [...sketch.entities.values()]
      })
    );
    const firstPass = createAuthoredFeatureDerivedGeometrySources(
      structure.features,
      sketches
    );
    const source = firstPass.find(
      (candidate): candidate is DerivedExtrudeGeometrySource =>
        candidate.id === "body_wire" &&
        candidate.kind === "extrude" &&
        candidate.profile.kind === "wire"
    );
    expect(source?.profile.kind).toBe("wire");
    if (!source || source.profile.kind !== "wire") return;

    const topology = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: source.id }
    });
    expect(topology).toMatchObject({ ok: true, query: "body.topology" });
    if (!topology.ok || topology.query !== "body.topology") return;

    const generatedReferences: NonNullable<
      DerivedGeometryReadyEntry["generatedReferences"]
    > = {
      status: "ready",
      sourceIdentity: source.profile.sourceIdentity,
      faces: [
        {
          role: "startCap",
          surfaceClass: "plane",
          evidence: "kernel-builder"
        },
        {
          role: "endCap",
          surfaceClass: "plane",
          evidence: "kernel-builder"
        },
        {
          role: "side",
          sourceEntityId: "line_1",
          surfaceClass: "plane",
          evidence: "kernel-builder"
        },
        {
          role: "side",
          sourceEntityId: "arc_1",
          surfaceClass: "cylinder",
          evidence: "kernel-builder"
        }
      ],
      edges: [
        ...["line_1", "arc_1"].flatMap((sourceEntityId) => [
          {
            role: "startCapBoundary" as const,
            sourceEntityId,
            evidence: "kernel-builder" as const
          },
          {
            role: "endCapBoundary" as const,
            sourceEntityId,
            evidence: "kernel-builder" as const
          }
        ]),
        {
          role: "longitudinal",
          adjacentSourceEntityIds: ["line_1", "arc_1"],
          evidence: "kernel-builder"
        },
        {
          role: "longitudinal",
          adjacentSourceEntityIds: ["arc_1", "line_1"],
          evidence: "kernel-builder"
        }
      ]
    };
    const snapshotEntry = readyGeometryEntry(source.id, generatedReferences);
    const evidence = createBodyGeneratedReferenceEvidence(
      source.id,
      topology.topology.sourceIdentity.signature,
      {
        entries: [snapshotEntry],
        meshes: [snapshotEntry.mesh],
        supportedCount: 1,
        pendingCount: 0,
        readyCount: 1,
        errorCount: 0
      },
      firstPass
    );
    expect(evidence?.status).toBe("ready");
    if (!evidence) return;

    const references = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "body.generatedReferences",
        bodyId: source.id,
        derivedGeneratedReferences: evidence
      }
    });
    expect(references).toMatchObject({ ok: true });
    if (!references.ok || references.query !== "body.generatedReferences") {
      return;
    }
    expect(
      references.faces.find(
        (face) =>
          face.stableId === "generated:face:body_wire:side:line_1"
      )
    ).toMatchObject({
      eligibleOperations: expect.arrayContaining([
        "feature.attachSketchPlane",
        "feature.shell",
        "feature.measureReference",
        "feature.selectReference"
      ])
    });

    const frames = createCompositeGeneratedFaceFrames(
      firstPass,
      new Map([[source.id, evidence]])
    );
    expect(
      frames.get(
        createGeneratedFaceReferenceKey(
          source.id,
          "generated:face:body_wire:side:line_1"
        )
      )
    ).toEqual({
      origin: [0, 0, 0],
      uAxis: [1, 0, 0],
      vAxis: [0, 0, 1]
    });
  });
});

function createWireEngine(): CadEngine {
  const engine = new CadEngine();
  engine.apply({
    op: "sketch.create",
    id: "sketch_wire",
    name: "Wire",
    plane: "XY"
  });
  engine.applyBatch([
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire",
      id: "line_1",
      start: [0, 0],
      end: [2, 0]
    },
    {
      op: "sketch.addArc",
      sketchId: "sketch_wire",
      id: "arc_1",
      definition: {
        kind: "centerAngles",
        center: [1, 0],
        radius: 1,
        startAngleDegrees: 0,
        sweepAngleDegrees: 180
      }
    }
  ]);
  engine.apply({
    op: "feature.extrude",
    id: "feature_wire",
    bodyId: "body_wire",
    profile: {
      kind: "wire",
      sketchId: "sketch_wire",
      segments: [
        { entityId: "line_1", orientation: "forward" },
        { entityId: "arc_1", orientation: "forward" }
      ]
    },
    depth: 4,
    operationMode: "newBody"
  });
  return engine;
}

function readyGeometryEntry(
  objectId: string,
  generatedReferences: NonNullable<
    DerivedGeometryReadyEntry["generatedReferences"]
  >
): DerivedGeometryReadyEntry {
  return {
    objectId,
    objectKind: "extrude",
    sourceId: objectId,
    sourceKind: "extrude",
    cacheKey: "ready-wire",
    status: "ready",
    mesh: {
      id: objectId,
      kind: "mesh",
      vertices: [],
      indices: [],
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      }
    },
    metrics: {
      objectId,
      roundTripMs: 1,
      vertexCount: 0,
      triangleCount: 0
    },
    generatedReferences
  };
}

function wireSource(): DerivedExtrudeGeometrySource {
  return {
    id: "body_wire",
    kind: "extrude",
    sketchPlane: "XY",
    profile: {
      kind: "wire",
      frame: {
        origin: [10, 20, 30],
        uAxis: [1, 0, 0],
        vAxis: [0, 1, 0]
      },
      closed: true,
      segments: [
        {
          kind: "line",
          sourceEntityId: "line_1",
          start: [0, 0],
          end: [2, 0]
        },
        {
          kind: "arc",
          sourceEntityId: "arc_1",
          center: [1, 0],
          radius: 1,
          startAngleDegrees: 0,
          sweepAngleDegrees: 180
        }
      ],
      sourceIdentity: "wire-recipe",
      geometryPolicy: {
        linearTolerance: 1e-7,
        angularToleranceDegrees: 0.1,
        minimumProfileArea: 1e-12
      }
    },
    depth: 4,
    side: "symmetric"
  };
}

function readyEvidence(): CadBodyGeneratedReferenceEvidenceSnapshot {
  return {
    bodyId: "body_wire",
    sourceIdentitySignature: "wire-topology-signature",
    recipeIdentity: "wire-recipe",
    status: "ready",
    faces: [
      {
        role: "startCap",
        surfaceClass: "plane",
        evidence: "kernel-builder"
      },
      {
        role: "endCap",
        surfaceClass: "plane",
        evidence: "kernel-builder"
      },
      {
        role: "side",
        sourceEntityId: "line_1",
        surfaceClass: "plane",
        evidence: "kernel-builder"
      },
      {
        role: "side",
        sourceEntityId: "arc_1",
        surfaceClass: "cylinder",
        evidence: "kernel-builder"
      }
    ],
    edges: []
  };
}

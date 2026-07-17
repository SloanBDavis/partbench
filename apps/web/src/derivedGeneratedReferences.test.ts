import { describe, expect, it } from "vitest";

import type {
  DerivedExtrudeGeometrySource,
  DerivedGeometryReadyEntry,
  DerivedGeometrySnapshot
} from "./derivedGeometry";
import { createBodyGeneratedReferenceEvidence } from "./derivedGeneratedReferences";

describe("derived generated-reference freshness", () => {
  it("binds ready kernel evidence to the current body topology signature", () => {
    const evidence = createBodyGeneratedReferenceEvidence(
      "body_wire",
      "current-topology-signature",
      snapshot(
        readyEntry({
          status: "ready",
          sourceIdentity: "current-recipe",
          faces: [
            {
              role: "side",
              sourceEntityId: "arc_1",
              surfaceClass: "cylinder",
              evidence: "kernel-builder"
            }
          ],
          edges: []
        })
      ),
      [wireSource("current-recipe")]
    );

    expect(evidence).toEqual({
      bodyId: "body_wire",
      sourceIdentitySignature: "current-topology-signature",
      recipeIdentity: "current-recipe",
      status: "ready",
      faces: [
        {
          role: "side",
          sourceEntityId: "arc_1",
          surfaceClass: "cylinder",
          evidence: "kernel-builder"
        }
      ],
      edges: []
    });
  });

  it.each(["unavailable", "ambiguous"] as const)(
    "keeps %s explicit while exposing no references",
    (status) => {
      const evidence = createBodyGeneratedReferenceEvidence(
        "body_wire",
        "current-topology-signature",
        snapshot(
          readyEntry({
            status,
            sourceIdentity: "current-recipe",
            faces: [
              {
                role: "side",
                sourceEntityId: "line_1",
                surfaceClass: "plane",
                evidence: "kernel-builder"
              }
            ],
            edges: [],
            diagnostic: "Correspondence could not be proven."
          })
        ),
        [wireSource("current-recipe")]
      );

      expect(evidence).toEqual({
        bodyId: "body_wire",
        sourceIdentitySignature: "current-topology-signature",
        recipeIdentity: "current-recipe",
        status,
        faces: [],
        edges: [],
        diagnostic: "Correspondence could not be proven."
      });
    }
  );

  it("rejects previous-generation evidence after a recipe edit", () => {
    expect(
      createBodyGeneratedReferenceEvidence(
        "body_wire",
        "new-topology-signature",
        snapshot(
          readyEntry({
            status: "ready",
            sourceIdentity: "old-recipe",
            faces: [],
            edges: []
          })
        ),
        [wireSource("new-recipe")]
      )
    ).toBeUndefined();
  });

  it("rejects internally inconsistent ready evidence", () => {
    expect(
      createBodyGeneratedReferenceEvidence(
        "body_wire",
        "current-topology-signature",
        snapshot(
          readyEntry({
            status: "ready",
            sourceIdentity: "current-recipe",
            faces: [],
            edges: [],
            diagnostic: "Unexpected partial correspondence."
          })
        ),
        [wireSource("current-recipe")]
      )
    ).toBeUndefined();
  });

  it("rejects ready kernel evidence with an invalid discriminated shape", () => {
    const source = wireSource("current-recipe");
    for (const generatedReferences of [
      {
        status: "ready" as const,
        sourceIdentity: "current-recipe",
        faces: [
          {
            role: "side" as const,
            surfaceClass: "plane" as const,
            evidence: "kernel-builder" as const
          }
        ],
        edges: []
      },
      {
        status: "ready" as const,
        sourceIdentity: "current-recipe",
        faces: [],
        edges: [
          {
            role: "longitudinal" as const,
            sourceEntityId: "line_1",
            evidence: "kernel-builder" as const
          }
        ]
      }
    ]) {
      expect(
        createBodyGeneratedReferenceEvidence(
          "body_wire",
          "current-topology-signature",
          snapshot(readyEntry(generatedReferences)),
          [source]
        )
      ).toBeUndefined();
    }
  });

  it("rejects pending and failed generations that contain no current evidence", () => {
    const source = wireSource("current-recipe");
    for (const status of ["pending", "error"] as const) {
      const entry =
        status === "pending"
          ? {
              objectId: "body_wire",
              objectKind: "extrude" as const,
              sourceId: "body_wire",
              sourceKind: "extrude" as const,
              cacheKey: "pending",
              status
            }
          : {
              objectId: "body_wire",
              objectKind: "extrude" as const,
              sourceId: "body_wire",
              sourceKind: "extrude" as const,
              cacheKey: "error",
              status,
              error: {
                code: "COMPOSITE_EXTRUDE_GEOMETRY_FAILED",
                stage: "geometry-kernel",
                message: "failed",
                workerStarted: true,
                wasmLoadStatus: "loaded"
              }
            };
      expect(
        createBodyGeneratedReferenceEvidence(
          "body_wire",
          "current-topology-signature",
          { ...snapshot(), entries: [entry] },
          [source]
        )
      ).toBeUndefined();
    }
  });
});

function wireSource(sourceIdentity: string): DerivedExtrudeGeometrySource {
  return {
    id: "body_wire",
    kind: "extrude",
    sketchPlane: "XY",
    profile: {
      kind: "wire",
      frame: {
        origin: [0, 0, 0],
        uAxis: [1, 0, 0],
        vAxis: [0, 1, 0]
      },
      closed: true,
      segments: [
        {
          kind: "line",
          sourceEntityId: "line_1",
          start: [0, 0],
          end: [1, 0]
        },
        {
          kind: "line",
          sourceEntityId: "line_2",
          start: [1, 0],
          end: [0, 0]
        }
      ],
      sourceIdentity,
      geometryPolicy: {
        linearTolerance: 1e-7,
        angularToleranceDegrees: 0.1,
        minimumProfileArea: 1e-12
      }
    },
    depth: 1,
    side: "positive"
  };
}

function readyEntry(
  generatedReferences: NonNullable<
    DerivedGeometryReadyEntry["generatedReferences"]
  >
): DerivedGeometryReadyEntry {
  return {
    objectId: "body_wire",
    objectKind: "extrude",
    sourceId: "body_wire",
    sourceKind: "extrude",
    cacheKey: "ready",
    status: "ready",
    mesh: {
      id: "body_wire",
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
      objectId: "body_wire",
      roundTripMs: 1,
      vertexCount: 0,
      triangleCount: 0
    },
    generatedReferences
  };
}

function snapshot(entry?: DerivedGeometryReadyEntry): DerivedGeometrySnapshot {
  return {
    entries: entry ? [entry] : [],
    meshes: entry ? [entry.mesh] : [],
    supportedCount: entry ? 1 : 0,
    pendingCount: 0,
    readyCount: entry ? 1 : 0,
    errorCount: 0
  };
}

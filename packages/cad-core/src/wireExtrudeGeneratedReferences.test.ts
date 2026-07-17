import { describe, expect, it } from "vitest";
import type {
  CadBodyGeneratedReferenceEvidenceSnapshot,
  CadBodyDerivedExactMetadataSnapshot,
  CadBodyExactTopologyEntityDescriptor,
  CadQueryRequest
} from "@web-cad/cad-protocol";

import { CadEngine } from "./index";

const profile = {
  kind: "wire" as const,
  sketchId: "sketch_wire",
  segments: [
    { entityId: "line_a", orientation: "forward" as const },
    { entityId: "line_b", orientation: "forward" as const },
    { entityId: "line_c", orientation: "forward" as const },
    { entityId: "line_d", orientation: "forward" as const }
  ]
};

function createEngine(): CadEngine {
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
      id: "line_a",
      start: [0, 0],
      end: [4, 0]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire",
      id: "line_b",
      start: [4, 0],
      end: [4, 3]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire",
      id: "line_c",
      start: [4, 3],
      end: [0, 3]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire",
      id: "line_d",
      start: [0, 3],
      end: [0, 0]
    }
  ]);
  engine.apply({
    op: "feature.extrude",
    id: "feature_wire",
    bodyId: "body_wire",
    profile,
    depth: 5,
    operationMode: "newBody"
  });
  return engine;
}

function createArcEngine(reversedArc = false): CadEngine {
  const engine = new CadEngine();
  engine.apply({
    op: "sketch.create",
    id: "sketch_wire",
    name: "Arc wire",
    plane: "XY"
  });
  engine.applyBatch([
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire",
      id: "line_a",
      start: [0, 0],
      end: [4, 0]
    },
    {
      op: "sketch.addArc",
      sketchId: "sketch_wire",
      id: "arc_b",
      definition: {
        kind: "centerAngles",
        center: [4, 2],
        radius: 2,
        startAngleDegrees: reversedArc ? 90 : -90,
        sweepAngleDegrees: reversedArc ? -180 : 180
      }
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire",
      id: "line_c",
      start: [4, 4],
      end: [0, 4]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_wire",
      id: "line_d",
      start: [0, 4],
      end: [0, 0]
    }
  ]);
  engine.apply({
    op: "feature.extrude",
    id: "feature_wire",
    bodyId: "body_wire",
    profile: {
      ...profile,
      segments: [
        profile.segments[0]!,
        {
          entityId: "arc_b",
          orientation: reversedArc ? "reverse" : "forward"
        },
        profile.segments[2]!,
        profile.segments[3]!
      ]
    },
    depth: 5,
    operationMode: "newBody"
  });
  return engine;
}

function sourceIdentitySignature(engine: CadEngine): string {
  const result = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "body.topology", bodyId: "body_wire" }
  });
  if (!result.ok || result.query !== "body.topology") {
    throw new Error(result.ok ? "Unexpected query" : result.error.message);
  }
  return result.topology.sourceIdentity.signature;
}

function createEvidence(
  engine: CadEngine
): Extract<CadBodyGeneratedReferenceEvidenceSnapshot, { status: "ready" }> {
  const ids = profile.segments.map((segment) => segment.entityId);
  return {
    bodyId: "body_wire",
    sourceIdentitySignature: sourceIdentitySignature(engine),
    recipeIdentity: "partbench-wire-extrude-v1:test",
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
      ...ids.map((sourceEntityId) => ({
        role: "side" as const,
        sourceEntityId,
        surfaceClass: "plane" as const,
        evidence: "kernel-builder" as const
      }))
    ],
    edges: [
      ...ids.flatMap((sourceEntityId) => [
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
      ...ids.map((sourceEntityId, index) => ({
        role: "longitudinal" as const,
        adjacentSourceEntityIds: [
          sourceEntityId,
          ids[(index + 1) % ids.length]!
        ] as const,
        evidence: "kernel-builder" as const
      }))
    ]
  };
}

function generatedReferences(
  engine: CadEngine,
  evidence?: CadBodyGeneratedReferenceEvidenceSnapshot
) {
  return engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "body.generatedReferences",
      bodyId: "body_wire",
      ...(evidence ? { derivedGeneratedReferences: evidence } : {})
    }
  });
}

function createExactTopologyMetadata(
  engine: CadEngine
): CadBodyDerivedExactMetadataSnapshot {
  const entities: CadBodyExactTopologyEntityDescriptor[] = [
    {
      localId: "body:0",
      kind: "body",
      source: "kernel-derived",
      signature: "body"
    },
    {
      localId: "solid:0",
      kind: "solid",
      source: "kernel-derived",
      signature: "solid"
    },
    ...Array.from({ length: 6 }, (_, index) => ({
      localId: `face:${index}`,
      kind: "face" as const,
      source: "kernel-derived" as const,
      signature: `face-${index}`
    })),
    ...Array.from({ length: 12 }, (_, index) => ({
      localId: `edge:${index}`,
      kind: "edge" as const,
      source: "kernel-derived" as const,
      signature: `edge-${index}`
    })),
    ...Array.from({ length: 8 }, (_, index) => ({
      localId: `vertex:${index}`,
      kind: "vertex" as const,
      source: "kernel-derived" as const,
      signature: `vertex-${index}`
    }))
  ];
  return {
    bodyId: "body_wire",
    sourceIdentitySignature: sourceIdentitySignature(engine),
    status: "ready",
    metadata: {
      source: "kernel-derived",
      confidence: "kernel-derived",
      volume: 60,
      topologyCounts: {
        solidCount: 1,
        faceCount: 6,
        edgeCount: 12,
        vertexCount: 8
      },
      topologySnapshot: {
        source: "kernel-derived",
        status: "ready",
        entityCounts: {
          bodyCount: 1,
          solidCount: 1,
          faceCount: 6,
          wireCount: 0,
          edgeCount: 12,
          vertexCount: 8,
          loopCount: 0,
          coedgeCount: 0,
          axisCount: 0
        },
        entityCount: entities.length,
        entities,
        unsupportedEntityKinds: [],
        adjacencyAvailable: false,
        signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
        signature: "wire-exact-topology",
        diagnostics: []
      },
      diagnostics: []
    }
  };
}

describe("V17 composite wire extrude generated references", () => {
  it("publishes only exact current correspondence with ordered source roles", () => {
    const engine = createEngine();
    const evidence = createEvidence(engine);
    const result = generatedReferences(engine, evidence);

    expect(result).toMatchObject({
      ok: true,
      query: "body.generatedReferences",
      body: {
        profileKind: "wire",
        sourceSketchEntityIds: ["line_a", "line_b", "line_c", "line_d"]
      },
      faceCount: 6,
      edgeCount: 12,
      vertexCount: 0
    });
    if (!result.ok || result.query !== "body.generatedReferences") return;
    expect(result.faces.map((face) => face.role)).toEqual([
      "startCap",
      "endCap",
      "side:segment:line_a",
      "side:segment:line_b",
      "side:segment:line_c",
      "side:segment:line_d"
    ]);
    for (const reference of [
      result.body,
      ...result.faces,
      ...result.edges,
      ...result.vertices,
      ...result.axes
    ]) {
      expect(reference).toMatchObject({
        eligibleOperations: ["feature.selectReference"],
        eligibilityNotes: [expect.stringContaining("topology-anchor proof")]
      });
    }
    expect(result.edges.map((edge) => edge.role)).toEqual([
      "start:segment:line_a",
      "end:segment:line_a",
      "start:segment:line_b",
      "end:segment:line_b",
      "start:segment:line_c",
      "end:segment:line_c",
      "start:segment:line_d",
      "end:segment:line_d",
      "longitudinal:join:line_a:line_b",
      "longitudinal:join:line_b:line_c",
      "longitudinal:join:line_c:line_d",
      "longitudinal:join:line_d:line_a"
    ]);

    const resolved = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "body.resolveGeneratedReference",
        bodyId: "body_wire",
        stableId: "generated:face:body_wire:side:line_b",
        derivedGeneratedReferences: evidence
      }
    });
    expect(resolved).toMatchObject({
      ok: true,
      kind: "face",
      reference: {
        role: "side:segment:line_b",
        sourceSketchEntityId: "line_b"
      }
    });
  });

  it("publishes an arc-derived cylindrical side without planar operations", () => {
    const engine = createArcEngine();
    const base = createEvidence(engine);
    const replaceId = (id: string) => (id === "line_b" ? "arc_b" : id);
    const evidence: CadBodyGeneratedReferenceEvidenceSnapshot = {
      ...base,
      faces: base.faces.map((face) =>
        face.role === "side"
          ? {
              ...face,
              sourceEntityId: replaceId(face.sourceEntityId!),
              surfaceClass:
                face.sourceEntityId === "line_b" ? "cylinder" : "plane"
            }
          : face
      ),
      edges: base.edges.map((edge) =>
        edge.role === "longitudinal"
          ? {
              ...edge,
              adjacentSourceEntityIds: edge.adjacentSourceEntityIds!.map(
                replaceId
              ) as [string, string]
            }
          : { ...edge, sourceEntityId: replaceId(edge.sourceEntityId!) }
      )
    };
    const result = generatedReferences(engine, evidence);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok || result.query !== "body.generatedReferences") return;
    expect(
      result.faces.find((face) => face.role === "side:segment:arc_b")
    ).toMatchObject({
      geometricSignature: { surfaceType: "cylinder" },
      eligibleOperations: ["feature.selectReference"]
    });
  });

  it("reports absent, unavailable, ambiguous, wrong-body, and malformed correspondence", () => {
    const engine = createEngine();
    const ready = createEvidence(engine);
    const cases: Array<{
      evidence?: CadBodyGeneratedReferenceEvidenceSnapshot;
      status: "unavailable" | "ambiguous";
    }> = [
      { status: "unavailable" },
      {
        evidence: {
          ...ready,
          status: "unavailable",
          faces: [],
          edges: [],
          diagnostic: "No B-rep"
        },
        status: "unavailable"
      },
      {
        evidence: {
          ...ready,
          status: "ambiguous",
          faces: [],
          edges: [],
          diagnostic: "Two matches"
        },
        status: "ambiguous"
      },
      {
        evidence: { ...ready, bodyId: "body_other" },
        status: "unavailable"
      },
      {
        evidence: { ...ready, faces: [...ready.faces, ready.faces[2]!] },
        status: "unavailable"
      },
      {
        evidence: {
          ...ready,
          edges: [
            ...ready.edges,
            {
              role: "longitudinal",
              adjacentSourceEntityIds: ["line_a", "line_c"],
              evidence: "kernel-builder"
            }
          ]
        },
        status: "unavailable"
      }
    ];

    for (const candidate of cases) {
      expect(generatedReferences(engine, candidate.evidence)).toMatchObject({
        ok: false,
        error: {
          code: "GENERATED_REFERENCE_CORRESPONDENCE_UNPROVEN",
          generatedReferencesStatus: candidate.status
        }
      });
    }
  });

  it("invalidates stale evidence across edit, undo, and redo", () => {
    const engine = createEngine();
    const evidence = createEvidence(engine);
    expect(generatedReferences(engine, evidence).ok).toBe(true);

    engine.apply({
      op: "feature.updateExtrude",
      id: "feature_wire",
      depth: 8
    });
    expect(generatedReferences(engine, evidence)).toMatchObject({
      ok: false,
      error: { code: "GENERATED_REFERENCE_CORRESPONDENCE_UNPROVEN" }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.resolveGeneratedReference",
          bodyId: "body_wire",
          stableId: "generated:face:body_wire:startCap",
          derivedGeneratedReferences: evidence
        }
      })
    ).toMatchObject({
      ok: false,
      error: { code: "GENERATED_REFERENCE_CORRESPONDENCE_UNPROVEN" }
    });

    engine.undo();
    expect(generatedReferences(engine, evidence).ok).toBe(true);
    engine.redo();
    expect(generatedReferences(engine, evidence)).toMatchObject({
      ok: false,
      error: { code: "GENERATED_REFERENCE_CORRESPONDENCE_UNPROVEN" }
    });
  });

  it("promotes matching exact topology and preserves explicit stale/failure health", () => {
    const engine = createEngine();
    const sourceSignature = sourceIdentitySignature(engine);
    const initialTopology = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: "body_wire" }
    });
    expect(initialTopology).toMatchObject({
      ok: true,
      topology: {
        status: "unsupported",
        topologyModel: "none",
        topologyAvailable: false,
        sourceIdentity: {
          profileKind: "wire",
          sourceSketchEntityIds: ["line_a", "line_b", "line_c", "line_d"]
        }
      }
    });
    const initialHealth = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.health" }
    });
    expect(initialHealth).toMatchObject({
      ok: true,
      authoredExtrudes: [
        {
          status: "unsupported",
          profileKind: "wire",
          sourceEntityIds: ["line_a", "line_b", "line_c", "line_d"],
          issues: [{ code: "GENERATED_REFERENCE_CORRESPONDENCE_UNPROVEN" }]
        }
      ]
    });

    const derivedExactMetadata = createExactTopologyMetadata(engine);
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.topology",
          bodyId: "body_wire",
          derivedExactMetadata
        }
      })
    ).toMatchObject({
      ok: true,
      topology: {
        status: "healthy",
        topologyModel: "kernel-derived",
        topologyAvailable: true,
        exactGeometryAvailable: true,
        faceCount: 6,
        edgeCount: 12,
        vertexCount: 8,
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
      authoredExtrudes: [
        {
          status: "healthy",
          topologyStatus: "healthy",
          topologyModel: "kernel-derived",
          topologyAvailable: true,
          issues: []
        }
      ]
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "body.topologyIdentity",
          bodyId: "body_wire",
          derivedExactMetadata
        }
      })
    ).toMatchObject({
      ok: true,
      status: "active",
      snapshot: {
        bodyId: "body_wire",
        topologySnapshot: { status: "ready" }
      }
    });

    for (const solidCount of [undefined, 0, 2] as const) {
      const invalidSolids: CadBodyDerivedExactMetadataSnapshot = {
        ...derivedExactMetadata,
        metadata: {
          ...derivedExactMetadata.metadata!,
          topologySnapshot: undefined,
          topologyCounts:
            solidCount === undefined
              ? undefined
              : {
                  solidCount,
                  faceCount: solidCount * 6,
                  edgeCount: solidCount * 12,
                  vertexCount: solidCount * 8
                }
        }
      };
      expect(
        engine.executeQuery({
          version: "cadops.v1",
          query: {
            query: "body.topology",
            bodyId: "body_wire",
            derivedExactMetadata: invalidSolids
          }
        })
      ).toMatchObject({
        ok: true,
        topology: {
          status: "kernel-failed",
          topologyModel: "none",
          topologyAvailable: false,
          exactGeometryAvailable: false,
          issues: [
            { code: "UNSUPPORTED_BODY_TOPOLOGY" },
            {
              code: "INVALID_EXACT_GEOMETRY_RESULT",
              expected: "solidCount=1",
              received:
                solidCount === undefined
                  ? "topologyCounts missing"
                  : `solidCount=${solidCount}`
            }
          ]
        }
      });
      expect(
        engine.executeQuery({
          version: "cadops.v1",
          query: {
            query: "project.health",
            derivedExactMetadata: [invalidSolids]
          }
        })
      ).toMatchObject({
        ok: true,
        authoredExtrudes: [
          {
            status: "unsupported",
            topologyStatus: "kernel-failed",
            topologyAvailable: false,
            issues: [{ code: "INVALID_EXACT_GEOMETRY_RESULT" }]
          }
        ]
      });
    }

    const stale = {
      ...derivedExactMetadata,
      sourceIdentitySignature: `${sourceSignature}:stale`
    };
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.health",
          derivedExactMetadata: [stale]
        }
      })
    ).toMatchObject({
      ok: true,
      authoredExtrudes: [
        {
          status: "stale",
          topologyStatus: "stale",
          issues: [{ code: "STALE_BODY_TOPOLOGY" }]
        }
      ]
    });

    const failed: CadBodyDerivedExactMetadataSnapshot = {
      bodyId: "body_wire",
      sourceIdentitySignature: sourceSignature,
      status: "kernel-failed",
      error: { code: "KERNEL_FAILURE", message: "OCCT failed." }
    };
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.health",
          derivedExactMetadata: [failed]
        }
      })
    ).toMatchObject({
      ok: true,
      authoredExtrudes: [
        {
          status: "unsupported",
          topologyStatus: "kernel-failed",
          issues: [{ code: "EXACT_GEOMETRY_KERNEL_FAILED" }]
        }
      ]
    });
  });

  it("rejects structurally incomplete nested evidence as an invalid query", () => {
    const engine = createEngine();
    const request = {
      version: "cadops.v1",
      query: {
        query: "body.generatedReferences",
        bodyId: "body_wire",
        derivedGeneratedReferences: {
          bodyId: "body_wire",
          sourceIdentitySignature: sourceIdentitySignature(engine),
          status: "ready",
          faces: [{ role: "side", surfaceClass: "plane" }],
          edges: []
        }
      }
    } as unknown as CadQueryRequest;

    expect(engine.executeQuery(request)).toMatchObject({
      ok: false,
      error: { code: "INVALID_QUERY" }
    });
  });

  it("exports the canonical resolved wire recipe and withdraws stale sources", () => {
    const engine = createEngine();
    const exact = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.exportExact", format: "step" }
    });
    expect(exact).toMatchObject({
      ok: true,
      status: "supported",
      exportableBodyCount: 1,
      exportSources: [
        {
          bodyId: "body_wire",
          sourceKind: "authoredExtrude",
          featureId: "feature_wire",
          sourceSketchId: "sketch_wire",
          sourceSketchEntityIds: ["line_a", "line_b", "line_c", "line_d"],
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
                sourceEntityId: "line_a",
                start: [0, 0],
                end: [4, 0]
              },
              {
                kind: "line",
                sourceEntityId: "line_b",
                start: [4, 0],
                end: [4, 3]
              },
              {
                kind: "line",
                sourceEntityId: "line_c",
                start: [4, 3],
                end: [0, 3]
              },
              {
                kind: "line",
                sourceEntityId: "line_d",
                start: [0, 3],
                end: [0, 0]
              }
            ],
            geometryPolicy: {
              linearTolerance: 1e-7,
              angularToleranceDegrees: 0.1,
              minimumProfileArea: 1e-12
            }
          },
          depth: 5,
          side: "positive"
        }
      ]
    });
    if (!exact.ok || exact.query !== "project.exportExact") return;
    const exportSource = exact.exportSources[0];
    expect(exportSource?.profile.kind).toBe("wire");
    if (exportSource?.profile.kind === "wire") {
      expect(exportSource.profile.sourceIdentity).toMatch(
        /^partbench-wire-extrude-v1:/
      );
    }
    expect(exact.exportSources[0]).not.toHaveProperty("sourceSketchEntityId");

    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_wire",
      entity: {
        id: "line_b",
        kind: "line",
        start: [4, 0],
        end: [5, 3],
        construction: false
      }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.exportExact", format: "step" }
      })
    ).toMatchObject({
      ok: true,
      status: "unavailable",
      exportableBodyCount: 0,
      exportSources: [],
      bodies: [
        {
          bodyId: "body_wire",
          sourceStatus: "unavailable",
          diagnostics: [{ code: "EXPORT_BODY_SOURCE_UNRESOLVED" }]
        }
      ]
    });
  });

  it("exports a reversed authored arc as canonical forward wire traversal", () => {
    const engine = createArcEngine(true);
    const exact = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.exportExact", format: "step" }
    });
    expect(exact).toMatchObject({
      ok: true,
      status: "supported",
      exportSources: [
        {
          sourceSketchEntityIds: ["line_a", "arc_b", "line_c", "line_d"],
          profile: {
            kind: "wire",
            segments: [
              expect.objectContaining({
                kind: "line",
                sourceEntityId: "line_a"
              }),
              {
                kind: "arc",
                sourceEntityId: "arc_b",
                center: [4, 2],
                radius: 2,
                startAngleDegrees: 270,
                sweepAngleDegrees: 180
              },
              expect.objectContaining({
                kind: "line",
                sourceEntityId: "line_c"
              }),
              expect.objectContaining({
                kind: "line",
                sourceEntityId: "line_d"
              })
            ]
          }
        }
      ]
    });
    if (!exact.ok || exact.query !== "project.exportExact") return;
    const source = exact.exportSources[0];
    if (source?.profile.kind !== "wire") {
      throw new Error("Expected resolved wire STEP source.");
    }
    expect(source.profile.sourceIdentity).toContain('"sourceEntityId":"arc_b"');
    expect(source.profile.sourceIdentity).toContain(
      '"startAngleDegrees":270,"sweepAngleDegrees":180'
    );
  });
});

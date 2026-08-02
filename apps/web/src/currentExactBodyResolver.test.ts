import {
  CadEngine,
  createV15ReleaseSampleBatch,
  createV21ReleaseSampleBatch,
  encodeWcadCanonicalCbor,
  listV21ReleaseSampleFixtures,
  sha256Hex,
  V21_EXACT_BODY_SOURCE_POLICY,
  type CadDocument,
  type CadFeatureSummary,
  type WcadTopologyCheckpointPayloadInput
} from "@web-cad/cad-core";
import type {
  CadBodySnapshot,
  CadGeneratedFaceReference
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";

import {
  createPrimitiveDerivedGeometrySource,
  type DerivedBooleanExtrudeGeometrySource,
  type DerivedEdgeFinishGeometrySource,
  type DerivedGeometrySource,
  type DerivedHoleGeometrySource
} from "./derivedGeometry";
import { createDerivedGeometrySourcesFromDocument } from "./derivedGeometrySources";
import { createGeneratedFaceReferenceKey } from "./sketchDisplayFrames";
import {
  createCurrentExactBodyArtifactSource,
  getCurrentExactBodyArtifactShapePolicy,
  getReadyRuntimeExactSources,
  resolveCurrentExactBodies,
  type CurrentExactBodyResolution,
  type CurrentExactBodyResolverInput
} from "./currentExactBodyResolver";

describe("currentExactBodyResolver", () => {
  it("resolves every active V21 fixture and the completed pattern families exactly once", () => {
    for (const fixture of listV21ReleaseSampleFixtures()) {
      const engine = new CadEngine();
      engine.applyBatch(createV21ReleaseSampleBatch(fixture.id).ops);
      const checkpointPayloads =
        fixture.id === "v21-imported-body"
          ? [createImportedCheckpointPayload()]
          : [];
      const context = createResolverContext(engine, checkpointPayloads);
      const active = context.resolutions.filter((resolution) =>
        fixture.expectedActiveBodyIds.includes(resolution.bodyId)
      );

      expect(active).toHaveLength(fixture.expectedActiveBodyIds.length);
      expect(active.map((resolution) => resolution.status)).toEqual(
        fixture.expectedActiveBodyIds.map(() => "ready")
      );
      expect(new Set(active.map((resolution) => resolution.bodyId)).size).toBe(
        active.length
      );
      for (const resolution of active) {
        if (resolution.status === "ready") {
          const source = createCurrentExactBodyArtifactSource(
            resolution.source
          );
          expect(getCurrentExactBodyArtifactShapePolicy(source)).toBe(
            V21_EXACT_BODY_SOURCE_POLICY[resolution.sourceType].shapePolicy
          );
        }
      }
    }

    for (const fixtureId of [
      "v15-linear-pattern",
      "v15-circular-pattern",
      "v15-mirror",
      "v15-shell"
    ] as const) {
      const engine = new CadEngine();
      engine.applyBatch(createV15ReleaseSampleBatch(fixtureId).ops);
      const active = createResolverContext(engine).resolutions.filter(
        (resolution) =>
          !readStructure(engine).bodies.find(
            (body) => body.id === resolution.bodyId
          )?.consumedByFeatureId
      );
      expect(active).not.toHaveLength(0);
      expect(
        active.every((resolution) => resolution.status === "ready"),
        `${fixtureId}: ${JSON.stringify(active)}`
      ).toBe(true);
      for (const resolution of active) {
        if (resolution.status !== "ready") continue;
        expect(
          getCurrentExactBodyArtifactShapePolicy(
            createCurrentExactBodyArtifactSource(resolution.source)
          )
        ).toBe(V21_EXACT_BODY_SOURCE_POLICY[resolution.sourceType].shapePolicy);
        if (
          resolution.source.kind === "shell" &&
          resolution.source.openFaceStableIds.some(
            (stableId) => !stableId.startsWith("snapshot-local:face:")
          )
        ) {
          expect(resolution.artifactDependency).toBeUndefined();
        } else if (
          resolution.source.kind === "shell" ||
          resolution.source.kind === "linearPattern" ||
          resolution.source.kind === "circularPattern" ||
          resolution.source.kind === "mirror"
        ) {
          expect(resolution.artifactDependency).toMatchObject({
            bodyId:
              resolution.source.kind === "shell"
                ? resolution.source.target.id
                : resolution.source.seed.id,
            sourceIdentitySignature: expect.stringMatching(
              /^body-topology-source:v1:/
            ),
            cacheKeySha256: expect.stringMatching(/^[0-9a-f]{64}$/)
          });
        }
      }
    }
  });

  it("accepts an artifact-backed downstream seed while rejecting an invalid operation reference", () => {
    const engine = new CadEngine();
    engine.applyBatch(createV15ReleaseSampleBatch("v15-linear-pattern").ops);
    const context = createResolverContext(engine);
    const feature = context.input.features.find(
      (candidate) => candidate.kind === "linearPattern"
    );
    const source = feature
      ? context.input.geometrySources.find(
          (candidate) =>
            candidate.id === feature.bodyId &&
            candidate.kind === "linearPattern"
        )
      : undefined;
    if (
      !feature ||
      feature.kind !== "linearPattern" ||
      !source ||
      source.kind !== "linearPattern"
    ) {
      throw new Error("Expected linear pattern fixture.");
    }
    const artifactBacked = {
      ...source,
      seed: {
        ...source.seed,
        placementError: "Seed is not an embedded extrude-family recipe."
      },
      placementError: "Seed is not an embedded extrude-family recipe."
    };

    expect(
      resolveWithSource(context.input, feature.bodyId, artifactBacked)
    ).toMatchObject({
      status: "ready",
      artifactDependency: { bodyId: feature.seedBodyId }
    });

    const invalidFeature = {
      ...feature,
      direction: {
        kind: "generatedEdge" as const,
        bodyId: feature.seedBodyId,
        stableId: "missing-edge"
      },
      source: {
        ...feature.source,
        direction: {
          kind: "generatedEdge" as const,
          bodyId: feature.seedBodyId,
          stableId: "missing-edge"
        }
      }
    };
    const invalid = resolveCurrentExactBodies({
      ...context.input,
      features: context.input.features.map((candidate) =>
        candidate.id === feature.id ? invalidFeature : candidate
      ),
      geometrySources: context.input.geometrySources.map((candidate) =>
        candidate.id === feature.bodyId ? artifactBacked : candidate
      )
    }).find((resolution) => resolution.bodyId === feature.bodyId);
    expect(invalid).toMatchObject({
      status: "blocked",
      diagnostics: [{ message: expect.stringMatching(/direction.*resolves/i) }]
    });
  });

  it("binds primitive fields and checkpoint B-rep evidence into cache identity", () => {
    const engine = new CadEngine();
    engine.apply({
      op: "scene.createBox",
      id: "cache_box",
      dimensions: { width: 2, height: 3, depth: 4 }
    });
    const initial = getReady(createResolverContext(engine).resolutions);

    engine.apply({
      op: "scene.updateTransform",
      id: "cache_box",
      transform: {
        translation: [1, 2, 3],
        rotation: [10, 20, 30],
        scale: [2, 1, 0.5]
      }
    });
    const transformed = getReady(createResolverContext(engine).resolutions);
    engine.apply({
      op: "scene.updateBoxDimensions",
      id: "cache_box",
      dimensions: { width: 5, height: 3, depth: 4 }
    });
    const resized = getReady(createResolverContext(engine).resolutions);

    expect(
      new Set([
        initial.cacheKeySha256,
        transformed.cacheKeySha256,
        resized.cacheKeySha256
      ]).size
    ).toBe(3);
    expect(initial.sourceIdentitySignature).toMatch(
      /^body-topology-source:v1:/
    );

    const importedEngine = new CadEngine();
    importedEngine.applyBatch(
      createV21ReleaseSampleBatch("v21-imported-body").ops
    );
    const firstPayload = createImportedCheckpointPayload([1, 2, 3]);
    const secondPayload = createImportedCheckpointPayload([1, 2, 4]);
    const first = getReady(
      createResolverContext(importedEngine, [firstPayload]).resolutions
    );
    expect(createCurrentExactBodyArtifactSource(first.source)).toMatchObject({
      kind: "checkpointBody",
      topologySourceKind: "importedBody",
      topologySignature: "v21-imported-topology-signature"
    });
    const second = getReady(
      createResolverContext(importedEngine, [secondPayload]).resolutions
    );
    expect(first.cacheKeySha256).not.toBe(second.cacheKeySha256);
  });

  it("blocks mismatched, duplicated, and stale checkpoint evidence", () => {
    const engine = new CadEngine();
    engine.applyBatch(createV21ReleaseSampleBatch("v21-imported-body").ops);
    const good = createImportedCheckpointPayload();
    expect(
      getOnly(createResolverContext(engine, [good]).resolutions).status
    ).toBe("ready");

    const corrupt = {
      ...good,
      brepSha256: "0".repeat(64)
    };
    expect(
      getOnly(createResolverContext(engine, [corrupt]).resolutions)
    ).toMatchObject({
      status: "blocked",
      diagnostics: [{ code: "EXPORT_EXACT_ARTIFACT_INVALID" }]
    });
    expect(
      getOnly(createResolverContext(engine, [good, good]).resolutions)
    ).toMatchObject({
      status: "blocked",
      diagnostics: [{ code: "EXPORT_EXACT_ARTIFACT_INVALID" }]
    });

    const context = createResolverContext(engine, [good]);
    const document: CadDocument = {
      ...context.input.document,
      topologyIdentity: {
        ...context.input.document.topologyIdentity!,
        checkpoints: context.input.document.topologyIdentity!.checkpoints.map(
          (checkpoint) => ({ ...checkpoint, status: "stale" as const })
        )
      }
    };
    expect(
      getOnly(resolveCurrentExactBodies({ ...context.input, document }))
    ).toMatchObject({
      status: "stale",
      diagnostics: [{ code: "EXPORT_EXACT_SOURCE_STALE" }]
    });
  });

  it("rejects cycles, duplicate ownership, and source graphs over the V21 cap", () => {
    const engine = new CadEngine();
    engine.applyBatch(
      createV21ReleaseSampleBatch("v21-composite-region-profiles").ops
    );
    const context = createResolverContext(engine);
    const bodyId = "v21_wire_body";
    const leaf = context.input.geometrySources.find(
      (source) => source.id === bodyId && source.kind === "extrude"
    );
    if (!leaf || leaf.kind !== "extrude")
      throw new Error("Expected wire source.");

    const cycleNode = {
      id: "cycle_node",
      kind: "extrudeBoolean",
      operation: "add",
      target: leaf,
      tool: { ...leaf, id: "cycle_tool" }
    } as DerivedBooleanExtrudeGeometrySource;
    (cycleNode as { target: DerivedBooleanExtrudeGeometrySource }).target =
      cycleNode;
    const cycle = {
      id: bodyId,
      kind: "extrudeBoolean",
      operation: "add",
      target: cycleNode,
      tool: { ...leaf, id: "cycle_root_tool" }
    } satisfies DerivedBooleanExtrudeGeometrySource;
    expect(resolveWithSource(context.input, bodyId, cycle)).toMatchObject({
      status: "blocked",
      diagnostics: [{ message: "Exact source graph is cyclic." }]
    });

    const duplicateLeaf = { ...leaf, id: "duplicate_leaf" };
    const duplicate = {
      id: bodyId,
      kind: "extrudeBoolean",
      operation: "add",
      target: duplicateLeaf,
      tool: duplicateLeaf
    } satisfies DerivedBooleanExtrudeGeometrySource;
    expect(resolveWithSource(context.input, bodyId, duplicate)).toMatchObject({
      status: "blocked",
      diagnostics: [
        { message: "Exact source graph contains duplicate semantic ownership." }
      ]
    });

    let oversized: DerivedBooleanExtrudeGeometrySource = {
      id: "graph_0",
      kind: "extrudeBoolean",
      operation: "add",
      target: { ...leaf, id: "graph_leaf_0" },
      tool: { ...leaf, id: "graph_tool_0" }
    };
    for (let index = 1; index <= 4_096; index += 1) {
      oversized = {
        id: index === 4_096 ? bodyId : `graph_${index}`,
        kind: "extrudeBoolean",
        operation: "add",
        target: oversized,
        tool: { ...leaf, id: `graph_tool_${index}` }
      };
    }
    expect(resolveWithSource(context.input, bodyId, oversized)).toMatchObject({
      status: "blocked",
      diagnostics: [{ code: "EXPORT_EXACT_ARTIFACT_LIMIT_EXCEEDED" }]
    });
  });

  it("uses checkpoint artifacts for every supported imported downstream operation", () => {
    for (const operation of ["add", "cut"] as const) {
      const resolution = resolveImportedDownstream({
        kind: "boolean",
        operation
      });
      expect(resolution).toMatchObject({
        status: "ready",
        source: { kind: "checkpointBoolean", operation }
      });
      if (resolution.status === "ready") {
        expect(
          createCurrentExactBodyArtifactSource(resolution.source)
        ).toMatchObject({
          kind: "checkpointBoolean",
          operation,
          target: { topologySourceKind: "importedBody" }
        });
      }
    }
    for (const operation of ["chamfer", "fillet"] as const) {
      const resolution = resolveImportedDownstream({
        kind: "edgeFinish",
        operation
      });
      expect(resolution).toMatchObject({
        status: "ready",
        source: { kind: "checkpointEdgeFinish", operation }
      });
      if (resolution.status === "ready") {
        expect(
          createCurrentExactBodyArtifactSource(resolution.source)
        ).toMatchObject({
          kind: "checkpointEdgeFinish",
          operation,
          checkpointEntityId: "snapshot-local:edge:1"
        });
      }
    }
    for (const authoredTarget of [false, true]) {
      const hole = resolveImportedDownstream({ kind: "hole", authoredTarget });
      if (hole.status !== "ready") {
        throw new Error(JSON.stringify(hole.diagnostics));
      }
      expect(hole).toMatchObject({
        status: "ready",
        source: { kind: "hole" },
        artifactDependency: {
          bodyId: "v21_imported_body",
          source: { kind: "importedBody" }
        }
      });
    }
  });

  it("projects imported and downstream checkpoint resolutions into one display and metadata source", () => {
    const resolutions = [
      resolveImportedDownstream({ kind: "boolean", operation: "cut" }),
      resolveImportedDownstream({ kind: "hole", authoredTarget: true }),
      resolveImportedDownstream({ kind: "edgeFinish", operation: "fillet" })
    ];
    const sources = getReadyRuntimeExactSources(resolutions);

    expect(sources).toHaveLength(3);
    expect(sources.map((source) => [source.id, source.kind])).toEqual([
      ["downstream_result", "exactBody"],
      ["downstream_result", "hole"],
      ["downstream_result", "exactBody"]
    ]);
  });
});

function createResolverContext(
  engine: CadEngine,
  checkpointPayloads: readonly WcadTopologyCheckpointPayloadInput[] = []
): {
  readonly input: CurrentExactBodyResolverInput;
  readonly resolutions: readonly CurrentExactBodyResolution[];
} {
  const structure = readStructure(engine);
  const signatures = new Map<string, string>();
  const faces = new Map<string, CadGeneratedFaceReference>();
  for (const body of structure.bodies) {
    const topology = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: body.id }
    });
    if (topology.ok && topology.query === "body.topology") {
      signatures.set(body.id, topology.topology.sourceIdentity.signature);
    }
    const generated = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.generatedReferences", bodyId: body.id }
    });
    if (generated.ok && generated.query === "body.generatedReferences") {
      for (const face of generated.faces) {
        faces.set(
          createGeneratedFaceReferenceKey(face.bodyId, face.stableId),
          face
        );
      }
    }
  }
  const document = engine.getDocument();
  const geometrySources = createDerivedGeometrySourcesFromDocument(
    document,
    structure.features,
    faces,
    signatures
  );
  const input: CurrentExactBodyResolverInput = {
    document,
    bodies: structure.bodies,
    features: structure.features,
    geometrySources,
    artifactGeometrySources: createDerivedGeometrySourcesFromDocument(
      document,
      structure.features,
      faces,
      signatures,
      true
    ),
    checkpointPayloads,
    sourceIdentitySignaturesByBodyId: signatures
  };
  return { input, resolutions: resolveCurrentExactBodies(input) };
}

function readStructure(engine: CadEngine): {
  readonly bodies: readonly CadBodySnapshot[];
  readonly features: readonly CadFeatureSummary[];
} {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  if (!response.ok || response.query !== "project.structure") {
    throw new Error("Expected project structure.");
  }
  return response;
}

function createImportedCheckpointPayload(
  values: readonly number[] = [1, 2, 3]
): WcadTopologyCheckpointPayloadInput {
  const brepBytes = new Uint8Array(values);
  return {
    checkpointId: "v21_imported_checkpoint",
    bodyId: "v21_imported_body",
    sourceFeatureId: "v21_imported_feature",
    units: "mm",
    kernel: {
      boundary: "geometry-kernel",
      snapshotAlgorithm: "partbench-derived-topology-snapshot-v1"
    },
    tolerance: { linearTolerance: 0.001, angularToleranceDegrees: 0.01 },
    brepByteLength: brepBytes.byteLength,
    brepSha256: sha256Hex(brepBytes),
    brepBytes,
    topologyBytes: encodeWcadCanonicalCbor({
      sourceKind: "importedBody",
      signature: "v21-imported-topology-signature"
    }),
    signatureBytes: encodeWcadCanonicalCbor({
      checkpointId: "v21_imported_checkpoint",
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
      signature: "v21-imported-topology-signature",
      entityCount: 0,
      entities: []
    })
  };
}

function getOnly(
  resolutions: readonly CurrentExactBodyResolution[]
): CurrentExactBodyResolution {
  expect(resolutions).toHaveLength(1);
  return resolutions[0]!;
}

function getReady(
  resolutions: readonly CurrentExactBodyResolution[]
): Extract<CurrentExactBodyResolution, { status: "ready" }> {
  const resolution = getOnly(resolutions);
  if (resolution.status !== "ready") {
    throw new Error(
      resolution.diagnostics[0]?.message ?? "Expected ready source."
    );
  }
  return resolution;
}

function resolveWithSource(
  input: CurrentExactBodyResolverInput,
  bodyId: string,
  source: DerivedGeometrySource
): CurrentExactBodyResolution {
  return resolveCurrentExactBodies({
    ...input,
    geometrySources: [
      ...input.geometrySources.filter((candidate) => candidate.id !== bodyId),
      source
    ]
  }).find((resolution) => resolution.bodyId === bodyId)!;
}

function resolveImportedDownstream(
  input:
    | { readonly kind: "boolean"; readonly operation: "add" | "cut" }
    | {
        readonly kind: "edgeFinish";
        readonly operation: "chamfer" | "fillet";
      }
    | { readonly kind: "hole"; readonly authoredTarget?: boolean }
): CurrentExactBodyResolution {
  const importedEngine = new CadEngine();
  importedEngine.applyBatch(
    createV21ReleaseSampleBatch("v21-imported-body").ops
  );
  const imported = createResolverContext(importedEngine, [
    createImportedCheckpointPayload()
  ]).input;
  const tool = createPrimitiveDerivedGeometrySource({
    id: "downstream_tool",
    kind: "box",
    dimensions: { width: 1, height: 1, depth: 1 },
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  });
  const extrudeTool = {
    id: tool.id,
    kind: "extrude" as const,
    sketchPlane: "XY" as const,
    profile: {
      kind: "rectangle" as const,
      center: [0, 0] as const,
      width: 1,
      height: 1
    },
    depth: 1,
    side: "positive" as const
  };
  const bodyId = "downstream_result";
  const featureId = "downstream_feature";
  const importedBody = imported.bodies[0]!;
  const targetBody: CadBodySnapshot =
    input.kind === "hole" && input.authoredTarget
      ? {
          ...importedBody,
          source: {
            type: "sketchExtrudeFeature",
            featureId: importedBody.featureId,
            sketchId: "authored_target_sketch",
            entityId: "authored_target_entity",
            profileKind: "rectangle"
          }
        }
      : importedBody;
  const targetFeature: CadFeatureSummary =
    input.kind === "hole" && input.authoredTarget
      ? ({
          id: importedBody.featureId,
          bodyId: importedBody.id,
          name: "Authored checkpoint target",
          kind: "extrude",
          sketchId: "authored_target_sketch",
          entityId: "authored_target_entity",
          profileKind: "rectangle",
          depth: 1,
          side: "positive",
          operationMode: "newBody"
        } as CadFeatureSummary)
      : imported.features[0]!;
  const baseBody: CadBodySnapshot = {
    ...importedBody,
    id: bodyId,
    featureId,
    consumedByFeatureId: undefined,
    objectId: undefined,
    primitive: undefined,
    source:
      input.kind === "boolean"
        ? {
            type: "sketchExtrudeFeature",
            featureId,
            sketchId: "downstream_sketch",
            entityId: "downstream_entity",
            profileKind: "rectangle"
          }
        : input.kind === "hole"
          ? {
              type: "sketchHoleFeature",
              featureId,
              targetBodyId: importedBody.id,
              sketchId: "downstream_sketch",
              circleEntityId: "downstream_circle"
            }
          : {
              type:
                input.operation === "chamfer"
                  ? "edgeChamferFeature"
                  : "edgeFilletFeature",
              featureId,
              targetBodyId: importedBody.id,
              edgeStableId: "imported-edge-1"
            }
  };
  const feature = {
    id: featureId,
    bodyId,
    name: "Downstream result",
    ...(input.kind === "boolean"
      ? {
          kind: "extrude" as const,
          sketchId: "downstream_sketch",
          entityId: "downstream_entity",
          profileKind: "rectangle" as const,
          depth: 1,
          side: "positive" as const,
          operationMode: input.operation,
          targetBodyId: importedBody.id
        }
      : input.kind === "hole"
        ? {
            kind: "hole" as const,
            targetBodyId: importedBody.id,
            sketchId: "downstream_sketch",
            circleEntityId: "downstream_circle",
            depthMode: "blind" as const,
            direction: "positive" as const,
            depth: 1
          }
        : {
            kind: input.operation,
            targetBodyId: importedBody.id,
            topologyAnchorId: "downstream_edge_anchor",
            ...(input.operation === "chamfer"
              ? { distance: 0.1 }
              : { radius: 0.1 })
          })
  } as CadFeatureSummary;
  const geometrySource: DerivedGeometrySource =
    input.kind === "boolean"
      ? ({
          id: bodyId,
          kind: "extrudeBoolean",
          operation: input.operation,
          target: extrudeTool,
          tool: extrudeTool,
          placementError: "Checkpoint target requires exact resolution."
        } satisfies DerivedBooleanExtrudeGeometrySource)
      : input.kind === "hole"
        ? ({
            id: bodyId,
            kind: "hole",
            target: extrudeTool,
            tool: {
              sketchPlane: "XY",
              circle: { kind: "circle", center: [0, 0], radius: 0.25 },
              depthMode: "blind",
              direction: "positive",
              depth: 1
            },
            placementError: "Checkpoint target requires exact resolution."
          } satisfies DerivedHoleGeometrySource)
        : ({
            id: bodyId,
            kind: "edgeFinish",
            operation: input.operation,
            target: extrudeTool,
            edgeStableId: "imported-edge-1",
            ...(input.operation === "chamfer"
              ? { distance: 0.1 }
              : { radius: 0.1 }),
            placementError: "Checkpoint target requires exact resolution."
          } as DerivedEdgeFinishGeometrySource);

  return resolveCurrentExactBodies({
    ...imported,
    document:
      input.kind === "edgeFinish"
        ? {
            ...imported.document,
            topologyIdentity: {
              ...imported.document.topologyIdentity!,
              anchors: [
                ...imported.document.topologyIdentity!.anchors,
                {
                  anchorId: "downstream_edge_anchor",
                  entityKind: "edge",
                  bodyId: importedBody.id,
                  checkpointId: "v21_imported_checkpoint",
                  checkpointEntityId: "snapshot-local:edge:1",
                  sourceFeatureId: importedBody.featureId,
                  state: "active",
                  diagnostics: []
                }
              ]
            }
          }
        : input.kind === "hole"
          ? {
              ...imported.document,
              sketches: new Map(imported.document.sketches).set(
                "downstream_sketch",
                {
                  id: "downstream_sketch",
                  name: "Downstream hole sketch",
                  plane: "XY",
                  entities: new Map([
                    [
                      "downstream_circle",
                      {
                        id: "downstream_circle",
                        kind: "circle" as const,
                        center: [0, 0] as const,
                        radius: 0.25,
                        construction: false
                      }
                    ]
                  ])
                }
              )
            }
          : imported.document,
    bodies: [{ ...targetBody, consumedByFeatureId: featureId }, baseBody],
    features: [targetFeature, feature],
    geometrySources: [geometrySource],
    sourceIdentitySignaturesByBodyId: new Map([
      ...imported.sourceIdentitySignaturesByBodyId,
      [bodyId, `body-topology-source:v1:${"a".repeat(64)}`]
    ])
  }).find((resolution) => resolution.bodyId === bodyId)!;
}

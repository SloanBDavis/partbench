import { describe, expect, it, vi } from "vitest";
import {
  executeGeometryKernelRequest,
  getGeometryKernelExactExportCapabilities,
  getGeometryKernelStepImportCapabilities,
  getGeometryResponseTransferables
} from "./index";
import {
  assertExactBodyArtifactAggregateWithinLimit,
  executeGeometryKernelRequestWithMeshFactory,
  MAX_EXACT_BODY_ARTIFACT_AGGREGATE_BYTES,
  MAX_BOOLEAN_EXTRUDE_RECIPE_DEPTH,
  type BooleanExtrudeSource,
  type ExactBodyArtifactRequest,
  type ExactBodyArtifactSource,
  type ExactBodyMetadataRequest,
  type GeometryKernelExactBodyArtifact,
  type GeometryKernelExactBodyArtifactPayload,
  type GeometryKernelExactBodyMetadata,
  type ExactRevolveMetadataSource,
  type GeometryKernelExactTopologyCheckpointPayload,
  type GeometryKernelImportedBodyCheckpointPayload,
  type GeometryKernelImportedBodyPayload,
  type GeometryKernelMeshFactories,
  type GeometryKernelTopologyEntityDescriptor,
  type ResolvedPlanarRegionProfile,
  type ResolvedPlanarWireProfile,
  type RevolveGeometryAxis
} from "./kernel";

const OCCT_WASM_TEST_TIMEOUT_MS = 120_000;

function createArtifactRequest(
  source: ExactBodyArtifactSource,
  options: {
    readonly bodyId?: string;
    readonly sourceType?: string;
    readonly sourceGraphNodeCount?: number;
    readonly shapePolicy?: ExactBodyArtifactRequest["shapePolicy"];
  } = {}
): ExactBodyArtifactRequest {
  return {
    id: `geometry_req_exact_artifact_${options.bodyId ?? "artifact_body"}`,
    version: "geometry-kernel.v1",
    op: "geometry.exactBodyArtifact",
    bodyId: options.bodyId ?? "artifact_body",
    sourceType: options.sourceType ?? "primitiveFeature",
    documentSourceIdentity: {
      algorithm: "partbench-source-v1",
      sha256: "a".repeat(64)
    },
    bodySourceIdentitySignature: `body-topology-source:v1:${"b".repeat(64)}`,
    sourceCacheKeySha256: "c".repeat(64),
    sourceGraphNodeCount: options.sourceGraphNodeCount ?? 1,
    units: "mm",
    shapePolicy: options.shapePolicy ?? "singleSolid",
    source
  };
}

async function createStepArtifactBody(
  source: ExactBodyArtifactSource,
  bodyId: string,
  sourceGraphNodeCount = 1
) {
  const response = await executeGeometryKernelRequest(
    createArtifactRequest(source, { bodyId, sourceGraphNodeCount })
  );
  if (!response.ok) throw new Error(response.error.message);
  return {
    bodyId,
    bodyName: bodyId,
    brepFormat: response.artifact.brepFormat,
    brepByteLength: response.artifact.brepByteLength,
    brepSha256: response.artifact.brepSha256,
    brepBytes: response.artifact.brepBytes
  } as const;
}

async function expectArtifactWritesNamedStep(
  artifact: GeometryKernelExactBodyArtifact,
  bodyName: string
): Promise<void> {
  const response = await executeGeometryKernelRequest({
    id: `geometry_req_step_${artifact.bodyId}`,
    version: "geometry-kernel.v1",
    op: "geometry.exportStep",
    units: "mm",
    bodies: [
      {
        bodyId: artifact.bodyId,
        bodyName,
        brepFormat: artifact.brepFormat,
        brepByteLength: artifact.brepByteLength,
        brepSha256: artifact.brepSha256,
        brepBytes: artifact.brepBytes
      }
    ]
  });
  if (!response.ok) throw new Error(response.error.message);
  expect(response.artifact).toMatchObject({
    format: "step",
    schema: "AP242DIS",
    units: "mm",
    bodyCount: 1
  });
  expect(response.artifact.byteLength).toBeGreaterThan(1_000);
}

async function createSyntheticStepArtifactBody(
  bodyId: string,
  bodyName = bodyId,
  brepBytes = new TextEncoder().encode(`BRep:${bodyId}`)
) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", brepBytes);
  return {
    bodyId,
    bodyName,
    brepFormat: "occt-brep" as const,
    brepByteLength: brepBytes.byteLength,
    brepSha256: Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join(""),
    brepBytes
  };
}

function createInjectedArtifactFactories(
  createExactBodyArtifact: NonNullable<
    GeometryKernelMeshFactories["createExactBodyArtifact"]
  >
): GeometryKernelMeshFactories {
  const unused = async () => {
    throw new Error("Unexpected mesh factory call.");
  };
  return {
    createBoxMesh: unused,
    createCylinderMesh: unused,
    createSphereMesh: unused,
    createConeMesh: unused,
    createTorusMesh: unused,
    createBooleanExtrudeMesh: unused,
    createExactBodyArtifact
  };
}

function createInjectedStepFactories(
  createExactStepExport: NonNullable<
    GeometryKernelMeshFactories["createExactStepExport"]
  >
): GeometryKernelMeshFactories {
  const unused = async () => {
    throw new Error("Unexpected mesh factory call.");
  };
  return {
    createBoxMesh: unused,
    createCylinderMesh: unused,
    createSphereMesh: unused,
    createConeMesh: unused,
    createTorusMesh: unused,
    createBooleanExtrudeMesh: unused,
    createExactStepExport
  };
}

const mixedWireProfile = {
  kind: "wire" as const,
  frame: {
    origin: [0, 0, 0] as const,
    uAxis: [1, 0, 0] as const,
    vAxis: [0, 1, 0] as const
  },
  closed: true as const,
  segments: [
    {
      kind: "line" as const,
      sourceEntityId: "line-bottom",
      start: [-2, -1] as const,
      end: [2, -1] as const
    },
    {
      kind: "arc" as const,
      sourceEntityId: "arc-right",
      center: [2, 0] as const,
      radius: 1,
      startAngleDegrees: 270,
      sweepAngleDegrees: 180
    },
    {
      kind: "line" as const,
      sourceEntityId: "line-top",
      start: [2, 1] as const,
      end: [-2, 1] as const
    },
    {
      kind: "arc" as const,
      sourceEntityId: "arc-left",
      center: [-2, 0] as const,
      radius: 1,
      startAngleDegrees: 90,
      sweepAngleDegrees: 180
    }
  ],
  sourceIdentity: "sketch-slot:line-bottom,arc-right,line-top,arc-left",
  geometryPolicy: {
    linearTolerance: 1e-7 as const,
    angularToleranceDegrees: 0.1 as const,
    minimumProfileArea: 1e-12 as const
  }
};

const booleanRecipePrimitive = {
  sketchPlane: "XY" as const,
  profile: {
    kind: "rectangle" as const,
    center: [0, 0] as const,
    width: 4,
    height: 4
  },
  depth: 4
};

function createNestedBooleanRecipe(resultDepth: number): BooleanExtrudeSource {
  let source: BooleanExtrudeSource = booleanRecipePrimitive;
  for (let index = 0; index < resultDepth; index += 1) {
    source = {
      kind: "booleanExtrudes",
      operation: "add",
      target: source,
      tool: booleanRecipePrimitive
    };
  }
  return source;
}

function createTopologyEntityFixture(
  kind: GeometryKernelTopologyEntityDescriptor["kind"],
  index: number
): GeometryKernelTopologyEntityDescriptor {
  const base = {
    localId: `snapshot-local:${kind}:${index}`,
    kind,
    source: "kernel-derived" as const,
    signature: `topology-${kind}-test-${index}`,
    bounds: {
      min: [-1, -1.5, 0] as const,
      max: [1, 1.5, 4] as const
    },
    orientation: "forward" as const,
    adjacency: {
      available: false,
      neighborSignatureHashes: [] as const
    }
  };

  if (kind === "face") {
    return {
      ...base,
      surfaceClass: "plane",
      normal: [0, 0, 1],
      relationships: {
        childLoopLocalIds: ["snapshot-local:loop:1"],
        childCoedgeLocalIds: ["snapshot-local:coedge:1"],
        childEdgeLocalIds: ["snapshot-local:edge:1"]
      }
    };
  }

  if (kind === "edge") {
    return {
      ...base,
      curveClass: "line",
      midpoint: [0, 0, 2],
      axis: [0, 0, 1],
      length: 4,
      relationships: {
        adjacentFaceLocalIds: ["snapshot-local:face:1"]
      }
    };
  }

  if (kind === "vertex") {
    return {
      ...base,
      point: [-1, -1.5, 0]
    };
  }

  if (kind === "loop") {
    return {
      ...base,
      loopRole: "outer"
    };
  }

  return base;
}

function createCheckpointPayloadFixture(
  input: {
    readonly checkpointId?: string;
    readonly bodyId?: string;
    readonly brepBytes?: Uint8Array;
    readonly signature?: string;
    readonly sourceKind?: "extrude" | "importedBody";
  } = {}
): GeometryKernelExactTopologyCheckpointPayload {
  const checkpointId = input.checkpointId ?? "checkpoint_injected";
  const bodyId = input.bodyId ?? "body_injected";
  const sourceKind = input.sourceKind ?? "extrude";
  const entities = [
    createTopologyEntityFixture("body", 1),
    createTopologyEntityFixture("solid", 1),
    createTopologyEntityFixture("face", 1)
  ];
  const topologySignature = "topology-checkpoint-test";
  const topologySnapshot = {
    sourceKind,
    status: "partial" as const,
    entityCounts: {
      bodyCount: 1,
      solidCount: 1,
      faceCount: 1,
      wireCount: 0,
      edgeCount: 0,
      vertexCount: 0,
      loopCount: 0,
      coedgeCount: 0,
      axisCount: 0
    },
    entityCount: entities.length,
    entities,
    unsupportedEntityKinds: ["loop", "coedge", "axis"] as const,
    adjacencyAvailable: false,
    signatureAlgorithm: "partbench-derived-topology-snapshot-v1" as const,
    signature: topologySignature,
    source: "kernel-derived" as const,
    diagnostics: [
      {
        code: "GEOMETRY_TOPOLOGY_SNAPSHOT_EXTRACTED" as const,
        severity: "info" as const,
        message: "Test checkpoint topology snapshot extracted."
      }
    ]
  };

  return {
    checkpointId,
    bodyId,
    sourceKind,
    brepFormat: "occt-brep",
    brepWriter: "BRepTools.Write_3",
    brepBytes: input.brepBytes ?? new Uint8Array([1, 2, 3, 4]),
    brepByteLength: input.brepBytes?.byteLength ?? 4,
    topologySnapshot,
    signaturePayload: {
      checkpointId,
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
      signature: input.signature ?? topologySignature,
      entityCount: topologySnapshot.entityCount,
      entities: topologySnapshot.entities.map((entity) => ({
        localId: entity.localId,
        kind: entity.kind,
        signature: entity.signature
      }))
    }
  };
}

function getMetadataSourceKind(
  source: ExactBodyMetadataRequest["source"]
): GeometryKernelExactBodyMetadata["sourceKind"] {
  switch (source.kind) {
    case "checkpointBody":
      return source.topologySourceKind;
    case "checkpointBoolean":
      return "booleanExtrudes";
    case "checkpointHole":
      return "hole";
    case "checkpointEdgeFinish":
      return "edgeFinish";
    default:
      return source.kind;
  }
}

function createImportedBodyPayloadFixture(
  input: {
    readonly sourceFileName?: string;
    readonly checkpointId?: string;
    readonly bodyId?: string;
    readonly brepBytes?: Uint8Array;
    readonly signature?: string;
  } = {}
): GeometryKernelImportedBodyPayload {
  const sourceFileName = input.sourceFileName ?? "fixture-import.step";
  const checkpointPayloadBase = createCheckpointPayloadFixture({
    checkpointId: input.checkpointId ?? "checkpoint_imported_fixture",
    bodyId: input.bodyId ?? "body_imported_fixture",
    brepBytes: input.brepBytes,
    signature: input.signature,
    sourceKind: "importedBody"
  });
  const topologySnapshot = {
    ...checkpointPayloadBase.topologySnapshot,
    sourceKind: "importedBody" as const
  };
  const checkpointPayload: GeometryKernelImportedBodyCheckpointPayload = {
    checkpointId: checkpointPayloadBase.checkpointId,
    bodyId: checkpointPayloadBase.bodyId,
    sourceKind: "importedBody",
    brepFormat: checkpointPayloadBase.brepFormat,
    brepWriter: checkpointPayloadBase.brepWriter,
    brepBytes: checkpointPayloadBase.brepBytes,
    brepByteLength: checkpointPayloadBase.brepByteLength,
    topologySnapshot,
    signaturePayload: checkpointPayloadBase.signaturePayload
  };
  const bodyEntity = checkpointPayload.topologySnapshot.entities[0];
  if (!bodyEntity?.bounds) {
    throw new Error("Imported body fixture requires one bounded body entity.");
  }

  return {
    sourceFormat: "step",
    sourceFileName,
    bodyName: sourceFileName.replace(/\.(step|stp)$/i, ""),
    shapeType: "solid",
    bounds: bodyEntity.bounds,
    solidCount: checkpointPayload.topologySnapshot.entityCounts.solidCount,
    faceCount: checkpointPayload.topologySnapshot.entityCounts.faceCount,
    edgeCount: checkpointPayload.topologySnapshot.entityCounts.edgeCount,
    vertexCount: checkpointPayload.topologySnapshot.entityCounts.vertexCount,
    topologySnapshot: checkpointPayload.topologySnapshot,
    checkpointPayload,
    healingApplied: false,
    diagnostics: [
      {
        code: "STEP_HEALING_NOT_REQUIRED",
        severity: "info",
        message: "Test STEP import healing diagnostic."
      }
    ]
  };
}

function createExactBodyArtifactPayloadFixture(): GeometryKernelExactBodyArtifactPayload {
  const topologySnapshot = createCheckpointPayloadFixture().topologySnapshot;
  return {
    sourceKind: "extrude",
    brepFormat: "occt-brep",
    brepWriter: "BRepTools.Write_3",
    brepBytes: new Uint8Array([1, 2, 3, 4]),
    brepByteLength: 4,
    metadata: {
      sourceKind: "extrude",
      bounds: { min: [-1, -1.5, 0], max: [1, 1.5, 4] },
      volume: 24,
      surfaceArea: 52,
      centroid: [0, 0, 2],
      topologyCounts: {
        solidCount: 1,
        faceCount: 1,
        edgeCount: 0,
        vertexCount: 0
      },
      measurementSource: "kernel-derived",
      measurementConfidence: "kernel-derived",
      diagnostics: []
    },
    topologySnapshot
  };
}

describe("geometry-kernel facade", () => {
  it("enforces the V21 aggregate exact artifact byte cap", () => {
    expect(
      assertExactBodyArtifactAggregateWithinLimit([
        { brepByteLength: 128 * 1024 * 1024 },
        { brepByteLength: 128 * 1024 * 1024 },
        { brepByteLength: 128 * 1024 * 1024 },
        { brepByteLength: 128 * 1024 * 1024 }
      ])
    ).toBe(MAX_EXACT_BODY_ARTIFACT_AGGREGATE_BYTES);
    expect(() =>
      assertExactBodyArtifactAggregateWithinLimit([
        { brepByteLength: 128 * 1024 * 1024 },
        { brepByteLength: 128 * 1024 * 1024 },
        { brepByteLength: 128 * 1024 * 1024 },
        { brepByteLength: 128 * 1024 * 1024 },
        { brepByteLength: 1 }
      ])
    ).toThrow();
  });

  it("keeps exact artifact failures atomic across build, read, write, topology, and hash stages", async () => {
    const source = {
      kind: "extrude" as const,
      sketchPlane: "XY" as const,
      profile: {
        kind: "rectangle" as const,
        center: [0, 0] as const,
        width: 2,
        height: 3
      },
      depth: 4
    };
    for (const stage of ["build", "read", "write", "topology"] as const) {
      const response = await executeGeometryKernelRequestWithMeshFactory(
        createInjectedArtifactFactories(async () => {
          throw new Error(`Injected ${stage} failure.`);
        }),
        createArtifactRequest(source, { bodyId: `failed_${stage}` })
      );
      expect(response).toMatchObject({
        ok: false,
        error: { code: "KERNEL_FAILURE", message: `Injected ${stage} failure.` }
      });
      expect("artifact" in response).toBe(false);
      expect(getGeometryResponseTransferables(response)).toEqual([]);
    }

    const digest = vi
      .spyOn(globalThis.crypto.subtle, "digest")
      .mockRejectedValueOnce(new Error("Injected hash failure."));
    try {
      const response = await executeGeometryKernelRequestWithMeshFactory(
        createInjectedArtifactFactories(async () =>
          createExactBodyArtifactPayloadFixture()
        ),
        createArtifactRequest(source, { bodyId: "failed_hash" })
      );
      expect(response).toMatchObject({
        ok: false,
        error: { code: "KERNEL_FAILURE", message: "Injected hash failure." }
      });
      expect("artifact" in response).toBe(false);
      expect(getGeometryResponseTransferables(response)).toEqual([]);
    } finally {
      digest.mockRestore();
    }
  });

  it("rejects invalid artifact results and source graph claims without retaining bytes", async () => {
    const source = {
      kind: "extrude" as const,
      sketchPlane: "XY" as const,
      profile: {
        kind: "rectangle" as const,
        center: [0, 0] as const,
        width: 2,
        height: 3
      },
      depth: 4
    };
    let calls = 0;
    const factories = createInjectedArtifactFactories(async () => {
      calls += 1;
      const payload = createExactBodyArtifactPayloadFixture();
      return { ...payload, brepByteLength: payload.brepByteLength + 1 };
    });
    const invalid = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      createArtifactRequest(source, { bodyId: "invalid_result" })
    );
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "INVALID_RESULT" }
    });
    expect(getGeometryResponseTransferables(invalid)).toEqual([]);

    const overLimit = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      createArtifactRequest(source, {
        bodyId: "over_limit_graph",
        sourceGraphNodeCount: 4_097
      })
    );
    expect(overLimit).toMatchObject({
      ok: false,
      error: { code: "INVALID_DIMENSIONS" }
    });
    expect(calls).toBe(1);
    expect(getGeometryResponseTransferables(overLimit)).toEqual([]);
  });

  it("tessellates checkpoint-backed exact bodies only after hash validation", async () => {
    const checkpoint = await createSyntheticStepArtifactBody("checkpoint");
    const source = {
      kind: "checkpointBody" as const,
      brepBytes: checkpoint.brepBytes,
      brepByteLength: checkpoint.brepByteLength,
      brepSha256: checkpoint.brepSha256,
      topologySourceKind: "importedBody" as const,
      topologySignature: "checkpoint-topology"
    };
    let calls = 0;
    const factories: GeometryKernelMeshFactories = {
      ...createInjectedArtifactFactories(async () =>
        createExactBodyArtifactPayloadFixture()
      ),
      createExactBodyMesh: async (input) => {
        calls += 1;
        expect(input.source).toBe(source);
        return {
          primitive: "boolean",
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          indices: new Uint32Array([0, 1, 2]),
          vertexCount: 3,
          triangleCount: 1,
          faceCount: 1
        };
      }
    };
    const request = {
      id: "geometry_req_exact_body_display",
      version: "geometry-kernel.v1" as const,
      op: "geometry.tessellateExactBody" as const,
      source
    };
    const ready = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      request
    );
    expect(ready).toMatchObject({ ok: true, mesh: { triangleCount: 1 } });
    expect(getGeometryResponseTransferables(ready)).toHaveLength(2);

    const corrupt = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        ...request,
        source: { ...source, brepSha256: "0".repeat(64) }
      }
    );
    expect(corrupt).toMatchObject({
      ok: false,
      error: { code: "INVALID_DIMENSIONS" }
    });
    expect(calls).toBe(1);
  });

  it("reports STEP exact export writer capability as available", () => {
    expect(getGeometryKernelExactExportCapabilities()).toEqual([
      expect.objectContaining({
        format: "step",
        label: "STEP",
        status: "available",
        writerAvailable: true,
        namedWriterAvailable: true,
        boundary: "geometry-kernel",
        writerBoundary: "occt-wasm",
        missingBindings: []
      })
    ]);
  });

  it("keeps STEP exact export unavailable without named writer bindings", () => {
    expect(
      getGeometryKernelExactExportCapabilities({
        status: "unavailable",
        writerAvailable: true,
        namedWriterAvailable: false,
        packageVersion: "2.0.0-test",
        checkedBindings: ["STEPControl_Writer_1", "TDataStd_Name.Set_1"],
        availableBindings: ["STEPControl_Writer_1"],
        missingBindings: ["TDataStd_Name.Set_1"]
      })
    ).toEqual([
      expect.objectContaining({
        format: "step",
        status: "unavailable",
        writerAvailable: true,
        namedWriterAvailable: false,
        missingBindings: ["TDataStd_Name.Set_1"]
      })
    ]);
  });

  it("reports STEP import reader and healing capability as available", () => {
    expect(getGeometryKernelStepImportCapabilities()).toEqual([
      expect.objectContaining({
        format: "step",
        label: "STEP",
        status: "available",
        readerAvailable: true,
        healingAvailable: true,
        checkpointWriterAvailable: true,
        boundary: "geometry-kernel",
        readerBoundary: "occt-wasm",
        missingBindings: []
      })
    ]);
  });

  it("reports STEP import capability as unavailable when reader bindings are absent", () => {
    expect(
      getGeometryKernelStepImportCapabilities({
        status: "unavailable",
        readerAvailable: false,
        healingAvailable: false,
        checkpointWriterAvailable: false,
        packageVersion: "2.0.0-test",
        checkedBindings: ["STEPControl_Reader_1"],
        availableBindings: [],
        missingBindings: ["STEPControl_Reader_1"]
      })
    ).toEqual([
      expect.objectContaining({
        format: "step",
        status: "unavailable",
        readerAvailable: false,
        healingAvailable: false,
        checkpointWriterAvailable: false,
        missingBindings: ["STEPControl_Reader_1"]
      })
    ]);
  });

  it("passes validated artifact bodies to the named STEP writer in plan order", async () => {
    const bodies = await Promise.all([
      createSyntheticStepArtifactBody("body-c", "Bracket Ω"),
      createSyntheticStepArtifactBody("body-a", "Bracket Ω"),
      createSyntheticStepArtifactBody("body-b", "")
    ]);
    let captured: unknown;
    const response = await executeGeometryKernelRequestWithMeshFactory(
      createInjectedStepFactories(async (input) => {
        captured = input;
        return {
          format: "step",
          schema: "AP242DIS",
          units: input.units,
          bodyCount: input.bodies.length,
          byteLength: 1,
          bytes: new Uint8Array([1])
        };
      }),
      {
        id: "geometry_req_ordered_artifact_step",
        version: "geometry-kernel.v1",
        op: "geometry.exportStep",
        units: "in",
        bodies
      }
    );
    expect(response.ok).toBe(true);
    expect(captured).toMatchObject({
      units: "in",
      bodies: [
        { bodyId: "body-c", bodyName: "Bracket Ω" },
        { bodyId: "body-a", bodyName: "Bracket Ω" },
        { bodyId: "body-b", bodyName: "" }
      ]
    });
  });

  it("rejects duplicate, corrupt, and over-count STEP artifact inputs before writing", async () => {
    const body = await createSyntheticStepArtifactBody("body-step-guard");
    let calls = 0;
    const factories = createInjectedStepFactories(async () => {
      calls += 1;
      throw new Error("Writer must not be called.");
    });
    const request = (bodies: readonly (typeof body)[]) =>
      executeGeometryKernelRequestWithMeshFactory(factories, {
        id: `geometry_req_step_guard_${bodies.length}`,
        version: "geometry-kernel.v1",
        op: "geometry.exportStep",
        units: "mm",
        bodies
      });
    const corrupt = {
      ...body,
      bodyId: "body-step-corrupt",
      brepSha256: "0".repeat(64)
    };
    const overCount = Array.from({ length: 257 }, (_, index) => ({
      ...body,
      bodyId: `body-step-${index}`
    }));
    const [duplicate, corruptResult, overCountResult] = await Promise.all([
      request([body, body]),
      request([corrupt]),
      request(overCount)
    ]);
    for (const response of [duplicate, corruptResult, overCountResult]) {
      expect(response).toMatchObject({
        ok: false,
        error: { code: "INVALID_DIMENSIONS" }
      });
      expect(getGeometryResponseTransferables(response)).toEqual([]);
    }
    expect(calls).toBe(0);
  });

  it("rejects inconsistent or oversized STEP writer results atomically", async () => {
    const body = await createSyntheticStepArtifactBody("body-step-result");
    const response = await executeGeometryKernelRequestWithMeshFactory(
      createInjectedStepFactories(async () => ({
        format: "step",
        schema: "AP242DIS",
        units: "mm",
        bodyCount: 1,
        byteLength: 512 * 1024 * 1024 + 1,
        bytes: { byteLength: 512 * 1024 * 1024 + 1 } as Uint8Array
      })),
      {
        id: "geometry_req_oversized_step_result",
        version: "geometry-kernel.v1",
        op: "geometry.exportStep",
        units: "mm",
        bodies: [body]
      }
    );
    expect(response).toMatchObject({
      ok: false,
      error: { code: "INVALID_RESULT" }
    });
    expect(getGeometryResponseTransferables(response)).toEqual([]);
  });

  it(
    "exports a rectangle extrude as STEP bytes through the isolated OCCT WASM adapter",
    async () => {
      const exportBody = await createStepArtifactBody(
        {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 1
          },
          depth: 3,
          side: "positive"
        },
        "body_step_rect"
      );
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_step_export",
        version: "geometry-kernel.v1",
        op: "geometry.exportStep",
        units: "mm",
        bodies: [exportBody]
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      const text = new TextDecoder().decode(response.artifact.bytes);

      expect(response.artifact.byteLength).toBeGreaterThan(1000);
      expect(text).toContain("ISO-10303-21");
      expect(getGeometryResponseTransferables(response)).toHaveLength(1);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it("rejects malformed exact STEP body records without entering OCCT", async () => {
    const [nullBody, malformedArtifact] = await Promise.all([
      executeGeometryKernelRequest({
        id: "geometry_req_step_export_null_body",
        version: "geometry-kernel.v1",
        op: "geometry.exportStep",
        units: "mm",
        bodies: [null]
      } as never),
      executeGeometryKernelRequest({
        id: "geometry_req_step_export_malformed_artifact",
        version: "geometry-kernel.v1",
        op: "geometry.exportStep",
        units: "mm",
        bodies: [
          {
            bodyId: "body_step_malformed_artifact",
            bodyName: "Malformed",
            brepFormat: "occt-brep",
            brepByteLength: 1,
            brepSha256: "0".repeat(64),
            brepBytes: null
          }
        ]
      } as never)
    ]);

    expect(nullBody).toMatchObject({
      ok: false,
      error: { code: "INVALID_DIMENSIONS" }
    });
    expect(malformedArtifact).toMatchObject({
      ok: false,
      error: { code: "INVALID_DIMENSIONS" }
    });
  });

  it(
    "imports STEP bytes into transient imported body payloads through the isolated OCCT WASM adapter",
    async () => {
      const exportBody = await createStepArtifactBody(
        {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 1
          },
          depth: 3,
          side: "positive"
        },
        "body_step_import_source"
      );
      const exportResponse = await executeGeometryKernelRequest({
        id: "geometry_req_step_import_source_export",
        version: "geometry-kernel.v1",
        op: "geometry.exportStep",
        units: "mm",
        bodies: [exportBody]
      });

      expect(exportResponse.ok).toBe(true);

      if (!exportResponse.ok) {
        throw new Error(exportResponse.error.message);
      }

      const response = await executeGeometryKernelRequest({
        id: "geometry_req_step_import",
        version: "geometry-kernel.v1",
        op: "geometry.importStep",
        sourceFileName: "kernel-roundtrip.step",
        bytes: exportResponse.artifact.bytes,
        maxBodyCount: 1,
        bodyId: "body_imported_kernel_roundtrip",
        checkpointId: "checkpoint_imported_kernel_roundtrip"
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      const body = response.bodies[0];
      if (!body) {
        throw new Error("Expected one imported STEP body.");
      }
      const brepText = new TextDecoder().decode(
        body.checkpointPayload.brepBytes
      );

      expect(response).toMatchObject({
        ok: true,
        id: "geometry_req_step_import",
        op: "geometry.importStep",
        sourceFormat: "step",
        sourceFileName: "kernel-roundtrip.step",
        bodyCount: 1,
        warnings: []
      });
      expect(body).toMatchObject({
        sourceFormat: "step",
        sourceFileName: "kernel-roundtrip.step",
        shapeType: "solid",
        solidCount: 1,
        checkpointPayload: {
          checkpointId: "checkpoint_imported_kernel_roundtrip",
          bodyId: "body_imported_kernel_roundtrip",
          sourceKind: "importedBody",
          brepFormat: "occt-brep",
          brepWriter: "BRepTools.Write_3"
        }
      });
      expect(body.faceCount).toBeGreaterThanOrEqual(6);
      expect(body.topologySnapshot.sourceKind).toBe("importedBody");
      expect(body.checkpointPayload.signaturePayload.signature).toBe(
        body.topologySnapshot.signature
      );
      expect(body.checkpointPayload.brepByteLength).toBeGreaterThan(1000);
      expect(brepText).toContain("CASCADE Topology");
      expect(getGeometryResponseTransferables(response)).toEqual([
        body.checkpointPayload.brepBytes.buffer
      ]);
      expect(JSON.stringify(response)).not.toMatch(
        /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex/i
      );
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it("rejects empty STEP import byte payloads before calling the geometry factory", async () => {
    const response = await executeGeometryKernelRequest({
      id: "geometry_req_empty_step_import",
      version: "geometry-kernel.v1",
      op: "geometry.importStep",
      sourceFileName: "empty.step",
      bytes: new Uint8Array()
    });

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_empty_step_import",
      op: "geometry.importStep",
      error: {
        code: "INVALID_DIMENSIONS",
        message:
          "STEP import requests require a non-empty source filename, non-empty byte payload, optional positive max body count, and optional non-empty body/checkpoint ids."
      },
      warnings: []
    });
    expect(getGeometryResponseTransferables(response)).toEqual([]);
  });

  it("returns imported body payloads from an injected STEP import factory", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createStepImport: async (input) => {
        const body = createImportedBodyPayloadFixture({
          sourceFileName: input.sourceFileName,
          checkpointId: input.checkpointId,
          bodyId: input.bodyId
        });

        return {
          sourceFormat: "step",
          sourceFileName: input.sourceFileName,
          bodyCount: 1,
          bodies: [body],
          diagnostics: [
            {
              code: "STEP_READER_AVAILABLE",
              severity: "info",
              message: "Test STEP reader available diagnostic."
            }
          ]
        };
      }
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_injected_step_import",
        version: "geometry-kernel.v1",
        op: "geometry.importStep",
        sourceFileName: "fixture-import.step",
        bytes: new Uint8Array([1, 2, 3]),
        bodyId: "body_imported_injected",
        checkpointId: "checkpoint_imported_injected"
      }
    );

    expect(response).toEqual({
      ok: true,
      id: "geometry_req_injected_step_import",
      op: "geometry.importStep",
      sourceFormat: "step",
      sourceFileName: "fixture-import.step",
      bodyCount: 1,
      bodies: [
        expect.objectContaining({
          sourceFormat: "step",
          sourceFileName: "fixture-import.step",
          shapeType: "solid",
          checkpointPayload: expect.objectContaining({
            checkpointId: "checkpoint_imported_injected",
            bodyId: "body_imported_injected",
            sourceKind: "importedBody",
            brepByteLength: 4
          })
        })
      ],
      diagnostics: [
        {
          code: "STEP_READER_AVAILABLE",
          severity: "info",
          message: "Test STEP reader available diagnostic."
        }
      ],
      warnings: []
    });
    expect(getGeometryResponseTransferables(response)).toHaveLength(1);
    expect(JSON.stringify(response)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex/i
    );
  });

  it("routes named STEP probes through the injected OCCT boundary", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createNamedStepProbe: async () => ({
        ok: true,
        capability: {
          status: "available",
          namedStepAvailable: true,
          checkedBindings: ["STEPCAFControl_Writer_1"],
          availableBindings: ["STEPCAFControl_Writer_1"],
          missingBindings: [],
          reason: "Test capability."
        },
        expectedNames: ["Bracket Ω", "Bracket Ω"],
        units: []
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_named_step_probe",
        version: "geometry-kernel.v1",
        op: "geometry.namedStepProbe"
      }
    );

    expect(response).toMatchObject({
      ok: true,
      id: "geometry_req_named_step_probe",
      op: "geometry.namedStepProbe",
      probe: {
        ok: true,
        capability: { namedStepAvailable: true, missingBindings: [] },
        expectedNames: ["Bracket Ω", "Bracket Ω"]
      },
      warnings: []
    });
    expect(getGeometryResponseTransferables(response)).toEqual([]);
  });

  it("rejects inconsistent imported body payloads from injected STEP import factories", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createStepImport: async () => {
        const body = createImportedBodyPayloadFixture({
          signature: "signature-mismatch"
        });

        return {
          sourceFormat: "step",
          sourceFileName: body.sourceFileName,
          bodyCount: 1,
          bodies: [body],
          diagnostics: [
            {
              code: "STEP_READER_AVAILABLE",
              severity: "info",
              message: "Test STEP reader available diagnostic."
            }
          ]
        };
      }
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_invalid_injected_step_import",
        version: "geometry-kernel.v1",
        op: "geometry.importStep",
        sourceFileName: "fixture-import.step",
        bytes: new Uint8Array([1, 2, 3])
      }
    );

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_invalid_injected_step_import",
      op: "geometry.importStep",
      error: {
        code: "INVALID_RESULT",
        message:
          "The geometry kernel returned STEP import payloads with invalid or inconsistent body, topology, or checkpoint data."
      },
      warnings: []
    });
  });

  it(
    "creates exact topology checkpoint payload bytes through the isolated OCCT WASM adapter",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_exact_checkpoint_payload",
        version: "geometry-kernel.v1",
        op: "geometry.exactTopologyCheckpointPayload",
        checkpointId: "checkpoint_kernel_rect",
        bodyId: "body_kernel_rect",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 1
          },
          depth: 3,
          side: "positive"
        }
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      const brepText = new TextDecoder().decode(
        response.checkpointPayload.brepBytes
      );

      expect(response.checkpointPayload).toMatchObject({
        checkpointId: "checkpoint_kernel_rect",
        bodyId: "body_kernel_rect",
        sourceKind: "extrude",
        brepFormat: "occt-brep",
        brepWriter: "BRepTools.Write_3"
      });
      expect(response.checkpointPayload.brepByteLength).toBeGreaterThan(1000);
      expect(brepText).toContain("CASCADE Topology");
      expect(response.checkpointPayload.signaturePayload).toMatchObject({
        checkpointId: "checkpoint_kernel_rect",
        signature: response.checkpointPayload.topologySnapshot.signature,
        entityCount: response.checkpointPayload.topologySnapshot.entityCount
      });
      expect(getGeometryResponseTransferables(response)).toHaveLength(1);
      expect(JSON.stringify(response)).not.toMatch(
        /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex/i
      );
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "tessellates a box through the isolated OCCT WASM adapter",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_1",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateBox",
        dimensions: {
          width: 10,
          height: 20,
          depth: 30
        }
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      expect(response).toMatchObject({
        id: "geometry_req_1",
        op: "geometry.tessellateBox",
        warnings: []
      });
      expect(response.mesh.primitive).toBe("box");
      expect(response.mesh.faceCount).toBe(6);
      expect(response.mesh.vertexCount).toBe(24);
      expect(response.mesh.triangleCount).toBe(12);
      expect(response.mesh.positions).toBeInstanceOf(Float32Array);
      expect(response.mesh.indices).toBeInstanceOf(Uint32Array);
      expect(response.mesh.positions).toHaveLength(
        response.mesh.vertexCount * 3
      );
      expect(response.mesh.indices).toHaveLength(
        response.mesh.triangleCount * 3
      );
      expect(getGeometryResponseTransferables(response)).toEqual([
        response.mesh.positions.buffer,
        response.mesh.indices.buffer
      ]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "warns when a non-overlapping linear pattern produces multiple solids",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_linear_pattern_multi_solid",
        version: "geometry-kernel.v1",
        op: "geometry.linearPattern",
        seed: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 2
          },
          depth: 2
        },
        direction: [1, 0, 0],
        spacing: 5,
        instanceCount: 3
      });

      expect(response.ok).toBe(true);
      if (!response.ok) {
        throw new Error(response.error.message);
      }
      expect(response.warnings).toContain("PATTERN_MULTI_SOLID_RESULT");
      expect(response.mesh.faceCount).toBe(18);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "mirrors a seed body across a plane without the original through the isolated OCCT WASM adapter",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_mirror_copy",
        version: "geometry-kernel.v1",
        op: "geometry.mirror",
        seed: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [2, 0],
            width: 2,
            height: 1
          },
          depth: 3
        },
        plane: {
          point: [0, 0, 0],
          normal: [1, 0, 0]
        },
        includeOriginal: false
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      expect(response.mesh.faceCount).toBe(6);
      expect(response.mesh.positions).toBeInstanceOf(Float32Array);
      expect(response.mesh.indices).toBeInstanceOf(Uint32Array);
      expect(response.mesh.positions).toHaveLength(
        response.mesh.vertexCount * 3
      );
      expect(response.mesh.indices).toHaveLength(
        response.mesh.triangleCount * 3
      );

      const xs: number[] = [];
      for (let i = 0; i < response.mesh.positions.length; i += 3) {
        const x = response.mesh.positions[i];
        if (x === undefined) {
          throw new Error("Expected complete mirrored mesh positions.");
        }
        xs.push(x);
      }
      expect(Math.max(...xs)).toBeLessThanOrEqual(1e-6);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "mirrors and unions a seed body with its reflection through the isolated OCCT WASM adapter",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_mirror_union",
        version: "geometry-kernel.v1",
        op: "geometry.mirror",
        seed: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [2, 0],
            width: 2,
            height: 1
          },
          depth: 3
        },
        plane: {
          point: [0, 0, 0],
          normal: [1, 0, 0]
        },
        includeOriginal: true
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      expect(response.mesh.positions).toBeInstanceOf(Float32Array);
      expect(response.mesh.indices).toBeInstanceOf(Uint32Array);
      expect(response.mesh.positions).toHaveLength(
        response.mesh.vertexCount * 3
      );

      const xs: number[] = [];
      for (let i = 0; i < response.mesh.positions.length; i += 3) {
        const x = response.mesh.positions[i];
        if (x === undefined) {
          throw new Error("Expected complete mirrored mesh positions.");
        }
        xs.push(x);
      }
      expect(Math.max(...xs)).toBeGreaterThan(0.5);
      expect(Math.min(...xs)).toBeLessThan(-0.5);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "tessellates a cylinder through the isolated OCCT WASM adapter",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_cylinder",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateCylinder",
        dimensions: {
          radius: 10,
          height: 30
        }
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      expect(response).toMatchObject({
        id: "geometry_req_cylinder",
        op: "geometry.tessellateCylinder",
        warnings: []
      });
      expect(response.mesh.primitive).toBe("cylinder");
      expect(response.mesh.faceCount).toBeGreaterThanOrEqual(3);
      expect(response.mesh.vertexCount).toBeGreaterThan(0);
      expect(response.mesh.triangleCount).toBeGreaterThan(0);
      expect(response.mesh.positions).toBeInstanceOf(Float32Array);
      expect(response.mesh.indices).toBeInstanceOf(Uint32Array);
      expect(response.mesh.positions).toHaveLength(
        response.mesh.vertexCount * 3
      );
      expect(response.mesh.indices).toHaveLength(
        response.mesh.triangleCount * 3
      );
      expect(getGeometryResponseTransferables(response)).toEqual([
        response.mesh.positions.buffer,
        response.mesh.indices.buffer
      ]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "tessellates a sphere through the isolated OCCT WASM adapter",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_sphere",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateSphere",
        dimensions: {
          radius: 10
        }
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      expect(response).toMatchObject({
        id: "geometry_req_sphere",
        op: "geometry.tessellateSphere",
        warnings: []
      });
      expect(response.mesh.primitive).toBe("sphere");
      expect(response.mesh.faceCount).toBeGreaterThan(0);
      expect(response.mesh.vertexCount).toBeGreaterThan(0);
      expect(response.mesh.triangleCount).toBeGreaterThan(0);
      expect(response.mesh.positions).toBeInstanceOf(Float32Array);
      expect(response.mesh.indices).toBeInstanceOf(Uint32Array);
      expect(response.mesh.positions).toHaveLength(
        response.mesh.vertexCount * 3
      );
      expect(response.mesh.indices).toHaveLength(
        response.mesh.triangleCount * 3
      );
      expect(getGeometryResponseTransferables(response)).toEqual([
        response.mesh.positions.buffer,
        response.mesh.indices.buffer
      ]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "tessellates cone and torus primitives through the isolated OCCT WASM adapter",
    async () => {
      const cone = await executeGeometryKernelRequest({
        id: "geometry_req_cone",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateCone",
        dimensions: {
          radius: 2,
          height: 5
        }
      });
      const torus = await executeGeometryKernelRequest({
        id: "geometry_req_torus",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateTorus",
        dimensions: {
          majorRadius: 3,
          minorRadius: 0.5
        }
      });

      expect(cone.ok).toBe(true);
      expect(torus.ok).toBe(true);

      if (!cone.ok || !torus.ok) {
        throw new Error("Expected cone and torus tessellation to succeed.");
      }

      expect(cone.mesh.primitive).toBe("cone");
      expect(cone.mesh.vertexCount).toBeGreaterThan(0);
      expect(cone.mesh.triangleCount).toBeGreaterThan(0);
      expect(torus.mesh.primitive).toBe("torus");
      expect(torus.mesh.vertexCount).toBeGreaterThan(0);
      expect(torus.mesh.triangleCount).toBeGreaterThan(0);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "tessellates rectangle and circle extrudes through the isolated OCCT WASM adapter",
    async () => {
      const rectangle = await executeGeometryKernelRequest({
        id: "geometry_req_rect_extrude",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateExtrude",
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [1, 2],
          width: 4,
          height: 3
        },
        depth: 5
      });
      const circle = await executeGeometryKernelRequest({
        id: "geometry_req_circle_extrude",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateExtrude",
        sketchPlane: "XZ",
        profile: {
          kind: "circle",
          center: [0, 0],
          radius: 2
        },
        depth: 6
      });

      expect(rectangle.ok).toBe(true);
      expect(circle.ok).toBe(true);

      if (!rectangle.ok || !circle.ok) {
        throw new Error("Expected sketch extrude tessellation to succeed.");
      }

      expect(rectangle.mesh.primitive).toBe("extrude");
      expect(rectangle.mesh.vertexCount).toBeGreaterThan(0);
      expect(rectangle.mesh.triangleCount).toBeGreaterThan(0);
      expect(getMeshBounds(rectangle.mesh.positions)).toEqual({
        min: [-1, 0.5, 0],
        max: [3, 3.5, 5]
      });
      const circleBounds = getMeshBounds(circle.mesh.positions);

      expect(circle.mesh.primitive).toBe("extrude");
      expect(circle.mesh.vertexCount).toBeGreaterThan(0);
      expect(circle.mesh.triangleCount).toBeGreaterThan(0);
      expect(circleBounds.min[0]).toBeCloseTo(-2, 6);
      expect(circleBounds.max[0]).toBeCloseTo(2, 6);
      expect(circleBounds.min[1]).toBeCloseTo(0, 6);
      expect(circleBounds.max[1]).toBeCloseTo(6, 6);
      expect(circleBounds.min[2]).toBeGreaterThanOrEqual(-2);
      expect(circleBounds.max[2]).toBeLessThanOrEqual(2);
      expect(circleBounds.min[2] + circleBounds.max[2]).toBeCloseTo(0, 6);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it("routes one validated resolved line/arc wire to the isolated wire factory", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createWireExtrudeMesh: async ({ profile, depth, side }) => ({
        primitive: "extrude",
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, depth]),
        indices: new Uint32Array([0, 1, 2]),
        vertexCount: 3,
        triangleCount: 1,
        faceCount: 1,
        generatedReferences: {
          status: "unavailable",
          sourceIdentity: profile.sourceIdentity,
          faces: [],
          edges: [],
          diagnostic: `Injected ${side ?? "positive"} proof boundary.`
        }
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_wire_contract",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateExtrude",
        sketchPlane: "XY",
        profile: mixedWireProfile,
        depth: 3,
        side: "negative"
      }
    );

    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error("Expected wire contract success.");
    expect(response.mesh.generatedReferences).toEqual({
      status: "unavailable",
      sourceIdentity: mixedWireProfile.sourceIdentity,
      faces: [],
      edges: [],
      diagnostic: "Injected negative proof boundary."
    });
  });

  it("rejects composite wire mesh results that omit generated-reference evidence", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createWireExtrudeMesh: async () => ({
        primitive: "extrude",
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 1]),
        indices: new Uint32Array([0, 1, 2]),
        vertexCount: 3,
        triangleCount: 1,
        faceCount: 1
      })
    };
    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_wire_missing_reference_evidence",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateExtrude",
        sketchPlane: "XY",
        profile: mixedWireProfile,
        depth: 3
      }
    );
    expect(response).toMatchObject({
      ok: false,
      error: { code: "INVALID_RESULT" }
    });
  });

  const [bottomLine, rightArc, ...remainingWireSegments] =
    mixedWireProfile.segments;
  if (
    !bottomLine ||
    bottomLine.kind !== "line" ||
    !rightArc ||
    rightArc.kind !== "arc"
  ) {
    throw new Error("Mixed wire fixture requires its leading line and arc.");
  }

  it.each([
    [
      "gap",
      { ...mixedWireProfile, segments: mixedWireProfile.segments.slice(0, 3) }
    ],
    [
      "zero line",
      {
        ...mixedWireProfile,
        segments: [
          { ...bottomLine, end: [-2, -1] as const },
          rightArc,
          ...remainingWireSegments
        ]
      }
    ],
    [
      "full arc",
      {
        ...mixedWireProfile,
        segments: [
          bottomLine,
          { ...rightArc, sweepAngleDegrees: 360 },
          ...remainingWireSegments
        ]
      }
    ],
    [
      "nonfinite arc",
      {
        ...mixedWireProfile,
        segments: [
          bottomLine,
          { ...rightArc, radius: Number.NaN },
          ...remainingWireSegments
        ]
      }
    ]
  ])(
    "rejects invalid resolved wire input before OCCT: %s",
    async (_label, profile) => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_invalid_wire_contract",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateExtrude",
        sketchPlane: "XY",
        profile,
        depth: 3
      });
      expect(response).toMatchObject({
        ok: false,
        error: { code: "INVALID_DIMENSIONS" }
      });
    }
  );

  it.each([
    ["add", MAX_BOOLEAN_EXTRUDE_RECIPE_DEPTH - 1, true],
    ["add", MAX_BOOLEAN_EXTRUDE_RECIPE_DEPTH, false],
    ["cut", MAX_BOOLEAN_EXTRUDE_RECIPE_DEPTH - 1, true],
    ["cut", MAX_BOOLEAN_EXTRUDE_RECIPE_DEPTH, false]
  ] as const)(
    "keeps %s with a target of %i result nodes at the same mesh and exact metadata boundary",
    async (operation, targetDepth, expectedOk) => {
      const unusedFactory = async () => {
        throw new Error("Unexpected mesh factory call.");
      };
      const factories: GeometryKernelMeshFactories = {
        createBoxMesh: unusedFactory,
        createCylinderMesh: unusedFactory,
        createSphereMesh: unusedFactory,
        createConeMesh: unusedFactory,
        createTorusMesh: unusedFactory,
        createBooleanExtrudeMesh: async () => ({
          primitive: "boolean",
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          indices: new Uint32Array([0, 1, 2]),
          vertexCount: 3,
          triangleCount: 1,
          faceCount: 1
        }),
        createExactBodyMetadata: async (input) => ({
          sourceKind: getMetadataSourceKind(input.source),
          bounds: { min: [0, 0, 0], max: [4, 4, 4] },
          volume: 64,
          surfaceArea: 96,
          centroid: [2, 2, 2],
          topologyCounts: {
            solidCount: 1,
            faceCount: 6,
            edgeCount: 12,
            vertexCount: 8
          },
          measurementSource: "kernel-derived",
          measurementConfidence: "kernel-derived",
          diagnostics: []
        })
      };
      const target = createNestedBooleanRecipe(targetDepth);
      const tool =
        operation === "cut"
          ? {
              sketchPlane: "XY" as const,
              profile: mixedWireProfile,
              depth: 4
            }
          : booleanRecipePrimitive;
      const completeSource =
        operation === "add"
          ? {
              kind: "booleanExtrudes" as const,
              operation: "add" as const,
              target,
              tool
            }
          : {
              kind: "booleanExtrudes" as const,
              operation: "cut" as const,
              target,
              tool
            };
      const meshRequest =
        operation === "add"
          ? {
              id: `geometry_req_boundary_${operation}_${targetDepth}_mesh`,
              version: "geometry-kernel.v1" as const,
              op: "geometry.booleanExtrudes" as const,
              operation: "add" as const,
              target,
              tool
            }
          : {
              id: `geometry_req_boundary_${operation}_${targetDepth}_mesh`,
              version: "geometry-kernel.v1" as const,
              op: "geometry.booleanExtrudes" as const,
              operation: "cut" as const,
              target,
              tool
            };
      const [mesh, exact] = await Promise.all([
        executeGeometryKernelRequestWithMeshFactory(factories, meshRequest),
        executeGeometryKernelRequestWithMeshFactory(factories, {
          id: `geometry_req_boundary_${operation}_${targetDepth}_exact`,
          version: "geometry-kernel.v1",
          op: "geometry.exactBodyMetadata",
          source: completeSource
        })
      ]);

      for (const response of [mesh, exact]) {
        expect(response.ok).toBe(expectedOk);
        if (!expectedOk) {
          expect(response).toMatchObject({
            error: { code: "INVALID_DIMENSIONS" }
          });
        }
      }
    }
  );

  it(
    "tessellates rectangle and circle revolve profiles through the isolated OCCT WASM adapter",
    async () => {
      const rectangle = await executeGeometryKernelRequest({
        id: "geometry_req_rect_revolve",
        version: "geometry-kernel.v1",
        op: "geometry.revolveProfile",
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [2, 0],
          width: 1,
          height: 3
        },
        axis: {
          start: [0, -2],
          end: [0, 2]
        },
        angleDegrees: 360
      });
      const circle = await executeGeometryKernelRequest({
        id: "geometry_req_circle_revolve",
        version: "geometry-kernel.v1",
        op: "geometry.revolveProfile",
        sketchPlane: "XZ",
        profile: {
          kind: "circle",
          center: [2, 0],
          radius: 0.5
        },
        axis: {
          start: [0, -2],
          end: [0, 2]
        },
        angleDegrees: 180
      });

      expect(rectangle.ok).toBe(true);
      expect(circle.ok).toBe(true);

      if (!rectangle.ok || !circle.ok) {
        throw new Error("Expected revolve profile tessellation to succeed.");
      }

      expect(rectangle.mesh.primitive).toBe("revolve");
      expect(rectangle.mesh.vertexCount).toBeGreaterThan(0);
      expect(rectangle.mesh.triangleCount).toBeGreaterThan(0);
      expect(circle.mesh.primitive).toBe("revolve");
      expect(circle.mesh.vertexCount).toBeGreaterThan(0);
      expect(circle.mesh.triangleCount).toBeGreaterThan(0);
      expect(getGeometryResponseTransferables(rectangle)).toEqual([
        rectangle.mesh.positions.buffer,
        rectangle.mesh.indices.buffer
      ]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact rectangle extrude metadata through the isolated OCCT WASM adapter",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_rect_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [1, 2],
            width: 4,
            height: 3
          },
          depth: 5
        }
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      expect(response.id).toBe("geometry_req_rect_exact_metadata");
      expect(response.op).toBe("geometry.exactBodyMetadata");
      expect(response.warnings).toEqual([]);
      expect(response.metadata.sourceKind).toBe("extrude");
      expect(response.metadata.bounds.min[0]).toBeCloseTo(-1, 6);
      expect(response.metadata.bounds.min[1]).toBeCloseTo(0.5, 6);
      expect(response.metadata.bounds.min[2]).toBeCloseTo(0, 6);
      expect(response.metadata.bounds.max[0]).toBeCloseTo(3, 6);
      expect(response.metadata.bounds.max[1]).toBeCloseTo(3.5, 6);
      expect(response.metadata.bounds.max[2]).toBeCloseTo(5, 6);
      expect(response.metadata.volume).toBeCloseTo(60, 6);
      expect(response.metadata.surfaceArea).toBeCloseTo(94, 6);
      expect(response.metadata.centroid).toEqual([1, 2, 2.5]);
      expect(response.metadata.topologyCounts).toEqual({
        solidCount: 1,
        faceCount: 6,
        edgeCount: 12,
        vertexCount: 8
      });
      expect(response.metadata.measurementSource).toBe("kernel-derived");
      expect(response.metadata.measurementConfidence).toBe("kernel-derived");
      expect(response.metadata.diagnostics).toEqual([]);
      expect(getGeometryResponseTransferables(response)).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "builds one identity-bound exact artifact from one OCCT shape",
    async () => {
      const source = {
        kind: "box",
        dimensions: { width: 2, height: 3, depth: 4 },
        transform: {
          translation: [1, 2, 3],
          rotation: [10, 20, 30],
          scale: [1, 1, 1]
        }
      } as const;
      const response = await executeGeometryKernelRequest(
        createArtifactRequest(source)
      );

      expect(response.ok).toBe(true);
      if (!response.ok) throw new Error(response.error.message);
      expect(response.artifact).toMatchObject({
        artifactVersion: "partbench.exact-body-artifact.v1",
        bodyId: "artifact_body",
        sourceType: "primitiveFeature",
        sourceKind: "box",
        brepFormat: "occt-brep",
        brepWriter: "BRepTools.Write_3",
        brepByteLength: response.artifact.brepBytes.byteLength,
        brepSha256: expect.stringMatching(/^[0-9a-f]{64}$/)
      });
      expect(response.artifact.metadata.topologyCounts).toEqual({
        solidCount: response.artifact.topologySnapshot.entityCounts.solidCount,
        faceCount: response.artifact.topologySnapshot.entityCounts.faceCount,
        edgeCount: response.artifact.topologySnapshot.entityCounts.edgeCount,
        vertexCount: response.artifact.topologySnapshot.entityCounts.vertexCount
      });
      expect(getGeometryResponseTransferables(response)).toEqual([
        response.artifact.brepBytes.buffer
      ]);
      const checkpoint = await executeGeometryKernelRequest({
        id: "geometry_req_shared_artifact_checkpoint",
        version: "geometry-kernel.v1",
        op: "geometry.exactTopologyCheckpointPayload",
        checkpointId: "checkpoint_shared_artifact",
        bodyId: "artifact_body",
        source
      });
      expect(checkpoint.ok).toBe(true);
      if (!checkpoint.ok) throw new Error(checkpoint.error.message);
      expect(checkpoint.checkpointPayload.brepBytes).toEqual(
        response.artifact.brepBytes
      );
      expect(checkpoint.checkpointPayload.topologySnapshot).toEqual(
        response.artifact.topologySnapshot
      );
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "materializes every completed authored exact source family as a same-shape artifact",
    async () => {
      const rectangle = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 4,
          height: 4
        },
        depth: 4,
        side: "positive" as const
      };
      const tool = {
        ...rectangle,
        profile: { ...rectangle.profile, center: [1.5, 0] as const, width: 2 }
      };
      const patternSeed = { kind: "extrude" as const, ...rectangle };
      const sweepProfile = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "circle" as const,
          center: [0, 0] as const,
          radius: 0.2
        }
      };
      const entries: readonly {
        readonly label: string;
        readonly source: ExactBodyArtifactSource;
        readonly nodes: number;
        readonly policy?: ExactBodyArtifactRequest["shapePolicy"];
      }[] = [
        ...(
          [
            {
              kind: "box" as const,
              dimensions: { width: 2, height: 3, depth: 4 }
            },
            {
              kind: "cylinder" as const,
              dimensions: { radius: 1, height: 4 }
            },
            { kind: "sphere" as const, dimensions: { radius: 2 } },
            {
              kind: "cone" as const,
              dimensions: { radius: 2, height: 4 }
            },
            {
              kind: "torus" as const,
              dimensions: { majorRadius: 3, minorRadius: 1 }
            }
          ] as const
        ).map((primitive) => ({
          label: primitive.kind,
          nodes: 1,
          source: {
            ...primitive,
            transform: {
              translation: [1, 2, 3] as const,
              rotation: [5, 10, 15] as const,
              scale: [1, 1, 1] as const
            }
          }
        })),
        {
          label: "rectangle extrude",
          nodes: 1,
          source: { kind: "extrude", ...rectangle }
        },
        {
          label: "wire extrude",
          nodes: 1,
          source: {
            kind: "extrude",
            sketchPlane: "XY",
            profile: mixedWireProfile,
            depth: 4,
            side: "positive"
          }
        },
        ...(["add", "cut"] as const).map((operation) => ({
          label: `boolean ${operation}`,
          nodes: 3,
          source: {
            kind: "booleanExtrudes" as const,
            operation,
            target: rectangle,
            tool
          }
        })),
        {
          label: "region-with-hole extrude",
          nodes: 3,
          source: {
            kind: "booleanExtrudes",
            operation: "cut",
            materialPolicy: "regionPositiveVolumeSingleSolid",
            target: rectangle,
            tool: {
              ...rectangle,
              profile: { kind: "circle", center: [0, 0], radius: 0.5 }
            }
          }
        },
        {
          label: "revolve",
          nodes: 1,
          source: {
            kind: "revolve",
            sketchPlane: "XY",
            profile: { kind: "rectangle", center: [2, 0], width: 1, height: 3 },
            axis: { start: [0, -2], end: [0, 2] },
            angleDegrees: 360
          }
        },
        {
          label: "region revolve",
          nodes: 1,
          source: {
            kind: "revolve",
            sketchPlane: "XY",
            profile: {
              kind: "region",
              frame: mixedWireProfile.frame,
              outer: {
                kind: "rectangle",
                center: [4, 0],
                width: 2,
                height: 4
              },
              holes: [{ kind: "circle", center: [4, 0], radius: 0.5 }],
              sourceIdentity: "v21-region-revolve",
              geometryPolicy: mixedWireProfile.geometryPolicy
            },
            axis: { start: [0, -5], end: [0, 5] },
            angleDegrees: 360
          }
        },
        {
          label: "blind hole",
          nodes: 2,
          source: {
            kind: "hole",
            target: rectangle,
            tool: {
              sketchPlane: "XY",
              circle: { kind: "circle", center: [0, 0], radius: 0.5 },
              depthMode: "blind",
              depth: 2,
              direction: "positive"
            }
          }
        },
        {
          label: "through negative hole",
          nodes: 2,
          source: {
            kind: "hole",
            target: { ...rectangle, side: "symmetric" },
            tool: {
              sketchPlane: "XY",
              circle: { kind: "circle", center: [0, 0], radius: 0.5 },
              depthMode: "throughAll",
              direction: "negative"
            }
          }
        },
        {
          label: "chamfer",
          nodes: 2,
          source: {
            kind: "edgeFinish",
            operation: "chamfer",
            target: rectangle,
            edgeStableId: "generated:edge:body:1:start:uMin",
            distance: 0.2
          }
        },
        {
          label: "fillet",
          nodes: 2,
          source: {
            kind: "edgeFinish",
            operation: "fillet",
            target: rectangle,
            edgeStableId: "generated:edge:body:1:longitudinal:uMax:vMax",
            radius: 0.2
          }
        },
        {
          label: "linear pattern",
          nodes: 2,
          policy: "singleShapeOneOrMoreSolids",
          source: {
            kind: "linearPattern",
            seed: patternSeed,
            direction: [1, 0, 0],
            spacing: 6,
            instanceCount: 3
          }
        },
        {
          label: "circular pattern",
          nodes: 2,
          policy: "singleShapeOneOrMoreSolids",
          source: {
            kind: "circularPattern",
            seed: {
              ...patternSeed,
              profile: { ...rectangle.profile, center: [4, 0] }
            },
            axis: { origin: [0, 0, 0], direction: [0, 0, 1] },
            totalAngleDegrees: 360,
            instanceCount: 4
          }
        },
        {
          label: "mirror",
          nodes: 2,
          source: {
            kind: "mirror",
            seed: {
              ...patternSeed,
              profile: { ...rectangle.profile, center: [2, 0] }
            },
            plane: { point: [0, 0, 0], normal: [1, 0, 0] },
            includeOriginal: false
          }
        },
        {
          label: "shell",
          nodes: 2,
          source: {
            kind: "shell",
            target: patternSeed,
            wallThickness: 0.2,
            openFaceStableIds: ["generated:face:body:endCap"]
          }
        },
        {
          label: "line sweep",
          nodes: 1,
          source: {
            kind: "sweep",
            profile: sweepProfile,
            pathSegments: [{ start: [0, 0, 0], end: [0, 0, 5] }]
          }
        },
        {
          label: "arc sweep",
          nodes: 1,
          source: {
            kind: "sweep",
            profile: {
              ...sweepProfile,
              placementFrame: {
                origin: [10, 20, 30],
                uAxis: [1, 0, 0],
                vAxis: [0, 1, 0]
              }
            },
            pathSegments: [
              {
                kind: "arc",
                start: [10, 20, 30],
                end: [15, 20, 35],
                center: [15, 20, 30],
                normal: [0, 1, 0],
                sweepAngleDegrees: 90
              }
            ]
          }
        },
        {
          label: "G1 sweep",
          nodes: 1,
          source: {
            kind: "sweep",
            profile: sweepProfile,
            pathSegments: [
              { kind: "line", start: [0, 0, 0], end: [0, 0, 2] },
              {
                kind: "arc",
                start: [0, 0, 2],
                end: [1, 0, 3],
                center: [1, 0, 2],
                normal: [0, -1, 0],
                sweepAngleDegrees: -90
              }
            ]
          }
        },
        {
          label: "loft",
          nodes: 1,
          source: {
            kind: "loft",
            sections: [
              {
                sketchPlane: "XY",
                profile: {
                  kind: "rectangle",
                  center: [0, 0],
                  width: 4,
                  height: 3
                }
              },
              {
                sketchPlane: "XY",
                profile: { kind: "circle", center: [0, 0], radius: 1 },
                placementFrame: {
                  origin: [0, 0, 5],
                  uAxis: [1, 0, 0],
                  vAxis: [0, 1, 0]
                }
              }
            ]
          }
        }
      ];

      for (const [index, entry] of entries.entries()) {
        const response = await executeGeometryKernelRequest(
          createArtifactRequest(entry.source, {
            bodyId: `matrix_${index}`,
            sourceGraphNodeCount: entry.nodes,
            shapePolicy: entry.policy
          })
        );
        if (!response.ok)
          throw new Error(`${entry.label}: ${response.error.message}`);
        expect(response.ok, entry.label).toBe(true);
        expect(response.artifact.brepByteLength, entry.label).toBeGreaterThan(
          1000
        );
        expect(
          response.artifact.metadata.topologyCounts.solidCount,
          entry.label
        ).toBeGreaterThan(0);
        expect(
          response.artifact.metadata.topologyCounts,
          entry.label
        ).toMatchObject({
          solidCount:
            response.artifact.topologySnapshot.entityCounts.solidCount,
          faceCount: response.artifact.topologySnapshot.entityCounts.faceCount,
          edgeCount: response.artifact.topologySnapshot.entityCounts.edgeCount,
          vertexCount:
            response.artifact.topologySnapshot.entityCounts.vertexCount
        });
        if (entry.label === "wire extrude") {
          expect(response.artifact.metadata.generatedReferences?.status).toBe(
            "ready"
          );
          expect(
            response.artifact.topologySnapshot.generatedReferences?.status
          ).toBe("ready");
        }
        await expectArtifactWritesNamedStep(response.artifact, entry.label);
      }
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "builds verified checkpoint-backed downstream artifacts from the parsed target shape",
    async () => {
      const baseSource = {
        kind: "extrude" as const,
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 4,
          height: 4
        },
        depth: 4,
        side: "positive" as const
      };
      const base = await executeGeometryKernelRequest(
        createArtifactRequest(baseSource, {
          bodyId: "checkpoint_target",
          sourceType: "sketchExtrudeFeature"
        })
      );
      expect(base.ok).toBe(true);
      if (!base.ok) throw new Error(base.error.message);
      const importedTopology = await executeGeometryKernelRequest({
        id: "geometry_req_checkpoint_imported_topology",
        version: "geometry-kernel.v1",
        op: "geometry.exactTopologySnapshot",
        source: {
          kind: "importedBody",
          brepBytes: base.artifact.brepBytes
        }
      });
      expect(importedTopology.ok).toBe(true);
      if (!importedTopology.ok) {
        throw new Error(importedTopology.error.message);
      }
      const imported = await executeGeometryKernelRequest(
        createArtifactRequest(
          {
            kind: "checkpointBody",
            brepBytes: base.artifact.brepBytes,
            brepByteLength: base.artifact.brepByteLength,
            brepSha256: base.artifact.brepSha256,
            topologySourceKind: "importedBody",
            topologySignature: importedTopology.snapshot.signature
          },
          {
            bodyId: "imported_checkpoint_body",
            sourceType: "importedStepBody",
            shapePolicy: "checkpointShape"
          }
        )
      );
      expect(imported.ok).toBe(true);
      if (!imported.ok) throw new Error(imported.error.message);
      expect(imported.artifact.sourceKind).toBe("importedBody");
      await expectArtifactWritesNamedStep(
        imported.artifact,
        "Imported checkpoint Ω"
      );
      const target = {
        kind: "checkpointBody" as const,
        brepBytes: base.artifact.brepBytes,
        brepByteLength: base.artifact.brepByteLength,
        brepSha256: base.artifact.brepSha256,
        topologySourceKind: base.artifact.topologySnapshot.sourceKind,
        topologySignature: base.artifact.topologySnapshot.signature
      };
      const restoredAuthored = await executeGeometryKernelRequest(
        createArtifactRequest(target, {
          bodyId: "authored_checkpoint_body",
          sourceType: "sketchExtrudeFeature",
          shapePolicy: "checkpointShape"
        })
      );
      expect(restoredAuthored.ok).toBe(true);
      if (!restoredAuthored.ok) {
        throw new Error(restoredAuthored.error.message);
      }
      expect(restoredAuthored.artifact.sourceKind).toBe("extrude");
      expect(restoredAuthored.artifact.topologySnapshot.signature).toBe(
        target.topologySignature
      );
      const tool = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [1.5, 0] as const,
          width: 2,
          height: 2
        },
        depth: 4,
        side: "positive" as const
      };
      const sources: readonly {
        readonly expectedKind: string;
        readonly graphNodes: number;
        readonly source: ExactBodyArtifactSource;
      }[] = [
        {
          expectedKind: "booleanExtrudes",
          graphNodes: 3,
          source: { kind: "checkpointBoolean", operation: "add", target, tool }
        },
        {
          expectedKind: "booleanExtrudes",
          graphNodes: 3,
          source: {
            kind: "checkpointBoolean",
            operation: "cut",
            target,
            tool: {
              ...tool,
              profile: { ...tool.profile, center: [0, 0] }
            }
          }
        },
        {
          expectedKind: "hole",
          graphNodes: 2,
          source: {
            kind: "checkpointHole",
            target,
            tool: {
              sketchPlane: "XY",
              circle: { kind: "circle", center: [0, 0], radius: 0.5 },
              depthMode: "blind",
              depth: 2,
              direction: "positive"
            }
          }
        },
        ...(["chamfer", "fillet"] as const).map((operation) => ({
          expectedKind: "edgeFinish",
          graphNodes: 2,
          source: {
            kind: "checkpointEdgeFinish" as const,
            operation,
            target,
            checkpointEntityId: "snapshot-local:edge:1",
            amount: 0.1
          }
        }))
      ];

      for (const [index, entry] of sources.entries()) {
        const response = await executeGeometryKernelRequest(
          createArtifactRequest(entry.source, {
            bodyId: `checkpoint_result_${index}`,
            sourceType:
              entry.expectedKind === "hole"
                ? "sketchHoleFeature"
                : entry.expectedKind === "edgeFinish"
                  ? "edgeChamferFeature"
                  : "sketchExtrudeFeature",
            sourceGraphNodeCount: entry.graphNodes
          })
        );
        expect(response.ok).toBe(true);
        if (!response.ok) throw new Error(response.error.message);
        expect(response.artifact.sourceKind).toBe(entry.expectedKind);
        expect(response.artifact.metadata.topologyCounts.solidCount).toBe(1);
        await expectArtifactWritesNamedStep(
          response.artifact,
          `Checkpoint ${entry.expectedKind} Ω`
        );
      }
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact circle extrude metadata through the isolated OCCT WASM adapter",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_circle_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "extrude",
          sketchPlane: "XZ",
          profile: {
            kind: "circle",
            center: [0, 0],
            radius: 2
          },
          depth: 6
        }
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      expect(response.metadata.sourceKind).toBe("extrude");
      expect(response.metadata.bounds.min[0]).toBeCloseTo(-2, 6);
      expect(response.metadata.bounds.max[0]).toBeCloseTo(2, 6);
      expect(response.metadata.bounds.min[1]).toBeCloseTo(0, 6);
      expect(response.metadata.bounds.max[1]).toBeCloseTo(6, 6);
      expect(response.metadata.bounds.min[2]).toBeCloseTo(-2, 6);
      expect(response.metadata.bounds.max[2]).toBeCloseTo(2, 6);
      expect(response.metadata.volume).toBeCloseTo(Math.PI * 4 * 6, 6);
      expect(response.metadata.surfaceArea).toBeCloseTo(
        2 * Math.PI * 2 * (2 + 6),
        6
      );
      expect(response.metadata.centroid[0]).toBeCloseTo(0, 6);
      expect(response.metadata.centroid[1]).toBeCloseTo(3, 6);
      expect(response.metadata.centroid[2]).toBeCloseTo(0, 6);
      expect(response.metadata.topologyCounts.solidCount).toBe(1);
      expect(response.metadata.topologyCounts.faceCount).toBeGreaterThanOrEqual(
        3
      );
      expect(response.metadata.measurementSource).toBe("kernel-derived");
      expect(response.metadata.measurementConfidence).toBe("kernel-derived");
      expect(response.metadata.diagnostics).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact revolve metadata through the isolated OCCT WASM adapter",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_revolve_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "revolve",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [2, 0],
            width: 1,
            height: 3
          },
          axis: { start: [0, -2], end: [0, 2] },
          angleDegrees: 360
        }
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      expect(response.metadata.sourceKind).toBe("revolve");
      expect(response.metadata.volume).toBeCloseTo(12 * Math.PI, 6);
      expect(response.metadata.surfaceArea).toBeCloseTo(32 * Math.PI, 6);
      expect(response.metadata.centroid[0]).toBeCloseTo(0, 6);
      expect(response.metadata.topologyCounts.solidCount).toBe(1);
      expect(response.metadata.topologyCounts.faceCount).toBeGreaterThan(0);
      expect(response.metadata.measurementSource).toBe("kernel-derived");
      expect(response.metadata.measurementConfidence).toBe("kernel-derived");
      expect(getGeometryResponseTransferables(response)).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact hole metadata through the isolated OCCT WASM adapter",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_hole_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "hole",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 6,
              height: 4
            },
            depth: 3,
            side: "positive"
          },
          tool: {
            sketchPlane: "XY",
            circle: {
              kind: "circle",
              center: [0, 0],
              radius: 0.5
            },
            depthMode: "blind",
            depth: 2,
            direction: "positive"
          }
        }
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      expect(response.metadata.sourceKind).toBe("hole");
      expect(response.metadata.volume).toBeCloseTo(72 - Math.PI * 0.5, 5);
      expect(response.metadata.surfaceArea).toBeGreaterThan(0);
      expect(response.metadata.centroid[2]).toBeGreaterThan(1.5);
      expect(response.metadata.topologyCounts.solidCount).toBe(1);
      expect(response.metadata.topologyCounts.faceCount).toBeGreaterThan(0);
      expect(response.metadata.measurementSource).toBe("kernel-derived");
      expect(response.metadata.measurementConfidence).toBe("kernel-derived");
      expect(response.metadata.diagnostics).toEqual([]);
      expect(getGeometryResponseTransferables(response)).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact edge-finish metadata through the isolated OCCT WASM adapter",
    async () => {
      const target = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 6,
          height: 4
        },
        depth: 4
      };
      const chamfer = await executeGeometryKernelRequest({
        id: "geometry_req_chamfer_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "edgeFinish",
          operation: "chamfer",
          target,
          edgeStableId: "generated:edge:body:1:start:uMin",
          distance: 0.25
        }
      });
      const fillet = await executeGeometryKernelRequest({
        id: "geometry_req_fillet_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "edgeFinish",
          operation: "fillet",
          target,
          edgeStableId: "generated:edge:body:1:longitudinal:uMax:vMax",
          radius: 0.2
        }
      });

      expect(chamfer.ok || chamfer.error.code === "UNAVAILABLE_BINDING").toBe(
        true
      );
      expect(fillet.ok || fillet.error.code === "UNAVAILABLE_BINDING").toBe(
        true
      );

      if (!chamfer.ok || !fillet.ok) {
        return;
      }

      expect(chamfer.metadata.sourceKind).toBe("edgeFinish");
      expect(chamfer.metadata.bounds.min[0]).toBeCloseTo(-3, 6);
      expect(chamfer.metadata.bounds.min[1]).toBeCloseTo(-2, 6);
      expect(chamfer.metadata.bounds.min[2]).toBeCloseTo(0, 6);
      expect(chamfer.metadata.bounds.max[0]).toBeCloseTo(3, 6);
      expect(chamfer.metadata.bounds.max[1]).toBeCloseTo(2, 6);
      expect(chamfer.metadata.bounds.max[2]).toBeCloseTo(4, 6);
      expect(chamfer.metadata.volume).toBeLessThan(96);
      expect(chamfer.metadata.volume).toBeGreaterThan(0);
      expect(chamfer.metadata.surfaceArea).toBeGreaterThan(0);
      expect(chamfer.metadata.topologyCounts.solidCount).toBe(1);
      expect(chamfer.metadata.topologyCounts.faceCount).toBeGreaterThan(0);
      expect(chamfer.metadata.measurementSource).toBe("kernel-derived");
      expect(fillet.metadata.sourceKind).toBe("edgeFinish");
      expect(fillet.metadata.volume).toBeLessThan(96);
      expect(fillet.metadata.volume).toBeGreaterThan(0);
      expect(fillet.metadata.topologyCounts.solidCount).toBe(1);
      expect(getGeometryResponseTransferables(chamfer)).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "maps extrude mesh bounds for negative and symmetric sides",
    async () => {
      const negative = await executeGeometryKernelRequest({
        id: "geometry_req_rect_negative_extrude",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateExtrude",
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 2,
          height: 2
        },
        depth: 4,
        side: "negative"
      });
      const symmetric = await executeGeometryKernelRequest({
        id: "geometry_req_rect_symmetric_extrude",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateExtrude",
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 2,
          height: 2
        },
        depth: 4,
        side: "symmetric"
      });

      expect(negative.ok).toBe(true);
      expect(symmetric.ok).toBe(true);

      if (!negative.ok || !symmetric.ok) {
        throw new Error("Expected extrude side tessellation to succeed.");
      }

      expect(getMeshBounds(negative.mesh.positions)).toEqual({
        min: [-1, -1, -4],
        max: [1, 1, 0]
      });
      expect(getMeshBounds(symmetric.mesh.positions)).toEqual({
        min: [-1, -1, -2],
        max: [1, 1, 2]
      });
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "runs add and cut boolean feasibility requests for rectangle extrude sources",
    async () => {
      const target = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 4,
          height: 4
        },
        depth: 4
      };
      const tool = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [2, 0] as const,
          width: 2,
          height: 2
        },
        depth: 4
      };
      const add = await executeGeometryKernelRequest({
        id: "geometry_req_boolean_add",
        version: "geometry-kernel.v1",
        op: "geometry.booleanExtrudes",
        operation: "add",
        target,
        tool
      });
      const cut = await executeGeometryKernelRequest({
        id: "geometry_req_boolean_cut",
        version: "geometry-kernel.v1",
        op: "geometry.booleanExtrudes",
        operation: "cut",
        target,
        tool
      });

      expect(add.ok).toBe(true);
      expect(cut.ok).toBe(true);

      if (!add.ok || !cut.ok) {
        throw new Error("Expected rectangle boolean feasibility to succeed.");
      }

      expect(add.mesh.primitive).toBe("boolean");
      expect(add.mesh.vertexCount).toBeGreaterThan(0);
      expect(add.mesh.triangleCount).toBeGreaterThan(0);
      expect(getMeshBounds(add.mesh.positions)).toEqual({
        min: [-2, -2, 0],
        max: [3, 2, 4]
      });
      expect(cut.mesh.primitive).toBe("boolean");
      expect(cut.mesh.vertexCount).toBeGreaterThan(0);
      expect(cut.mesh.triangleCount).toBeGreaterThan(0);
      expect(getGeometryResponseTransferables(add)).toEqual([
        add.mesh.positions.buffer,
        add.mesh.indices.buffer
      ]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "runs a composite wire add through mesh, exact metadata, topology, checkpoint, and STEP",
    async () => {
      const source = {
        kind: "booleanExtrudes" as const,
        operation: "add" as const,
        target: {
          sketchPlane: "XY" as const,
          profile: {
            kind: "rectangle" as const,
            center: [0, 0] as const,
            width: 8,
            height: 6
          },
          depth: 4,
          side: "symmetric" as const
        },
        tool: {
          sketchPlane: "XY" as const,
          profile: {
            ...mixedWireProfile,
            frame: { ...mixedWireProfile.frame, origin: [4, 0, 0] as const }
          },
          depth: 4,
          side: "symmetric" as const
        }
      };
      const stepBody = await createStepArtifactBody(source, "body_wire_add", 3);
      const [mesh, metadata, topology, checkpoint, step] = await Promise.all([
        executeGeometryKernelRequest({
          id: "geometry_req_wire_add",
          version: "geometry-kernel.v1",
          op: "geometry.booleanExtrudes",
          operation: "add",
          target: source.target,
          tool: source.tool
        }),
        executeGeometryKernelRequest({
          id: "geometry_req_wire_add_metadata",
          version: "geometry-kernel.v1",
          op: "geometry.exactBodyMetadata",
          source
        }),
        executeGeometryKernelRequest({
          id: "geometry_req_wire_add_topology",
          version: "geometry-kernel.v1",
          op: "geometry.exactTopologySnapshot",
          source
        }),
        executeGeometryKernelRequest({
          id: "geometry_req_wire_add_checkpoint",
          version: "geometry-kernel.v1",
          op: "geometry.exactTopologyCheckpointPayload",
          checkpointId: "checkpoint_wire_add",
          bodyId: "body_wire_add",
          source
        }),
        executeGeometryKernelRequest({
          id: "geometry_req_wire_add_step",
          version: "geometry-kernel.v1",
          op: "geometry.exportStep",
          units: "mm",
          bodies: [stepBody]
        })
      ]);

      expect(mesh.ok).toBe(true);
      expect(metadata.ok).toBe(true);
      expect(topology.ok).toBe(true);
      expect(checkpoint.ok).toBe(true);
      expect(step.ok).toBe(true);
      if (
        !mesh.ok ||
        !metadata.ok ||
        !topology.ok ||
        !checkpoint.ok ||
        !step.ok
      ) {
        throw new Error("Expected every composite add geometry route to pass.");
      }
      expect(mesh.mesh.generatedReferences).toBeUndefined();
      expect(metadata.metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.metadata.topologyCounts.faceCount).toBe(
        topology.snapshot.entityCounts.faceCount
      );
      expect(checkpoint.checkpointPayload.topologySnapshot.signature).toBe(
        topology.snapshot.signature
      );
      expect(step.artifact.bodyCount).toBe(1);
      expect(step.artifact.byteLength).toBeGreaterThan(1000);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "runs a composite wire cut through mesh, exact metadata, topology, checkpoint, and STEP",
    async () => {
      const source = {
        kind: "booleanExtrudes" as const,
        operation: "cut" as const,
        target: {
          sketchPlane: "XY" as const,
          profile: {
            kind: "rectangle" as const,
            center: [0, 0] as const,
            width: 8,
            height: 6
          },
          depth: 4,
          side: "symmetric" as const
        },
        tool: {
          sketchPlane: "XY" as const,
          profile: mixedWireProfile,
          depth: 4,
          side: "symmetric" as const
        }
      };
      const stepBody = await createStepArtifactBody(source, "body_wire_cut", 3);
      const [mesh, metadata, topology, checkpoint, step] = await Promise.all([
        executeGeometryKernelRequest({
          id: "geometry_req_wire_cut",
          version: "geometry-kernel.v1",
          op: "geometry.booleanExtrudes",
          operation: "cut",
          target: source.target,
          tool: source.tool
        }),
        executeGeometryKernelRequest({
          id: "geometry_req_wire_cut_metadata",
          version: "geometry-kernel.v1",
          op: "geometry.exactBodyMetadata",
          source
        }),
        executeGeometryKernelRequest({
          id: "geometry_req_wire_cut_topology",
          version: "geometry-kernel.v1",
          op: "geometry.exactTopologySnapshot",
          source
        }),
        executeGeometryKernelRequest({
          id: "geometry_req_wire_cut_checkpoint",
          version: "geometry-kernel.v1",
          op: "geometry.exactTopologyCheckpointPayload",
          checkpointId: "checkpoint_wire_cut",
          bodyId: "body_wire_cut",
          source
        }),
        executeGeometryKernelRequest({
          id: "geometry_req_wire_cut_step",
          version: "geometry-kernel.v1",
          op: "geometry.exportStep",
          units: "mm",
          bodies: [stepBody]
        })
      ]);

      expect(mesh.ok).toBe(true);
      expect(metadata.ok).toBe(true);
      expect(topology.ok).toBe(true);
      expect(checkpoint.ok).toBe(true);
      expect(step.ok).toBe(true);
      if (
        !mesh.ok ||
        !metadata.ok ||
        !topology.ok ||
        !checkpoint.ok ||
        !step.ok
      ) {
        throw new Error("Expected every composite cut geometry route to pass.");
      }
      expect(mesh.mesh.generatedReferences).toBeUndefined();
      expect(getMeshBounds(mesh.mesh.positions)).toEqual({
        min: [-4, -3, -2],
        max: [4, 3, 2]
      });
      expect(metadata.metadata.bounds).toEqual({
        min: [
          expect.closeTo(-4, 5),
          expect.closeTo(-3, 5),
          expect.closeTo(-2, 5)
        ],
        max: [expect.closeTo(4, 5), expect.closeTo(3, 5), expect.closeTo(2, 5)]
      });
      expect(metadata.metadata.volume).toBeGreaterThan(0);
      expect(metadata.metadata.volume).toBeLessThan(8 * 6 * 4);
      expect(metadata.metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.metadata.topologyCounts.faceCount).toBe(
        topology.snapshot.entityCounts.faceCount
      );
      expect(checkpoint.checkpointPayload.topologySnapshot.signature).toBe(
        topology.snapshot.signature
      );
      expect(step.artifact.bodyCount).toBe(1);
      expect(step.artifact.byteLength).toBeGreaterThan(1000);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it("rejects malformed wire-cut and mixed-frame boolean branches", async () => {
    const target = {
      sketchPlane: "XY" as const,
      profile: {
        kind: "rectangle" as const,
        center: [0, 0] as const,
        width: 8,
        height: 6
      },
      depth: 4
    };
    const tool = {
      sketchPlane: "XY" as const,
      profile: mixedWireProfile,
      depth: 4
    };
    const malformedCut = await executeGeometryKernelRequest({
      id: "geometry_req_wire_cut_mixed_frame",
      version: "geometry-kernel.v1",
      op: "geometry.booleanExtrudes",
      operation: "cut",
      target,
      tool: {
        ...tool,
        placementFrame: {
          origin: [0, 0, 0],
          uAxis: [1, 0, 0],
          vAxis: [0, 1, 0]
        }
      }
    } as never);
    const mixedFrame = await executeGeometryKernelRequest({
      id: "geometry_req_wire_add_mixed_frame",
      version: "geometry-kernel.v1",
      op: "geometry.booleanExtrudes",
      operation: "add",
      target,
      tool: {
        ...tool,
        placementFrame: {
          origin: [0, 0, 0],
          uAxis: [1, 0, 0],
          vAxis: [0, 1, 0]
        }
      }
    } as never);
    const missingTool = await executeGeometryKernelRequest({
      id: "geometry_req_wire_add_missing_tool",
      version: "geometry-kernel.v1",
      op: "geometry.booleanExtrudes",
      operation: "add",
      target
    } as never);
    const nullProfile = await executeGeometryKernelRequest({
      id: "geometry_req_wire_add_null_profile",
      version: "geometry-kernel.v1",
      op: "geometry.booleanExtrudes",
      operation: "add",
      target,
      tool: {
        sketchPlane: "XY",
        profile: null,
        depth: 4
      }
    } as never);
    const nullTarget = await executeGeometryKernelRequest({
      id: "geometry_req_wire_add_null_target",
      version: "geometry-kernel.v1",
      op: "geometry.booleanExtrudes",
      operation: "add",
      target: null,
      tool
    } as never);

    expect(malformedCut).toMatchObject({
      ok: false,
      error: { code: "INVALID_DIMENSIONS" }
    });
    expect(mixedFrame).toMatchObject({
      ok: false,
      error: { code: "INVALID_DIMENSIONS" }
    });
    expect(missingTool).toMatchObject({
      ok: false,
      error: { code: "INVALID_DIMENSIONS" }
    });
    expect(nullProfile).toMatchObject({
      ok: false,
      error: { code: "INVALID_DIMENSIONS" }
    });
    expect(nullTarget).toMatchObject({
      ok: false,
      error: { code: "INVALID_DIMENSIONS" }
    });
  });

  it.each([
    ["cyclic", undefined],
    ["over-deep", MAX_BOOLEAN_EXTRUDE_RECIPE_DEPTH + 1]
  ] as const)(
    "rejects %s recursive boolean recipes for mesh and exact metadata",
    async (label, resultDepth) => {
      let source: BooleanExtrudeSource;
      if (resultDepth === undefined) {
        const cyclic = {
          kind: "booleanExtrudes" as const,
          operation: "add" as const,
          target: booleanRecipePrimitive as BooleanExtrudeSource,
          tool: booleanRecipePrimitive
        };
        (cyclic as { target: BooleanExtrudeSource }).target = cyclic;
        source = cyclic;
      } else {
        source = createNestedBooleanRecipe(resultDepth);
      }
      const [mesh, exact] = await Promise.all([
        executeGeometryKernelRequest({
          id: `geometry_req_${label}_boolean_mesh`,
          version: "geometry-kernel.v1",
          op: "geometry.booleanExtrudes",
          operation: "add",
          target: source,
          tool: booleanRecipePrimitive
        }),
        executeGeometryKernelRequest({
          id: `geometry_req_${label}_boolean_exact`,
          version: "geometry-kernel.v1",
          op: "geometry.exactBodyMetadata",
          source: source as Extract<
            BooleanExtrudeSource,
            { kind: "booleanExtrudes" }
          >
        })
      ]);

      for (const response of [mesh, exact]) {
        expect(response).toMatchObject({
          ok: false,
          error: { code: "INVALID_DIMENSIONS" }
        });
      }
    }
  );

  it(
    "runs circle-tool boolean feasibility requests on supported targets",
    async () => {
      const rectangleTarget = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 4,
          height: 4
        },
        depth: 4
      };
      const circleTarget = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "circle" as const,
          center: [0, 0] as const,
          radius: 3
        },
        depth: 4
      };
      const circleTool = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "circle" as const,
          center: [1, 0] as const,
          radius: 0.5
        },
        depth: 4
      };
      const rectangleAdd = await executeGeometryKernelRequest({
        id: "geometry_req_boolean_circle_tool_add",
        version: "geometry-kernel.v1",
        op: "geometry.booleanExtrudes",
        operation: "add",
        target: rectangleTarget,
        tool: circleTool
      });
      const rectangleCut = await executeGeometryKernelRequest({
        id: "geometry_req_boolean_circle_tool_cut",
        version: "geometry-kernel.v1",
        op: "geometry.booleanExtrudes",
        operation: "cut",
        target: rectangleTarget,
        tool: circleTool
      });
      const circleCut = await executeGeometryKernelRequest({
        id: "geometry_req_boolean_circle_target_circle_cut",
        version: "geometry-kernel.v1",
        op: "geometry.booleanExtrudes",
        operation: "cut",
        target: circleTarget,
        tool: circleTool
      });
      const circleAdd = await executeGeometryKernelRequest({
        id: "geometry_req_boolean_circle_target_circle_add",
        version: "geometry-kernel.v1",
        op: "geometry.booleanExtrudes",
        operation: "add",
        target: circleTarget,
        tool: circleTool
      });

      expect(rectangleAdd.ok).toBe(true);
      expect(rectangleCut.ok).toBe(true);
      expect(circleCut.ok).toBe(true);
      expect(circleAdd.ok).toBe(true);

      if (
        !rectangleAdd.ok ||
        !rectangleCut.ok ||
        !circleCut.ok ||
        !circleAdd.ok
      ) {
        throw new Error("Expected supported circle-tool booleans to succeed.");
      }

      for (const response of [
        rectangleAdd,
        rectangleCut,
        circleCut,
        circleAdd
      ]) {
        expect(response.mesh.primitive).toBe("boolean");
        expect(response.mesh.vertexCount).toBeGreaterThan(0);
        expect(response.mesh.triangleCount).toBeGreaterThan(0);
      }
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it("passes nested boolean target sources to injected boolean factories", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    let captured:
      | Parameters<GeometryKernelMeshFactories["createBooleanExtrudeMesh"]>[0]
      | undefined;
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: async (input) => {
        captured = input;

        return {
          primitive: "boolean",
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          indices: new Uint32Array([0, 1, 2]),
          vertexCount: 3,
          triangleCount: 1,
          faceCount: 1
        };
      }
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_nested_boolean_cut",
        version: "geometry-kernel.v1",
        op: "geometry.booleanExtrudes",
        operation: "cut",
        target: {
          kind: "booleanExtrudes",
          operation: "cut",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 4,
              height: 4
            },
            depth: 4
          },
          tool: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [-0.5, 0],
              width: 1,
              height: 1
            },
            depth: 4
          }
        },
        tool: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0.5, 0],
            width: 1,
            height: 1
          },
          depth: 4
        }
      }
    );

    expect(response.ok).toBe(true);
    expect(captured).toMatchObject({
      operation: "cut",
      target: {
        kind: "booleanExtrudes",
        operation: "cut",
        target: {
          profile: { kind: "rectangle", width: 4 }
        },
        tool: {
          profile: { kind: "rectangle", width: 1 }
        }
      },
      tool: {
        profile: { kind: "rectangle", width: 1 }
      }
    });
  });

  it("passes shell targets and open faces to injected shell factories", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    let captured:
      | Parameters<
          NonNullable<GeometryKernelMeshFactories["createShellMesh"]>
        >[0]
      | undefined;
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createShellMesh: async (input) => {
        captured = input;

        return {
          primitive: "boolean",
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          indices: new Uint32Array([0, 1, 2]),
          vertexCount: 3,
          triangleCount: 1,
          faceCount: 1
        };
      }
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_shell",
        version: "geometry-kernel.v1",
        op: "geometry.shell",
        target: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 4
          },
          depth: 4
        },
        wallThickness: 0.2,
        openFaceStableIds: ["generated:face:body_seed:endCap"],
        tessellation: { linearDeflection: 0.25 }
      }
    );

    expect(response.ok).toBe(true);
    expect(captured).toMatchObject({
      target: {
        kind: "extrude",
        profile: { kind: "rectangle", width: 4 }
      },
      wallThickness: 0.2,
      openFaceStableIds: ["generated:face:body_seed:endCap"],
      linearDeflection: 0.25
    });
  });

  it("passes sweep profiles and line paths to injected sweep factories", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    let captured:
      | Parameters<
          NonNullable<GeometryKernelMeshFactories["createSweepMesh"]>
        >[0]
      | undefined;
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createSweepMesh: async (input) => {
        captured = input;
        return {
          primitive: "sweep",
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          indices: new Uint32Array([0, 1, 2]),
          vertexCount: 3,
          triangleCount: 1,
          faceCount: 1
        };
      }
    };
    const profile = {
      sketchPlane: "XY" as const,
      profile: {
        kind: "rectangle" as const,
        center: [0, 0] as const,
        width: 2,
        height: 1
      }
    };
    const pathSegments = [{ start: [0, 0, 0], end: [0, 0, 5] }] as const;

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_sweep",
        version: "geometry-kernel.v1",
        op: "geometry.sweep",
        profile,
        pathSegments,
        tessellation: { linearDeflection: 0.25 }
      }
    );

    expect(response.ok).toBe(true);
    expect(captured).toEqual({
      profile,
      pathSegments,
      linearDeflection: 0.25
    });
  });

  it("passes signed arcs and ordered G1 chains to the sweep boundary", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const captured: unknown[] = [];
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createSweepMesh: async (input) => {
        captured.push(input);
        return {
          primitive: "sweep",
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          indices: new Uint32Array([0, 1, 2]),
          vertexCount: 3,
          triangleCount: 1,
          faceCount: 1
        };
      }
    };
    const profile = {
      sketchPlane: "XY" as const,
      profile: {
        kind: "circle" as const,
        center: [0, 0] as const,
        radius: 0.5
      }
    };
    const pathSegments = [
      {
        kind: "arc" as const,
        start: [0, 0, 0] as const,
        end: [5, 0, 5] as const,
        center: [5, 0, 0] as const,
        normal: [0, 1, 0] as const,
        sweepAngleDegrees: 90
      }
    ];
    const chainSegments = [
      {
        kind: "line" as const,
        start: [0, 0, 0] as const,
        end: [0, 0, 2] as const
      },
      {
        kind: "arc" as const,
        start: [0, 0, 2] as const,
        end: [2, 0, 2] as const,
        center: [1, 0, 2] as const,
        normal: [0, -1, 0] as const,
        sweepAngleDegrees: -180
      },
      {
        kind: "line" as const,
        start: [2, 0, 2] as const,
        end: [2, 0, 0] as const
      }
    ];
    const [mesh, chainMesh] = await Promise.all([
      executeGeometryKernelRequestWithMeshFactory(factories, {
        id: "geometry_req_arc_sweep",
        version: "geometry-kernel.v1",
        op: "geometry.sweep",
        profile,
        pathSegments
      }),
      executeGeometryKernelRequestWithMeshFactory(factories, {
        id: "geometry_req_chain_sweep",
        version: "geometry-kernel.v1",
        op: "geometry.sweep",
        profile,
        pathSegments: chainSegments
      })
    ]);

    expect(mesh.ok).toBe(true);
    expect(chainMesh.ok).toBe(true);
    expect(captured).toHaveLength(2);
  });

  it("rejects inconsistent arcs and non-G1 path chains", async () => {
    const profile = {
      sketchPlane: "XY" as const,
      profile: {
        kind: "circle" as const,
        center: [0, 0] as const,
        radius: 0.5
      }
    };
    const invalidArc = {
      kind: "arc" as const,
      start: [0, 0, 0] as const,
      end: [5, 0, -5] as const,
      center: [5, 0, 0] as const,
      normal: [0, 1, 0] as const,
      sweepAngleDegrees: 90
    };
    const [inconsistent, chain] = await Promise.all([
      executeGeometryKernelRequest({
        id: "geometry_req_bad_arc_sweep",
        version: "geometry-kernel.v1",
        op: "geometry.sweep",
        profile,
        pathSegments: [invalidArc]
      }),
      executeGeometryKernelRequest({
        id: "geometry_req_g0_chain_sweep",
        version: "geometry-kernel.v1",
        op: "geometry.sweep",
        profile,
        pathSegments: [
          { start: [0, 0, 0], end: [0, 0, 5] },
          { start: [0, 0, 5], end: [5, 0, 5] }
        ]
      })
    ]);

    expect(inconsistent).toMatchObject({
      ok: false,
      error: { code: "SWEEP_CURVED_PATH_UNSUPPORTED" }
    });
    expect(chain).toMatchObject({
      ok: false,
      error: { code: "SWEEP_CURVED_PATH_UNSUPPORTED" }
    });
  });

  it(
    "runs a circle-target cut by rectangle tool feasibility request",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_boolean_circle_cut",
        version: "geometry-kernel.v1",
        op: "geometry.booleanExtrudes",
        operation: "cut",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "circle",
            center: [0, 0],
            radius: 3
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 6
          },
          depth: 4
        }
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      const bounds = getMeshBounds(response.mesh.positions);

      expect(response.mesh.primitive).toBe("boolean");
      expect(response.mesh.vertexCount).toBeGreaterThan(0);
      expect(response.mesh.triangleCount).toBeGreaterThan(0);
      expect(bounds.min[0]).toBeCloseTo(-3, 6);
      expect(bounds.max[0]).toBeCloseTo(3, 6);
      expect(bounds.min[1]).toBeGreaterThanOrEqual(-3);
      expect(bounds.max[1]).toBeLessThanOrEqual(3);
      expect(bounds.min[2]).toBeCloseTo(0, 6);
      expect(bounds.max[2]).toBeCloseTo(4, 6);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "runs rectangle and circle target hole feasibility requests",
    async () => {
      const rectangleHole = await executeGeometryKernelRequest({
        id: "geometry_req_hole_rectangle_blind",
        version: "geometry-kernel.v1",
        op: "geometry.hole",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 6,
            height: 4
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XY",
          circle: {
            kind: "circle",
            center: [0, 0],
            radius: 0.75
          },
          depthMode: "blind",
          depth: 3,
          direction: "positive"
        }
      });
      const circleHole = await executeGeometryKernelRequest({
        id: "geometry_req_hole_circle_through",
        version: "geometry-kernel.v1",
        op: "geometry.hole",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "circle",
            center: [0, 0],
            radius: 3
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XY",
          circle: {
            kind: "circle",
            center: [0, 0],
            radius: 0.75
          },
          depthMode: "throughAll",
          direction: "positive"
        }
      });
      const circleSideHole = await executeGeometryKernelRequest({
        id: "geometry_req_hole_circle_side_plane_through",
        version: "geometry-kernel.v1",
        op: "geometry.hole",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "circle",
            center: [0, 0],
            radius: 3
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XZ",
          circle: {
            kind: "circle",
            center: [0, 2],
            radius: 0.75
          },
          depthMode: "throughAll",
          direction: "positive"
        }
      });

      expect(rectangleHole.ok).toBe(true);
      expect(circleHole.ok).toBe(true);
      expect(circleSideHole.ok).toBe(true);

      if (!rectangleHole.ok || !circleHole.ok || !circleSideHole.ok) {
        throw new Error("Expected hole feasibility requests to succeed.");
      }

      expect(rectangleHole.mesh.primitive).toBe("hole");
      expect(rectangleHole.mesh.vertexCount).toBeGreaterThan(0);
      expect(rectangleHole.mesh.triangleCount).toBeGreaterThan(0);
      expect(getMeshBounds(rectangleHole.mesh.positions)).toEqual({
        min: [-3, -2, 0],
        max: [3, 2, 4]
      });
      expect(circleHole.mesh.primitive).toBe("hole");
      expect(circleHole.mesh.vertexCount).toBeGreaterThan(0);
      expect(circleHole.mesh.triangleCount).toBeGreaterThan(0);
      expect(circleSideHole.mesh.primitive).toBe("hole");
      expect(circleSideHole.mesh.vertexCount).toBeGreaterThan(0);
      expect(circleSideHole.mesh.triangleCount).toBeGreaterThan(0);
      expect(getGeometryResponseTransferables(rectangleHole)).toEqual([
        rectangleHole.mesh.positions.buffer,
        rectangleHole.mesh.indices.buffer
      ]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "runs a boolean-result target hole feasibility request",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_hole_boolean_result",
        version: "geometry-kernel.v1",
        op: "geometry.hole",
        target: {
          kind: "booleanExtrudes",
          operation: "cut",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 6,
              height: 4
            },
            depth: 4
          },
          tool: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [-1, 0],
              width: 1,
              height: 1
            },
            depth: 4
          }
        },
        tool: {
          sketchPlane: "XY",
          circle: {
            kind: "circle",
            center: [1, 0],
            radius: 0.4
          },
          depthMode: "throughAll",
          direction: "positive"
        }
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error("Expected boolean-result target hole to succeed.");
      }

      expect(response.mesh.primitive).toBe("hole");
      expect(response.mesh.vertexCount).toBeGreaterThan(0);
      expect(response.mesh.triangleCount).toBeGreaterThan(0);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "runs rectangle edge-finish chamfer and fillet feasibility requests",
    async () => {
      const target = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 6,
          height: 4
        },
        depth: 4
      };
      const chamfer = await executeGeometryKernelRequest({
        id: "geometry_req_edge_finish_chamfer",
        version: "geometry-kernel.v1",
        op: "geometry.edgeFinish",
        operation: "chamfer",
        target,
        edgeStableId: "generated:edge:body:1:start:uMin",
        distance: 0.25
      });
      const fillet = await executeGeometryKernelRequest({
        id: "geometry_req_edge_finish_fillet",
        version: "geometry-kernel.v1",
        op: "geometry.edgeFinish",
        operation: "fillet",
        target,
        edgeStableId: "generated:edge:body:1:longitudinal:uMax:vMax",
        radius: 0.2
      });

      expect(chamfer.ok || chamfer.error.code === "UNAVAILABLE_BINDING").toBe(
        true
      );
      expect(fillet.ok || fillet.error.code === "UNAVAILABLE_BINDING").toBe(
        true
      );

      if (!chamfer.ok || !fillet.ok) {
        return;
      }

      expect(chamfer.mesh.primitive).toBe("edgeFinish");
      expect(chamfer.mesh.vertexCount).toBeGreaterThan(0);
      expect(chamfer.mesh.triangleCount).toBeGreaterThan(0);
      expect(getMeshBounds(chamfer.mesh.positions)).toEqual({
        min: [-3, -2, 0],
        max: [3, 2, 4]
      });
      expect(fillet.mesh.primitive).toBe("edgeFinish");
      expect(fillet.mesh.vertexCount).toBeGreaterThan(0);
      expect(fillet.mesh.triangleCount).toBeGreaterThan(0);
      expect(getGeometryResponseTransferables(chamfer)).toEqual([
        chamfer.mesh.positions.buffer,
        chamfer.mesh.indices.buffer
      ]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "runs rectangle cut-wall result edge-finish feasibility requests",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_edge_finish_cut_wall_chamfer",
        version: "geometry-kernel.v1",
        op: "geometry.edgeFinish",
        operation: "chamfer",
        target: {
          kind: "booleanExtrudes",
          operation: "cut",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 6,
              height: 4
            },
            depth: 4
          },
          tool: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [1, 0],
              width: 2,
              height: 1
            },
            depth: 4
          }
        },
        edgeStableId: "generated:edge:body_cut:longitudinal:uMin:vMin",
        distance: 0.1
      });

      expect(response.ok || response.error.code === "UNAVAILABLE_BINDING").toBe(
        true
      );

      if (!response.ok) {
        return;
      }

      expect(response.mesh.primitive).toBe("edgeFinish");
      expect(response.mesh.vertexCount).toBeGreaterThan(0);
      expect(response.mesh.triangleCount).toBeGreaterThan(0);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "runs a circle-origin boolean-result target hole feasibility request",
    async () => {
      const response = await executeGeometryKernelRequest({
        id: "geometry_req_hole_circle_boolean_result",
        version: "geometry-kernel.v1",
        op: "geometry.hole",
        target: {
          kind: "booleanExtrudes",
          operation: "cut",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "circle",
              center: [0, 0],
              radius: 3
            },
            depth: 4
          },
          tool: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 1,
              height: 1
            },
            depth: 4
          }
        },
        tool: {
          sketchPlane: "XY",
          circle: {
            kind: "circle",
            center: [1, 0],
            radius: 0.5
          },
          depthMode: "throughAll",
          direction: "positive"
        }
      });

      expect(response.ok).toBe(true);

      if (!response.ok) {
        throw new Error(
          "Expected circle-origin boolean-result target hole to succeed."
        );
      }

      expect(response.mesh.primitive).toBe("hole");
      expect(response.mesh.vertexCount).toBeGreaterThan(0);
      expect(response.mesh.triangleCount).toBeGreaterThan(0);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "runs hole feasibility requests for side direction, planes, and placement frames",
    async () => {
      const negative = await executeGeometryKernelRequest({
        id: "geometry_req_hole_negative",
        version: "geometry-kernel.v1",
        op: "geometry.hole",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 4
          },
          depth: 4,
          side: "negative"
        },
        tool: {
          sketchPlane: "XY",
          circle: {
            kind: "circle",
            center: [0, 0],
            radius: 0.5
          },
          depthMode: "throughAll",
          direction: "negative"
        }
      });
      const xz = await executeGeometryKernelRequest({
        id: "geometry_req_hole_xz",
        version: "geometry-kernel.v1",
        op: "geometry.hole",
        target: {
          sketchPlane: "XZ",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 4
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XZ",
          circle: {
            kind: "circle",
            center: [0, 0],
            radius: 0.5
          },
          depthMode: "blind",
          depth: 3
        }
      });
      const placed = await executeGeometryKernelRequest({
        id: "geometry_req_hole_placed",
        version: "geometry-kernel.v1",
        op: "geometry.hole",
        target: {
          sketchPlane: "XY",
          placementFrame: {
            origin: [10, 20, 30],
            uAxis: [0, 1, 0],
            vAxis: [0, 0, 1]
          },
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 4
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XY",
          placementFrame: {
            origin: [10, 20, 30],
            uAxis: [0, 1, 0],
            vAxis: [0, 0, 1]
          },
          circle: {
            kind: "circle",
            center: [0, 0],
            radius: 0.5
          },
          depthMode: "blind",
          depth: 3
        }
      });

      expect(negative.ok).toBe(true);
      expect(xz.ok).toBe(true);
      expect(placed.ok).toBe(true);

      if (!negative.ok || !xz.ok || !placed.ok) {
        throw new Error(
          "Expected negative, plane, and placement hole requests to succeed."
        );
      }

      expect(getMeshBounds(negative.mesh.positions)).toEqual({
        min: [-2, -2, -4],
        max: [2, 2, 0]
      });
      expect(getMeshBounds(xz.mesh.positions)).toEqual({
        min: [-2, 0, -6],
        max: [2, 4, -2]
      });
      expectBooleanBounds(
        getMeshBounds(placed.mesh.positions),
        {
          min: [10, 18, 28],
          max: [14, 22, 32]
        },
        [0]
      );
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "runs circle-target cut feasibility requests for sides and planes",
    async () => {
      const cases = [
        {
          id: "circle_cut_positive_xy",
          targetPlane: "XY" as const,
          targetSide: "positive" as const,
          toolPlane: "XY" as const,
          toolSide: "positive" as const,
          expectedBounds: {
            min: [-3, -3, 0] as const,
            max: [3, 3, 4] as const
          },
          exactAxes: [2] as const
        },
        {
          id: "circle_cut_negative_xy",
          targetPlane: "XY" as const,
          targetSide: "negative" as const,
          toolPlane: "XY" as const,
          toolSide: "negative" as const,
          expectedBounds: {
            min: [-3, -3, -4] as const,
            max: [3, 3, 0] as const
          },
          exactAxes: [2] as const
        },
        {
          id: "circle_cut_symmetric_xy",
          targetPlane: "XY" as const,
          targetSide: "symmetric" as const,
          toolPlane: "XY" as const,
          toolSide: "symmetric" as const,
          expectedBounds: {
            min: [-3, -3, -2] as const,
            max: [3, 3, 2] as const
          },
          exactAxes: [2] as const
        },
        {
          id: "circle_cut_positive_xz",
          targetPlane: "XZ" as const,
          targetSide: "positive" as const,
          toolPlane: "XZ" as const,
          toolSide: "positive" as const,
          expectedBounds: {
            min: [-3, 0, -3] as const,
            max: [3, 4, 3] as const
          },
          exactAxes: [1] as const
        },
        {
          id: "circle_cut_positive_yz",
          targetPlane: "YZ" as const,
          targetSide: "positive" as const,
          toolPlane: "YZ" as const,
          toolSide: "positive" as const,
          expectedBounds: {
            min: [0, -3, -3] as const,
            max: [4, 3, 3] as const
          },
          exactAxes: [0] as const
        }
      ];

      for (const testCase of cases) {
        const response = await executeGeometryKernelRequest({
          id: testCase.id,
          version: "geometry-kernel.v1",
          op: "geometry.booleanExtrudes",
          operation: "cut",
          target: {
            sketchPlane: testCase.targetPlane,
            profile: {
              kind: "circle",
              center: [0, 0],
              radius: 3
            },
            depth: 4,
            side: testCase.targetSide
          },
          tool: {
            sketchPlane: testCase.toolPlane,
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 2,
              height: 6
            },
            depth: 4,
            side: testCase.toolSide
          }
        });

        expect(response.ok, testCase.id).toBe(true);

        if (!response.ok) {
          throw new Error(response.error.message);
        }

        expectBooleanBounds(
          getMeshBounds(response.mesh.positions),
          testCase.expectedBounds,
          testCase.exactAxes
        );
      }
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "runs circle-target cut feasibility requests for placement frames and non-overlap",
    async () => {
      const placementFrame = {
        origin: [10, 20, 30] as const,
        uAxis: [0, 1, 0] as const,
        vAxis: [0, 0, 1] as const
      };
      const placedCut = await executeGeometryKernelRequest({
        id: "geometry_req_boolean_circle_cut_placed",
        version: "geometry-kernel.v1",
        op: "geometry.booleanExtrudes",
        operation: "cut",
        target: {
          sketchPlane: "XY",
          placementFrame,
          profile: {
            kind: "circle",
            center: [0, 0],
            radius: 3
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XY",
          placementFrame,
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 6
          },
          depth: 4
        }
      });
      const nonOverlappingCut = await executeGeometryKernelRequest({
        id: "geometry_req_boolean_circle_cut_non_overlap",
        version: "geometry-kernel.v1",
        op: "geometry.booleanExtrudes",
        operation: "cut",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "circle",
            center: [0, 0],
            radius: 3
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [10, 0],
            width: 2,
            height: 2
          },
          depth: 4
        }
      });

      expect(placedCut.ok).toBe(true);
      expect(nonOverlappingCut.ok).toBe(true);

      if (!placedCut.ok || !nonOverlappingCut.ok) {
        throw new Error("Expected placement and non-overlap cuts to succeed.");
      }

      expectBooleanBounds(
        getMeshBounds(placedCut.mesh.positions),
        {
          min: [10, 17, 27],
          max: [14, 23, 33]
        },
        [0]
      );
      expectBooleanBounds(
        getMeshBounds(nonOverlappingCut.mesh.positions),
        {
          min: [-3, -3, 0],
          max: [3, 3, 4]
        },
        [2]
      );
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it("returns structured boolean feasibility errors", async () => {
    const rectangleSource = {
      sketchPlane: "XY" as const,
      profile: {
        kind: "rectangle" as const,
        center: [0, 0] as const,
        width: 2,
        height: 2
      },
      depth: 2
    };
    const emptyResult = await executeGeometryKernelRequest({
      id: "geometry_req_boolean_empty_result",
      version: "geometry-kernel.v1",
      op: "geometry.booleanExtrudes",
      operation: "cut",
      target: rectangleSource,
      tool: rectangleSource
    });
    const circleTargetRemoved = await executeGeometryKernelRequest({
      id: "geometry_req_boolean_circle_removed",
      version: "geometry-kernel.v1",
      op: "geometry.booleanExtrudes",
      operation: "cut",
      target: {
        sketchPlane: "XY",
        profile: {
          kind: "circle",
          center: [0, 0],
          radius: 2
        },
        depth: 2
      },
      tool: {
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 6,
          height: 6
        },
        depth: 2
      }
    });
    const invalidPlacementFrame = await executeGeometryKernelRequest({
      id: "geometry_req_boolean_invalid_frame",
      version: "geometry-kernel.v1",
      op: "geometry.booleanExtrudes",
      operation: "cut",
      target: {
        ...rectangleSource,
        placementFrame: {
          origin: [0, 0, 0],
          uAxis: [1, 0, 0],
          vAxis: [2, 0, 0]
        }
      },
      tool: rectangleSource
    });

    expect(emptyResult).toEqual({
      ok: false,
      id: "geometry_req_boolean_empty_result",
      op: "geometry.booleanExtrudes",
      error: {
        code: "EMPTY_RESULT",
        message: "The geometry kernel returned an empty or invalid mesh."
      },
      warnings: []
    });
    expect(circleTargetRemoved).toEqual({
      ok: false,
      id: "geometry_req_boolean_circle_removed",
      op: "geometry.booleanExtrudes",
      error: {
        code: "EMPTY_RESULT",
        message: "The geometry kernel returned an empty or invalid mesh."
      },
      warnings: []
    });
    expect(invalidPlacementFrame).toEqual({
      ok: false,
      id: "geometry_req_boolean_invalid_frame",
      op: "geometry.booleanExtrudes",
      error: {
        code: "INVALID_DIMENSIONS",
        message:
          "Boolean extrude requests require target/tool sources with supported sketch plane, side, profile dimensions, and positive finite depth."
      },
      warnings: []
    });
  });

  it("returns structured hole feasibility errors", async () => {
    const target = {
      sketchPlane: "XY" as const,
      profile: {
        kind: "rectangle" as const,
        center: [0, 0] as const,
        width: 2,
        height: 2
      },
      depth: 2
    };
    const blindWithoutDepth = await executeGeometryKernelRequest({
      id: "geometry_req_hole_missing_depth",
      version: "geometry-kernel.v1",
      op: "geometry.hole",
      target,
      tool: {
        sketchPlane: "XY",
        circle: {
          kind: "circle",
          center: [0, 0],
          radius: 0.5
        },
        depthMode: "blind"
      }
    });
    const throughAllWithDepth = await executeGeometryKernelRequest({
      id: "geometry_req_hole_through_depth",
      version: "geometry-kernel.v1",
      op: "geometry.hole",
      target,
      tool: {
        sketchPlane: "XY",
        circle: {
          kind: "circle",
          center: [0, 0],
          radius: 0.5
        },
        depthMode: "throughAll",
        depth: 2
      }
    });
    const invalidPlacement = await executeGeometryKernelRequest({
      id: "geometry_req_hole_invalid_placement",
      version: "geometry-kernel.v1",
      op: "geometry.hole",
      target,
      tool: {
        sketchPlane: "XY",
        circle: {
          kind: "circle",
          center: [0, 0],
          radius: 0.5
        },
        depthMode: "throughAll",
        direction: "negative"
      }
    });
    const fullRemoval = await executeGeometryKernelRequest({
      id: "geometry_req_hole_empty_result",
      version: "geometry-kernel.v1",
      op: "geometry.hole",
      target,
      tool: {
        sketchPlane: "XY",
        circle: {
          kind: "circle",
          center: [0, 0],
          radius: 3
        },
        depthMode: "throughAll",
        direction: "positive"
      }
    });

    expect(blindWithoutDepth).toEqual({
      ok: false,
      id: "geometry_req_hole_missing_depth",
      op: "geometry.hole",
      error: {
        code: "INVALID_DIMENSIONS",
        message:
          "Hole requests require a supported authored extrude target source, circular tool source, valid depth mode, direction, and finite positive blind depth when provided."
      },
      warnings: []
    });
    expect(throughAllWithDepth).toEqual({
      ok: false,
      id: "geometry_req_hole_through_depth",
      op: "geometry.hole",
      error: {
        code: "INVALID_DIMENSIONS",
        message:
          "Hole requests require a supported authored extrude target source, circular tool source, valid depth mode, direction, and finite positive blind depth when provided."
      },
      warnings: []
    });
    expect(invalidPlacement).toEqual({
      ok: false,
      id: "geometry_req_hole_invalid_placement",
      op: "geometry.hole",
      error: {
        code: "INVALID_PLACEMENT",
        message:
          "Hole through-all placement does not intersect the target bounds in the requested direction."
      },
      warnings: []
    });
    expect(fullRemoval).toEqual({
      ok: false,
      id: "geometry_req_hole_empty_result",
      op: "geometry.hole",
      error: {
        code: "EMPTY_RESULT",
        message: "The geometry kernel returned an empty or invalid mesh."
      },
      warnings: []
    });
  });

  it("returns structured edge-finish feasibility errors", async () => {
    const rectangleTarget = {
      sketchPlane: "XY" as const,
      profile: {
        kind: "rectangle" as const,
        center: [0, 0] as const,
        width: 4,
        height: 4
      },
      depth: 4
    };
    const unsupportedCircleTarget = await executeGeometryKernelRequest({
      id: "geometry_req_edge_finish_circle_target",
      version: "geometry-kernel.v1",
      op: "geometry.edgeFinish",
      operation: "chamfer",
      target: {
        sketchPlane: "XY",
        profile: {
          kind: "circle",
          center: [0, 0],
          radius: 2
        },
        depth: 4
      },
      edgeStableId: "generated:edge:body:1:start:circular",
      distance: 0.25
    });
    const unsupportedCircularEdge = await executeGeometryKernelRequest({
      id: "geometry_req_edge_finish_circular_edge",
      version: "geometry-kernel.v1",
      op: "geometry.edgeFinish",
      operation: "fillet",
      target: rectangleTarget,
      edgeStableId: "generated:edge:body:1:start:circular",
      radius: 0.25
    });
    const staleEdgeRole = await executeGeometryKernelRequest({
      id: "geometry_req_edge_finish_stale_edge",
      version: "geometry-kernel.v1",
      op: "geometry.edgeFinish",
      operation: "chamfer",
      target: rectangleTarget,
      edgeStableId: "generated:edge:body:1:deleted:uMin",
      distance: 0.25
    });
    const tooLarge = await executeGeometryKernelRequest({
      id: "geometry_req_edge_finish_too_large",
      version: "geometry-kernel.v1",
      op: "geometry.edgeFinish",
      operation: "fillet",
      target: rectangleTarget,
      edgeStableId: "generated:edge:body:1:start:uMin",
      radius: 3
    });

    expect(unsupportedCircleTarget).toEqual({
      ok: false,
      id: "geometry_req_edge_finish_circle_target",
      op: "geometry.edgeFinish",
      error: {
        code: "UNSUPPORTED_EDGE",
        message:
          "Edge finish feasibility currently supports rectangle source edges and rectangle cut-wall result edges only."
      },
      warnings: []
    });
    expect(unsupportedCircularEdge).toEqual({
      ok: false,
      id: "geometry_req_edge_finish_circular_edge",
      op: "geometry.edgeFinish",
      error: {
        code: "UNSUPPORTED_EDGE",
        message:
          "Edge finish feasibility currently supports rectangle source edges and rectangle cut-wall result edges only."
      },
      warnings: []
    });
    expect(staleEdgeRole).toEqual({
      ok: false,
      id: "geometry_req_edge_finish_stale_edge",
      op: "geometry.edgeFinish",
      error: {
        code: "INVALID_EDGE_ROLE",
        message:
          "Edge finish requests require a generated rectangle edge stable ID with a supported semantic edge role."
      },
      warnings: []
    });
    expect(tooLarge).toEqual({
      ok: false,
      id: "geometry_req_edge_finish_too_large",
      op: "geometry.edgeFinish",
      error: {
        code: "EDGE_FINISH_TOO_LARGE",
        message:
          "Edge finish distance or radius is too large for the selected rectangle edge in this feasibility path."
      },
      warnings: []
    });
  });

  it("returns structured invalid mesh result errors", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: async () => ({
        primitive: "boolean",
        positions: new Float32Array([0, 0, 0]),
        indices: new Uint32Array([0, 1, 2]),
        vertexCount: 2,
        triangleCount: 1,
        faceCount: 1
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_invalid_boolean_result",
        version: "geometry-kernel.v1",
        op: "geometry.booleanExtrudes",
        operation: "cut",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 2
          },
          depth: 2
        },
        tool: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 1,
            height: 1
          },
          depth: 2
        }
      }
    );

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_invalid_boolean_result",
      op: "geometry.booleanExtrudes",
      error: {
        code: "INVALID_RESULT",
        message:
          "The geometry kernel returned mesh data with inconsistent counts or invalid values."
      },
      warnings: []
    });
  });

  it("rejects malformed primitive position tuples before mapping them", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: async () => ({
        primitive: "box",
        positions: new Float32Array([0, 0, 0, 1]),
        indices: new Uint32Array([0, 0, 0]),
        vertexCount: 1,
        triangleCount: 1,
        faceCount: 1
      }),
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_invalid_extrude_positions",
        version: "geometry-kernel.v1",
        op: "geometry.tessellateExtrude",
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 2,
          height: 2
        },
        depth: 2
      }
    );

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_RESULT"
      }
    });
  });

  it("returns hole meshes from an injected factory", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createHoleMesh: async () => ({
        primitive: "hole",
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2]),
        vertexCount: 3,
        triangleCount: 1,
        faceCount: 1
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_injected_hole",
        version: "geometry-kernel.v1",
        op: "geometry.hole",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 2
          },
          depth: 2
        },
        tool: {
          sketchPlane: "XY",
          circle: {
            kind: "circle",
            center: [0, 0],
            radius: 0.25
          },
          depthMode: "blind",
          depth: 1
        }
      }
    );

    expect(response).toEqual({
      ok: true,
      id: "geometry_req_injected_hole",
      op: "geometry.hole",
      mesh: {
        primitive: "hole",
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2]),
        vertexCount: 3,
        triangleCount: 1,
        faceCount: 1
      },
      warnings: []
    });
  });

  it("returns edge-finish meshes from an injected factory", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createEdgeFinishMesh: async (input) => {
        expect(input).toMatchObject({
          operation: "chamfer",
          edgeStableId: "generated:edge:body:1:start:uMin",
          distance: 0.2,
          linearDeflection: 0.1
        });

        return {
          primitive: "edgeFinish",
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          indices: new Uint32Array([0, 1, 2]),
          vertexCount: 3,
          triangleCount: 1,
          faceCount: 1
        };
      }
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_injected_edge_finish",
        version: "geometry-kernel.v1",
        op: "geometry.edgeFinish",
        operation: "chamfer",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 2
          },
          depth: 2
        },
        edgeStableId: "generated:edge:body:1:start:uMin",
        distance: 0.2,
        tessellation: {
          linearDeflection: 0.1
        }
      }
    );

    expect(response).toEqual({
      ok: true,
      id: "geometry_req_injected_edge_finish",
      op: "geometry.edgeFinish",
      mesh: {
        primitive: "edgeFinish",
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2]),
        vertexCount: 3,
        triangleCount: 1,
        faceCount: 1
      },
      warnings: []
    });
  });

  it("returns structured unavailable-binding errors when hole factory is absent", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_unavailable_hole",
        version: "geometry-kernel.v1",
        op: "geometry.hole",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 2
          },
          depth: 2
        },
        tool: {
          sketchPlane: "XY",
          circle: {
            kind: "circle",
            center: [0, 0],
            radius: 0.25
          },
          depthMode: "blind",
          depth: 1
        }
      }
    );

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_unavailable_hole",
      op: "geometry.hole",
      error: {
        code: "UNAVAILABLE_BINDING",
        message: "Hole tessellation requires an OCCT hole mesh factory."
      },
      warnings: []
    });
  });

  it("returns structured unavailable-binding errors when edge-finish factory is absent", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_unavailable_edge_finish",
        version: "geometry-kernel.v1",
        op: "geometry.edgeFinish",
        operation: "fillet",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 2
          },
          depth: 2
        },
        edgeStableId: "generated:edge:body:1:end:vMax",
        radius: 0.2
      }
    );

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_unavailable_edge_finish",
      op: "geometry.edgeFinish",
      error: {
        code: "UNAVAILABLE_BINDING",
        message:
          "Edge finish tessellation requires an OCCT edge-finish mesh factory."
      },
      warnings: []
    });
  });

  it("returns revolve meshes from an injected factory", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createRevolveProfileMesh: async () => ({
        primitive: "revolve",
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2]),
        vertexCount: 3,
        triangleCount: 1,
        faceCount: 1
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_injected_revolve",
        version: "geometry-kernel.v1",
        op: "geometry.revolveProfile",
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [1, 0],
          width: 2,
          height: 3
        },
        axis: {
          start: [0, -1],
          end: [0, 1]
        },
        angleDegrees: 90
      }
    );

    expect(response).toEqual({
      ok: true,
      id: "geometry_req_injected_revolve",
      op: "geometry.revolveProfile",
      mesh: {
        primitive: "revolve",
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2]),
        vertexCount: 3,
        triangleCount: 1,
        faceCount: 1
      },
      warnings: []
    });
  });

  it("returns structured unavailable-binding errors when revolve factory is absent", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_unavailable_revolve",
        version: "geometry-kernel.v1",
        op: "geometry.revolveProfile",
        sketchPlane: "XY",
        profile: {
          kind: "circle",
          center: [2, 0],
          radius: 1
        },
        axis: {
          start: [0, -1],
          end: [0, 1]
        },
        angleDegrees: 180
      }
    );

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_unavailable_revolve",
      op: "geometry.revolveProfile",
      error: {
        code: "UNAVAILABLE_BINDING",
        message:
          "Revolve profile tessellation requires an OCCT revolve mesh factory."
      },
      warnings: []
    });
  });

  it("returns exact metadata from an injected metadata factory", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createExactBodyMetadata: async (input) => ({
        sourceKind: getMetadataSourceKind(input.source),
        bounds: {
          min: [0, 0, 0],
          max: [2, 3, 4]
        },
        volume: 24,
        surfaceArea: 52,
        centroid: [1, 1.5, 2],
        topologyCounts: {
          solidCount: 1,
          faceCount: 6,
          edgeCount: 12,
          vertexCount: 8
        },
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived",
        diagnostics: [
          {
            code: "TEST_DIAGNOSTIC",
            message: "Metadata came from the injected test factory."
          }
        ]
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_injected_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "booleanExtrudes",
          operation: "add",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 2,
              height: 3
            },
            depth: 4
          },
          tool: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [1, 0],
              width: 2,
              height: 3
            },
            depth: 4
          }
        }
      }
    );

    expect(response).toEqual({
      ok: true,
      id: "geometry_req_injected_exact_metadata",
      op: "geometry.exactBodyMetadata",
      metadata: {
        sourceKind: "booleanExtrudes",
        bounds: {
          min: [0, 0, 0],
          max: [2, 3, 4]
        },
        volume: 24,
        surfaceArea: 52,
        centroid: [1, 1.5, 2],
        topologyCounts: {
          solidCount: 1,
          faceCount: 6,
          edgeCount: 12,
          vertexCount: 8
        },
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived",
        diagnostics: [
          {
            code: "TEST_DIAGNOSTIC",
            message: "Metadata came from the injected test factory."
          }
        ]
      },
      warnings: []
    });
    expect(getGeometryResponseTransferables(response)).toEqual([]);
  });

  it("returns exact topology snapshots from an injected topology factory", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createExactTopologySnapshot: async (input) => ({
        sourceKind: getMetadataSourceKind(input.source),
        status: "partial",
        entityCounts: {
          bodyCount: 1,
          solidCount: 1,
          faceCount: 6,
          wireCount: 6,
          edgeCount: 12,
          vertexCount: 8,
          loopCount: 0,
          coedgeCount: 0,
          axisCount: 0
        },
        entityCount: 34,
        entities: [
          createTopologyEntityFixture("body", 1),
          createTopologyEntityFixture("solid", 1),
          ...Array.from({ length: 6 }, (_, index) =>
            createTopologyEntityFixture("face", index + 1)
          ),
          ...Array.from({ length: 6 }, (_, index) =>
            createTopologyEntityFixture("wire", index + 1)
          ),
          ...Array.from({ length: 12 }, (_, index) =>
            createTopologyEntityFixture("edge", index + 1)
          ),
          ...Array.from({ length: 8 }, (_, index) =>
            createTopologyEntityFixture("vertex", index + 1)
          )
        ],
        unsupportedEntityKinds: ["loop", "coedge", "axis"],
        adjacencyAvailable: false,
        signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
        signature: "topology-snapshot-test",
        source: "kernel-derived",
        diagnostics: [
          {
            code: "GEOMETRY_TOPOLOGY_SNAPSHOT_EXTRACTED",
            severity: "info",
            message: "Test topology snapshot extracted."
          }
        ]
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_injected_exact_topology_snapshot",
        version: "geometry-kernel.v1",
        op: "geometry.exactTopologySnapshot",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 3
          },
          depth: 4
        }
      }
    );

    expect(response).toEqual({
      ok: true,
      id: "geometry_req_injected_exact_topology_snapshot",
      op: "geometry.exactTopologySnapshot",
      snapshot: expect.objectContaining({
        sourceKind: "extrude",
        status: "partial",
        entityCount: 34,
        entities: expect.arrayContaining([
          expect.objectContaining({
            bounds: {
              min: [-1, -1.5, 0],
              max: [1, 1.5, 4]
            }
          }),
          expect.objectContaining({
            kind: "face",
            surfaceClass: "plane",
            normal: [0, 0, 1],
            adjacency: {
              available: false,
              neighborSignatureHashes: []
            }
          }),
          expect.objectContaining({
            kind: "edge",
            curveClass: "line",
            midpoint: [0, 0, 2],
            axis: [0, 0, 1],
            length: 4
          }),
          expect.objectContaining({
            kind: "vertex",
            point: [-1, -1.5, 0]
          })
        ]),
        adjacencyAvailable: false,
        signatureAlgorithm: "partbench-derived-topology-snapshot-v1"
      }),
      warnings: []
    });
    expect(getGeometryResponseTransferables(response)).toEqual([]);
    expect(JSON.stringify(response)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex/i
    );
  });

  it("rejects exact topology snapshots with wrong-kind descriptor evidence", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createExactTopologySnapshot: async (input) => ({
        sourceKind: getMetadataSourceKind(input.source),
        status: "partial",
        entityCounts: {
          bodyCount: 0,
          solidCount: 0,
          faceCount: 0,
          wireCount: 0,
          edgeCount: 1,
          vertexCount: 0,
          loopCount: 0,
          coedgeCount: 0,
          axisCount: 0
        },
        entityCount: 1,
        entities: [
          {
            ...createTopologyEntityFixture("edge", 1),
            surfaceClass: "plane",
            normal: [0, 0, 1],
            area: 1
          } as unknown as GeometryKernelTopologyEntityDescriptor
        ],
        unsupportedEntityKinds: ["loop", "coedge", "axis"],
        adjacencyAvailable: false,
        signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
        signature: "topology-snapshot-test",
        source: "kernel-derived",
        diagnostics: []
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_wrong_kind_exact_topology_descriptor_evidence",
        version: "geometry-kernel.v1",
        op: "geometry.exactTopologySnapshot",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 3
          },
          depth: 4
        }
      }
    );

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_wrong_kind_exact_topology_descriptor_evidence",
      op: "geometry.exactTopologySnapshot",
      error: {
        code: "INVALID_RESULT",
        message:
          "The geometry kernel returned an exact topology snapshot with invalid or inconsistent entity data."
      },
      warnings: []
    });
  });

  it("returns exact topology checkpoint payloads from an injected factory", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createExactTopologyCheckpointPayload: async (input) =>
        createCheckpointPayloadFixture({
          checkpointId: input.checkpointId,
          bodyId: input.bodyId
        })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_injected_exact_checkpoint_payload",
        version: "geometry-kernel.v1",
        op: "geometry.exactTopologyCheckpointPayload",
        checkpointId: "checkpoint_kernel_injected",
        bodyId: "body_kernel_injected",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 3
          },
          depth: 4
        }
      }
    );

    expect(response).toEqual({
      ok: true,
      id: "geometry_req_injected_exact_checkpoint_payload",
      op: "geometry.exactTopologyCheckpointPayload",
      checkpointPayload: expect.objectContaining({
        checkpointId: "checkpoint_kernel_injected",
        bodyId: "body_kernel_injected",
        brepFormat: "occt-brep",
        brepWriter: "BRepTools.Write_3",
        brepByteLength: 4,
        topologySnapshot: expect.objectContaining({
          sourceKind: "extrude",
          entityCount: 3
        }),
        signaturePayload: expect.objectContaining({
          checkpointId: "checkpoint_kernel_injected",
          entityCount: 3
        })
      }),
      warnings: []
    });
    expect(getGeometryResponseTransferables(response)).toHaveLength(1);
    expect(JSON.stringify(response)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex/i
    );
  });

  it("reuses hash-validated checkpoint-backed sources for checkpoint payloads", async () => {
    const checkpoint = await createSyntheticStepArtifactBody("checkpoint");
    const source = {
      kind: "checkpointBody" as const,
      brepBytes: checkpoint.brepBytes,
      brepByteLength: checkpoint.brepByteLength,
      brepSha256: checkpoint.brepSha256,
      topologySourceKind: "importedBody" as const,
      topologySignature: "checkpoint-topology"
    };
    let calls = 0;
    const factories: GeometryKernelMeshFactories = {
      ...createInjectedArtifactFactories(async () =>
        createExactBodyArtifactPayloadFixture()
      ),
      createExactTopologyCheckpointPayload: async (input) => {
        calls += 1;
        expect(input.source).toBe(source);
        return createCheckpointPayloadFixture({
          checkpointId: input.checkpointId,
          bodyId: input.bodyId,
          sourceKind: "importedBody"
        });
      }
    };
    const request = {
      id: "geometry_req_checkpoint_backed_checkpoint_payload",
      version: "geometry-kernel.v1" as const,
      op: "geometry.exactTopologyCheckpointPayload" as const,
      checkpointId: "checkpoint_copy",
      bodyId: "body_copy",
      source
    };

    expect(
      await executeGeometryKernelRequestWithMeshFactory(factories, request)
    ).toMatchObject({
      ok: true,
      checkpointPayload: { sourceKind: "importedBody" }
    });
    expect(
      await executeGeometryKernelRequestWithMeshFactory(factories, {
        ...request,
        source: { ...source, brepSha256: "0".repeat(64) }
      })
    ).toMatchObject({ ok: false, error: { code: "INVALID_DIMENSIONS" } });
    expect(calls).toBe(1);
  });

  it("rejects inconsistent exact topology checkpoint payloads from injected factories", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createExactTopologyCheckpointPayload: async () =>
        createCheckpointPayloadFixture({
          signature: "signature-mismatch"
        })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_invalid_exact_checkpoint_payload",
        version: "geometry-kernel.v1",
        op: "geometry.exactTopologyCheckpointPayload",
        checkpointId: "checkpoint_kernel_invalid",
        bodyId: "body_kernel_invalid",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 3
          },
          depth: 4
        }
      }
    );

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_invalid_exact_checkpoint_payload",
      op: "geometry.exactTopologyCheckpointPayload",
      error: {
        code: "INVALID_RESULT",
        message:
          "The geometry kernel returned an exact topology checkpoint payload with invalid or inconsistent BRep, topology, or signature data."
      },
      warnings: []
    });
  });

  it("rejects inconsistent exact topology snapshots from injected factories", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createExactTopologySnapshot: async (input) => ({
        sourceKind: getMetadataSourceKind(input.source),
        status: "partial",
        entityCounts: {
          bodyCount: 1,
          solidCount: 1,
          faceCount: 6,
          wireCount: 6,
          edgeCount: 12,
          vertexCount: 8,
          loopCount: 0,
          coedgeCount: 0,
          axisCount: 0
        },
        entityCount: 1,
        entities: [
          {
            localId: "snapshot-local:body:0",
            kind: "body",
            source: "kernel-derived",
            signature: "topology-body-test",
            bounds: {
              min: [2, 0, 0],
              max: [1, 1, 1]
            }
          }
        ],
        unsupportedEntityKinds: ["loop", "coedge", "axis"],
        adjacencyAvailable: false,
        signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
        signature: "topology-snapshot-test",
        source: "kernel-derived",
        diagnostics: []
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_invalid_exact_topology_snapshot",
        version: "geometry-kernel.v1",
        op: "geometry.exactTopologySnapshot",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 3
          },
          depth: 4
        }
      }
    );

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_invalid_exact_topology_snapshot",
      op: "geometry.exactTopologySnapshot",
      error: {
        code: "INVALID_RESULT",
        message:
          "The geometry kernel returned an exact topology snapshot with invalid or inconsistent entity data."
      },
      warnings: []
    });
  });

  it("returns exact metadata for revolve sources from an injected metadata factory", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createExactBodyMetadata: async (input) => ({
        sourceKind: getMetadataSourceKind(input.source),
        bounds: {
          min: [-2.5, -1.5, -2.5],
          max: [2.5, 1.5, 2.5]
        },
        volume: 37.7,
        surfaceArea: 100.5,
        centroid: [0, 0, 0],
        topologyCounts: {
          solidCount: 1,
          faceCount: 6,
          edgeCount: 12,
          vertexCount: 8
        },
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived",
        diagnostics: []
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_injected_revolve_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "revolve",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [2, 0],
            width: 1,
            height: 3
          },
          axis: { start: [0, -2], end: [0, 2] },
          angleDegrees: 360
        }
      }
    );

    expect(response).toMatchObject({
      ok: true,
      id: "geometry_req_injected_revolve_exact_metadata",
      op: "geometry.exactBodyMetadata",
      metadata: {
        sourceKind: "revolve",
        volume: 37.7,
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived"
      },
      warnings: []
    });
  });

  it("returns exact metadata for hole sources from an injected metadata factory", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createExactBodyMetadata: async (input) => ({
        sourceKind: getMetadataSourceKind(input.source),
        bounds: {
          min: [-3, -2, 0],
          max: [3, 2, 3]
        },
        volume: 70.4,
        surfaceArea: 80.2,
        centroid: [0, 0, 1.55],
        topologyCounts: {
          solidCount: 1,
          faceCount: 8,
          edgeCount: 18,
          vertexCount: 10
        },
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived",
        diagnostics: []
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_injected_hole_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "hole",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 6,
              height: 4
            },
            depth: 3
          },
          tool: {
            sketchPlane: "XY",
            circle: {
              kind: "circle",
              center: [0, 0],
              radius: 0.5
            },
            depthMode: "throughAll",
            direction: "positive"
          }
        }
      }
    );

    expect(response).toMatchObject({
      ok: true,
      id: "geometry_req_injected_hole_exact_metadata",
      op: "geometry.exactBodyMetadata",
      metadata: {
        sourceKind: "hole",
        volume: 70.4,
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived"
      },
      warnings: []
    });
  });

  it("returns exact metadata for edge-finish sources from an injected metadata factory", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createExactBodyMetadata: async (input) => ({
        sourceKind: getMetadataSourceKind(input.source),
        bounds: {
          min: [-3, -2, 0],
          max: [3, 2, 4]
        },
        volume: 95.8,
        surfaceArea: 88.4,
        centroid: [0, 0, 2],
        topologyCounts: {
          solidCount: 1,
          faceCount: 7,
          edgeCount: 15,
          vertexCount: 10
        },
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived",
        diagnostics: []
      })
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_injected_edge_finish_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "edgeFinish",
          operation: "chamfer",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 6,
              height: 4
            },
            depth: 4
          },
          edgeStableId: "generated:edge:body:1:start:uMin",
          distance: 0.25
        }
      }
    );

    expect(response).toMatchObject({
      ok: true,
      id: "geometry_req_injected_edge_finish_exact_metadata",
      op: "geometry.exactBodyMetadata",
      metadata: {
        sourceKind: "edgeFinish",
        volume: 95.8,
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived"
      },
      warnings: []
    });

    const cutWallResponse = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_injected_cut_wall_edge_finish_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "edgeFinish",
          operation: "chamfer",
          target: {
            kind: "booleanExtrudes",
            operation: "cut",
            target: {
              sketchPlane: "XY",
              profile: {
                kind: "rectangle",
                center: [0, 0],
                width: 6,
                height: 4
              },
              depth: 4
            },
            tool: {
              sketchPlane: "XY",
              profile: {
                kind: "rectangle",
                center: [1, 0],
                width: 2,
                height: 1
              },
              depth: 4
            }
          },
          edgeStableId: "generated:edge:body_cut:longitudinal:uMin:vMin",
          distance: 0.1
        }
      }
    );

    expect(cutWallResponse).toMatchObject({
      ok: true,
      id: "geometry_req_injected_cut_wall_edge_finish_exact_metadata",
      op: "geometry.exactBodyMetadata",
      metadata: {
        sourceKind: "edgeFinish",
        volume: 95.8,
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived"
      },
      warnings: []
    });
  });

  it("validates and forwards transformed primitive exact metadata sources", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    let receivedSource: unknown;
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createExactBodyMetadata: async (input) => {
        receivedSource = input.source;
        return {
          sourceKind: getMetadataSourceKind(input.source),
          bounds: { min: [4, 5, 10], max: [6, 9, 12] },
          volume: 24,
          surfaceArea: 52,
          centroid: [5, 7, 11],
          topologyCounts: {
            solidCount: 1,
            faceCount: 6,
            edgeCount: 12,
            vertexCount: 8
          },
          measurementSource: "kernel-derived",
          measurementConfidence: "kernel-derived",
          diagnostics: []
        };
      }
    };
    const source = {
      kind: "box" as const,
      dimensions: { width: 2, height: 3, depth: 4 },
      transform: {
        translation: [5, 7, 11] as const,
        rotation: [0, 0, 90] as const,
        scale: [2, 1, 0.5] as const
      }
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_transformed_primitive_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source
      }
    );

    expect(response).toMatchObject({
      ok: true,
      metadata: { sourceKind: "box", volume: 24 }
    });
    expect(receivedSource).toEqual(source);

    const invalid = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_invalid_primitive_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          ...source,
          transform: { ...source.transform, scale: [1, 0, 1] }
        }
      }
    );
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "INVALID_DIMENSIONS" }
    });
  });

  it("returns structured unavailable-binding errors when exact metadata factory is absent", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory
    };

    const response = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        id: "geometry_req_unavailable_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 3
          },
          depth: 4
        }
      }
    );

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_unavailable_exact_metadata",
      op: "geometry.exactBodyMetadata",
      error: {
        code: "UNAVAILABLE_BINDING",
        message:
          "Exact body metadata requires an exact metadata factory with OCCT mass-property and bounds bindings."
      },
      warnings: []
    });

    const edgeFinishResponse =
      await executeGeometryKernelRequestWithMeshFactory(factories, {
        id: "geometry_req_unavailable_edge_finish_exact_metadata",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "edgeFinish",
          operation: "chamfer",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 4,
              height: 4
            },
            depth: 4
          },
          edgeStableId: "generated:edge:body:1:start:uMin",
          distance: 0.25
        }
      });

    expect(edgeFinishResponse).toMatchObject({
      ok: false,
      id: "geometry_req_unavailable_edge_finish_exact_metadata",
      op: "geometry.exactBodyMetadata",
      error: {
        code: "UNAVAILABLE_BINDING"
      },
      warnings: []
    });
  });

  it("supports circle-target add exact metadata and rejects unsupported edge-finish metadata", async () => {
    const response = await executeGeometryKernelRequest({
      id: "geometry_req_circle_target_add_exact_metadata",
      version: "geometry-kernel.v1",
      op: "geometry.exactBodyMetadata",
      source: {
        kind: "booleanExtrudes",
        operation: "add",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "circle",
            center: [0, 0],
            radius: 3
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 2
          },
          depth: 4
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      id: "geometry_req_circle_target_add_exact_metadata",
      op: "geometry.exactBodyMetadata",
      metadata: {
        sourceKind: "booleanExtrudes",
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived"
      },
      warnings: []
    });

    const rectangleTarget = {
      sketchPlane: "XY" as const,
      profile: {
        kind: "rectangle" as const,
        center: [0, 0] as const,
        width: 4,
        height: 4
      },
      depth: 4
    };
    const circleTarget = await executeGeometryKernelRequest({
      id: "geometry_req_bad_exact_edge_finish_circle_target",
      version: "geometry-kernel.v1",
      op: "geometry.exactBodyMetadata",
      source: {
        kind: "edgeFinish",
        operation: "chamfer",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "circle",
            center: [0, 0],
            radius: 2
          },
          depth: 4
        },
        edgeStableId: "generated:edge:body:1:start:circular",
        distance: 0.25
      }
    });
    const circularEdge = await executeGeometryKernelRequest({
      id: "geometry_req_bad_exact_edge_finish_circular_edge",
      version: "geometry-kernel.v1",
      op: "geometry.exactBodyMetadata",
      source: {
        kind: "edgeFinish",
        operation: "fillet",
        target: rectangleTarget,
        edgeStableId: "generated:edge:body:1:start:circular",
        radius: 0.25
      }
    });
    const tooLarge = await executeGeometryKernelRequest({
      id: "geometry_req_bad_exact_edge_finish_too_large",
      version: "geometry-kernel.v1",
      op: "geometry.exactBodyMetadata",
      source: {
        kind: "edgeFinish",
        operation: "fillet",
        target: rectangleTarget,
        edgeStableId: "generated:edge:body:1:start:uMin",
        radius: 3
      }
    });

    expect(circleTarget).toMatchObject({
      ok: false,
      id: "geometry_req_bad_exact_edge_finish_circle_target",
      op: "geometry.exactBodyMetadata",
      error: { code: "UNSUPPORTED_EDGE" },
      warnings: []
    });
    expect(circularEdge).toMatchObject({
      ok: false,
      id: "geometry_req_bad_exact_edge_finish_circular_edge",
      op: "geometry.exactBodyMetadata",
      error: { code: "UNSUPPORTED_EDGE" },
      warnings: []
    });
    expect(tooLarge).toMatchObject({
      ok: false,
      id: "geometry_req_bad_exact_edge_finish_too_large",
      op: "geometry.exactBodyMetadata",
      error: { code: "EDGE_FINISH_TOO_LARGE" },
      warnings: []
    });
  });

  it("returns structured validation errors before calling the kernel", async () => {
    const response = await executeGeometryKernelRequest({
      id: "geometry_req_bad_dimensions",
      version: "geometry-kernel.v1",
      op: "geometry.tessellateBox",
      dimensions: {
        width: 0,
        height: 20,
        depth: 30
      }
    });

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_bad_dimensions",
      op: "geometry.tessellateBox",
      error: {
        code: "INVALID_DIMENSIONS",
        message: "Box dimensions must be finite numbers greater than zero."
      },
      warnings: []
    });
  });

  it("returns structured cylinder validation errors before calling the kernel", async () => {
    const response = await executeGeometryKernelRequest({
      id: "geometry_req_bad_cylinder",
      version: "geometry-kernel.v1",
      op: "geometry.tessellateCylinder",
      dimensions: {
        radius: 0,
        height: 30
      }
    });

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_bad_cylinder",
      op: "geometry.tessellateCylinder",
      error: {
        code: "INVALID_DIMENSIONS",
        message: "Cylinder dimensions must be finite numbers greater than zero."
      },
      warnings: []
    });
  });

  it("returns structured sphere validation errors before calling the kernel", async () => {
    const response = await executeGeometryKernelRequest({
      id: "geometry_req_bad_sphere",
      version: "geometry-kernel.v1",
      op: "geometry.tessellateSphere",
      dimensions: {
        radius: 0
      }
    });

    expect(response).toEqual({
      ok: false,
      id: "geometry_req_bad_sphere",
      op: "geometry.tessellateSphere",
      error: {
        code: "INVALID_DIMENSIONS",
        message: "Sphere dimensions must be finite numbers greater than zero."
      },
      warnings: []
    });
  });

  it("returns structured cone and torus validation errors before calling the kernel", async () => {
    const cone = await executeGeometryKernelRequest({
      id: "geometry_req_bad_cone",
      version: "geometry-kernel.v1",
      op: "geometry.tessellateCone",
      dimensions: {
        radius: 0,
        height: 5
      }
    });
    const torus = await executeGeometryKernelRequest({
      id: "geometry_req_bad_torus",
      version: "geometry-kernel.v1",
      op: "geometry.tessellateTorus",
      dimensions: {
        majorRadius: 1,
        minorRadius: 1
      }
    });

    expect(cone).toEqual({
      ok: false,
      id: "geometry_req_bad_cone",
      op: "geometry.tessellateCone",
      error: {
        code: "INVALID_DIMENSIONS",
        message: "Cone dimensions must be finite numbers greater than zero."
      },
      warnings: []
    });
    expect(torus).toEqual({
      ok: false,
      id: "geometry_req_bad_torus",
      op: "geometry.tessellateTorus",
      error: {
        code: "INVALID_DIMENSIONS",
        message:
          "Torus dimensions must be finite numbers greater than zero with minorRadius smaller than majorRadius."
      },
      warnings: []
    });
  });

  it("returns structured revolve validation errors before calling the kernel", async () => {
    const zeroAxis = await executeGeometryKernelRequest({
      id: "geometry_req_bad_revolve_axis",
      version: "geometry-kernel.v1",
      op: "geometry.revolveProfile",
      sketchPlane: "XY",
      profile: {
        kind: "rectangle",
        center: [1, 0],
        width: 2,
        height: 3
      },
      axis: {
        start: [0, 0],
        end: [0, 0]
      },
      angleDegrees: 90
    });
    const badAngle = await executeGeometryKernelRequest({
      id: "geometry_req_bad_revolve_angle",
      version: "geometry-kernel.v1",
      op: "geometry.revolveProfile",
      sketchPlane: "XY",
      profile: {
        kind: "circle",
        center: [2, 0],
        radius: 1
      },
      axis: {
        start: [0, -1],
        end: [0, 1]
      },
      angleDegrees: 361
    });

    expect(zeroAxis).toEqual({
      ok: false,
      id: "geometry_req_bad_revolve_axis",
      op: "geometry.revolveProfile",
      error: {
        code: "INVALID_DIMENSIONS",
        message:
          "Revolve profile requests require a supported sketch plane, valid rectangle, circle, resolved wire, or one-region profile, a non-zero finite axis longer than the shared tolerance, one-sided material with only outer vertex contact, holes strictly separated from the axis, and a positive finite angle no greater than 360 degrees."
      },
      warnings: []
    });
    expect(badAngle).toEqual({
      ok: false,
      id: "geometry_req_bad_revolve_angle",
      op: "geometry.revolveProfile",
      error: {
        code: "INVALID_DIMENSIONS",
        message:
          "Revolve profile requests require a supported sketch plane, valid rectangle, circle, resolved wire, or one-region profile, a non-zero finite axis longer than the shared tolerance, one-sided material with only outer vertex contact, holes strictly separated from the axis, and a positive finite angle no greater than 360 degrees."
      },
      warnings: []
    });
  });

  it("accepts one-sided region revolve recipes and rejects holes within axis tolerance", async () => {
    let revolveCalls = 0;
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createRevolveProfileMesh: async () => {
        revolveCalls += 1;
        return {
          primitive: "revolve",
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          indices: new Uint32Array([0, 1, 2]),
          vertexCount: 3,
          triangleCount: 1,
          faceCount: 1
        };
      }
    };
    const profile = {
      kind: "region" as const,
      frame: mixedWireProfile.frame,
      outer: {
        kind: "rectangle" as const,
        center: [4, 0] as const,
        width: 2,
        height: 4
      },
      holes: [
        {
          kind: "circle" as const,
          center: [4, 0] as const,
          radius: 0.5
        }
      ],
      sourceIdentity: "valid-region-revolve",
      geometryPolicy: mixedWireProfile.geometryPolicy
    } satisfies ResolvedPlanarRegionProfile;
    const request = {
      id: "region-revolve-valid",
      version: "geometry-kernel.v1" as const,
      op: "geometry.revolveProfile" as const,
      sketchPlane: "XY" as const,
      profile,
      axis: { start: [0, -5] as const, end: [0, 5] as const },
      angleDegrees: 360
    };
    const valid = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      request
    );
    const invalid = await executeGeometryKernelRequestWithMeshFactory(
      factories,
      {
        ...request,
        id: "region-revolve-hole-touch",
        profile: {
          ...profile,
          sourceIdentity: "invalid-region-revolve-hole-touch",
          holes: [
            {
              kind: "circle",
              center: [0.5, 0] as const,
              radius: 0.5
            }
          ]
        }
      }
    );

    expect(valid.ok).toBe(true);
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "INVALID_DIMENSIONS" }
    });
    expect(revolveCalls).toBe(1);
  });

  it("uses one tolerance-aware infinite-axis classifier for wire mesh, exact, and STEP recipes", async () => {
    const unusedFactory = async () => {
      throw new Error("Unexpected mesh factory call.");
    };
    let revolveCalls = 0;
    const factories: GeometryKernelMeshFactories = {
      createBoxMesh: unusedFactory,
      createCylinderMesh: unusedFactory,
      createSphereMesh: unusedFactory,
      createConeMesh: unusedFactory,
      createTorusMesh: unusedFactory,
      createBooleanExtrudeMesh: unusedFactory,
      createRevolveProfileMesh: async () => {
        revolveCalls += 1;
        return {
          primitive: "revolve",
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          indices: new Uint32Array([0, 1, 2]),
          vertexCount: 3,
          triangleCount: 1,
          faceCount: 1
        };
      },
      createExactBodyMetadata: async (input) => ({
        sourceKind: getMetadataSourceKind(input.source),
        bounds: { min: [0, 0, 0], max: [1, 1, 1] },
        volume: 1,
        surfaceArea: 6,
        centroid: [0.5, 0.5, 0.5],
        topologyCounts: {
          solidCount: 1,
          faceCount: 6,
          edgeCount: 12,
          vertexCount: 8
        },
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived",
        diagnostics: []
      }),
      createExactStepExport: async (input) => ({
        format: "step",
        schema: "AP242DIS",
        units: input.units,
        bodyCount: input.bodies.length,
        byteLength: 1,
        bytes: new Uint8Array([1])
      })
    };
    const circleWire = {
      kind: "wire" as const,
      frame: mixedWireProfile.frame,
      closed: true as const,
      segments: [
        {
          kind: "arc" as const,
          sourceEntityId: "arc-positive",
          center: [0, 0] as const,
          radius: 2,
          startAngleDegrees: 0,
          sweepAngleDegrees: 180
        },
        {
          kind: "arc" as const,
          sourceEntityId: "arc-negative",
          center: [0, 0] as const,
          radius: 2,
          startAngleDegrees: 180,
          sweepAngleDegrees: 180
        }
      ],
      sourceIdentity: "circle-wire",
      geometryPolicy: mixedWireProfile.geometryPolicy
    } satisfies ResolvedPlanarWireProfile;
    const reversedCircleWire = {
      ...circleWire,
      sourceIdentity: "reversed-circle-wire",
      segments: circleWire.segments.map((segment) => ({
        ...segment,
        sweepAngleDegrees: -180
      }))
    } satisfies ResolvedPlanarWireProfile;
    const scaledCircleWire = {
      ...circleWire,
      sourceIdentity: "scaled-circle-wire",
      segments: circleWire.segments.map((segment) => ({
        ...segment,
        radius: 1_000_000
      }))
    } satisfies ResolvedPlanarWireProfile;
    const endpointTouchTriangle = {
      kind: "wire" as const,
      frame: {
        origin: [10, 20, 30] as const,
        uAxis: [0, 1, 0] as const,
        vAxis: [0, 0, 1] as const
      },
      closed: true as const,
      segments: [
        {
          kind: "line" as const,
          sourceEntityId: "touch",
          start: [0, 0] as const,
          end: [2, -1] as const
        },
        {
          kind: "line" as const,
          sourceEntityId: "outer",
          start: [2, -1] as const,
          end: [2, 1] as const
        },
        {
          kind: "line" as const,
          sourceEntityId: "return",
          start: [2, 1] as const,
          end: [0, 0] as const
        }
      ],
      sourceIdentity: "endpoint-touch-triangle",
      geometryPolicy: mixedWireProfile.geometryPolicy
    } satisfies ResolvedPlanarWireProfile;
    const oppositeVertexDiamond = {
      kind: "wire" as const,
      frame: mixedWireProfile.frame,
      closed: true as const,
      segments: [
        {
          kind: "line" as const,
          sourceEntityId: "top-right",
          start: [0, 2] as const,
          end: [2, 0] as const
        },
        {
          kind: "line" as const,
          sourceEntityId: "right-bottom",
          start: [2, 0] as const,
          end: [0, -2] as const
        },
        {
          kind: "line" as const,
          sourceEntityId: "bottom-left",
          start: [0, -2] as const,
          end: [-2, 0] as const
        },
        {
          kind: "line" as const,
          sourceEntityId: "left-top",
          start: [-2, 0] as const,
          end: [0, 2] as const
        }
      ],
      sourceIdentity: "opposite-vertex-diamond",
      geometryPolicy: mixedWireProfile.geometryPolicy
    } satisfies ResolvedPlanarWireProfile;
    const cases: readonly {
      readonly label: string;
      readonly profile: ResolvedPlanarWireProfile;
      readonly axis: RevolveGeometryAxis;
    }[] = [
      {
        label: "crosses beyond the finite axis endpoints",
        profile: circleWire,
        axis: { start: [0, 100] as const, end: [0, 101] as const }
      },
      {
        label: "touches an arc interior tangentially",
        profile: circleWire,
        axis: { start: [-1, 2] as const, end: [1, 2] as const }
      },
      {
        label: "touches a reversed arc interior tangentially",
        profile: reversedCircleWire,
        axis: { start: [-1, 2] as const, end: [1, 2] as const }
      },
      {
        label:
          "rejects a scale-independent near tangent within linear tolerance",
        profile: scaledCircleWire,
        axis: {
          start: [-1, 1_000_000 + 0.5e-7] as const,
          end: [1, 1_000_000 + 0.5e-7] as const
        }
      },
      {
        label: "overlaps a line edge",
        profile: endpointTouchTriangle,
        axis: { start: [2, -10] as const, end: [2, 10] as const }
      },
      {
        label:
          "straddles the axis through two otherwise legal profile vertices",
        profile: oppositeVertexDiamond,
        axis: { start: [0, -10] as const, end: [0, 10] as const }
      },
      {
        label: "uses an axis exactly equal to the shared linear tolerance",
        profile: endpointTouchTriangle,
        axis: { start: [-1, 0] as const, end: [-1, 1e-7] as const }
      }
    ];

    for (const [index, testCase] of cases.entries()) {
      const source = {
        kind: "revolve" as const,
        sketchPlane: "XY" as const,
        profile: testCase.profile,
        axis: testCase.axis,
        angleDegrees: 180
      } satisfies ExactRevolveMetadataSource;
      const [mesh, exact] = await Promise.all([
        executeGeometryKernelRequestWithMeshFactory(factories, {
          ...source,
          id: `wire-axis-${index}-mesh`,
          version: "geometry-kernel.v1" as const,
          op: "geometry.revolveProfile" as const
        }),
        executeGeometryKernelRequestWithMeshFactory(factories, {
          id: `wire-axis-${index}-exact`,
          version: "geometry-kernel.v1",
          op: "geometry.exactBodyMetadata",
          source
        })
      ]);
      expect([mesh.ok, exact.ok], testCase.label).toEqual([false, false]);
    }

    const snapshot = JSON.stringify(endpointTouchTriangle);
    for (const axis of [
      { start: [0, -1] as const, end: [0, 1] as const },
      { start: [0, 1] as const, end: [0, -1] as const }
    ]) {
      const response = await executeGeometryKernelRequestWithMeshFactory(
        factories,
        {
          id: `wire-endpoint-touch-${revolveCalls}`,
          version: "geometry-kernel.v1",
          op: "geometry.revolveProfile",
          sketchPlane: "YZ",
          profile: endpointTouchTriangle,
          axis,
          angleDegrees: revolveCalls === 0 ? 90 : 360
        }
      );
      expect(response.ok).toBe(true);
    }
    expect(revolveCalls).toBe(2);
    expect(JSON.stringify(endpointTouchTriangle)).toBe(snapshot);

    const aboveToleranceSource = {
      kind: "revolve" as const,
      sketchPlane: "XY" as const,
      profile: endpointTouchTriangle,
      axis: { start: [-1, 0] as const, end: [-1, 1.01e-7] as const },
      angleDegrees: 180
    };
    const [mesh, exact] = await Promise.all([
      executeGeometryKernelRequestWithMeshFactory(factories, {
        ...aboveToleranceSource,
        id: "wire-axis-above-tolerance-mesh",
        version: "geometry-kernel.v1" as const,
        op: "geometry.revolveProfile" as const
      }),
      executeGeometryKernelRequestWithMeshFactory(factories, {
        id: "wire-axis-above-tolerance-exact",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: aboveToleranceSource
      })
    ]);
    expect([mesh.ok, exact.ok]).toEqual([true, true]);
  });
});

function getMeshBounds(positions: Float32Array): {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
} {
  const points: Array<readonly [number, number, number]> = [];

  for (let index = 0; index < positions.length; index += 3) {
    const [x, y, z] = readTestPositionTuple(positions, index);
    points.push([cleanNumber(x), cleanNumber(y), cleanNumber(z)]);
  }

  return {
    min: [
      Math.min(...points.map((point) => point[0])),
      Math.min(...points.map((point) => point[1])),
      Math.min(...points.map((point) => point[2]))
    ],
    max: [
      Math.max(...points.map((point) => point[0])),
      Math.max(...points.map((point) => point[1])),
      Math.max(...points.map((point) => point[2]))
    ]
  };
}

function expectBooleanBounds(
  actual: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  },
  expected: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  },
  exactAxes: readonly number[]
): void {
  for (const index of [0, 1, 2] as const) {
    if (exactAxes.includes(index)) {
      expect(actual.min[index]).toBeCloseTo(expected.min[index], 6);
      expect(actual.max[index]).toBeCloseTo(expected.max[index], 6);
    } else {
      expect(actual.min[index]).toBeGreaterThanOrEqual(expected.min[index]);
      expect(actual.max[index]).toBeLessThanOrEqual(expected.max[index]);
      expect(Math.abs(actual.min[index] - expected.min[index])).toBeLessThan(
        0.25
      );
      expect(Math.abs(actual.max[index] - expected.max[index])).toBeLessThan(
        0.25
      );
    }
  }
}

function readTestPositionTuple(
  positions: Float32Array,
  index: number
): readonly [number, number, number] {
  const x = positions[index];
  const y = positions[index + 1];
  const z = positions[index + 2];
  if (x === undefined || y === undefined || z === undefined) {
    throw new Error("Expected complete XYZ mesh positions.");
  }
  return [x, y, z];
}

function cleanNumber(value: number): number {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Object.is(rounded, -0) ? 0 : rounded;
}

import {
  createBoxTessellationWorkerRequest,
  createConeTessellationWorkerRequest,
  createCylinderTessellationWorkerRequest,
  createExactBodyArtifactWorkerRequest,
  createExactStepExportWorkerRequest,
  createSphereTessellationWorkerRequest,
  createTorusTessellationWorkerRequest,
  getExactBodyArtifactSourceLeaf,
  type ExactBodyArtifactLeaf,
  type ExactBodyArtifactSource,
  type GeometryKernelExactBodyArtifact,
  type GeometryWorkerRequest
} from "@web-cad/geometry-worker";
import { describe, expect, it } from "vitest";
import {
  BrowserGeometryWorker,
  BrowserGeometryWorkerError,
  type GeometryWorkerMessage,
  type GeometryWorkerTransport
} from "./browserGeometryWorker";

interface WorkerMessageEvent<T> {
  readonly data: T;
}

interface WorkerErrorEvent {
  readonly error?: unknown;
  readonly message?: string;
}

type MessageListener = (
  event: WorkerMessageEvent<GeometryWorkerMessage>
) => void;
type ErrorListener = (event: WorkerErrorEvent) => void;

function createArtifactLeafFixture(
  brepBytes: Uint8Array
): ExactBodyArtifactLeaf {
  return {
    kind: "bodyArtifact",
    artifactVersion: "partbench.exact-body-artifact.v1",
    bodyId: "body_seed",
    sourceType: "primitiveFeature",
    documentSourceIdentity: {
      algorithm: "partbench-source-v1",
      sha256: "a".repeat(64)
    },
    bodySourceIdentitySignature: `body-topology-source:v1:${"b".repeat(64)}`,
    sourceCacheKeySha256: "c".repeat(64),
    sourceGraphNodeCount: 1,
    units: "mm",
    shapePolicy: "singleSolid",
    sourceKind: "box",
    brepFormat: "occt-brep",
    brepWriter: "BRepTools.Write_3",
    brepBytes,
    brepByteLength: brepBytes.byteLength,
    brepSha256: "f".repeat(64),
    topologySignature: "topology-seed"
  };
}

function createArtifactPatternRequest(id: string, leaf: ExactBodyArtifactLeaf) {
  return createExactBodyArtifactWorkerRequest({
    id,
    bodyId: "body_pattern",
    sourceType: "linearPatternFeature",
    documentSourceIdentity: leaf.documentSourceIdentity,
    bodySourceIdentitySignature: `body-topology-source:v1:${"d".repeat(64)}`,
    sourceCacheKeySha256: "e".repeat(64),
    sourceGraphNodeCount: 2,
    units: "mm",
    shapePolicy: "singleShapeOneOrMoreSolids",
    source: {
      kind: "artifactLinearPattern",
      seed: leaf,
      direction: [1, 0, 0],
      spacing: 2,
      instanceCount: 2
    }
  });
}

class FakeGeometryWorkerTransport implements GeometryWorkerTransport {
  readonly requests: GeometryWorkerRequest[] = [];
  readonly transfers: Transferable[][] = [];
  terminationCount = 0;
  throwOnMessageRemoval = false;
  readonly #handler: (
    request: GeometryWorkerRequest
  ) => Promise<GeometryWorkerMessage>;
  readonly #messageListeners = new Set<MessageListener>();
  readonly #errorListeners = new Set<ErrorListener>();

  constructor(
    handler: (request: GeometryWorkerRequest) => Promise<GeometryWorkerMessage>
  ) {
    this.#handler = handler;
  }

  postMessage(
    message: GeometryWorkerRequest,
    transfer: Transferable[] = []
  ): void {
    const transmitted = structuredClone(message, { transfer });
    this.requests.push(transmitted);
    this.transfers.push(transfer);

    queueMicrotask(() => {
      void this.#postResponse(transmitted);
    });
  }

  addEventListener(type: "message", listener: MessageListener): void;
  addEventListener(type: "error", listener: ErrorListener): void;
  addEventListener(
    type: "message" | "error",
    listener: MessageListener | ErrorListener
  ): void {
    if (type === "message") {
      this.#messageListeners.add(listener as MessageListener);
      return;
    }

    this.#errorListeners.add(listener as ErrorListener);
  }

  removeEventListener(type: "message", listener: MessageListener): void;
  removeEventListener(type: "error", listener: ErrorListener): void;
  removeEventListener(
    type: "message" | "error",
    listener: MessageListener | ErrorListener
  ): void {
    if (type === "message") {
      this.#messageListeners.delete(listener as MessageListener);
      if (this.throwOnMessageRemoval) {
        throw new Error("Injected listener removal failure.");
      }
      return;
    }

    this.#errorListeners.delete(listener as ErrorListener);
  }

  terminate(): void {
    this.terminationCount += 1;
    this.#messageListeners.clear();
    this.#errorListeners.clear();
  }

  emitMessage(message: GeometryWorkerMessage): void {
    for (const listener of this.#messageListeners) {
      listener({ data: message });
    }
  }

  async #postResponse(request: GeometryWorkerRequest): Promise<void> {
    try {
      const response = await this.#handler(request);

      for (const listener of this.#messageListeners) {
        listener({ data: response });
      }
    } catch (error) {
      for (const listener of this.#errorListeners) {
        listener({ error });
      }
    }
  }
}

class ThrowingTerminationTransport extends FakeGeometryWorkerTransport {
  override terminate(): void {
    super.terminate();
    throw new Error("Injected terminate failure.");
  }
}

class PartialSetupFailureTransport implements GeometryWorkerTransport {
  messageListenerRemoved = false;
  terminated = false;

  postMessage(): void {}

  addEventListener(type: "message", listener: MessageListener): void;
  addEventListener(type: "error", listener: ErrorListener): void;
  addEventListener(type: "message" | "error"): void {
    if (type === "error") {
      throw new Error("Injected listener setup failure.");
    }
  }

  removeEventListener(type: "message", listener: MessageListener): void;
  removeEventListener(type: "error", listener: ErrorListener): void;
  removeEventListener(type: "message" | "error"): void {
    if (type === "message") {
      this.messageListenerRemoved = true;
      throw new Error("Injected listener cleanup failure.");
    }
  }

  terminate(): void {
    this.terminated = true;
  }
}

function createPrimitiveTessellationTransport(): FakeGeometryWorkerTransport {
  return new FakeGeometryWorkerTransport(async (request) =>
    createPrimitiveTessellationMessage(request)
  );
}

function createPrimitiveTessellationMessage(
  request: GeometryWorkerRequest
): GeometryWorkerMessage {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const indices = new Uint32Array([0, 1, 2]);

  return {
    id: request.id,
    version: request.version,
    kind: request.kind,
    payloadId: request.payload.id,
    response: {
      ok: true,
      id: request.payload.id,
      op: request.payload.op,
      mesh: {
        primitive: getPrimitiveForOp(request.payload.op),
        positions,
        indices,
        vertexCount: 3,
        triangleCount: 1,
        faceCount: 1
      },
      warnings: []
    },
    transferables: [positions.buffer, indices.buffer]
  } as GeometryWorkerMessage;
}

function createExactBodyArtifactMessage(
  request: GeometryWorkerRequest,
  artifact = createExactBodyArtifactFixture()
): GeometryWorkerMessage & {
  readonly response: {
    readonly ok: true;
    readonly op: "geometry.exactBodyArtifact";
    readonly artifact: GeometryKernelExactBodyArtifact;
  };
  readonly transferables: readonly ArrayBuffer[];
} {
  const pickMap = artifact.viewportPickMap;
  if (!pickMap) throw new Error("Expected exact pick-map fixture.");
  return {
    id: request.id,
    version: request.version,
    kind: request.kind,
    payloadId: request.payload.id,
    response: {
      ok: true,
      id: request.payload.id,
      op: "geometry.exactBodyArtifact",
      artifact,
      warnings: []
    },
    transferables: [
      artifact.brepBytes.buffer,
      artifact.displayMesh.positions.buffer,
      artifact.displayMesh.indices.buffer,
      pickMap.faceTriangleRanges.buffer,
      pickMap.edgePointRanges.buffer,
      pickMap.edgePoints.buffer,
      pickMap.vertexPoints.buffer
    ] as ArrayBuffer[]
  };
}

function createExactBodyArtifactFixture(): GeometryKernelExactBodyArtifact {
  const artifact = createArtifactLeafFixture(new Uint8Array([1, 2, 3]));
  const topologySignature = "topology:pick";
  const entities = [
    {
      localId: "face:pick",
      kind: "face" as const,
      signature: "face:pick",
      source: "kernel-derived" as const
    },
    {
      localId: "edge:pick",
      kind: "edge" as const,
      signature: "edge:pick",
      source: "kernel-derived" as const
    },
    {
      localId: "vertex:pick",
      kind: "vertex" as const,
      signature: "vertex:pick",
      source: "kernel-derived" as const,
      point: [0, 0, 0] as const
    }
  ];
  return {
    ...artifact,
    metadata: {
      sourceKind: "box",
      bounds: { min: [0, 0, 0], max: [1, 1, 0] },
      volume: 0,
      surfaceArea: 0.5,
      centroid: [1 / 3, 1 / 3, 0],
      topologyCounts: {
        solidCount: 0,
        faceCount: 1,
        edgeCount: 1,
        vertexCount: 1
      },
      measurementSource: "kernel-derived",
      measurementConfidence: "kernel-derived",
      diagnostics: []
    },
    topologySnapshot: {
      sourceKind: "box",
      status: "ready",
      entityCounts: {
        bodyCount: 0,
        solidCount: 0,
        faceCount: 1,
        wireCount: 0,
        edgeCount: 1,
        vertexCount: 1,
        loopCount: 0,
        coedgeCount: 0,
        axisCount: 0
      },
      entityCount: entities.length,
      entities,
      unsupportedEntityKinds: [],
      adjacencyAvailable: false,
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
      signature: topologySignature,
      source: "kernel-derived",
      diagnostics: []
    },
    displayMesh: {
      primitive: "box",
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      indices: new Uint32Array([0, 1, 2]),
      vertexCount: 3,
      triangleCount: 1,
      faceCount: 1
    },
    viewportPickMap: {
      version: "partbench.exact-pick-map.v1",
      bodyId: artifact.bodyId,
      bodySourceIdentitySignature: artifact.bodySourceIdentitySignature,
      topologySignature,
      meshVertexCount: 3,
      meshTriangleCount: 1,
      faces: [
        {
          localId: entities[0]!.localId,
          entitySignature: entities[0]!.signature
        }
      ],
      edges: [
        {
          localId: entities[1]!.localId,
          entitySignature: entities[1]!.signature
        }
      ],
      vertices: [
        {
          localId: entities[2]!.localId,
          entitySignature: entities[2]!.signature
        }
      ],
      faceTriangleRanges: new Uint32Array([0, 1]),
      edgePointRanges: new Uint32Array([0, 2]),
      edgePoints: new Float64Array([0, 0, 0, 1, 0, 0]),
      vertexPoints: new Float64Array([0, 0, 0])
    }
  } satisfies GeometryKernelExactBodyArtifact;
}

function getPrimitiveForOp(op: GeometryWorkerRequest["payload"]["op"]) {
  switch (op) {
    case "geometry.tessellateBox":
      return "box";
    case "geometry.tessellateCylinder":
      return "cylinder";
    case "geometry.tessellateSphere":
      return "sphere";
    case "geometry.tessellateCone":
      return "cone";
    case "geometry.tessellateTorus":
      return "torus";
    default:
      throw new Error(`Unsupported primitive test op: ${op}`);
  }
}

describe("BrowserGeometryWorker", () => {
  it("retains a valid exact pick map after structured transfer", async () => {
    const transport = new FakeGeometryWorkerTransport(async (request) => {
      const response = createExactBodyArtifactMessage(request);
      return structuredClone(response, {
        transfer: [...response.transferables]
      }) as GeometryWorkerMessage;
    });
    const worker = new BrowserGeometryWorker(transport);
    const response = await worker.execute(
      createArtifactPatternRequest(
        "browser_pick_map_transfer",
        createArtifactLeafFixture(new Uint8Array([1]))
      )
    );

    if (
      !response.response.ok ||
      response.response.op !== "geometry.exactBodyArtifact"
    ) {
      throw new Error("Expected an exact body artifact response.");
    }
    const { artifact } = response.response;
    const pickMap = artifact.viewportPickMap;
    if (!pickMap) throw new Error("Expected transferred exact pick map.");
    expect(response.transferables).toEqual([
      artifact.brepBytes.buffer,
      artifact.displayMesh.positions.buffer,
      artifact.displayMesh.indices.buffer,
      pickMap.faceTriangleRanges.buffer,
      pickMap.edgePointRanges.buffer,
      pickMap.edgePoints.buffer,
      pickMap.vertexPoints.buffer
    ]);
  });

  it.each([
    [
      "corrupt",
      (artifact: GeometryKernelExactBodyArtifact) => ({
        ...artifact,
        viewportPickMap: {
          ...artifact.viewportPickMap!,
          topologySignature: "stale-topology"
        }
      }),
      false
    ],
    [
      "detached",
      (artifact: GeometryKernelExactBodyArtifact) => {
        structuredClone(artifact.viewportPickMap!.faceTriangleRanges, {
          transfer: [artifact.viewportPickMap!.faceTriangleRanges.buffer]
        });
        return artifact;
      },
      false
    ],
    [
      "transfer-list mismatched",
      (artifact: GeometryKernelExactBodyArtifact) => artifact,
      true
    ]
  ] as const)(
    "drops only a %s exact pick map on receipt without mutating the message",
    async (_name, mutate, mismatchTransferList) => {
      let incoming:
        | (GeometryWorkerMessage & {
            readonly response: {
              readonly artifact: GeometryKernelExactBodyArtifact;
            };
            readonly transferables: readonly ArrayBuffer[];
          })
        | undefined;
      const transport = new FakeGeometryWorkerTransport(async (request) => {
        const artifact = mutate(createExactBodyArtifactFixture());
        const message = createExactBodyArtifactMessage(request, artifact);
        incoming = mismatchTransferList
          ? { ...message, transferables: message.transferables.slice(0, 3) }
          : message;
        return incoming;
      });
      const worker = new BrowserGeometryWorker(transport);
      const response = await worker.execute(
        createArtifactPatternRequest(
          `browser_pick_map_${_name}`,
          createArtifactLeafFixture(new Uint8Array([1]))
        )
      );

      if (
        !response.response.ok ||
        response.response.op !== "geometry.exactBodyArtifact" ||
        !incoming
      ) {
        throw new Error("Expected an exact body artifact response.");
      }
      expect(response.response.artifact).toMatchObject({
        bodyId: incoming.response.artifact.bodyId,
        viewportPickMapDowngrade: { status: "invalid" }
      });
      expect(response.response.artifact.viewportPickMap).toBeUndefined();
      expect([...response.response.artifact.brepBytes]).toEqual([1, 2, 3]);
      expect(response.transferables).toEqual([
        response.response.artifact.brepBytes.buffer,
        response.response.artifact.displayMesh.positions.buffer,
        response.response.artifact.displayMesh.indices.buffer
      ]);
      expect(incoming.response.artifact.viewportPickMap).toBeDefined();
      expect(incoming.transferables).toHaveLength(mismatchTransferList ? 3 : 7);
    }
  );

  it("cleans up partial listener setup when construction fails", () => {
    const transport = new PartialSetupFailureTransport();

    expect(() => new BrowserGeometryWorker(transport)).toThrow(
      "Injected listener setup failure."
    );
    expect(transport.messageListenerRemoved).toBe(true);
    expect(transport.terminated).toBe(true);
  });

  it("sends geometry requests through a worker-like transport asynchronously", async () => {
    const positions = new Float32Array([0, 0, 0]);
    const indices = new Uint32Array();
    const transport = new FakeGeometryWorkerTransport(async (request) => ({
      id: request.id,
      version: request.version,
      kind: request.kind,
      payloadId: request.payload.id,
      response: {
        ok: true,
        id: request.payload.id,
        op: "geometry.tessellateBox",
        mesh: {
          primitive: "box",
          positions,
          indices,
          vertexCount: 1,
          triangleCount: 0,
          faceCount: 0
        },
        warnings: []
      },
      transferables: [positions.buffer, indices.buffer]
    }));
    const worker = new BrowserGeometryWorker(transport);
    const request = createBoxTessellationWorkerRequest({
      id: "browser_geometry_req_1",
      width: 1,
      height: 1,
      depth: 1
    });
    const responsePromise = worker.execute(request);
    let isSettled = false;
    void responsePromise.then(() => {
      isSettled = true;
    });

    expect(transport.requests).toEqual([request]);
    expect(isSettled).toBe(false);

    const response = await responsePromise;

    expect(response.id).toBe("browser_geometry_req_1");
    expect(response.response.ok).toBe(true);
    expect(response.transferables).toEqual([positions.buffer, indices.buffer]);
    expect(isSettled).toBe(true);
  });

  it("transfers exact STEP artifact inputs without retaining a duplicate BRep buffer", async () => {
    const stepBytes = new Uint8Array([7]);
    const transport = new FakeGeometryWorkerTransport(async (request) => ({
      id: request.id,
      version: request.version,
      kind: request.kind,
      payloadId: request.payload.id,
      response: {
        ok: true,
        id: request.payload.id,
        op: "geometry.exportStep",
        artifact: {
          format: "step",
          schema: "AP242DIS",
          units: "mm",
          bodyCount: 1,
          byteLength: stepBytes.byteLength,
          bytes: stepBytes
        },
        warnings: []
      },
      transferables: [stepBytes.buffer]
    }));
    const worker = new BrowserGeometryWorker(transport);
    const brepBytes = new Uint8Array([1, 2, 3]);
    const request = createExactStepExportWorkerRequest({
      id: "browser_exact_step_transfer",
      units: "mm",
      bodies: [
        {
          bodyId: "body-transfer",
          bodyName: "Transferred",
          brepFormat: "occt-brep",
          brepByteLength: brepBytes.byteLength,
          brepSha256: "0".repeat(64),
          brepBytes
        }
      ]
    });
    const responsePromise = worker.execute(request);

    expect(brepBytes.byteLength).toBe(0);
    expect(transport.transfers[0]).toHaveLength(1);
    const transmitted = transport.requests[0];
    expect(transmitted?.payload.op).toBe("geometry.exportStep");
    if (transmitted?.payload.op === "geometry.exportStep") {
      expect(transmitted.payload.bodies[0]?.brepBytes.byteLength).toBe(3);
    }
    await expect(responsePromise).resolves.toMatchObject({
      response: { ok: true, op: "geometry.exportStep" }
    });
  });

  it("transfers request-owned artifact leaf copies without detaching retained bytes", async () => {
    const transport = new FakeGeometryWorkerTransport(
      async (request) =>
        ({
          id: request.id,
          version: request.version,
          kind: request.kind,
          payloadId: request.payload.id,
          response: {
            ok: false,
            id: request.payload.id,
            op: request.payload.op,
            error: {
              code: "KERNEL_FAILURE",
              message: "Transfer-only fixture."
            },
            warnings: []
          },
          transferables: []
        }) as GeometryWorkerMessage
    );
    const worker = new BrowserGeometryWorker(transport);
    const retainedBuffer = new Uint8Array([9, 1, 2, 9]).buffer;
    const retainedBytes = new Uint8Array(retainedBuffer, 1, 2);
    const leaf = createArtifactLeafFixture(retainedBytes);
    const sources: readonly {
      readonly source: ExactBodyArtifactSource;
      readonly shapePolicy: "singleSolid" | "singleShapeOneOrMoreSolids";
    }[] = [
      { source: leaf, shapePolicy: "singleSolid" },
      {
        source: {
          kind: "artifactHole",
          target: leaf,
          tool: {
            sketchPlane: "XY",
            circle: { kind: "circle", center: [0, 0], radius: 0.5 },
            depthMode: "throughAll"
          }
        },
        shapePolicy: "singleSolid"
      },
      {
        source: {
          kind: "artifactLinearPattern",
          seed: leaf,
          direction: [1, 0, 0],
          spacing: 2,
          instanceCount: 2
        },
        shapePolicy: "singleShapeOneOrMoreSolids"
      },
      {
        source: {
          kind: "artifactCircularPattern",
          seed: leaf,
          axis: { origin: [0, 0, 0], direction: [0, 0, 1] },
          totalAngleDegrees: 180,
          instanceCount: 2
        },
        shapePolicy: "singleShapeOneOrMoreSolids"
      },
      {
        source: {
          kind: "artifactMirror",
          seed: leaf,
          plane: { point: [0, 0, 0], normal: [1, 0, 0] },
          includeOriginal: true
        },
        shapePolicy: "singleShapeOneOrMoreSolids"
      },
      {
        source: {
          kind: "artifactShell",
          target: leaf,
          wallThickness: 0.2,
          openFaces: [{ localId: "snapshot-local:face:1" }]
        },
        shapePolicy: "singleSolid"
      }
    ];

    for (const [index, entry] of sources.entries()) {
      const responsePromise = worker.execute(
        createExactBodyArtifactWorkerRequest({
          id: `browser_artifact_leaf_transfer_${index}`,
          bodyId: `body_artifact_${index}`,
          sourceType: "testFeature",
          documentSourceIdentity: leaf.documentSourceIdentity,
          bodySourceIdentitySignature: `body-topology-source:v1:${"d".repeat(64)}`,
          sourceCacheKeySha256: "e".repeat(64),
          sourceGraphNodeCount: entry.source.kind === "bodyArtifact" ? 1 : 2,
          units: "mm",
          shapePolicy: entry.shapePolicy,
          source: entry.source
        })
      );

      expect([...new Uint8Array(retainedBuffer)]).toEqual([9, 1, 2, 9]);
      expect(retainedBytes.byteLength).toBe(2);
      expect(transport.transfers[index]).toHaveLength(1);
      expect(transport.transfers[index]![0]).not.toBe(retainedBuffer);
      const transmitted = transport.requests[index]!.payload;
      expect(transmitted.op).toBe("geometry.exactBodyArtifact");
      if (transmitted.op === "geometry.exactBodyArtifact") {
        expect(transmitted.source.kind).toBe(entry.source.kind);
        const transmittedLeaf = getExactBodyArtifactSourceLeaf(
          transmitted.source
        );
        expect([...transmittedLeaf!.brepBytes]).toEqual([1, 2]);
        expect(transmittedLeaf!.brepBytes.buffer).not.toBe(retainedBuffer);
      }
      await expect(responsePromise).resolves.toMatchObject({
        response: { ok: false, op: "geometry.exactBodyArtifact" }
      });
    }

    await expect(
      worker.execute(
        createArtifactPatternRequest("browser_invalid_artifact_length", {
          ...leaf,
          brepByteLength: leaf.brepByteLength + 1
        })
      )
    ).rejects.toMatchObject({
      diagnostics: {
        error: {
          code: "WORKER_TRANSPORT_FAILED",
          message: "Exact body artifact leaf bytes exceed transport limits."
        }
      }
    });
    expect(transport.requests).toHaveLength(sources.length);

    const sharedBuffer = new SharedArrayBuffer(4);
    new Uint8Array(sharedBuffer).set([9, 3, 4, 9]);
    const sharedBytes = new Uint8Array(sharedBuffer, 1, 2);
    await worker.execute(
      createArtifactPatternRequest(
        "browser_shared_artifact_leaf_transfer",
        createArtifactLeafFixture(sharedBytes)
      )
    );
    expect([...new Uint8Array(sharedBuffer)]).toEqual([9, 3, 4, 9]);
    expect(transport.transfers[sources.length]).toHaveLength(1);
    const sharedTransmitted = transport.requests[sources.length]!.payload;
    if (
      sharedTransmitted.op === "geometry.exactBodyArtifact" &&
      sharedTransmitted.source.kind === "artifactLinearPattern"
    ) {
      expect([...sharedTransmitted.source.seed.brepBytes]).toEqual([3, 4]);
      expect(sharedTransmitted.source.seed.brepBytes.buffer).toBeInstanceOf(
        ArrayBuffer
      );
    }
  });

  it("rejects duplicate pending request ids instead of overwriting handlers", async () => {
    const transport = new FakeGeometryWorkerTransport(
      () => new Promise<GeometryWorkerMessage>(() => undefined)
    );
    const worker = new BrowserGeometryWorker(transport);
    const request = createBoxTessellationWorkerRequest({
      id: "duplicate_request",
      width: 1,
      height: 1,
      depth: 1
    });
    const firstRequest = worker.execute(request);
    void firstRequest.catch(() => undefined);

    await expect(worker.execute(request)).rejects.toMatchObject({
      diagnostics: {
        error: {
          code: "WORKER_TRANSPORT_FAILED",
          message: "Duplicate geometry worker request id: duplicate_request."
        }
      }
    });
    expect(transport.requests).toHaveLength(1);

    worker.dispose();
  });

  it("rejects use after dispose and only terminates once", async () => {
    const transport = createPrimitiveTessellationTransport();
    const worker = new BrowserGeometryWorker(transport);
    const request = createBoxTessellationWorkerRequest({
      id: "disposed_request",
      width: 1,
      height: 1,
      depth: 1
    });

    worker.dispose();
    worker.dispose();

    await expect(worker.execute(request)).rejects.toMatchObject({
      diagnostics: {
        error: {
          code: "WORKER_TRANSPORT_FAILED",
          message: "Geometry worker has already been disposed."
        }
      }
    });
    expect(transport.requests).toHaveLength(0);
    expect(transport.terminationCount).toBe(1);
  });

  it("rejects pending work before transport cleanup can fail", async () => {
    const transport = new ThrowingTerminationTransport(
      () => new Promise<GeometryWorkerMessage>(() => undefined)
    );
    const worker = new BrowserGeometryWorker(transport);
    const pending = worker.execute(
      createBoxTessellationWorkerRequest({
        id: "cleanup_request",
        width: 1,
        height: 1,
        depth: 1
      })
    );

    expect(() => worker.dispose()).toThrow("Injected terminate failure.");
    await expect(pending).rejects.toMatchObject({
      diagnostics: {
        error: {
          code: "WORKER_TRANSPORT_FAILED",
          message: "Geometry worker was disposed before completing a request."
        }
      }
    });
    expect(transport.terminationCount).toBe(1);
  });

  it("attempts transport termination after listener cleanup fails", () => {
    const transport = new FakeGeometryWorkerTransport(
      () => new Promise<GeometryWorkerMessage>(() => undefined)
    );
    const worker = new BrowserGeometryWorker(transport);
    transport.throwOnMessageRemoval = true;

    expect(() => worker.dispose()).toThrow(
      "Injected listener removal failure."
    );
    expect(transport.terminationCount).toBe(1);
  });

  it("reports worker entry once without settling the request", async () => {
    let resolveResponse: ((message: GeometryWorkerMessage) => void) | undefined;
    const transport = new FakeGeometryWorkerTransport(
      () =>
        new Promise<GeometryWorkerMessage>((resolve) => {
          resolveResponse = resolve;
        })
    );
    const worker = new BrowserGeometryWorker(transport);
    const request = createBoxTessellationWorkerRequest({
      id: "tracked_request",
      width: 1,
      height: 1,
      depth: 1
    });
    let startedCount = 0;
    let settled = false;
    const responsePromise = worker.executeTracked(request, {
      onStarted: () => {
        startedCount += 1;
      }
    });
    void responsePromise.then(() => {
      settled = true;
    });

    await Promise.resolve();
    transport.emitMessage([request.id]);
    transport.emitMessage([request.id]);

    expect(startedCount).toBe(1);
    expect(settled).toBe(false);

    resolveResponse?.(createPrimitiveTessellationMessage(request));
    await expect(responsePromise).resolves.toMatchObject({ id: request.id });
    expect(settled).toBe(true);
  });

  it("passes one box tessellation message through the browser transport wrapper", async () => {
    const transport = createPrimitiveTessellationTransport();
    const worker = new BrowserGeometryWorker(transport);

    const response = await worker.execute(
      createBoxTessellationWorkerRequest({
        id: "browser_geometry_req_box",
        payloadId: "browser_geometry_payload_box",
        width: 10,
        height: 20,
        depth: 30
      })
    );

    expect(response).toMatchObject({
      id: "browser_geometry_req_box",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payloadId: "browser_geometry_payload_box",
      response: {
        ok: true,
        id: "browser_geometry_payload_box",
        op: "geometry.tessellateBox"
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.mesh.primitive).toBe("box");
    expect(response.response.mesh.vertexCount).toBeGreaterThan(0);
    expect(response.response.mesh.triangleCount).toBeGreaterThan(0);
    expect(response.transferables).toEqual([
      response.response.mesh.positions.buffer,
      response.response.mesh.indices.buffer
    ]);
  });

  it("passes one cylinder tessellation message through the browser transport wrapper", async () => {
    const transport = createPrimitiveTessellationTransport();
    const worker = new BrowserGeometryWorker(transport);

    const response = await worker.execute(
      createCylinderTessellationWorkerRequest({
        id: "browser_geometry_req_cylinder",
        payloadId: "browser_geometry_payload_cylinder",
        radius: 10,
        height: 30
      })
    );

    expect(response).toMatchObject({
      id: "browser_geometry_req_cylinder",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payloadId: "browser_geometry_payload_cylinder",
      response: {
        ok: true,
        id: "browser_geometry_payload_cylinder",
        op: "geometry.tessellateCylinder"
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.mesh.primitive).toBe("cylinder");
    expect(response.response.mesh.vertexCount).toBeGreaterThan(0);
    expect(response.response.mesh.triangleCount).toBeGreaterThan(0);
    expect(response.transferables).toEqual([
      response.response.mesh.positions.buffer,
      response.response.mesh.indices.buffer
    ]);
  });

  it("passes one sphere tessellation message through the browser transport wrapper", async () => {
    const transport = createPrimitiveTessellationTransport();
    const worker = new BrowserGeometryWorker(transport);

    const response = await worker.execute(
      createSphereTessellationWorkerRequest({
        id: "browser_geometry_req_sphere",
        payloadId: "browser_geometry_payload_sphere",
        radius: 10
      })
    );

    expect(response).toMatchObject({
      id: "browser_geometry_req_sphere",
      version: "geometry-worker.v1",
      kind: "geometry-worker.tessellatePrimitive",
      payloadId: "browser_geometry_payload_sphere",
      response: {
        ok: true,
        id: "browser_geometry_payload_sphere",
        op: "geometry.tessellateSphere"
      }
    });

    if (!response.response.ok) {
      throw new Error(response.response.error.message);
    }

    expect(response.response.mesh.primitive).toBe("sphere");
    expect(response.response.mesh.vertexCount).toBeGreaterThan(0);
    expect(response.response.mesh.triangleCount).toBeGreaterThan(0);
    expect(response.transferables).toEqual([
      response.response.mesh.positions.buffer,
      response.response.mesh.indices.buffer
    ]);
  });

  it("passes cone and torus tessellation messages through the browser transport wrapper", async () => {
    const transport = createPrimitiveTessellationTransport();
    const worker = new BrowserGeometryWorker(transport);

    const cone = await worker.execute(
      createConeTessellationWorkerRequest({
        id: "browser_geometry_req_cone",
        payloadId: "browser_geometry_payload_cone",
        radius: 2,
        height: 5
      })
    );
    const torus = await worker.execute(
      createTorusTessellationWorkerRequest({
        id: "browser_geometry_req_torus",
        payloadId: "browser_geometry_payload_torus",
        majorRadius: 3,
        minorRadius: 0.5
      })
    );

    expect(cone).toMatchObject({
      payloadId: "browser_geometry_payload_cone",
      response: {
        ok: true,
        op: "geometry.tessellateCone"
      }
    });
    expect(torus).toMatchObject({
      payloadId: "browser_geometry_payload_torus",
      response: {
        ok: true,
        op: "geometry.tessellateTorus"
      }
    });

    if (!cone.response.ok || !torus.response.ok) {
      throw new Error("Expected cone and torus browser requests to succeed.");
    }

    expect(cone.response.mesh.primitive).toBe("cone");
    expect(torus.response.mesh.primitive).toBe("torus");
  });

  it("rejects pending requests when the worker transport reports an error", async () => {
    const transport = new FakeGeometryWorkerTransport(async () => {
      throw new Error("geometry worker transport failed");
    });
    const worker = new BrowserGeometryWorker(transport);

    try {
      await worker.execute(
        createBoxTessellationWorkerRequest({
          id: "browser_geometry_req_failure",
          width: 1,
          height: 1,
          depth: 1
        })
      );
      throw new Error("Expected the geometry worker request to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(BrowserGeometryWorkerError);
      expect((error as BrowserGeometryWorkerError).diagnostics).toMatchObject({
        ok: false,
        stage: "transport",
        workerStarted: false,
        wasmLoadStatus: "notRequested",
        error: {
          code: "WORKER_TRANSPORT_FAILED",
          message: "geometry worker transport failed"
        }
      });
    }
  });

  it("rejects structured worker message errors with diagnostics", async () => {
    const transport = new FakeGeometryWorkerTransport(async (request) => ({
      id: request.id,
      error: "Unsupported geometry kernel operation: geometry.tessellateSweep.",
      diagnostics: {
        ok: false,
        stage: "requestValidation",
        workerStarted: true,
        wasmLoadStatus: "notRequested",
        error: {
          code: "UNSUPPORTED_PRIMITIVE",
          message:
            "Unsupported geometry kernel operation: geometry.tessellateSweep."
        }
      }
    }));
    const worker = new BrowserGeometryWorker(transport);

    try {
      await worker.execute(
        createBoxTessellationWorkerRequest({
          id: "browser_geometry_req_unsupported",
          width: 1,
          height: 1,
          depth: 1
        })
      );
      throw new Error("Expected the geometry worker request to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(BrowserGeometryWorkerError);
      expect((error as BrowserGeometryWorkerError).diagnostics).toMatchObject({
        ok: false,
        stage: "requestValidation",
        workerStarted: true,
        wasmLoadStatus: "notRequested",
        error: {
          code: "UNSUPPORTED_PRIMITIVE"
        }
      });
    }
  });
});

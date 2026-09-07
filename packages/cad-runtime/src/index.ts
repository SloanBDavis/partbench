import {
  AsyncCadCommandExecutor,
  CadEngine,
  createCadProjectSourceIdentity,
  readCadProjectWcad,
  WcadPackageImportError,
  type CadProject,
  type CadAsyncBatchResponse,
  type CadWorkerRequest,
  type WcadTopologyCheckpointPayloadInput
} from "@web-cad/cad-core";
import {
  CadOpsAgentAdapter,
  executeCadOpsAgentRequestAsync,
  type CadOpsAgentRequest,
  type CadOpsAgentQueryRequest,
  type CadOpsAgentCurrentSelectionRequest,
  type CadOpsAgentV8ProjectSurfaceRequest,
  type CadOpsAgentCurrentExactEvidence
} from "@web-cad/agent-adapter";
import type {
  CadBatch,
  CadBatchResponse,
  CadBatchValidationError,
  CadGeneratedFaceReference
} from "@web-cad/cad-protocol";
import {
  createGeometryKernelWorker,
  createExactTopologyCheckpointPayloadWorkerRequest
} from "@web-cad/geometry-worker";
import {
  createDerivedGeometrySourcesFromDocument,
  removeConsumedDerivedGeometrySources
} from "./shared/derivedGeometrySources";
import {
  resolveCurrentExactBodies,
  type CurrentExactBodyArtifactEvidence,
  type CurrentExactBodyResolution
} from "./shared/currentExactBodyResolver";
import {
  buildCurrentExactBodyArtifacts,
  executeProjectExactStepExport,
  type ExactArtifactRuntime
} from "./shared/projectExactStepExport";
import {
  createCurrentExactResultProjection,
  toCadCurrentExactResults
} from "./shared/currentExactResultProjection";
import { createBodyTopologyDerivedExactMetadataSnapshot } from "./shared/derivedExactMetadata";
import { exportProjectWcadWithTopologyCheckpoints } from "./shared/projectWcadTopologyCheckpoints";
import { createWcadTopologyCheckpointPayloadInputCache } from "./shared/projectCheckpointPayloads";
import { createGeneratedFaceReferenceKey } from "./shared/sketchDisplayFrames";

export interface CadSessionOptions {
  readonly project?: CadProject;
  /** Bound retained exact B-rep bytes; display geometry is never generated. */
  readonly maxArtifactCacheBytes?: number;
  readonly maxArtifactCacheEntries?: number;
}

type ExactHost = Pick<
  ExactArtifactRuntime,
  | "exactBodyArtifact"
  | "executeExactStepExport"
  | "getModelWorkSnapshot"
  | "exactTopologyCheckpointPayload"
>;

interface ExactState {
  readonly epoch: number;
  readonly resolutions: readonly CurrentExactBodyResolution[];
  readonly artifacts: readonly CurrentExactBodyArtifactEvidence[];
  readonly evidence: CadOpsAgentCurrentExactEvidence;
}

/** A serialized document session; all authored changes remain CADOps transactions. */
export class CadSession {
  readonly engine: CadEngine;
  readonly adapter: CadOpsAgentAdapter;
  readonly #executor: AsyncCadCommandExecutor;
  readonly #runtime: ExactHost;
  readonly #cache = new Map<string, CurrentExactBodyArtifactEvidence>();
  readonly #maxCacheBytes: number;
  readonly #maxCacheEntries: number;
  #cacheBytes = 0;
  #cacheHits = 0;
  #artifactBuilds = 0;
  #exactMilliseconds = 0;
  #checkpointPayloads: readonly WcadTopologyCheckpointPayloadInput[] = [];
  #exact?: ExactState;
  #queue: Promise<void> = Promise.resolve();
  #disposed = false;

  constructor(options: CadSessionOptions = {}) {
    this.engine = options.project
      ? CadEngine.fromProject(options.project)
      : new CadEngine();
    this.#maxCacheBytes = options.maxArtifactCacheBytes ?? 64 * 1024 * 1024;
    this.#maxCacheEntries = options.maxArtifactCacheEntries ?? 128;
    if (
      !Number.isSafeInteger(this.#maxCacheBytes) ||
      this.#maxCacheBytes < 0 ||
      !Number.isSafeInteger(this.#maxCacheEntries) ||
      this.#maxCacheEntries < 0
    ) {
      throw new RangeError(
        "Artifact cache limits must be non-negative safe integers."
      );
    }
    this.#runtime = this.#createExactHost();
    this.adapter = new CadOpsAgentAdapter(this.engine, () =>
      this.#exact?.epoch === this.engine.getSourceAuthorityEpoch()
        ? this.#exact.evidence
        : { derivedExactMetadata: [], currentExactResults: [] }
    );
    this.#executor = new AsyncCadCommandExecutor(this.engine, {
      execute: async (request) => ({
        id: request.id,
        response: await this.#validateCandidate(request)
      })
    });
  }

  executeBatch(batch: CadBatch): Promise<CadAsyncBatchResponse> {
    return this.#enqueue(async () => {
      const response = await this.#executor.executeBatchAtSourceAuthorityEpoch(
        batch,
        this.engine.getSourceAuthorityEpoch(),
        () => !this.#disposed
      );
      this.#assertOpen();
      if (!response)
        throw new Error("Source changed before the batch could commit.");
      return response;
    });
  }

  execute(request: CadOpsAgentRequest) {
    return this.#enqueue(async () => {
      const response = await executeCadOpsAgentRequestAsync(
        this.engine,
        this.#executor,
        request,
        this.engine.getSourceAuthorityEpoch(),
        () => !this.#disposed
      );
      this.#assertOpen();
      if (!response)
        throw new Error("Source changed before the batch could commit.");
      return response;
    });
  }

  query(request: CadOpsAgentQueryRequest) {
    return this.#enqueue(async () => {
      if (requiresExactEvidence(request.query.query.query))
        await this.#refreshExact();
      return this.adapter.query(request);
    });
  }

  inspectV8ProjectSurface(request: CadOpsAgentV8ProjectSurfaceRequest) {
    return this.#enqueue(async () => {
      await this.#refreshExact();
      return this.adapter.inspectV8ProjectSurface(request);
    });
  }

  getCurrentSelection(request: CadOpsAgentCurrentSelectionRequest) {
    return this.#enqueue(async () => this.adapter.getCurrentSelection(request));
  }

  getCurrentExactEvidence(): Promise<CadOpsAgentCurrentExactEvidence> {
    return this.#enqueue(async () => (await this.#refreshExact()).evidence);
  }

  exportWcad(): Promise<Uint8Array> {
    return this.#enqueue(async () => {
      const source = readDocumentSources(this.engine);
      const exported = await exportProjectWcadWithTopologyCheckpoints({
        engine: this.engine,
        features: source.features,
        sketches: source.sketches,
        generatedFacesByKey: source.faces,
        importedCheckpointPayloads: this.#checkpointPayloads,
        runtime: this.#runtime
      });
      return exported.bytes;
    });
  }

  openWcad(bytes: Uint8Array) {
    return this.#enqueue(async () => {
      const read = await readCadProjectWcad(bytes);
      if (!read.ok) throw new WcadPackageImportError(read.issues);
      // Parse and validate completely before changing the live session.
      const candidate = CadEngine.fromProject(read.project);
      this.engine.loadProject(candidate.exportProject());
      this.#checkpointPayloads = createWcadTopologyCheckpointPayloadInputCache(
        read.checkpointPayloads
      );
      this.#exact = undefined;
      return { sourceIdentity: read.sourceIdentity };
    });
  }

  exportStep(options: { readonly bodyIds?: readonly string[] } = {}) {
    return this.#enqueue(async () => {
      const exact = await this.#refreshExact();
      const query = this.engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.exportExact",
          format: "step",
          ...(options.bodyIds ? { bodyIds: options.bodyIds } : {}),
          ...exact.evidence
        }
      });
      if (!query.ok || query.query !== "project.exportExact") {
        throw new Error(
          query.ok ? "Exact export query unavailable." : query.error.message
        );
      }
      if (!query.available) {
        throw new Error(
          query.diagnostics.map(({ message }) => message).join(" ") ||
            "No exportable exact bodies."
        );
      }
      return executeProjectExactStepExport({
        engine: this.engine,
        exactExport: query,
        resolutions: exact.resolutions,
        runtime: this.#runtime,
        existingArtifacts: exact.artifacts
      });
    });
  }

  getSessionInfo() {
    this.#assertOpen();
    const document = this.engine.getDocument();
    return {
      runtime: "partbench.cad-runtime.v1",
      host: "headless",
      geometryAuthority: "OCCT/WASM",
      commandVersion: "cadops.v1",
      units: document.units,
      sourceIdentity: createCadProjectSourceIdentity(
        this.engine.exportProject()
      ),
      sourceAuthorityEpoch: this.engine.getSourceAuthorityEpoch(),
      capabilities: {
        exactGeometry: true,
        nativeOpenSave: true,
        stepExport: true,
        displayMesh: false
      },
      cache: {
        entryCount: this.#cache.size,
        byteLength: this.#cacheBytes,
        hits: this.#cacheHits,
        maxEntries: this.#maxCacheEntries,
        maxBytes: this.#maxCacheBytes
      },
      geometry: {
        artifactBuilds: this.#artifactBuilds,
        milliseconds: this.#exactMilliseconds
      }
    };
  }

  dispose(): void {
    this.#disposed = true;
    this.#cache.clear();
    this.#cacheBytes = 0;
    this.#exact = undefined;
    this.#checkpointPayloads = [];
  }

  #enqueue<T>(work: () => Promise<T>): Promise<T> {
    const promise = this.#queue.then(() => {
      this.#assertOpen();
      return work();
    });
    this.#queue = promise.then(
      () => undefined,
      () => undefined
    );
    return promise;
  }

  #assertOpen() {
    if (this.#disposed) throw new Error("CAD session is closed.");
  }

  async #validateCandidate(
    request: CadWorkerRequest
  ): Promise<CadBatchResponse> {
    const candidate = CadEngine.fromProject(request.project!);
    const response = candidate.executeBatch(request.batch);
    if (!response.ok) return response;
    if (request.batch.mode === "dryRun") {
      const committed = candidate.executeBatch({
        ...request.batch,
        mode: "commit",
        ...(request.batch.audit
          ? { audit: { ...request.batch.audit, intent: "commit" } }
          : {})
      });
      if (!committed.ok) return { ...committed, mode: "dryRun" };
    }
    try {
      await this.#evaluate(candidate, true);
      return response;
    } catch (cause) {
      const opIndex = Math.max(0, request.batch.ops.length - 1);
      const op = request.batch.ops[opIndex];
      const error: CadBatchValidationError = {
        code: "UNSUPPORTED_FEATURE_OPERATION",
        message: `Exact geometry rejected this batch: ${cause instanceof Error ? cause.message : String(cause)}`,
        opIndex,
        ...(op ? { op: op.op } : {}),
        path: `$.ops[${opIndex}]`,
        expected: "a valid exact result for every active body",
        received: "exact geometry preflight failed; source is unchanged"
      };
      return {
        ok: false,
        mode: request.batch.mode,
        error,
        errors: [error],
        createdIds: [],
        modifiedIds: [],
        deletedIds: [],
        warnings: []
      };
    }
  }

  async #refreshExact(): Promise<ExactState> {
    const epoch = this.engine.getSourceAuthorityEpoch();
    if (this.#exact?.epoch === epoch) return this.#exact;
    this.#exact = await this.#evaluate(this.engine, false);
    return this.#exact;
  }

  async #evaluate(engine: CadEngine, strict: boolean): Promise<ExactState> {
    const epoch = engine.getSourceAuthorityEpoch();
    const source = readDocumentSources(engine);
    const geometrySources = createDerivedGeometrySourcesFromDocument(
      source.document,
      source.features,
      source.faces,
      source.signatures,
      true
    );
    const resolutions = resolveCurrentExactBodies({
      document: source.document,
      bodies: source.bodies,
      features: source.features,
      geometrySources: removeConsumedDerivedGeometrySources(
        geometrySources,
        source.features
      ),
      artifactGeometrySources: geometrySources,
      sourceIdentitySignaturesByBodyId: source.signatures,
      checkpointPayloads: this.#checkpointPayloads
    });
    const active = new Set(
      source.bodies
        .filter((body) => !body.consumedByFeatureId)
        .map((body) => body.id)
    );
    const identity = createCadProjectSourceIdentity(engine.exportProject());
    const assertCurrent = () => {
      this.#assertOpen();
      if (engine.getSourceAuthorityEpoch() !== epoch)
        throw new Error("Source changed during exact evaluation.");
    };
    const artifacts: CurrentExactBodyArtifactEvidence[] = [];
    const projections = [];
    const derivedExactMetadata = [];
    for (const resolution of resolutions) {
      if (!active.has(resolution.bodyId)) continue;
      let failure: unknown;
      let artifact: CurrentExactBodyArtifactEvidence | undefined;
      if (resolution.status === "ready") {
        try {
          [artifact] = await buildCurrentExactBodyArtifacts({
            engine,
            resolutions: [resolution],
            runtime: this.#runtime,
            documentSourceIdentity: identity,
            units: source.document.units,
            assertCurrent
          });
        } catch (error) {
          failure = error;
        }
      }
      if (strict && !artifact) {
        throw (
          failure ??
          new Error(
            resolution.diagnostics.map(({ message }) => message).join(" ")
          )
        );
      }
      if (artifact && resolution.status === "ready") {
        artifacts.push(artifact);
        const metadata = createBodyTopologyDerivedExactMetadataSnapshot(
          {
            bodyId: artifact.bodyId,
            sourceKind: "exactBody",
            cacheKey: resolution.cacheKeySha256,
            status: "ready",
            metadata: {
              ...artifact.metadata,
              topologySnapshot: artifact.topologySnapshot
            },
            metrics: { objectId: artifact.bodyId, roundTripMs: 0 }
          },
          resolution.sourceIdentitySignature
        );
        if (metadata) derivedExactMetadata.push(metadata);
        const projection = createCurrentExactResultProjection({
          resolution,
          evidence: [
            {
              consumer: "metadata",
              required: true,
              status: "ready",
              sourceIdentitySignature: resolution.sourceIdentitySignature
            }
          ]
        });
        const shapePolicy =
          artifact.metadata.topologyCounts.solidCount === 1
            ? ("singleSolid" as const)
            : ("singleShapeOneOrMoreSolids" as const);
        projections.push({
          ...projection,
          shapePolicy,
          artifactEvidence: {
            bodyId: artifact.bodyId,
            sourceType: resolution.sourceType,
            documentSourceIdentity: identity,
            bodySourceIdentitySignature: artifact.bodySourceIdentitySignature,
            sourceGraphNodeCount: artifact.sourceGraphNodeCount,
            brepFormat: artifact.brepFormat,
            brepByteLength: artifact.brepByteLength,
            brepSha256: artifact.brepSha256,
            shapePolicy,
            topologySignature: artifact.topologySnapshot.signature
          }
        });
      } else {
        projections.push(
          createCurrentExactResultProjection({
            resolution: failure
              ? {
                  status: "failed",
                  bodyId: resolution.bodyId,
                  sourceType: resolution.sourceType,
                  diagnostics: [
                    {
                      code: "EXPORT_EXACT_ARTIFACT_FAILED",
                      status: "failed",
                      bodyId: resolution.bodyId,
                      message:
                        failure instanceof Error
                          ? failure.message
                          : String(failure)
                    }
                  ]
                }
              : resolution,
            evidence: []
          })
        );
      }
    }
    assertCurrent();
    return {
      epoch,
      resolutions,
      artifacts,
      evidence: {
        derivedExactMetadata,
        currentExactResults: toCadCurrentExactResults(projections)
      }
    };
  }

  #createExactHost(): ExactHost {
    const worker = createGeometryKernelWorker();
    return {
      getModelWorkSnapshot: () => ({
        generation: 0,
        stopped: this.#disposed,
        active: false,
        queuedCount: 0,
        cancelledUserKinds: []
      }),
      exactBodyArtifact: async (input) => {
        const key = [
          input.bodyId,
          input.bodySourceIdentitySignature,
          input.sourceCacheKeySha256,
          input.units
        ].join("\0");
        let artifact = this.#cache.get(key);
        const started = performance.now();
        if (artifact) {
          this.#cacheHits++;
          this.#cache.delete(key);
          this.#cache.set(key, artifact);
          artifact = {
            ...artifact,
            documentSourceIdentity: input.documentSourceIdentity
          };
        } else {
          const { executeGeometryKernelExactBodyDataArtifactRequest } =
            await import("@web-cad/geometry-kernel");
          const result =
            await executeGeometryKernelExactBodyDataArtifactRequest({
              ...input,
              version: "geometry-kernel.v1",
              op: "geometry.exactBodyArtifact"
            });
          if (!result.ok)
            throw new Error(`${result.error.code}: ${result.error.message}`);
          artifact = result.artifact;
          this.#artifactBuilds++;
          if (
            this.#maxCacheEntries > 0 &&
            artifact.brepByteLength <= this.#maxCacheBytes
          ) {
            this.#cache.set(key, artifact);
            this.#cacheBytes += artifact.brepByteLength;
            while (
              this.#cache.size > this.#maxCacheEntries ||
              this.#cacheBytes > this.#maxCacheBytes
            ) {
              const oldest = this.#cache.keys().next().value!;
              this.#cacheBytes -= this.#cache.get(oldest)!.brepByteLength;
              this.#cache.delete(oldest);
            }
          }
        }
        const elapsed = performance.now() - started;
        this.#exactMilliseconds += elapsed;
        return {
          artifact,
          metrics: { objectId: input.id, roundTripMs: elapsed },
          message: "OCCT exact artifact; no display mesh."
        };
      },
      executeExactStepExport: (request) => worker.execute(request),
      exactTopologyCheckpointPayload: async (input) => {
        const started = performance.now();
        const result = await worker.execute(
          createExactTopologyCheckpointPayloadWorkerRequest({
            id: input.id,
            checkpointId: input.checkpointId,
            bodyId: input.bodyId,
            source: input.source
          })
        );
        if (!result.response.ok) throw new Error(result.response.error.message);
        const elapsed = performance.now() - started;
        return {
          checkpointPayload: result.response.checkpointPayload,
          metrics: { objectId: input.id, roundTripMs: elapsed },
          message: "OCCT checkpoint."
        };
      }
    };
  }
}

export function createCadSession(options: CadSessionOptions = {}): CadSession {
  return new CadSession(options);
}

function readDocumentSources(engine: CadEngine) {
  const structure = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  const sketches = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.sketches" }
  });
  if (
    !structure.ok ||
    structure.query !== "project.structure" ||
    !sketches.ok ||
    sketches.query !== "project.sketches"
  ) {
    throw new Error("Unable to read document structure.");
  }
  const signatures = new Map<string, string>();
  const faces = new Map<string, CadGeneratedFaceReference>();
  for (const body of structure.bodies) {
    const topology = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: body.id }
    });
    if (topology.ok && topology.query === "body.topology")
      signatures.set(body.id, topology.topology.sourceIdentity.signature);
    const references = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.generatedReferences", bodyId: body.id }
    });
    if (references.ok && references.query === "body.generatedReferences") {
      for (const face of references.faces)
        faces.set(
          createGeneratedFaceReferenceKey(face.bodyId, face.stableId),
          face
        );
    }
  }
  return {
    document: engine.getDocument(),
    bodies: structure.bodies,
    features: structure.features,
    sketches: sketches.sketches,
    signatures,
    faces
  };
}

function requiresExactEvidence(query: string): boolean {
  return [
    "project.summary",
    "project.health",
    "project.exportReadiness",
    "project.exportExact",
    "project.extents",
    "body.topology",
    "body.topologyIdentity",
    "body.patternInstances",
    "body.massProperties"
  ].includes(query);
}

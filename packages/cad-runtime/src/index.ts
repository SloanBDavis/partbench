import {
  prepareIndependentOccurrence,
  checkpointFromArtifact
} from "./shared/independentOccurrence";
import { createProjectStepExportScope } from "./shared/projectStepAssembly";
import {
  AsyncCadCommandExecutor,
  CadEngine,
  createCadProjectSourceIdentity,
  sha256Hex,
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
  createStepImportWorkerRequest,
  createExactTopologyCheckpointPayloadWorkerRequest
} from "@web-cad/geometry-worker";
import {
  createProjectStepImportResolver,
  type ProjectStepImportRuntime
} from "./shared/projectStepImportResolver";
import { createProjectStepImportPayloadStore } from "./shared/projectStepImportPayloadStore";
import {
  parseSketchExchange,
  buildSketchExchangeOps,
  exportSketchExchange,
  type SketchExchangeUnit
} from "./sketchExchange";
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
> &
  ProjectStepImportRuntime;

interface ExactState {
  readonly epoch: number;
  readonly resolutions: readonly CurrentExactBodyResolution[];
  readonly artifacts: readonly CurrentExactBodyArtifactEvidence[];
  readonly evidence: CadOpsAgentCurrentExactEvidence;
}

class ExactBodyEvaluationError extends Error {
  constructor(
    readonly bodyId: string,
    readonly featureId: string | undefined,
    readonly sourceKey: string | undefined,
    cause: unknown
  ) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = "ExactBodyEvaluationError";
  }
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
  readonly #importPayloadStore = createProjectStepImportPayloadStore();
  #nextImport = 1;
  #preparedImport?: { readonly key: string; readonly payloadId: string };
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
    this.#executor = new AsyncCadCommandExecutor(
      this.engine,
      {
        execute: async (request) => ({
          id: request.id,
          response: await this.#validateCandidate(request)
        })
      },
      {
        stepImportResolver: createProjectStepImportResolver({
          getRuntime: () => this.#runtime,
          payloadStore: this.#importPayloadStore,
          onPrepared: (result) => {
            if (this.#disposed) return;
            const payloads = new Map(
              this.#checkpointPayloads.map((p) => [p.checkpointId, p])
            );
            for (const payload of result.checkpointPayloads ?? [])
              payloads.set(payload.checkpointId, payload);
            this.#checkpointPayloads = [...payloads.values()];
          }
        })
      }
    );
  }

  executeBatch(batch: CadBatch): Promise<CadAsyncBatchResponse> {
    return this.#enqueue(async () => {
      const epoch = this.engine.getSourceAuthorityEpoch();
      const previous = this.#checkpointPayloads;
      try {
        await this.#prepareCheckpointPayloads(batch);
        const response =
          await this.#executor.executeBatchAtSourceAuthorityEpoch(
            batch,
            epoch,
            () => !this.#disposed
          );
        this.#assertOpen();
        if (!response)
          throw new Error("Source changed before the batch could commit.");
        if (!response.ok || batch.mode === "dryRun")
          this.#checkpointPayloads = previous;
        return response;
      } catch (error) {
        this.#checkpointPayloads = this.#disposed ? [] : previous;
        throw error;
      }
    });
  }

  execute(request: CadOpsAgentRequest) {
    return this.#enqueue(async () => {
      const epoch = this.engine.getSourceAuthorityEpoch();
      const previous = this.#checkpointPayloads;
      try {
        await this.#prepareCheckpointPayloads(request.batch);
        const response = await executeCadOpsAgentRequestAsync(
          this.engine,
          this.#executor,
          request,
          epoch,
          () => !this.#disposed
        );
        this.#assertOpen();
        if (!response)
          throw new Error("Source changed before the batch could commit.");
        if (!response.ok || response.mode === "dryRun")
          this.#checkpointPayloads = previous;
        return response;
      } catch (error) {
        this.#checkpointPayloads = this.#disposed ? [] : previous;
        throw error;
      }
    });
  }

  async #prepareCheckpointPayloads(batch: CadBatch): Promise<void> {
    if (!Array.isArray(batch?.ops)) return;
    const requests = batch.ops.filter(
      (
        op
      ): op is Extract<
        CadBatch["ops"][number],
        { op: "topology.checkpoint.create" }
      > => op?.op === "topology.checkpoint.create"
    );
    if (!requests.length) return;
    const exact = await this.#refreshExact();
    this.#assertOpen();
    const staged = new Map(
      this.#checkpointPayloads.map((payload) => [payload.checkpointId, payload])
    );
    for (const op of requests) {
      const artifact = exact.artifacts.find(
        (candidate) => candidate.bodyId === op.bodyId
      );
      if (!artifact)
        throw new Error(
          `Checkpoint ${op.checkpointId} requires current exact geometry for ${op.bodyId}.`
        );
      // IDs may be reused after undo; replace only this prospective creation's
      // asset, and let the caller restore the prior map if the batch fails.
      staged.set(
        op.checkpointId,
        checkpointFromArtifact(
          artifact,
          op.checkpointId,
          op.bodyId,
          op.sourceFeatureId
        )
      );
    }
    this.#checkpointPayloads = [...staged.values()];
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
      this.#assertOpen();
      this.engine.loadProject(candidate.exportProject());
      this.#checkpointPayloads = createWcadTopologyCheckpointPayloadInputCache(
        read.checkpointPayloads
      );
      this.#exact = undefined;
      this.#importPayloadStore.clear();
      this.#preparedImport = undefined;
      return { sourceIdentity: read.sourceIdentity };
    });
  }

  importFile(input: {
    readonly bytes: Uint8Array;
    readonly fileName: string;
    readonly format: "step" | "dxf" | "svg";
    readonly mode?: "commit" | "dryRun";
    readonly unit?: SketchExchangeUnit;
    readonly scale?: number;
  }): Promise<Record<string, unknown>> {
    return this.#enqueue(async () => {
      const epoch = this.engine.getSourceAuthorityEpoch();
      if (!(input.bytes instanceof Uint8Array) || input.bytes.byteLength === 0)
        throw new Error("Import requires a nonempty file.");
      if (input.bytes.byteLength > 256 * 1024 * 1024)
        throw new Error("Import file exceeds the 256 MiB limit.");
      if (!["step", "dxf", "svg"].includes(input.format))
        throw new Error("Supported import formats are STEP, DXF, and SVG.");
      if (
        input.mode !== undefined &&
        input.mode !== "commit" &&
        input.mode !== "dryRun"
      )
        throw new Error("Import mode must be commit or dryRun.");
      if (
        input.format === "step" &&
        (input.unit !== undefined || input.scale !== undefined)
      )
        throw new Error(
          "STEP units come from the file; unit and scale apply to sketches."
        );
      const previousPayloads = this.#checkpointPayloads;
      const previousAssemblies = new Set(
        (this.engine.createSnapshot().assemblies ?? []).map((a) => a.id)
      );
      let payloadId = `file-import-${this.#nextImport++}`;
      const mode = input.mode ?? "commit";
      let ops: CadBatch["ops"];
      let notices: readonly string[] = [];
      if (input.format === "step") {
        const key = `${sha256Hex(input.bytes)}:${input.fileName}:${this.engine.getDocument().units}`;
        if (this.#preparedImport?.key === key)
          payloadId = this.#preparedImport.payloadId;
        else {
          // Retain at most one prepared file across dry-run and commit. A new
          // file releases the previous transient preparation; document/history
          // checkpoint assets have separate ownership.
          this.#importPayloadStore.clear();
          this.#importPayloadStore.putPayload(payloadId, input.bytes);
          this.#preparedImport = { key, payloadId };
        }
        ops = [
          {
            op: "project.importStep",
            sourceFileName: input.fileName,
            sourceFormat: "step",
            payloadRef: {
              kind: "transient",
              payloadId,
              byteLength: input.bytes.byteLength
            }
          }
        ];
      } else {
        const recipe = parseSketchExchange(
          input.format,
          new TextDecoder("utf-8", { fatal: true }).decode(input.bytes),
          {
            ...(input.unit !== undefined ? { unit: input.unit } : {}),
            ...(input.scale !== undefined ? { scale: input.scale } : {})
          }
        );
        // An imported native document may already contain exchange IDs. The
        // prefix is allocated against the current document, then all curves are
        // committed in one normal transaction.
        const existing = JSON.stringify(this.engine.createSnapshot());
        let prefix = `exchange_${this.#nextImport++}`;
        while (existing.includes(prefix))
          prefix = `exchange_${this.#nextImport++}`;
        ops = buildSketchExchangeOps(recipe, {
          idPrefix: prefix,
          targetUnits: this.engine.getDocument().units
        });
        notices = recipe.notices;
      }
      try {
        const response =
          await this.#executor.executeBatchAtSourceAuthorityEpoch(
            {
              version: "cadops.v1",
              mode,
              ops
            },
            epoch,
            () => !this.#disposed
          );
        this.#assertOpen();
        if (!response)
          throw new Error("Source changed before import could commit.");
        if (!response.ok)
          throw new Error(`${response.error.code}: ${response.error.message}`);
        if (mode === "dryRun")
          this.#checkpointPayloads = this.#disposed ? [] : previousPayloads;
        return {
          ok: true,
          format: input.format,
          mode,
          createdBodyIds: response.createdBodyIds ?? [],
          createdSketchIds: response.createdSketchIds ?? [],
          createdFeatureIds: response.createdFeatureIds ?? [],
          createdAssemblyIds:
            mode === "commit"
              ? (this.engine.createSnapshot().assemblies ?? [])
                  .filter((a) => !previousAssemblies.has(a.id))
                  .map((a) => a.id)
              : [],
          diagnostics: response.importedStepDiagnostics ?? [],
          warnings: [...response.warnings, ...notices],
          sourceIdentity: createCadProjectSourceIdentity(
            this.engine.exportProject()
          )
        };
      } catch (error) {
        this.#checkpointPayloads = this.#disposed ? [] : previousPayloads;
        this.#importPayloadStore.deletePayload(payloadId);
        if (this.#preparedImport?.payloadId === payloadId)
          this.#preparedImport = undefined;
        throw error;
      }
    });
  }

  makeOccurrenceIndependent(input: {
    readonly rootAssemblyId: string;
    readonly instancePath: readonly string[];
  }) {
    return this.#enqueue(async () => {
      const epoch = this.engine.getSourceAuthorityEpoch();
      const exact = await this.#refreshExact();
      const { resolveAssemblyOccurrence } = await import("@web-cad/cad-core");
      const selected = resolveAssemblyOccurrence(
        this.engine.createSnapshot().assemblies ?? [],
        input.rootAssemblyId,
        input.instancePath
      );
      if (!selected || selected.instance.definition.kind !== "body")
        throw new Error("Select a part occurrence.");
      const bodyId = selected.instance.definition.bodyId;
      const artifact = exact.artifacts.find((a) => a.bodyId === bodyId);
      if (!artifact)
        throw new Error("Selected occurrence has no current exact body.");
      const prepared = prepareIndependentOccurrence({
        ...input,
        engine: this.engine,
        artifact
      });
      const previous = this.#checkpointPayloads;
      this.#checkpointPayloads = [
        ...new Map(
          [...previous, ...prepared.checkpointPayloads].map((payload) => [
            payload.checkpointId,
            payload
          ])
        ).values()
      ];
      try {
        const response =
          await this.#executor.executeBatchAtSourceAuthorityEpoch(
            {
              version: "cadops.v1",
              mode: "commit",
              ops: prepared.ops
            },
            epoch,
            () => !this.#disposed
          );
        this.#assertOpen();
        if (!response)
          throw new Error(
            "Source changed before independent copy could commit."
          );
        if (!response.ok)
          throw new Error(`${response.error.code}: ${response.error.message}`);
        return {
          ok: true,
          bodyId: prepared.bodyId,
          featureId: prepared.featureId,
          rootAssemblyId: prepared.rootAssemblyId,
          instancePath: prepared.instancePath
        };
      } catch (error) {
        this.#checkpointPayloads = this.#disposed ? [] : previous;
        throw error;
      }
    });
  }

  exportSketches(options: {
    readonly format: "dxf" | "svg";
    readonly sketchIds?: readonly string[];
  }) {
    return this.#enqueue(async () => {
      const snapshot = this.engine.createSnapshot();
      const selected = options.sketchIds;
      if (
        selected &&
        (selected.length === 0 ||
          new Set(selected).size !== selected.length ||
          selected.some(
            (id) => !snapshot.sketches.some((sketch) => sketch.id === id)
          ))
      )
        throw new Error("Select distinct existing sketches for export.");
      const exported = exportSketchExchange(
        options.format,
        selected
          ? snapshot.sketches.filter((sketch) => selected.includes(sketch.id))
          : snapshot.sketches,
        { sourceUnits: this.engine.getDocument().units }
      );
      return {
        format: exported.format,
        unit: exported.unit,
        curveCount: exported.curveCount,
        notices: exported.notices,
        bytes: new TextEncoder().encode(exported.text)
      };
    });
  }

  exportStep(
    options: {
      readonly bodyIds?: readonly string[];
      readonly assemblyIds?: readonly string[];
    } = {}
  ) {
    return this.#enqueue(async () => {
      const scope = createProjectStepExportScope(this.engine, options);
      const exact = await this.#refreshExact();
      const query = this.engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "project.exportExact",
          format: "step",
          ...(scope.bodyIds ? { bodyIds: scope.bodyIds } : {}),
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
        existingArtifacts: exact.artifacts,
        assembly: scope.assembly
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
        stepImport: true,
        stepExport: true,
        sketchExchange: ["dxf", "svg"],
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
    this.#importPayloadStore.clear();
    this.#preparedImport = undefined;
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
    // This worker belongs to this serialized live session. Re-importing its own
    // project would replay the entire design history on every joint-angle edit.
    const candidate = this.engine.forkForValidation();
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
      const bodyFailure =
        cause instanceof ExactBodyEvaluationError ? cause : undefined;
      const opIndex = bodyFailure
        ? findBodySourceOperation(
            request,
            bodyFailure.bodyId,
            bodyFailure.sourceKey,
            this.#checkpointPayloads
          )
        : undefined;
      const op = opIndex === undefined ? undefined : request.batch.ops[opIndex];
      const error: CadBatchValidationError = {
        code: "UNSUPPORTED_FEATURE_OPERATION",
        message: `Exact geometry rejected this batch: ${cause instanceof Error ? cause.message : String(cause)}`,
        ...(bodyFailure
          ? { bodyId: bodyFailure.bodyId, featureId: bodyFailure.featureId }
          : {}),
        ...(opIndex !== undefined && op
          ? { opIndex, op: op.op, path: `$.ops[${opIndex}]` }
          : {}),
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
    const { source, resolutions } = resolveDocumentExactSources(
      engine,
      this.#checkpointPayloads
    );
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
            assertCurrent,
            existingArtifacts: this.#exact?.artifacts
          });
        } catch (error) {
          failure = error;
        }
      }
      if (strict && !artifact) {
        throw new ExactBodyEvaluationError(
          resolution.bodyId,
          source.bodies.find((body) => body.id === resolution.bodyId)
            ?.featureId,
          exactSourceKey(resolution),
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
      importStep: async (input) => {
        const result = await worker.execute(
          createStepImportWorkerRequest(input)
        );
        if (!result.response.ok)
          throw new Error(
            `${result.response.error.code}: ${result.response.error.message}`
          );
        return result.response;
      },
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
          this.#assertOpen();
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

/**
 * Locate the last operation that changed the failing body's source, including
 * upstream edits. Inspect at most 16 prefixes, backwards from the known failed
 * result; diagnostic work must not become a quadratic replay of a long batch.
 * No exact rebuild or live mutation. If attribution exceeds that budget, or a
 * prefix is independently invalid, report body/feature without a guessed index.
 */
function findBodySourceOperation(
  request: CadWorkerRequest,
  bodyId: string,
  failedSourceKey: string | undefined,
  checkpointPayloads: readonly WcadTopologyCheckpointPayloadInput[]
): number | undefined {
  const signature = (engine: CadEngine) => {
    const result = resolveDocumentExactSources(
      engine,
      checkpointPayloads
    ).resolutions.find((resolution) => resolution.bodyId === bodyId);
    // The artifact cache key covers the entire dependency graph; a body's
    // local topology signature alone misses edits to its upstream features.
    return exactSourceKey(result);
  };
  const stop = Math.max(0, request.batch.ops.length - 16);
  for (let index = request.batch.ops.length - 1; index >= stop; index--) {
    const prefix = CadEngine.fromProject(request.project!);
    const response =
      index === 0
        ? { ok: true }
        : prefix.executeBatch({
            ...request.batch,
            mode: "commit",
            ops: request.batch.ops.slice(0, index),
            ...(request.batch.audit
              ? { audit: { ...request.batch.audit, intent: "commit" } }
              : {})
          });
    if (!response.ok) return undefined;
    if (signature(prefix) !== failedSourceKey) return index;
  }
  return undefined;
}

function exactSourceKey(resolution: CurrentExactBodyResolution | undefined) {
  return resolution?.status === "ready"
    ? resolution.cacheKeySha256
    : JSON.stringify(resolution);
}

function resolveDocumentExactSources(
  engine: CadEngine,
  checkpointPayloads: readonly WcadTopologyCheckpointPayloadInput[]
) {
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
    checkpointPayloads
  });
  return { source, resolutions };
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
    "topology.anchorCreationPlan",
    "topology.anchorRepairPlan",
    "body.topology",
    "body.topologyIdentity",
    "body.patternInstances",
    "body.massProperties"
  ].includes(query);
}

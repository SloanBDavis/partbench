import type {
  CadAxisAlignedBounds,
  CadBodyDerivedExactMetadataSnapshot,
  CadBodyExactMetadataDiagnostic,
  CadBodyExactMetadataSnapshot
} from "@web-cad/cad-protocol";

import type {
  DerivedBooleanExtrudeGeometrySource,
  DerivedEdgeFinishGeometrySource,
  DerivedExtrudeGeometrySource,
  DerivedGeometrySource,
  DerivedHoleGeometrySource,
  DerivedRevolveGeometrySource,
  DerivedSweepGeometrySource
} from "./derivedGeometry";
import { createDerivedGeometryCacheKey } from "./derivedGeometry";
import {
  createDerivedGeometryErrorDetails,
  type DerivedGeometryBooleanExtrudeInputSource,
  type DerivedGeometryBooleanExtrudePrimitiveInputSource,
  type DerivedExactBodyMetadata,
  type DerivedExactMetadataMetrics,
  type DerivedExactMetadataResult,
  type DerivedGeometryRuntime
} from "./derivedGeometryRuntime";

export type DerivedExactMetadataStatusKind =
  | "unsupported"
  | "pending"
  | "ready"
  | "error";

export type DerivedExactMetadataSource =
  | DerivedExtrudeGeometrySource
  | DerivedBooleanExtrudeGeometrySource
  | DerivedRevolveGeometrySource
  | DerivedHoleGeometrySource
  | DerivedEdgeFinishGeometrySource
  | DerivedSweepGeometrySource;

export type DerivedExactMetadataEntry =
  | DerivedExactMetadataUnsupportedEntry
  | DerivedExactMetadataPendingEntry
  | DerivedExactMetadataReadyEntry
  | DerivedExactMetadataErrorEntry;

export interface DerivedExactMetadataBaseEntry {
  readonly bodyId: string;
  readonly sourceKind: DerivedExactMetadataSource["kind"];
  readonly cacheKey: string;
  readonly status: DerivedExactMetadataStatusKind;
}

export interface DerivedExactMetadataUnsupportedEntry extends DerivedExactMetadataBaseEntry {
  readonly status: "unsupported";
  readonly message: string;
}

export interface DerivedExactMetadataPendingEntry extends DerivedExactMetadataBaseEntry {
  readonly status: "pending";
}

export interface DerivedExactMetadataReadyEntry extends DerivedExactMetadataBaseEntry {
  readonly status: "ready";
  readonly metadata: DerivedExactBodyMetadata;
  readonly metrics: DerivedExactMetadataMetrics;
}

export interface DerivedExactMetadataErrorEntry extends DerivedExactMetadataBaseEntry {
  readonly status: "error";
  readonly error: ReturnType<typeof createDerivedGeometryErrorDetails>;
}

export interface DerivedExactMetadataSnapshot {
  readonly entries: readonly DerivedExactMetadataEntry[];
  readonly supportedCount: number;
  readonly pendingCount: number;
  readonly readyCount: number;
  readonly errorCount: number;
}

export interface DerivedExactMetadataServiceOptions {
  readonly runtime: DerivedGeometryRuntime;
  readonly onChange: (snapshot: DerivedExactMetadataSnapshot) => void;
}

interface ActiveDerivedExactMetadataRequest {
  readonly bodyId: string;
  readonly cacheKey: string;
  readonly version: number;
}

export class DerivedExactMetadataService {
  readonly #runtime: DerivedGeometryRuntime;
  readonly #onChange: (snapshot: DerivedExactMetadataSnapshot) => void;
  readonly #entries = new Map<string, DerivedExactMetadataEntry>();
  readonly #requestVersions = new Map<string, number>();
  #sourceOrder: readonly string[] = [];
  #nextRequestVersion = 0;
  #disposed = false;

  constructor(options: DerivedExactMetadataServiceOptions) {
    this.#runtime = options.runtime;
    this.#onChange = options.onChange;
  }

  getSnapshot(): DerivedExactMetadataSnapshot {
    return createDerivedExactMetadataSnapshot(this.#entries, this.#sourceOrder);
  }

  reconcile(sources: readonly DerivedGeometrySource[]): void {
    if (this.#disposed) {
      return;
    }

    const exactSources = sources.filter(isExactMetadataSource);
    const nextSourceOrder = exactSources.map((source) => source.id);
    let changed = !isSameStringArray(this.#sourceOrder, nextSourceOrder);
    const nextIds = new Set<string>();
    this.#sourceOrder = nextSourceOrder;

    for (const source of exactSources) {
      nextIds.add(source.id);
      const cacheKey = createDerivedExactMetadataCacheKey(source);
      const existing = this.#entries.get(source.id);
      const unsupportedMessage =
        getUnsupportedExactMetadataSourceMessage(source);

      if (unsupportedMessage) {
        this.#requestVersions.delete(source.id);
        const unsupported: DerivedExactMetadataUnsupportedEntry = {
          bodyId: source.id,
          sourceKind: source.kind,
          cacheKey,
          status: "unsupported",
          message: unsupportedMessage
        };

        if (!isSameEntry(existing, unsupported)) {
          this.#entries.set(source.id, unsupported);
          changed = true;
        }

        continue;
      }

      if (existing?.cacheKey === cacheKey) {
        continue;
      }

      const request = this.#beginRequest(source);
      this.#entries.set(source.id, createPendingEntry(source, cacheKey));
      changed = true;
      void this.#deriveSource(source, request);
    }

    for (const bodyId of this.#entries.keys()) {
      if (!nextIds.has(bodyId)) {
        this.#entries.delete(bodyId);
        this.#requestVersions.delete(bodyId);
        changed = true;
      }
    }

    if (changed) {
      this.#emitChange();
    }
  }

  refresh(sources: readonly DerivedGeometrySource[]): void {
    if (this.#disposed) {
      return;
    }

    this.#clearState();
    this.#emitChange();
    this.reconcile(sources);
  }

  dispose(): void {
    this.#disposed = true;
    this.#clearState();
  }

  #beginRequest(
    source: DerivedExactMetadataSource
  ): ActiveDerivedExactMetadataRequest {
    this.#nextRequestVersion += 1;
    const request = {
      bodyId: source.id,
      cacheKey: createDerivedExactMetadataCacheKey(source),
      version: this.#nextRequestVersion
    };

    this.#requestVersions.set(request.bodyId, request.version);

    return request;
  }

  async #deriveSource(
    source: DerivedExactMetadataSource,
    request: ActiveDerivedExactMetadataRequest
  ): Promise<void> {
    try {
      const result = await this.#runtime.exactBodyMetadata(
        createExactMetadataRuntimeInput(source)
      );

      this.#applyReadyResult(source, request, result);
    } catch (error) {
      this.#applyErrorResult(source, request, error);
    }
  }

  #applyReadyResult(
    source: DerivedExactMetadataSource,
    request: ActiveDerivedExactMetadataRequest,
    result: DerivedExactMetadataResult
  ): void {
    if (!this.#canApplyResult(request)) {
      return;
    }

    this.#entries.set(source.id, {
      bodyId: source.id,
      sourceKind: source.kind,
      cacheKey: request.cacheKey,
      status: "ready",
      metadata: result.metadata,
      metrics: result.metrics
    });
    this.#requestVersions.delete(source.id);
    this.#emitChange();
  }

  #applyErrorResult(
    source: DerivedExactMetadataSource,
    request: ActiveDerivedExactMetadataRequest,
    error: unknown
  ): void {
    if (!this.#canApplyResult(request)) {
      return;
    }

    this.#entries.set(source.id, {
      bodyId: source.id,
      sourceKind: source.kind,
      cacheKey: request.cacheKey,
      status: "error",
      error: createDerivedGeometryErrorDetails(error)
    });
    this.#requestVersions.delete(source.id);
    this.#emitChange();
  }

  #canApplyResult(request: ActiveDerivedExactMetadataRequest): boolean {
    return (
      !this.#disposed &&
      this.#entries.get(request.bodyId)?.cacheKey === request.cacheKey &&
      this.#requestVersions.get(request.bodyId) === request.version
    );
  }

  #clearState(): void {
    this.#entries.clear();
    this.#requestVersions.clear();
    this.#sourceOrder = [];
  }

  #emitChange(): void {
    this.#onChange(this.getSnapshot());
  }
}

export function createEmptyDerivedExactMetadataSnapshot(): DerivedExactMetadataSnapshot {
  return {
    entries: [],
    supportedCount: 0,
    pendingCount: 0,
    readyCount: 0,
    errorCount: 0
  };
}

export function createDerivedExactMetadataCacheKey(
  source: DerivedExactMetadataSource
): string {
  return JSON.stringify({
    kind: "exactMetadata",
    source: createDerivedGeometryCacheKey(source)
  });
}

export function getDerivedExactMetadataEntryForBody(
  snapshot: DerivedExactMetadataSnapshot,
  bodyId: string | undefined
): DerivedExactMetadataEntry | undefined {
  if (!bodyId) {
    return undefined;
  }

  return snapshot.entries.find((entry) => entry.bodyId === bodyId);
}

export function createBodyTopologyDerivedExactMetadataSnapshot(
  entry: DerivedExactMetadataEntry | undefined,
  sourceIdentitySignature: string
): CadBodyDerivedExactMetadataSnapshot | undefined {
  if (!entry || entry.status === "pending") {
    return undefined;
  }

  if (entry.status === "ready") {
    return {
      bodyId: entry.bodyId,
      sourceIdentitySignature,
      status: "ready",
      metadata: createCadExactMetadata(entry.metadata)
    };
  }

  if (entry.status === "unsupported") {
    return {
      bodyId: entry.bodyId,
      sourceIdentitySignature,
      status: "unsupported",
      error: {
        code: "UNSUPPORTED_EXACT_METADATA_SOURCE",
        message: entry.message
      }
    };
  }

  return {
    bodyId: entry.bodyId,
    sourceIdentitySignature,
    status:
      entry.error.code === "UNAVAILABLE_BINDING"
        ? "unavailable-binding"
        : "kernel-failed",
    error: {
      code: entry.error.code,
      message: entry.error.message
    }
  };
}

export function createProjectExtentsDerivedExactMetadataSnapshots(
  snapshot: DerivedExactMetadataSnapshot,
  sourceIdentitySignaturesByBodyId: ReadonlyMap<string, string>
): readonly CadBodyDerivedExactMetadataSnapshot[] {
  return createProjectQueryDerivedExactMetadataSnapshots(
    snapshot,
    sourceIdentitySignaturesByBodyId
  );
}

export function createProjectQueryDerivedExactMetadataSnapshots(
  snapshot: DerivedExactMetadataSnapshot,
  sourceIdentitySignaturesByBodyId: ReadonlyMap<string, string>
): readonly CadBodyDerivedExactMetadataSnapshot[] {
  return snapshot.entries
    .map((entry) => {
      const sourceIdentitySignature = sourceIdentitySignaturesByBodyId.get(
        entry.bodyId
      );

      return sourceIdentitySignature
        ? createBodyTopologyDerivedExactMetadataSnapshot(
            entry,
            sourceIdentitySignature
          )
        : undefined;
    })
    .filter(
      (entry): entry is CadBodyDerivedExactMetadataSnapshot =>
        entry !== undefined
    );
}

export function formatDerivedExactMetadataEntryStatus(
  entry: DerivedExactMetadataEntry | undefined
): string | undefined {
  if (!entry) {
    return undefined;
  }

  switch (entry.status) {
    case "pending":
      return "Pending";
    case "ready":
      return "Ready";
    case "unsupported":
      return "Unsupported";
    case "error":
      return entry.error.code === "UNAVAILABLE_BINDING"
        ? "Binding unavailable"
        : "Kernel failed";
  }
}

export function createExactMetadataRuntimeInput(
  source: DerivedExactMetadataSource
): Parameters<DerivedGeometryRuntime["exactBodyMetadata"]>[0] {
  if (source.kind === "extrude") {
    return {
      id: source.id,
      source: {
        kind: "extrude",
        sketchPlane: source.sketchPlane,
        profile: source.profile,
        depth: source.depth,
        side: source.side,
        ...(source.placementFrame
          ? { placementFrame: source.placementFrame }
          : {})
      }
    };
  }

  if (source.kind === "revolve") {
    return {
      id: source.id,
      source: {
        kind: "revolve",
        sketchPlane: source.sketchPlane,
        profile: source.profile,
        axis: source.axis,
        angleDegrees: source.angleDegrees,
        ...(source.placementFrame
          ? { placementFrame: source.placementFrame }
          : {})
      }
    };
  }

  if (source.kind === "sweep") {
    return {
      id: source.id,
      source: {
        kind: "sweep",
        profile: source.profile,
        pathSegments: source.pathSegments
      }
    };
  }

  if (source.kind === "hole") {
    return {
      id: source.id,
      source: {
        kind: "hole",
        target: createExactMetadataBooleanRuntimeSource(source.target),
        tool: {
          sketchPlane: source.tool.sketchPlane,
          circle: source.tool.circle,
          depthMode: source.tool.depthMode,
          depth: source.tool.depth,
          direction: source.tool.direction,
          ...(source.tool.placementFrame
            ? { placementFrame: source.tool.placementFrame }
            : {})
        }
      }
    };
  }

  if (source.kind === "edgeFinish") {
    const target = createExactMetadataBooleanRuntimeSource(source.target);

    return {
      id: source.id,
      source:
        source.operation === "chamfer"
          ? {
              kind: "edgeFinish",
              operation: source.operation,
              target,
              edgeStableId: source.edgeStableId,
              distance: source.distance
            }
          : {
              kind: "edgeFinish",
              operation: source.operation,
              target,
              edgeStableId: source.edgeStableId,
              radius: source.radius
            }
    };
  }

  return {
    id: source.id,
    source: {
      kind: "booleanExtrudes",
      operation: source.operation,
      target: createExactMetadataBooleanRuntimeSource(source.target),
      tool: createExactMetadataPrimitiveBooleanRuntimeSource(source.tool)
    }
  };
}

function createExactMetadataBooleanRuntimeSource(
  source: DerivedExtrudeGeometrySource | DerivedBooleanExtrudeGeometrySource
): DerivedGeometryBooleanExtrudeInputSource {
  if (source.kind === "extrudeBoolean") {
    return {
      kind: "booleanExtrudes",
      operation: source.operation,
      target: createExactMetadataBooleanRuntimeSource(source.target),
      tool: createExactMetadataPrimitiveBooleanRuntimeSource(source.tool)
    };
  }

  return createExactMetadataPrimitiveBooleanRuntimeSource(source);
}

function createExactMetadataPrimitiveBooleanRuntimeSource(
  source: DerivedExtrudeGeometrySource
): DerivedGeometryBooleanExtrudePrimitiveInputSource {
  return {
    sketchPlane: source.sketchPlane,
    profile: source.profile,
    depth: source.depth,
    side: source.side,
    ...(source.placementFrame ? { placementFrame: source.placementFrame } : {})
  };
}

function createCadExactMetadata(
  metadata: DerivedExactBodyMetadata
): Omit<CadBodyExactMetadataSnapshot, "status"> {
  return {
    source: "kernel-derived",
    confidence: "kernel-derived",
    bounds: createCadBounds(metadata.bounds),
    volume: metadata.volume,
    surfaceArea: metadata.surfaceArea,
    centroid: metadata.centroid,
    topologyCounts: metadata.topologyCounts,
    diagnostics: metadata.diagnostics.map(createCadExactMetadataDiagnostic)
  };
}

function createCadBounds(
  bounds: DerivedExactBodyMetadata["bounds"]
): CadAxisAlignedBounds {
  const size = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2]
  ] as const;

  return {
    min: bounds.min,
    max: bounds.max,
    size,
    center: [
      (bounds.min[0] + bounds.max[0]) / 2,
      (bounds.min[1] + bounds.max[1]) / 2,
      (bounds.min[2] + bounds.max[2]) / 2
    ] as const
  };
}

function createCadExactMetadataDiagnostic(
  diagnostic: DerivedExactBodyMetadata["diagnostics"][number]
): CadBodyExactMetadataDiagnostic {
  return {
    code: diagnostic.code,
    message: diagnostic.message
  };
}

function createPendingEntry(
  source: DerivedExactMetadataSource,
  cacheKey: string
): DerivedExactMetadataPendingEntry {
  return {
    bodyId: source.id,
    sourceKind: source.kind,
    cacheKey,
    status: "pending"
  };
}

function isExactMetadataSource(
  source: DerivedGeometrySource
): source is DerivedExactMetadataSource {
  return (
    source.kind === "extrude" ||
    source.kind === "extrudeBoolean" ||
    source.kind === "revolve" ||
    source.kind === "hole" ||
    source.kind === "edgeFinish" ||
    source.kind === "sweep"
  );
}

function getUnsupportedExactMetadataSourceMessage(
  source: DerivedExactMetadataSource
): string | undefined {
  if (source.kind === "extrude") {
    return source.placementError;
  }

  if (source.kind === "revolve") {
    return source.placementError;
  }

  if (source.kind === "sweep") {
    return source.placementError;
  }

  if (source.kind === "hole") {
    if (source.placementError) {
      return source.placementError;
    }

    const targetProfileKind = getExactBooleanSourceProfileKind(source.target);

    if (targetProfileKind !== "rectangle" && targetProfileKind !== "circle") {
      return "Exact metadata for holes currently supports rectangle or circle target extrudes only.";
    }

    if (source.tool.circle.kind !== "circle") {
      return "Exact metadata for holes currently supports circular sketch tools only.";
    }

    return undefined;
  }

  if (source.kind === "edgeFinish") {
    if (source.placementError) {
      return source.placementError;
    }

    const edgeReference = parseGeneratedRectangleEdgeStableId(
      source.edgeStableId
    );

    if (!edgeReference) {
      return "Exact metadata for edge finishing currently supports generated rectangle edge references only.";
    }

    if (edgeReference.bodyId !== source.target.id) {
      return "Exact metadata for edge finishing requires the selected edge to belong to the target body.";
    }

    const finishTarget = getExactMetadataEdgeFinishProfileSource(
      source.target,
      edgeReference.role
    );

    if (!finishTarget) {
      return "Exact metadata for edge finishing currently supports rectangle source edges and rectangle cut-wall result edges only.";
    }

    const scalar =
      source.operation === "chamfer" ? source.distance : source.radius;
    const scalarLabel = source.operation === "chamfer" ? "distance" : "radius";

    if (!Number.isFinite(scalar) || scalar <= 0) {
      return `Exact metadata edge-finish ${scalarLabel} must be a positive finite number.`;
    }

    return undefined;
  }

  if (source.placementError) {
    return source.placementError;
  }

  const targetProfileKind = getExactBooleanSourceProfileKind(source.target);

  if (
    source.operation === "add" &&
    targetProfileKind !== "rectangle" &&
    targetProfileKind !== "circle"
  ) {
    return "Exact metadata for add currently supports rectangle or circle target extrudes only.";
  }

  if (
    source.operation === "cut" &&
    targetProfileKind !== "rectangle" &&
    targetProfileKind !== "circle"
  ) {
    return "Exact metadata for cut currently supports rectangle or circle target extrudes only.";
  }

  return undefined;
}

function getExactBooleanSourceProfileKind(
  source: DerivedExtrudeGeometrySource | DerivedBooleanExtrudeGeometrySource
): DerivedExtrudeGeometrySource["profile"]["kind"] {
  return source.kind === "extrudeBoolean"
    ? getExactBooleanSourceProfileKind(source.target)
    : source.profile.kind;
}

function parseGeneratedRectangleEdgeStableId(
  stableId: string
): { readonly bodyId: string; readonly role: string } | undefined {
  const capEdge = stableId.match(
    /^generated:edge:([^:]+):(start|end):(uMin|uMax|vMin|vMax)$/
  );

  if (capEdge) {
    return { bodyId: capEdge[1], role: `${capEdge[2]}:${capEdge[3]}` };
  }

  const longitudinalEdge = stableId.match(
    /^generated:edge:([^:]+):longitudinal:(uMin|uMax):(vMin|vMax)$/
  );

  if (longitudinalEdge) {
    return {
      bodyId: longitudinalEdge[1],
      role: `longitudinal:${longitudinalEdge[2]}:${longitudinalEdge[3]}`
    };
  }

  return undefined;
}

function getExactMetadataEdgeFinishProfileSource(
  target: DerivedExtrudeGeometrySource | DerivedBooleanExtrudeGeometrySource,
  role: string
): DerivedExtrudeGeometrySource | undefined {
  if (target.kind === "extrude") {
    return target.profile.kind === "rectangle" ? target : undefined;
  }

  if (
    target.operation === "cut" &&
    role.startsWith("longitudinal:") &&
    target.tool.profile.kind === "rectangle"
  ) {
    return target.tool;
  }

  return undefined;
}

function createDerivedExactMetadataSnapshot(
  entries: ReadonlyMap<string, DerivedExactMetadataEntry>,
  sourceOrder: readonly string[]
): DerivedExactMetadataSnapshot {
  const orderedEntries = sourceOrder
    .map((sourceId) => entries.get(sourceId))
    .filter((entry): entry is DerivedExactMetadataEntry => Boolean(entry));

  return {
    entries: orderedEntries,
    supportedCount: orderedEntries.filter(
      (entry) => entry.status !== "unsupported"
    ).length,
    pendingCount: orderedEntries.filter((entry) => entry.status === "pending")
      .length,
    readyCount: orderedEntries.filter((entry) => entry.status === "ready")
      .length,
    errorCount: orderedEntries.filter((entry) => entry.status === "error")
      .length
  };
}

function isSameEntry(
  left: DerivedExactMetadataEntry | undefined,
  right: DerivedExactMetadataEntry
): boolean {
  return (
    left?.bodyId === right.bodyId &&
    left.sourceKind === right.sourceKind &&
    left.cacheKey === right.cacheKey &&
    left.status === right.status
  );
}

function isSameStringArray(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

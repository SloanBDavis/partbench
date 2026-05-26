import type {
  DerivedBooleanExtrudeGeometrySource,
  DerivedExtrudeGeometrySource,
  DerivedGeometrySource
} from "./derivedGeometry";
import { createDerivedGeometryCacheKey } from "./derivedGeometry";
import {
  createDerivedGeometryErrorDetails,
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
  | DerivedBooleanExtrudeGeometrySource;

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

  return {
    id: source.id,
    source: {
      kind: "booleanExtrudes",
      operation: source.operation,
      target: {
        sketchPlane: source.target.sketchPlane,
        profile: source.target.profile,
        depth: source.target.depth,
        side: source.target.side,
        ...(source.target.placementFrame
          ? { placementFrame: source.target.placementFrame }
          : {})
      },
      tool: {
        sketchPlane: source.tool.sketchPlane,
        profile: source.tool.profile,
        depth: source.tool.depth,
        side: source.tool.side,
        ...(source.tool.placementFrame
          ? { placementFrame: source.tool.placementFrame }
          : {})
      }
    }
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
  return source.kind === "extrude" || source.kind === "extrudeBoolean";
}

function getUnsupportedExactMetadataSourceMessage(
  source: DerivedExactMetadataSource
): string | undefined {
  if (source.kind === "extrude") {
    return source.placementError;
  }

  if (source.placementError) {
    return source.placementError;
  }

  if (source.tool.profile.kind !== "rectangle") {
    return "Exact metadata currently supports rectangle tool boolean extrudes only.";
  }

  if (
    source.operation === "add" &&
    source.target.profile.kind !== "rectangle"
  ) {
    return "Exact metadata for add currently supports rectangle target extrudes only.";
  }

  if (
    source.operation === "cut" &&
    source.target.profile.kind !== "rectangle" &&
    source.target.profile.kind !== "circle"
  ) {
    return "Exact metadata for cut currently supports rectangle or circle target extrudes only.";
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

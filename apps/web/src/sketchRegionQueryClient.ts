import type { CadProject } from "@web-cad/cad-core";
import type {
  CadQueryErrorResponse,
  CadQueryRequest,
  SketchEntitySnapshot,
  SketchProfileRegionCandidatesQuery,
  SketchProfileRegionCandidatesQueryResponse,
  SketchProfileRegionValidateQuery,
  SketchProfileRegionValidateQueryResponse
} from "@web-cad/cad-protocol";
import type {
  CadQueryExecutionOptions,
  CadQueryWorker,
  CadQueryWorkerRequest
} from "./browserCadQueryWorker";
import { getSharedBrowserCadQueryWorker } from "./browserCadQueryWorker";

export type SketchRegionCandidatesQueryRequest = Omit<
  CadQueryRequest,
  "query"
> & {
  readonly query: SketchProfileRegionCandidatesQuery;
};

export type SketchRegionValidateQueryRequest = Omit<
  CadQueryRequest,
  "query"
> & {
  readonly query: SketchProfileRegionValidateQuery;
};

export type SketchRegionCandidatesQueryResult =
  | SketchProfileRegionCandidatesQueryResponse
  | CadQueryErrorResponse;

export type SketchRegionValidateQueryResult =
  | SketchProfileRegionValidateQueryResponse
  | CadQueryErrorResponse;

interface CachedRegionCandidatesPage {
  readonly storageKey: string;
  readonly lookupKey: string;
  readonly sketchId: string;
  readonly sourceRevision: string;
  readonly response: SketchProfileRegionCandidatesQueryResponse;
  lastUsed: number;
}

export interface SketchRegionCandidateCacheOptions {
  readonly maxPages?: number;
}

export class SketchRegionCandidateCache {
  readonly #maxPages: number;
  readonly #entries = new Map<string, CachedRegionCandidatesPage>();
  readonly #lookupIndex = new Map<string, string>();
  readonly #projectionBySketch = new Map<string, string>();
  #clock = 0;

  constructor(options: SketchRegionCandidateCacheOptions = {}) {
    this.#maxPages = normalizeMaxPages(options.maxPages);
  }

  read(
    project: CadProject,
    request: SketchRegionCandidatesQueryRequest
  ): SketchProfileRegionCandidatesQueryResponse | undefined {
    if (!isStrictCacheableCandidatesRequest(request)) {
      return undefined;
    }
    const projectionKey = this.#prepareSketch(project, request.query.sketchId);
    const lookupKey = createLookupKey(
      projectionKey,
      createNarrowingObservationKey(project, request),
      request
    );
    const storageKey = this.#lookupIndex.get(lookupKey);
    if (!storageKey) {
      return undefined;
    }
    const entry = this.#entries.get(storageKey);
    if (!entry) {
      this.#lookupIndex.delete(lookupKey);
      return undefined;
    }
    entry.lastUsed = ++this.#clock;
    return entry.response;
  }

  write(
    project: CadProject,
    request: SketchRegionCandidatesQueryRequest,
    response: SketchProfileRegionCandidatesQueryResponse
  ): void {
    const sketchId = request.query.sketchId;
    const projectionKey = createSketchRegionRelevantProjectionKey(
      project,
      sketchId
    );
    const currentProjection = this.#projectionBySketch.get(sketchId);
    if (
      currentProjection !== undefined &&
      currentProjection !== projectionKey
    ) {
      return;
    }
    this.#projectionBySketch.set(sketchId, projectionKey);
    const lookupKey = createLookupKey(
      projectionKey,
      createNarrowingObservationKey(project, request),
      request
    );
    const storageKey = createStorageKey(response.sourceRevision, lookupKey);
    const replacedStorageKey = this.#lookupIndex.get(lookupKey);
    if (replacedStorageKey && replacedStorageKey !== storageKey) {
      this.#entries.delete(replacedStorageKey);
    }
    this.#lookupIndex.set(lookupKey, storageKey);
    this.#entries.set(storageKey, {
      storageKey,
      lookupKey,
      sketchId: request.query.sketchId,
      sourceRevision: response.sourceRevision,
      response,
      lastUsed: ++this.#clock
    });
    this.#evict();
  }

  invalidateSketch(sketchId: string): void {
    this.#projectionBySketch.delete(sketchId);
    for (const entry of this.#entries.values()) {
      if (entry.sketchId === sketchId) {
        this.#deleteEntry(entry);
      }
    }
  }

  clear(): void {
    this.#entries.clear();
    this.#lookupIndex.clear();
    this.#projectionBySketch.clear();
  }

  get size(): number {
    return this.#entries.size;
  }

  #prepareSketch(project: CadProject, sketchId: string): string {
    const projectionKey = createSketchRegionRelevantProjectionKey(
      project,
      sketchId
    );
    const previous = this.#projectionBySketch.get(sketchId);
    if (previous !== undefined && previous !== projectionKey) {
      this.invalidateSketch(sketchId);
    }
    this.#projectionBySketch.set(sketchId, projectionKey);
    return projectionKey;
  }

  #evict(): void {
    while (this.#entries.size > this.#maxPages) {
      let oldest: CachedRegionCandidatesPage | undefined;
      for (const entry of this.#entries.values()) {
        if (!oldest || entry.lastUsed < oldest.lastUsed) {
          oldest = entry;
        }
      }
      if (!oldest) {
        return;
      }
      this.#deleteEntry(oldest);
    }
  }

  #deleteEntry(entry: CachedRegionCandidatesPage): void {
    this.#entries.delete(entry.storageKey);
    if (this.#lookupIndex.get(entry.lookupKey) === entry.storageKey) {
      this.#lookupIndex.delete(entry.lookupKey);
    }
  }
}

export interface SketchRegionQueryClientOptions {
  readonly cache?: SketchRegionCandidateCache;
}

export class SketchRegionQueryClient {
  readonly #worker: CadQueryWorker;
  readonly #cache: SketchRegionCandidateCache;
  #nextRequestNumber = 1;

  constructor(
    worker: CadQueryWorker = getSharedBrowserCadQueryWorker(),
    options: SketchRegionQueryClientOptions = {}
  ) {
    this.#worker = worker;
    this.#cache = options.cache ?? new SketchRegionCandidateCache();
  }

  async queryCandidates(
    project: CadProject,
    request: SketchRegionCandidatesQueryRequest,
    options: CadQueryExecutionOptions = {}
  ): Promise<SketchRegionCandidatesQueryResult> {
    throwIfAborted(options.signal);
    const cached = this.#cache.read(project, request);
    if (cached) {
      return cached;
    }

    const response = await this.#worker.executeQuery(
      this.#createWorkerRequest(project, request, options.projectCacheKey),
      options
    );
    if (response.ok && response.query === "sketch.profileRegionCandidates") {
      this.#cache.write(project, request, response);
      return response;
    }
    if (!response.ok && response.query === request.query.query) {
      return response;
    }
    throw new Error(
      `CAD command worker returned ${response.query} for ${request.query.query}.`
    );
  }

  async validateProfile(
    project: CadProject,
    request: SketchRegionValidateQueryRequest,
    options: CadQueryExecutionOptions = {}
  ): Promise<SketchRegionValidateQueryResult> {
    throwIfAborted(options.signal);
    const response = await this.#worker.executeQuery(
      this.#createWorkerRequest(project, request, options.projectCacheKey),
      options
    );
    if (response.ok && response.query === "sketch.profileRegionValidate") {
      return response;
    }
    if (!response.ok && response.query === request.query.query) {
      return response;
    }
    throw new Error(
      `CAD command worker returned ${response.query} for ${request.query.query}.`
    );
  }

  invalidateSketch(sketchId: string): void {
    this.#cache.invalidateSketch(sketchId);
  }

  clearCache(): void {
    this.#cache.clear();
  }

  #createWorkerRequest(
    project: CadProject,
    request: CadQueryRequest,
    projectCacheKey?: string
  ): CadQueryWorkerRequest {
    const id = `region_query_${this.#nextRequestNumber}`;
    this.#nextRequestNumber += 1;
    return {
      kind: "cad-worker.query",
      id,
      project,
      ...(projectCacheKey ? { projectCacheKey } : {}),
      request
    };
  }
}

export function createSketchRegionRelevantProjectionKey(
  project: CadProject,
  sketchId: string
): string {
  const sketch = project.document.sketches.find(
    (candidate) => candidate.id === sketchId
  );
  const entities = (sketch?.entities ?? [])
    .map(createDiscoveryEntityProjection)
    .filter(
      (entity): entity is NonNullable<typeof entity> => entity !== undefined
    )
    .sort((left, right) => compareCodeUnits(left.id, right.id));
  return JSON.stringify({ sketchId, entities });
}

function createDiscoveryEntityProjection(entity: SketchEntitySnapshot):
  | {
      readonly id: string;
      readonly kind: "rectangle";
      readonly center: readonly [number, number];
      readonly width: number;
      readonly height: number;
      readonly construction: boolean;
    }
  | {
      readonly id: string;
      readonly kind: "circle";
      readonly center: readonly [number, number];
      readonly radius: number;
      readonly construction: boolean;
    }
  | {
      readonly id: string;
      readonly kind: "line";
      readonly start: readonly [number, number];
      readonly end: readonly [number, number];
      readonly construction: boolean;
    }
  | {
      readonly id: string;
      readonly kind: "arc";
      readonly center: readonly [number, number];
      readonly radius: number;
      readonly startAngleDegrees: number;
      readonly sweepAngleDegrees: number;
      readonly construction: boolean;
    }
  | undefined {
  switch (entity.kind) {
    case "rectangle":
      return {
        id: entity.id,
        kind: entity.kind,
        center: entity.center,
        width: entity.width,
        height: entity.height,
        construction: entity.construction
      };
    case "circle":
      return {
        id: entity.id,
        kind: entity.kind,
        center: entity.center,
        radius: entity.radius,
        construction: entity.construction
      };
    case "line":
      return {
        id: entity.id,
        kind: entity.kind,
        start: entity.start,
        end: entity.end,
        construction: entity.construction
      };
    case "arc":
      return {
        id: entity.id,
        kind: entity.kind,
        center: entity.center,
        radius: entity.radius,
        startAngleDegrees: entity.startAngleDegrees,
        sweepAngleDegrees: entity.sweepAngleDegrees,
        construction: entity.construction
      };
    default:
      return undefined;
  }
}

function createLookupKey(
  projectionKey: string,
  narrowingObservationKey: string,
  request: SketchRegionCandidatesQueryRequest
): string {
  const sortedEntityIds =
    request.query.entityIds === undefined
      ? null
      : [...request.query.entityIds].sort(compareCodeUnits);
  return JSON.stringify([
    projectionKey,
    narrowingObservationKey,
    request.version,
    sortedEntityIds,
    request.query.limit ?? 100,
    request.query.afterCandidateKey ?? null,
    request.query.sourceRevision ?? null
  ]);
}

function createNarrowingObservationKey(
  project: CadProject,
  request: SketchRegionCandidatesQueryRequest
): string {
  if (request.query.entityIds === undefined) return "omitted";
  const sketch = project.document.sketches.find(
    (candidate) => candidate.id === request.query.sketchId
  );
  const entities = new Map(
    (sketch?.entities ?? []).map((entity) => [entity.id, entity])
  );
  return JSON.stringify(
    [...request.query.entityIds].sort(compareCodeUnits).map((entityId) => {
      const entity = entities.get(entityId);
      return entity ? [entityId, entity.kind] : [entityId, "missing"];
    })
  );
}

function isStrictCacheableCandidatesRequest(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["version", "query"])) {
    return false;
  }
  if (value.version !== "cadops.v1" || !isRecord(value.query)) {
    return false;
  }
  const query = value.query;
  if (
    !hasOnlyKeys(query, [
      "query",
      "sketchId",
      "entityIds",
      "limit",
      "afterCandidateKey",
      "sourceRevision"
    ]) ||
    query.query !== "sketch.profileRegionCandidates" ||
    typeof query.sketchId !== "string" ||
    query.sketchId.length === 0
  ) {
    return false;
  }
  if ("entityIds" in query) {
    if (
      !Array.isArray(query.entityIds) ||
      query.entityIds.length > 4_096 ||
      query.entityIds.some(
        (entityId) => typeof entityId !== "string" || entityId.length === 0
      ) ||
      new Set(query.entityIds).size !== query.entityIds.length
    ) {
      return false;
    }
  }
  if (
    "limit" in query &&
    (!Number.isSafeInteger(query.limit) ||
      (query.limit as number) < 1 ||
      (query.limit as number) > 100)
  ) {
    return false;
  }
  const hasAfter = "afterCandidateKey" in query;
  const hasRevision = "sourceRevision" in query;
  if (hasAfter !== hasRevision) {
    return false;
  }
  return (
    !hasAfter ||
    (typeof query.afterCandidateKey === "string" &&
      query.afterCandidateKey.length > 0 &&
      typeof query.sourceRevision === "string" &&
      /^partbench-source-v1:[0-9a-f]{64}$/.test(query.sourceRevision))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[]
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length && expected.every((key) => key in value)
  );
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[]
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function createStorageKey(sourceRevision: string, lookupKey: string): string {
  return `${sourceRevision}\u0000${lookupKey}`;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeMaxPages(value: number | undefined): number {
  if (value === undefined) {
    return 64;
  }
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(
      "Region candidate cache maxPages must be a positive integer."
    );
  }
  return value;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) {
    return;
  }
  const error = new Error("CAD command worker query was cancelled.");
  error.name = "AbortError";
  throw error;
}

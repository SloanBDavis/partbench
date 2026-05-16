import type {
  BoxObject,
  CylinderObject,
  SceneObject,
  SphereObject
} from "@web-cad/cad-core";
import type { RenderTriangleMesh } from "@web-cad/renderer";
import {
  createDerivedGeometryErrorDetails,
  type DerivedGeometryErrorDetails,
  type DerivedGeometryMetrics,
  type DerivedGeometryResult,
  type DerivedGeometryRuntime
} from "./derivedGeometryRuntime";

export type DerivedGeometryStatusKind =
  | "unsupported"
  | "pending"
  | "ready"
  | "error";

export type DerivedGeometryEntry =
  | DerivedGeometryUnsupportedEntry
  | DerivedGeometryPendingEntry
  | DerivedGeometryReadyEntry
  | DerivedGeometryErrorEntry;

export interface DerivedGeometryBaseEntry {
  readonly objectId: string;
  readonly objectKind: SceneObject["kind"];
  readonly cacheKey: string;
  readonly status: DerivedGeometryStatusKind;
}

export interface DerivedGeometryUnsupportedEntry extends DerivedGeometryBaseEntry {
  readonly status: "unsupported";
  readonly message: string;
}

export interface DerivedGeometryPendingEntry extends DerivedGeometryBaseEntry {
  readonly status: "pending";
}

export interface DerivedGeometryReadyEntry extends DerivedGeometryBaseEntry {
  readonly status: "ready";
  readonly mesh: RenderTriangleMesh;
  readonly metrics: DerivedGeometryMetrics;
}

export interface DerivedGeometryErrorEntry extends DerivedGeometryBaseEntry {
  readonly status: "error";
  readonly error: DerivedGeometryErrorDetails;
}

export interface DerivedGeometrySnapshot {
  readonly entries: readonly DerivedGeometryEntry[];
  readonly meshes: readonly RenderTriangleMesh[];
  readonly supportedCount: number;
  readonly pendingCount: number;
  readonly readyCount: number;
  readonly errorCount: number;
}

export interface DerivedGeometryServiceOptions {
  readonly runtime: DerivedGeometryRuntime;
  readonly onChange: (snapshot: DerivedGeometrySnapshot) => void;
}

type SupportedDerivedGeometryObject = BoxObject | CylinderObject | SphereObject;

interface ActiveDerivedGeometryRequest {
  readonly objectId: string;
  readonly cacheKey: string;
  readonly version: number;
}

export class DerivedGeometryService {
  readonly #runtime: DerivedGeometryRuntime;
  readonly #onChange: (snapshot: DerivedGeometrySnapshot) => void;
  readonly #entries = new Map<string, DerivedGeometryEntry>();
  readonly #requestVersions = new Map<string, number>();
  #objectOrder: readonly string[] = [];
  #nextRequestVersion = 0;
  #disposed = false;

  constructor(options: DerivedGeometryServiceOptions) {
    this.#runtime = options.runtime;
    this.#onChange = options.onChange;
  }

  getSnapshot(): DerivedGeometrySnapshot {
    return createDerivedGeometrySnapshot(this.#entries, this.#objectOrder);
  }

  reconcile(objects: readonly SceneObject[]): void {
    if (this.#disposed) {
      return;
    }

    const nextObjectOrder = objects.map((object) => object.id);
    let changed = !isSameStringArray(this.#objectOrder, nextObjectOrder);
    const nextIds = new Set<string>();
    this.#objectOrder = nextObjectOrder;

    for (const object of objects) {
      nextIds.add(object.id);
      const cacheKey = createDerivedGeometryCacheKey(object);
      const existing = this.#entries.get(object.id);

      if (!isSupportedDerivedGeometryObject(object)) {
        this.#requestVersions.delete(object.id);
        const unsupported: DerivedGeometryUnsupportedEntry = {
          objectId: object.id,
          objectKind: object.kind,
          cacheKey,
          status: "unsupported",
          message:
            "Derived OCCT mesh generation currently supports boxes, cylinders, and spheres only."
        };

        if (!isSameEntry(existing, unsupported)) {
          this.#entries.set(object.id, unsupported);
          changed = true;
        }

        continue;
      }

      if (existing?.cacheKey === cacheKey) {
        continue;
      }

      const supportedObject = object as SupportedDerivedGeometryObject;
      const request = this.#beginRequest(supportedObject);
      const pending = createPendingEntry(supportedObject, cacheKey);

      this.#entries.set(object.id, pending);
      changed = true;
      void this.#deriveObject(supportedObject, request);
    }

    for (const objectId of this.#entries.keys()) {
      if (!nextIds.has(objectId)) {
        this.#entries.delete(objectId);
        this.#requestVersions.delete(objectId);
        changed = true;
      }
    }

    if (changed) {
      this.#emitChange();
    }
  }

  refresh(objects: readonly SceneObject[]): void {
    if (this.#disposed) {
      return;
    }

    this.#clearState();
    this.#emitChange();
    this.reconcile(objects);
  }

  dispose(): void {
    this.#disposed = true;
    this.#clearState();
    this.#runtime.dispose();
  }

  #beginRequest(
    object: SupportedDerivedGeometryObject
  ): ActiveDerivedGeometryRequest {
    this.#nextRequestVersion += 1;
    const request = {
      objectId: object.id,
      cacheKey: createDerivedGeometryCacheKey(object),
      version: this.#nextRequestVersion
    };

    this.#requestVersions.set(request.objectId, request.version);

    return request;
  }

  async #deriveObject(
    object: SupportedDerivedGeometryObject,
    request: ActiveDerivedGeometryRequest
  ): Promise<void> {
    try {
      const result = await deriveObjectMesh(this.#runtime, object);

      this.#applyReadyResult(object, request, result);
    } catch (error) {
      this.#applyErrorResult(object, request, error);
    }
  }

  #applyReadyResult(
    object: SupportedDerivedGeometryObject,
    request: ActiveDerivedGeometryRequest,
    result: DerivedGeometryResult
  ): void {
    if (!this.#canApplyResult(request)) {
      return;
    }

    this.#entries.set(object.id, {
      objectId: object.id,
      objectKind: object.kind,
      cacheKey: request.cacheKey,
      status: "ready",
      mesh: result.mesh,
      metrics: result.metrics
    });
    this.#requestVersions.delete(object.id);
    this.#emitChange();
  }

  #applyErrorResult(
    object: SupportedDerivedGeometryObject,
    request: ActiveDerivedGeometryRequest,
    error: unknown
  ): void {
    if (!this.#canApplyResult(request)) {
      return;
    }

    this.#entries.set(object.id, {
      objectId: object.id,
      objectKind: object.kind,
      cacheKey: request.cacheKey,
      status: "error",
      error: createDerivedGeometryErrorDetails(error)
    });
    this.#requestVersions.delete(object.id);
    this.#emitChange();
  }

  #canApplyResult(request: ActiveDerivedGeometryRequest): boolean {
    return (
      !this.#disposed &&
      this.#entries.get(request.objectId)?.cacheKey === request.cacheKey &&
      this.#requestVersions.get(request.objectId) === request.version
    );
  }

  #clearState(): void {
    this.#entries.clear();
    this.#requestVersions.clear();
    this.#objectOrder = [];
  }

  #emitChange(): void {
    this.#onChange(this.getSnapshot());
  }
}

function createPendingEntry(
  object: SupportedDerivedGeometryObject,
  cacheKey: string
): DerivedGeometryPendingEntry {
  return {
    objectId: object.id,
    objectKind: object.kind,
    cacheKey,
    status: "pending"
  };
}

function isSupportedDerivedGeometryObject(object: SceneObject): boolean {
  return (
    object.kind === "box" ||
    object.kind === "cylinder" ||
    object.kind === "sphere"
  );
}

function deriveObjectMesh(
  runtime: DerivedGeometryRuntime,
  object: SupportedDerivedGeometryObject
): Promise<DerivedGeometryResult> {
  switch (object.kind) {
    case "box":
      return runtime.tessellateBox({
        id: object.id,
        dimensions: object.dimensions,
        transform: object.transform
      });
    case "cylinder":
      return runtime.tessellateCylinder({
        id: object.id,
        dimensions: object.dimensions,
        transform: object.transform
      });
    case "sphere":
      return runtime.tessellateSphere({
        id: object.id,
        dimensions: object.dimensions,
        transform: object.transform
      });
  }
}

export function createEmptyDerivedGeometrySnapshot(): DerivedGeometrySnapshot {
  return {
    entries: [],
    meshes: [],
    supportedCount: 0,
    pendingCount: 0,
    readyCount: 0,
    errorCount: 0
  };
}

export function createDerivedGeometryCacheKey(object: SceneObject): string {
  const base = {
    kind: object.kind,
    dimensions: object.dimensions,
    transform: object.transform
  };

  return JSON.stringify(base);
}

export function getDerivedGeometryStatusLabel(
  entry: DerivedGeometryEntry | undefined
): string {
  if (!entry) {
    return "Primitive fallback";
  }

  switch (entry.status) {
    case "ready":
      return "OCCT mesh ready";
    case "pending":
      return "Building OCCT mesh";
    case "error":
      return "Primitive fallback";
    case "unsupported":
      return "Primitive fallback";
  }
}

function createDerivedGeometrySnapshot(
  entries: ReadonlyMap<string, DerivedGeometryEntry>,
  objectOrder: readonly string[]
): DerivedGeometrySnapshot {
  const orderedEntries = objectOrder
    .map((objectId) => entries.get(objectId))
    .filter((entry): entry is DerivedGeometryEntry => Boolean(entry));
  const meshes = orderedEntries
    .filter(
      (entry): entry is DerivedGeometryReadyEntry => entry.status === "ready"
    )
    .map((entry) => entry.mesh);

  return {
    entries: orderedEntries,
    meshes,
    supportedCount: orderedEntries.filter(
      (entry) => entry.status !== "unsupported"
    ).length,
    pendingCount: orderedEntries.filter((entry) => entry.status === "pending")
      .length,
    readyCount: meshes.length,
    errorCount: orderedEntries.filter((entry) => entry.status === "error")
      .length
  };
}

function isSameEntry(
  left: DerivedGeometryEntry | undefined,
  right: DerivedGeometryEntry
): boolean {
  return (
    left?.objectId === right.objectId &&
    left.objectKind === right.objectKind &&
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

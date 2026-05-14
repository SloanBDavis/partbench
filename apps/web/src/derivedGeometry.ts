import type { BoxObject, SceneObject } from "@web-cad/cad-core";
import type { RenderTriangleMesh } from "@web-cad/renderer";
import {
  createOcctMeshDevErrorDetails,
  type OcctMeshDevErrorDetails,
  type OcctMeshDevMetrics,
  type OcctMeshDevResult,
  type OcctMeshDevRuntime
} from "./occtMeshDev";

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
  readonly metrics: OcctMeshDevMetrics;
}

export interface DerivedGeometryErrorEntry extends DerivedGeometryBaseEntry {
  readonly status: "error";
  readonly error: OcctMeshDevErrorDetails;
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
  readonly runtime: OcctMeshDevRuntime;
  readonly onChange: (snapshot: DerivedGeometrySnapshot) => void;
}

export class DerivedGeometryService {
  readonly #runtime: OcctMeshDevRuntime;
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

    let changed = false;
    const nextIds = new Set<string>();
    this.#objectOrder = objects.map((object) => object.id);

    for (const object of objects) {
      nextIds.add(object.id);
      const cacheKey = createDerivedGeometryCacheKey(object);
      const existing = this.#entries.get(object.id);

      if (object.kind !== "box") {
        this.#requestVersions.delete(object.id);
        const unsupported: DerivedGeometryUnsupportedEntry = {
          objectId: object.id,
          objectKind: object.kind,
          cacheKey,
          status: "unsupported",
          message: "Derived OCCT mesh generation currently supports boxes only."
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

      this.#nextRequestVersion += 1;
      const requestVersion = this.#nextRequestVersion;
      this.#requestVersions.set(object.id, requestVersion);
      const pending: DerivedGeometryPendingEntry = {
        objectId: object.id,
        objectKind: object.kind,
        cacheKey,
        status: "pending"
      };
      this.#entries.set(object.id, pending);
      changed = true;
      void this.#deriveBox(object, cacheKey, requestVersion);
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
    this.#entries.clear();
    this.#requestVersions.clear();
    this.#objectOrder = [];
    this.#emitChange();
    this.reconcile(objects);
  }

  dispose(): void {
    this.#disposed = true;
    this.#entries.clear();
    this.#requestVersions.clear();
    this.#objectOrder = [];
    this.#runtime.dispose();
  }

  async #deriveBox(
    object: BoxObject,
    cacheKey: string,
    requestVersion: number
  ): Promise<void> {
    try {
      const result = await this.#runtime.tessellateBox({
        id: object.id,
        dimensions: object.dimensions,
        transform: object.transform
      });

      if (!this.#canApplyResult(object.id, cacheKey, requestVersion)) {
        return;
      }

      this.#entries.set(object.id, {
        objectId: object.id,
        objectKind: object.kind,
        cacheKey,
        status: "ready",
        mesh: result.mesh,
        metrics: result.metrics
      });
      this.#emitChange();
    } catch (error) {
      if (!this.#canApplyResult(object.id, cacheKey, requestVersion)) {
        return;
      }

      this.#entries.set(object.id, {
        objectId: object.id,
        objectKind: object.kind,
        cacheKey,
        status: "error",
        error: createOcctMeshDevErrorDetails(error)
      });
      this.#emitChange();
    }
  }

  #canApplyResult(
    objectId: string,
    cacheKey: string,
    requestVersion: number
  ): boolean {
    return (
      !this.#disposed &&
      this.#entries.get(objectId)?.cacheKey === cacheKey &&
      this.#requestVersions.get(objectId) === requestVersion
    );
  }

  #emitChange(): void {
    this.#onChange(this.getSnapshot());
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
    return "not requested";
  }

  switch (entry.status) {
    case "ready":
      return "mesh ready";
    case "pending":
      return "mesh pending";
    case "error":
      return "mesh error";
    case "unsupported":
      return "unsupported";
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

export type { OcctMeshDevResult as DerivedGeometryResult };

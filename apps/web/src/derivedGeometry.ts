import type {
  BoxObject,
  ConeObject,
  CylinderObject,
  SceneObject,
  SphereObject,
  TorusObject
} from "@web-cad/cad-core";
import type { RenderTriangleMesh } from "@web-cad/renderer";
import {
  createDerivedGeometryErrorDetails,
  type DerivedGeometryErrorDetails,
  type DerivedGeometryMetrics,
  type DerivedGeometryResult,
  type DerivedGeometryRuntime
} from "./derivedGeometryRuntime";
import {
  mapSketchPlanePointToDisplayFrame,
  type SketchDisplayFrame
} from "./sketchDisplayFrames";

export type DerivedGeometryStatusKind =
  | "unsupported"
  | "pending"
  | "ready"
  | "error";
export type DerivedGeometrySourceKind =
  | SceneObject["kind"]
  | "extrude"
  | "extrudeBoolean";

export type DerivedGeometrySource =
  | DerivedPrimitiveGeometrySource
  | DerivedExtrudeGeometrySource
  | DerivedBooleanExtrudeGeometrySource;
export type DerivedGeometryInput = DerivedGeometrySource | SceneObject;

export interface DerivedPrimitiveGeometrySource {
  readonly id: string;
  readonly kind: SceneObject["kind"];
  readonly object: SceneObject;
}

export interface DerivedExtrudeGeometrySource {
  readonly id: string;
  readonly kind: "extrude";
  readonly sketchPlane: "XY" | "XZ" | "YZ";
  readonly profile:
    | {
        readonly kind: "rectangle";
        readonly center: readonly [number, number];
        readonly width: number;
        readonly height: number;
      }
    | {
        readonly kind: "circle";
        readonly center: readonly [number, number];
        readonly radius: number;
      };
  readonly depth: number;
  readonly side: "positive" | "negative" | "symmetric";
  readonly placementFrame?: SketchDisplayFrame;
  readonly placementError?: string;
}

export interface DerivedBooleanExtrudeGeometrySource {
  readonly id: string;
  readonly kind: "extrudeBoolean";
  readonly operation: "add" | "cut";
  readonly target: DerivedExtrudeGeometrySource;
  readonly tool: DerivedExtrudeGeometrySource;
  readonly placementError?: string;
}

export type DerivedGeometryEntry =
  | DerivedGeometryUnsupportedEntry
  | DerivedGeometryPendingEntry
  | DerivedGeometryReadyEntry
  | DerivedGeometryErrorEntry;

export interface DerivedGeometryBaseEntry {
  readonly objectId: string;
  readonly objectKind: DerivedGeometrySourceKind;
  readonly sourceId?: string;
  readonly sourceKind?: DerivedGeometrySourceKind;
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

type SupportedDerivedGeometryObject =
  | BoxObject
  | CylinderObject
  | SphereObject
  | ConeObject
  | TorusObject;
type SupportedDerivedGeometrySource =
  | DerivedPrimitiveGeometrySource
  | DerivedExtrudeGeometrySource
  | DerivedBooleanExtrudeGeometrySource;

interface ActiveDerivedGeometryRequest {
  readonly sourceId: string;
  readonly cacheKey: string;
  readonly version: number;
}

export class DerivedGeometryService {
  readonly #runtime: DerivedGeometryRuntime;
  readonly #onChange: (snapshot: DerivedGeometrySnapshot) => void;
  readonly #entries = new Map<string, DerivedGeometryEntry>();
  readonly #requestVersions = new Map<string, number>();
  #sourceOrder: readonly string[] = [];
  #nextRequestVersion = 0;
  #disposed = false;

  constructor(options: DerivedGeometryServiceOptions) {
    this.#runtime = options.runtime;
    this.#onChange = options.onChange;
  }

  getSnapshot(): DerivedGeometrySnapshot {
    return createDerivedGeometrySnapshot(this.#entries, this.#sourceOrder);
  }

  reconcile(inputs: readonly DerivedGeometryInput[]): void {
    if (this.#disposed) {
      return;
    }

    const sources = inputs.map(toDerivedGeometrySource);
    const nextSourceOrder = sources.map((source) => source.id);
    let changed = !isSameStringArray(this.#sourceOrder, nextSourceOrder);
    const nextIds = new Set<string>();
    this.#sourceOrder = nextSourceOrder;

    for (const source of sources) {
      nextIds.add(source.id);
      const cacheKey = createDerivedGeometryCacheKey(source);
      const existing = this.#entries.get(source.id);

      if (!isSupportedDerivedGeometrySource(source)) {
        this.#requestVersions.delete(source.id);
        const unsupported: DerivedGeometryUnsupportedEntry = {
          objectId: source.id,
          objectKind: source.kind,
          sourceId: source.id,
          sourceKind: source.kind,
          cacheKey,
          status: "unsupported",
          message: getUnsupportedSourceMessage(source)
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
      const pending = createPendingEntry(source, cacheKey);

      this.#entries.set(source.id, pending);
      changed = true;
      void this.#deriveSource(source, request);
    }

    for (const sourceId of this.#entries.keys()) {
      if (!nextIds.has(sourceId)) {
        this.#entries.delete(sourceId);
        this.#requestVersions.delete(sourceId);
        changed = true;
      }
    }

    if (changed) {
      this.#emitChange();
    }
  }

  refresh(sources: readonly DerivedGeometryInput[]): void {
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
    this.#runtime.dispose();
  }

  #beginRequest(
    source: SupportedDerivedGeometrySource
  ): ActiveDerivedGeometryRequest {
    this.#nextRequestVersion += 1;
    const request = {
      sourceId: source.id,
      cacheKey: createDerivedGeometryCacheKey(source),
      version: this.#nextRequestVersion
    };

    this.#requestVersions.set(request.sourceId, request.version);

    return request;
  }

  async #deriveSource(
    source: SupportedDerivedGeometrySource,
    request: ActiveDerivedGeometryRequest
  ): Promise<void> {
    try {
      const result = await deriveSourceMesh(this.#runtime, source);

      this.#applyReadyResult(source, request, result);
    } catch (error) {
      this.#applyErrorResult(source, request, error);
    }
  }

  #applyReadyResult(
    source: SupportedDerivedGeometrySource,
    request: ActiveDerivedGeometryRequest,
    result: DerivedGeometryResult
  ): void {
    if (!this.#canApplyResult(request)) {
      return;
    }

    this.#entries.set(source.id, {
      objectId: source.id,
      objectKind: source.kind,
      sourceId: source.id,
      sourceKind: source.kind,
      cacheKey: request.cacheKey,
      status: "ready",
      mesh: result.mesh,
      metrics: result.metrics
    });
    this.#requestVersions.delete(source.id);
    this.#emitChange();
  }

  #applyErrorResult(
    source: SupportedDerivedGeometrySource,
    request: ActiveDerivedGeometryRequest,
    error: unknown
  ): void {
    if (!this.#canApplyResult(request)) {
      return;
    }

    this.#entries.set(source.id, {
      objectId: source.id,
      objectKind: source.kind,
      sourceId: source.id,
      sourceKind: source.kind,
      cacheKey: request.cacheKey,
      status: "error",
      error: createDerivedGeometryErrorDetails(error)
    });
    this.#requestVersions.delete(source.id);
    this.#emitChange();
  }

  #canApplyResult(request: ActiveDerivedGeometryRequest): boolean {
    return (
      !this.#disposed &&
      this.#entries.get(request.sourceId)?.cacheKey === request.cacheKey &&
      this.#requestVersions.get(request.sourceId) === request.version
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

function createPendingEntry(
  source: SupportedDerivedGeometrySource,
  cacheKey: string
): DerivedGeometryPendingEntry {
  return {
    objectId: source.id,
    objectKind: source.kind,
    sourceId: source.id,
    sourceKind: source.kind,
    cacheKey,
    status: "pending"
  };
}

export function createPrimitiveDerivedGeometrySource(
  object: SceneObject
): DerivedPrimitiveGeometrySource {
  return {
    id: object.id,
    kind: object.kind,
    object
  };
}

function toDerivedGeometrySource(
  input: DerivedGeometryInput
): DerivedGeometrySource {
  if (
    "object" in input ||
    input.kind === "extrude" ||
    input.kind === "extrudeBoolean"
  ) {
    return input;
  }

  return createPrimitiveDerivedGeometrySource(input);
}

function isSupportedDerivedGeometrySource(
  source: DerivedGeometrySource
): boolean {
  if (source.kind === "extrude") {
    return !source.placementError;
  }

  if (source.kind === "extrudeBoolean") {
    return !source.placementError && isSupportedBooleanExtrudeSource(source);
  }

  return isSupportedDerivedGeometryObject(source.object);
}

function isSupportedDerivedGeometryObject(object: SceneObject): boolean {
  return (
    object.kind === "box" ||
    object.kind === "cylinder" ||
    object.kind === "sphere" ||
    object.kind === "cone" ||
    object.kind === "torus"
  );
}

function deriveSourceMesh(
  runtime: DerivedGeometryRuntime,
  source: SupportedDerivedGeometrySource
): Promise<DerivedGeometryResult> {
  if (source.kind === "extrude") {
    if (source.placementError) {
      throw new Error(source.placementError);
    }

    return runtime
      .tessellateExtrude({
        id: source.id,
        sketchPlane: source.sketchPlane,
        profile: source.profile,
        depth: source.depth,
        side: source.side,
        transform: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      })
      .then((result) => applyExtrudePlacement(source, result));
  }

  if (source.kind === "extrudeBoolean") {
    if (source.placementError) {
      throw new Error(source.placementError);
    }

    const unsupportedMessage = getUnsupportedBooleanSourceMessage(source);

    if (unsupportedMessage) {
      throw new Error(unsupportedMessage);
    }

    return runtime.booleanExtrudes({
      id: source.id,
      operation: source.operation,
      target: {
        sketchPlane: source.target.sketchPlane,
        profile: source.target.profile,
        depth: source.target.depth,
        side: source.target.side,
        placementFrame: source.target.placementFrame
      },
      tool: {
        sketchPlane: source.tool.sketchPlane,
        profile: source.tool.profile,
        depth: source.tool.depth,
        side: source.tool.side,
        placementFrame: source.tool.placementFrame
      }
    });
  }

  const object = source.object as SupportedDerivedGeometryObject;

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
    case "cone":
      return runtime.tessellateCone({
        id: object.id,
        dimensions: object.dimensions,
        transform: object.transform
      });
    case "torus":
      return runtime.tessellateTorus({
        id: object.id,
        dimensions: object.dimensions,
        transform: object.transform
      });
  }
}

export function applyExtrudePlacement(
  source: DerivedExtrudeGeometrySource,
  result: DerivedGeometryResult
): DerivedGeometryResult {
  if (!source.placementFrame) {
    return result;
  }

  return {
    ...result,
    mesh: transformExtrudeMeshToPlacement(
      result.mesh,
      source.sketchPlane,
      source.placementFrame
    )
  };
}

export function transformExtrudeMeshToPlacement(
  mesh: RenderTriangleMesh,
  sketchPlane: DerivedExtrudeGeometrySource["sketchPlane"],
  placementFrame: SketchDisplayFrame
): RenderTriangleMesh {
  return {
    ...mesh,
    vertices: mesh.vertices.map((vertex) =>
      mapSketchPlanePointToDisplayFrame(placementFrame, sketchPlane, vertex)
    ),
    edgeSegments: mesh.edgeSegments?.map((edge) => ({
      start: mapSketchPlanePointToDisplayFrame(
        placementFrame,
        sketchPlane,
        edge.start
      ),
      end: mapSketchPlanePointToDisplayFrame(
        placementFrame,
        sketchPlane,
        edge.end
      )
    }))
  };
}

function getUnsupportedSourceMessage(source: DerivedGeometrySource): string {
  if (source.kind === "extrude" && source.placementError) {
    return source.placementError;
  }

  if (source.kind === "extrudeBoolean") {
    return (
      source.placementError ??
      getUnsupportedBooleanSourceMessage(source) ??
      "Boolean display currently supports rectangle-tool add/cut results only."
    );
  }

  return "Derived OCCT mesh generation supports scene primitives, sketch extrudes, and rectangle-tool boolean results.";
}

function isSupportedBooleanExtrudeSource(
  source: DerivedBooleanExtrudeGeometrySource
): boolean {
  return getUnsupportedBooleanSourceMessage(source) === undefined;
}

function getUnsupportedBooleanSourceMessage(
  source: DerivedBooleanExtrudeGeometrySource
): string | undefined {
  if (source.tool.profile.kind !== "rectangle") {
    return "Boolean display currently supports rectangle tool extrudes only.";
  }

  if (
    source.operation === "add" &&
    source.target.profile.kind !== "rectangle"
  ) {
    return "Boolean add display currently supports rectangle target extrudes only.";
  }

  if (
    source.operation === "cut" &&
    source.target.profile.kind !== "rectangle" &&
    source.target.profile.kind !== "circle"
  ) {
    return "Boolean cut display currently supports rectangle or circle target extrudes only.";
  }

  return undefined;
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

export function createDerivedGeometryCacheKey(
  input: DerivedGeometryInput
): string {
  const source = toDerivedGeometrySource(input);
  const base =
    source.kind === "extrude"
      ? {
          kind: source.kind,
          sketchPlane: source.sketchPlane,
          profile: source.profile,
          depth: source.depth,
          side: source.side,
          placementFrame: source.placementFrame,
          placementError: source.placementError
        }
      : source.kind === "extrudeBoolean"
        ? {
            kind: source.kind,
            operation: source.operation,
            target: createDerivedGeometryCacheKey(source.target),
            tool: createDerivedGeometryCacheKey(source.tool),
            placementError: source.placementError
          }
        : {
            kind: source.kind,
            dimensions: source.object.dimensions,
            transform: source.object.transform
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
      if (entry.sourceKind === "extrudeBoolean") {
        return "Boolean mesh error";
      }

      return "Primitive fallback";
    case "unsupported":
      if (
        entry.sourceKind === "extrude" ||
        entry.sourceKind === "extrudeBoolean"
      ) {
        return entry.message;
      }

      return "Primitive fallback";
  }
}

function createDerivedGeometrySnapshot(
  entries: ReadonlyMap<string, DerivedGeometryEntry>,
  sourceOrder: readonly string[]
): DerivedGeometrySnapshot {
  const orderedEntries = sourceOrder
    .map((sourceId) => entries.get(sourceId))
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
    left?.sourceId === right.sourceId &&
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

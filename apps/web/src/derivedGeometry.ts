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
  type DerivedGeometryBooleanExtrudeInputSource,
  type DerivedGeometryBooleanExtrudePrimitiveInputSource,
  type DerivedGeometryErrorDetails,
  type DerivedGeometryMetrics,
  type DerivedGeometryPatternSeedSource,
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
  | "extrudeBoolean"
  | "revolve"
  | "hole"
  | "edgeFinish"
  | "linearPattern"
  | "circularPattern"
  | "mirror"
  | "shell";

export type DerivedGeometrySource =
  | DerivedPrimitiveGeometrySource
  | DerivedExtrudeGeometrySource
  | DerivedBooleanExtrudeGeometrySource
  | DerivedRevolveGeometrySource
  | DerivedHoleGeometrySource
  | DerivedEdgeFinishGeometrySource
  | DerivedLinearPatternGeometrySource
  | DerivedCircularPatternGeometrySource
  | DerivedMirrorGeometrySource
  | DerivedShellGeometrySource;
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
  readonly target:
    | DerivedExtrudeGeometrySource
    | DerivedBooleanExtrudeGeometrySource;
  readonly tool: DerivedExtrudeGeometrySource;
  readonly placementError?: string;
}

export interface DerivedRevolveGeometrySource {
  readonly id: string;
  readonly kind: "revolve";
  readonly sketchPlane: "XY" | "XZ" | "YZ";
  readonly profile: DerivedExtrudeGeometrySource["profile"];
  readonly axis: {
    readonly start: readonly [number, number];
    readonly end: readonly [number, number];
  };
  readonly angleDegrees: number;
  readonly placementFrame?: SketchDisplayFrame;
  readonly placementError?: string;
}

export interface DerivedHoleGeometrySource {
  readonly id: string;
  readonly kind: "hole";
  readonly target:
    | DerivedExtrudeGeometrySource
    | DerivedBooleanExtrudeGeometrySource;
  readonly tool: {
    readonly sketchPlane: "XY" | "XZ" | "YZ";
    readonly circle: Extract<
      DerivedExtrudeGeometrySource["profile"],
      {
        readonly kind: "circle";
      }
    >;
    readonly depthMode: "blind" | "throughAll";
    readonly depth?: number;
    readonly direction: "positive" | "negative";
    readonly placementFrame?: SketchDisplayFrame;
  };
  readonly placementError?: string;
}

export type DerivedEdgeFinishGeometrySource =
  | DerivedChamferGeometrySource
  | DerivedFilletGeometrySource;

export interface DerivedChamferGeometrySource {
  readonly id: string;
  readonly kind: "edgeFinish";
  readonly operation: "chamfer";
  readonly target:
    | DerivedExtrudeGeometrySource
    | DerivedBooleanExtrudeGeometrySource;
  readonly edgeStableId: string;
  readonly distance: number;
  readonly placementError?: string;
}

export interface DerivedFilletGeometrySource {
  readonly id: string;
  readonly kind: "edgeFinish";
  readonly operation: "fillet";
  readonly target:
    | DerivedExtrudeGeometrySource
    | DerivedBooleanExtrudeGeometrySource;
  readonly edgeStableId: string;
  readonly radius: number;
  readonly placementError?: string;
}

export interface DerivedLinearPatternGeometrySource {
  readonly id: string;
  readonly kind: "linearPattern";
  readonly seed:
    | DerivedExtrudeGeometrySource
    | DerivedBooleanExtrudeGeometrySource;
  readonly axis: "x" | "y" | "z";
  readonly spacing: number;
  readonly instanceCount: number;
  readonly placementError?: string;
}

export interface DerivedCircularPatternGeometrySource {
  readonly id: string;
  readonly kind: "circularPattern";
  readonly seed:
    | DerivedExtrudeGeometrySource
    | DerivedBooleanExtrudeGeometrySource;
  readonly rotationAxis: "x" | "y" | "z";
  readonly totalAngleDegrees: number;
  readonly instanceCount: number;
  readonly placementError?: string;
}

export interface DerivedMirrorGeometrySource {
  readonly id: string;
  readonly kind: "mirror";
  readonly seed:
    | DerivedExtrudeGeometrySource
    | DerivedBooleanExtrudeGeometrySource;
  readonly mirrorPlane: "XY" | "XZ" | "YZ";
  readonly includeOriginal: boolean;
  readonly placementError?: string;
}

export interface DerivedShellGeometrySource {
  readonly id: string;
  readonly kind: "shell";
  readonly target:
    | DerivedExtrudeGeometrySource
    | DerivedBooleanExtrudeGeometrySource;
  readonly wallThickness: number;
  readonly openFaceStableIds: readonly string[];
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

export interface DerivedGeometryMeshCacheReadInput {
  readonly source: DerivedGeometrySource;
  readonly sourceKey: string;
}

export interface DerivedGeometryMeshCacheWriteInput {
  readonly source: DerivedGeometrySource;
  readonly sourceKey: string;
  readonly result: DerivedGeometryResult;
}

export interface DerivedGeometryMeshCache {
  readonly read: (
    input: DerivedGeometryMeshCacheReadInput
  ) => Promise<DerivedGeometryResult | undefined>;
  readonly write: (input: DerivedGeometryMeshCacheWriteInput) => Promise<void>;
}

export interface DerivedGeometryServiceOptions {
  readonly runtime: DerivedGeometryRuntime;
  readonly onChange: (snapshot: DerivedGeometrySnapshot) => void;
  readonly meshCache?: DerivedGeometryMeshCache;
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
  | DerivedBooleanExtrudeGeometrySource
  | DerivedRevolveGeometrySource
  | DerivedHoleGeometrySource
  | DerivedEdgeFinishGeometrySource
  | DerivedLinearPatternGeometrySource
  | DerivedCircularPatternGeometrySource
  | DerivedMirrorGeometrySource
  | DerivedShellGeometrySource;

interface ActiveDerivedGeometryRequest {
  readonly sourceId: string;
  readonly cacheKey: string;
  readonly version: number;
}

export class DerivedGeometryService {
  readonly #runtime: DerivedGeometryRuntime;
  readonly #onChange: (snapshot: DerivedGeometrySnapshot) => void;
  readonly #meshCache?: DerivedGeometryMeshCache;
  readonly #entries = new Map<string, DerivedGeometryEntry>();
  readonly #requestVersions = new Map<string, number>();
  #sourceOrder: readonly string[] = [];
  #nextRequestVersion = 0;
  #disposed = false;

  constructor(options: DerivedGeometryServiceOptions) {
    this.#runtime = options.runtime;
    this.#onChange = options.onChange;
    this.#meshCache = options.meshCache;
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
      const cached = this.#meshCache
        ? await this.#readCachedSource(source, request)
        : undefined;

      if (cached) {
        this.#applyReadyResult(source, request, cached);
        return;
      }

      const result = await deriveSourceMesh(this.#runtime, source);

      if (!this.#canApplyResult(request)) {
        return;
      }

      this.#applyReadyResult(source, request, result);
      void this.#writeCachedSource(source, request, result);
    } catch (error) {
      this.#applyErrorResult(source, request, error);
    }
  }

  async #readCachedSource(
    source: SupportedDerivedGeometrySource,
    request: ActiveDerivedGeometryRequest
  ): Promise<DerivedGeometryResult | undefined> {
    if (!this.#meshCache) {
      return undefined;
    }

    try {
      const result = await this.#meshCache.read({
        source,
        sourceKey: request.cacheKey
      });

      return result && this.#canApplyResult(request) ? result : undefined;
    } catch {
      return undefined;
    }
  }

  async #writeCachedSource(
    source: SupportedDerivedGeometrySource,
    request: ActiveDerivedGeometryRequest,
    result: DerivedGeometryResult
  ): Promise<void> {
    if (!this.#meshCache) {
      return;
    }

    try {
      await this.#meshCache.write({
        source,
        sourceKey: request.cacheKey,
        result
      });
    } catch {
      // Cache writes are rebuildable app state and must not affect rendering.
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
    input.kind === "extrudeBoolean" ||
    input.kind === "revolve" ||
    input.kind === "hole" ||
    input.kind === "edgeFinish" ||
    input.kind === "linearPattern" ||
    input.kind === "circularPattern" ||
    input.kind === "mirror" ||
    input.kind === "shell"
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

  if (source.kind === "revolve") {
    return !source.placementError;
  }

  if (source.kind === "hole") {
    return !source.placementError && isSupportedHoleSource(source);
  }

  if (source.kind === "edgeFinish") {
    return !source.placementError && isSupportedEdgeFinishSource(source);
  }

  if (source.kind === "linearPattern" || source.kind === "circularPattern") {
    return !source.placementError;
  }

  if (source.kind === "mirror") {
    return !source.placementError;
  }

  if (source.kind === "shell") {
    return !source.placementError;
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

export function deriveGeometrySourceMesh(
  runtime: DerivedGeometryRuntime,
  source: DerivedGeometrySource
): Promise<DerivedGeometryResult> {
  if (!isSupportedDerivedGeometrySource(source)) {
    return Promise.reject(new Error(getUnsupportedSourceMessage(source)));
  }

  return deriveSourceMesh(runtime, source as SupportedDerivedGeometrySource);
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

  if (source.kind === "revolve") {
    if (source.placementError) {
      throw new Error(source.placementError);
    }

    return runtime
      .revolveProfile({
        id: source.id,
        sketchPlane: source.sketchPlane,
        profile: source.profile,
        axis: source.axis,
        angleDegrees: source.angleDegrees,
        transform: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      })
      .then((result) =>
        applySketchPlanePlacement(
          result,
          source.sketchPlane,
          source.placementFrame
        )
      );
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
      target: createBooleanRuntimeSource(source.target),
      tool: createPrimitiveBooleanRuntimeSource(source.tool)
    });
  }

  if (source.kind === "hole") {
    if (source.placementError) {
      throw new Error(source.placementError);
    }

    const unsupportedMessage = getUnsupportedHoleSourceMessage(source);

    if (unsupportedMessage) {
      throw new Error(unsupportedMessage);
    }

    return runtime.hole({
      id: source.id,
      target: createBooleanRuntimeSource(source.target),
      tool: {
        sketchPlane: source.tool.sketchPlane,
        circle: source.tool.circle,
        depthMode: source.tool.depthMode,
        depth: source.tool.depth,
        direction: source.tool.direction,
        placementFrame: source.tool.placementFrame
      }
    });
  }

  if (source.kind === "edgeFinish") {
    if (source.placementError) {
      throw new Error(source.placementError);
    }

    const unsupportedMessage = getUnsupportedEdgeFinishSourceMessage(source);

    if (unsupportedMessage) {
      throw new Error(unsupportedMessage);
    }

    return runtime.edgeFinish(
      source.operation === "chamfer"
        ? {
            id: source.id,
            operation: source.operation,
            target: createBooleanRuntimeSource(source.target),
            edgeStableId: source.edgeStableId,
            distance: source.distance
          }
        : {
            id: source.id,
            operation: source.operation,
            target: createBooleanRuntimeSource(source.target),
            edgeStableId: source.edgeStableId,
            radius: source.radius
          }
    );
  }

  if (source.kind === "linearPattern") {
    if (source.placementError) {
      throw new Error(source.placementError);
    }

    return runtime.linearPattern({
      id: source.id,
      seed: createPatternSeedRuntimeSource(source.seed),
      axis: source.axis,
      spacing: source.spacing,
      instanceCount: source.instanceCount
    });
  }

  if (source.kind === "circularPattern") {
    if (source.placementError) {
      throw new Error(source.placementError);
    }

    return runtime.circularPattern({
      id: source.id,
      seed: createPatternSeedRuntimeSource(source.seed),
      rotationAxis: source.rotationAxis,
      totalAngleDegrees: source.totalAngleDegrees,
      instanceCount: source.instanceCount
    });
  }

  if (source.kind === "mirror") {
    if (source.placementError) {
      throw new Error(source.placementError);
    }

    return runtime.mirror({
      id: source.id,
      seed: createPatternSeedRuntimeSource(source.seed),
      mirrorPlane: source.mirrorPlane,
      includeOriginal: source.includeOriginal
    });
  }

  if (source.kind === "shell") {
    if (source.placementError) {
      throw new Error(source.placementError);
    }

    return runtime.shell({
      id: source.id,
      target: createPatternSeedRuntimeSource(source.target),
      wallThickness: source.wallThickness,
      openFaceStableIds: source.openFaceStableIds
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
  return applySketchPlanePlacement(
    result,
    source.sketchPlane,
    source.placementFrame
  );
}

export function applySketchPlanePlacement(
  result: DerivedGeometryResult,
  sketchPlane: DerivedExtrudeGeometrySource["sketchPlane"],
  placementFrame?: SketchDisplayFrame
): DerivedGeometryResult {
  if (!placementFrame) {
    return result;
  }

  return {
    ...result,
    mesh: transformExtrudeMeshToPlacement(
      result.mesh,
      sketchPlane,
      placementFrame
    )
  };
}

function createBooleanRuntimeSource(
  source: DerivedExtrudeGeometrySource | DerivedBooleanExtrudeGeometrySource
): DerivedGeometryBooleanExtrudeInputSource {
  if (source.kind === "extrudeBoolean") {
    return {
      kind: "booleanExtrudes",
      operation: source.operation,
      target: createBooleanRuntimeSource(source.target),
      tool: createPrimitiveBooleanRuntimeSource(source.tool)
    };
  }

  return createPrimitiveBooleanRuntimeSource(source);
}

function createPrimitiveBooleanRuntimeSource(
  source: DerivedExtrudeGeometrySource
): DerivedGeometryBooleanExtrudePrimitiveInputSource {
  return {
    sketchPlane: source.sketchPlane,
    profile: source.profile,
    depth: source.depth,
    side: source.side,
    placementFrame: source.placementFrame
  };
}

function createPatternSeedRuntimeSource(
  seed: DerivedExtrudeGeometrySource | DerivedBooleanExtrudeGeometrySource
): DerivedGeometryPatternSeedSource {
  if (seed.kind === "extrudeBoolean") {
    return {
      kind: "booleanExtrudes",
      operation: seed.operation,
      target: createBooleanRuntimeSource(seed.target),
      tool: createPrimitiveBooleanRuntimeSource(seed.tool)
    };
  }

  return { kind: "extrude", ...createPrimitiveBooleanRuntimeSource(seed) };
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

  if (source.kind === "revolve" && source.placementError) {
    return source.placementError;
  }

  if (source.kind === "hole") {
    return (
      source.placementError ??
      getUnsupportedHoleSourceMessage(source) ??
      "Hole display currently supports circular tools against rectangle or circle authored extrude targets only."
    );
  }

  if (source.kind === "edgeFinish") {
    return (
      source.placementError ??
      getUnsupportedEdgeFinishSourceMessage(source) ??
      "Edge finish display currently supports one generated rectangle edge on a rectangle authored extrude target only."
    );
  }

  if (source.kind === "linearPattern") {
    return (
      source.placementError ??
      "Linear pattern display currently supports authored extrude-family seed bodies only."
    );
  }

  if (source.kind === "circularPattern") {
    return (
      source.placementError ??
      "Circular pattern display currently supports authored extrude-family seed bodies only."
    );
  }

  if (source.kind === "mirror") {
    return (
      source.placementError ??
      "Mirror display currently supports authored extrude-family seed bodies only."
    );
  }

  if (source.kind === "shell") {
    return (
      source.placementError ??
      "Shell display currently supports authored extrude-family target bodies only."
    );
  }

  return "Display geometry generation supports scene primitives, sketch extrudes, supported rectangle/circle boolean results, authored revolves, authored holes, rectangle edge finishing, linear/circular patterns, mirror, and shell features.";
}

function isSupportedBooleanExtrudeSource(
  source: DerivedBooleanExtrudeGeometrySource
): boolean {
  return getUnsupportedBooleanSourceMessage(source) === undefined;
}

function getUnsupportedBooleanSourceMessage(
  source: DerivedBooleanExtrudeGeometrySource
): string | undefined {
  const targetProfileKind = getBooleanSourceProfileKind(source.target);

  if (
    source.operation === "add" &&
    targetProfileKind !== "rectangle" &&
    targetProfileKind !== "circle"
  ) {
    return "Boolean add display currently supports rectangle or circle target extrudes only.";
  }

  if (
    source.operation === "cut" &&
    targetProfileKind !== "rectangle" &&
    targetProfileKind !== "circle"
  ) {
    return "Boolean cut display currently supports rectangle or circle target extrudes only.";
  }

  return undefined;
}

function getBooleanSourceProfileKind(
  source: DerivedExtrudeGeometrySource | DerivedBooleanExtrudeGeometrySource
): DerivedExtrudeGeometrySource["profile"]["kind"] {
  return source.kind === "extrudeBoolean"
    ? getBooleanSourceProfileKind(source.target)
    : source.profile.kind;
}

function isSupportedHoleSource(source: DerivedHoleGeometrySource): boolean {
  return getUnsupportedHoleSourceMessage(source) === undefined;
}

function getUnsupportedHoleSourceMessage(
  source: DerivedHoleGeometrySource
): string | undefined {
  if (
    getBooleanSourceProfileKind(source.target) !== "rectangle" &&
    getBooleanSourceProfileKind(source.target) !== "circle"
  ) {
    return "Hole display currently supports rectangle or circle target extrudes only.";
  }

  if (source.tool.circle.kind !== "circle") {
    return "Hole display currently supports circular sketch tools only.";
  }

  return undefined;
}

function isSupportedEdgeFinishSource(
  source: DerivedEdgeFinishGeometrySource
): boolean {
  return getUnsupportedEdgeFinishSourceMessage(source) === undefined;
}

function getUnsupportedEdgeFinishSourceMessage(
  source: DerivedEdgeFinishGeometrySource
): string | undefined {
  const edgeReference = parseGeneratedRectangleEdgeStableId(
    source.edgeStableId
  );

  if (!edgeReference) {
    return "Edge finish display currently supports generated rectangle edge references only.";
  }

  if (edgeReference.bodyId !== source.target.id) {
    return "Edge finish display requires the selected edge to belong to the target body.";
  }

  const finishTarget = getEdgeFinishProfileSource(
    source.target,
    edgeReference.role
  );

  if (!finishTarget) {
    return "Edge finish display currently supports rectangle source edges and rectangle cut-wall result edges only.";
  }

  const scalar =
    source.operation === "chamfer" ? source.distance : source.radius;
  const scalarLabel = source.operation === "chamfer" ? "distance" : "radius";

  if (!Number.isFinite(scalar) || scalar <= 0) {
    return `Edge finish ${scalarLabel} must be a positive finite number.`;
  }

  return undefined;
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

function getEdgeFinishProfileSource(
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
        : source.kind === "revolve"
          ? {
              kind: source.kind,
              sketchPlane: source.sketchPlane,
              profile: source.profile,
              axis: source.axis,
              angleDegrees: source.angleDegrees,
              placementFrame: source.placementFrame,
              placementError: source.placementError
            }
          : source.kind === "hole"
            ? {
                kind: source.kind,
                target: createDerivedGeometryCacheKey(source.target),
                tool: source.tool,
                placementError: source.placementError
              }
            : source.kind === "edgeFinish"
              ? source.operation === "chamfer"
                ? {
                    kind: source.kind,
                    operation: source.operation,
                    target: createDerivedGeometryCacheKey(source.target),
                    edgeStableId: source.edgeStableId,
                    distance: source.distance,
                    placementError: source.placementError
                  }
                : {
                    kind: source.kind,
                    operation: source.operation,
                    target: createDerivedGeometryCacheKey(source.target),
                    edgeStableId: source.edgeStableId,
                    radius: source.radius,
                    placementError: source.placementError
                  }
              : source.kind === "linearPattern"
                ? {
                    kind: source.kind,
                    seed: createDerivedGeometryCacheKey(source.seed),
                    axis: source.axis,
                    spacing: source.spacing,
                    instanceCount: source.instanceCount,
                    placementError: source.placementError
                  }
                : source.kind === "circularPattern"
                  ? {
                      kind: source.kind,
                      seed: createDerivedGeometryCacheKey(source.seed),
                      rotationAxis: source.rotationAxis,
                      totalAngleDegrees: source.totalAngleDegrees,
                      instanceCount: source.instanceCount,
                      placementError: source.placementError
                    }
                  : source.kind === "mirror"
                    ? {
                        kind: source.kind,
                        seed: createDerivedGeometryCacheKey(source.seed),
                        mirrorPlane: source.mirrorPlane,
                        includeOriginal: source.includeOriginal,
                        placementError: source.placementError
                      }
                    : source.kind === "shell"
                      ? {
                          kind: source.kind,
                          target: createDerivedGeometryCacheKey(source.target),
                          wallThickness: source.wallThickness,
                          openFaceStableIds: source.openFaceStableIds,
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
      return "Display geometry ready";
    case "pending":
      return "Building display geometry";
    case "error":
      if (entry.sourceKind === "extrudeBoolean") {
        return "Boolean display geometry issue";
      }

      if (entry.sourceKind === "revolve") {
        return "Revolve display geometry issue";
      }

      if (entry.sourceKind === "hole") {
        return "Hole display geometry issue";
      }

      if (entry.sourceKind === "edgeFinish") {
        return "Edge finish display geometry issue";
      }

      if (entry.sourceKind === "linearPattern") {
        return "Linear pattern display geometry issue";
      }

      if (entry.sourceKind === "circularPattern") {
        return "Circular pattern display geometry issue";
      }

      if (entry.sourceKind === "mirror") {
        return "Mirror display geometry issue";
      }

      if (entry.sourceKind === "shell") {
        return "Shell display geometry issue";
      }

      return "Primitive fallback";
    case "unsupported":
      if (
        entry.sourceKind === "extrude" ||
        entry.sourceKind === "extrudeBoolean" ||
        entry.sourceKind === "revolve" ||
        entry.sourceKind === "hole" ||
        entry.sourceKind === "edgeFinish" ||
        entry.sourceKind === "linearPattern" ||
        entry.sourceKind === "circularPattern" ||
        entry.sourceKind === "mirror" ||
        entry.sourceKind === "shell"
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

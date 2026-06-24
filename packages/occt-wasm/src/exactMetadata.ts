import type { OpenCascadeInstance, TopoDS_Shape } from "opencascade.js";
import {
  makeBooleanExtrudeShape,
  type OcctBooleanExtrudePrimitiveSource,
  type OcctBooleanExtrudeResultSource,
  type OcctBooleanExtrudeSource
} from "./booleanExtrudes";
import {
  makeRevolveProfileShape,
  type OcctRevolveAxis,
  type OcctRevolvePlacementFrame,
  type OcctRevolveProfile,
  type OcctRevolveSketchPlane
} from "./revolveProfile";
import { withOcctHoleResultShape, type OcctHoleToolSource } from "./hole";
import {
  withOcctEdgeFinishResultShape,
  type OcctChamferEdgeFinishInput,
  type OcctFilletEdgeFinishInput
} from "./edgeFinish";
import type { OcctLoader } from "./tessellateBox";

const TOPOLOGY_EVIDENCE_TOLERANCE = 1e-6;

export type OcctExactBodyMetadataSource =
  | OcctExactExtrudeMetadataSource
  | OcctExactBooleanExtrudesMetadataSource
  | OcctExactRevolveMetadataSource
  | OcctExactHoleMetadataSource
  | OcctExactEdgeFinishMetadataSource;

export interface OcctExactExtrudeMetadataSource extends OcctBooleanExtrudePrimitiveSource {
  readonly kind: "extrude";
}

export interface OcctExactBooleanExtrudesMetadataSource extends OcctBooleanExtrudeResultSource {
  readonly kind: "booleanExtrudes";
}

export interface OcctExactRevolveMetadataSource {
  readonly kind: "revolve";
  readonly sketchPlane: OcctRevolveSketchPlane;
  readonly profile: OcctRevolveProfile;
  readonly axis: OcctRevolveAxis;
  readonly angleDegrees: number;
  readonly placementFrame?: OcctRevolvePlacementFrame;
}

export interface OcctExactHoleMetadataSource {
  readonly kind: "hole";
  readonly target: OcctBooleanExtrudeSource;
  readonly tool: OcctHoleToolSource;
}

export type OcctExactEdgeFinishMetadataSource =
  | ({
      readonly kind: "edgeFinish";
    } & Omit<
      OcctChamferEdgeFinishInput,
      "linearDeflection" | "angularDeflection"
    >)
  | ({
      readonly kind: "edgeFinish";
    } & Omit<
      OcctFilletEdgeFinishInput,
      "linearDeflection" | "angularDeflection"
    >);

export interface OcctExactBodyMetadataInput {
  readonly source: OcctExactBodyMetadataSource;
}

export interface OcctExactBodyMetadata {
  readonly sourceKind: OcctExactBodyMetadataSource["kind"];
  readonly bounds: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  };
  readonly volume: number;
  readonly surfaceArea: number;
  readonly centroid: readonly [number, number, number];
  readonly topologyCounts: {
    readonly solidCount: number;
    readonly faceCount: number;
    readonly edgeCount: number;
    readonly vertexCount: number;
  };
  readonly measurementSource: "kernel-derived";
  readonly measurementConfidence: "kernel-derived";
  readonly diagnostics: readonly {
    readonly code: string;
    readonly message: string;
  }[];
}

export type OcctTopologySnapshotStatus = "ready" | "partial";
export type OcctTopologyEntityKind =
  | "body"
  | "solid"
  | "face"
  | "wire"
  | "edge"
  | "vertex"
  | "loop"
  | "coedge"
  | "axis";

export interface OcctTopologyEntityDescriptor {
  readonly localId: string;
  readonly kind: OcctTopologyEntityKind;
  readonly source: "kernel-derived";
  readonly signature: string;
  readonly bounds?: OcctExactBodyMetadata["bounds"];
  readonly surfaceClass?:
    | "plane"
    | "cylinder"
    | "cone"
    | "sphere"
    | "torus"
    | "bspline"
    | "unknown";
  readonly curveClass?: "line" | "circle" | "ellipse" | "bspline" | "unknown";
  readonly point?: readonly [number, number, number];
  readonly midpoint?: readonly [number, number, number];
  readonly normal?: readonly [number, number, number];
  readonly axis?: readonly [number, number, number];
  readonly radius?: number;
  readonly area?: number;
  readonly length?: number;
  readonly adjacency?: {
    readonly available: boolean;
    readonly neighborSignatureHashes: readonly string[];
  };
  readonly orientation?:
    | "forward"
    | "reversed"
    | "internal"
    | "external"
    | "unknown";
  readonly loopRole?: "outer" | "inner" | "unknown";
  readonly relationships?: {
    readonly parentFaceLocalId?: string;
    readonly parentWireLocalId?: string;
    readonly parentLoopLocalId?: string;
    readonly underlyingWireLocalId?: string;
    readonly underlyingEdgeLocalId?: string;
    readonly startVertexLocalId?: string;
    readonly endVertexLocalId?: string;
    readonly childWireLocalIds?: readonly string[];
    readonly childLoopLocalIds?: readonly string[];
    readonly childCoedgeLocalIds?: readonly string[];
    readonly childEdgeLocalIds?: readonly string[];
    readonly adjacentFaceLocalIds?: readonly string[];
  };
}

export interface OcctTopologyEntityCounts {
  readonly bodyCount: number;
  readonly solidCount: number;
  readonly faceCount: number;
  readonly wireCount: number;
  readonly edgeCount: number;
  readonly vertexCount: number;
  readonly loopCount: number;
  readonly coedgeCount: number;
  readonly axisCount: number;
}

export interface OcctTopologyDiagnostic {
  readonly code:
    | "GEOMETRY_TOPOLOGY_SNAPSHOT_EXTRACTED"
    | "GEOMETRY_TOPOLOGY_DESCRIPTOR_EVIDENCE_EXTRACTED"
    | "GEOMETRY_TOPOLOGY_ADJACENCY_EXTRACTED"
    | "GEOMETRY_TOPOLOGY_ENTITY_KIND_UNAVAILABLE"
    | "GEOMETRY_TOPOLOGY_ADJACENCY_UNAVAILABLE"
    | "GEOMETRY_TOPOLOGY_SIGNATURE_LIMITED";
  readonly severity: "info" | "warning";
  readonly message: string;
  readonly entityKind?: OcctTopologyEntityKind;
}

export interface OcctExactTopologySnapshot {
  readonly sourceKind: OcctExactBodyMetadataSource["kind"];
  readonly status: OcctTopologySnapshotStatus;
  readonly entityCounts: OcctTopologyEntityCounts;
  readonly entityCount: number;
  readonly entities: readonly OcctTopologyEntityDescriptor[];
  readonly unsupportedEntityKinds: readonly OcctTopologyEntityKind[];
  readonly adjacencyAvailable: boolean;
  readonly signatureAlgorithm: "partbench-derived-topology-snapshot-v1";
  readonly signature: string;
  readonly source: "kernel-derived";
  readonly diagnostics: readonly OcctTopologyDiagnostic[];
}

interface UnavailableBindingError {
  readonly code: "UNAVAILABLE_BINDING";
  readonly message: string;
}

interface EmptyResultError {
  readonly code: "EMPTY_RESULT";
  readonly message: string;
}

interface OcctPointLike {
  X(): number;
  Y(): number;
  Z(): number;
}

interface OcctDeletablePointLike extends OcctPointLike {
  delete(): void;
}

interface OcctAxisLike {
  Direction(): OcctDeletablePointLike;
  delete(): void;
}

type OcctSurfaceAdaptor = InstanceType<
  OpenCascadeInstance["BRepAdaptor_Surface_2"]
>;
type OcctCurveAdaptor = InstanceType<
  OpenCascadeInstance["BRepAdaptor_Curve_2"]
>;
type OcctTopologyOrientation = NonNullable<
  OcctTopologyEntityDescriptor["orientation"]
>;
type OcctTopologyRelationships = NonNullable<
  OcctTopologyEntityDescriptor["relationships"]
>;

interface TopologyShapeEntry {
  readonly kind: Extract<
    OcctTopologyEntityKind,
    "solid" | "face" | "wire" | "edge" | "vertex"
  >;
  readonly index: number;
  readonly localId: string;
  readonly shape: TopoDS_Shape;
  readonly bounds: OcctExactBodyMetadata["bounds"];
  readonly signature: string;
}

interface TopologyShapeIndex {
  readonly entries: readonly TopologyShapeEntry[];
  readonly map: InstanceType<
    OpenCascadeInstance["TopTools_IndexedMapOfShape_1"]
  >;
  find(shape: TopoDS_Shape): TopologyShapeEntry | undefined;
  delete(): void;
}

interface TopologyRelationshipEvidence {
  readonly adjacencyAvailable: boolean;
  readonly loopEntities: readonly OcctTopologyEntityDescriptor[];
  readonly coedgeEntities: readonly OcctTopologyEntityDescriptor[];
  readonly relationshipsByLocalId: ReadonlyMap<
    string,
    OcctTopologyRelationships
  >;
  readonly adjacencyByLocalId: ReadonlyMap<
    string,
    OcctTopologyEntityDescriptor["adjacency"]
  >;
}

export async function createOcctExactBodyMetadataWithLoader(
  loadOcct: OcctLoader,
  input: OcctExactBodyMetadataInput
): Promise<OcctExactBodyMetadata> {
  const oc = await loadOcct();

  return createOcctExactBodyMetadataWithInstance(oc, input);
}

export function createOcctExactBodyMetadataWithInstance(
  oc: OpenCascadeInstance,
  input: OcctExactBodyMetadataInput
): OcctExactBodyMetadata {
  return withOcctExactBodyShape(oc, input.source, (shape, sourceKind) =>
    readExactBodyMetadata(oc, shape, sourceKind)
  );
}

export async function createOcctExactTopologySnapshotWithLoader(
  loadOcct: OcctLoader,
  input: OcctExactBodyMetadataInput
): Promise<OcctExactTopologySnapshot> {
  const oc = await loadOcct();

  return createOcctExactTopologySnapshotWithInstance(oc, input);
}

export function createOcctExactTopologySnapshotWithInstance(
  oc: OpenCascadeInstance,
  input: OcctExactBodyMetadataInput
): OcctExactTopologySnapshot {
  return withOcctExactBodyShape(oc, input.source, (shape, sourceKind) =>
    readExactTopologySnapshot(oc, shape, sourceKind)
  );
}

export function withOcctExactBodyShape<T>(
  oc: OpenCascadeInstance,
  source: OcctExactBodyMetadataSource,
  readShape: (
    shape: TopoDS_Shape,
    sourceKind: OcctExactBodyMetadataSource["kind"]
  ) => T
): T {
  assertExactMetadataBindings(oc);

  if (source.kind === "extrude") {
    const shapeBuilder = makeBooleanExtrudeShape(oc, source);

    try {
      return readShape(shapeBuilder.Shape(), source.kind);
    } finally {
      shapeBuilder.delete();
    }
  }

  if (source.kind === "revolve") {
    const shapeHandle = makeRevolveProfileShape(oc, source);

    try {
      return readShape(shapeHandle.shape, source.kind);
    } finally {
      shapeHandle.delete();
    }
  }

  if (source.kind === "hole") {
    return withOcctHoleResultShape(oc, source, (shape) =>
      readShape(shape, source.kind)
    );
  }

  if (source.kind === "edgeFinish") {
    return withOcctEdgeFinishResultShape(oc, source, (shape) =>
      readShape(shape, source.kind)
    );
  }

  return withOcctBooleanExactBodyShape(oc, source, (shape) =>
    readShape(shape, source.kind)
  );
}

function withOcctBooleanExactBodyShape<T>(
  oc: OpenCascadeInstance,
  source: OcctExactBooleanExtrudesMetadataSource,
  readShape: (shape: TopoDS_Shape) => T
): T {
  const targetShape = makeBooleanExtrudeShape(oc, source.target);
  const toolShape = makeBooleanExtrudeShape(oc, source.tool);
  const range = new oc.Message_ProgressRange_1();
  let booleanOperation:
    | InstanceType<typeof oc.BRepAlgoAPI_Fuse_3>
    | InstanceType<typeof oc.BRepAlgoAPI_Cut_3>
    | undefined;

  try {
    booleanOperation =
      source.operation === "add"
        ? new oc.BRepAlgoAPI_Fuse_3(
            targetShape.Shape(),
            toolShape.Shape(),
            range
          )
        : new oc.BRepAlgoAPI_Cut_3(
            targetShape.Shape(),
            toolShape.Shape(),
            range
          );

    if (booleanOperation.HasErrors()) {
      throw new Error(`Open CASCADE boolean ${source.operation} failed.`);
    }

    return readShape(booleanOperation.Shape());
  } finally {
    booleanOperation?.delete();
    range.delete();
    targetShape.delete();
    toolShape.delete();
  }
}

function readExactBodyMetadata(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  sourceKind: OcctExactBodyMetadataSource["kind"]
): OcctExactBodyMetadata {
  const bounds = readBounds(oc, shape);
  const volumeProps = new oc.GProp_GProps_1();
  const surfaceProps = new oc.GProp_GProps_1();

  try {
    oc.BRepGProp.VolumeProperties_1(shape, volumeProps, true, false, false);
    oc.BRepGProp.SurfaceProperties_1(shape, surfaceProps, false, false);

    const centroidPoint = volumeProps.CentreOfMass();

    try {
      return {
        sourceKind,
        bounds,
        volume: Math.abs(volumeProps.Mass()),
        surfaceArea: Math.abs(surfaceProps.Mass()),
        centroid: [centroidPoint.X(), centroidPoint.Y(), centroidPoint.Z()],
        topologyCounts: {
          solidCount: countSubshapes(oc, shape, "TopAbs_SOLID"),
          faceCount: countSubshapes(oc, shape, "TopAbs_FACE"),
          edgeCount: countSubshapes(oc, shape, "TopAbs_EDGE"),
          vertexCount: countSubshapes(oc, shape, "TopAbs_VERTEX")
        },
        measurementSource: "kernel-derived",
        measurementConfidence: "kernel-derived",
        diagnostics: []
      };
    } finally {
      centroidPoint.delete();
    }
  } finally {
    volumeProps.delete();
    surfaceProps.delete();
  }
}

export function readExactTopologySnapshot(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  sourceKind: OcctExactBodyMetadataSource["kind"]
): OcctExactTopologySnapshot {
  const solidIndex = createTopologyShapeIndex(
    oc,
    shape,
    "solid",
    "TopAbs_SOLID",
    sourceKind
  );
  const faceIndex = createTopologyShapeIndex(
    oc,
    shape,
    "face",
    "TopAbs_FACE",
    sourceKind
  );
  const wireIndex = createTopologyShapeIndex(
    oc,
    shape,
    "wire",
    "TopAbs_WIRE",
    sourceKind
  );
  const edgeIndex = createTopologyShapeIndex(
    oc,
    shape,
    "edge",
    "TopAbs_EDGE",
    sourceKind
  );
  const vertexIndex = createTopologyShapeIndex(
    oc,
    shape,
    "vertex",
    "TopAbs_VERTEX",
    sourceKind
  );

  try {
    const bodyEntity = createTopologyEntity({
      oc,
      kind: "body",
      shape,
      index: 1,
      sourceKind,
      bounds: readBounds(oc, shape)
    });
    const relationshipEvidence = createTopologyRelationshipEvidence(oc, {
      sourceKind,
      faceIndex,
      wireIndex,
      edgeIndex,
      vertexIndex
    });
    const baseEntities = [
      ...createTopologyEntitiesFromIndex(oc, sourceKind, solidIndex),
      ...createTopologyEntitiesFromIndex(oc, sourceKind, faceIndex),
      ...createTopologyEntitiesFromIndex(oc, sourceKind, wireIndex),
      ...createTopologyEntitiesFromIndex(oc, sourceKind, edgeIndex),
      ...createTopologyEntitiesFromIndex(oc, sourceKind, vertexIndex)
    ].map((entity) =>
      applyTopologyRelationshipEvidence(entity, relationshipEvidence)
    );
    const entities = [
      bodyEntity,
      ...baseEntities,
      ...relationshipEvidence.loopEntities,
      ...relationshipEvidence.coedgeEntities
    ];
    const entityCounts: OcctTopologyEntityCounts = {
      bodyCount: 1,
      solidCount: solidIndex.entries.length,
      faceCount: faceIndex.entries.length,
      wireCount: wireIndex.entries.length,
      edgeCount: edgeIndex.entries.length,
      vertexCount: vertexIndex.entries.length,
      loopCount: relationshipEvidence.loopEntities.length,
      coedgeCount: relationshipEvidence.coedgeEntities.length,
      axisCount: 0
    };
    const unsupportedEntityKinds = [
      "axis"
    ] satisfies readonly OcctTopologyEntityKind[];
    const signature = createDerivedTopologySignature({
      sourceKind,
      entityCounts,
      entities: entities
        .map((entity) => ({
          kind: entity.kind,
          signature: entity.signature
        }))
        .sort((left, right) =>
          `${left.kind}:${left.signature}`.localeCompare(
            `${right.kind}:${right.signature}`
          )
        )
    });

    return {
      sourceKind,
      status: "partial",
      entityCounts,
      entityCount: entities.length,
      entities,
      unsupportedEntityKinds,
      adjacencyAvailable: relationshipEvidence.adjacencyAvailable,
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
      signature,
      source: "kernel-derived",
      diagnostics: [
        {
          code: "GEOMETRY_TOPOLOGY_DESCRIPTOR_EVIDENCE_EXTRACTED",
          severity: "info",
          message:
            "Open CASCADE adaptor and property bindings extracted exact surface, curve, point, area, length, axis, normal, and radius descriptor evidence where supported."
        },
        {
          code: "GEOMETRY_TOPOLOGY_ADJACENCY_EXTRACTED",
          severity: "info",
          message:
            "Open CASCADE wire traversal and edge-face maps extracted loop, coedge, orientation, and adjacency evidence."
        },
        {
          code: "GEOMETRY_TOPOLOGY_SNAPSHOT_EXTRACTED",
          severity: "info",
          message:
            "Open CASCADE exact topology snapshot extracted body, solid, face, wire, loop, coedge, edge, and vertex descriptors from derived B-rep evidence."
        },
        ...unsupportedEntityKinds.map((entityKind) => ({
          code: "GEOMETRY_TOPOLOGY_ENTITY_KIND_UNAVAILABLE" as const,
          severity: "warning" as const,
          entityKind,
          message: `${entityKind} topology descriptors are not exposed by the current Open CASCADE snapshot binding.`
        })),
        {
          code: "GEOMETRY_TOPOLOGY_SIGNATURE_LIMITED",
          severity: "warning",
          message:
            "Topology signatures include source kind, topology kind, and per-entity bounds; exact descriptor and adjacency evidence are available for matching but remain outside the v1 signature payload."
        }
      ]
    };
  } finally {
    solidIndex.delete();
    faceIndex.delete();
    wireIndex.delete();
    edgeIndex.delete();
    vertexIndex.delete();
  }
}

function createTopologyShapeIndex(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  kind: Extract<
    OcctTopologyEntityKind,
    "solid" | "face" | "wire" | "edge" | "vertex"
  >,
  shapeTypeKey:
    | "TopAbs_SOLID"
    | "TopAbs_FACE"
    | "TopAbs_WIRE"
    | "TopAbs_EDGE"
    | "TopAbs_VERTEX",
  sourceKind: OcctExactBodyMetadataSource["kind"]
): TopologyShapeIndex {
  const shapeType = oc.TopAbs_ShapeEnum[shapeTypeKey] as unknown as Parameters<
    typeof oc.TopExp.MapShapes_1
  >[1];
  const shapeMap = new oc.TopTools_IndexedMapOfShape_1();
  const entries: TopologyShapeEntry[] = [];

  oc.TopExp.MapShapes_1(shape, shapeType, shapeMap);

  for (let index = 1; index <= shapeMap.Size(); index += 1) {
    const current = shapeMap.FindKey(index);
    const bounds = readBounds(oc, current);

    entries.push({
      kind,
      index,
      localId: createTopologyEntityLocalId(kind, index),
      shape: current,
      bounds,
      signature: createTopologyEntitySignature({
        sourceKind,
        entityKind: kind,
        bounds
      })
    });
  }

  return {
    entries,
    map: shapeMap,
    find: (target) => {
      const index = shapeMap.FindIndex(target);

      return index > 0 ? entries[index - 1] : undefined;
    },
    delete: () => {
      for (const entry of entries) {
        entry.shape.delete();
      }

      shapeMap.delete();
    }
  };
}

function createTopologyEntitiesFromIndex(
  oc: OpenCascadeInstance,
  sourceKind: OcctExactBodyMetadataSource["kind"],
  index: TopologyShapeIndex
): readonly OcctTopologyEntityDescriptor[] {
  return index.entries.map((entry) =>
    createTopologyEntity({
      oc,
      kind: entry.kind,
      shape: entry.shape,
      index: entry.index,
      sourceKind,
      bounds: entry.bounds
    })
  );
}

function createTopologyRelationshipEvidence(
  oc: OpenCascadeInstance,
  input: {
    readonly sourceKind: OcctExactBodyMetadataSource["kind"];
    readonly faceIndex: TopologyShapeIndex;
    readonly wireIndex: TopologyShapeIndex;
    readonly edgeIndex: TopologyShapeIndex;
    readonly vertexIndex: TopologyShapeIndex;
  }
): TopologyRelationshipEvidence {
  const loopEntities: OcctTopologyEntityDescriptor[] = [];
  const coedgeEntities: OcctTopologyEntityDescriptor[] = [];
  const relationshipsByLocalId = new Map<string, OcctTopologyRelationships>();
  const faceNeighborSignatures = new Map<string, Set<string>>();
  const edgeNeighborSignatures = new Map<string, Set<string>>();

  for (const faceEntry of input.faceIndex.entries) {
    let face: ReturnType<typeof oc.TopoDS.Face_1> | undefined;
    let wireExplorer: InstanceType<typeof oc.TopExp_Explorer_2> | undefined;
    let outerWire: TopoDS_Shape | undefined;

    try {
      face = oc.TopoDS.Face_1(faceEntry.shape);
      outerWire = readOuterWire(oc, face);
      const wireShapeType = oc.TopAbs_ShapeEnum
        .TopAbs_WIRE as unknown as ConstructorParameters<
        typeof oc.TopExp_Explorer_2
      >[1];
      const avoidShapeType = oc.TopAbs_ShapeEnum
        .TopAbs_SHAPE as unknown as ConstructorParameters<
        typeof oc.TopExp_Explorer_2
      >[2];
      wireExplorer = new oc.TopExp_Explorer_2(
        face,
        wireShapeType,
        avoidShapeType
      );

      for (; wireExplorer.More(); wireExplorer.Next()) {
        const wireShape = wireExplorer.Current();

        try {
          const wireEntry = input.wireIndex.find(wireShape);
          const loopEntity = createLoopTopologyEntity(oc, {
            sourceKind: input.sourceKind,
            index: loopEntities.length + 1,
            faceEntry,
            wireEntry,
            wireShape,
            loopRole: readLoopRole(wireShape, outerWire)
          });
          const coedgeEvidence = createCoedgeTopologyEntities(oc, {
            sourceKind: input.sourceKind,
            face,
            faceEntry,
            wireShape,
            wireEntry,
            loopEntity,
            edgeIndex: input.edgeIndex,
            vertexIndex: input.vertexIndex,
            startingIndex: coedgeEntities.length + 1
          });

          loopEntities.push({
            ...loopEntity,
            relationships: mergeTopologyRelationships(
              loopEntity.relationships,
              {
                childCoedgeLocalIds: coedgeEvidence.coedgeLocalIds,
                childEdgeLocalIds: coedgeEvidence.edgeLocalIds
              }
            ),
            adjacency: {
              available: true,
              neighborSignatureHashes: uniqueSorted(
                coedgeEvidence.edgeSignatures
              )
            }
          });
          coedgeEntities.push(...coedgeEvidence.coedgeEntities);
          mergeRelationship(relationshipsByLocalId, faceEntry.localId, {
            childWireLocalIds: wireEntry ? [wireEntry.localId] : [],
            childLoopLocalIds: [loopEntity.localId],
            childCoedgeLocalIds: coedgeEvidence.coedgeLocalIds,
            childEdgeLocalIds: coedgeEvidence.edgeLocalIds
          });

          if (wireEntry) {
            mergeRelationship(relationshipsByLocalId, wireEntry.localId, {
              parentFaceLocalId: faceEntry.localId,
              childLoopLocalIds: [loopEntity.localId],
              childCoedgeLocalIds: coedgeEvidence.coedgeLocalIds,
              childEdgeLocalIds: coedgeEvidence.edgeLocalIds
            });
          }

          addNeighborSignatures(
            faceNeighborSignatures,
            faceEntry.localId,
            coedgeEvidence.edgeSignatures
          );

          for (const edge of coedgeEvidence.edgeEvidence) {
            mergeRelationship(relationshipsByLocalId, edge.localId, {
              adjacentFaceLocalIds: [faceEntry.localId]
            });
            addNeighborSignatures(edgeNeighborSignatures, edge.localId, [
              faceEntry.signature
            ]);
          }
        } finally {
          wireShape.delete();
        }
      }
    } finally {
      outerWire?.delete();
      wireExplorer?.delete();
      face?.delete();
    }
  }

  return {
    adjacencyAvailable: true,
    loopEntities,
    coedgeEntities,
    relationshipsByLocalId,
    adjacencyByLocalId: createAdjacencyEvidenceByLocalId(
      faceNeighborSignatures,
      edgeNeighborSignatures
    )
  };
}

function createLoopTopologyEntity(
  oc: OpenCascadeInstance,
  input: {
    readonly sourceKind: OcctExactBodyMetadataSource["kind"];
    readonly index: number;
    readonly faceEntry: TopologyShapeEntry;
    readonly wireEntry: TopologyShapeEntry | undefined;
    readonly wireShape: TopoDS_Shape;
    readonly loopRole?: OcctTopologyEntityDescriptor["loopRole"];
  }
): OcctTopologyEntityDescriptor {
  const bounds = readBounds(oc, input.wireShape);
  const localId = createTopologyEntityLocalId("loop", input.index);

  return {
    localId,
    kind: "loop",
    source: "kernel-derived",
    bounds,
    signature: createTopologyEntitySignature({
      sourceKind: input.sourceKind,
      entityKind: "loop",
      bounds
    }),
    orientation: readShapeOrientation(oc, input.wireShape),
    ...(input.loopRole ? { loopRole: input.loopRole } : {}),
    adjacency: {
      available: true,
      neighborSignatureHashes: []
    },
    relationships: {
      parentFaceLocalId: input.faceEntry.localId,
      ...(input.wireEntry
        ? { underlyingWireLocalId: input.wireEntry.localId }
        : {})
    }
  };
}

function readOuterWire(
  oc: OpenCascadeInstance,
  face: ReturnType<typeof oc.TopoDS.Face_1>
): TopoDS_Shape | undefined {
  const outerWire = (
    oc.BRepTools as unknown as {
      readonly OuterWire?: (faceShape: unknown) => TopoDS_Shape;
    }
  ).OuterWire;

  if (typeof outerWire !== "function") {
    return undefined;
  }

  try {
    return outerWire(face);
  } catch {
    return undefined;
  }
}

function readLoopRole(
  wireShape: TopoDS_Shape,
  outerWire: TopoDS_Shape | undefined
): OcctTopologyEntityDescriptor["loopRole"] | undefined {
  if (!outerWire) {
    return undefined;
  }

  try {
    return wireShape.IsSame(outerWire) ? "outer" : "inner";
  } catch {
    return "unknown";
  }
}

function createCoedgeTopologyEntities(
  oc: OpenCascadeInstance,
  input: {
    readonly sourceKind: OcctExactBodyMetadataSource["kind"];
    readonly face: ReturnType<typeof oc.TopoDS.Face_1>;
    readonly faceEntry: TopologyShapeEntry;
    readonly wireShape: TopoDS_Shape;
    readonly wireEntry: TopologyShapeEntry | undefined;
    readonly loopEntity: OcctTopologyEntityDescriptor;
    readonly edgeIndex: TopologyShapeIndex;
    readonly vertexIndex: TopologyShapeIndex;
    readonly startingIndex: number;
  }
): {
  readonly coedgeEntities: readonly OcctTopologyEntityDescriptor[];
  readonly coedgeLocalIds: readonly string[];
  readonly edgeLocalIds: readonly string[];
  readonly edgeSignatures: readonly string[];
  readonly edgeEvidence: readonly {
    readonly localId: string;
    readonly signature: string;
  }[];
} {
  let wire: ReturnType<typeof oc.TopoDS.Wire_1> | undefined;
  let explorer: InstanceType<typeof oc.BRepTools_WireExplorer_3> | undefined;
  const coedgeEntities: OcctTopologyEntityDescriptor[] = [];
  const edgeLocalIds: string[] = [];
  const edgeSignatures: string[] = [];
  const edgeEvidence: {
    readonly localId: string;
    readonly signature: string;
  }[] = [];

  try {
    wire = oc.TopoDS.Wire_1(input.wireShape);
    explorer = new oc.BRepTools_WireExplorer_3(wire, input.face);

    for (; explorer.More(); explorer.Next()) {
      const edgeShape = explorer.Current();
      let edge: ReturnType<typeof oc.TopoDS.Edge_1> | undefined;
      let firstVertex: ReturnType<typeof oc.TopExp.FirstVertex> | undefined;
      let lastVertex: ReturnType<typeof oc.TopExp.LastVertex> | undefined;

      try {
        edge = oc.TopoDS.Edge_1(edgeShape);
        firstVertex = oc.TopExp.FirstVertex(edge, true);
        lastVertex = oc.TopExp.LastVertex(edge, true);

        const edgeEntry = input.edgeIndex.find(edgeShape);
        const startVertexEntry = input.vertexIndex.find(firstVertex);
        const endVertexEntry = input.vertexIndex.find(lastVertex);
        const bounds = edgeEntry?.bounds ?? readBounds(oc, edgeShape);
        const localId = createTopologyEntityLocalId(
          "coedge",
          input.startingIndex + coedgeEntities.length
        );
        const edgeLocalId = edgeEntry?.localId;
        const edgeSignature =
          edgeEntry?.signature ??
          createTopologyEntitySignature({
            sourceKind: input.sourceKind,
            entityKind: "edge",
            bounds
          });

        if (edgeLocalId) {
          edgeLocalIds.push(edgeLocalId);
          edgeSignatures.push(edgeSignature);
          edgeEvidence.push({
            localId: edgeLocalId,
            signature: edgeSignature
          });
        }

        coedgeEntities.push({
          localId,
          kind: "coedge",
          source: "kernel-derived",
          bounds,
          signature: createTopologyEntitySignature({
            sourceKind: input.sourceKind,
            entityKind: "coedge",
            bounds
          }),
          orientation: readTopAbsOrientation(oc, explorer.Orientation()),
          adjacency: {
            available: true,
            neighborSignatureHashes: edgeEntry ? [edgeEntry.signature] : []
          },
          relationships: {
            parentFaceLocalId: input.faceEntry.localId,
            parentLoopLocalId: input.loopEntity.localId,
            ...(input.wireEntry
              ? { parentWireLocalId: input.wireEntry.localId }
              : {}),
            ...(edgeLocalId ? { underlyingEdgeLocalId: edgeLocalId } : {}),
            ...(startVertexEntry
              ? { startVertexLocalId: startVertexEntry.localId }
              : {}),
            ...(endVertexEntry
              ? { endVertexLocalId: endVertexEntry.localId }
              : {})
          }
        });
      } finally {
        lastVertex?.delete();
        firstVertex?.delete();
        edge?.delete();
        edgeShape.delete();
      }
    }
  } finally {
    explorer?.delete();
    wire?.delete();
  }

  return {
    coedgeEntities,
    coedgeLocalIds: coedgeEntities.map((entity) => entity.localId),
    edgeLocalIds,
    edgeSignatures,
    edgeEvidence
  };
}

function applyTopologyRelationshipEvidence(
  entity: OcctTopologyEntityDescriptor,
  evidence: TopologyRelationshipEvidence
): OcctTopologyEntityDescriptor {
  return {
    ...entity,
    ...(evidence.adjacencyByLocalId.has(entity.localId)
      ? { adjacency: evidence.adjacencyByLocalId.get(entity.localId) }
      : {}),
    ...(evidence.relationshipsByLocalId.has(entity.localId)
      ? { relationships: evidence.relationshipsByLocalId.get(entity.localId) }
      : {})
  };
}

function createAdjacencyEvidenceByLocalId(
  faceNeighborSignatures: ReadonlyMap<string, ReadonlySet<string>>,
  edgeNeighborSignatures: ReadonlyMap<string, ReadonlySet<string>>
): ReadonlyMap<string, OcctTopologyEntityDescriptor["adjacency"]> {
  const adjacencyByLocalId = new Map<
    string,
    OcctTopologyEntityDescriptor["adjacency"]
  >();

  for (const [localId, signatures] of faceNeighborSignatures) {
    adjacencyByLocalId.set(localId, {
      available: true,
      neighborSignatureHashes: uniqueSorted([...signatures])
    });
  }

  for (const [localId, signatures] of edgeNeighborSignatures) {
    adjacencyByLocalId.set(localId, {
      available: true,
      neighborSignatureHashes: uniqueSorted([...signatures])
    });
  }

  return adjacencyByLocalId;
}

function mergeRelationship(
  relationshipsByLocalId: Map<string, OcctTopologyRelationships>,
  localId: string,
  next: OcctTopologyRelationships
): void {
  relationshipsByLocalId.set(
    localId,
    mergeTopologyRelationships(relationshipsByLocalId.get(localId), next)
  );
}

function mergeTopologyRelationships(
  current: OcctTopologyRelationships | undefined,
  next: OcctTopologyRelationships
): OcctTopologyRelationships {
  return {
    ...current,
    ...next,
    childWireLocalIds: appendUnique(
      current?.childWireLocalIds,
      next.childWireLocalIds
    ),
    childLoopLocalIds: appendUnique(
      current?.childLoopLocalIds,
      next.childLoopLocalIds
    ),
    childCoedgeLocalIds: appendUnique(
      current?.childCoedgeLocalIds,
      next.childCoedgeLocalIds
    ),
    childEdgeLocalIds: appendUnique(
      current?.childEdgeLocalIds,
      next.childEdgeLocalIds
    ),
    adjacentFaceLocalIds: appendUnique(
      current?.adjacentFaceLocalIds,
      next.adjacentFaceLocalIds
    )
  };
}

function addNeighborSignatures(
  neighborsByLocalId: Map<string, Set<string>>,
  localId: string,
  signatures: readonly string[]
): void {
  const signaturesForLocalId = neighborsByLocalId.get(localId) ?? new Set();

  for (const signature of signatures) {
    signaturesForLocalId.add(signature);
  }

  neighborsByLocalId.set(localId, signaturesForLocalId);
}

function appendUnique(
  current: readonly string[] | undefined,
  next: readonly string[] | undefined
): readonly string[] | undefined {
  if (!current && !next) {
    return undefined;
  }

  return [...new Set([...(current ?? []), ...(next ?? [])])];
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function createTopologyEntity(input: {
  readonly oc: OpenCascadeInstance;
  readonly kind: Extract<
    OcctTopologyEntityKind,
    "body" | "solid" | "face" | "wire" | "edge" | "vertex"
  >;
  readonly shape?: TopoDS_Shape;
  readonly index: number;
  readonly sourceKind: OcctExactBodyMetadataSource["kind"];
  readonly bounds: OcctExactBodyMetadata["bounds"];
}): OcctTopologyEntityDescriptor {
  const evidence = createTopologyEntityEvidence(
    input.oc,
    input.kind,
    input.shape,
    input.bounds
  );

  return {
    localId: createTopologyEntityLocalId(input.kind, input.index),
    kind: input.kind,
    source: "kernel-derived",
    bounds: input.bounds,
    ...evidence,
    ...(input.shape
      ? { orientation: readShapeOrientation(input.oc, input.shape) }
      : {}),
    signature: createTopologyEntitySignature({
      sourceKind: input.sourceKind,
      entityKind: input.kind,
      bounds: input.bounds
    })
  };
}

function createTopologyEntityLocalId(
  kind: OcctTopologyEntityKind,
  index: number
): string {
  return `snapshot-local:${kind}:${index}`;
}

function createTopologyEntitySignature(input: {
  readonly sourceKind: OcctExactBodyMetadataSource["kind"];
  readonly entityKind: OcctTopologyEntityKind;
  readonly bounds: OcctExactBodyMetadata["bounds"];
}): string {
  return createDerivedTopologySignature({
    sourceKind: input.sourceKind,
    entityKind: input.entityKind,
    bounds: normalizeBoundsForSignature(input.bounds)
  });
}

function readShapeOrientation(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape
): OcctTopologyOrientation {
  return readTopAbsOrientation(oc, shape.Orientation_1());
}

function readTopAbsOrientation(
  oc: OpenCascadeInstance,
  orientation: ReturnType<TopoDS_Shape["Orientation_1"]>
): OcctTopologyOrientation {
  if (orientation === oc.TopAbs_Orientation.TopAbs_FORWARD) {
    return "forward";
  }

  if (orientation === oc.TopAbs_Orientation.TopAbs_REVERSED) {
    return "reversed";
  }

  if (orientation === oc.TopAbs_Orientation.TopAbs_INTERNAL) {
    return "internal";
  }

  if (orientation === oc.TopAbs_Orientation.TopAbs_EXTERNAL) {
    return "external";
  }

  return "unknown";
}

function createTopologyEntityEvidence(
  oc: OpenCascadeInstance,
  kind: Extract<
    OcctTopologyEntityKind,
    "body" | "solid" | "face" | "wire" | "edge" | "vertex"
  >,
  shape: TopoDS_Shape | undefined,
  bounds: OcctExactBodyMetadata["bounds"]
): Partial<OcctTopologyEntityDescriptor> {
  const adjacency = {
    available: false,
    neighborSignatureHashes: []
  } as const;

  if (shape && kind === "face") {
    return readFaceTopologyEvidence(oc, shape, adjacency, bounds);
  }

  if (shape && kind === "edge") {
    return readEdgeTopologyEvidence(oc, shape, adjacency, bounds);
  }

  if (shape && kind === "vertex") {
    return readVertexTopologyEvidence(oc, shape, adjacency, bounds);
  }

  if (kind === "face") {
    const plane = findAxisAlignedPlane(bounds);

    return {
      surfaceClass: plane ? "plane" : "unknown",
      ...(plane ? { normal: plane.normal } : {}),
      adjacency
    };
  }

  if (kind === "edge") {
    const line = findAxisAlignedLine(bounds);

    return {
      curveClass: line ? "line" : "unknown",
      ...(line
        ? {
            midpoint: line.midpoint,
            axis: line.axis,
            length: line.length
          }
        : {}),
      adjacency
    };
  }

  if (kind === "vertex" && isPointBounds(bounds)) {
    return {
      point: bounds.min,
      adjacency
    };
  }

  return { adjacency };
}

function readFaceTopologyEvidence(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  adjacency: OcctTopologyEntityDescriptor["adjacency"],
  bounds: OcctExactBodyMetadata["bounds"]
): Partial<OcctTopologyEntityDescriptor> {
  let face: ReturnType<typeof oc.TopoDS.Face_1> | undefined;
  let surface: InstanceType<typeof oc.BRepAdaptor_Surface_2> | undefined;

  try {
    face = oc.TopoDS.Face_1(shape);
    surface = new oc.BRepAdaptor_Surface_2(face, true);

    const surfaceClass = readSurfaceClass(oc, surface.GetType());
    const area = readSurfaceArea(oc, face);
    const surfaceEvidence = readSurfaceGeometryEvidence(surface, surfaceClass);

    return {
      surfaceClass,
      ...(area !== undefined ? { area } : {}),
      ...surfaceEvidence,
      adjacency
    };
  } catch {
    const fallback = createTopologyEntityEvidence(
      oc,
      "face",
      undefined,
      bounds
    );

    return {
      ...fallback,
      adjacency
    };
  } finally {
    surface?.delete();
    face?.delete();
  }
}

function readEdgeTopologyEvidence(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  adjacency: OcctTopologyEntityDescriptor["adjacency"],
  bounds: OcctExactBodyMetadata["bounds"]
): Partial<OcctTopologyEntityDescriptor> {
  let edge: ReturnType<typeof oc.TopoDS.Edge_1> | undefined;
  let curve: InstanceType<typeof oc.BRepAdaptor_Curve_2> | undefined;

  try {
    edge = oc.TopoDS.Edge_1(shape);
    curve = new oc.BRepAdaptor_Curve_2(edge);

    const curveClass = readCurveClass(oc, curve.GetType());
    const length = readEdgeLength(oc, edge);
    const midpoint = readCurveMidpoint(curve);
    const curveEvidence = readCurveGeometryEvidence(curve, curveClass);

    return {
      curveClass,
      ...(length !== undefined ? { length } : {}),
      ...(midpoint ? { midpoint } : {}),
      ...curveEvidence,
      adjacency
    };
  } catch {
    const fallback = createTopologyEntityEvidence(
      oc,
      "edge",
      undefined,
      bounds
    );

    return {
      ...fallback,
      adjacency
    };
  } finally {
    curve?.delete();
    edge?.delete();
  }
}

function readVertexTopologyEvidence(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  adjacency: OcctTopologyEntityDescriptor["adjacency"],
  bounds: OcctExactBodyMetadata["bounds"]
): Partial<OcctTopologyEntityDescriptor> {
  let vertex: ReturnType<typeof oc.TopoDS.Vertex_1> | undefined;
  let point: ReturnType<typeof oc.BRep_Tool.Pnt> | undefined;

  try {
    vertex = oc.TopoDS.Vertex_1(shape);
    point = oc.BRep_Tool.Pnt(vertex);

    return {
      point: readPoint(point),
      adjacency
    };
  } catch {
    const fallback = createTopologyEntityEvidence(
      oc,
      "vertex",
      undefined,
      bounds
    );

    return {
      ...fallback,
      adjacency
    };
  } finally {
    point?.delete();
    vertex?.delete();
  }
}

function readSurfaceClass(
  oc: OpenCascadeInstance,
  surfaceType: ReturnType<
    InstanceType<typeof oc.BRepAdaptor_Surface_2>["GetType"]
  >
): NonNullable<OcctTopologyEntityDescriptor["surfaceClass"]> {
  if (surfaceType === oc.GeomAbs_SurfaceType.GeomAbs_Plane) {
    return "plane";
  }

  if (surfaceType === oc.GeomAbs_SurfaceType.GeomAbs_Cylinder) {
    return "cylinder";
  }

  if (surfaceType === oc.GeomAbs_SurfaceType.GeomAbs_Cone) {
    return "cone";
  }

  if (surfaceType === oc.GeomAbs_SurfaceType.GeomAbs_Sphere) {
    return "sphere";
  }

  if (surfaceType === oc.GeomAbs_SurfaceType.GeomAbs_Torus) {
    return "torus";
  }

  if (
    surfaceType === oc.GeomAbs_SurfaceType.GeomAbs_BezierSurface ||
    surfaceType === oc.GeomAbs_SurfaceType.GeomAbs_BSplineSurface
  ) {
    return "bspline";
  }

  return "unknown";
}

function readCurveClass(
  oc: OpenCascadeInstance,
  curveType: ReturnType<InstanceType<typeof oc.BRepAdaptor_Curve_2>["GetType"]>
): NonNullable<OcctTopologyEntityDescriptor["curveClass"]> {
  if (curveType === oc.GeomAbs_CurveType.GeomAbs_Line) {
    return "line";
  }

  if (curveType === oc.GeomAbs_CurveType.GeomAbs_Circle) {
    return "circle";
  }

  if (curveType === oc.GeomAbs_CurveType.GeomAbs_Ellipse) {
    return "ellipse";
  }

  if (
    curveType === oc.GeomAbs_CurveType.GeomAbs_BezierCurve ||
    curveType === oc.GeomAbs_CurveType.GeomAbs_BSplineCurve
  ) {
    return "bspline";
  }

  return "unknown";
}

function readSurfaceGeometryEvidence(
  surface: OcctSurfaceAdaptor,
  surfaceClass: NonNullable<OcctTopologyEntityDescriptor["surfaceClass"]>
): Partial<OcctTopologyEntityDescriptor> {
  if (surfaceClass === "plane") {
    const plane = surface.Plane();

    try {
      return { normal: readAxisDirection(plane.Axis()) };
    } finally {
      plane.delete();
    }
  }

  if (surfaceClass === "cylinder") {
    const cylinder = surface.Cylinder();

    try {
      return {
        axis: readAxisDirection(cylinder.Axis()),
        radius: Math.abs(cylinder.Radius())
      };
    } finally {
      cylinder.delete();
    }
  }

  if (surfaceClass === "sphere") {
    const sphere = surface.Sphere();

    try {
      return { radius: Math.abs(sphere.Radius()) };
    } finally {
      sphere.delete();
    }
  }

  return {};
}

function readCurveGeometryEvidence(
  curve: OcctCurveAdaptor,
  curveClass: NonNullable<OcctTopologyEntityDescriptor["curveClass"]>
): Partial<OcctTopologyEntityDescriptor> {
  if (curveClass === "line") {
    const line = curve.Line();

    try {
      return { axis: readDirection(line.Direction()) };
    } finally {
      line.delete();
    }
  }

  if (curveClass === "circle") {
    const circle = curve.Circle();

    try {
      return {
        axis: readAxisDirection(circle.Axis()),
        radius: Math.abs(circle.Radius())
      };
    } finally {
      circle.delete();
    }
  }

  return {};
}

function readSurfaceArea(
  oc: OpenCascadeInstance,
  face: ReturnType<typeof oc.TopoDS.Face_1>
): number | undefined {
  const props = new oc.GProp_GProps_1();

  try {
    oc.BRepGProp.SurfaceProperties_1(face, props, false, false);
    return positiveFiniteOrUndefined(Math.abs(props.Mass()));
  } finally {
    props.delete();
  }
}

function readEdgeLength(
  oc: OpenCascadeInstance,
  edge: ReturnType<typeof oc.TopoDS.Edge_1>
): number | undefined {
  const props = new oc.GProp_GProps_1();

  try {
    oc.BRepGProp.LinearProperties(edge, props, false, false);
    return positiveFiniteOrUndefined(Math.abs(props.Mass()));
  } finally {
    props.delete();
  }
}

function readCurveMidpoint(
  curve: OcctCurveAdaptor
): readonly [number, number, number] | undefined {
  const first = curve.FirstParameter();
  const last = curve.LastParameter();

  if (!Number.isFinite(first) || !Number.isFinite(last)) {
    return undefined;
  }

  const point = curve.Value((first + last) / 2);

  try {
    return readPoint(point);
  } finally {
    point.delete();
  }
}

function readAxisDirection(
  axis: OcctAxisLike
): readonly [number, number, number] {
  try {
    return readDirection(axis.Direction());
  } finally {
    axis.delete();
  }
}

function readDirection(
  direction: OcctDeletablePointLike
): readonly [number, number, number] {
  try {
    return normalizeVector([direction.X(), direction.Y(), direction.Z()]);
  } finally {
    direction.delete();
  }
}

function readPoint(point: OcctPointLike): readonly [number, number, number] {
  return [point.X(), point.Y(), point.Z()];
}

function normalizeVector(
  value: readonly [number, number, number]
): readonly [number, number, number] {
  const length = Math.hypot(value[0], value[1], value[2]);

  if (length <= TOPOLOGY_EVIDENCE_TOLERANCE || !Number.isFinite(length)) {
    return value;
  }

  return [value[0] / length, value[1] / length, value[2] / length];
}

function positiveFiniteOrUndefined(value: number): number | undefined {
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function normalizeBoundsForSignature(
  bounds: OcctExactBodyMetadata["bounds"]
): OcctExactBodyMetadata["bounds"] {
  return {
    min: [
      roundTopologySignatureNumber(bounds.min[0]),
      roundTopologySignatureNumber(bounds.min[1]),
      roundTopologySignatureNumber(bounds.min[2])
    ],
    max: [
      roundTopologySignatureNumber(bounds.max[0]),
      roundTopologySignatureNumber(bounds.max[1]),
      roundTopologySignatureNumber(bounds.max[2])
    ]
  };
}

function findAxisAlignedPlane(
  bounds: OcctExactBodyMetadata["bounds"]
): { readonly normal: readonly [number, number, number] } | undefined {
  const degenerateAxes = getDegenerateAxes(bounds);

  if (degenerateAxes.length !== 1) {
    return undefined;
  }

  return { normal: axisUnitVector(degenerateAxes[0]!) };
}

function findAxisAlignedLine(bounds: OcctExactBodyMetadata["bounds"]):
  | {
      readonly midpoint: readonly [number, number, number];
      readonly axis: readonly [number, number, number];
      readonly length: number;
    }
  | undefined {
  const degenerateAxes = getDegenerateAxes(bounds);

  if (degenerateAxes.length !== 2) {
    return undefined;
  }

  const axisIndex = [0, 1, 2].find((index) => !degenerateAxes.includes(index));

  if (axisIndex === undefined) {
    return undefined;
  }

  const length = Math.abs(bounds.max[axisIndex] - bounds.min[axisIndex]);

  if (length <= TOPOLOGY_EVIDENCE_TOLERANCE) {
    return undefined;
  }

  return {
    midpoint: [
      (bounds.min[0] + bounds.max[0]) / 2,
      (bounds.min[1] + bounds.max[1]) / 2,
      (bounds.min[2] + bounds.max[2]) / 2
    ],
    axis: axisUnitVector(axisIndex),
    length
  };
}

function isPointBounds(bounds: OcctExactBodyMetadata["bounds"]): boolean {
  return getDegenerateAxes(bounds).length === 3;
}

function getDegenerateAxes(bounds: OcctExactBodyMetadata["bounds"]): number[] {
  return [0, 1, 2].filter(
    (index) =>
      Math.abs(bounds.max[index] - bounds.min[index]) <=
      TOPOLOGY_EVIDENCE_TOLERANCE
  );
}

function axisUnitVector(axisIndex: number): readonly [number, number, number] {
  return [
    axisIndex === 0 ? 1 : 0,
    axisIndex === 1 ? 1 : 0,
    axisIndex === 2 ? 1 : 0
  ];
}

function roundTopologySignatureNumber(value: number): number {
  return Number(value.toFixed(9));
}

function createDerivedTopologySignature(value: unknown): string {
  return `fnv1a32:${fnv1a32(JSON.stringify(value))}`;
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function readBounds(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape
): OcctExactBodyMetadata["bounds"] {
  const bounds = new oc.Bnd_Box_1();

  try {
    oc.BRepBndLib.AddOptimal(shape, bounds, false, true);

    if (bounds.IsVoid()) {
      throw {
        code: "EMPTY_RESULT",
        message: "Open CASCADE returned an empty exact metadata bounds box."
      } satisfies EmptyResultError;
    }

    const min = bounds.CornerMin();
    const max = bounds.CornerMax();

    try {
      return {
        min: [min.X(), min.Y(), min.Z()],
        max: [max.X(), max.Y(), max.Z()]
      };
    } finally {
      min.delete();
      max.delete();
    }
  } finally {
    bounds.delete();
  }
}

function countSubshapes(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  shapeTypeKey:
    | "TopAbs_SOLID"
    | "TopAbs_FACE"
    | "TopAbs_WIRE"
    | "TopAbs_EDGE"
    | "TopAbs_VERTEX"
): number {
  const toFind = oc.TopAbs_ShapeEnum[shapeTypeKey] as unknown as Parameters<
    typeof oc.TopExp.MapShapes_1
  >[1];
  const shapeMap = new oc.TopTools_IndexedMapOfShape_1();

  try {
    oc.TopExp.MapShapes_1(shape, toFind, shapeMap);
    return shapeMap.Size();
  } finally {
    shapeMap.delete();
  }
}

function assertExactMetadataBindings(oc: OpenCascadeInstance): void {
  const bindings: readonly [string, unknown][] = [
    ["BRepBndLib.AddOptimal", oc.BRepBndLib?.AddOptimal],
    ["BRepGProp.VolumeProperties_1", oc.BRepGProp?.VolumeProperties_1],
    ["BRepGProp.SurfaceProperties_1", oc.BRepGProp?.SurfaceProperties_1],
    ["BRepGProp.LinearProperties", oc.BRepGProp?.LinearProperties],
    ["GProp_GProps_1", oc.GProp_GProps_1],
    ["Bnd_Box_1", oc.Bnd_Box_1],
    ["BRepAdaptor_Surface_2", oc.BRepAdaptor_Surface_2],
    ["BRepAdaptor_Curve_2", oc.BRepAdaptor_Curve_2],
    ["BRep_Tool.Pnt", oc.BRep_Tool?.Pnt],
    ["TopoDS.Face_1", oc.TopoDS?.Face_1],
    ["TopoDS.Edge_1", oc.TopoDS?.Edge_1],
    ["TopoDS.Wire_1", oc.TopoDS?.Wire_1],
    ["TopoDS.Vertex_1", oc.TopoDS?.Vertex_1],
    ["TopExp.MapShapes_1", oc.TopExp?.MapShapes_1],
    ["TopExp.FirstVertex", oc.TopExp?.FirstVertex],
    ["TopExp.LastVertex", oc.TopExp?.LastVertex],
    ["TopExp_Explorer_2", oc.TopExp_Explorer_2],
    ["BRepTools_WireExplorer_3", oc.BRepTools_WireExplorer_3],
    ["TopTools_IndexedMapOfShape_1", oc.TopTools_IndexedMapOfShape_1],
    ["GeomAbs_SurfaceType", oc.GeomAbs_SurfaceType],
    ["GeomAbs_CurveType", oc.GeomAbs_CurveType],
    ["TopAbs_Orientation", oc.TopAbs_Orientation],
    ["TopAbs_ShapeEnum", oc.TopAbs_ShapeEnum],
    ["TopAbs_ShapeEnum.TopAbs_WIRE", oc.TopAbs_ShapeEnum?.TopAbs_WIRE],
    ["TopAbs_ShapeEnum.TopAbs_SHAPE", oc.TopAbs_ShapeEnum?.TopAbs_SHAPE]
  ];
  const missing = bindings
    .filter(([, value]) => value === undefined || value === null)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw {
      code: "UNAVAILABLE_BINDING",
      message: `Open CASCADE exact metadata bindings are unavailable: ${missing.join(", ")}.`
    } satisfies UnavailableBindingError;
  }
}

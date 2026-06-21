import type { OpenCascadeInstance, TopoDS_Shape } from "opencascade.js";
import {
  makeBooleanExtrudeShape,
  type OcctBooleanExtrudeInput,
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

export type OcctExactBodyMetadataSource =
  | OcctExactExtrudeMetadataSource
  | OcctExactBooleanExtrudesMetadataSource
  | OcctExactRevolveMetadataSource
  | OcctExactHoleMetadataSource
  | OcctExactEdgeFinishMetadataSource;

export interface OcctExactExtrudeMetadataSource extends OcctBooleanExtrudeSource {
  readonly kind: "extrude";
}

export interface OcctExactBooleanExtrudesMetadataSource {
  readonly kind: "booleanExtrudes";
  readonly operation: OcctBooleanExtrudeInput["operation"];
  readonly target: OcctBooleanExtrudeSource;
  readonly tool: OcctBooleanExtrudeSource;
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
  assertExactMetadataBindings(oc);

  if (input.source.kind === "extrude") {
    const shapeBuilder = makeBooleanExtrudeShape(oc, input.source);

    try {
      return readExactBodyMetadata(oc, shapeBuilder.Shape(), input.source.kind);
    } finally {
      shapeBuilder.delete();
    }
  }

  if (input.source.kind === "revolve") {
    const shapeHandle = makeRevolveProfileShape(oc, input.source);

    try {
      return readExactBodyMetadata(oc, shapeHandle.shape, input.source.kind);
    } finally {
      shapeHandle.delete();
    }
  }

  if (input.source.kind === "hole") {
    return withOcctHoleResultShape(oc, input.source, (shape) =>
      readExactBodyMetadata(oc, shape, input.source.kind)
    );
  }

  if (input.source.kind === "edgeFinish") {
    return withOcctEdgeFinishResultShape(oc, input.source, (shape) =>
      readExactBodyMetadata(oc, shape, input.source.kind)
    );
  }

  return readBooleanExactBodyMetadata(oc, input.source);
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
  assertExactMetadataBindings(oc);

  if (input.source.kind === "extrude") {
    const shapeBuilder = makeBooleanExtrudeShape(oc, input.source);

    try {
      return readExactTopologySnapshot(
        oc,
        shapeBuilder.Shape(),
        input.source.kind
      );
    } finally {
      shapeBuilder.delete();
    }
  }

  if (input.source.kind === "revolve") {
    const shapeHandle = makeRevolveProfileShape(oc, input.source);

    try {
      return readExactTopologySnapshot(
        oc,
        shapeHandle.shape,
        input.source.kind
      );
    } finally {
      shapeHandle.delete();
    }
  }

  if (input.source.kind === "hole") {
    return withOcctHoleResultShape(oc, input.source, (shape) =>
      readExactTopologySnapshot(oc, shape, input.source.kind)
    );
  }

  if (input.source.kind === "edgeFinish") {
    return withOcctEdgeFinishResultShape(oc, input.source, (shape) =>
      readExactTopologySnapshot(oc, shape, input.source.kind)
    );
  }

  return readBooleanExactTopologySnapshot(oc, input.source);
}

function readBooleanExactTopologySnapshot(
  oc: OpenCascadeInstance,
  source: OcctExactBooleanExtrudesMetadataSource
): OcctExactTopologySnapshot {
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

    return readExactTopologySnapshot(oc, booleanOperation.Shape(), source.kind);
  } finally {
    booleanOperation?.delete();
    range.delete();
    targetShape.delete();
    toolShape.delete();
  }
}

function readBooleanExactBodyMetadata(
  oc: OpenCascadeInstance,
  source: OcctExactBooleanExtrudesMetadataSource
): OcctExactBodyMetadata {
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

    return readExactBodyMetadata(oc, booleanOperation.Shape(), source.kind);
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

function readExactTopologySnapshot(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  sourceKind: OcctExactBodyMetadataSource["kind"]
): OcctExactTopologySnapshot {
  const entityCounts: OcctTopologyEntityCounts = {
    bodyCount: 1,
    solidCount: countSubshapes(oc, shape, "TopAbs_SOLID"),
    faceCount: countSubshapes(oc, shape, "TopAbs_FACE"),
    wireCount: countSubshapes(oc, shape, "TopAbs_WIRE"),
    edgeCount: countSubshapes(oc, shape, "TopAbs_EDGE"),
    vertexCount: countSubshapes(oc, shape, "TopAbs_VERTEX"),
    loopCount: 0,
    coedgeCount: 0,
    axisCount: 0
  };
  const entities = [
    ...createTopologyEntities("body", entityCounts.bodyCount, sourceKind),
    ...createTopologyEntities("solid", entityCounts.solidCount, sourceKind),
    ...createTopologyEntities("face", entityCounts.faceCount, sourceKind),
    ...createTopologyEntities("wire", entityCounts.wireCount, sourceKind),
    ...createTopologyEntities("edge", entityCounts.edgeCount, sourceKind),
    ...createTopologyEntities("vertex", entityCounts.vertexCount, sourceKind)
  ];
  const unsupportedEntityKinds = [
    "loop",
    "coedge",
    "axis"
  ] satisfies readonly OcctTopologyEntityKind[];
  const signature = createDerivedTopologySignature({
    sourceKind,
    entityCounts
  });

  return {
    sourceKind,
    status: "partial",
    entityCounts,
    entityCount: entities.length,
    entities,
    unsupportedEntityKinds,
    adjacencyAvailable: false,
    signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
    signature,
    source: "kernel-derived",
    diagnostics: [
      {
        code: "GEOMETRY_TOPOLOGY_SNAPSHOT_EXTRACTED",
        severity: "info",
        message:
          "Open CASCADE exact topology snapshot extracted body, solid, face, wire, edge, and vertex descriptors from derived B-rep evidence."
      },
      ...unsupportedEntityKinds.map((entityKind) => ({
        code: "GEOMETRY_TOPOLOGY_ENTITY_KIND_UNAVAILABLE" as const,
        severity: "warning" as const,
        entityKind,
        message: `${entityKind} topology descriptors are not exposed by the current Open CASCADE snapshot binding.`
      })),
      {
        code: "GEOMETRY_TOPOLOGY_ADJACENCY_UNAVAILABLE",
        severity: "warning",
        message:
          "Topology adjacency extraction is not exposed by the current Open CASCADE snapshot binding."
      },
      {
        code: "GEOMETRY_TOPOLOGY_SIGNATURE_LIMITED",
        severity: "warning",
        message:
          "Topology signatures are derived from source kind and topology counts only until per-entity geometry signatures are implemented."
      }
    ]
  };
}

function createTopologyEntities(
  kind: Extract<
    OcctTopologyEntityKind,
    "body" | "solid" | "face" | "wire" | "edge" | "vertex"
  >,
  count: number,
  sourceKind: OcctExactBodyMetadataSource["kind"]
): readonly OcctTopologyEntityDescriptor[] {
  return Array.from({ length: count }, (_, index) => {
    const localId = `snapshot-local:${kind}:${index + 1}`;

    return {
      localId,
      kind,
      source: "kernel-derived",
      signature: createDerivedTopologySignature({
        sourceKind,
        entityKind: kind,
        ordinal: index + 1
      })
    };
  });
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
    ["GProp_GProps_1", oc.GProp_GProps_1],
    ["Bnd_Box_1", oc.Bnd_Box_1],
    ["TopExp.MapShapes_1", oc.TopExp?.MapShapes_1],
    ["TopTools_IndexedMapOfShape_1", oc.TopTools_IndexedMapOfShape_1],
    ["TopAbs_ShapeEnum", oc.TopAbs_ShapeEnum],
    ["TopAbs_ShapeEnum.TopAbs_WIRE", oc.TopAbs_ShapeEnum?.TopAbs_WIRE]
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

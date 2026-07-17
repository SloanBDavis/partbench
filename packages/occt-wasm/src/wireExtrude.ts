import type {
  OpenCascadeInstance,
  TopoDS_Edge,
  TopoDS_Shape,
  TopoDS_Vertex
} from "opencascade.js";
import {
  readTriangulatedShape,
  type OcctMeshData
} from "./readTriangulatedShape";
import type { OcctLoader } from "./tessellateBox";

export interface OcctResolvedPlaneFrame {
  readonly origin: readonly [number, number, number];
  readonly uAxis: readonly [number, number, number];
  readonly vAxis: readonly [number, number, number];
}

export interface OcctResolvedSketchGeometryPolicy {
  readonly linearTolerance: number;
  readonly angularToleranceDegrees: number;
  readonly minimumProfileArea: number;
}

export interface OcctResolvedLineSegment2d {
  readonly kind: "line";
  readonly sourceEntityId: string;
  readonly start: readonly [number, number];
  readonly end: readonly [number, number];
}

export interface OcctResolvedArcSegment2d {
  readonly kind: "arc";
  readonly sourceEntityId: string;
  readonly center: readonly [number, number];
  readonly radius: number;
  readonly startAngleDegrees: number;
  readonly sweepAngleDegrees: number;
}

export interface OcctResolvedPlanarWireProfile {
  readonly kind: "wire";
  readonly frame: OcctResolvedPlaneFrame;
  readonly closed: true;
  readonly segments: readonly (
    | OcctResolvedLineSegment2d
    | OcctResolvedArcSegment2d
  )[];
  readonly sourceIdentity: string;
  readonly geometryPolicy: OcctResolvedSketchGeometryPolicy;
}

export interface OcctWireExtrudeSource {
  readonly sketchPlane: "XY" | "XZ" | "YZ";
  readonly profile: OcctResolvedPlanarWireProfile;
  readonly depth: number;
  readonly side?: "positive" | "negative" | "symmetric";
}

export interface OcctWireExtrudeInput extends OcctWireExtrudeSource {
  readonly tessellation?: {
    readonly linearDeflection?: number;
    readonly angularDeflection?: number;
  };
}

export interface OcctGeneratedReferences {
  readonly status: "ready" | "unavailable" | "ambiguous";
  readonly sourceIdentity: string;
  readonly faces: readonly {
    readonly role: "startCap" | "endCap" | "side";
    readonly sourceEntityId?: string;
    readonly surfaceClass: "plane" | "cylinder";
    readonly evidence: "kernel-builder";
  }[];
  readonly edges: readonly {
    readonly role: "startCapBoundary" | "endCapBoundary" | "longitudinal";
    readonly sourceEntityId?: string;
    readonly adjacentSourceEntityIds?: readonly [string, string];
    readonly evidence: "kernel-builder";
  }[];
  readonly diagnostic?: string;
}

export interface OcctShapeBuilder {
  Shape(): TopoDS_Shape;
  delete(): void;
}

interface WireExtrudeBuild {
  readonly builder: InstanceType<
    OpenCascadeInstance["BRepPrimAPI_MakePrism_1"]
  >;
  readonly generatedReferences: OcctGeneratedReferences;
  delete(): void;
}

export async function createOcctWireExtrudeMeshWithLoader(
  loadOcct: OcctLoader,
  input: OcctWireExtrudeInput
): Promise<
  OcctMeshData & { readonly generatedReferences: OcctGeneratedReferences }
> {
  return createOcctWireExtrudeMeshWithInstance(await loadOcct(), input);
}

export function createOcctWireExtrudeMeshWithInstance(
  oc: OpenCascadeInstance,
  input: OcctWireExtrudeInput
): OcctMeshData & { readonly generatedReferences: OcctGeneratedReferences } {
  const build = makeWireExtrudeBuild(oc, input);
  try {
    const shape = build.builder.Shape();
    const mesh = new oc.BRepMesh_IncrementalMesh_2(
      shape,
      input.tessellation?.linearDeflection ?? 0.5,
      false,
      input.tessellation?.angularDeflection ?? 0.5,
      false
    );
    try {
      if (!mesh.IsDone()) {
        throw new Error(
          `Open CASCADE composite extrude meshing failed with status ${mesh.GetStatusFlags()}.`
        );
      }
      return {
        ...readTriangulatedShape(oc, shape, "extrude"),
        generatedReferences: build.generatedReferences
      };
    } finally {
      mesh.delete();
      shape.delete();
    }
  } finally {
    build.delete();
  }
}

export function makeWireExtrudeShape(
  oc: OpenCascadeInstance,
  source: OcctWireExtrudeSource
): OcctShapeBuilder {
  const build = makeWireExtrudeBuild(oc, source);
  return {
    Shape: () => build.builder.Shape(),
    delete: () => build.delete()
  };
}

function makeWireExtrudeBuild(
  oc: OpenCascadeInstance,
  source: OcctWireExtrudeSource
): WireExtrudeBuild {
  const { profile } = source;
  const normal = normalize(cross(profile.frame.uAxis, profile.frame.vAxis));
  const normalStart =
    source.side === "symmetric"
      ? -source.depth / 2
      : source.side === "negative"
        ? -source.depth
        : 0;
  const normalEnd =
    source.side === "symmetric"
      ? source.depth / 2
      : source.side === "negative"
        ? 0
        : source.depth;
  const vertices: TopoDS_Vertex[] = [];
  const vertexBuilders: Array<
    InstanceType<OpenCascadeInstance["BRepBuilderAPI_MakeVertex"]>
  > = [];
  const edgeBuilders: Array<
    InstanceType<OpenCascadeInstance["BRepBuilderAPI_MakeEdge"]>
  > = [];
  const edges: TopoDS_Edge[] = [];
  const wireBuilder = new oc.BRepBuilderAPI_MakeWire_1();
  let faceBuilder:
    | InstanceType<OpenCascadeInstance["BRepBuilderAPI_MakeFace"]>
    | undefined;
  let prism:
    | InstanceType<OpenCascadeInstance["BRepPrimAPI_MakePrism_1"]>
    | undefined;
  let vector: InstanceType<OpenCascadeInstance["gp_Vec_4"]> | undefined;

  try {
    for (const segment of profile.segments) {
      const start = segmentStart(segment);
      const point = mapPoint(profile.frame, normal, start, normalStart);
      const ocPoint = new oc.gp_Pnt_3(point[0], point[1], point[2]);
      try {
        const builder = new oc.BRepBuilderAPI_MakeVertex(ocPoint);
        vertexBuilders.push(builder);
        vertices.push(builder.Vertex());
      } finally {
        ocPoint.delete();
      }
    }

    const topologyBuilder = new oc.BRep_Builder();
    try {
      for (let index = 0; index < vertices.length; index += 1) {
        const previous =
          profile.segments[
            (index + profile.segments.length - 1) % profile.segments.length
          ];
        const discrepancy = distance(
          segmentEnd(previous),
          segmentStart(profile.segments[index])
        );
        topologyBuilder.UpdateVertex_6(
          vertices[index],
          Math.min(
            profile.geometryPolicy.linearTolerance,
            Math.max(discrepancy, 1e-12)
          )
        );
      }
    } finally {
      topologyBuilder.delete();
    }

    for (let index = 0; index < profile.segments.length; index += 1) {
      const segment = profile.segments[index];
      const startVertex = vertices[index];
      const endVertex = vertices[(index + 1) % vertices.length];
      const edgeBuilder =
        segment.kind === "line"
          ? new oc.BRepBuilderAPI_MakeEdge_2(startVertex, endVertex)
          : makeArcEdge(
              oc,
              profile.frame,
              normal,
              segment,
              startVertex,
              endVertex
            );
      edgeBuilders.push(edgeBuilder);
      if (!edgeBuilder.IsDone()) {
        throw new Error(
          `Open CASCADE failed to build exact ${segment.kind} edge for ${segment.sourceEntityId}.`
        );
      }
      const edge = edgeBuilder.Edge();
      edges.push(edge);
      wireBuilder.Add_1(edge);
      if (!wireBuilder.IsDone()) {
        throw new Error(
          `Open CASCADE failed to append ${segment.sourceEntityId} to the ordered wire.`
        );
      }
    }

    const wire = wireBuilder.Wire();
    const wireAnalyzer = new oc.BRepCheck_Analyzer(wire, true, false);
    try {
      if (!wireAnalyzer.IsValid_2()) {
        throw new Error("Open CASCADE rejected the composite profile wire.");
      }
    } finally {
      wireAnalyzer.delete();
    }

    faceBuilder = new oc.BRepBuilderAPI_MakeFace_15(wire, true);
    wire.delete();
    if (!faceBuilder.IsDone()) {
      throw new Error(
        "Open CASCADE failed to build a planar face from the composite wire."
      );
    }
    const face = faceBuilder.Face();
    const faceAnalyzer = new oc.BRepCheck_Analyzer(face, true, false);
    try {
      if (!faceAnalyzer.IsValid_2()) {
        throw new Error("Open CASCADE rejected the composite profile face.");
      }
    } finally {
      faceAnalyzer.delete();
    }

    vector = new oc.gp_Vec_4(
      normal[0] * (normalEnd - normalStart),
      normal[1] * (normalEnd - normalStart),
      normal[2] * (normalEnd - normalStart)
    );
    prism = new oc.BRepPrimAPI_MakePrism_1(face, vector, false, true);
    face.delete();
    const shape = prism.Shape();
    try {
      if (shape.IsNull()) {
        throw new Error("Open CASCADE composite prism returned a null shape.");
      }
      const analyzer = new oc.BRepCheck_Analyzer(shape, true, false);
      try {
        if (!analyzer.IsValid_2()) {
          throw new Error(
            "Open CASCADE composite prism returned an invalid shape."
          );
        }
      } finally {
        analyzer.delete();
      }
      if (countSubshapes(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_SOLID) !== 1) {
        throw new Error(
          "Open CASCADE composite prism must return exactly one solid."
        );
      }
    } finally {
      shape.delete();
    }

    const references = buildGeneratedReferences(
      profile,
      prism,
      edges,
      vertices
    );
    return {
      builder: prism,
      generatedReferences: references,
      delete: () => {
        prism?.delete();
        vector?.delete();
        faceBuilder?.delete();
        wireBuilder.delete();
        edges.forEach((edge) => edge.delete());
        edgeBuilders.forEach((builder) => builder.delete());
        vertices.forEach((vertex) => vertex.delete());
        vertexBuilders.forEach((builder) => builder.delete());
        prism = undefined;
        vector = undefined;
        faceBuilder = undefined;
      }
    };
  } catch (error) {
    prism?.delete();
    vector?.delete();
    faceBuilder?.delete();
    wireBuilder.delete();
    edges.forEach((edge) => edge.delete());
    edgeBuilders.forEach((builder) => builder.delete());
    vertices.forEach((vertex) => vertex.delete());
    vertexBuilders.forEach((builder) => builder.delete());
    throw error;
  }
}

function makeArcEdge(
  oc: OpenCascadeInstance,
  frame: OcctResolvedPlaneFrame,
  normal: readonly [number, number, number],
  segment: OcctResolvedArcSegment2d,
  startVertex: TopoDS_Vertex,
  endVertex: TopoDS_Vertex
): InstanceType<OpenCascadeInstance["BRepBuilderAPI_MakeEdge_29"]> {
  const center = mapPoint(frame, normal, segment.center, 0);
  const point = new oc.gp_Pnt_3(center[0], center[1], center[2]);
  const sense = Math.sign(segment.sweepAngleDegrees);
  const circleNormal = new oc.gp_Dir_4(
    normal[0] * sense,
    normal[1] * sense,
    normal[2] * sense
  );
  const xDirection = new oc.gp_Dir_4(...frame.uAxis);
  const axes = new oc.gp_Ax2_2(point, circleNormal, xDirection);
  const circle = new oc.Geom_Circle_2(axes, segment.radius);
  const curve = new oc.Handle_Geom_Curve_2(circle);
  const start = degreesToRadians(segment.startAngleDegrees * sense);
  const end = start + degreesToRadians(Math.abs(segment.sweepAngleDegrees));
  try {
    return new oc.BRepBuilderAPI_MakeEdge_29(
      curve,
      startVertex,
      endVertex,
      start,
      end
    );
  } finally {
    curve.delete();
    circle.delete();
    axes.delete();
    xDirection.delete();
    circleNormal.delete();
    point.delete();
  }
}

function buildGeneratedReferences(
  profile: OcctResolvedPlanarWireProfile,
  prism: InstanceType<OpenCascadeInstance["BRepPrimAPI_MakePrism_1"]>,
  edges: readonly TopoDS_Edge[],
  vertices: readonly TopoDS_Vertex[]
): OcctGeneratedReferences {
  const sidesProven = edges.every((edge) => {
    const generated = prism.Generated(edge);
    try {
      return generated.Size() === 1;
    } finally {
      generated.delete();
    }
  });
  const joinsProven = vertices.every((vertex) => {
    const generated = prism.Generated(vertex);
    try {
      return generated.Size() === 1;
    } finally {
      generated.delete();
    }
  });
  if (!sidesProven || !joinsProven) {
    return {
      status: "unavailable",
      sourceIdentity: profile.sourceIdentity,
      faces: [],
      edges: [],
      diagnostic:
        "The prism builder did not provide one-to-one generated correspondence for every source segment and join."
    };
  }

  return {
    status: "ready",
    sourceIdentity: profile.sourceIdentity,
    faces: [
      { role: "startCap", surfaceClass: "plane", evidence: "kernel-builder" },
      { role: "endCap", surfaceClass: "plane", evidence: "kernel-builder" },
      ...profile.segments.map((segment) => ({
        role: "side" as const,
        sourceEntityId: segment.sourceEntityId,
        surfaceClass:
          segment.kind === "line" ? ("plane" as const) : ("cylinder" as const),
        evidence: "kernel-builder" as const
      }))
    ],
    edges: [
      ...profile.segments.flatMap((segment) => [
        {
          role: "startCapBoundary" as const,
          sourceEntityId: segment.sourceEntityId,
          evidence: "kernel-builder" as const
        },
        {
          role: "endCapBoundary" as const,
          sourceEntityId: segment.sourceEntityId,
          evidence: "kernel-builder" as const
        }
      ]),
      ...profile.segments.map((segment, index) => ({
        role: "longitudinal" as const,
        adjacentSourceEntityIds: [
          profile.segments[
            (index + profile.segments.length - 1) % profile.segments.length
          ].sourceEntityId,
          segment.sourceEntityId
        ] as const,
        evidence: "kernel-builder" as const
      }))
    ]
  };
}

function countSubshapes(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  kind: unknown
): number {
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    kind as ConstructorParameters<typeof oc.TopExp_Explorer_2>[1],
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE as ConstructorParameters<
      typeof oc.TopExp_Explorer_2
    >[2]
  );
  let count = 0;
  try {
    for (; explorer.More(); explorer.Next()) count += 1;
    return count;
  } finally {
    explorer.delete();
  }
}

function segmentStart(
  segment: OcctResolvedLineSegment2d | OcctResolvedArcSegment2d
): readonly [number, number] {
  if (segment.kind === "line") return segment.start;
  const angle = degreesToRadians(segment.startAngleDegrees);
  return [
    segment.center[0] + segment.radius * Math.cos(angle),
    segment.center[1] + segment.radius * Math.sin(angle)
  ];
}

function segmentEnd(
  segment: OcctResolvedLineSegment2d | OcctResolvedArcSegment2d
): readonly [number, number] {
  if (segment.kind === "line") return segment.end;
  const angle = degreesToRadians(
    segment.startAngleDegrees + segment.sweepAngleDegrees
  );
  return [
    segment.center[0] + segment.radius * Math.cos(angle),
    segment.center[1] + segment.radius * Math.sin(angle)
  ];
}

function mapPoint(
  frame: OcctResolvedPlaneFrame,
  normal: readonly [number, number, number],
  point: readonly [number, number],
  normalDistance: number
): readonly [number, number, number] {
  return [0, 1, 2].map(
    (axis) =>
      frame.origin[axis] +
      frame.uAxis[axis] * point[0] +
      frame.vAxis[axis] * point[1] +
      normal[axis] * normalDistance
  ) as unknown as readonly [number, number, number];
}

function cross(
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): readonly [number, number, number] {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
}

function normalize(
  value: readonly [number, number, number]
): readonly [number, number, number] {
  const length = Math.hypot(...value);
  return [value[0] / length, value[1] / length, value[2] / length];
}

function distance(
  left: readonly [number, number],
  right: readonly [number, number]
): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

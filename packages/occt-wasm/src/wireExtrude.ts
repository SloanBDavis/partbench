import type {
  OpenCascadeInstance,
  TopoDS_Edge,
  TopoDS_Face,
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

export interface OcctWireExtrudeShapeBuild {
  readonly builder: InstanceType<
    OpenCascadeInstance["BRepPrimAPI_MakePrism_1"]
  >;
  readonly generatedReferences: OcctGeneratedReferences;
  delete(): void;
}

export interface OcctResolvedPlanarWireFaceBuild {
  readonly face: TopoDS_Face;
  readonly sourceEdges: readonly TopoDS_Edge[];
  readonly sourceVertices: readonly TopoDS_Vertex[];
  readonly sourceEdgeOrderProven: boolean;
  readonly sourceJoinOrderProven: boolean;
  delete(): void;
}

export function withOcctWireExtrudeBuildShape<T>(
  build: OcctWireExtrudeShapeBuild,
  read: (shape: TopoDS_Shape, references: OcctGeneratedReferences) => T
): T {
  let shape: TopoDS_Shape | undefined;
  try {
    shape = build.builder.Shape();
    return read(shape, build.generatedReferences);
  } finally {
    shape?.delete();
    build.delete();
  }
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
  return withOcctWireExtrudeBuildShape(build, (shape, generatedReferences) => {
    let mesh:
      | InstanceType<OpenCascadeInstance["BRepMesh_IncrementalMesh_2"]>
      | undefined;
    try {
      mesh = new oc.BRepMesh_IncrementalMesh_2(
        shape,
        input.tessellation?.linearDeflection ?? 0.5,
        false,
        input.tessellation?.angularDeflection ?? 0.5,
        false
      );
      if (!mesh.IsDone()) {
        throw new Error(
          `Open CASCADE composite extrude meshing failed with status ${mesh.GetStatusFlags()}.`
        );
      }
      return {
        ...readTriangulatedShape(oc, shape, "extrude"),
        generatedReferences
      };
    } finally {
      mesh?.delete();
    }
  });
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

export function makeWireExtrudeShapeWithReferences(
  oc: OpenCascadeInstance,
  source: OcctWireExtrudeSource
): OcctWireExtrudeShapeBuild {
  return makeWireExtrudeBuild(oc, source);
}

function makeWireExtrudeBuild(
  oc: OpenCascadeInstance,
  source: OcctWireExtrudeSource
): OcctWireExtrudeShapeBuild {
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
  let faceBuild: OcctResolvedPlanarWireFaceBuild | undefined;
  let prism:
    | InstanceType<OpenCascadeInstance["BRepPrimAPI_MakePrism_1"]>
    | undefined;
  let vector: InstanceType<OpenCascadeInstance["gp_Vec_4"]> | undefined;

  try {
    faceBuild = makeResolvedPlanarWireFace(oc, profile, normalStart);

    vector = new oc.gp_Vec_4(
      normal[0] * (normalEnd - normalStart),
      normal[1] * (normalEnd - normalStart),
      normal[2] * (normalEnd - normalStart)
    );
    prism = new oc.BRepPrimAPI_MakePrism_1(
      faceBuild.face,
      vector,
      false,
      false
    );
    if (!prism.IsDone()) {
      throw new Error("Open CASCADE composite prism builder did not complete.");
    }
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
      assertWireExtrudeSolidCount(
        countSubshapes(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_SOLID)
      );
    } finally {
      shape.delete();
    }

    const references = buildGeneratedReferences(
      oc,
      profile,
      prism,
      faceBuild.sourceEdges,
      faceBuild.sourceVertices,
      faceBuild.sourceEdgeOrderProven,
      faceBuild.sourceJoinOrderProven
    );
    let disposed = false;
    return {
      builder: prism,
      generatedReferences: references,
      delete: () => {
        if (disposed) return;
        disposed = true;
        prism?.delete();
        vector?.delete();
        faceBuild?.delete();
        prism = undefined;
        vector = undefined;
        faceBuild = undefined;
      }
    };
  } catch (error) {
    prism?.delete();
    vector?.delete();
    faceBuild?.delete();
    throw error;
  }
}

export function makeResolvedPlanarWireFace(
  oc: OpenCascadeInstance,
  profile: OcctResolvedPlanarWireProfile,
  normalOffset = 0
): OcctResolvedPlanarWireFaceBuild {
  const firstSegment = profile.segments[0];
  const lastSegment = profile.segments.at(-1);
  if (!firstSegment || !lastSegment) {
    throw new Error(
      "Open CASCADE composite profile requires at least one source segment."
    );
  }

  const normal = normalize(cross(profile.frame.uAxis, profile.frame.vAxis));
  const edgeBuilders: Array<
    InstanceType<OpenCascadeInstance["BRepBuilderAPI_MakeEdge"]>
  > = [];
  const vertexBuilders: Array<
    InstanceType<OpenCascadeInstance["BRepBuilderAPI_MakeVertex"]>
  > = [];
  const sharedVertices: TopoDS_Vertex[] = [];
  const edges: TopoDS_Edge[] = [];
  const edgeStartVertices: TopoDS_Vertex[] = [];
  const edgeEndVertices: TopoDS_Vertex[] = [];
  const exploredEdges: TopoDS_Edge[] = [];
  const generatedEdges: TopoDS_Edge[] = [];
  const generatedVertices: TopoDS_Vertex[] = [];
  const wireBuilder = new oc.BRepBuilderAPI_MakeWire_1();
  let faceBuilder:
    | InstanceType<OpenCascadeInstance["BRepBuilderAPI_MakeFace"]>
    | undefined;
  let wireShape: InstanceType<OpenCascadeInstance["TopoDS_Wire"]> | undefined;
  let faceShape: TopoDS_Face | undefined;

  try {
    for (const segment of profile.segments) {
      const start = mapPoint(
        profile.frame,
        normal,
        segmentStart(segment),
        normalOffset
      );
      const point = new oc.gp_Pnt_3(...start);
      try {
        const builder = new oc.BRepBuilderAPI_MakeVertex(point);
        vertexBuilders.push(builder);
        sharedVertices.push(builder.Vertex());
      } finally {
        point.delete();
      }
    }

    const topologyBuilder = new oc.BRep_Builder();
    try {
      for (const [index, segment] of profile.segments.entries()) {
        const previousSegment =
          index === 0 ? lastSegment : profile.segments[index - 1];
        const sharedVertex = sharedVertices[index];
        if (!previousSegment || !sharedVertex) {
          throw new Error(
            "Open CASCADE composite profile vertex construction is incomplete."
          );
        }
        const discrepancy = distance(
          segmentEnd(previousSegment),
          segmentStart(segment)
        );
        topologyBuilder.UpdateVertex_6(
          sharedVertex,
          Math.min(
            profile.geometryPolicy.linearTolerance,
            Math.max(discrepancy, 1e-12)
          )
        );
      }
    } finally {
      topologyBuilder.delete();
    }

    const firstVertex = sharedVertices[0];
    if (!firstVertex) {
      throw new Error(
        "Open CASCADE composite profile did not create a starting vertex."
      );
    }

    for (const [index, segment] of profile.segments.entries()) {
      const startVertex = sharedVertices[index];
      const endVertex = sharedVertices[index + 1] ?? firstVertex;
      if (!startVertex) {
        throw new Error(
          "Open CASCADE composite profile vertex construction is incomplete."
        );
      }
      const edgeBuilder =
        segment.kind === "line"
          ? makeLineEdge(
              oc,
              profile.frame,
              normal,
              normalOffset,
              segment,
              startVertex,
              endVertex
            )
          : makeArcEdge(
              oc,
              profile.frame,
              normal,
              normalOffset,
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
      edges.push(edgeBuilder.Edge());
      edgeStartVertices.push(edgeBuilder.Vertex1());
      edgeEndVertices.push(edgeBuilder.Vertex2());
    }

    for (const [index, edge] of edges.entries()) {
      const segment = profile.segments[index];
      if (!segment) {
        throw new Error(
          "Open CASCADE composite profile edge construction is inconsistent."
        );
      }
      wireBuilder.Add_1(edge);
      if (!wireBuilder.IsDone()) {
        throw new Error(
          `Open CASCADE failed to append ${segment.sourceEntityId} to the ordered wire.`
        );
      }
    }

    wireShape = wireBuilder.Wire();
    const wireExplorer = new oc.BRepTools_WireExplorer_2(wireShape);
    try {
      for (; wireExplorer.More(); wireExplorer.Next()) {
        exploredEdges.push(wireExplorer.Current());
      }
    } finally {
      wireExplorer.delete();
    }
    if (exploredEdges.length !== profile.segments.length) {
      throw new Error(
        "Open CASCADE ordered wire traversal did not preserve every source segment and join."
      );
    }
    const sourceEdgeOrderProven = edges.every((sourceEdge) => {
      const matches = exploredEdges.filter((edge) => edge.IsSame(sourceEdge));
      const match = matches[0];
      if (
        matches.length !== 1 ||
        !match ||
        match.Orientation_1() !== sourceEdge.Orientation_1()
      ) {
        return false;
      }
      generatedEdges.push(match);
      return true;
    });
    if (sourceEdgeOrderProven) {
      for (const edge of generatedEdges) {
        generatedVertices.push(oc.TopExp.LastVertex(edge, true));
      }
    }
    const sourceJoinOrderProven =
      sourceEdgeOrderProven &&
      generatedVertices.every((vertex, index) => {
        const next = (index + 1) % generatedEdges.length;
        const nextEdge = generatedEdges[next];
        const segment = profile.segments[index];
        if (!nextEdge || !segment) {
          return false;
        }
        const nextFirst = oc.TopExp.FirstVertex(nextEdge, true);
        try {
          return (
            vertex.IsSame(nextFirst) &&
            vertexMatchesPoint(
              oc,
              vertex,
              mapPoint(
                profile.frame,
                normal,
                segmentEnd(segment),
                normalOffset
              ),
              profile.geometryPolicy.linearTolerance
            )
          );
        } finally {
          nextFirst.delete();
        }
      });
    const wireAnalyzer = new oc.BRepCheck_Analyzer(wireShape, true, false);
    try {
      if (!wireAnalyzer.IsValid_2()) {
        throw new Error("Open CASCADE rejected the composite profile wire.");
      }
    } finally {
      wireAnalyzer.delete();
    }

    faceBuilder = new oc.BRepBuilderAPI_MakeFace_15(wireShape, true);
    wireShape.delete();
    wireShape = undefined;
    if (!faceBuilder.IsDone()) {
      throw new Error(
        "Open CASCADE failed to build a planar face from the composite wire."
      );
    }
    faceShape = faceBuilder.Face();
    const faceAnalyzer = new oc.BRepCheck_Analyzer(faceShape, true, false);
    try {
      if (!faceAnalyzer.IsValid_2()) {
        throw new Error("Open CASCADE rejected the composite profile face.");
      }
    } finally {
      faceAnalyzer.delete();
    }

    let disposed = false;
    return {
      face: faceShape,
      sourceEdges: generatedEdges,
      sourceVertices: generatedVertices,
      sourceEdgeOrderProven,
      sourceJoinOrderProven,
      delete: () => {
        if (disposed) return;
        disposed = true;
        faceShape?.delete();
        faceBuilder?.delete();
        wireShape?.delete();
        wireBuilder.delete();
        exploredEdges.forEach((edge) => edge.delete());
        generatedVertices.forEach((vertex) => vertex.delete());
        edges.forEach((edge) => edge.delete());
        edgeBuilders.forEach((builder) => builder.delete());
        edgeStartVertices.forEach((vertex) => vertex.delete());
        edgeEndVertices.forEach((vertex) => vertex.delete());
        sharedVertices.forEach((vertex) => vertex.delete());
        vertexBuilders.forEach((builder) => builder.delete());
        faceShape = undefined;
        faceBuilder = undefined;
      }
    };
  } catch (error) {
    faceShape?.delete();
    faceBuilder?.delete();
    wireShape?.delete();
    wireBuilder.delete();
    exploredEdges.forEach((edge) => edge.delete());
    generatedVertices.forEach((vertex) => vertex.delete());
    edges.forEach((edge) => edge.delete());
    edgeBuilders.forEach((builder) => builder.delete());
    edgeStartVertices.forEach((vertex) => vertex.delete());
    edgeEndVertices.forEach((vertex) => vertex.delete());
    sharedVertices.forEach((vertex) => vertex.delete());
    vertexBuilders.forEach((builder) => builder.delete());
    throw error;
  }
}

function makeLineEdge(
  oc: OpenCascadeInstance,
  frame: OcctResolvedPlaneFrame,
  normal: readonly [number, number, number],
  normalStart: number,
  segment: OcctResolvedLineSegment2d,
  startVertex: TopoDS_Vertex,
  endVertex: TopoDS_Vertex
): InstanceType<OpenCascadeInstance["BRepBuilderAPI_MakeEdge_7"]> {
  const start = mapPoint(frame, normal, segment.start, normalStart);
  const end = mapPoint(frame, normal, segment.end, normalStart);
  let point: InstanceType<OpenCascadeInstance["gp_Pnt_3"]> | undefined;
  let direction: InstanceType<OpenCascadeInstance["gp_Dir_4"]> | undefined;
  let line: InstanceType<OpenCascadeInstance["gp_Lin_3"]> | undefined;
  try {
    point = new oc.gp_Pnt_3(...start);
    direction = new oc.gp_Dir_4(
      end[0] - start[0],
      end[1] - start[1],
      end[2] - start[2]
    );
    line = new oc.gp_Lin_3(point, direction);
    return new oc.BRepBuilderAPI_MakeEdge_7(line, startVertex, endVertex);
  } finally {
    line?.delete();
    direction?.delete();
    point?.delete();
  }
}

function makeArcEdge(
  oc: OpenCascadeInstance,
  frame: OcctResolvedPlaneFrame,
  normal: readonly [number, number, number],
  normalStart: number,
  segment: OcctResolvedArcSegment2d,
  startVertex: TopoDS_Vertex,
  endVertex: TopoDS_Vertex
): InstanceType<OpenCascadeInstance["BRepBuilderAPI_MakeEdge_11"]> {
  const center = mapPoint(frame, normal, segment.center, normalStart);
  const sense = Math.sign(segment.sweepAngleDegrees);
  let point: InstanceType<OpenCascadeInstance["gp_Pnt_3"]> | undefined;
  let circleNormal: InstanceType<OpenCascadeInstance["gp_Dir_4"]> | undefined;
  let xDirection: InstanceType<OpenCascadeInstance["gp_Dir_4"]> | undefined;
  let axes: InstanceType<OpenCascadeInstance["gp_Ax2_2"]> | undefined;
  let circle: InstanceType<OpenCascadeInstance["gp_Circ_2"]> | undefined;
  try {
    point = new oc.gp_Pnt_3(center[0], center[1], center[2]);
    circleNormal = new oc.gp_Dir_4(
      normal[0] * sense,
      normal[1] * sense,
      normal[2] * sense
    );
    xDirection = new oc.gp_Dir_4(...frame.uAxis);
    axes = new oc.gp_Ax2_2(point, circleNormal, xDirection);
    circle = new oc.gp_Circ_2(axes, segment.radius);
    return new oc.BRepBuilderAPI_MakeEdge_11(circle, startVertex, endVertex);
  } finally {
    circle?.delete();
    axes?.delete();
    xDirection?.delete();
    circleNormal?.delete();
    point?.delete();
  }
}

function buildGeneratedReferences(
  oc: OpenCascadeInstance,
  profile: OcctResolvedPlanarWireProfile,
  prism: InstanceType<OpenCascadeInstance["BRepPrimAPI_MakePrism_1"]>,
  edges: readonly TopoDS_Edge[],
  vertices: readonly TopoDS_Vertex[],
  sourceEdgeOrderProven: boolean,
  sourceJoinOrderProven: boolean
): OcctGeneratedReferences {
  if (!sourceEdgeOrderProven || !sourceJoinOrderProven) {
    return {
      status: "unavailable",
      sourceIdentity: profile.sourceIdentity,
      faces: [],
      edges: [],
      diagnostic: `The analyzed wire traversal could not prove ${!sourceEdgeOrderProven ? "source segment order" : "oriented join correspondence"}.`
    };
  }
  const firstSegment = profile.segments[0];
  if (!firstSegment) {
    return {
      status: "unavailable",
      sourceIdentity: profile.sourceIdentity,
      faces: [],
      edges: [],
      diagnostic: "The composite profile does not contain a source segment."
    };
  }

  let firstCap: TopoDS_Shape | undefined;
  let lastCap: TopoDS_Shape | undefined;
  let capsProven = false;
  try {
    firstCap = prism.FirstShape_1();
    lastCap = prism.LastShape_1();
    capsProven =
      isShapeKind(firstCap, oc.TopAbs_ShapeEnum.TopAbs_FACE) &&
      isShapeKind(lastCap, oc.TopAbs_ShapeEnum.TopAbs_FACE) &&
      !firstCap.IsSame(lastCap);
  } finally {
    firstCap?.delete();
    lastCap?.delete();
  }
  const sidesProven = edges.every((edge, index) => {
    const segment = profile.segments[index];
    if (!segment) {
      return false;
    }
    const generated = prism.Generated(edge);
    try {
      return listContainsOneExpectedFace(
        oc,
        generated,
        segment.kind === "line" ? "plane" : "cylinder"
      );
    } finally {
      generated.delete();
    }
  });
  const boundariesProven = edges.every((edge) => {
    let first: TopoDS_Shape | undefined;
    let last: TopoDS_Shape | undefined;
    try {
      first = prism.FirstShape_2(edge);
      last = prism.LastShape_2(edge);
      return (
        isShapeKind(first, oc.TopAbs_ShapeEnum.TopAbs_EDGE) &&
        isShapeKind(last, oc.TopAbs_ShapeEnum.TopAbs_EDGE)
      );
    } finally {
      first?.delete();
      last?.delete();
    }
  });
  const joinsProven = vertices.every((vertex) => {
    const generated = prism.Generated(vertex);
    try {
      return listContainsOneShapeKind(
        generated,
        oc.TopAbs_ShapeEnum.TopAbs_EDGE
      );
    } finally {
      generated.delete();
    }
  });
  const correspondenceIsDistinct =
    generatedShapesAreDistinct(prism, edges) &&
    generatedShapesAreDistinct(prism, vertices) &&
    boundaryShapesAreDistinct(prism, edges, "first") &&
    boundaryShapesAreDistinct(prism, edges, "last");
  if (!capsProven || !sidesProven || !boundariesProven || !joinsProven) {
    const unavailableEvidence = [
      !capsProven ? "caps" : undefined,
      !sidesProven ? "side faces" : undefined,
      !boundariesProven ? "cap boundaries" : undefined,
      !joinsProven ? "longitudinal edges" : undefined
    ].filter((value): value is string => value !== undefined);
    return {
      status: "unavailable",
      sourceIdentity: profile.sourceIdentity,
      faces: [],
      edges: [],
      diagnostic: `The prism builder did not provide exact one-to-one correspondence for: ${unavailableEvidence.join(", ")}.`
    };
  }
  if (!correspondenceIsDistinct) {
    return {
      status: "ambiguous",
      sourceIdentity: profile.sourceIdentity,
      faces: [],
      edges: [],
      diagnostic:
        "The prism builder merged or aliased generated topology for distinct source segments or joins."
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
      ...profile.segments.map((segment, index) => {
        const nextSegment = profile.segments[index + 1] ?? firstSegment;
        return {
          role: "longitudinal" as const,
          adjacentSourceEntityIds: [
            segment.sourceEntityId,
            nextSegment.sourceEntityId
          ] as const,
          evidence: "kernel-builder" as const
        };
      })
    ]
  };
}

function generatedShapesAreDistinct(
  prism: InstanceType<OpenCascadeInstance["BRepPrimAPI_MakePrism_1"]>,
  sources: readonly (TopoDS_Edge | TopoDS_Vertex)[]
): boolean {
  const shapes: TopoDS_Shape[] = [];
  try {
    for (const source of sources) {
      const generated = prism.Generated(source);
      try {
        if (generated.Size() !== 1) return false;
        shapes.push(generated.First_1());
      } finally {
        generated.delete();
      }
    }
    return shapes.every((shape, index) =>
      shapes.slice(index + 1).every((other) => !shape.IsSame(other))
    );
  } finally {
    shapes.forEach((shape) => shape.delete());
  }
}

function boundaryShapesAreDistinct(
  prism: InstanceType<OpenCascadeInstance["BRepPrimAPI_MakePrism_1"]>,
  edges: readonly TopoDS_Edge[],
  boundary: "first" | "last"
): boolean {
  const shapes: TopoDS_Shape[] = [];
  try {
    for (const edge of edges) {
      shapes.push(
        boundary === "first"
          ? prism.FirstShape_2(edge)
          : prism.LastShape_2(edge)
      );
    }
    return shapes.every(
      (shape, index) =>
        !shape.IsNull() &&
        shapes.slice(index + 1).every((other) => !shape.IsSame(other))
    );
  } finally {
    shapes.forEach((shape) => shape.delete());
  }
}

function listContainsOneExpectedFace(
  oc: OpenCascadeInstance,
  shapes: InstanceType<OpenCascadeInstance["TopTools_ListOfShape"]>,
  expected: "plane" | "cylinder"
): boolean {
  if (shapes.Size() !== 1) return false;
  const shape = shapes.First_1();
  try {
    if (!isShapeKind(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE)) return false;
    const face = oc.TopoDS.Face_1(shape);
    const surface = new oc.BRepAdaptor_Surface_2(face, true);
    try {
      const surfaceType = surface.GetType();
      if (expected === "plane") {
        if (surfaceType === oc.GeomAbs_SurfaceType.GeomAbs_Plane) return true;
      } else if (surfaceType === oc.GeomAbs_SurfaceType.GeomAbs_Cylinder) {
        return true;
      }
      // Canonicalization is deliberately disabled so complementary circular
      // edges retain distinct side faces. Builder correspondence has already
      // mapped this extrusion surface to the exact line/circle source support.
      return surfaceType === oc.GeomAbs_SurfaceType.GeomAbs_SurfaceOfExtrusion;
    } finally {
      surface.delete();
      face.delete();
    }
  } finally {
    shape.delete();
  }
}

function listContainsOneShapeKind(
  shapes: InstanceType<OpenCascadeInstance["TopTools_ListOfShape"]>,
  expected: unknown
): boolean {
  if (shapes.Size() !== 1) return false;
  const shape = shapes.First_1();
  try {
    return isShapeKind(shape, expected);
  } finally {
    shape.delete();
  }
}

function isShapeKind(shape: TopoDS_Shape, expected: unknown): boolean {
  return !shape.IsNull() && shape.ShapeType() === expected;
}

function vertexMatchesPoint(
  oc: OpenCascadeInstance,
  vertex: TopoDS_Vertex,
  expected: readonly [number, number, number],
  tolerance: number
): boolean {
  const point = oc.BRep_Tool.Pnt(vertex);
  try {
    return (
      Math.hypot(
        point.X() - expected[0],
        point.Y() - expected[1],
        point.Z() - expected[2]
      ) <= tolerance
    );
  } finally {
    point.delete();
  }
}

export function assertWireExtrudeSolidCount(solidCount: number): void {
  if (solidCount !== 1) {
    throw new Error(
      "Open CASCADE composite prism must return exactly one solid."
    );
  }
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
  return [
    frame.origin[0] +
      frame.uAxis[0] * point[0] +
      frame.vAxis[0] * point[1] +
      normal[0] * normalDistance,
    frame.origin[1] +
      frame.uAxis[1] * point[0] +
      frame.vAxis[1] * point[1] +
      normal[1] * normalDistance,
    frame.origin[2] +
      frame.uAxis[2] * point[0] +
      frame.vAxis[2] * point[1] +
      normal[2] * normalDistance
  ];
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

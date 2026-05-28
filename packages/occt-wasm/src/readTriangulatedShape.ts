import type {
  OpenCascadeInstance,
  TopLoc_Location,
  TopoDS_Face,
  TopoDS_Shape,
  gp_Pnt
} from "opencascade.js";

export type OcctPrimitiveKind =
  | "box"
  | "cylinder"
  | "sphere"
  | "cone"
  | "torus"
  | "revolve"
  | "boolean"
  | "hole";

export interface OcctMeshData {
  readonly primitive: OcctPrimitiveKind;
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly faceCount: number;
  readonly vertexCount: number;
  readonly triangleCount: number;
}

export function readTriangulatedShape(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  primitive: OcctPrimitiveKind
): OcctMeshData {
  const positions: number[] = [];
  const indices: number[] = [];
  const faceShapeType = oc.TopAbs_ShapeEnum
    .TopAbs_FACE as unknown as ConstructorParameters<
    typeof oc.TopExp_Explorer_2
  >[1];
  const avoidShapeType = oc.TopAbs_ShapeEnum
    .TopAbs_SHAPE as unknown as ConstructorParameters<
    typeof oc.TopExp_Explorer_2
  >[2];
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    faceShapeType,
    avoidShapeType
  );
  let faceCount = 0;

  try {
    for (; explorer.More(); explorer.Next()) {
      const face = oc.TopoDS.Face_1(explorer.Current());

      try {
        const faceTriangles = readFaceTriangulation(oc, face);
        const vertexOffset = positions.length / 3;

        positions.push(...faceTriangles.positions);
        indices.push(
          ...faceTriangles.indices.map((index) => index + vertexOffset)
        );

        if (faceTriangles.indices.length > 0) {
          faceCount += 1;
        }
      } finally {
        face.delete();
      }
    }
  } finally {
    explorer.delete();
  }

  return {
    primitive,
    positions: Float32Array.from(positions),
    indices: Uint32Array.from(indices),
    faceCount,
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3
  };
}

function readFaceTriangulation(
  oc: OpenCascadeInstance,
  face: TopoDS_Face
): {
  readonly positions: readonly number[];
  readonly indices: readonly number[];
} {
  const positions: number[] = [];
  const indices: number[] = [];
  const location = new oc.TopLoc_Location_1();
  const meshPurpose = 0 as Parameters<typeof oc.BRep_Tool.Triangulation>[2];
  const triangulationHandle = oc.BRep_Tool.Triangulation(
    face,
    location,
    meshPurpose
  );

  try {
    if (triangulationHandle.IsNull()) {
      return { positions, indices };
    }

    const triangulation = triangulationHandle.get();

    for (
      let nodeIndex = 1;
      nodeIndex <= triangulation.NbNodes();
      nodeIndex += 1
    ) {
      const node = transformPoint(triangulation.Node(nodeIndex), location);
      positions.push(node.X(), node.Y(), node.Z());
      node.delete();
    }

    for (
      let triangleIndex = 1;
      triangleIndex <= triangulation.NbTriangles();
      triangleIndex += 1
    ) {
      const triangle = triangulation.Triangle(triangleIndex);
      indices.push(
        triangle.Value(1) - 1,
        triangle.Value(2) - 1,
        triangle.Value(3) - 1
      );
      triangle.delete();
    }

    return { positions, indices };
  } finally {
    triangulationHandle.delete();
    location.delete();
  }
}

function transformPoint(point: gp_Pnt, location: TopLoc_Location): gp_Pnt {
  if (location.IsIdentity()) {
    return point;
  }

  const transformed = point.Transformed(location.Transformation());
  point.delete();
  return transformed;
}

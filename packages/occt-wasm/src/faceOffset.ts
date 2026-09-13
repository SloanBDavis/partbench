import type {
  OpenCascadeInstance,
  TopoDS_Face,
  TopoDS_Shape
} from "opencascade.js";

/** Move one supported analytic face along its oriented outward normal.
 * Positive offsets add material: a bore's radius therefore decreases.
 * The supported neighborhoods are straight extrusions and complete cylindrical
 * walls bounded by perpendicular planes. Other neighborhoods require a general
 * surface-intersection offset builder and are rejected before any boolean.
 */
export function withOcctFaceOffsetResultShape<T>(
  oc: OpenCascadeInstance,
  input: {
    readonly target: TopoDS_Shape;
    readonly checkpointEntityId: string;
    readonly distance: number;
  },
  read: (shape: TopoDS_Shape) => T
): T {
  const match = /^snapshot-local:face:([1-9][0-9]*)$/.exec(
    input.checkpointEntityId
  );
  if (
    !match ||
    !Number.isFinite(input.distance) ||
    Math.abs(input.distance) < 1e-9
  ) {
    throw new Error(
      "Face offset requires an exact face reference and a nonzero finite distance."
    );
  }
  const resources: Array<{ delete(): void }> = [];
  const own = <V extends { delete(): void }>(value: V): V => {
    resources.push(value);
    return value;
  };
  const mapShapes = (
    shape: TopoDS_Shape,
    kind: "TopAbs_FACE" | "TopAbs_EDGE" | "TopAbs_SOLID"
  ) => {
    const map = own(new oc.TopTools_IndexedMapOfShape_1());
    oc.TopExp.MapShapes_1(
      shape,
      oc.TopAbs_ShapeEnum[kind] as Parameters<typeof oc.TopExp.MapShapes_1>[1],
      map
    );
    return map;
  };
  const failUnsupported = (message: string): never => {
    throw new Error(`Face offset is unsupported for this face: ${message}`);
  };
  try {
    const faces = mapShapes(input.target, "TopAbs_FACE");
    const faceIndex = Number(match[1]);
    if (faceIndex > faces.Extent())
      throw new Error(
        "Face offset reference is not present in the verified target body."
      );
    const faceShape = own(faces.FindKey(faceIndex));
    const face = own(oc.TopoDS.Face_1(faceShape));
    const solids = mapShapes(input.target, "TopAbs_SOLID");
    let targetSolid: TopoDS_Shape | undefined;
    const siblings: TopoDS_Shape[] = [];
    for (let index = 1; index <= solids.Extent(); index++) {
      const solid = own(solids.FindKey(index));
      if (mapShapes(solid, "TopAbs_FACE").Contains(face)) targetSolid = solid;
      else siblings.push(solid);
    }
    if (!targetSolid)
      throw new Error("Face offset requires a face on a closed solid.");
    const surface = own(new oc.BRepAdaptor_Surface_2(face, true));
    const reversed =
      face.Orientation_1() === oc.TopAbs_Orientation.TopAbs_REVERSED;
    const normalSign = reversed ? -1 : 1;
    const neighbors = findNeighbors(oc, targetSolid, face, own);
    const range = own(new oc.Message_ProgressRange_1());
    const boolean = (
      target: TopoDS_Shape,
      tool: TopoDS_Shape,
      add: boolean
    ) => {
      const operation = own(
        add
          ? new oc.BRepAlgoAPI_Fuse_3(target, tool, range)
          : new oc.BRepAlgoAPI_Cut_3(target, tool, range)
      );
      if (!operation.IsDone())
        throw new Error("Open CASCADE face offset boolean did not complete.");
      operation.SimplifyResult(true, true, 1e-7);
      const shape = own(operation.Shape());
      if (shape.IsNull())
        throw new Error("Face offset removed the complete solid.");
      return shape;
    };
    let tool: TopoDS_Shape | undefined;
    const planarDirection = readPlanarDirection(oc, face, own);
    if (planarDirection) {
      const direction = planarDirection;
      for (const neighbor of neighbors) {
        const adjacent = own(new oc.BRepAdaptor_Surface_2(neighbor, true));
        const neighborPlane = readPlanarDirection(oc, neighbor, own);
        if (neighborPlane) {
          if (Math.abs(dot(direction, neighborPlane)) > 1e-7)
            failUnsupported(
              "adjacent planes must be perpendicular to the moved face."
            );
        } else if (
          adjacent.GetType() === oc.GeomAbs_SurfaceType.GeomAbs_Cylinder
        ) {
          const c = own(adjacent.Cylinder());
          const a = own(c.Axis());
          const d = own(a.Direction());
          if (
            Math.abs(Math.abs(dot(direction, [d.X(), d.Y(), d.Z()])) - 1) > 1e-7
          )
            failUnsupported(
              "adjacent cylinders must run along the moved face normal."
            );
        } else
          failUnsupported(
            "the planar face meets a curved or blended neighbor that cannot be extended exactly by this operation."
          );
      }
      const vector = own(
        new oc.gp_Vec_4(
          ...(direction.map((value) => value * normalSign * input.distance) as [
            number,
            number,
            number
          ])
        )
      );
      const prism = own(
        new oc.BRepPrimAPI_MakePrism_1(face, vector, true, true)
      );
      if (!prism.IsDone())
        throw new Error(
          "Open CASCADE could not extend the selected planar face."
        );
      tool = own(prism.Shape());
    } else if (surface.GetType() === oc.GeomAbs_SurfaceType.GeomAbs_Cylinder) {
      const cylinder = own(surface.Cylinder());
      const axis = own(cylinder.Axis());
      const direction = own(axis.Direction());
      const origin = own(axis.Location());
      const vector = [direction.X(), direction.Y(), direction.Z()] as const;
      const radius = cylinder.Radius();
      const height = surface.LastVParameter() - surface.FirstVParameter();
      // Exchange files often split one analytic cylinder at its seam. Treat
      // matching co-cylindrical patches as the same continuous wall, while
      // rejecting partial, windowed, or differently bounded cylinders.
      const wallFaces: TopoDS_Face[] = [];
      const solidFaces = mapShapes(targetSolid, "TopAbs_FACE");
      let wallArea = 0;
      for (let index = 1; index <= solidFaces.Extent(); index++) {
        const shape = own(solidFaces.FindKey(index));
        const candidate = own(oc.TopoDS.Face_1(shape));
        if (candidate.Orientation_1() !== face.Orientation_1()) continue;
        const candidateSurface = own(
          new oc.BRepAdaptor_Surface_2(candidate, true)
        );
        if (
          candidateSurface.GetType() !== oc.GeomAbs_SurfaceType.GeomAbs_Cylinder
        )
          continue;
        const c = own(candidateSurface.Cylinder());
        if (Math.abs(c.Radius() - radius) > 1e-7) continue;
        const a = own(c.Axis());
        const d = own(a.Direction());
        const o = own(a.Location());
        const parallel = dot(vector, [d.X(), d.Y(), d.Z()]);
        if (Math.abs(Math.abs(parallel) - 1) > 1e-7) continue;
        const delta = [
          o.X() - origin.X(),
          o.Y() - origin.Y(),
          o.Z() - origin.Z()
        ];
        const axial = dot(delta, vector);
        if (
          Math.hypot(
            ...delta.map(
              (value, axisIndex) => value - axial * vector[axisIndex]!
            )
          ) > 1e-7
        )
          continue;
        const ends = [
          candidateSurface.FirstVParameter() * parallel + axial,
          candidateSurface.LastVParameter() * parallel + axial
        ];
        if (
          Math.abs(Math.min(...ends) - surface.FirstVParameter()) > 1e-7 ||
          Math.abs(Math.max(...ends) - surface.LastVParameter()) > 1e-7
        )
          continue;
        const properties = own(new oc.GProp_GProps_1());
        oc.BRepGProp.SurfaceProperties_1(candidate, properties, false, false);
        wallArea += properties.Mass();
        wallFaces.push(candidate);
      }
      const fullArea = 2 * Math.PI * radius * height;
      if (
        !Number.isFinite(height) ||
        height <= 1e-9 ||
        Math.abs(wallArea - fullArea) > Math.max(1e-7, fullArea * 1e-7)
      ) {
        failUnsupported(
          "cylindrical wall patches must cover a complete circle with planar end boundaries."
        );
      }
      for (const wall of wallFaces)
        for (const neighbor of findNeighbors(oc, targetSolid, wall, own)) {
          if (wallFaces.some((member) => member.IsSame(neighbor))) continue;
          const neighborPlane = readPlanarDirection(oc, neighbor, own);
          if (!neighborPlane)
            failUnsupported(
              "cylindrical walls with curved or blended neighbors require a general surface offset."
            );
          if (Math.abs(Math.abs(dot(vector, neighborPlane!)) - 1) > 1e-7)
            failUnsupported(
              "cylinder end planes must be perpendicular to its axis."
            );
        }
      const newRadius = radius + normalSign * input.distance;
      if (newRadius <= 1e-7)
        throw new Error(
          "Face offset would collapse the cylindrical wall onto its axis."
        );
      const start = surface.FirstVParameter();
      const point = own(
        new oc.gp_Pnt_3(
          origin.X() + vector[0] * start,
          origin.Y() + vector[1] * start,
          origin.Z() + vector[2] * start
        )
      );
      const axes = own(new oc.gp_Ax2_3(point, direction));
      const outer = own(
        new oc.BRepPrimAPI_MakeCylinder_3(
          axes,
          Math.max(radius, newRadius),
          height
        )
      );
      const inner = own(
        new oc.BRepPrimAPI_MakeCylinder_3(
          axes,
          Math.min(radius, newRadius),
          height
        )
      );
      tool = boolean(own(outer.Shape()), own(inner.Shape()), false);
    } else
      failUnsupported(
        "only planar faces and complete cylindrical walls are supported."
      );
    if (!tool) throw new Error("Face offset did not create an exact tool.");
    const resultSolid = boolean(targetSolid, tool, input.distance > 0);
    const resultSolids = mapShapes(resultSolid, "TopAbs_SOLID");
    if (resultSolids.Extent() !== 1)
      throw new Error(
        "Face offset must retain one connected solid and cannot remove or split the target."
      );
    const validity = own(new oc.BRepCheck_Analyzer(resultSolid, true, false));
    if (!validity.IsValid_2())
      throw new Error("Face offset did not produce a valid closed solid.");
    if (siblings.length === 0) return read(resultSolid);
    const compound = own(new oc.TopoDS_Compound());
    const builder = own(new oc.BRep_Builder());
    builder.MakeCompound(compound);
    builder.Add(compound, resultSolid);
    for (const sibling of siblings) builder.Add(compound, sibling);
    return read(compound);
  } finally {
    for (const resource of resources.reverse()) resource.delete();
  }
}

function dot(a: readonly number[], b: readonly number[]): number {
  return a.reduce((sum, value, index) => sum + value * b[index]!, 0);
}

function findNeighbors(
  oc: OpenCascadeInstance,
  solid: TopoDS_Shape,
  selected: TopoDS_Face,
  own: <T extends { delete(): void }>(value: T) => T
): TopoDS_Face[] {
  const edges = own(new oc.TopTools_IndexedMapOfShape_1());
  const faces = own(new oc.TopTools_IndexedMapOfShape_1());
  oc.TopExp.MapShapes_1(
    selected,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE as Parameters<
      typeof oc.TopExp.MapShapes_1
    >[1],
    edges
  );
  oc.TopExp.MapShapes_1(
    solid,
    oc.TopAbs_ShapeEnum.TopAbs_FACE as Parameters<
      typeof oc.TopExp.MapShapes_1
    >[1],
    faces
  );
  const neighbors: TopoDS_Face[] = [];
  for (let index = 1; index <= faces.Extent(); index++) {
    const shape = own(faces.FindKey(index));
    if (shape.IsSame(selected)) continue;
    const faceEdges = own(new oc.TopTools_IndexedMapOfShape_1());
    oc.TopExp.MapShapes_1(
      shape,
      oc.TopAbs_ShapeEnum.TopAbs_EDGE as Parameters<
        typeof oc.TopExp.MapShapes_1
      >[1],
      faceEdges
    );
    for (let edgeIndex = 1; edgeIndex <= faceEdges.Extent(); edgeIndex++) {
      if (edges.Contains(own(faceEdges.FindKey(edgeIndex)))) {
        neighbors.push(own(oc.TopoDS.Face_1(shape)));
        break;
      }
    }
  }
  return neighbors;
}

function readPlanarDirection(
  oc: OpenCascadeInstance,
  face: TopoDS_Face,
  own: <T extends { delete(): void }>(value: T) => T
): readonly [number, number, number] | undefined {
  const adaptor = own(new oc.BRepAdaptor_Surface_2(face, true));
  if (adaptor.GetType() !== oc.GeomAbs_SurfaceType.GeomAbs_Plane) {
    const geometricSurface = own(oc.BRep_Tool.Surface_2(face));
    const planarity = own(
      new oc.GeomLib_IsPlanarSurface(geometricSurface, 1e-7)
    );
    if (!planarity.IsPlanar()) return undefined;
  }
  const point = own(new oc.gp_Pnt_1());
  const du = own(new oc.gp_Vec_1());
  const dv = own(new oc.gp_Vec_1());
  adaptor.D1(
    (adaptor.FirstUParameter() + adaptor.LastUParameter()) / 2,
    (adaptor.FirstVParameter() + adaptor.LastVParameter()) / 2,
    point,
    du,
    dv
  );
  const cross = [
    du.Y() * dv.Z() - du.Z() * dv.Y(),
    du.Z() * dv.X() - du.X() * dv.Z(),
    du.X() * dv.Y() - du.Y() * dv.X()
  ] as const;
  const length = Math.hypot(...cross);
  if (length < 1e-12)
    throw new Error("Face offset could not determine a stable planar normal.");
  return [cross[0] / length, cross[1] / length, cross[2] / length];
}

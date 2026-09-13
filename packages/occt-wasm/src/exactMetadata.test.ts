import type { OpenCascadeInstance, TopoDS_Shape } from "opencascade.js";
import { describe, expect, it, vi } from "vitest";
import { loadOcct } from "./index";
import { createOcctExactBodyDataArtifactWithInstance } from "./exactCheckpointPayload";
import {
  readExactTopologySnapshot,
  withOcctExactBodyShape,
  withImportedBrepShape,
  type OcctExactBodyMetadata,
  type OcctExactPrimitiveMetadataSource,
  type OcctTopologyEntityDescriptor
} from "./exactMetadata";

function exactBounds(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape
): OcctExactBodyMetadata["bounds"] {
  const box = new oc.Bnd_Box_1();
  try {
    oc.BRepBndLib.AddOptimal(shape, box, false, true);
    const min = box.CornerMin();
    const max = box.CornerMax();
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
    box.delete();
  }
}

function assertOriginalBounds(
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape,
  entities: readonly OcctTopologyEntityDescriptor[]
) {
  const original = new Map<string, OcctExactBodyMetadata["bounds"]>();
  const shapeKinds = ["solid", "face", "wire", "edge", "vertex"] as const;
  for (const kind of shapeKinds) {
    const map = new oc.TopTools_IndexedMapOfShape_1();
    const type = oc.TopAbs_ShapeEnum[
      `TopAbs_${kind.toUpperCase()}` as "TopAbs_SOLID"
    ] as unknown as Parameters<typeof oc.TopExp.MapShapes_1>[1];
    try {
      oc.TopExp.MapShapes_1(shape, type, map);
      for (let index = 1; index <= map.Size(); index++) {
        const child = map.FindKey(index);
        try {
          const bounds = exactBounds(oc, child);
          const localId = `snapshot-local:${kind}:${index}`;
          expect(
            entities.find((entity) => entity.localId === localId)?.bounds
          ).toEqual(bounds);
          original.set(localId, bounds);
        } finally {
          child.delete();
        }
      }
    } finally {
      map.delete();
    }
  }
  expect(entities.find((entity) => entity.kind === "body")?.bounds).toEqual(
    exactBounds(oc, shape)
  );
  for (const entity of entities) {
    const reference =
      entity.kind === "loop"
        ? entity.relationships?.underlyingWireLocalId
        : entity.kind === "coedge"
          ? entity.relationships?.underlyingEdgeLocalId
          : undefined;
    if (reference) expect(entity.bounds).toEqual(original.get(reference));
  }
}

describe("shared exact topology evidence", () => {
  it("reuses aggregate bounds without changing exact boxes or dropping loose geometry", async () => {
    const oc = await loadOcct();
    const builder = new oc.BRep_Builder();
    const compound = new oc.TopoDS_Compound();
    builder.MakeCompound(compound);
    const sources: readonly OcctExactPrimitiveMetadataSource[] = [
      {
        kind: "cylinder",
        dimensions: { radius: 3, height: 7 },
        transform: {
          translation: [4, -3, 2],
          rotation: [0.3, 0.4, 0.2],
          scale: [1, 1, 1]
        }
      },
      {
        kind: "torus",
        dimensions: { majorRadius: 8, minorRadius: 2 },
        transform: {
          translation: [-10, 2, 8],
          rotation: [0.2, -0.5, 0.7],
          scale: [1, 1, 1]
        }
      }
    ];
    const point = new oc.gp_Pnt_3(100, 200, 300);
    const other = new oc.gp_Pnt_3(-100, -200, -300);
    const vertexBuilder = new oc.BRepBuilderAPI_MakeVertex(point);
    const edgeBuilder = new oc.BRepBuilderAPI_MakeEdge_3(point, other);
    const vertex = vertexBuilder.Vertex();
    const edge = edgeBuilder.Edge();
    try {
      for (const source of sources) {
        withOcctExactBodyShape(oc, source, (body) =>
          builder.Add(compound, body)
        );
      }
      builder.Add(compound, vertex);
      builder.Add(compound, edge);
      const addOptimal = vi.spyOn(oc.BRepBndLib, "AddOptimal");
      let snapshot;
      try {
        snapshot = readExactTopologySnapshot(oc, compound, "importedBody");
        expect(addOptimal).toHaveBeenCalledTimes(
          snapshot.entityCounts.faceCount +
            snapshot.entityCounts.edgeCount +
            snapshot.entityCounts.vertexCount
        );
      } finally {
        addOptimal.mockRestore();
      }
      expect(snapshot.entityCounts.solidCount).toBe(2);
      assertOriginalBounds(oc, compound, snapshot.entities);
      const body = snapshot.entities.find((entity) => entity.kind === "body")!;
      expect(body.bounds!.max[2]).toBeGreaterThanOrEqual(300);
      expect(body.bounds!.min[2]).toBeLessThanOrEqual(-300);
    } finally {
      edge.delete();
      vertex.delete();
      edgeBuilder.delete();
      vertexBuilder.delete();
      point.delete();
      other.delete();
      compound.delete();
      builder.delete();
    }
  }, 30_000);
  it("retains actual rotated plane and cylinder frames through a BRep round trip", async () => {
    const oc = await loadOcct();
    const origin = new oc.gp_Pnt_3(7, -4, 2);
    const direction = new oc.gp_Dir_4(1, 2, 3);
    const axes = new oc.gp_Ax2_3(origin, direction);
    const builder = new oc.BRepPrimAPI_MakeCylinder_3(axes, 3, 8);
    const shape = builder.Shape();
    const progress = new oc.Message_ProgressRange_1();
    const path = "/tmp/topology-frame-test.brep";
    try {
      const snapshot = readExactTopologySnapshot(oc, shape, "importedBody");
      const cylinder = snapshot.entities.find(
        (entity) => entity.surfaceClass === "cylinder"
      )!;
      expect(cylinder.axisOrigin).toEqual([7, -4, 2]);
      expect(cylinder.radius).toBe(3);
      const expectedAxis = [1, 2, 3].map((value) => value / Math.sqrt(14));
      for (const axis of [0, 1, 2] as const) {
        expect(cylinder.axis![axis]).toBeCloseTo(expectedAxis[axis]!, 12);
      }
      const planes = snapshot.entities.filter(
        (entity) => entity.surfaceClass === "plane"
      );
      expect(planes).toHaveLength(2);
      for (const plane of planes) {
        const frame = plane.planeFrame!;
        expect(frame).toBeDefined();
        expect(frame.normal).toEqual(plane.normal);
        const dot = (a: readonly number[], b: readonly number[]) =>
          a.reduce((sum, value, index) => sum + value * b[index]!, 0);
        expect(dot(frame.xDirection, frame.yDirection)).toBeCloseTo(0, 12);
        expect(dot(frame.xDirection, frame.normal)).toBeCloseTo(0, 12);
        expect(dot(frame.yDirection, frame.normal)).toBeCloseTo(0, 12);
        expect(Math.abs(dot(frame.normal, expectedAxis))).toBeCloseTo(1, 12);
        const delta = frame.origin.map(
          (value, index) => value - [7, -4, 2][index]!
        );
        const height = dot(delta, expectedAxis);
        expect(Math.min(Math.abs(height), Math.abs(height - 8))).toBeLessThan(
          1e-10
        );
      }
      expect(oc.BRepTools.Write_3(shape, path, progress)).toBe(true);
      const bytes = oc.FS.readFile(path);
      const reopened = withImportedBrepShape(oc, bytes, (restored) =>
        readExactTopologySnapshot(oc, restored, "importedBody")
      );
      expect(reopened.signature).toBe(snapshot.signature);
      for (const entity of [...planes, cylinder]) {
        const restored = reopened.entities.find(
          (item) => item.localId === entity.localId
        )!;
        expect(restored.surfaceClass).toBe(entity.surfaceClass);
        const vectors = (item: OcctTopologyEntityDescriptor) => [
          item.axis,
          item.axisOrigin,
          item.planeFrame?.origin,
          item.planeFrame?.xDirection,
          item.planeFrame?.yDirection,
          item.planeFrame?.normal
        ];
        for (const [index, vector] of vectors(entity).entries()) {
          const actual = vectors(restored)[index];
          if (!vector) expect(actual).toBeUndefined();
          else
            for (const axis of [0, 1, 2] as const) {
              expect(actual![axis]).toBeCloseTo(vector[axis], 12);
            }
        }
      }
    } finally {
      oc.FS.unlink(path);
      progress.delete();
      shape.delete();
      builder.delete();
      axes.delete();
      direction.delete();
      origin.delete();
    }
  }, 30_000);
  it("validates a checkpoint once while retaining exact metadata and rejection of mismatched identity", async () => {
    const oc = await loadOcct();
    const authored = createOcctExactBodyDataArtifactWithInstance(oc, {
      source: {
        kind: "box",
        dimensions: { width: 10, height: 8, depth: 6 },
        transform: {
          translation: [4, 5, 6],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      }
    });
    const checkpoint = {
      kind: "checkpointBody" as const,
      brepBytes: authored.brepBytes,
      brepByteLength: authored.brepByteLength,
      brepSha256: "0".repeat(64),
      topologySourceKind: authored.sourceKind,
      topologySignature: authored.topologySnapshot.signature
    };
    const addOptimal = vi.spyOn(oc.BRepBndLib, "AddOptimal");
    try {
      const reopened = createOcctExactBodyDataArtifactWithInstance(oc, {
        source: checkpoint
      });
      const counts = reopened.topologySnapshot.entityCounts;
      expect(addOptimal).toHaveBeenCalledTimes(
        counts.faceCount + counts.edgeCount + counts.vertexCount
      );
      expect(reopened.metadata).toEqual(authored.metadata);
      expect(JSON.stringify(reopened.topologySnapshot)).toBe(
        JSON.stringify(authored.topologySnapshot)
      );
      expect(() =>
        createOcctExactBodyDataArtifactWithInstance(oc, {
          source: { ...checkpoint, topologySignature: "fnv1a32:bad00000" }
        })
      ).toThrow(/topology signature mismatched/);
    } finally {
      addOptimal.mockRestore();
    }
  }, 30_000);
});

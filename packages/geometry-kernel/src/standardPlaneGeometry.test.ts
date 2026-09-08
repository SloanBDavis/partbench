import { expect, it } from "vitest";
import { executeGeometryKernelRequest } from "./index";

it.each([
  { plane: "XY", min: [0, -7, 0], max: [60, 7, 8], centroid: [30, 0, 4] },
  { plane: "XZ", min: [0, -8, -7], max: [60, 0, 7], centroid: [30, -4, 0] },
  { plane: "YZ", min: [0, 0, -7], max: [8, 60, 7], centroid: [4, 30, 0] }
] as const)(
  "keeps primitive display and exact extrusion placement consistent on $plane",
  async ({ plane, min, max, centroid }) => {
    const source = {
      kind: "extrude" as const,
      sketchPlane: plane,
      profile: {
        kind: "rectangle" as const,
        center: [30, 0] as const,
        width: 60,
        height: 14
      },
      depth: 8
    };
    const exact = await executeGeometryKernelRequest({
      id: "plane-exact",
      version: "geometry-kernel.v1",
      op: "geometry.exactBodyMetadata",
      source
    });
    const displayed = await executeGeometryKernelRequest({
      id: "plane-display",
      version: "geometry-kernel.v1",
      op: "geometry.tessellateExtrude",
      sketchPlane: plane,
      profile: source.profile,
      depth: source.depth
    });
    if (!exact.ok) throw new Error(exact.error.message);
    if (!displayed.ok) throw new Error(displayed.error.message);
    expect(exact.metadata.volume).toBeCloseTo(6720, 6);
    for (const axis of [0, 1, 2] as const) {
      const positions = displayed.mesh.positions.filter(
        (_, index) => index % 3 === axis
      );
      expect(Math.min(...positions)).toBeCloseTo(min[axis], 6);
      expect(Math.max(...positions)).toBeCloseTo(max[axis], 6);
      expect(exact.metadata.bounds.min[axis]).toBeCloseTo(min[axis], 6);
      expect(exact.metadata.bounds.max[axis]).toBeCloseTo(max[axis], 6);
      expect(exact.metadata.centroid[axis]).toBeCloseTo(centroid[axis], 6);
    }
  },
  120_000
);

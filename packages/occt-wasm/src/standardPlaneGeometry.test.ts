import { expect, it } from "vitest";
import { createOcctExactBodyMetadataWithInstance, loadOcct } from "./index";
import type { OcctBooleanExtrudePrimitiveSource } from "./booleanExtrudes";
import type {
  OcctResolvedPlaneFrame,
  OcctWireExtrudeSource
} from "./wireExtrude";

const planes = [
  { plane: "XY", u: [1, 0, 0], v: [0, 1, 0], centroid: [30, 0, 4] },
  { plane: "XZ", u: [1, 0, 0], v: [0, 0, 1], centroid: [30, -4, 0] },
  { plane: "YZ", u: [0, 1, 0], v: [0, 0, 1], centroid: [4, 30, 0] }
] as const;

function expectPoint(actual: readonly number[], expected: readonly number[]) {
  expected.forEach((value, index) =>
    expect(actual[index]).toBeCloseTo(value, 6)
  );
}

function rectangleWire(frame: OcctResolvedPlaneFrame) {
  const corners = [
    [0, -7],
    [60, -7],
    [60, 7],
    [0, 7]
  ] as const;
  return {
    kind: "wire" as const,
    frame,
    closed: true as const,
    sourceIdentity: "standard-plane-rectangle",
    geometryPolicy: {
      linearTolerance: 1e-6,
      angularToleranceDegrees: 0.01,
      minimumProfileArea: 1e-8
    },
    segments: corners.map((start, index) => ({
      kind: "line" as const,
      sourceEntityId: `edge-${index}`,
      start,
      end: corners[(index + 1) % corners.length]!
    }))
  };
}

it.each(planes)(
  "places primitive and resolved region extrusions and their actual holes on $plane",
  async ({ plane, u, v, centroid }) => {
    const oc = await loadOcct();
    const sources: (
      | OcctBooleanExtrudePrimitiveSource
      | OcctWireExtrudeSource
    )[] = [
      {
        sketchPlane: plane,
        profile: { kind: "rectangle", center: [30, 0], width: 60, height: 14 },
        depth: 8
      },
      {
        sketchPlane: plane,
        profile: rectangleWire({ origin: [0, 0, 0], uAxis: u, vAxis: v }),
        depth: 8
      }
    ];
    const removedVolume = Math.PI * 2 ** 2 * 8;
    const boredCenterU =
      (6720 * 30 - removedVolume * 45) / (6720 - removedVolume);
    for (const target of sources) {
      const solid = createOcctExactBodyMetadataWithInstance(oc, {
        source: { ...target, kind: "extrude" }
      });
      expect(solid.volume).toBeCloseTo(6720, 6);
      expectPoint(solid.centroid, centroid);
      const bored = createOcctExactBodyMetadataWithInstance(oc, {
        source: {
          kind: "hole",
          target,
          tool: {
            sketchPlane: plane,
            circle: { kind: "circle", center: [45, 0], radius: 2 },
            depthMode: "throughAll",
            direction: "positive"
          }
        }
      });
      expect(bored.volume).toBeCloseTo(6720 - removedVolume, 6);
      expectPoint(
        bored.centroid,
        centroid.map((value, index) => value + u[index]! * (boredCenterU - 30))
      );
      expect(bored.topologyCounts.solidCount).toBe(1);
    }
  },
  120_000
);

it("respects positive, negative, and symmetric XZ circle extrusion and offset placement frames", async () => {
  const oc = await loadOcct();
  for (const [side, y] of [
    ["positive", -4],
    ["negative", 4],
    ["symmetric", 0]
  ] as const) {
    const result = createOcctExactBodyMetadataWithInstance(oc, {
      source: {
        kind: "extrude",
        sketchPlane: "XZ",
        profile: { kind: "circle", center: [30, 3], radius: 3 },
        depth: 8,
        side
      }
    });
    expect(result.volume).toBeCloseTo(Math.PI * 3 ** 2 * 8, 6);
    expectPoint(result.centroid, [30, y, 3]);
  }
  const offset = createOcctExactBodyMetadataWithInstance(oc, {
    source: {
      kind: "extrude",
      sketchPlane: "XZ",
      profile: { kind: "rectangle", center: [30, 0], width: 60, height: 14 },
      depth: 8,
      placementFrame: { origin: [0, 15, 0], uAxis: [1, 0, 0], vAxis: [0, 0, 1] }
    }
  });
  expectPoint(offset.centroid, [30, 11, 0]);
}, 120_000);

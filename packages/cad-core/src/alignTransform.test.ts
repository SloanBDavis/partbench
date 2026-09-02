import { describe, expect, it } from "vitest";
import { computeAlignPose } from "./alignTransform";

describe("computeAlignPose", () => {
  it("translates a parallel source face onto a target plane", () => {
    const pose = computeAlignPose(
      { point: [40, 0, 8], normal: [0, 0, 1] },
      { kind: "plane", plane: { point: [0, 0, 10], normal: [0, 0, 1] } }
    );

    expect(pose.transform.rotationDegrees).toBe(0);
    expect(pose.transform.translation[0]).toBeCloseTo(0);
    expect(pose.transform.translation[1]).toBeCloseTo(0);
    expect(pose.transform.translation[2]).toBeCloseTo(2);
    expect(pose.alignedSourceFace.point[2]).toBeCloseTo(10);
    expect(pose.alignedSourceFace.normal[2]).toBeCloseTo(1);
  });

  it("locks remaining rotation about a datum axis and puts the axis in the face", () => {
    const pose = computeAlignPose(
      { point: [125, 0, 4], normal: [1, 0, 0] },
      {
        kind: "axis",
        axis: { origin: [0, 0, 0], direction: [0, 0, 1] }
      }
    );

    expect(pose.transform.rotationDegrees).toBe(0);
    expect(pose.transform.translation[0]).toBeCloseTo(-125);
    expect(pose.transform.translation[1]).toBeCloseTo(0);
    expect(pose.alignedSourceFace.point[0]).toBeCloseTo(0);
    expect(pose.alignedSourceFace.normal[0]).toBeCloseTo(1);
  });
});

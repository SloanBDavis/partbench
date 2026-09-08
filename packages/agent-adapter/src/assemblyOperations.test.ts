import { describe, expect, it } from "vitest";
import { parseCadOpsAgentRequest } from "./index";

const frame = {
  instanceId: "base",
  frame: { kind: "sketch", sketchId: "outline", entityId: "pivot", offset: 4 }
};
const localFrame = {
  instanceId: "link",
  frame: {
    kind: "local",
    origin: [0, 0, 0],
    xDirection: [1, 0, 0],
    zDirection: [0, 0, 1]
  }
};
const revolute = {
  op: "assembly.mate.create",
  assemblyId: "arm",
  id: "elbow",
  kind: "revolute",
  primary: frame,
  secondary: localFrame,
  angleParameterId: "elbow_angle",
  offsetParameterId: "clearance"
};
const distance = {
  op: "assembly.mate.create",
  assemblyId: "arm",
  id: "jaw_gap",
  kind: "distance",
  primary: { instanceId: "base", plane: "YZ" },
  secondary: { instanceId: "jaw", plane: "YZ" },
  distanceParameterId: "gripper_opening"
};
function request(ops: readonly unknown[]) {
  return {
    requestId: "assembly",
    adapterVersion: "web-cad.agent-adapter.v1",
    batch: { version: "cadops.v1", mode: "dryRun", ops }
  };
}

describe("assembly operation transport", () => {
  it("preserves joint frames, parameter bindings and pose edits through parsing", () => {
    const ops = [
      {
        op: "assembly.instance.updateTransform",
        assemblyId: "arm",
        instanceId: "base",
        transform: { rotation: [0, 0, Math.PI / 2] }
      },
      revolute,
      {
        ...revolute,
        op: "assembly.mate.edit",
        id: undefined,
        mateId: "elbow",
        angleParameterId: undefined,
        angleDegrees: -45,
        offsetParameterId: undefined,
        offset: 2
      },
      distance,
      {
        ...distance,
        op: "assembly.mate.edit",
        id: undefined,
        mateId: "jaw_gap"
      }
    ];
    expect(parseCadOpsAgentRequest(request(ops)).batch.ops).toEqual(ops);
  });

  it("rejects ambiguous bindings, malformed frames and non-finite poses before execution", () => {
    const invalid = [
      { ...revolute, angleDegrees: 45 },
      { ...revolute, angleParameterId: undefined },
      { ...revolute, offset: 2 },
      {
        ...revolute,
        primary: {
          ...frame,
          frame: { ...frame.frame, opaqueTopologyId: "private" }
        }
      },
      {
        ...revolute,
        secondary: {
          ...localFrame,
          frame: { ...localFrame.frame, zDirection: [0, 0] }
        }
      },
      { ...distance, distance: 4 },
      { ...distance, distanceParameterId: "" },
      {
        op: "assembly.instance.updateTransform",
        assemblyId: "arm",
        instanceId: "base",
        transform: { rotation: [0, 0, Infinity] }
      },
      {
        op: "assembly.instance.updateTransform",
        assemblyId: "arm",
        instanceId: "base",
        transform: {}
      }
    ];
    for (const op of invalid) {
      expect(() => parseCadOpsAgentRequest(request([op]))).toThrow(
        "Invalid CADOps agent adapter request"
      );
    }
  });
});

import { readFileSync } from "node:fs";
import { URL } from "node:url";

// Keep the original designer's part geometry and intended XY/XZ planes.
const original = (name) =>
  JSON.parse(
    readFileSync(
      new URL(`../robot-arm-trial/${name}.json`, import.meta.url),
      "utf8"
    )
  );
export const parts = original("parts");
export const sketchOps = original("01-sketches").arguments.batch.ops;
export const solidOps = original("02-solids").arguments.batch.ops;
export const regionOps = original("03-regions").arguments.batch.ops;

const assemblyId = "arm";
const sketch = (instanceId, part, entity, options = {}) => ({
  instanceId,
  frame: { kind: "sketch", sketchId: `s_${part}`, entityId: entity, ...options }
});
const hole = (instanceId, part, index) =>
  sketch(instanceId, part, `h_${part}_${index}`);
const center = (instanceId, part) => sketch(instanceId, part, `e_${part}`);
const local = (instanceId, origin = [0, 0, 0], zDirection = [0, -1, 0]) => ({
  instanceId,
  frame: { kind: "local", origin, xDirection: [1, 0, 0], zDirection }
});
const joint = (id, primary, secondary, values = {}) => ({
  op: "assembly.mate.create",
  assemblyId,
  id,
  name: id.replaceAll("_", " "),
  kind: "revolute",
  primary,
  secondary,
  ...("angleParameterId" in values ? {} : { angleDegrees: 0 }),
  ...values
});

export function assemblyOps() {
  const instances = [
    ["i_base", "base"],
    ["i_yaw", "yaw"],
    ["i_shoulder_front", "shoulder"],
    ["i_shoulder_back", "shoulder"],
    ["i_upper", "upper"],
    ["i_forearm", "forearm"],
    ["i_wrist_front", "wrist"],
    ["i_wrist_back", "wrist"],
    ["i_rail", "rail"],
    ["i_finger_lower", "finger"],
    ["i_finger_upper", "finger"],
    ["i_pin_yaw", "pin8"],
    ["i_pin_shoulder", "pin8"],
    ["i_pin_elbow", "pin8"],
    ["i_pin_wrist", "pin8"],
    ...[0, 1, 2, 3].map((index) => [`i_bolt_base_${index}`, "bolt4"]),
    ...[0, 1, 2, 3].map((index) => [`i_bolt_yaw_${index}`, "bolt4"]),
    ...[
      "yaw",
      "shoulder_front",
      "shoulder_back",
      "elbow",
      "wrist_front",
      "wrist_back"
    ].map((name) => [`i_spacer_${name}`, "spacer"])
  ];
  return [
    ...[
      ["yaw_angle", 25],
      ["shoulder_angle", 60],
      ["elbow_angle", -100],
      ["wrist_angle", 40]
    ].map(([id, value]) => ({ op: "parameter.create", id, name: id, value })),
    { op: "parameter.create", id: "jaw_upper", name: "jaw_upper", value: 17 },
    {
      op: "parameter.setExpression",
      id: "jaw_upper",
      expression: "gripper_opening / 2 + 7"
    },
    { op: "parameter.create", id: "jaw_lower", name: "jaw_lower", value: -17 },
    {
      op: "parameter.setExpression",
      id: "jaw_lower",
      expression: "-gripper_opening / 2 - 7"
    },
    { op: "assembly.create", id: assemblyId, name: "Connected robot arm" },
    ...instances.map(([id, body]) => ({
      op: "assembly.instance.insert",
      assemblyId,
      id,
      name: id.replaceAll("_", " "),
      definition: { kind: "body", bodyId: `b_${body}` }
    })),
    {
      op: "assembly.mate.create",
      assemblyId,
      id: "ground",
      kind: "fixed",
      instanceId: "i_base"
    },
    joint("joint_yaw", hole("i_base", "base", 4), hole("i_yaw", "yaw", 0), {
      angleParameterId: "yaw_angle",
      offset: 10
    }),
    joint(
      "mount_shoulder_front",
      local("i_yaw", [0, -6, 10]),
      local("i_shoulder_front")
    ),
    joint(
      "mount_shoulder_back",
      local("i_yaw", [0, 14, 10]),
      local("i_shoulder_back")
    ),
    joint(
      "joint_shoulder",
      hole("i_shoulder_front", "shoulder", 0),
      hole("i_upper", "upper", 0),
      { angleParameterId: "shoulder_angle", offset: -10 }
    ),
    joint(
      "joint_elbow",
      hole("i_upper", "upper", 1),
      hole("i_forearm", "forearm", 0),
      { angleParameterId: "elbow_angle", offset: -10 }
    ),
    joint(
      "joint_wrist",
      hole("i_forearm", "forearm", 1),
      hole("i_wrist_front", "wrist", 0),
      { angleParameterId: "wrist_angle", offset: 10 }
    ),
    joint(
      "mount_wrist_back",
      hole("i_wrist_front", "wrist", 0),
      hole("i_wrist_back", "wrist", 0),
      { offset: -20 }
    ),
    joint(
      "mount_rail",
      local("i_wrist_front", [36, 13, 0]),
      local("i_rail", [0, 0, 0], [0, 0, 1])
    ),
    ...["lower", "upper"].map((side) =>
      joint(
        `jaw_${side}`,
        local("i_rail", [12, 0, 3], [0, 1, 0]),
        local(`i_finger_${side}`, [0, 0, 0], [0, 0, 1]),
        { offsetParameterId: `jaw_${side}` }
      )
    ),
    joint("pin_yaw", hole("i_base", "base", 4), center("i_pin_yaw", "pin8"), {
      offset: 14
    }),
    joint(
      "pin_shoulder",
      hole("i_shoulder_front", "shoulder", 0),
      center("i_pin_shoulder", "pin8"),
      { offset: -6 }
    ),
    joint(
      "pin_elbow",
      hole("i_upper", "upper", 1),
      center("i_pin_elbow", "pin8"),
      { offset: -1 }
    ),
    joint(
      "pin_wrist",
      hole("i_forearm", "forearm", 1),
      center("i_pin_wrist", "pin8"),
      { offset: 4 }
    ),
    ...[0, 1, 2, 3].map((index) =>
      joint(
        `bolt_base_${index}`,
        hole(`i_base`, "base", index),
        center(`i_bolt_base_${index}`, "bolt4"),
        { offset: -5 }
      )
    ),
    ...[0, 1, 2, 3].map((index) =>
      joint(
        `bolt_yaw_${index}`,
        hole(`i_yaw`, "yaw", index + 1),
        center(`i_bolt_yaw_${index}`, "bolt4"),
        { offset: -3 }
      )
    ),
    joint(
      "spacer_yaw",
      hole("i_base", "base", 4),
      hole("i_spacer_yaw", "spacer", 0),
      { offset: 8 }
    ),
    ...[
      ["shoulder_front", "i_shoulder_front", "shoulder", 0],
      ["shoulder_back", "i_upper", "upper", 0],
      ["elbow", "i_upper", "upper", 1],
      ["wrist_front", "i_wrist_front", "wrist", 0],
      ["wrist_back", "i_forearm", "forearm", 1]
    ].map(([name, instance, part, index]) =>
      joint(
        `spacer_${name}`,
        hole(instance, part, index),
        hole(`i_spacer_${name}`, "spacer", 0),
        { offset: -2 }
      )
    )
  ];
}

export const revisionOps = [
  { op: "parameter.update", id: "upper_span", value: 180 },
  { op: "parameter.update", id: "gripper_opening", value: 35 },
  { op: "parameter.update", id: "shoulder_angle", value: 75 }
];

const radians = (degrees) => (degrees * Math.PI) / 180;
export function rotate(point, angles) {
  const [x, y, z] = angles;
  const first = [
    point[0],
    point[1] * Math.cos(x) - point[2] * Math.sin(x),
    point[1] * Math.sin(x) + point[2] * Math.cos(x)
  ];
  const second = [
    first[0] * Math.cos(y) + first[2] * Math.sin(y),
    first[1],
    -first[0] * Math.sin(y) + first[2] * Math.cos(y)
  ];
  return [
    second[0] * Math.cos(z) - second[1] * Math.sin(z),
    second[0] * Math.sin(z) + second[1] * Math.cos(z),
    second[2]
  ];
}
export const add = (left, right) =>
  left.map((value, index) => value + right[index]);
export const worldPoint = (instance, point) =>
  add(
    instance.transform.translation,
    rotate(point, instance.transform.rotation)
  );

// Independent planar linkage math, not a replay of the mate solver.
export function expectedPivots({
  span = 180,
  shoulder = 75,
  elbow = -100,
  wrist = 40,
  yaw = 25,
  root = [0, 0, 0]
} = {}) {
  const world = (point) => add(root, rotate(point, [0, 0, radians(yaw)]));
  const along = (length, angle) => [
    length * Math.cos(radians(angle)),
    0,
    length * Math.sin(radians(angle))
  ];
  const shoulderPoint = [0, 0, 60];
  const elbowPoint = add(shoulderPoint, along(span, shoulder));
  const wristPoint = add(elbowPoint, along(140, shoulder + elbow));
  return {
    shoulder: world(add(shoulderPoint, [0, 4, 0])),
    elbow: world(add(elbowPoint, [0, 4, 0])),
    forearmStart: world(add(elbowPoint, [0, 14, 0])),
    wrist: world(add(wristPoint, [0, 14, 0])),
    wristCheek: world(add(wristPoint, [0, 4, 0])),
    gripperAngle: shoulder + elbow + wrist
  };
}

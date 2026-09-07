import { writeFileSync } from "node:fs";
const dir = "examples/robot-arm-trial";
const rad = (d) => (d * Math.PI) / 180;
const yaw = rad(25);
const world = ([x, y, z]) => [
  x * Math.cos(yaw) - y * Math.sin(yaw),
  x * Math.sin(yaw) + y * Math.cos(yaw),
  z
];
const add = (a, b) => a.map((x, i) => x + b[i]);
const along = (length, angle) => [
  length * Math.cos(rad(angle)),
  0,
  length * Math.sin(rad(angle))
];
export function makePose(span = 160, opening = 20) {
  const shoulder = [0, 0, 60],
    elbow = add(shoulder, along(span, 60)),
    wrist = add(elbow, along(140, -40));
  const instances = [];
  const mates = [];
  const instance = (id, body, point, angle = 0, flat = false, fixed = true) => {
    instances.push({
      id,
      body,
      transform: {
        translation: world(point),
        rotation: flat ? [0, 0, yaw] : [Math.PI / 2, -rad(angle), yaw]
      }
    });
    if (fixed)
      mates.push({
        op: "assembly.mate.create",
        id: `fix_${id}`,
        assemblyId: "arm",
        kind: "fixed",
        instanceId: id
      });
  };
  instance("i_base", "base", [0, 0, 0], 0, true);
  instance("i_yaw", "yaw", [0, 0, 10], 0, true);
  instance("i_shoulder_front", "shoulder", [0, -6, 20]);
  instance("i_shoulder_back", "shoulder", [0, 14, 20]);
  instance(
    "i_upper",
    "upper",
    add(add(shoulder, along(span / 2, 60)), [0, 4, 0]),
    60
  );
  instance(
    "i_forearm",
    "forearm",
    add(add(elbow, along(70, -40)), [0, 14, 0]),
    -40
  );
  instance("i_wrist_front", "wrist", add(wrist, [0, 4, 0]));
  instance("i_wrist_back", "wrist", add(wrist, [0, 24, 0]));
  instance("i_rail", "rail", add(wrist, [36, 17, 0]));
  const jawOffset = opening / 2 + 7;
  for (const sign of [-1, 1]) {
    const id = sign < 0 ? "i_finger_lower" : "i_finger_upper";
    instance(
      id,
      "finger",
      add(wrist, [48, 14, sign * jawOffset]),
      0,
      false,
      false
    );
    mates.push({
      op: "assembly.mate.create",
      id: `jaw_${id}`,
      assemblyId: "arm",
      kind: "distance",
      primary: { instanceId: "i_rail", plane: "XZ" },
      secondary: { instanceId: id, plane: "XZ" },
      distance: sign * jawOffset
    });
  }
  const pins = [
    ["i_pin_yaw", "i_base", [0, 0, 14], true, [0, 0, 0]],
    ["i_pin_shoulder", "i_shoulder_front", shoulder, false, [0, 40, 0]],
    ["i_pin_elbow", "i_upper", add(elbow, [0, 5, 0]), false, [span / 2, 0, 0]],
    ["i_pin_wrist", "i_forearm", add(wrist, [0, 10, 0]), false, [70, 0, 0]]
  ];
  for (const [id, parent, point, flat, origin] of pins) {
    instance(id, "pin8", point, 0, flat, false);
    mates.push({
      op: "assembly.mate.create",
      id: `pin_${id}`,
      assemblyId: "arm",
      kind: "concentric",
      primary: { instanceId: parent, axis: "Z", origin },
      secondary: { instanceId: id, axis: "Z" }
    });
  }
  for (const [x, y] of [
    [-40, -40],
    [40, -40],
    [-40, 40],
    [40, 40]
  ])
    instance(`i_bolt_base_${x}_${y}`, "bolt4", [x, y, -5], 0, true);
  for (const [x, y] of [
    [-20, -10],
    [20, -10],
    [-20, 10],
    [20, 10]
  ])
    instance(`i_bolt_yaw_${x}_${y}`, "bolt4", [x, y, 7], 0, true);
  instance("i_spacer_yaw", "spacer", [0, 0, 8], 0, true);
  for (const [id, p] of [
    ["shoulder_front", add(shoulder, [0, -4, 0])],
    ["shoulder_back", add(shoulder, [0, 6, 0])],
    ["elbow", add(elbow, [0, 6, 0])],
    ["wrist_front", add(wrist, [0, 6, 0])],
    ["wrist_back", add(wrist, [0, 16, 0])]
  ])
    instance(`i_spacer_${id}`, "spacer", p);
  const ops = instances.map((i) => ({
    op: "assembly.instance.insert",
    id: i.id,
    assemblyId: "arm",
    name: i.id.replaceAll("_", " "),
    definition: { kind: "body", bodyId: `b_${i.body}` },
    transform: i.transform
  }));
  return {
    span,
    opening,
    anglesDegrees: {
      yaw: 25,
      shoulderElevation: 60,
      elbowRelative: -100,
      forearmElevation: -40,
      wristRelative: 40,
      gripperElevation: 0
    },
    jointCenters: {
      shoulder: world(shoulder),
      elbow: world(elbow),
      wrist: world(wrist)
    },
    instances,
    mates,
    ops: [...ops, ...mates]
  };
}
const request = (file, ops) =>
  writeFileSync(
    `${dir}/${file}.json`,
    JSON.stringify(
      {
        name: "cad.batch",
        arguments: {
          allowCommit: true,
          batch: { version: "cadops.v1", mode: "commit", ops }
        }
      },
      null,
      2
    )
  );
const initial = makePose();
request("06-static-pose", [
  {
    op: "assembly.create",
    id: "arm",
    name: "Robot arm static concept — angular motion unsupported"
  },
  ...initial.ops
]);
writeFileSync(`${dir}/pose-initial.json`, JSON.stringify(initial, null, 2));
const revised = makePose(180, 35);
request("07-revision", [
  { op: "parameter.update", id: "upper_span", value: 180 },
  { op: "parameter.update", id: "gripper_opening", value: 35 },
  ...initial.instances.map((i) => ({
    op: "assembly.instance.delete",
    assemblyId: "arm",
    instanceId: i.id
  })),
  ...revised.ops
]);
writeFileSync(`${dir}/pose-revised.json`, JSON.stringify(revised, null, 2));
request(
  "08-gripper-motion",
  [-1, 1].map((sign) => {
    const id = sign < 0 ? "i_finger_lower" : "i_finger_upper";
    return {
      op: "assembly.mate.edit",
      mateId: `jaw_${id}`,
      assemblyId: "arm",
      kind: "distance",
      primary: { instanceId: "i_rail", plane: "XZ" },
      secondary: { instanceId: id, plane: "XZ" },
      distance: sign * (25 / 2 + 7)
    };
  })
);
request(
  "09-gripper-return",
  [-1, 1].map((sign) => {
    const id = sign < 0 ? "i_finger_lower" : "i_finger_upper";
    return {
      op: "assembly.mate.edit",
      mateId: `jaw_${id}`,
      assemblyId: "arm",
      kind: "distance",
      primary: { instanceId: "i_rail", plane: "XZ" },
      secondary: { instanceId: id, plane: "XZ" },
      distance: sign * (35 / 2 + 7)
    };
  })
);

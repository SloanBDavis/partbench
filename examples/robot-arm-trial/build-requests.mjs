import { writeFileSync } from "node:fs";
const out = "examples/robot-arm-trial";
export const request = (file, ops, mode = "commit", extra = {}) =>
  writeFileSync(
    `${out}/${file}.json`,
    JSON.stringify(
      {
        name: "cad.batch",
        arguments: {
          allowCommit: true,
          batch: { version: "cadops.v1", mode, ops },
          ...extra
        }
      },
      null,
      2
    )
  );
export const parts = [
  {
    id: "base",
    name: "100 mm mounting base",
    plane: "XY",
    center: [0, 0],
    width: 100,
    height: 100,
    depth: 8,
    holes: [
      [-40, -40, 2.25],
      [40, -40, 2.25],
      [-40, 40, 2.25],
      [40, 40, 2.25],
      [0, 0, 4.1]
    ]
  },
  {
    id: "yaw",
    name: "Yaw platter",
    plane: "XY",
    center: [0, 0],
    radius: 34,
    depth: 10,
    holes: [
      [0, 0, 4.1],
      [-20, -10, 2.25],
      [20, -10, 2.25],
      [-20, 10, 2.25],
      [20, 10, 2.25]
    ]
  },
  {
    id: "shoulder",
    name: "Shoulder cheek",
    plane: "XZ",
    center: [0, 25],
    width: 60,
    height: 50,
    depth: 8,
    holes: [
      [0, 40, 4.1],
      [-20, 8, 2.25],
      [20, 8, 2.25]
    ]
  },
  {
    id: "upper",
    name: "Upper arm plate",
    plane: "XZ",
    center: [0, 0],
    width: 190,
    height: 30,
    depth: 8,
    holes: [
      [-80, 0, 4.1],
      [80, 0, 4.1]
    ]
  },
  {
    id: "forearm",
    name: "Forearm plate",
    plane: "XZ",
    center: [0, 0],
    width: 170,
    height: 26,
    depth: 8,
    holes: [
      [-70, 0, 4.1],
      [70, 0, 4.1]
    ]
  },
  {
    id: "wrist",
    name: "Wrist clevis cheek",
    plane: "XZ",
    center: [20, 0],
    width: 64,
    height: 28,
    depth: 8,
    holes: [
      [0, 0, 4.1],
      [36, 7, 2.25],
      [36, -7, 2.25]
    ]
  },
  {
    id: "rail",
    name: "Gripper slide rail",
    plane: "XY",
    center: [0, 0],
    width: 24,
    height: 70,
    depth: 14,
    holes: [
      [-6, -26, 2.25],
      [6, -26, 2.25],
      [-6, 26, 2.25],
      [6, 26, 2.25]
    ]
  },
  {
    id: "finger",
    name: "Parallel gripper finger",
    plane: "XZ",
    center: [30, 0],
    width: 60,
    height: 14,
    depth: 8,
    holes: [
      [8, 0, 2.25],
      [20, 0, 2.25]
    ]
  },
  {
    id: "pin8",
    name: "8 mm pivot pin",
    plane: "XZ",
    center: [0, 0],
    radius: 4,
    depth: 28,
    side: "symmetric",
    holes: []
  },
  {
    id: "bolt4",
    name: "4 mm plain fastener shank",
    plane: "XY",
    center: [0, 0],
    radius: 2,
    depth: 18,
    holes: []
  },
  {
    id: "spacer",
    name: "2 mm pivot clearance spacer",
    plane: "XZ",
    center: [0, 0],
    radius: 7,
    depth: 2,
    holes: [[0, 0, 4.1]]
  }
];
let sketches = [{ op: "document.updateUnits", units: "mm" }];
for (const p of parts) {
  sketches.push({
    op: "sketch.create",
    id: `s_${p.id}`,
    name: p.name,
    plane: p.plane
  });
  sketches.push(
    p.radius
      ? {
          op: "sketch.addCircle",
          sketchId: `s_${p.id}`,
          id: `e_${p.id}`,
          center: p.center,
          radius: p.radius
        }
      : {
          op: "sketch.addRectangle",
          sketchId: `s_${p.id}`,
          id: `e_${p.id}`,
          center: p.center,
          width: p.width,
          height: p.height
        }
  );
  p.holes.forEach(([x, y, r], i) =>
    sketches.push({
      op: "sketch.addCircle",
      sketchId: `s_${p.id}`,
      id: `h_${p.id}_${i}`,
      center: [x, y],
      radius: r
    })
  );
}
sketches.push(
  { op: "parameter.create", id: "upper_span", name: "upper_span", value: 160 },
  { op: "parameter.create", id: "upper_half", name: "upper_half", value: 80 },
  {
    op: "parameter.setExpression",
    id: "upper_half",
    expression: "upper_span / 2"
  },
  {
    op: "parameter.create",
    id: "upper_length",
    name: "upper_length",
    value: 190
  },
  {
    op: "parameter.setExpression",
    id: "upper_length",
    expression: "upper_span + 30"
  },
  {
    op: "parameter.create",
    id: "gripper_opening",
    name: "gripper_opening",
    value: 20
  }
);
sketches.push({
  op: "sketch.dimension.create",
  id: "d_upper_length",
  name: "Upper overall length",
  sketchId: "s_upper",
  target: {
    kind: "entityScalar",
    entityId: "e_upper",
    entityKind: "rectangle",
    role: "width"
  },
  parameterId: "upper_length"
});
for (let i = 0; i < 2; i++)
  sketches.push({
    op: "sketch.dimension.create",
    id: `d_upper_pivot_${i}`,
    name: `Upper pivot ${i}`,
    sketchId: "s_upper",
    target: {
      kind: "pointPair",
      primary: { entityId: "e_upper", entityKind: "rectangle", role: "center" },
      secondary: {
        entityId: `h_upper_${i}`,
        entityKind: "circle",
        role: "center"
      },
      measurement: "horizontal",
      direction: i ? "positive" : "negative"
    },
    parameterId: "upper_half"
  });
request("01-sketches", sketches);
writeFileSync(`${out}/parts.json`, JSON.stringify(parts, null, 2));
const solids = [];
for (const p of parts) {
  const initial = p.holes.length ? `b_${p.id}_raw` : `b_${p.id}`;
  solids.push({
    op: "feature.extrude",
    id: `f_${p.id}_extrude`,
    name: p.name,
    bodyId: initial,
    sketchId: `s_${p.id}`,
    entityId: `e_${p.id}`,
    depth: p.depth,
    ...(p.side ? { side: p.side } : {})
  });
  let target = initial;
  p.holes.forEach((h, i) => {
    const bodyId = i === p.holes.length - 1 ? `b_${p.id}` : `b_${p.id}_h${i}`;
    solids.push({
      op: "feature.hole",
      id: `f_${p.id}_hole${i}`,
      bodyId,
      targetBodyId: target,
      sketchId: `s_${p.id}`,
      circleEntityId: `h_${p.id}_${i}`,
      depthMode: "throughAll",
      direction: "positive"
    });
    target = bodyId;
  });
}
request("02-solids", solids);

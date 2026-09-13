// Public CADOps only. All ratio-dependent geometry and joints reference native parameters.
const param = (id, value, expression) => [
  { op: "parameter.create", id, name: id, value },
  ...(expression ? [{ op: "parameter.setExpression", id, expression }] : [])
];
const bind = (parameterId) => ({ parameterId });
export const parameterOps = [
  ...param("input_angle", 0),
  ...param("output_teeth", 40),
  ...param("input_teeth", 20),
  ...param("module", 1.5),
  ...param("ratio", 2, "output_teeth / input_teeth"),
  ...param("output_angle", 4.5, "180 / output_teeth - input_angle / ratio"),
  ...param("center_distance", 45, "module * (input_teeth + output_teeth) / 2"),
  ...param("right_mount", 100, "center_distance + 55"),
  ...param("bridge_width", 141, "center_distance + 96"),
  ...param("bridge_center", 37.5, "(center_distance + 30) / 2"),
  ...param("gear_bore", 8.1),
  ...param("shaft_diameter", 8),
  ...param("bearing_bore", 8.3)
];
export const gearOps = ["pinion", "wheel"].map((id, i) => ({
  op: "feature.spurGear",
  id: `${id}_extrude`,
  bodyId: id,
  sketchId: `${id}_outline`,
  name: i ? "Output gear" : "Input gear",
  teeth: bind(i ? "output_teeth" : "input_teeth"),
  module: bind("module"),
  faceWidth: 10,
  boreDiameter: bind("gear_bore"),
  backlash: 0.08
}));
const pt = (entityId, entityKind = "circle") => ({
  entityId,
  entityKind,
  role: entityKind === "point" ? "position" : "center"
});
const dimension = (sketchId, id, target, value) => ({
  op: "sketch.dimension.create",
  id,
  name: id,
  sketchId,
  target,
  ...(typeof value === "string" ? { parameterId: value } : { value })
});
const scalar = (sketchId, id, kind, role, value) =>
  dimension(
    sketchId,
    `${id}_${role}`,
    { kind: "entityScalar", entityId: id, entityKind: kind, role },
    value
  );
const at = (sketchId, id, kind, xy) =>
  ["horizontal", "vertical"].map((measurement, index) =>
    dimension(
      sketchId,
      `${id}_${measurement}`,
      {
        kind: "pointPair",
        primary: pt(`${sketchId}:origin`, "point"),
        secondary: pt(id, kind),
        measurement,
        direction:
          typeof xy[index] === "number" && xy[index] < 0
            ? "negative"
            : "positive"
      },
      typeof xy[index] === "number" ? Math.abs(xy[index]) : xy[index]
    )
  );
const sketch = (id) => [
  { op: "sketch.create", id, name: id, plane: "XY" },
  {
    op: "sketch.addPoint",
    id: `${id}:origin`,
    sketchId: id,
    point: [0, 0],
    construction: true
  },
  {
    op: "sketch.constraint.create",
    id: `${id}:origin-fixed`,
    name: "Profile origin",
    sketchId: id,
    kind: "fixed",
    target: pt(`${id}:origin`, "point"),
    coordinate: [0, 0]
  }
];
function circle(sk, id, radius, xy = [0, 0], diameter = radius * 2) {
  return [
    {
      op: "sketch.addCircle",
      sketchId: sk,
      id,
      center: xy.map((x) =>
        typeof x === "number" ? x : x === "center_distance" ? 45 : 100
      ),
      radius
    },
    ...at(sk, id, "circle", xy),
    scalar(sk, id, "circle", "diameter", diameter)
  ];
}
function rectangle(
  sk,
  id,
  width,
  height,
  center = [0, 0],
  widthBinding = width,
  centerBinding = center
) {
  return [
    { op: "sketch.addRectangle", sketchId: sk, id, width, height, center },
    ...at(sk, id, "rectangle", centerBinding),
    scalar(sk, id, "rectangle", "width", widthBinding),
    scalar(sk, id, "rectangle", "height", height)
  ];
}
const entity = (entityId) => ({ kind: "entity", entityId });
const extrude = (id, sk, outer, holes, depth, bodyId = id) => ({
  op: "feature.extrude",
  id: `${id}_extrude`,
  bodyId,
  name: id,
  profile: {
    kind: "regions",
    sketchId: sk,
    regions: [{ outer: entity(outer), holes: holes.map(entity) }]
  },
  depth
});
export const hardwareOps = [
  ...sketch("base_sk"),
  ...rectangle("base_sk", "base_outer", 170, 115, [45, 0]),
  ...[
    [-25, 0],
    ["right_mount", 0],
    [-30, -45],
    [-30, 45],
    [120, -45],
    [120, 45]
  ].flatMap((xy, i) => circle("base_sk", `base_hole_${i}`, 2.2, xy)),
  extrude(
    "base",
    "base_sk",
    "base_outer",
    Array.from({ length: 6 }, (_, i) => `base_hole_${i}`),
    6
  ),
  ...sketch("bridge_sk"),
  ...rectangle(
    "bridge_sk",
    "bridge_outer",
    141,
    18,
    [37.5, 0],
    "bridge_width",
    ["bridge_center", 0]
  ),
  ...[
    [0, 0],
    ["center_distance", 0],
    [-25, 0],
    ["right_mount", 0]
  ].flatMap((xy, i) =>
    circle(
      "bridge_sk",
      `bridge_hole_${i}`,
      i < 2 ? 4.15 : 2.2,
      xy,
      i < 2 ? "bearing_bore" : 4.4
    )
  ),
  extrude(
    "bridge",
    "bridge_sk",
    "bridge_outer",
    Array.from({ length: 4 }, (_, i) => `bridge_hole_${i}`),
    6
  ),
  ...sketch("shaft_sk"),
  ...circle("shaft_sk", "shaft_outer", 4, [0, 0], "shaft_diameter"),
  extrude("shaft", "shaft_sk", "shaft_outer", [], 50),
  ...sketch("spacer_sk"),
  ...circle("spacer_sk", "spacer_outer", 6),
  ...circle("spacer_sk", "spacer_bore", 4.15, [0, 0], "bearing_bore"),
  extrude("spacer", "spacer_sk", "spacer_outer", ["spacer_bore"], 6.8),
  ...sketch("standoff_sk"),
  ...circle("standoff_sk", "standoff_outer", 4),
  ...circle("standoff_sk", "standoff_bore", 2.2),
  extrude("standoff", "standoff_sk", "standoff_outer", ["standoff_bore"], 24),
  ...sketch("bolt_sk"),
  ...circle("bolt_sk", "bolt_outer", 2),
  extrude("bolt_shank", "bolt_sk", "bolt_outer", [], 40, "bolt_shank"),
  ...sketch("bolt_head_sk"),
  ...rectangle("bolt_head_sk", "bolt_head", 7, 7),
  {
    op: "feature.extrude",
    id: "bolt_extrude",
    bodyId: "bolt_finished",
    name: "Tie bolt",
    sketchId: "bolt_head_sk",
    entityId: "bolt_head",
    depth: 4,
    side: "negative",
    operationMode: "add",
    targetBodyId: "bolt_shank"
  }
];
const frame = (instanceId, origin = [0, 0, 0], zDirection = [0, 0, 1]) => ({
  instanceId,
  frame: { kind: "local", origin, xDirection: [1, 0, 0], zDirection }
});
const source = (instanceId, sketchId, entityId) => ({
  instanceId,
  frame: { kind: "sketch", sketchId, entityId }
});
const insert = (id, bodyId) => ({
  op: "assembly.instance.insert",
  assemblyId: "gearbox",
  id,
  name: id,
  definition: { kind: "body", bodyId }
});
const joint = (id, primary, secondary, angle = 0, offset = 0) => ({
  op: "assembly.mate.create",
  assemblyId: "gearbox",
  id,
  name: id,
  kind: "revolute",
  primary,
  secondary,
  ...(typeof angle === "string"
    ? { angleParameterId: angle }
    : { angleDegrees: angle }),
  offset
});
export const assemblyOps = [
  { op: "assembly.create", id: "gearbox", name: "Parametric gearbox" },
  insert("base_i", "base"),
  {
    op: "assembly.mate.create",
    assemblyId: "gearbox",
    id: "base_fixed",
    kind: "fixed",
    instanceId: "base_i"
  },
  insert("bridge_bottom", "bridge"),
  joint(
    "bridge_bottom_mount",
    frame("base_i", [0, 0, 6]),
    frame("bridge_bottom")
  ),
  insert("bridge_top", "bridge"),
  joint("bridge_top_mount", frame("base_i", [0, 0, 36]), frame("bridge_top")),
  ...["input", "output"].flatMap((side, i) => [
    insert(`${side}_shaft`, "shaft"),
    joint(
      `${side}_rotation`,
      source("bridge_bottom", "bridge_sk", `bridge_hole_${i}`),
      frame(`${side}_shaft`),
      `${side}_angle`
    ),
    insert(`${side}_gear`, i ? "wheel" : "pinion"),
    joint(
      `${side}_gear_mount`,
      frame(`${side}_shaft`, [0, 0, 13]),
      frame(`${side}_gear`)
    ),
    ...[
      ["low", 6.1],
      ["high", 23.1]
    ].flatMap(([where, z]) => [
      insert(`${side}_spacer_${where}`, "spacer"),
      joint(
        `${side}_spacer_${where}_mount`,
        frame(`${side}_shaft`, [0, 0, z]),
        frame(`${side}_spacer_${where}`)
      )
    ])
  ]),
  ...[0, 1].flatMap((i) => [
    insert(`standoff_${i}`, "standoff"),
    joint(
      `standoff_mount_${i}`,
      source("base_i", "base_sk", `base_hole_${i}`),
      frame(`standoff_${i}`),
      0,
      12
    ),
    insert(`bolt_${i}`, "bolt_finished"),
    joint(
      `bolt_mount_${i}`,
      frame(`standoff_${i}`, [0, 0, 30], [0, 0, -1]),
      frame(`bolt_${i}`)
    )
  ])
];
export const revisionOps = [
  { op: "parameter.update", id: "output_teeth", value: 60 }
];
export const buildOps = [
  ...parameterOps,
  ...hardwareOps,
  ...gearOps,
  ...assemblyOps
];
export const partIds = [
  "pinion",
  "wheel",
  "base",
  "bridge",
  "shaft",
  "spacer",
  "standoff",
  "bolt_finished"
];

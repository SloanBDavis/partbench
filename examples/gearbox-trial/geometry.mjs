import fs from "node:fs";
import { URL } from "node:url";
export const P = JSON.parse(
  fs.readFileSync(new URL("./params.json", import.meta.url))
);
export const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
export function gearPoints(n) {
  const m = P.module,
    r = (m * n) / 2,
    ra = r + m,
    rf = r - 1.25 * m,
    rb = r * Math.cos((P.pressureAngleDegrees * Math.PI) / 180);
  const inv = (a) => Math.tan(a) - a;
  const half = Math.PI / (2 * n) - P.backlashTotal / (4 * r);
  const baseHalf = half + inv((P.pressureAngleDegrees * Math.PI) / 180);
  const tipInv = inv(Math.acos(rb / ra));
  const rootR = Math.max(rb, rf),
    startT = Math.sqrt((rootR / rb) ** 2 - 1),
    endT = Math.sqrt((ra / rb) ** 2 - 1);
  const pts = [];
  let add = (r, a) => pts.push(polar(r, a));
  for (let k = 0; k < n; k++) {
    const a = (2 * Math.PI * k) / n;
    const rootHalf = baseHalf - (startT - Math.atan(startT));
    add(rf, a - rootHalf);
    if (rb > rf) add(rb, a - baseHalf);
    for (let j = 1; j <= P.flankSegments; j++) {
      const t = startT + ((endT - startT) * j) / P.flankSegments;
      add(rb * Math.sqrt(1 + t * t), a - baseHalf + t - Math.atan(t));
    }
    const tipHalf = baseHalf - tipInv;
    for (let j = 1; j <= 4; j++) add(ra, a - tipHalf + (2 * tipHalf * j) / 4);
    for (let j = P.flankSegments - 1; j >= 0; j--) {
      const t = startT + ((endT - startT) * j) / P.flankSegments;
      add(rb * Math.sqrt(1 + t * t), a + baseHalf - t + Math.atan(t));
    }
    if (rb > rf) add(rf, a + baseHalf);
    for (let j = 1; j < 5; j++)
      add(rf, a + rootHalf + (((2 * Math.PI) / n - 2 * rootHalf) * j) / 5);
  }
  return pts.filter(
    (p, i) =>
      i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-8
  );
}
export const sketch = (id, name) => ({
  op: "sketch.create",
  id,
  name,
  plane: "XY"
});
export const circle = (sketchId, id, radius, center = [0, 0]) => ({
  op: "sketch.addCircle",
  sketchId,
  id,
  radius,
  center
});
export const rectangle = (sketchId, id, width, height, center = [0, 0]) => ({
  op: "sketch.addRectangle",
  sketchId,
  id,
  width,
  height,
  center
});
export const loop = (id) => ({ kind: "entity", entityId: id });
export const region = (sketchId, outer, holes = []) => ({
  kind: "regions",
  sketchId,
  regions: [{ outer, holes: holes.map(loop) }]
});
export function gearOps(id, n) {
  const sk = id + "_outline",
    pts = gearPoints(n);
  return [
    sketch(sk, `${n} tooth module ${P.module} sampled involute`),
    ...pts.map((p, i) => ({
      op: "sketch.addLine",
      sketchId: sk,
      id: `${id}_edge_${i}`,
      start: p,
      end: pts[(i + 1) % pts.length]
    })),
    circle(sk, id + "_bore", P.gearBore / 2),
    {
      op: "feature.extrude",
      id: id + "_extrude",
      bodyId: id,
      name: `${n}T spur gear m${P.module} PA20`,
      depth: P.faceWidth,
      profile: region(
        sk,
        {
          kind: "wire",
          segments: pts.map((_, i) => ({
            entityId: `${id}_edge_${i}`,
            orientation: "forward"
          }))
        },
        [id + "_bore"]
      )
    }
  ];
}
export const param = (id, value, description = id) => ({
  op: "parameter.create",
  id,
  name: id,
  value,
  description
});
export const expr = (id, expression) => ({
  op: "parameter.setExpression",
  id,
  expression
});
export const dim = (sketchId, entityId, entityKind, role, parameterId) => ({
  op: "sketch.dimension.create",
  id: `${entityId}_${role}_dim`,
  name: `${entityId} ${role}`,
  sketchId,
  target: { kind: "entityScalar", entityId, entityKind, role },
  parameterId
});
export function gearBuild(id, n) {
  const ops = gearOps(id, n),
    e = ops.at(-1);
  e.bodyId = id + "_blank";
  e.profile = {
    kind: "wire",
    sketchId: e.profile.sketchId,
    segments: e.profile.regions[0].outer.segments
  };
  ops.push({
    op: "feature.hole",
    id: id + "_bore_cut",
    bodyId: id,
    name: `${n}T gear with 8.1 bore`,
    sketchId: id + "_outline",
    circleEntityId: id + "_bore",
    depthMode: "throughAll",
    targetBodyId: id + "_blank"
  });
  return ops;
}
export function basicPart(id, outer, holes, depth, name = id) {
  let sk = id + "_sk";
  return [
    sketch(sk, name),
    outer.kind === "circle"
      ? circle(sk, id + "_outer", outer.radius)
      : rectangle(sk, id + "_outer", outer.width, outer.height, outer.center),
    ...holes.map((h, i) => circle(sk, id + "_hole_" + i, h.radius, h.center)),
    {
      op: "feature.extrude",
      id: id + "_extrude",
      bodyId: id,
      name,
      depth,
      profile: holes.length
        ? region(
            sk,
            loop(id + "_outer"),
            holes.map((_, i) => id + "_hole_" + i)
          )
        : { kind: "entity", sketchId: sk, entityId: id + "_outer" }
    }
  ];
}
export function supportOps(c) {
  const baseholes = [
    [-25, 0],
    [c + 55, 0],
    [-30, -45],
    [-30, 45],
    [120, -45],
    [120, 45]
  ].map((center) => ({ center, radius: 2.2 }));
  return [
    ...basicPart(
      "base",
      { width: P.baseWidth, height: P.baseDepth, center: [45, 0] },
      baseholes,
      P.baseThickness,
      "Table mounting base"
    ),
    ...basicPart(
      "bridge",
      { width: c + 96, height: P.bridgeDepth, center: [(c + 30) / 2, 0] },
      [0, c, -25, c + 55].map((x) => ({
        center: [x, 0],
        radius: x === 0 || x === c ? P.bearingBore / 2 : 2.2
      })),
      P.bridgeThickness,
      "Bearing bridge reused upper and lower"
    ),
    ...basicPart(
      "shaft",
      { kind: "circle", radius: P.shaftDiameter / 2 },
      [],
      P.shaftLength,
      "8 mm drive shaft reused twice"
    ),
    ...basicPart(
      "spacer",
      { kind: "circle", radius: 6 },
      [{ radius: P.bearingBore / 2, center: [0, 0] }],
      7,
      "Axial spacer 7 mm reused four times"
    ),
    ...basicPart(
      "standoff",
      { kind: "circle", radius: 4 },
      [{ radius: 2.2, center: [0, 0] }],
      P.standoffLength,
      "Bridge standoff 24 mm reused twice"
    ),
    sketch("bolt_head_sk", "Square tie bolt head"),
    rectangle("bolt_head_sk", "bolt_head", 7, 7),
    {
      op: "feature.extrude",
      id: "bolt_head_extrude",
      bodyId: "bolt_head_blank",
      sketchId: "bolt_head_sk",
      entityId: "bolt_head",
      depth: 4,
      side: "negative"
    },
    sketch("bolt_sk", "M4 simplified tie bolt"),
    circle("bolt_sk", "bolt_outer", 2),
    {
      op: "feature.extrude",
      id: "bolt_extrude",
      bodyId: "bolt_finished",
      sketchId: "bolt_sk",
      entityId: "bolt_outer",
      depth: 40,
      operationMode: "add",
      targetBodyId: "bolt_head_blank"
    }
  ];
}
export const frame = (
  origin = [0, 0, 0],
  xDirection = [1, 0, 0],
  zDirection = [0, 0, 1]
) => ({ kind: "local", origin, xDirection, zDirection });
export const insert = (
  id,
  bodyId,
  translation = [0, 0, 0],
  rotation = [0, 0, 0]
) => ({
  op: "assembly.instance.insert",
  assemblyId: "gearbox",
  id,
  name: id,
  definition: { kind: "body", bodyId },
  transform: { translation, rotation, scale: [1, 1, 1] }
});
export const joint = (id, parent, child, origin, angle, offset = 0) => ({
  op: "assembly.mate.create",
  assemblyId: "gearbox",
  id,
  name: id,
  kind: "revolute",
  primary: { instanceId: parent, frame: frame(origin) },
  secondary: { instanceId: child, frame: frame() },
  ...(typeof angle === "string"
    ? { angleParameterId: angle }
    : { angleDegrees: angle }),
  offset
});
export function assemblyOps(c) {
  return [
    { op: "assembly.create", id: "gearbox", name: "Tabletop involute gearbox" },
    insert("base_i", "base"),
    {
      op: "assembly.mate.create",
      assemblyId: "gearbox",
      id: "base_fixed",
      kind: "fixed",
      instanceId: "base_i"
    },
    insert("bridge_bottom", "bridge"),
    joint("bridge_bottom_mount", "base_i", "bridge_bottom", [0, 0, 6], 0),
    insert("bridge_top", "bridge"),
    joint("bridge_top_mount", "base_i", "bridge_top", [0, 0, 36], 0),
    insert("input_shaft", "shaft"),
    joint("input_rotation", "base_i", "input_shaft", [0, 0, 6], "input_angle"),
    insert("output_shaft", "shaft"),
    joint(
      "output_rotation",
      "base_i",
      "output_shaft",
      [c, 0, 6],
      "output_angle"
    ),
    insert("input_gear", "pinion"),
    joint(
      "pinion_shaft_attachment",
      "input_shaft",
      "input_gear",
      [0, 0, 13],
      0
    ),
    insert("output_gear", "wheel"),
    joint(
      "wheel_shaft_attachment",
      "output_shaft",
      "output_gear",
      [0, 0, 13],
      0
    ),
    ...[
      ["input", 0],
      ["output", c]
    ].flatMap(([label]) => [
      insert(label + "_spacer_low", "spacer"),
      joint(
        label + "_spacer_low_mount",
        label + "_shaft",
        label + "_spacer_low",
        [0, 0, 6],
        0
      ),
      insert(label + "_spacer_high", "spacer"),
      joint(
        label + "_spacer_high_mount",
        label + "_shaft",
        label + "_spacer_high",
        [0, 0, 23],
        0
      )
    ]),
    ...[-25, c + 55].flatMap((x, i) => [
      insert("standoff_" + i, "standoff"),
      joint("standoff_mount_" + i, "base_i", "standoff_" + i, [x, 0, 12], 0),
      insert("bolt_" + i, "bolt_finished", [x, 0, 42], [Math.PI, 0, 0]),
      {
        op: "assembly.mate.create",
        assemblyId: "gearbox",
        id: "bolt_fixed_" + i,
        kind: "fixed",
        instanceId: "bolt_" + i
      }
    ])
  ];
}

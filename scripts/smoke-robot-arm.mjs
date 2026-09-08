import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { register } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HeadlessMcpClient } from "./agent-runtime/mcp-client.mjs";
import {
  parts,
  sketchOps,
  solidOps,
  regionOps,
  assemblyOps,
  revisionOps,
  worldPoint,
  expectedPivots,
  rotate
} from "../examples/robot-arm-workflow/model.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, ".metrics/robot-arm-workflow");
const workspace = resolve(
  output,
  new Date().toISOString().replaceAll(":", "-")
);
const executable = resolve(root, "packages/mcp-stdio-server/dist/stdio.js");
register(new URL("./ts-source-loader.mjs", import.meta.url), import.meta.url);
await mkdir(workspace, { recursive: true });
const report = {
  timestamp: new Date().toISOString(),
  workspace,
  revisions: [],
  calls: []
};
const batch = (ops, mode = "commit") => ({
  allowCommit: true,
  batch: { version: "cadops.v1", mode, ops }
});
const near = (actual, expected, label) =>
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-6,
    `${label}: ${actual} != ${expected}`
  );
const nearPoint = (actual, expected, label) =>
  actual.forEach((value, i) => near(value, expected[i], `${label}[${i}]`));

async function masses(client, span) {
  const result = [];
  for (const part of parts) {
    const measured = await client.tool("cad.body_mass_properties", {
      bodyId: `b_${part.id}`
    });
    const mass = measured.massProperties;
    const area = part.radius
      ? Math.PI * part.radius ** 2
      : (part.id === "upper" ? span + 30 : part.width) * part.height;
    const holes = part.holes.reduce(
      (sum, hole) => sum + Math.PI * hole[2] ** 2,
      0
    );
    const centroid = [0, 1].map(
      (axis) =>
        (area * part.center[axis] -
          part.holes.reduce(
            (sum, hole) => sum + Math.PI * hole[2] ** 2 * hole[axis],
            0
          )) /
        (area - holes)
    );
    const depthCenter = part.side === "symmetric" ? 0 : part.depth / 2;
    const expectedCenter =
      part.plane === "XY"
        ? [...centroid, depthCenter]
        : [centroid[0], -depthCenter, centroid[1]];
    assert.equal(mass.measurementSource, "kernel-derived");
    near(mass.volume, (area - holes) * part.depth, `${part.id} exact volume`);
    nearPoint(mass.centerOfMass, expectedCenter, `${part.id} exact centroid`);
    result.push(mass.volume);
  }
  return result;
}

async function inspectArm(
  client,
  {
    span = 180,
    shoulder = 75,
    opening = 35,
    root: translation = [0, 0, 0]
  } = {}
) {
  const structure = await client.tool("cad.project_structure");
  const arm = structure.assemblies.find((assembly) => assembly.id === "arm");
  assert.equal(arm.instances.length, 29);
  assert.equal(arm.mates.length, 29);
  assert.equal(arm.mates.filter((mate) => mate.kind === "fixed").length, 1);
  const instance = (id) => {
    const item = arm.instances.find((entry) => entry.id === id);
    assert.ok(item, id);
    return item;
  };
  const upper = await client.tool("cad.sketch_get", { id: "s_upper" });
  const pivot = (id) => {
    const entity = upper.sketch.entities.find((entry) => entry.id === id);
    assert.ok(entity && entity.kind === "circle");
    return [entity.center[0], 0, entity.center[1]];
  };
  const expected = expectedPivots({ span, shoulder, root: translation });
  nearPoint(
    worldPoint(instance("i_upper"), pivot("h_upper_0")),
    expected.shoulder,
    "upper shoulder pivot"
  );
  nearPoint(
    worldPoint(instance("i_upper"), pivot("h_upper_1")),
    expected.elbow,
    "upper elbow pivot"
  );
  nearPoint(
    worldPoint(instance("i_forearm"), [-70, 0, 0]),
    expected.forearmStart,
    "forearm elbow pivot"
  );
  nearPoint(
    worldPoint(instance("i_forearm"), [70, 0, 0]),
    expected.wrist,
    "forearm wrist pivot"
  );
  nearPoint(
    worldPoint(instance("i_wrist_front"), [0, 0, 0]),
    expected.wristCheek,
    "wrist cheek pivot"
  );
  const fingers = [instance("i_finger_lower"), instance("i_finger_upper")];
  const gap =
    Math.hypot(
      ...fingers[0].transform.translation.map(
        (v, i) => v - fingers[1].transform.translation[i]
      )
    ) - 14;
  near(gap, opening, "actual jaw clearance");
  nearPoint(
    rotate([1, 0, 0], fingers[0].transform.rotation),
    rotate(
      [1, 0, 0],
      [0, (-expected.gripperAngle * Math.PI) / 180, (25 * Math.PI) / 180]
    ),
    "gripper follows joint angle"
  );
  const health = await client.tool("cad.project_health");
  assert.ok(
    ["healthy", "under-defined"].includes(health.status),
    JSON.stringify(health)
  );
  return { arm, pivots: expected, jawClearance: gap };
}

let sourceIdentity;
let volumes;
let savedArm;
const client = new HeadlessMcpClient({ executable, workspace });
try {
  await client.initialize();
  await client.tool("cad.batch", batch(sketchOps));
  const candidates = await client.tool("cad.sketch_profile_region_candidates", {
    sketchId: "s_upper",
    limit: 10
  });
  assert.ok(
    candidates.candidates.some(
      (candidate) => candidate.region.holes.length === 2
    )
  );
  const profile = regionOps.find((op) => op.bodyId === "b_upper").profile;
  const validated = await client.tool("cad.sketch_profile_region_validate", {
    profile
  });
  assert.equal(validated.ok, true);
  // This is the original 38-operation attempt, including actual holes on XZ.
  await client.tool("cad.batch", batch(solidOps));
  await masses(client, 160);
  await client.tool("cad.batch", batch(assemblyOps()));
  const initial = await inspectArm(client, {
    span: 160,
    shoulder: 60,
    opening: 20
  });
  await client.tool("cad.project_save", { path: "robot-arm-initial.wcad" });
  await client.tool("cad.batch", batch(revisionOps, "dryRun"));
  assert.deepEqual(
    (await inspectArm(client, { span: 160, shoulder: 60, opening: 20 })).arm,
    initial.arm
  );
  await client.tool("cad.batch", batch(revisionOps));
  const revised = await inspectArm(client);
  assert.deepEqual(
    revised.arm.instances.map((instance) => instance.id),
    initial.arm.instances.map((instance) => instance.id)
  );
  report.revisions.push({
    operations: revisionOps,
    pivots: revised.pivots,
    jawClearance: revised.jawClearance
  });
  volumes = await masses(client, 180);
  const shoulderMate = revised.arm.mates.find(
    (mate) => mate.id === "joint_shoulder"
  );
  const failed = await client.tool(
    "cad.batch",
    batch([
      {
        op: "assembly.mate.edit",
        assemblyId: "arm",
        mateId: "joint_shoulder",
        kind: "revolute",
        primary: shoulderMate.primary,
        secondary: {
          instanceId: "i_upper",
          frame: { kind: "sketch", sketchId: "s_upper", entityId: "missing" }
        },
        angleDegrees: 90
      },
      { op: "parameter.update", id: "upper_span", value: 220 }
    ]),
    { expectError: true }
  );
  assert.deepEqual(
    (await inspectArm(client)).arm,
    revised.arm,
    "invalid reference rolls back whole batch"
  );
  assert.equal(
    failed.error.opIndex,
    0,
    "attribute failure to the edited joint"
  );
  assert.equal(failed.error.op, "assembly.mate.edit");
  report.invalidReference = failed;
  // Move the one grounded root, preserving every attached part without reinsert.
  await client.tool(
    "cad.batch",
    batch([
      {
        op: "assembly.instance.updateTransform",
        assemblyId: "arm",
        instanceId: "i_base",
        transform: { translation: [12, -8, 3] }
      }
    ])
  );
  const moved = await inspectArm(client, { root: [12, -8, 3] });
  for (const original of revised.arm.instances) {
    const current = moved.arm.instances.find(
      (instance) => instance.id === original.id
    );
    nearPoint(
      current.transform.translation,
      original.transform.translation.map((v, i) => v + [12, -8, 3][i]),
      `root propagation ${original.id}`
    );
  }
  await client.tool(
    "cad.batch",
    batch([
      {
        op: "assembly.instance.updateTransform",
        assemblyId: "arm",
        instanceId: "i_base",
        transform: { translation: [0, 0, 0] }
      }
    ])
  );
  savedArm = (await inspectArm(client)).arm;
  const saved = await client.tool("cad.project_save", {
    path: "robot-arm.wcad"
  });
  sourceIdentity = saved.result.sourceIdentity;
  await client.tool("cad.project_export_file", {
    path: "robot-arm-definitions.step",
    format: "step",
    bodyIds: parts.map((part) => `b_${part.id}`)
  });
} finally {
  report.calls.push(...client.calls);
  await client.close();
}

const reopened = new HeadlessMcpClient({ executable, workspace });
try {
  await reopened.initialize();
  const opened = await reopened.tool("cad.project_open", {
    path: "robot-arm.wcad"
  });
  assert.deepEqual(opened.result.sourceIdentity, sourceIdentity);
  assert.deepEqual((await inspectArm(reopened)).arm, savedArm);
  await masses(reopened, 180);
  // A fresh process can still revise the geometry-linked arm and bound jaws.
  await reopened.tool(
    "cad.batch",
    batch([
      { op: "parameter.update", id: "upper_span", value: 200 },
      { op: "parameter.update", id: "gripper_opening", value: 25 }
    ])
  );
  await inspectArm(reopened, { span: 200, opening: 25 });
} finally {
  report.calls.push(...reopened.calls);
  await reopened.close();
}

// Independently exercise the original explicit-region alternative on XZ too.
const regions = new HeadlessMcpClient({ executable, workspace });
try {
  await regions.initialize();
  await regions.tool("cad.batch", batch(sketchOps));
  await regions.tool("cad.batch", batch(regionOps));
  await masses(regions, 160);
} finally {
  report.calls.push(...regions.calls);
  await regions.close();
}

const { executeGeometryKernelRequest } =
  await import("../packages/geometry-kernel/src/index.ts");
const step = await executeGeometryKernelRequest({
  id: "arm-step",
  version: "geometry-kernel.v1",
  op: "geometry.importStep",
  sourceFileName: "robot-arm-definitions.step",
  bytes: new Uint8Array(
    await readFile(resolve(workspace, "robot-arm-definitions.step"))
  ),
  maxBodyCount: 11
});
assert.equal(step.ok, true, JSON.stringify(step.error));
assert.equal(
  step.bodies.reduce((count, body) => count + body.solidCount, 0),
  11
);
let exportedVolume = 0;
for (const [index, body] of step.bodies.entries()) {
  const mass = await executeGeometryKernelRequest({
    id: `arm-step-mass-${index}`,
    version: "geometry-kernel.v1",
    op: "geometry.exactBodyMetadata",
    source: {
      kind: "importedBody",
      brepBytes: body.checkpointPayload.brepBytes
    }
  });
  assert.equal(mass.ok, true, JSON.stringify(mass.error));
  exportedVolume += mass.metadata.volume;
}
near(
  exportedVolume,
  volumes.reduce((sum, value) => sum + value, 0),
  "STEP readback volume"
);
report.step = { solidCount: 11, volume: exportedVolume };
report.sourceIdentity = sourceIdentity;
report.passed = true;
await writeFile(
  resolve(workspace, "verification.json"),
  JSON.stringify(report, null, 2) + "\n"
);
for (const name of [
  "robot-arm.wcad",
  "robot-arm-initial.wcad",
  "robot-arm-definitions.step",
  "verification.json"
])
  await copyFile(resolve(workspace, name), resolve(output, name));
console.log(
  `Robot arm: intended-plane solids/regions, 29 connected instances, three-op revision, root move, atomic failure, fresh reopen and STEP readback passed. ${workspace}`
);

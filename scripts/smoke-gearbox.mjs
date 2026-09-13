import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { register } from "node:module";
import { resolve } from "node:path";
import { HeadlessMcpClient } from "./agent-runtime/mcp-client.mjs";
import {
  buildOps,
  revisionOps,
  partIds
} from "../examples/gearbox-workflow/model.mjs";
register(new URL("./ts-source-loader.mjs", import.meta.url), import.meta.url);
const output = resolve(".metrics/gearbox-workflow");
const workspace = resolve(
  output,
  new Date().toISOString().replaceAll(":", "-")
);
await mkdir(workspace, { recursive: true });
const executable = resolve("packages/mcp-stdio-server/dist/stdio.js");
const report = {
  workspace,
  buildOperations: buildOps.length,
  revisionOperations: revisionOps.length,
  calls: [],
  motion: [],
  artifacts: []
};
const batch = (ops, mode = "commit") => ({
  allowCommit: true,
  responseDetail: "summary",
  batch: { version: "cadops.v1", mode, ops }
});
const near = (a, b, label) =>
  assert.ok(
    Number.isFinite(a) && Math.abs(a - b) < Math.max(1e-6, Math.abs(b) * 1e-8),
    `${label}: ${a} != ${b}`
  );
const poseArgs = { projection: "poses", assemblyIds: ["gearbox"], limit: 100 };
async function poses(c, teeth, angle) {
  const r = await c.tool("cad.project_structure", poseArgs);
  assert.equal(r.instancePoses.length, 15);
  assert.equal(r.nextOffset, undefined);
  assert.equal(r.features.length, 0);
  const byId = new Map(r.instancePoses.map((i) => [i.id, i]));
  const out = 180 / teeth - (angle * 20) / teeth,
    center = (1.5 * (20 + teeth)) / 2;
  for (const [side, degrees, x] of [
    ["input", angle, 0],
    ["output", out, center]
  ])
    for (const suffix of ["shaft", "gear", "spacer_low", "spacer_high"]) {
      const t = byId.get(`${side}_${suffix}`).transform;
      near(t.translation[0], x, "shaft axis");
      near(t.translation[1], 0, "shaft axis Y");
      near(
        Math.sin(t.rotation[2]),
        Math.sin((degrees * Math.PI) / 180),
        "driven rotation sin"
      );
      near(
        Math.cos(t.rotation[2]),
        Math.cos((degrees * Math.PI) / 180),
        "driven rotation cos"
      );
    }
  near(byId.get("output_gear").transform.translation[2], 19, "gear face Z");
  near(
    byId.get("standoff_1").transform.translation[0],
    center + 55,
    "standoff follows spacing"
  );
  near(
    byId.get("bolt_1").transform.translation[0],
    center + 55,
    "bolt follows standoff"
  );
  return r.instancePoses;
}
async function motion(c, teeth) {
  const before = (await c.tool("cad.session_info")).result.geometry
    .artifactBuilds;
  const samples = [];
  for (const angle of [0, 45, 90, 180, 270, 360]) {
    const start = performance.now();
    await c.tool(
      "cad.batch",
      batch([{ op: "parameter.update", id: "input_angle", value: angle }])
    );
    const milliseconds = performance.now() - start;
    await poses(c, teeth, angle);
    samples.push({ angle, milliseconds });
  }
  await c.tool(
    "cad.batch",
    batch([{ op: "parameter.update", id: "input_angle", value: 0 }])
  );
  const after = (await c.tool("cad.session_info")).result.geometry
    .artifactBuilds;
  assert.equal(after, before, "Pure motion must not rebuild exact bodies");
  report.motion.push({
    teeth,
    samples,
    exactBuildsBefore: before,
    exactBuildsAfter: after
  });
}
async function masses(c) {
  const values = {};
  for (const bodyId of partIds) {
    const r = await c.tool("cad.body_mass_properties", { bodyId });
    assert.equal(r.massProperties.measurementSource, "kernel-derived");
    values[bodyId] = r.massProperties.volume;
  }
  return values;
}
const client = new HeadlessMcpClient({ executable, workspace });
try {
  await client.initialize();
  const schema = await client.tool("cad.operation_schema", {
    operation: "feature.spurGear"
  });
  assert.ok(JSON.stringify(schema).includes("profileTolerance"));
  const start = performance.now();
  await client.tool("cad.batch", batch(buildOps));
  report.initialBuildMs = performance.now() - start;
  report.buildResponseBytes = client.calls.at(-1).responseBytes;
  console.log("Built parametric gearbox");
  await poses(client, 40, 0);
  await motion(client, 40);
  report.initialMasses = await masses(client);
  const initial = await client.tool("cad.project_save", {
    path: "gearbox-2to1.wcad"
  });
  report.initialIdentity = initial.result.sourceIdentity;
  const reviseStart = performance.now();
  await client.tool("cad.batch", batch(revisionOps));
  report.revisionMs = performance.now() - reviseStart;
  report.revisionResponseBytes = client.calls.at(-1).responseBytes;
  assert.ok(
    report.revisionResponseBytes < 15_000,
    "Tooth revision summary response under 15KB"
  );
  console.log("One-op ratio revision");
  await poses(client, 60, 0);
  await motion(client, 60);
  report.finalMasses = await masses(client);
  const beforeInvalid = (await client.tool("cad.session_info")).result
    .sourceIdentity;
  for (const mode of ["dryRun", "commit"]) {
    const error = await client.tool(
      "cad.batch",
      batch(
        [{ op: "parameter.update", id: "output_teeth", value: 20.5 }],
        mode
      ),
      { expectError: true }
    );
    assert.equal(error.ok, false);
    assert.deepEqual(
      (await client.tool("cad.session_info")).result.sourceIdentity,
      beforeInvalid
    );
  }
  const invalidShape = await client.tool(
    "cad.batch",
    batch([
      {
        op: "feature.updateSpurGear",
        id: "wheel_extrude",
        profileTolerance: "invalid"
      }
    ]),
    { expectError: true }
  );
  assert.ok(JSON.stringify(invalidShape).includes("profileTolerance"));
  assert.deepEqual(
    (await client.tool("cad.session_info")).result.sourceIdentity,
    beforeInvalid
  );
  report.health = await client.tool("cad.project_health");
  assert.equal(
    report.health.status,
    "healthy",
    JSON.stringify(report.health).slice(-3000)
  );
  assert.equal(report.health.issueCount, 0);
  const raw = await client.request("tools/call", {
    name: "cad.project_structure",
    arguments: {
      projection: "poses",
      assemblyIds: ["gearbox"],
      instanceIds: ["input_shaft", "output_shaft"],
      limit: 2
    }
  });
  report.poseResponseBytes = Buffer.byteLength(JSON.stringify(raw));
  assert.ok(
    report.poseResponseBytes < 3000,
    "two shaft pose response under3KB"
  );
  const save = await client.tool("cad.project_save", {
    path: "gearbox-3to1.wcad"
  });
  report.finalIdentity = save.result.sourceIdentity;
  report.finalPoses = await poses(client, 60, 0);
  await client.tool("cad.project_export_file", {
    path: "gearbox-definitions.step",
    format: "step",
    bodyIds: partIds
  });
} finally {
  report.calls.push(...client.calls);
  await client.close();
}
const reopened = new HeadlessMcpClient({ executable, workspace });
try {
  await reopened.initialize();
  const opened = await reopened.tool("cad.project_open", {
    path: "gearbox-3to1.wcad"
  });
  assert.deepEqual(opened.result.sourceIdentity, report.finalIdentity);
  assert.deepEqual(await poses(reopened, 60, 0), report.finalPoses);
  const reopenedMass = await masses(reopened);
  for (const id of partIds)
    near(reopenedMass[id], report.finalMasses[id], `reopened ${id}`);
  await reopened.tool(
    "cad.batch",
    batch([{ op: "parameter.update", id: "output_teeth", value: 40 }])
  );
  await poses(reopened, 40, 0);
  await reopened.tool(
    "cad.batch",
    batch([{ op: "parameter.update", id: "input_angle", value: 90 }])
  );
  await poses(reopened, 40, 90);
} finally {
  report.calls.push(...reopened.calls);
  await reopened.close();
}
const { importCadProjectWcad } =
  await import("../packages/cad-core/src/index.ts");
const first = (
  await importCadProjectWcad(
    await readFile(resolve(workspace, "gearbox-2to1.wcad"))
  )
).getDocument();
const final = (
  await importCadProjectWcad(
    await readFile(resolve(workspace, "gearbox-3to1.wcad"))
  )
).getDocument();
assert.deepEqual(
  first.sketches.get("pinion_outline"),
  final.sketches.get("pinion_outline"),
  "input gear source retained"
);
report.gearProfiles = [];
for (const [doc, id, n, mass] of [
  [first, "pinion", 20, report.initialMasses.pinion],
  [first, "wheel", 40, report.initialMasses.wheel],
  [final, "wheel", 60, report.finalMasses.wheel]
]) {
  const sk = doc.sketches.get(`${id}_outline`);
  const entities = [...sk.entities.values()];
  const tip = 1.5 * (n / 2 + 1);
  const tips = entities.filter(
    (e) =>
      e.kind === "arc" &&
      Math.hypot(...e.center) < 1e-9 &&
      Math.abs(e.radius - tip) < 1e-8
  );
  assert.equal(tips.length, n);
  let area = 0;
  for (const e of entities) {
    if (e.kind === "circle") area -= Math.PI * e.radius ** 2;
    else if (e.kind === "line")
      area += (e.start[0] * e.end[1] - e.end[0] * e.start[1]) / 2;
    else if (e.kind === "arc") {
      const a = (e.startAngleDegrees * Math.PI) / 180,
        d = (e.sweepAngleDegrees * Math.PI) / 180,
        b = a + d;
      area +=
        (e.radius * e.center[0] * (Math.sin(b) - Math.sin(a)) -
          e.radius * e.center[1] * (Math.cos(b) - Math.cos(a)) +
          e.radius ** 2 * d) /
        2;
    }
  }
  near(mass, area * 10, "independent gear area integral");
  report.gearProfiles.push({
    teeth: n,
    entityCount: entities.length,
    expectedVolume: area * 10,
    exactVolume: mass,
    profileTolerance: sk.spurGear.values.profileTolerance
  });
}
const { executeGeometryKernelRequest } =
  await import("../packages/geometry-kernel/src/index.ts");
const step = await executeGeometryKernelRequest({
  id: "gearbox-step",
  version: "geometry-kernel.v1",
  op: "geometry.importStep",
  sourceFileName: "gearbox-definitions.step",
  bytes: new Uint8Array(
    await readFile(resolve(workspace, "gearbox-definitions.step"))
  ),
  maxBodyCount: 8
});
assert.equal(step.ok, true, JSON.stringify(step.error));
assert.equal(
  step.bodies.reduce((n, b) => n + b.solidCount, 0),
  8
);
let volume = 0;
for (const [i, body] of step.bodies.entries()) {
  const mass = await executeGeometryKernelRequest({
    id: `step-mass-${i}`,
    version: "geometry-kernel.v1",
    op: "geometry.exactBodyMetadata",
    source: {
      kind: "importedBody",
      brepBytes: body.checkpointPayload.brepBytes
    }
  });
  assert.equal(mass.ok, true, JSON.stringify(mass.error));
  volume += mass.metadata.volume;
}
near(
  volume,
  Object.values(report.finalMasses).reduce((a, b) => a + b, 0),
  "STEP readback total volume"
);
report.step = { solids: 8, volume };
report.passed = true;
for (const name of [
  "gearbox-2to1.wcad",
  "gearbox-3to1.wcad",
  "gearbox-definitions.step"
]) {
  const bytes = (await readFile(resolve(workspace, name))).byteLength;
  if (name.endsWith(".wcad"))
    assert.ok(bytes < 3_000_000, "Native gearbox under 3MB");
  report.artifacts.push({ name, bytes });
  await copyFile(resolve(workspace, name), resolve(output, name));
}
await writeFile(
  resolve(output, "verification.json"),
  JSON.stringify(report, null, 2) + "\n"
);
console.log(
  `Gearbox workflow passed: one-op revision, zero motion rebuilds, compact poses, clean health, native reopen and STEP readback. ${workspace}`
);

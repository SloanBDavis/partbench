import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { performance } from "node:perf_hooks";
import { URL } from "node:url";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { HeadlessMcpClient } from "../../scripts/agent-runtime/mcp-client.mjs";
const workspace = resolve(process.argv[2] ?? ".metrics/gearbox-trial/replay");
// Refuse to mix new measurements with an earlier replay.
await mkdir(dirname(workspace), { recursive: true });
await mkdir(workspace, { recursive: false });
const stages = JSON.parse(
  await readFile(new URL("./authoring-stages.json", import.meta.url))
);
const executable = resolve("packages/mcp-stdio-server/dist/stdio.js");
const ids = [
  "pinion",
  "wheel",
  "base",
  "bridge",
  "shaft",
  "spacer",
  "standoff",
  "bolt_finished"
];
const report = {
  source:
    "Exact successful requests extracted from the independent designer trial",
  workspace,
  revisions: []
};
async function session(fn) {
  const c = new HeadlessMcpClient({ executable, workspace });
  const request = c.request.bind(c);
  c.request = async (method, params = {}) => {
    const start = performance.now();
    let result;
    try {
      result = await request(method, params);
      return result;
    } finally {
      await appendFile(
        resolve(workspace, "transcript.jsonl"),
        JSON.stringify({
          method,
          params,
          result,
          milliseconds: performance.now() - start
        }) + "\n"
      );
    }
  };
  try {
    await c.initialize();
    await fn(c);
  } finally {
    await c.close();
  }
}
const batch = (ops) => ({
  allowCommit: true,
  batch: { version: "cadops.v1", mode: "commit", ops }
});
async function inspect(c, ratio) {
  const s = await c.tool("cad.project_structure");
  const a = s.assemblies[0];
  assert.equal(a.instances.length, 15);
  assert.equal(s.bodies.filter((b) => !b.consumedByFeatureId).length, 8);
  assert.ok(
    Math.abs(
      a.mates.find((m) => m.id === "output_rotation").angleDegrees -
        180 / (20 * ratio)
    ) < 1e-8
  );
  const masses = {};
  for (const bodyId of ids)
    masses[bodyId] = (
      await c.tool("cad.body_mass_properties", { bodyId })
    ).massProperties.volume;
  return {
    ratio,
    assemblies: s.assemblies,
    sourceIdentity: (await c.tool("cad.session_info")).result.sourceIdentity,
    masses
  };
}
await session(async (c) => {
  for (const stage of stages.slice(0, 7)) {
    console.log(stage.name);
    await c.tool(stage.request.name, stage.request.arguments);
  }
  report.revisions.push(await inspect(c, 2));
  await c.tool("cad.project_save", { path: "gearbox-2to1.wcad" });
  await c.tool("cad.project_export_file", {
    path: "wheel-40t.step",
    format: "step",
    bodyIds: ["wheel"]
  });
  for (const stage of stages.slice(7)) {
    console.log(stage.name);
    await c.tool(stage.request.name, stage.request.arguments);
  }
  report.revisions.push(await inspect(c, 3));
  await c.tool("cad.project_save", { path: "gearbox-3to1.wcad" });
  for (const bodyId of ids)
    await c.tool("cad.project_export_file", {
      path: `${bodyId}-3to1.step`,
      format: "step",
      bodyIds: [bodyId]
    });
});
await session(async (c) => {
  for (const expected of report.revisions) {
    await c.tool("cad.project_open", {
      path: `gearbox-${expected.ratio}to1.wcad`
    });
    const actual = await inspect(c, expected.ratio);
    assert.deepEqual(actual.sourceIdentity, expected.sourceIdentity);
    assert.deepEqual(actual.assemblies, expected.assemblies);
    for (const id of ids)
      assert.ok(Math.abs(actual.masses[id] - expected.masses[id]) < 1e-6);
    await c.tool(
      "cad.batch",
      batch([{ op: "parameter.update", id: "input_angle", value: 90 }])
    );
    const a = (await c.tool("cad.project_structure")).assemblies[0];
    const angle = 180 / (20 * expected.ratio) - 90 / expected.ratio;
    assert.ok(
      Math.abs(
        a.mates.find((m) => m.id === "output_rotation").angleDegrees - angle
      ) < 1e-8
    );
  }
});
report.passed = true;
await writeFile(
  resolve(workspace, "replay-verification.json"),
  JSON.stringify(report, null, 2) + "\n"
);
console.log(`Gearbox replay passed: ${workspace}`);

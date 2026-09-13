// Replay the independent designer's unchanged requests through the public stdio API.
import assert from "node:assert/strict";
import console from "node:console";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { HeadlessMcpClient } from "../../../scripts/agent-runtime/mcp-client.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const workspace = resolve(
  root,
  ".metrics/gearbox-workflow/independent-replay",
  new Date().toISOString().replaceAll(":", "-")
);
await mkdir(workspace, { recursive: true });
const executable = resolve(root, "packages/mcp-stdio-server/dist/stdio.js");
const creation = JSON.parse(
  await readFile(new URL("./creation-ops.json", import.meta.url), "utf8")
);
const batch = (ops) => ({
  allowCommit: true,
  batch: { version: "cadops.v1", mode: "commit", ops }
});
const report = { workspace, calls: [], stages: [] };
let finalIdentity, initialInputMass, finalPoses;
async function run(stage, action) {
  const client = new HeadlessMcpClient({ executable, workspace });
  try {
    await client.initialize();
    await action(client);
    report.stages.push({ stage, passed: true });
  } finally {
    report.calls.push(...client.calls);
    await client.close();
  }
}
await run("create original 20/40", async (client) => {
  await client.tool("cad.batch", batch(creation));
  initialInputMass = await client.tool("cad.body_mass_properties", {
    bodyId: "input_gear"
  });
  await client.tool("cad.project_save", { path: "original.wcad" });
});
await run(
  "fresh open, one-op 20/60 revision, immediate save",
  async (client) => {
    await client.tool("cad.project_open", { path: "original.wcad" });
    await client.tool(
      "cad.batch",
      batch([{ op: "parameter.update", id: "output_teeth", value: 60 }])
    );
    report.revisionResponseBytes = client.calls.at(-1).responseBytes;
    assert.ok(report.revisionResponseBytes < 3_000_000);
    const saved = await client.tool("cad.project_save", {
      path: "revised.wcad"
    });
    finalIdentity = saved.result.sourceIdentity;
    finalPoses = (
      await client.tool("cad.project_structure", {
        projection: "poses"
      })
    ).instancePoses;
  }
);
await run(
  "fresh reopen of revision, preserved shape and motion",
  async (client) => {
    const opened = await client.tool("cad.project_open", {
      path: "revised.wcad"
    });
    assert.deepEqual(opened.result.sourceIdentity, finalIdentity);
    assert.deepEqual(
      (await client.tool("cad.project_structure", { projection: "poses" }))
        .instancePoses,
      finalPoses
    );
    const input = await client.tool("cad.body_mass_properties", {
      bodyId: "input_gear"
    });
    assert.equal(
      input.massProperties.volume,
      initialInputMass.massProperties.volume
    );
    await client.tool(
      "cad.batch",
      batch([{ op: "parameter.update", id: "input_angle", value: 120 }])
    );
    const angle = await client.tool("cad.parameter_get", {
      id: "output_angle"
    });
    assert.equal(angle.parameter.value, -37);
  }
);
report.artifacts = [];
for (const name of ["original.wcad", "revised.wcad"]) {
  const bytes = (await readFile(resolve(workspace, name))).byteLength;
  assert.ok(bytes < 3_000_000);
  report.artifacts.push({ name, bytes });
}
report.passed = true;
const output = resolve(
  root,
  ".metrics/gearbox-workflow/independent-replay.json"
);
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(`Independent requests replay passed: ${output}`);

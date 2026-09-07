import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { register } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HeadlessMcpClient } from "./agent-runtime/mcp-client.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, ".metrics/agent-runtime");
const executable = resolve(root, "packages/mcp-stdio-server/dist/stdio.js");
register(new URL("./ts-source-loader.mjs", import.meta.url), import.meta.url);

await mkdir(output, { recursive: true });
const report = {
  timestamp: new Date().toISOString(),
  node: process.version,
  journeys: []
};
const selected = process.argv.slice(2);
const ids = selected.length ? selected : ["mounting-plate", "enclosure"];
assert.ok(
  ids.every((id) => ["mounting-plate", "enclosure"].includes(id)),
  "Unknown journey"
);
try {
  for (const id of ids) {
    const fixture = JSON.parse(
      await readFile(resolve(root, `examples/agent-runtime/${id}.json`), "utf8")
    );
    const record = await journey(fixture);
    report.journeys.push(record);
    console.log(
      `${id}: create, exact inspect, atomic failure, dry run, revise, WCAD reopen, STEP readback passed`
    );
  }
  await writeFile(
    resolve(output, "verification.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
}

function near(actual, expected, label) {
  assert.ok(Number.isFinite(actual), `${label} must be finite`);
  assert.ok(
    Math.abs(actual - expected) <= Math.max(1e-5, Math.abs(expected) * 1e-7),
    `${label}: ${actual} != ${expected}`
  );
}

async function inspect(client, fixture, expected) {
  const volumes = [];
  for (const [i, bodyId] of fixture.bodyIds.entries()) {
    const measured = await client.tool("cad.body_mass_properties", { bodyId });
    assert.equal(measured.massProperties.measurementSource, "kernel-derived");
    near(measured.massProperties.volume, expected[i], `${bodyId} volume`);
    assert.ok(measured.massProperties.surfaceArea > 0);
    volumes.push(measured.massProperties.volume);
  }
  const health = await client.tool("cad.project_health");
  assert.ok(
    ["healthy", "under-defined"].includes(health.status),
    `Project must have no blocking health issues: ${JSON.stringify(health)}`
  );
  return volumes;
}

function batch(ops, mode = "commit") {
  return { batch: { version: "cadops.v1", mode, ops }, allowCommit: true };
}

async function journey(fixture) {
  const workspace = resolve(output, fixture.id);
  await mkdir(workspace, { recursive: true });
  const client = new HeadlessMcpClient({ executable, workspace });
  let sourceIdentity;
  let volumesBefore;
  let volumesAfter;
  let rejected;
  try {
    await client.initialize();
    const listed = await client.request("tools/list");
    for (const name of [
      "cad.batch",
      "cad.body_mass_properties",
      "cad.session_info",
      "cad.project_open",
      "cad.project_save",
      "cad.project_export_file"
    ]) {
      assert.ok(
        listed.tools.some((tool) => tool.name === name),
        `${name} is discoverable`
      );
    }
    const initial = await client.tool("cad.session_info");
    assert.equal(initial.result.mode, "headless");
    assert.equal(
      initial.result.geometry.artifactBuilds,
      0,
      "Discovery must not build geometry"
    );
    await client.tool("cad.batch", batch(fixture.create));
    volumesBefore = await inspect(
      client,
      fixture,
      fixture.expected.volumesBefore
    );
    const before = (await client.tool("cad.session_info")).result
      .sourceIdentity;
    rejected = await client.tool("cad.batch", batch(fixture.invalid), {
      expectError: true
    });
    const rejection = rejected.error ?? rejected.response?.error;
    assert.equal(rejection?.code, fixture.expected.rejection.code);
    assert.ok(
      rejection.message.includes(fixture.expected.rejection.messageIncludes),
      `Expected ${fixture.expected.rejection.messageIncludes}: ${rejection.message}`
    );
    assert.deepEqual(
      (await client.tool("cad.session_info")).result.sourceIdentity,
      before,
      "Rejected edit preserves source"
    );
    await client.tool("cad.batch", batch(fixture.revise, "dryRun"));
    assert.deepEqual(
      (await client.tool("cad.session_info")).result.sourceIdentity,
      before,
      "Dry run preserves source"
    );
    await client.tool("cad.batch", batch(fixture.revise));
    volumesAfter = await inspect(
      client,
      fixture,
      fixture.expected.volumesAfter
    );
    const final = (await client.tool("cad.session_info")).result;
    sourceIdentity = final.sourceIdentity;
    assert.notDeepEqual(sourceIdentity, before, "Revision changes source");
    await client.tool("cad.project_save", {
      path: `${fixture.id}.wcad`,
      overwrite: true
    });
    const step = await client.tool("cad.project_export_file", {
      path: `${fixture.id}.step`,
      format: "step",
      bodyIds: fixture.bodyIds,
      overwrite: true
    });
    assert.ok(step.result.byteLength > 1_000);
  } finally {
    await client.close();
  }

  const reopened = new HeadlessMcpClient({ executable, workspace });
  try {
    await reopened.initialize();
    await reopened.tool("cad.project_open", { path: `${fixture.id}.wcad` });
    assert.deepEqual(
      (await reopened.tool("cad.session_info")).result.sourceIdentity,
      sourceIdentity
    );
    await inspect(reopened, fixture, fixture.expected.volumesAfter);
    if (fixture.expected.assemblyId) {
      const structure = await reopened.tool("cad.project_structure");
      const assembly = structure.assemblies.find(
        (item) => item.id === fixture.expected.assemblyId
      );
      assert.ok(assembly);
      assert.deepEqual(
        assembly.instances.find(
          (item) => item.id === fixture.expected.movedInstanceId
        ).transform.translation,
        fixture.expected.translationAfter
      );
    }
  } finally {
    await reopened.close();
  }

  // Both hosts read the same native format; validate the file outside the session too.
  const { readCadProjectWcad, createCadProjectSourceIdentity } =
    await import("../packages/cad-core/src/index.ts");
  const native = await readCadProjectWcad(
    new Uint8Array(await readFile(resolve(workspace, `${fixture.id}.wcad`)))
  );
  assert.equal(native.ok, true, JSON.stringify(native.issues));
  assert.deepEqual(
    createCadProjectSourceIdentity(native.project),
    sourceIdentity
  );
  const { executeGeometryKernelRequest } =
    await import("../packages/geometry-kernel/src/index.ts");
  const step = await executeGeometryKernelRequest({
    id: `readback-${fixture.id}`,
    version: "geometry-kernel.v1",
    op: "geometry.importStep",
    sourceFileName: `${fixture.id}.step`,
    bytes: new Uint8Array(
      await readFile(resolve(workspace, `${fixture.id}.step`))
    ),
    maxBodyCount: fixture.bodyIds.length
  });
  assert.equal(step.ok, true, JSON.stringify(step.error));
  // The STEP reader may return a single compound containing several definitions.
  assert.equal(
    step.bodies.reduce((count, body) => count + body.solidCount, 0),
    fixture.bodyIds.length
  );
  let exportedVolume = 0;
  for (const [i, body] of step.bodies.entries()) {
    const metadata = await executeGeometryKernelRequest({
      id: `readback-mass-${fixture.id}-${i}`,
      version: "geometry-kernel.v1",
      op: "geometry.exactBodyMetadata",
      source: {
        kind: "importedBody",
        brepBytes: body.checkpointPayload.brepBytes
      }
    });
    assert.equal(metadata.ok, true, JSON.stringify(metadata.error));
    exportedVolume += metadata.metadata.volume;
  }
  near(
    exportedVolume,
    fixture.expected.volumesAfter.reduce((sum, volume) => sum + volume, 0),
    "STEP readback volume"
  );
  return {
    id: fixture.id,
    sourceIdentity,
    volumesBefore,
    volumesAfter,
    rejected: rejected.error ?? rejected.response?.error,
    startupMs: client.startupMs,
    reopenStartupMs: reopened.startupMs,
    calls: [...client.calls, ...reopened.calls],
    nativePath: `${fixture.id}/${fixture.id}.wcad`,
    stepPath: `${fixture.id}/${fixture.id}.step`
  };
}

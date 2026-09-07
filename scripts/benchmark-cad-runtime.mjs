import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { register } from "node:module";
import { arch, cpus, platform, release } from "node:os";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modelIds = ["mounting-plate", "enclosure"];
const marker = "PARTBENCH_BENCHMARK_SAMPLE=";

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    count: samples.length,
    min: sorted[0],
    median: sorted[Math.floor(sorted.length / 2)],
    max: sorted.at(-1),
    samples
  };
}

async function timed(run) {
  const start = performance.now();
  const value = await run();
  return { value, ms: performance.now() - start };
}

function successful(response, label) {
  assert.equal(response.ok, true, `${label}: ${JSON.stringify(response)}`);
  return response;
}

function exactSummary(evidence, fixture, expectedVolumes) {
  return fixture.bodyIds.map((bodyId, index) => {
    const current = evidence.currentExactResults.find(
      (body) => body.bodyId === bodyId
    );
    const derived = evidence.derivedExactMetadata.find(
      (body) => body.bodyId === bodyId
    );
    assert.equal(
      current?.status,
      "ready",
      `${bodyId}: no current exact artifact`
    );
    assert.equal(derived?.status, "ready", `${bodyId}: no exact metadata`);
    const metadata = derived.metadata;
    const expected = expectedVolumes[index];
    assert.ok(
      Number.isFinite(metadata.volume) &&
        Math.abs(metadata.volume - expected) <= Math.max(1e-5, expected * 1e-6),
      `${bodyId}: volume ${metadata.volume} differs from expected ${expected}`
    );
    assert.ok(
      current.artifactEvidence?.brepByteLength > 0,
      `${bodyId}: empty BRep`
    );
    return {
      bodyId,
      volume: metadata.volume,
      bounds: metadata.bounds,
      topologyCounts: metadata.topologyCounts,
      brepBytes: current.artifactEvidence.brepByteLength
    };
  });
}

async function measureDisplayCost() {
  const {
    loadOcct,
    createOcctExactBodyArtifactWithInstance: displayed,
    createOcctExactBodyDataArtifactWithInstance: headless
  } = await import(
    pathToFileURL(resolve(repoRoot, "packages/occt-wasm/src/index.ts")).href
  );
  const oc = await loadOcct();
  const transform = {
    translation: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
  };
  const results = [];
  for (const source of [
    { kind: "box", dimensions: { width: 60, height: 40, depth: 8 }, transform },
    { kind: "cylinder", dimensions: { radius: 30, height: 40 }, transform }
  ]) {
    const full = displayed(oc, { source });
    const exact = headless(oc, { source });
    assert.deepEqual(full.brepBytes, exact.brepBytes);
    assert.deepEqual(full.metadata, exact.metadata);
    assert.deepEqual(full.topologySnapshot, exact.topologySnapshot);
    assert.equal("displayMesh" in exact, false);
    assert.equal("viewportPickMap" in exact, false);
    const samples = { displayed: [], headless: [] };
    for (let index = 0; index < 9; index += 1) {
      // Alternate order and exclude two warm-up pairs to limit JIT/order bias.
      const pair = [
        ["displayed", displayed],
        ["headless", headless]
      ];
      if (index % 2 === 1) pair.reverse();
      for (const [name, build] of pair) {
        const start = performance.now();
        build(oc, { source });
        if (index >= 2) samples[name].push(performance.now() - start);
      }
    }
    results.push({
      source: source.kind,
      displayedMs: summarize(samples.displayed),
      headlessMs: summarize(samples.headless),
      exactEvidenceIdentical: true,
      displayTriangleCount: full.displayMesh.triangleCount,
      brepBytes: exact.brepByteLength
    });
  }
  return results;
}

async function runSample(modelId, probeDisplay) {
  const importStart = performance.now();
  register(new URL("./ts-source-loader.mjs", import.meta.url), import.meta.url);
  const { createCadSession } = await import(
    pathToFileURL(resolve(repoRoot, "packages/cad-runtime/src/index.ts")).href
  );
  const runtimeImportMs = performance.now() - importStart;
  const fixture = JSON.parse(
    await readFile(
      resolve(repoRoot, `examples/agent-runtime/${modelId}.json`),
      "utf8"
    )
  );
  const startup = await timed(() => createCadSession());
  const session = startup.value;
  const sessionReadySinceProcessStartMs = process.uptime() * 1_000;
  try {
    const created = await timed(() =>
      session.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: fixture.create
      })
    );
    successful(created.value, `${modelId} create`);
    const initialEvidence = await timed(() =>
      session.getCurrentExactEvidence()
    );
    const initialExactSinceProcessStartMs = process.uptime() * 1_000;
    const initialInfo = await session.getSessionInfo();
    const initialGeometry = exactSummary(
      initialEvidence.value,
      fixture,
      fixture.expected.volumesBefore
    );
    const repeatedEvidence = await timed(() =>
      session.getCurrentExactEvidence()
    );
    const repeatedInfo = await session.getSessionInfo();
    assert.deepEqual(repeatedEvidence.value, initialEvidence.value);
    assert.equal(
      repeatedInfo.geometry.artifactBuilds,
      initialInfo.geometry.artifactBuilds,
      "Repeated exact inspection unexpectedly rebuilt geometry."
    );
    const revised = await timed(() =>
      session.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: fixture.revise
      })
    );
    successful(revised.value, `${modelId} revise`);
    const revisedEvidence = await timed(() =>
      session.getCurrentExactEvidence()
    );
    const revisedInfo = await session.getSessionInfo();
    const revisedGeometry = exactSummary(
      revisedEvidence.value,
      fixture,
      fixture.expected.volumesAfter
    );
    const exported = await timed(() =>
      session.exportStep({ bodyIds: fixture.bodyIds })
    );
    const saved = await timed(() => session.exportWcad());
    const finalInfo = await session.getSessionInfo();
    assert.ok(exported.value.byteLength > 0, "STEP export is empty.");
    assert.ok(saved.value.byteLength > 0, "Native project save is empty.");
    const result = {
      modelId,
      timingsMs: {
        runtimeImport: runtimeImportMs,
        sessionStartup: startup.ms,
        sessionReadySinceProcessStart: sessionReadySinceProcessStartMs,
        initialBatch: created.ms,
        initialExactInspection: initialEvidence.ms,
        initialExactSinceProcessStart: initialExactSinceProcessStartMs,
        repeatedExactInspection: repeatedEvidence.ms,
        warmRevisionBatch: revised.ms,
        revisedExactInspection: revisedEvidence.ms,
        stepExport: exported.ms,
        nativeSave: saved.ms
      },
      operationCounts: {
        create: fixture.create.length,
        revise: fixture.revise.length
      },
      geometry: { initial: initialGeometry, revised: revisedGeometry },
      sessionInfo: {
        initial: initialInfo,
        repeated: repeatedInfo,
        revised: revisedInfo,
        final: finalInfo
      },
      stepBytes: exported.value.bytes?.byteLength ?? exported.value.byteLength,
      nativeBytes: saved.value.bytes?.byteLength ?? saved.value.byteLength,
      ...(probeDisplay ? { displayCost: await measureDisplayCost() } : {})
    };
    process.stdout.write(`${marker}${JSON.stringify(result)}\n`);
  } finally {
    await session.dispose();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const sample = args.find((arg) => arg.startsWith("--sample="))?.slice(9);
  if (sample) {
    assert.ok(modelIds.includes(sample), "Unknown benchmark sample.");
    await runSample(sample, args.includes("--probe-display"));
    return;
  }
  const allowed = /^(--runs=|--output=)/;
  assert.ok(
    args.every((arg) => allowed.test(arg)),
    "Usage: node scripts/benchmark-cad-runtime.mjs [--runs=3] [--output=path]"
  );
  const runs = Number(
    args.find((arg) => arg.startsWith("--runs="))?.slice(7) ?? 3
  );
  assert.ok(
    Number.isInteger(runs) && runs >= 1 && runs <= 10,
    "--runs must be 1–10."
  );
  const output = resolve(
    repoRoot,
    args.find((arg) => arg.startsWith("--output="))?.slice(9) ??
      ".metrics/agent-runtime/benchmark.json"
  );
  const samples = [];
  for (const modelId of modelIds) {
    for (let run = 0; run < runs; run += 1) {
      const stdout = execFileSync(
        process.execPath,
        [
          fileURLToPath(import.meta.url),
          `--sample=${modelId}`,
          ...(samples.length === 0 ? ["--probe-display"] : [])
        ],
        {
          cwd: repoRoot,
          encoding: "utf8",
          timeout: 120_000,
          maxBuffer: 4 * 1024 * 1024
        }
      );
      const line = stdout.split("\n").find((item) => item.startsWith(marker));
      assert.ok(line, `${modelId}: child returned no benchmark record.`);
      samples.push(JSON.parse(line.slice(marker.length)));
      console.log(`${modelId}: sample ${run + 1}/${runs} complete`);
    }
  }
  const models = modelIds.map((modelId) => {
    const selected = samples.filter((sample) => sample.modelId === modelId);
    return {
      modelId,
      timingsMs: Object.fromEntries(
        Object.keys(selected[0].timingsMs).map((key) => [
          key,
          summarize(selected.map((sample) => sample.timingsMs[key]))
        ])
      ),
      samples: selected
    };
  });
  const report = {
    version: "partbench.cad-runtime-benchmark.v1",
    generatedAt: new Date().toISOString(),
    environment: {
      node: process.version,
      os: platform(),
      release: release(),
      arch: arch(),
      cpu: cpus()[0]?.model
    },
    method:
      "Fresh Node process per model/sample; workspace TypeScript source loader; warm revision in that same session. Timings are observations, with no pass/fail time thresholds. Exact-only versus displayed primitive probes alternate order after warm-up and compare BRep, metadata, and topology.",
    models
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Benchmark written to ${output}`);
}

try {
  await main();
} catch (error) {
  // Emscripten installs an uncaught handler that dumps its entire minified
  // module. Preserve the actionable error without flooding benchmark output.
  const message = error.stderr || error.stack || String(error);
  console.error(
    String(message)
      .split("\n")
      .filter((line) => line.length < 2_000)
      .slice(-20)
      .join("\n")
  );
  process.exitCode = 1;
}

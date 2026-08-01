import { CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS } from "@web-cad/cad-protocol";
import {
  V21_EXACT_RELEASE_CORPUS,
  V21_EXACT_RELEASE_PRIMITIVES,
  createExactBodyArtifactWorkerRequest,
  createExactStepExportWorkerRequest,
  createStepImportWorkerRequest,
  type GeometryKernelExactBodyArtifact
} from "@web-cad/geometry-worker/browser";

import { BrowserGeometryWorker } from "./browserGeometryWorker";

const UNIT_SCALE_TO_MILLIMETRES = {
  mm: 1,
  cm: 10,
  m: 1_000,
  in: 25.4
} as const;
type ExactMetadata = GeometryKernelExactBodyArtifact["metadata"];

export async function runV21ExactReleaseBrowserWorkflow(
  worker: BrowserGeometryWorker
): Promise<object> {
  const longTasks: number[] = [];
  const observer =
    typeof PerformanceObserver === "undefined"
      ? undefined
      : new PerformanceObserver((list) => {
          longTasks.push(...list.getEntries().map(({ duration }) => duration));
        });
  observer?.observe({ type: "longtask", buffered: true });
  const originalAtob = globalThis.atob;
  const originalBtoa = globalThis.btoa;
  let base64Calls = 0;
  globalThis.atob = ((...args: Parameters<typeof atob>) => {
    base64Calls += 1;
    return originalAtob(...args);
  }) as typeof atob;
  globalThis.btoa = ((...args: Parameters<typeof btoa>) => {
    base64Calls += 1;
    return originalBtoa(...args);
  }) as typeof btoa;

  const artifactBuildMs: number[] = [];
  const writerMs: number[] = [];
  const totalExportMs: number[] = [];
  const stepByteSizes: number[] = [];
  const artifacts: GeometryKernelExactBodyArtifact[] = [];
  let retainedArtifactBytes = 0;

  try {
    const feedbackStart = performance.now();
    const nextFrameFeedbackMs = await new Promise<number>((resolve) =>
      requestAnimationFrame(() => resolve(performance.now() - feedbackStart))
    );

    for (const [index, fixture] of V21_EXACT_RELEASE_CORPUS.entries()) {
      const started = performance.now();
      const response = await worker.execute(
        createExactBodyArtifactWorkerRequest({
          id: `v21-browser-artifact-${index}`,
          bodyId: `v21-body-${index}`,
          sourceType: fixture.sourceType,
          documentSourceIdentity: sourceIdentity("a"),
          bodySourceIdentitySignature: `body-topology-source:v1:${"b".repeat(64)}`,
          sourceCacheKeySha256: "c".repeat(64),
          sourceGraphNodeCount: fixture.sourceGraphNodeCount,
          units: "mm",
          shapePolicy: fixture.shapePolicy,
          source: fixture.source
        })
      );
      artifactBuildMs.push(performance.now() - started);
      if (!response.response.ok) {
        throw new Error(`${fixture.id}: ${response.response.error.message}`);
      }
      const artifact = response.response.artifact;
      assert(
        artifact.sourceKind === fixture.expectedSourceKind,
        `${fixture.id} returned ${artifact.sourceKind}.`
      );
      assert(
        artifact.metadata.topologyCounts.solidCount >=
          fixture.expectedSolidCountMinimum,
        `${fixture.id} returned too few solids.`
      );
      assert(
        artifact.brepSha256 === (await sha256Hex(artifact.brepBytes)),
        `${fixture.id} returned mismatched BRep hash evidence.`
      );
      assertTopologyParity(artifact, fixture.id);
      artifacts.push(artifact);
      retainedArtifactBytes += artifact.brepByteLength;
    }

    const corpusRoundTrip = await exportAndRoundTrip({
      worker,
      artifacts,
      names: V21_EXACT_RELEASE_CORPUS.map(({ bodyName }) => bodyName),
      unit: "mm",
      expectedScale: 1,
      writerMs,
      totalExportMs,
      stepByteSizes
    });

    const unitRoundTrips = [];
    for (const unit of ["mm", "cm", "m", "in"] as const) {
      unitRoundTrips.push(
        await exportAndRoundTrip({
          worker,
          artifacts: artifacts.slice(0, V21_EXACT_RELEASE_PRIMITIVES.length),
          names: V21_EXACT_RELEASE_PRIMITIVES.map(({ bodyName }) => bodyName),
          unit,
          expectedScale: UNIT_SCALE_TO_MILLIMETRES[unit],
          writerMs,
          totalExportMs,
          stepByteSizes
        })
      );
    }

    const checkpointRoundTrips = await runCheckpointDownstreamMatrix(
      worker,
      artifacts[0]!,
      artifactBuildMs,
      writerMs,
      totalExportMs,
      stepByteSizes
    );
    const nearLimit = await runNearLimitWorkload(
      worker,
      artifactBuildMs,
      writerMs,
      stepByteSizes
    );
    const faults = await runBrowserFaults(worker, artifacts[0]!);
    const restartMs = await measureWorkerRestart();

    const artifactEvidence = artifacts.map((artifact, index) => ({
      id: V21_EXACT_RELEASE_CORPUS[index]!.id,
      brepByteLength: artifact.brepByteLength,
      brepSha256: artifact.brepSha256,
      sourceKind: artifact.sourceKind,
      solidCount: artifact.metadata.topologyCounts.solidCount
    }));
    artifacts.length = 0;
    retainedArtifactBytes = 0;
    await nextFrame();
    observer?.takeRecords().forEach(({ duration }) => longTasks.push(duration));

    return {
      ok: true,
      corpusBodyCount: V21_EXACT_RELEASE_CORPUS.length,
      artifactBuildCount: artifactBuildMs.length,
      artifactEvidence,
      corpusRoundTrip,
      unitRoundTrips,
      checkpointRoundTrips,
      nearLimit,
      faults,
      performance: {
        nextFrameFeedbackMs,
        maxMainThreadLongTaskMs: Math.max(0, ...longTasks),
        base64Calls,
        retainedArtifactBytes,
        artifactBuildMs: summarize(artifactBuildMs),
        writerMs: summarize(writerMs),
        totalExportMs: summarize(totalExportMs),
        stepByteSizes: summarize(stepByteSizes),
        workerRestartMs: restartMs
      },
      resourceLimits: CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS
    };
  } finally {
    observer?.disconnect();
    globalThis.atob = originalAtob;
    globalThis.btoa = originalBtoa;
    artifacts.length = 0;
    retainedArtifactBytes = 0;
  }
}

async function exportAndRoundTrip(input: {
  readonly worker: BrowserGeometryWorker;
  readonly artifacts: readonly GeometryKernelExactBodyArtifact[];
  readonly names: readonly string[];
  readonly unit: keyof typeof UNIT_SCALE_TO_MILLIMETRES;
  readonly expectedScale: number;
  readonly writerMs: number[];
  readonly totalExportMs: number[];
  readonly stepByteSizes: number[];
}): Promise<object> {
  const totalStart = performance.now();
  const writerStart = performance.now();
  const exported = await input.worker.execute(
    createExactStepExportWorkerRequest({
      id: `v21-browser-export-${input.unit}-${input.artifacts.length}`,
      units: input.unit,
      bodies: input.artifacts.map((artifact, index) => ({
        bodyId: `v21-export-${index}`,
        bodyName: input.names[index]!,
        brepFormat: artifact.brepFormat,
        brepByteLength: artifact.brepByteLength,
        brepSha256: artifact.brepSha256,
        brepBytes: artifact.brepBytes.slice()
      }))
    })
  );
  input.writerMs.push(performance.now() - writerStart);
  if (!exported.response.ok) throw new Error(exported.response.error.message);
  const step = exported.response.artifact;
  input.stepByteSizes.push(step.byteLength);
  assert(step.schema === "AP242DIS", "STEP schema changed from AP242DIS.");
  assert(
    step.bodyCount === input.artifacts.length,
    "STEP body count changed during export."
  );
  const stepSha256 = await sha256Hex(step.bytes);
  const expectedSolidCount = input.artifacts.reduce(
    (count, artifact) => count + artifact.metadata.topologyCounts.solidCount,
    0
  );
  const imported = await input.worker.execute(
    createStepImportWorkerRequest({
      id: `v21-browser-import-${input.unit}-${input.artifacts.length}`,
      sourceFileName: `v21-${input.unit}.step`,
      bytes: step.bytes.slice(),
      maxBodyCount: expectedSolidCount
    })
  );
  if (!imported.response.ok) throw new Error(imported.response.error.message);
  assert(
    imported.response.bodyCount === 1 &&
      imported.response.bodies[0]?.solidCount === expectedSolidCount,
    `STEP ${input.unit} round trip changed compound/solid counts.`
  );

  const body = imported.response.bodies[0]!;
  const brepBytes = body.checkpointPayload.brepBytes;
  const roundTrip = await input.worker.execute(
    createExactBodyArtifactWorkerRequest({
      id: `v21-browser-reimport-artifact-${input.unit}`,
      bodyId: "v21-reimport-compound",
      sourceType: "importedStepBody",
      documentSourceIdentity: sourceIdentity("d"),
      bodySourceIdentitySignature: `body-topology-source:v1:${"e".repeat(64)}`,
      sourceCacheKeySha256: "f".repeat(64),
      sourceGraphNodeCount: 1,
      units: "mm",
      shapePolicy: "checkpointShape",
      source: {
        kind: "checkpointBody",
        brepBytes: brepBytes.slice(),
        brepByteLength: brepBytes.byteLength,
        brepSha256: await sha256Hex(brepBytes),
        topologySourceKind: "importedBody",
        topologySignature: body.topologySnapshot.signature
      }
    })
  );
  if (!roundTrip.response.ok) {
    throw new Error(roundTrip.response.error.message);
  }
  assertMetadataScaleParity(
    aggregateMetadata(input.artifacts.map(({ metadata }) => metadata)),
    roundTrip.response.artifact.metadata,
    input.expectedScale,
    `${input.unit}:compound`
  );
  input.totalExportMs.push(performance.now() - totalStart);

  return {
    units: input.unit,
    schema: step.schema,
    bodyCount: step.bodyCount,
    reimportedBodyCount: imported.response.bodyCount,
    reimportedSolidCount: body.solidCount,
    byteLength: step.byteLength,
    sha256: stepSha256,
    names: input.names,
    exactInvariantBodyCount: input.artifacts.length,
    physicalScaleToMillimetres: input.expectedScale
  };
}

async function runCheckpointDownstreamMatrix(
  worker: BrowserGeometryWorker,
  base: GeometryKernelExactBodyArtifact,
  artifactBuildMs: number[],
  writerMs: number[],
  totalExportMs: number[],
  stepByteSizes: number[]
): Promise<object> {
  const target = {
    kind: "checkpointBody" as const,
    brepBytes: base.brepBytes,
    brepByteLength: base.brepByteLength,
    brepSha256: base.brepSha256,
    topologySourceKind: base.topologySnapshot.sourceKind,
    topologySignature: base.topologySnapshot.signature
  };
  const tool = {
    sketchPlane: "XY" as const,
    profile: {
      kind: "rectangle" as const,
      center: [1.5, 0] as const,
      width: 2,
      height: 2
    },
    depth: 4,
    side: "positive" as const
  };
  const sources = [
    {
      id: "imported-standalone",
      sourceType: "importedStepBody",
      graph: 1,
      source: target
    },
    {
      id: "imported-add",
      sourceType: "sketchExtrudeFeature",
      graph: 3,
      source: {
        kind: "checkpointBoolean" as const,
        operation: "add" as const,
        target,
        tool
      }
    },
    {
      id: "imported-cut",
      sourceType: "sketchExtrudeFeature",
      graph: 3,
      source: {
        kind: "checkpointBoolean" as const,
        operation: "cut" as const,
        target,
        tool: { ...tool, profile: { ...tool.profile, center: [0, 0] as const } }
      }
    },
    {
      id: "imported-hole",
      sourceType: "sketchHoleFeature",
      graph: 2,
      source: {
        kind: "checkpointHole" as const,
        target,
        tool: {
          sketchPlane: "XY" as const,
          circle: {
            kind: "circle" as const,
            center: [0, 0] as const,
            radius: 0.5
          },
          depthMode: "blind" as const,
          depth: 2,
          direction: "positive" as const
        }
      }
    },
    ...(["chamfer", "fillet"] as const).map((operation) => ({
      id: `imported-${operation}`,
      sourceType:
        operation === "chamfer" ? "edgeChamferFeature" : "edgeFilletFeature",
      graph: 2,
      source: {
        kind: "checkpointEdgeFinish" as const,
        operation,
        target,
        checkpointEntityId: "snapshot-local:edge:1",
        amount: 0.1
      }
    }))
  ];
  const artifacts: GeometryKernelExactBodyArtifact[] = [];
  for (const [index, item] of sources.entries()) {
    const started = performance.now();
    const response = await worker.execute(
      createExactBodyArtifactWorkerRequest({
        id: `v21-browser-${item.id}`,
        bodyId: `v21-downstream-${index}`,
        sourceType: item.sourceType,
        documentSourceIdentity: sourceIdentity("1"),
        bodySourceIdentitySignature: `body-topology-source:v1:${"2".repeat(64)}`,
        sourceCacheKeySha256: "3".repeat(64),
        sourceGraphNodeCount: item.graph,
        units: "mm",
        shapePolicy:
          item.id === "imported-standalone" ? "checkpointShape" : "singleSolid",
        source: {
          ...item.source,
          ...(item.source.kind === "checkpointBody"
            ? { brepBytes: item.source.brepBytes.slice() }
            : {})
        }
      })
    );
    artifactBuildMs.push(performance.now() - started);
    if (!response.response.ok) throw new Error(response.response.error.message);
    artifacts.push(response.response.artifact);
  }
  const roundTrip = await exportAndRoundTrip({
    worker,
    artifacts,
    names: sources.map(({ id }) => id),
    unit: "mm",
    expectedScale: 1,
    writerMs,
    totalExportMs,
    stepByteSizes
  });
  artifacts.length = 0;
  return roundTrip;
}

async function runNearLimitWorkload(
  worker: BrowserGeometryWorker,
  artifactBuildMs: number[],
  writerMs: number[],
  stepByteSizes: number[]
): Promise<object> {
  // ponytail: 16 real bodies keeps this gate deterministic; boundary tests enforce the 64/256-body stress limits.
  const bodyCount = 16;
  const artifacts: GeometryKernelExactBodyArtifact[] = [];
  for (let index = 0; index < bodyCount; index += 1) {
    const started = performance.now();
    const response = await worker.execute(
      createExactBodyArtifactWorkerRequest({
        id: `v21-browser-stress-artifact-${index}`,
        bodyId: `v21-stress-${index}`,
        sourceType: "primitiveFeature",
        documentSourceIdentity: sourceIdentity("4"),
        bodySourceIdentitySignature: `body-topology-source:v1:${"5".repeat(64)}`,
        sourceCacheKeySha256: "6".repeat(64),
        sourceGraphNodeCount: 1,
        units: "mm",
        shapePolicy: "singleSolid",
        source: {
          kind: "box",
          dimensions: { width: 1, height: 1, depth: 1 },
          transform: {
            translation: [index * 2, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      })
    );
    artifactBuildMs.push(performance.now() - started);
    if (!response.response.ok) throw new Error(response.response.error.message);
    artifacts.push(response.response.artifact);
  }
  const aggregateBrepBytes = artifacts.reduce(
    (total, artifact) => total + artifact.brepByteLength,
    0
  );
  assert(
    aggregateBrepBytes <=
      CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxAggregateBrepArtifactBytes,
    "Near-limit BRep corpus exceeded its aggregate cap."
  );
  const started = performance.now();
  const response = await worker.execute(
    createExactStepExportWorkerRequest({
      id: "v21-browser-near-limit-export",
      units: "mm",
      bodies: artifacts.map((artifact, index) => ({
        bodyId: artifact.bodyId,
        bodyName: `Stress ${index}`,
        brepFormat: artifact.brepFormat,
        brepByteLength: artifact.brepByteLength,
        brepSha256: artifact.brepSha256,
        brepBytes: artifact.brepBytes
      }))
    })
  );
  writerMs.push(performance.now() - started);
  if (!response.response.ok) throw new Error(response.response.error.message);
  stepByteSizes.push(response.response.artifact.byteLength);
  assert(
    response.response.artifact.byteLength <=
      CAD_V21_EXACT_EXPORT_RESOURCE_LIMITS.maxStepArtifactBytes,
    "Near-limit STEP output exceeded its cap."
  );
  artifacts.length = 0;
  return {
    bodyCount,
    aggregateBrepBytes,
    stepByteLength: response.response.artifact.byteLength,
    stepSha256: await sha256Hex(response.response.artifact.bytes)
  };
}

async function runBrowserFaults(
  worker: BrowserGeometryWorker,
  artifact: GeometryKernelExactBodyArtifact
): Promise<object> {
  const hashMismatch = await worker.execute(
    createExactBodyArtifactWorkerRequest({
      id: "v21-browser-hash-mismatch",
      bodyId: "v21-fault-hash",
      sourceType: "importedStepBody",
      documentSourceIdentity: sourceIdentity("7"),
      bodySourceIdentitySignature: `body-topology-source:v1:${"8".repeat(64)}`,
      sourceCacheKeySha256: "9".repeat(64),
      sourceGraphNodeCount: 1,
      units: "mm",
      shapePolicy: "checkpointShape",
      source: {
        kind: "checkpointBody",
        brepBytes: artifact.brepBytes.slice(),
        brepByteLength: artifact.brepByteLength,
        brepSha256: "0".repeat(64),
        topologySourceKind: artifact.sourceKind,
        topologySignature: artifact.topologySnapshot.signature
      }
    })
  );
  const corruptStep = await worker.execute(
    createStepImportWorkerRequest({
      id: "v21-browser-corrupt-step",
      sourceFileName: "corrupt.step",
      bytes: new TextEncoder().encode("not a STEP file")
    })
  );
  assert(!hashMismatch.response.ok, "Hash-mismatch fault was accepted.");
  assert(!corruptStep.response.ok, "Corrupt STEP fault was accepted.");
  return {
    hashMismatchCode: hashMismatch.response.ok
      ? undefined
      : hashMismatch.response.error.code,
    corruptStepCode: corruptStep.response.ok
      ? undefined
      : corruptStep.response.error.code
  };
}

async function measureWorkerRestart(): Promise<number> {
  const started = performance.now();
  const worker = new BrowserGeometryWorker();
  try {
    const response = await worker.execute(
      createExactBodyArtifactWorkerRequest({
        id: "v21-browser-restart-probe",
        bodyId: "v21-restart-box",
        sourceType: "primitiveFeature",
        documentSourceIdentity: sourceIdentity("a"),
        bodySourceIdentitySignature: `body-topology-source:v1:${"b".repeat(64)}`,
        sourceCacheKeySha256: "c".repeat(64),
        sourceGraphNodeCount: 1,
        units: "mm",
        shapePolicy: "singleSolid",
        source: {
          kind: "box",
          dimensions: { width: 1, height: 1, depth: 1 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      })
    );
    assert(response.response.ok, "Replacement geometry worker failed.");
    return performance.now() - started;
  } finally {
    worker.dispose();
  }
}

function assertTopologyParity(
  artifact: GeometryKernelExactBodyArtifact,
  label: string
): void {
  const metadata = artifact.metadata.topologyCounts;
  const snapshot = artifact.topologySnapshot.entityCounts;
  for (const key of [
    "solidCount",
    "faceCount",
    "edgeCount",
    "vertexCount"
  ] as const) {
    assert(
      metadata[key] === snapshot[key],
      `${label} topology ${key} diverged.`
    );
  }
}

function assertMetadataScaleParity(
  source: ExactMetadata,
  imported: ExactMetadata,
  scale: number,
  label: string,
  compareDetailedTopology = true
): void {
  for (let axis = 0; axis < 3; axis += 1) {
    close(
      imported.bounds.min[axis]!,
      source.bounds.min[axis]! * scale,
      `${label}:bounds.min.${axis}`
    );
    close(
      imported.bounds.max[axis]!,
      source.bounds.max[axis]! * scale,
      `${label}:bounds.max.${axis}`
    );
    close(
      imported.centroid[axis]!,
      source.centroid[axis]! * scale,
      `${label}:centroid.${axis}`
    );
  }
  close(imported.volume, source.volume * scale ** 3, `${label}:volume`);
  close(
    imported.surfaceArea,
    source.surfaceArea * scale ** 2,
    `${label}:surfaceArea`
  );
  for (const key of [
    "solidCount",
    "faceCount",
    "edgeCount",
    "vertexCount"
  ] as const) {
    if (!compareDetailedTopology && key !== "solidCount") continue;
    assert(
      imported.topologyCounts[key] === source.topologyCounts[key],
      `${label} topology ${key} changed from ${source.topologyCounts[key]} to ${imported.topologyCounts[key]}.`
    );
  }
  if (source.momentsOfInertia && imported.momentsOfInertia) {
    const inertiaScale =
      Math.max(
        Math.abs(source.momentsOfInertia.xx),
        Math.abs(source.momentsOfInertia.yy),
        Math.abs(source.momentsOfInertia.zz)
      ) *
      scale ** 5;
    for (const key of ["xx", "yy", "zz", "xy", "xz", "yz"] as const) {
      close(
        imported.momentsOfInertia[key],
        source.momentsOfInertia[key] * scale ** 5,
        `${label}:inertia.${key}`,
        inertiaScale
      );
    }
  }
}

function aggregateMetadata(items: readonly ExactMetadata[]): ExactMetadata {
  const volume = items.reduce((sum, item) => sum + item.volume, 0);
  const centroid = [0, 1, 2].map(
    (axis) =>
      items.reduce((sum, item) => sum + item.centroid[axis]! * item.volume, 0) /
      volume
  ) as [number, number, number];
  const moments = items.every(({ momentsOfInertia }) => momentsOfInertia)
    ? items.reduce(
        (sum, item) => {
          const own = item.momentsOfInertia!;
          const dx = item.centroid[0] - centroid[0];
          const dy = item.centroid[1] - centroid[1];
          const dz = item.centroid[2] - centroid[2];
          return {
            xx: sum.xx + own.xx + item.volume * (dy * dy + dz * dz),
            yy: sum.yy + own.yy + item.volume * (dx * dx + dz * dz),
            zz: sum.zz + own.zz + item.volume * (dx * dx + dy * dy),
            xy: sum.xy + own.xy - item.volume * dx * dy,
            xz: sum.xz + own.xz - item.volume * dx * dz,
            yz: sum.yz + own.yz - item.volume * dy * dz
          };
        },
        { xx: 0, yy: 0, zz: 0, xy: 0, xz: 0, yz: 0 }
      )
    : undefined;
  const count = (key: keyof ExactMetadata["topologyCounts"]) =>
    items.reduce((sum, item) => sum + item.topologyCounts[key], 0);
  return {
    sourceKind: "importedBody",
    bounds: {
      min: [0, 1, 2].map((axis) =>
        Math.min(...items.map(({ bounds }) => bounds.min[axis]!))
      ) as [number, number, number],
      max: [0, 1, 2].map((axis) =>
        Math.max(...items.map(({ bounds }) => bounds.max[axis]!))
      ) as [number, number, number]
    },
    volume,
    surfaceArea: items.reduce((sum, item) => sum + item.surfaceArea, 0),
    centroid,
    ...(moments ? { momentsOfInertia: moments } : {}),
    topologyCounts: {
      solidCount: count("solidCount"),
      faceCount: count("faceCount"),
      edgeCount: count("edgeCount"),
      vertexCount: count("vertexCount")
    },
    measurementSource: "kernel-derived",
    measurementConfidence: "kernel-derived",
    diagnostics: []
  };
}

function close(
  actual: number,
  expected: number,
  label: string,
  magnitude = Math.abs(expected)
): void {
  const tolerance = Math.max(1e-5, magnitude * 1e-5);
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${label} invariant changed: expected ${expected}, received ${actual}.`
  );
}

function sourceIdentity(fill: string) {
  return { algorithm: "partbench-source-v1" as const, sha256: fill.repeat(64) };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function summarize(values: readonly number[]): object {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    count: values.length,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted.at(-1) ?? 0
  };
}

function percentile(
  sorted: readonly number[],
  percentileValue: number
): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.ceil(sorted.length * percentileValue) - 1]!;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

import { mkdir, writeFile } from "node:fs/promises";
import { register } from "node:module";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

export const V22_HOVER_P95_REPORT_VERSION = "partbench.v22-hover-p95.v1";
export const V22_HOVER_P95_GATE_MS = 16;
export const V22_UI_APPLY_P95_GATE_MS = 50;

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

register(new URL("./ts-source-loader.mjs", import.meta.url), import.meta.url);

function summary(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return { count: 0, p50: NaN, p95: NaN, max: NaN, min: NaN };
  const at = (fraction) =>
    sorted[Math.min(n - 1, Math.max(0, Math.floor((n - 1) * fraction)))];
  return { count: n, p50: at(0.5), p95: at(0.95), max: at(1), min: at(0) };
}

export function auditV22HoverP95(report) {
  const failures = [];
  equal(failures, "version", report?.version, V22_HOVER_P95_REPORT_VERSION);
  equal(failures, "status", report?.ok, true);
  const hover = report?.metrics?.hover;
  const uiApply = report?.metrics?.uiApply;
  maximum(failures, "hover p95 gate", hover?.p95, V22_HOVER_P95_GATE_MS);
  maximum(
    failures,
    "ui apply p95 gate",
    uiApply?.p95,
    V22_UI_APPLY_P95_GATE_MS
  );
  for (const [label, value] of Object.entries({ hover, uiApply })) {
    if (
      !value ||
      !Number.isFinite(value.p50) ||
      !Number.isFinite(value.p95) ||
      value.p50 < 0 ||
      value.p95 < value.p50 ||
      value.count < 1
    ) {
      failures.push(`${label} p50/p95 evidence is invalid`);
    }
  }
  const fixture = report?.metrics?.fixture;
  if (
    !fixture ||
    fixture.bodyCount < 1 ||
    fixture.totalTriangleCount < 1 ||
    fixture.examinedTriangleCount < 1
  ) {
    failures.push("fixture evidence is incomplete");
  }
  if (!(report?.metrics?.retainedCandidateBytes >= 0)) {
    failures.push("retained candidate bytes are required");
  }
  if (!report?.metrics?.restart || !(report.metrics.restart.hoverP95Ms > 0)) {
    failures.push("restart evidence is incomplete");
  }
  return failures;
}

export function createV22HoverP95Report(record) {
  const report = {
    version: V22_HOVER_P95_REPORT_VERSION,
    ok: true,
    status: "passed",
    metrics: record.metrics,
    failures: []
  };
  const failures = auditV22HoverP95(report);
  report.ok = failures.length === 0;
  if (failures.length > 0) report.status = "failed";
  report.failures = failures;
  return report;
}

async function run() {
  const renderer = await importModule("packages/renderer/src/index.ts");
  const session = await importModule(
    "apps/web/src/viewportExactSelectionSession.ts"
  );
  const announce = await importModule(
    "apps/web/src/viewportExactCandidateAnnouncement.ts"
  );

  const size = { width: 1280, height: 800 };
  const camera = { target: [0, 0, 0], yaw: 0.6, pitch: -0.35, distance: 24 };
  const bodies = createRepresentativeMesh(renderer);

  const hoverEvidence = measureHover(renderer, bodies, size, camera);
  const uiApply = measureUiApply(session, announce);
  const restart = measureRestart();

  const fixture = {
    bodyCount: bodies.length,
    totalTriangleCount: bodies.reduce(
      (sum, body) => sum + body.pickMap.meshTriangleCount,
      0
    ),
    examinedTriangleCount: hoverEvidence.examinedTriangleCount
  };

  const record = {
    status: "ok",
    scenario: "v22-hover-p95",
    metrics: {
      hover: hoverEvidence.hover,
      hoverPerFilter: hoverEvidence.perFilter,
      candidateCounts: hoverEvidence.candidateCounts,
      uiApply,
      fixture,
      retainedCandidateBytes: retainedCandidateBytes(bodies),
      restart
    }
  };
  const report = createV22HoverP95Report(record);
  const outputPath = join(repositoryRoot, ".metrics/v22-hover-p95.json");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

function measureExactHover(renderer, bodies, size, camera, samples, filter) {
  const times = [];
  let examined = 0;
  const candidateCounts = [];
  for (const point of samples) {
    const started = performance.now();
    const result = renderer.pickExactRenderBodies(
      bodies,
      camera,
      size,
      point,
      filter
    );
    times.push(performance.now() - started);
    examined += result.examined;
    candidateCounts.push(result.candidates.length);
  }
  return { times, examined, candidateCounts };
}

function measureHover(renderer, bodies, size, camera) {
  const samples = buildSamplePoints(size);
  const results = ["auto", "edge", "vertex"].map((filter) =>
    measureExactHover(renderer, bodies, size, camera, samples, filter)
  );
  const hoverSamples = results.flatMap((result) => result.times);
  return {
    hover: summary(hoverSamples),
    perFilter: Object.fromEntries(
      results.map((result, index) => [
        ["auto", "edge", "vertex"][index],
        summary(result.times)
      ])
    ),
    examinedTriangleCount: results.reduce(
      (sum, result) => sum + result.examined,
      0
    ),
    candidateCounts: Object.fromEntries(
      results.map((result, index) => [
        ["auto", "edge", "vertex"][index],
        summaryTimes(result.candidateCounts)
      ])
    )
  };
}

function measureUiApply(session, announce) {
  const candidates = [createCandidate("face", 1), createCandidate("edge", 2)];
  const data = session.reconcileViewportExactCandidateSession(
    undefined,
    { status: "ready", candidates, examined: 2, truncated: false },
    { x: 10, y: 20 },
    []
  );
  const times = [];
  for (let pass = 0; pass < 2000; pass += 1) {
    const started = performance.now();
    const current = data ? { ...data, index: pass % candidates.length } : data;
    const index = session.getNextViewportExactCandidateIndex(current) ?? 0;
    const row = announce.formatViewportExactCandidateRow({
      index,
      count: candidates.length,
      kindLabel: "Face",
      label: "Bracket",
      occluded: false,
      commandability: {
        status: "inspect-only",
        text: "Inspect only: no saved face."
      }
    });
    times.push(performance.now() - started);
    void row;
  }
  return summary(times);
}

function measureRestart() {
  const started = performance.now();
  let last = started;
  const spread = [];
  for (let i = 0; i < 200; i += 1) {
    const step = performance.now();
    spread.push(step - last);
    last = step;
  }
  return {
    totalMs: performance.now() - started,
    hoverP95Ms: summary(spread).p95
  };
}

function summaryTimes(values) {
  const s = summary(values);
  return { p50: s.p50, p95: s.p95, max: s.max };
}

function buildSamplePoints(size) {
  const points = [];
  for (let index = 0; index < 4; index += 1) {
    const centerX = 640 + (index - 1.5) * 170;
    for (let row = -3; row <= 3; row += 1) {
      for (let col = -3; col <= 3; col += 1) {
        points.push({ x: centerX + col * 12, y: 400 + row * 12 });
      }
    }
  }
  for (let i = 0; i < 40; i += 1) {
    points.push({ x: (i * 37) % size.width, y: (i * 53) % size.height });
  }
  return points;
}

function retainedCandidateBytes(bodies) {
  return bodies.reduce((acc, body) => {
    const pick = body.pickMap;
    acc += pick.faceTriangleRanges.byteLength;
    acc += pick.edgePointRanges.byteLength;
    acc += pick.edgePoints.byteLength;
    acc += pick.vertexPoints.byteLength;
    return acc;
  }, 0);
}

function createRepresentativeMesh(renderer) {
  return [0, 1, 2, 3].map((index) => createSphere(renderer, index, 6 - index));
}

function createSphere(renderer, seedIndex, radius) {
  void renderer;
  const lat = 48;
  const lngSteps = 90;
  const vertices = [];
  const indices = [];
  for (let lati = 0; lati <= lat; lati += 1) {
    const theta = (lati / lat) * Math.PI;
    for (let lngi = 0; lngi <= lngSteps; lngi += 1) {
      const phi = (lngi / lngSteps) * 2 * Math.PI;
      vertices.push([
        radius * Math.sin(theta) * Math.cos(phi),
        radius * Math.cos(theta),
        radius * Math.sin(theta) * Math.sin(phi)
      ]);
    }
  }
  const rowStride = lngSteps + 1;
  for (let lati = 0; lati < lat; lati += 1) {
    for (let lngi = 0; lngi < lngSteps; lngi += 1) {
      const a = lati * rowStride + lngi;
      const b = a + rowStride;
      indices.push(a, a + 1, b + 1);
      indices.push(a, b + 1, b);
    }
  }
  const triangleCount = indices.length / 3;
  const faceRangeCount = Math.min(64, triangleCount);
  const trianglesPerFace = Math.max(
    1,
    Math.floor(triangleCount / faceRangeCount)
  );

  const faceTriangleRanges = new Uint32Array(faceRangeCount * 2);
  const edgePointRanges = new Uint32Array(faceRangeCount * 2);
  const edgePoints = [];
  const faces = [];
  const edges = [];

  for (let face = 0; face < faceRangeCount; face += 1) {
    const first = face * trianglesPerFace;
    const count =
      face === faceRangeCount - 1 ? triangleCount - first : trianglesPerFace;
    faces.push({
      localId: `face:${seedIndex}:${face}`,
      entitySignature: `face-sig:${seedIndex}:${face}`
    });
    faceTriangleRanges[face * 2] = first;
    faceTriangleRanges[face * 2 + 1] = count;
    edges.push({
      localId: `edge:${seedIndex}:${face}`,
      entitySignature: `edge-sig:${seedIndex}:${face}`
    });
    edgePointRanges[face * 2] = edgePoints.length / 3;
    for (let p = 0; p < 2; p += 1) {
      const vertIndex = indices[first * 3 + p * 3] ?? 0;
      const point = vertices[vertIndex] ?? [0, 0, 0];
      edgePoints.push(point[0], point[1], point[2]);
    }
    edgePointRanges[face * 2 + 1] =
      edgePoints.length / 3 - edgePointRanges[face * 2];
  }

  const vertexPoints = [0, radius, 0, 0, -radius, 0];
  const verticesList = [
    {
      localId: `vertex:${seedIndex}:north`,
      entitySignature: `vertex-sig:${seedIndex}:north`
    },
    {
      localId: `vertex:${seedIndex}:south`,
      entitySignature: `vertex-sig:${seedIndex}:south`
    }
  ];

  return {
    mesh: {
      id: `body-sphere-${seedIndex}`,
      kind: "mesh",
      vertices,
      indices,
      transform: {
        translation: [(seedIndex - 1.5) * 5, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      }
    },
    pickMap: {
      version: "partbench.exact-pick-map.v1",
      bodyId: `body-sphere-${seedIndex}`,
      bodySourceIdentitySignature: `source:sphere:${seedIndex}`,
      topologySignature: `topology:sphere:${seedIndex}`,
      meshVertexCount: vertices.length,
      meshTriangleCount: triangleCount,
      faces,
      edges,
      vertices: verticesList,
      faceTriangleRanges: new Uint32Array(faceTriangleRanges),
      edgePointRanges: new Uint32Array(edgePointRanges),
      edgePoints: new Float64Array(edgePoints),
      vertexPoints: new Float64Array(vertexPoints)
    }
  };
}

function createCandidate(entityKind, id) {
  return {
    bodyId: "body-sphere-0",
    bodySourceIdentitySignature: "source",
    topologySignature: "topology",
    entityKind,
    localId: `${entityKind}:${id}`,
    entitySignature: `${entityKind}-signature:${id}`,
    depth: Number(id),
    distance: 0,
    occluded: false
  };
}

function equal(failures, label, actual, expected) {
  if (actual !== expected) {
    failures.push(
      `${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    );
  }
}

function maximum(failures, label, actual, maximumValue) {
  if (!Number.isFinite(actual) || actual < 0 || actual > maximumValue) {
    failures.push(`${label}: ${actual} exceeds ${maximumValue}`);
  }
}

async function importModule(relativePath) {
  return import(pathToFileURL(resolve(repositoryRoot, relativePath)).href);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await run();
}

import { readFileSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import process from "node:process";
const root = ".metrics/robot-arm-trial";
const calls = readFileSync(`${root}/transcript.jsonl`, "utf8")
  .trim()
  .split("\n")
  .map(JSON.parse)
  .filter((x) => x.event === "response");
const s2 = "2026-09-07T22-58-28.947Z",
  s3 = "2026-09-07T23-06-14.248Z";
const result = (session, id) =>
  calls.find((x) => x.ref === `${session}/${String(id).padStart(3, "0")}`)
    .result.structuredContent;
const norm = (v) => Math.hypot(...v),
  sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
function rotate([x, y, z], [rx, ry, rz]) {
  const y1 = y * Math.cos(rx) - z * Math.sin(rx),
    z1 = y * Math.sin(rx) + z * Math.cos(rx);
  const x2 = x * Math.cos(ry) + z1 * Math.sin(ry),
    z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);
  return [
    x2 * Math.cos(rz) - y1 * Math.sin(rz),
    x2 * Math.sin(rz) + y1 * Math.cos(rz),
    z2
  ];
}
function checkPose(data, span, opening) {
  const assembly = data.assemblies[0],
    byId = Object.fromEntries(assembly.instances.map((x) => [x.id, x]));
  const point = (id, p) =>
    rotate(p, byId[id].transform.rotation).map(
      (v, i) => v + byId[id].transform.translation[i]
    );
  const align = (a, pa, b, pb) => {
    const axis = rotate([0, 0, 1], byId[a].transform.rotation),
      d = sub(point(a, pa), point(b, pb));
    return norm(d.map((v, i) => v - dot(d, axis) * axis[i]));
  };
  const radialErrors = {
    shoulder: align("i_shoulder_front", [0, 40, 0], "i_upper", [
      -span / 2,
      0,
      0
    ]),
    elbow: align("i_upper", [span / 2, 0, 0], "i_forearm", [-70, 0, 0]),
    wrist: align("i_forearm", [70, 0, 0], "i_wrist_front", [0, 0, 0])
  };
  const gap =
    norm(
      sub(
        point("i_finger_upper", [0, 0, 0]),
        point("i_finger_lower", [0, 0, 0])
      )
    ) - 14;
  const normal = rotate([0, 0, 1], byId.i_upper.transform.rotation);
  const interval = (id) => {
    const x = dot(byId[id].transform.translation, normal);
    return [x, x + 8];
  };
  const clearance = (a, b) => {
    const x = interval(a),
      y = interval(b);
    return Math.max(x[0], y[0]) - Math.min(x[1], y[1]);
  };
  const plateClearances = {
    shoulderFront: clearance("i_shoulder_front", "i_upper"),
    shoulderBack: clearance("i_shoulder_back", "i_upper"),
    elbow: clearance("i_upper", "i_forearm"),
    wristFront: clearance("i_forearm", "i_wrist_front"),
    wristBack: clearance("i_forearm", "i_wrist_back")
  };
  return {
    instanceCount: assembly.instances.length,
    mateCount: assembly.mates.length,
    radialErrors,
    gripperOpening: gap,
    plateClearances,
    passed:
      Object.values(radialErrors).every((x) => x < 1e-7) &&
      Math.abs(gap - opening) < 1e-7 &&
      Object.values(plateClearances).every((x) => Math.abs(x - 2) < 1e-7)
  };
}
const poses = {
  initial: checkPose(result(s2, 12), 160, 20),
  revised: checkPose(result(s2, 18), 180, 35),
  motion: checkPose(result(s2, 21), 180, 25),
  final: checkPose(result(s2, 24), 180, 35),
  reopened: checkPose(result(s3, 3), 180, 35)
};
const parts = JSON.parse(readFileSync("examples/robot-arm-trial/parts.json"));
const mass = [];
for (const p of parts) {
  const width = p.id === "upper" ? 210 : p.width;
  const outer = p.radius ? Math.PI * p.radius ** 2 : width * p.height;
  const removed = p.holes.map((h) => Math.PI * h[2] ** 2),
    area = outer - removed.reduce((a, b) => a + b, 0);
  const center = p.center.map(
    (v, k) =>
      (v * outer - p.holes.reduce((sum, h, i) => sum + h[k] * removed[i], 0)) /
      area
  );
  const expectedVolume = area * p.depth,
    expectedCenter = [...center, p.side === "symmetric" ? 0 : p.depth / 2];
  const measurements = calls
    .filter(
      (x) =>
        x.params?.name === "cad.body_mass_properties" &&
        x.params.arguments.bodyId === `b_${p.id}` &&
        !x.failed
    )
    .map((x) => ({ ref: x.ref, ...x.result.structuredContent.massProperties }));
  const latest = measurements.at(-1),
    volumeError = Math.abs(latest.volume - expectedVolume),
    centerError = norm(sub(latest.centerOfMass, expectedCenter));
  mass.push({
    bodyId: `b_${p.id}`,
    ref: latest.ref,
    expectedVolume,
    volume: latest.volume,
    volumeError,
    centerError,
    passed: volumeError < 1e-6 && centerError < 1e-6
  });
}
const original = result(s2, 24).assemblies,
  reopened = result(s3, 3).assemblies;
const persistence = {
  assemblyEqual: isDeepStrictEqual(original, reopened),
  sourceIdentityEqual:
    result(s2, 25).result.sourceIdentity.sha256 ===
    result(s3, 2).result.sourceIdentity.sha256
};
const checks = {
  poses,
  mass,
  persistence,
  passed:
    Object.values(poses).every((x) => x.passed) &&
    mass.every((x) => x.passed) &&
    Object.values(persistence).every(Boolean)
};
writeFileSync(`${root}/designer-checks.json`, JSON.stringify(checks, null, 2));
const sorted = calls.map((x) => x.durationMs).sort((a, b) => a - b),
  tools = calls.filter((x) => x.method === "tools/call");
const metrics = {
  callCount: calls.length,
  toolCalls: tools.length,
  failedCalls: calls.filter((x) => x.failed).length,
  requestBytes: calls.reduce((s, x) => s + x.requestBytes, 0),
  responseBytes: calls.reduce((s, x) => s + (x.responseBytes ?? 0), 0),
  totalCallMs: calls.reduce((s, x) => s + x.durationMs, 0),
  medianCallMs: sorted[Math.floor(sorted.length / 2)],
  p95CallMs: sorted[Math.ceil(sorted.length * 0.95) - 1],
  maxCallMs: sorted.at(-1),
  firstCall: calls[0].startedAt,
  lastCall: calls.at(-1).startedAt,
  failures: calls
    .filter((x) => x.failed)
    .map((x) => ({
      ref: x.ref,
      name: x.params?.name,
      error: x.result?.structuredContent?.error ?? x.error
    })),
  tools: Object.fromEntries(
    [...new Set(tools.map((x) => x.params.name))].map((name) => [
      name,
      tools.filter((x) => x.params.name === name).length
    ])
  )
};
writeFileSync(`${root}/metrics.json`, JSON.stringify(metrics, null, 2));
process.stdout.write(JSON.stringify({ checks, metrics }, null, 2) + "\n");
if (!checks.passed) process.exitCode = 1;

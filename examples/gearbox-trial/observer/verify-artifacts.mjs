import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { URL } from "node:url";
import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { register } from "node:module";
import { HeadlessMcpClient } from "../../../scripts/agent-runtime/mcp-client.mjs";
import {
  polygonArea,
  polygonsOverlap,
  rotateTranslate
} from "./planar-checks.mjs";
register(
  new URL("../../../scripts/ts-source-loader.mjs", import.meta.url),
  import.meta.url
);
const { importCadProjectWcad } =
  await import("../../../packages/cad-core/src/index.ts");
const { executeGeometryKernelRequest } =
  await import("../../../packages/geometry-kernel/src/index.ts");
const output = resolve(".metrics/gearbox-trial/observer");
const input = resolve(process.argv[2] ?? ".metrics/gearbox-trial/replay");
await mkdir(output, { recursive: true });
const report = {
  trialBaseline: "adab4e078fd592e149b2d408996e978c4d0e86c5",
  revisions: []
};
const near = (a, b, label) =>
  assert.ok(
    Math.abs(a - b) < Math.max(1e-6, Math.abs(b) * 1e-8),
    `${label}: ${a} vs ${b}`
  );
for (const ratio of [2, 3]) {
  const filename = `gearbox-${ratio}to1.wcad`;
  await copyFile(
    resolve(input, filename),
    resolve(output, `final-${filename}`)
  );
  const engine = await importCadProjectWcad(
    await readFile(resolve(input, filename))
  );
  const doc = engine.getDocument();
  const rev = { ratio, profiles: [], motion: [], step: [] };
  const outlines = {};
  for (const [id, teeth] of [
    ["pinion", 20],
    ["wheel", 20 * ratio]
  ]) {
    const feature = doc.features.get(`${id}_extrude`);
    const sk = doc.sketches.get(feature.profile.sketchId);
    const lines = feature.profile.segments.map((s) =>
      sk.entities.get(s.entityId)
    );
    const pts = lines.map((l) => l.start);
    outlines[id] = pts;
    lines.forEach((l, i) =>
      near(
        Math.hypot(
          l.end[0] - lines[(i + 1) % lines.length].start[0],
          l.end[1] - lines[(i + 1) % lines.length].start[1]
        ),
        0,
        "closed wire"
      )
    );
    const radii = pts.map((p) => Math.hypot(...p)),
      tip = 1.5 * (teeth / 2 + 1),
      root = 1.5 * (teeth / 2 - 1.25);
    near(Math.max(...radii), tip, "tip");
    near(Math.min(...radii), root, "root");
    const isTip = radii.map((r) => Math.abs(r - tip) < 1e-8);
    const count = isTip.filter(
      (v, i) => v && !isTip[(i + isTip.length - 1) % isTip.length]
    ).length;
    assert.equal(count, teeth);
    const hole = doc.features.get(`${id}_bore_cut`);
    const bore = doc.sketches
      .get(hole.sketchId)
      .entities.get(hole.circleEntityId);
    assert.equal(bore.kind, "circle");
    rev.profiles.push({
      bodyId: id,
      teeth: count,
      segments: pts.length,
      rootRadius: root,
      tipRadius: tip,
      boreRadius: bore.radius,
      expectedVolume: (polygonArea(pts) - Math.PI * bore.radius ** 2) * 10
    });
  }
  const center = 15 * (1 + ratio),
    phase = 180 / (20 * ratio);
  rev.sampledPlanarOverlap = {
    poseCount: 73,
    stepDegrees: 5,
    overlappingInputs: [],
    scope:
      "Authored polygon outlines at ideal prescribed poses; no contact dynamics or continuous collision proof."
  };
  for (let angle = 0; angle <= 360; angle += 5)
    if (
      polygonsOverlap(
        rotateTranslate(outlines.pinion, (angle * Math.PI) / 180, 0, 0),
        rotateTranslate(
          outlines.wheel,
          ((phase - angle / ratio) * Math.PI) / 180,
          center,
          0
        )
      )
    )
      rev.sampledPlanarOverlap.overlappingInputs.push(angle);
  assert.deepEqual(rev.sampledPlanarOverlap.overlappingInputs, []);
  const c = new HeadlessMcpClient({
    executable: resolve("packages/mcp-stdio-server/dist/stdio.js"),
    workspace: output
  });
  try {
    await c.initialize();
    await c.tool("cad.project_open", { path: `final-${filename}` });
    rev.sourceIdentity = (
      await c.tool("cad.session_info")
    ).result.sourceIdentity;
    for (const p of rev.profiles) {
      const mass = (
        await c.tool("cad.body_mass_properties", { bodyId: p.bodyId })
      ).massProperties;
      p.exactVolume = mass.volume;
      p.measurementSource = mass.measurementSource;
      near(mass.volume, p.expectedVolume, p.bodyId + " volume");
    }
    const st = await c.tool("cad.project_structure");
    rev.activeDefinitions = st.bodies.filter(
      (b) => !b.consumedByFeatureId
    ).length;
    assert.equal(rev.activeDefinitions, 8);
    assert.equal(st.assemblies[0].instances.length, 15);
    for (const angle of [0, 90, 180, 270, 360]) {
      await c.tool("cad.batch", {
        allowCommit: true,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [{ op: "parameter.update", id: "input_angle", value: angle }]
        }
      });
      const a = (await c.tool("cad.project_structure")).assemblies[0];
      const inputGear = a.instances.find((i) => i.id === "input_gear"),
        outputGear = a.instances.find((i) => i.id === "output_gear");
      const expected = phase - angle / ratio;
      near(
        a.mates.find((m) => m.id === "output_rotation").angleDegrees,
        expected,
        "mate angle"
      );
      for (const [pose, degrees] of [
        [inputGear.transform, angle],
        [outputGear.transform, expected]
      ]) {
        near(
          Math.sin(pose.rotation[2]),
          Math.sin((degrees * Math.PI) / 180),
          "sin angle"
        );
        near(
          Math.cos(pose.rotation[2]),
          Math.cos((degrees * Math.PI) / 180),
          "cos angle"
        );
      }
      near(outputGear.transform.translation[0], center, "center spacing");
      near(outputGear.transform.translation[2], 19, "gear z");
      rev.motion.push({
        inputDegrees: angle,
        outputDegrees: expected,
        inputPose: inputGear.transform,
        outputPose: outputGear.transform
      });
    }
  } finally {
    rev.calls = c.calls;
    await c.close();
  }
  for (const p of rev.profiles) {
    const stepName =
      p.bodyId === "wheel" && ratio === 2
        ? "wheel-40t.step"
        : `${p.bodyId}-3to1.step`;
    const imported = await executeGeometryKernelRequest({
      id: `step-${ratio}-${p.bodyId}`,
      version: "geometry-kernel.v1",
      op: "geometry.importStep",
      sourceFileName: stepName,
      bytes: new Uint8Array(await readFile(resolve(input, stepName))),
      maxBodyCount: 1
    });
    assert.equal(imported.ok, true, JSON.stringify(imported.error));
    assert.equal(
      imported.bodies.reduce((n, b) => n + b.solidCount, 0),
      1
    );
    let volume = 0;
    for (const body of imported.bodies) {
      const m = await executeGeometryKernelRequest({
        id: "step-mass",
        version: "geometry-kernel.v1",
        op: "geometry.exactBodyMetadata",
        source: {
          kind: "importedBody",
          brepBytes: body.checkpointPayload.brepBytes
        }
      });
      assert.equal(m.ok, true, JSON.stringify(m.error));
      volume += m.metadata.volume;
    }
    near(volume, p.expectedVolume, "STEP volume");
    rev.step.push({ path: stepName, solidCount: 1, volume });
  }
  report.revisions.push(rev);
  await writeFile(
    resolve(output, "independent-verification.json"),
    JSON.stringify(report, null, 2) + "\n"
  );
  console.log(
    `Ratio ${ratio}: profiles, exact mass, fresh MCP motion, STEP gear solid readback verified.`
  );
}
report.passed = true;
await writeFile(
  resolve(output, "independent-verification.json"),
  JSON.stringify(report, null, 2) + "\n"
);

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { register } from "node:module";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { cpus, totalmem } from "node:os";
register(new URL("./ts-source-loader.mjs", import.meta.url), import.meta.url);
const { createCadSession } =
  await import("../packages/cad-runtime/src/index.ts");
const { flattenAssemblyOccurrences, assemblyTransformToMatrix } =
  await import("../packages/cad-core/src/index.ts");
const workspace = resolve(".metrics/editable-interchange");
await mkdir(workspace, { recursive: true });
const bytes = new Uint8Array(
  await readFile(
    resolve(
      process.argv.slice(2).find((arg) => !arg.startsWith("--")) ??
        ".metrics/engine-step-trial/radial-engine.step"
    )
  )
);
const resume = process.argv.includes("--resume-initial-native");
const report = {
  mode: resume ? "native-debug-resume" : "full-step-acceptance",
  source: {
    fileName: "radial-engine.step",
    byteLength: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex")
  },
  environment: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    cpu: cpus()[0]?.model,
    logicalCpuCount: cpus().length,
    physicalMemoryBytes: totalmem(),
    memorySampling:
      "Process memory observed at stage completion, not continuous peak measurement."
  },
  stages: [],
  status: "running",
  measurements: {}
};
const sessions = [];
const session = () => {
  const value = createCadSession();
  sessions.push(value);
  return value;
};
const main = session();
const save = () =>
  writeFile(
    resolve(workspace, "engine-evidence.json"),
    JSON.stringify(report, null, 2) + "\n"
  );
async function stage(name, work) {
  const start = performance.now();
  try {
    const value = await work();
    report.stages.push({
      name,
      milliseconds: Math.round((performance.now() - start) * 10) / 10,
      memoryBytes: process.memoryUsage()
    });
    await save();
    console.log(JSON.stringify(report.stages.at(-1)));
    return value;
  } catch (error) {
    report.stages.push({
      name,
      milliseconds: Math.round((performance.now() - start) * 10) / 10,
      memoryBytes: process.memoryUsage(),
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
const batch = async (s, ops) => {
  const result = await s.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops
  });
  assert.equal(result.ok, true, JSON.stringify(result.ok ? {} : result.error));
  return result;
};
let querySerial = 0;
async function query(s, value) {
  const result = await s.query({
    requestId: `interchange-${++querySerial}`,
    adapterVersion: "web-cad.agent-adapter.v1",
    query: { version: "cadops.v1", query: value }
  });
  assert.equal(result.ok, true, JSON.stringify(result.ok ? {} : result.error));
  return result;
}
const occurrences = (s) =>
  flattenAssemblyOccurrences(s.engine.createSnapshot().assemblies ?? []);
async function topology(s, bodyId) {
  const result = await query(s, { query: "body.topology", bodyId });
  const exact = result.topology.exactMetadata;
  assert.ok(
    exact?.topologySnapshot?.entities.length,
    `No exact topology for ${bodyId}`
  );
  return exact;
}
async function anchor(s, bodyId, entity, anchorId) {
  const identity = await query(s, { query: "body.topologyIdentity", bodyId });
  const candidate = identity.candidates.find(
    (c) => c.checkpointEntityId === entity.localId
  );
  assert.ok(
    candidate,
    `No public face reference for ${bodyId}/${entity.localId}`
  );
  const plan = await query(s, {
    query: "topology.anchorCreationPlan",
    bodyId,
    stableId: candidate.stableId,
    anchorId
  });
  assert.ok(
    plan.status === "ready" || plan.status === "alreadyExists",
    JSON.stringify(plan)
  );
  if (plan.ops.length) await batch(s, plan.ops);
  return plan;
}
function geometryTotals(s, exact) {
  const byBody = new Map(
    exact.derivedExactMetadata.map((entry) => [entry.bodyId, entry.metadata])
  );
  let solids = 0,
    volume = 0;
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity]
  };
  for (const occurrence of occurrences(s)) {
    const metadata = byBody.get(occurrence.bodyId);
    assert.ok(metadata, `No geometry for ${occurrence.bodyId}`);
    solids += metadata.topologySnapshot.entityCounts.solidCount;
    volume += metadata.volume;
    const matrix = assemblyTransformToMatrix(occurrence.transform);
    for (let corner = 0; corner < 8; corner++) {
      const p = [0, 1, 2].map(
        (axis) => metadata.bounds[corner & (1 << axis) ? "max" : "min"][axis]
      );
      for (let row = 0; row < 3; row++) {
        const value =
          matrix[row * 4] * p[0] +
          matrix[row * 4 + 1] * p[1] +
          matrix[row * 4 + 2] * p[2] +
          matrix[row * 4 + 3];
        bounds.min[row] = Math.min(bounds.min[row], value);
        bounds.max[row] = Math.max(bounds.max[row], value);
      }
    }
  }
  return {
    uniqueBodies: byBody.size,
    occurrences: occurrences(s).length,
    solids,
    volume,
    bounds
  };
}
const near = (value, expected, tolerance, label) =>
  assert.ok(
    Math.abs(value - expected) <= tolerance,
    `${label}: ${value} != ${expected}`
  );
try {
  const imported = resume
    ? await stage("debug reopen initial native source", async () => {
        await main.openWcad(
          new Uint8Array(
            await readFile(resolve(workspace, "engine-initial.wcad"))
          )
        );
        return {
          createdBodyIds: (
            await query(main, { query: "project.structure" })
          ).bodies.map((body) => body.id),
          warnings: [],
          diagnostics: []
        };
      })
    : await stage("cold STEP import through CadSession", () =>
        main.importFile({
          bytes,
          fileName: "radial-engine.step",
          format: "step"
        })
      );
  assert.equal(imported.createdBodyIds.length, 51);
  assert.equal(occurrences(main).length, 246);
  report.importWarnings = imported.warnings;
  report.importDiagnostics = imported.diagnostics;
  const originalEvidence = await stage("ready exact engine", () =>
    main.getCurrentExactEvidence()
  );
  const initial = geometryTotals(main, originalEvidence);
  assert.equal(initial.solids, 266);
  report.measurements.initial = initial;
  await stage("save imported native source", async () =>
    writeFile(
      resolve(workspace, "engine-initial.wcad"),
      await main.exportWcad()
    )
  );
  const structure = await query(main, { query: "project.structure" });
  const originalBody = structure.bodies.find(
    (body) => body.name === "04-Upper Rod Bush"
  );
  assert.ok(originalBody, "Engine upper rod bushing definition missing");
  const selected = occurrences(main).find(
    (item) => item.bodyId === originalBody.id
  );
  const sharedBefore = occurrences(main).filter(
    (item) => item.bodyId === originalBody.id
  ).length;
  assert.ok(sharedBefore > 1, "Expected a repeated bushing definition");
  const independent = await stage(
    "make one nested engine occurrence independent",
    () =>
      main.makeOccurrenceIndependent({
        rootAssemblyId: selected.rootAssemblyId,
        instancePath: selected.path
      })
  );
  assert.equal(
    occurrences(main).filter((item) => item.bodyId === originalBody.id).length,
    sharedBefore - 1
  );
  assert.equal(
    occurrences(main).filter((item) => item.bodyId === independent.bodyId)
      .length,
    1
  );
  const independentTopology = await topology(main, independent.bodyId);
  const bore = independentTopology.topologySnapshot.entities.find(
    (entity) =>
      entity.kind === "face" &&
      entity.surfaceClass === "cylinder" &&
      entity.orientation === "reversed"
  );
  assert.ok(bore, "Expected an analytic internal cylinder on the bushing");
  const boreAnchor = await anchor(
    main,
    independent.bodyId,
    bore,
    "engine_bore_face"
  );
  await stage("resize only the independent bore", () =>
    batch(main, [
      {
        op: "feature.faceOffset",
        id: "engine_bore_edit",
        bodyId: "engine_bore_body",
        targetBodyId: independent.bodyId,
        faceRef: {
          kind: "topologyAnchor",
          bodyId: independent.bodyId,
          anchorId: boreAnchor.anchorId
        },
        distance: -0.1,
        name: "Independent bushing bore"
      }
    ])
  );
  const resized = await topology(main, "engine_bore_body");
  const changedBore = resized.topologySnapshot.entities.find(
    (entity) =>
      entity.kind === "face" &&
      entity.surfaceClass === "cylinder" &&
      entity.orientation === "reversed"
  );
  near(changedBore.radius, bore.radius + 0.1, 1e-6, "Bore radius");
  assert.equal(
    occurrences(main).filter((item) => item.bodyId === originalBody.id).length,
    sharedBefore - 1
  );
  const unchanged = await topology(main, originalBody.id);
  near(
    unchanged.volume,
    independentTopology.volume,
    1e-6,
    "Original repeated part volume"
  );
  report.measurements.bore = {
    originalRadius: bore.radius,
    revisedRadius: changedBore.radius,
    originalVolume: independentTopology.volume,
    revisedVolume: resized.volume,
    unchangedSiblingOccurrences: sharedBefore - 1
  };
  const plane = resized.topologySnapshot.entities.find(
    (entity) =>
      entity.kind === "face" &&
      entity.surfaceClass === "plane" &&
      entity.planeFrame
  );
  assert.ok(plane, "Expected a real end-face sketch frame");
  const planeAnchor = await anchor(
    main,
    "engine_bore_body",
    plane,
    "engine_sketch_face"
  );
  const planeIdentity = await query(main, {
    query: "body.topologyIdentity",
    bodyId: "engine_bore_body",
    checkpointId: planeAnchor.checkpointId
  });
  const planeReadiness = await query(main, {
    query: "topology.anchorCommandReadiness",
    anchorId: planeAnchor.anchorId,
    snapshot: planeIdentity.snapshot,
    requiredOperation: "feature.attachSketchPlane"
  });
  assert.ok(
    planeReadiness.proof?.planeFrame,
    "Public face readiness did not provide the sketch frame"
  );
  const frame = planeReadiness.proof.planeFrame;
  const offset = changedBore.axisOrigin.map(
    (value, index) => value - frame.origin[index]
  );
  const dot = (a, b) =>
    a.reduce((sum, value, index) => sum + value * b[index], 0);
  const capEdges = new Set(plane.relationships.childEdgeLocalIds);
  const capRadii = resized.topologySnapshot.entities
    .filter(
      (entity) =>
        entity.kind === "edge" &&
        entity.curveClass === "circle" &&
        capEdges.has(entity.localId)
    )
    .map((entity) => entity.radius);
  assert.ok(capRadii.length >= 2, "Expected annular end-face boundary circles");
  const capInner = Math.min(...capRadii),
    capOuter = Math.max(...capRadii);
  const oilRadius = Math.min(0.15, (capOuter - capInner) / 4);
  assert.ok(oilRadius > 1e-4, "End face is too narrow for the oil port");
  const center = [
    dot(offset, frame.xDirection) + (capOuter + capInner) / 2,
    dot(offset, frame.yDirection)
  ];
  await stage("sketch and cut the imported end face", () =>
    batch(main, [
      {
        op: "sketch.createOnFace",
        id: "engine_cut_sketch",
        name: "Oil port",
        topologyAnchorId: planeAnchor.anchorId,
        topologyAnchorProof: planeReadiness.proof
      },
      {
        op: "sketch.addCircle",
        sketchId: "engine_cut_sketch",
        id: "oil_port",
        center,
        radius: oilRadius
      },
      {
        op: "feature.extrude",
        id: "engine_oil_port",
        bodyId: "engine_edited_body",
        name: "Oil port cut",
        targetBodyId: "engine_bore_body",
        sketchId: "engine_cut_sketch",
        entityId: "oil_port",
        operationMode: "cut",
        side: plane.orientation === "reversed" ? "positive" : "negative",
        depth: 0.5
      }
    ])
  );
  const cut = await topology(main, "engine_edited_body");
  near(
    resized.volume - cut.volume,
    Math.PI * oilRadius ** 2 * 0.5,
    1e-6,
    "Sketch cut removed volume"
  );
  const movedOccurrence = occurrences(main).find(
    (item) => item.bodyId === "engine_edited_body"
  );
  const owner = main.engine
    .createSnapshot()
    .assemblies.find((a) => a.id === movedOccurrence.assemblyId);
  const instance = owner.instances.find(
    (i) => i.id === movedOccurrence.instanceId
  );
  const beforeMoveBuilds = main.getSessionInfo().geometry.artifactBuilds;
  await stage("move the independent component", () =>
    batch(main, [
      {
        op: "assembly.instance.updateTransform",
        assemblyId: owner.id,
        instanceId: instance.id,
        transform: {
          ...instance.transform,
          translation: instance.transform.translation.map(
            (value, index) => value + (index === 0 ? 3 : 0)
          )
        }
      }
    ])
  );
  const changedEvidence = await main.getCurrentExactEvidence();
  assert.equal(
    main.getSessionInfo().geometry.artifactBuilds,
    beforeMoveBuilds,
    "Moving an instance must not rebuild geometry"
  );
  const expected = geometryTotals(main, changedEvidence);
  report.measurements.edited = expected;
  const native = await stage("save edited native", () => main.exportWcad());
  await writeFile(resolve(workspace, "engine-edited.wcad"), native);
  const reopened = session();
  await stage("open edited native in fresh session", () =>
    reopened.openWcad(native)
  );
  const reopenedEvidence = await stage("evaluate reopened native", () =>
    reopened.getCurrentExactEvidence()
  );
  const nativeTotals = geometryTotals(reopened, reopenedEvidence);
  near(nativeTotals.volume, expected.volume, 1e-4, "Native placed volume");
  assert.equal(nativeTotals.solids, 266);
  await stage("update existing native oil-port depth", () =>
    batch(reopened, [
      { op: "feature.updateExtrude", id: "engine_oil_port", depth: 0.75 }
    ])
  );
  const deeperCut = await topology(reopened, "engine_edited_body");
  near(
    cut.volume - deeperCut.volume,
    Math.PI * oilRadius ** 2 * 0.25,
    1e-6,
    "Native depth update removed volume"
  );
  await stage("undo native depth update", async () => {
    reopened.engine.undo();
    const undone = await topology(reopened, "engine_edited_body");
    near(undone.volume, cut.volume, 1e-6, "Undo restored oil-port depth");
  });
  await stage("redo native depth update", async () => {
    reopened.engine.redo();
    const redone = await topology(reopened, "engine_edited_body");
    near(
      redone.volume,
      deeperCut.volume,
      1e-6,
      "Redo restored revised oil-port depth"
    );
  });
  const stepExpected = geometryTotals(
    reopened,
    await reopened.getCurrentExactEvidence()
  );
  report.measurements.nativeParameterEdit = {
    featureId: "engine_oil_port",
    initialDepth: 0.5,
    revisedDepth: 0.75,
    removedVolume: cut.volume - deeperCut.volume,
    undoVerified: true,
    redoVerified: true,
    totals: stepExpected
  };
  const step = await stage("export edited engine STEP", () =>
    reopened.exportStep()
  );
  await writeFile(resolve(workspace, "engine-edited.step"), step.bytes);
  const roundtrip = session();
  await stage("reimport edited STEP in fresh session", () =>
    roundtrip.importFile({
      bytes: step.bytes,
      fileName: "engine-edited.step",
      format: "step"
    })
  );
  const roundtripEvidence = await stage("evaluate reimported STEP", () =>
    roundtrip.getCurrentExactEvidence()
  );
  const stepTotals = geometryTotals(roundtrip, roundtripEvidence);
  assert.equal(stepTotals.occurrences, 246);
  assert.equal(stepTotals.solids, 266);
  near(stepTotals.volume, stepExpected.volume, 1, "STEP placed volume");
  for (const side of ["min", "max"])
    for (let axis = 0; axis < 3; axis++)
      near(
        stepTotals.bounds[side][axis],
        stepExpected.bounds[side][axis],
        0.001,
        "STEP placed bounds"
      );
  report.measurements.native = nativeTotals;
  report.measurements.step = stepTotals;
  const roundtripStructure = await query(roundtrip, {
    query: "project.structure"
  });
  const changedPart = roundtripStructure.bodies.find(
    (body) => body.name === "Oil port cut"
  );
  assert.ok(changedPart, "Reimport lost the edited part name");
  const after = await topology(roundtrip, changedPart.id);
  const face = after.topologySnapshot.entities.find(
    (entity) =>
      entity.kind === "face" &&
      entity.surfaceClass === "cylinder" &&
      Math.abs(entity.radius - changedBore.radius) < 1e-6
  );
  assert.ok(face, "Reimport lost the edited bore");
  const afterAnchor = await anchor(
    roundtrip,
    changedPart.id,
    face,
    "reimported_bore_face"
  );
  await stage("edit reimported engine bore again", () =>
    batch(roundtrip, [
      {
        op: "feature.faceOffset",
        id: "reimported_edit",
        bodyId: "reimported_edited_body",
        targetBodyId: changedPart.id,
        faceRef: {
          kind: "topologyAnchor",
          bodyId: changedPart.id,
          anchorId: afterAnchor.anchorId
        },
        distance: -0.05
      }
    ])
  );
  const finalTopology = await topology(roundtrip, "reimported_edited_body");
  assert.ok(
    finalTopology.topologySnapshot.entities.some(
      (entity) =>
        entity.kind === "face" &&
        entity.surfaceClass === "cylinder" &&
        Math.abs(entity.radius - changedBore.radius - 0.05) < 1e-6
    )
  );
  const finalBore = finalTopology.topologySnapshot.entities.find(
    (entity) =>
      entity.kind === "face" &&
      entity.surfaceClass === "cylinder" &&
      entity.orientation === "reversed" &&
      Math.abs(entity.radius - changedBore.radius - 0.05) < 1e-6
  );
  assert.ok(
    finalBore?.axisOrigin,
    "The second bore edit lost its analytic axis"
  );
  const finalPlane = finalTopology.topologySnapshot.entities
    .filter(
      (entity) =>
        entity.kind === "face" &&
        entity.surfaceClass === "plane" &&
        entity.planeFrame
    )
    .sort((a, b) => {
      const distance = (entity) =>
        Math.abs(
          dot(
            entity.planeFrame.origin.map(
              (value, index) => value - frame.origin[index]
            ),
            frame.normal
          )
        );
      return distance(a) - distance(b);
    })[0];
  assert.ok(finalPlane, "Reimported body has no end face for a second sketch");
  const finalPlaneAnchor = await anchor(
    roundtrip,
    "reimported_edited_body",
    finalPlane,
    "reimported_sketch_face"
  );
  const finalIdentity = await query(roundtrip, {
    query: "body.topologyIdentity",
    bodyId: "reimported_edited_body",
    checkpointId: finalPlaneAnchor.checkpointId
  });
  const finalReadiness = await query(roundtrip, {
    query: "topology.anchorCommandReadiness",
    anchorId: finalPlaneAnchor.anchorId,
    snapshot: finalIdentity.snapshot,
    requiredOperation: "feature.attachSketchPlane"
  });
  assert.ok(
    finalReadiness.proof?.planeFrame,
    "Reimported face did not provide a public sketch frame"
  );
  const finalFrame = finalReadiness.proof.planeFrame;
  const finalCapEdges = new Set(finalPlane.relationships.childEdgeLocalIds);
  const finalCapRadii = finalTopology.topologySnapshot.entities
    .filter(
      (entity) =>
        entity.kind === "edge" &&
        entity.curveClass === "circle" &&
        finalCapEdges.has(entity.localId) &&
        entity.radius > finalBore.radius * 0.5
    )
    .map((entity) => entity.radius);
  assert.ok(
    finalCapRadii.length >= 2,
    "Reimported end face lost its annular boundaries"
  );
  const finalInner = Math.min(...finalCapRadii),
    finalOuter = Math.max(...finalCapRadii);
  const secondOilRadius = Math.min(0.15, (finalOuter - finalInner) / 4);
  const secondRadialDistance = (finalOuter + finalInner) / 2;
  const secondOffset = finalBore.axisOrigin.map(
    (value, index) => value - finalFrame.origin[index]
  );
  // Reflect the first port's radial direction in model space, independent of STEP's face-frame orientation.
  const secondCenter = [finalFrame.xDirection, finalFrame.yDirection].map(
    (direction) =>
      dot(secondOffset, direction) -
      secondRadialDistance * dot(frame.xDirection, direction)
  );
  await stage("sketch and cut the reimported engine again", () =>
    batch(roundtrip, [
      {
        op: "sketch.createOnFace",
        id: "reimported_cut_sketch",
        name: "Second oil port",
        topologyAnchorId: finalPlaneAnchor.anchorId,
        topologyAnchorProof: finalReadiness.proof
      },
      {
        op: "sketch.addCircle",
        sketchId: "reimported_cut_sketch",
        id: "second_oil_port",
        center: secondCenter,
        radius: secondOilRadius
      },
      {
        op: "feature.extrude",
        id: "reimported_oil_port",
        bodyId: "reimported_final_body",
        name: "Second oil port cut",
        targetBodyId: "reimported_edited_body",
        sketchId: "reimported_cut_sketch",
        entityId: "second_oil_port",
        operationMode: "cut",
        side: finalPlane.orientation === "reversed" ? "positive" : "negative",
        depth: 0.25
      }
    ])
  );
  const finalCut = await topology(roundtrip, "reimported_final_body");
  near(
    finalTopology.volume - finalCut.volume,
    Math.PI * secondOilRadius ** 2 * 0.25,
    1e-6,
    "Reimported sketch cut removed volume"
  );
  const finalTotals = geometryTotals(
    roundtrip,
    await roundtrip.getCurrentExactEvidence()
  );
  assert.equal(finalTotals.solids, 266);
  assert.equal(finalTotals.occurrences, 246);
  assert.equal(finalTotals.uniqueBodies, 52);
  report.measurements.secondEdit = {
    boreRadius: finalBore.radius,
    oilPortRadius: secondOilRadius,
    oilPortDepth: 0.25,
    removedVolume: finalTopology.volume - finalCut.volume,
    totals: finalTotals
  };
  report.status = "passed";
  report.memoryBytesAtCompletion = process.memoryUsage();
  report.canonicalEvidenceCacheBudget = {
    maximumEstimatedBytes: 128 * 1024 * 1024,
    maximumEntries: 256,
    accounting:
      "Owned BRep bytes plus twice the JSON character count of retained metadata/topology; an estimated serialized size, not an exact heap limit."
  };
  report.cache = main.getSessionInfo();
  await save();
  await mkdir("examples/editable-interchange", { recursive: true });
  if (!resume)
    await writeFile(
      "examples/editable-interchange/engine-evidence.json",
      JSON.stringify(report, null, 2) + "\n"
    );
  console.log(
    JSON.stringify({
      status: report.status,
      workspace,
      stages: report.stages.length
    })
  );
} catch (error) {
  report.status = "failed";
  report.failure = error instanceof Error ? error.stack : String(error);
  await save();
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  for (const value of sessions) value.dispose();
}

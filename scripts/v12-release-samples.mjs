import { V11_RELEASE_BOUNDARY_LEAK_PATTERN } from "./v11-release-samples.mjs";

export const V12_RELEASE_BOUNDARY_LEAK_PATTERN =
  /rendererId|renderId|meshId|occtId|occtShape|cacheKey|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|fileHandle|fileSystemHandle|opfsPath|localPath|absolutePath|gpuBufferId|pixelId|viewportState|topologyIndex/i;

export async function runV12ReleaseSampleSmoke(cadCore) {
  const samples = [
    await evaluateRectangleCutReferenceChain(cadCore),
    await evaluateRectangleAddReferenceChain(cadCore),
    await evaluateCircleToolBooleanReferenceChain(cadCore)
  ];
  const failedCount = samples.filter(
    (sample) => sample.status === "fail"
  ).length;
  const result = {
    ok: failedCount === 0,
    sampleCount: samples.length,
    passedCount: samples.length - failedCount,
    failedCount,
    topologyCheckCount: samples.reduce(
      (sum, sample) => sum + sample.topologyCheckCount,
      0
    ),
    referenceCheckCount: samples.reduce(
      (sum, sample) => sum + sample.referenceCheckCount,
      0
    ),
    measurementCheckCount: samples.reduce(
      (sum, sample) => sum + sample.measurementCheckCount,
      0
    ),
    roundTripCheckCount: samples.reduce(
      (sum, sample) => sum + sample.roundTripCheckCount,
      0
    ),
    samples
  };
  const boundaryFailures = [];

  checkNoBoundaryLeaks(
    boundaryFailures,
    "V12 release smoke result",
    JSON.stringify(result)
  );

  if (boundaryFailures.length > 0) {
    return { ...result, ok: false, boundaryFailures };
  }

  return result;
}

export function formatV12ReleaseSampleSmokeSummary(result) {
  const lines = [
    `V12 release boolean topology smoke ${result.ok ? "passed" : "failed"}`,
    `samples: ${result.passedCount} passed, ${result.failedCount} failed, ${result.sampleCount} total`,
    `checks: ${result.topologyCheckCount} topology, ${result.referenceCheckCount} reference, ${result.measurementCheckCount} measurement, ${result.roundTripCheckCount} round-trip`
  ];

  for (const sample of result.samples) {
    lines.push(
      `- ${sample.status} ${sample.id} | topology ${sample.topologyCheckCount} | reference ${sample.referenceCheckCount} | measurement ${sample.measurementCheckCount} | round-trips ${sample.roundTripCheckCount}`
    );

    for (const failure of sample.failures) {
      lines.push(`  - ${failure}`);
    }
  }

  for (const failure of result.boundaryFailures ?? []) {
    lines.push(`- boundary-fail ${failure}`);
  }

  return lines.join("\n");
}

async function evaluateRectangleCutReferenceChain(cadCore) {
  const failures = [];
  const engine = new cadCore.CadEngine();
  let topologyCheckCount = 0;
  let referenceCheckCount = 0;
  let measurementCheckCount = 0;
  let roundTripCheckCount = 0;

  const seed = engine.executeBatch(createRectangleCutSeedBatch());
  checkEqual(failures, "rectangle.seed.ok", true, seed.ok);
  checkIncludes(
    failures,
    "rectangle.seed.createdSketchIds",
    seed.createdSketchIds ?? [],
    "v12_cut_sketch"
  );
  checkIncludes(
    failures,
    "rectangle.seed.createdFeatureIds",
    seed.createdFeatureIds ?? [],
    "v12_feat_cut"
  );

  topologyCheckCount += verifyBooleanTopology(engine, failures);
  referenceCheckCount += verifyGeneratedReferences(engine, failures);
  measurementCheckCount += verifyMeasurements(engine, failures);
  referenceCheckCount += verifySelectionAndNaming(engine, failures);
  referenceCheckCount += verifyEditReferenceEffects(engine, failures);
  referenceCheckCount += verifySketchProfileEditReferenceEffects(
    engine,
    failures
  );
  referenceCheckCount += verifySketchConstraintCreateReferenceEffects(
    engine,
    failures
  );
  referenceCheckCount += verifyCutReferenceRepair(engine, failures);
  referenceCheckCount += verifyCutQueryAlignment(engine, failures);
  roundTripCheckCount += await verifySourceRoundTrip({
    cadCore,
    engine,
    failures,
    label: "rectangleCut"
  });

  return createSampleResult({
    id: "v12-rectangle-cut-reference-chain",
    failures,
    topologyCheckCount,
    referenceCheckCount,
    measurementCheckCount,
    roundTripCheckCount
  });
}

async function evaluateRectangleAddReferenceChain(cadCore) {
  const failures = [];
  const engine = new cadCore.CadEngine();
  let topologyCheckCount = 0;
  let referenceCheckCount = 0;
  let measurementCheckCount = 0;
  let roundTripCheckCount = 0;

  const seed = engine.executeBatch(createRectangleAddSeedBatch());
  checkEqual(failures, "add.seed.ok", true, seed.ok);
  checkIncludes(
    failures,
    "add.seed.createdSketchIds",
    seed.createdSketchIds ?? [],
    "v12_add_sketch"
  );
  checkIncludes(
    failures,
    "add.seed.createdFeatureIds",
    seed.createdFeatureIds ?? [],
    "v12_feat_add"
  );

  topologyCheckCount += verifyAddBooleanTopology(engine, failures);
  referenceCheckCount += verifyAddGeneratedReferences(engine, failures);
  measurementCheckCount += verifyAddMeasurements(engine, failures);
  referenceCheckCount += verifyAddSelectionAndNaming(engine, failures);
  referenceCheckCount += verifyAddEditReferenceEffects(engine, failures);
  referenceCheckCount += verifyAddDimensionEditReferenceEffects(
    engine,
    failures
  );
  referenceCheckCount += verifyAddDimensionCreateReferenceEffects(
    engine,
    failures
  );
  referenceCheckCount += verifyAddReferenceRepair(engine, failures);
  referenceCheckCount += verifyAddQueryAlignment(engine, failures);
  roundTripCheckCount += await verifySourceRoundTrip({
    cadCore,
    engine,
    failures,
    label: "rectangleAdd"
  });

  return createSampleResult({
    id: "v12-rectangle-add-reference-chain",
    failures,
    topologyCheckCount,
    referenceCheckCount,
    measurementCheckCount,
    roundTripCheckCount
  });
}

async function evaluateCircleToolBooleanReferenceChain(cadCore) {
  const failures = [];
  const engine = new cadCore.CadEngine();
  let topologyCheckCount = 0;
  let referenceCheckCount = 0;
  let measurementCheckCount = 0;
  let roundTripCheckCount = 0;

  const seed = engine.executeBatch(createCircleToolBooleanSeedBatch());
  checkEqual(failures, "circle.seed.ok", true, seed.ok);
  checkIncludes(
    failures,
    "circle.seed.createdFeatureIds",
    seed.createdFeatureIds ?? [],
    "v12_feat_circle_cut"
  );
  checkIncludes(
    failures,
    "circle.seed.createdFeatureIds",
    seed.createdFeatureIds ?? [],
    "v12_feat_circle_add"
  );

  topologyCheckCount += verifyCircleToolBooleanTopology(engine, failures);
  referenceCheckCount += verifyCircleToolGeneratedReferences(engine, failures);
  measurementCheckCount += verifyCircleToolMeasurements(engine, failures);
  referenceCheckCount += verifyCircleToolSelectionAndNaming(engine, failures);
  referenceCheckCount += verifyCircleToolQueryAlignment(engine, failures);
  roundTripCheckCount += await verifySourceRoundTrip({
    cadCore,
    engine,
    failures,
    label: "circleToolBoolean"
  });

  return createSampleResult({
    id: "v12-circle-tool-boolean-reference-chain",
    failures,
    topologyCheckCount,
    referenceCheckCount,
    measurementCheckCount,
    roundTripCheckCount
  });
}

function createRectangleCutSeedBatch() {
  return {
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "sketch.create",
        id: "v12_target_sketch",
        name: "V12 target sketch",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v12_target_sketch",
        id: "v12_target_rect",
        center: [0, 0],
        width: 4,
        height: 4
      },
      {
        op: "feature.extrude",
        id: "v12_feat_target",
        bodyId: "v12_body_target",
        sketchId: "v12_target_sketch",
        entityId: "v12_target_rect",
        depth: 3,
        operationMode: "newBody"
      },
      {
        op: "sketch.createOnFace",
        id: "v12_cut_sketch",
        name: "V12 cut sketch",
        bodyId: "v12_body_target",
        faceStableId: "generated:face:v12_body_target:endCap"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v12_cut_sketch",
        id: "v12_tool_rect",
        center: [0, 0],
        width: 1,
        height: 1
      },
      {
        op: "feature.extrude",
        id: "v12_feat_cut",
        bodyId: "v12_body_cut",
        sketchId: "v12_cut_sketch",
        entityId: "v12_tool_rect",
        depth: 1.5,
        side: "negative",
        operationMode: "cut",
        targetBodyId: "v12_body_target"
      }
    ]
  };
}

function createRectangleAddSeedBatch() {
  return {
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "sketch.create",
        id: "v12_add_target_sketch",
        name: "V12 add target sketch",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v12_add_target_sketch",
        id: "v12_add_target_rect",
        center: [0, 0],
        width: 4,
        height: 4
      },
      {
        op: "sketch.dimension.create",
        id: "v12_add_target_width",
        name: "V12 add target width",
        sketchId: "v12_add_target_sketch",
        entityId: "v12_add_target_rect",
        target: { entityKind: "rectangle", role: "width" },
        value: 4
      },
      {
        op: "feature.extrude",
        id: "v12_feat_add_target",
        bodyId: "v12_body_add_target",
        sketchId: "v12_add_target_sketch",
        entityId: "v12_add_target_rect",
        depth: 3,
        operationMode: "newBody"
      },
      {
        op: "sketch.createOnFace",
        id: "v12_add_sketch",
        name: "V12 add sketch",
        bodyId: "v12_body_add_target",
        faceStableId: "generated:face:v12_body_add_target:endCap"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v12_add_sketch",
        id: "v12_add_tool_rect",
        center: [0, 0],
        width: 1,
        height: 1
      },
      {
        op: "feature.extrude",
        id: "v12_feat_add",
        bodyId: "v12_body_add",
        sketchId: "v12_add_sketch",
        entityId: "v12_add_tool_rect",
        depth: 2,
        operationMode: "add",
        targetBodyId: "v12_body_add_target"
      }
    ]
  };
}

function createCircleToolBooleanSeedBatch() {
  return {
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "sketch.create",
        id: "v12_circle_cut_target_sketch",
        name: "V12 circle cut target sketch",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v12_circle_cut_target_sketch",
        id: "v12_circle_cut_target_rect",
        center: [0, 0],
        width: 4,
        height: 4
      },
      {
        op: "feature.extrude",
        id: "v12_feat_circle_cut_target",
        bodyId: "v12_body_circle_cut_target",
        sketchId: "v12_circle_cut_target_sketch",
        entityId: "v12_circle_cut_target_rect",
        depth: 3,
        operationMode: "newBody"
      },
      {
        op: "sketch.createOnFace",
        id: "v12_circle_cut_sketch",
        name: "V12 circle cut sketch",
        bodyId: "v12_body_circle_cut_target",
        faceStableId: "generated:face:v12_body_circle_cut_target:endCap"
      },
      {
        op: "sketch.addCircle",
        sketchId: "v12_circle_cut_sketch",
        id: "v12_circle_cut_tool",
        center: [0, 0],
        radius: 1
      },
      {
        op: "feature.extrude",
        id: "v12_feat_circle_cut",
        bodyId: "v12_body_circle_cut",
        sketchId: "v12_circle_cut_sketch",
        entityId: "v12_circle_cut_tool",
        depth: 2,
        side: "negative",
        operationMode: "cut",
        targetBodyId: "v12_body_circle_cut_target"
      },
      {
        op: "sketch.create",
        id: "v12_circle_add_target_sketch",
        name: "V12 circle add target sketch",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v12_circle_add_target_sketch",
        id: "v12_circle_add_target_rect",
        center: [6, 0],
        width: 4,
        height: 4
      },
      {
        op: "feature.extrude",
        id: "v12_feat_circle_add_target",
        bodyId: "v12_body_circle_add_target",
        sketchId: "v12_circle_add_target_sketch",
        entityId: "v12_circle_add_target_rect",
        depth: 3,
        operationMode: "newBody"
      },
      {
        op: "sketch.createOnFace",
        id: "v12_circle_add_sketch",
        name: "V12 circle add sketch",
        bodyId: "v12_body_circle_add_target",
        faceStableId: "generated:face:v12_body_circle_add_target:endCap"
      },
      {
        op: "sketch.addCircle",
        sketchId: "v12_circle_add_sketch",
        id: "v12_circle_add_tool",
        center: [0, 0],
        radius: 1
      },
      {
        op: "feature.extrude",
        id: "v12_feat_circle_add",
        bodyId: "v12_body_circle_add",
        sketchId: "v12_circle_add_sketch",
        entityId: "v12_circle_add_tool",
        depth: 2,
        operationMode: "add",
        targetBodyId: "v12_body_circle_add_target"
      }
    ]
  };
}

function verifyBooleanTopology(engine, failures) {
  const topology = executeQuery(engine, {
    query: "body.topology",
    bodyId: "v12_body_cut"
  });
  let checks = 0;

  checkEqual(failures, "topology.ok", true, topology.ok);
  checks += 1;

  if (!topology.ok) {
    return checks;
  }

  const booleanTopology = topology.topology.booleanTopology;
  checkEqual(
    failures,
    "topology.boolean.status",
    "partial",
    booleanTopology?.status
  );
  checkEqual(
    failures,
    "topology.boolean.commandReady",
    false,
    booleanTopology?.commandReady
  );
  checks += 2;

  const faceRoles =
    booleanTopology?.roleReadiness.filter(
      (role) => role.role === "cutWallFace" && role.commandReady
    ) ?? [];
  const edgeRoles =
    booleanTopology?.roleReadiness.filter(
      (role) => role.role === "cutWallProfileEdge" && role.commandReady
    ) ?? [];

  checkEqual(failures, "topology.cutWallFace.count", 4, faceRoles.length);
  checkEqual(
    failures,
    "topology.cutWallProfileEdge.count",
    4,
    edgeRoles.length
  );
  checkIncludes(
    failures,
    "topology.edge.stableIds",
    edgeRoles.map((role) => role.roleStableId),
    "generated:edge:v12_body_cut:longitudinal:uMin:vMin"
  );
  checks += 3;

  return checks;
}

function verifyAddBooleanTopology(engine, failures) {
  const topology = executeQuery(engine, {
    query: "body.topology",
    bodyId: "v12_body_add"
  });
  let checks = 0;

  checkEqual(failures, "add.topology.ok", true, topology.ok);
  checks += 1;

  if (!topology.ok) {
    return checks;
  }

  const booleanTopology = topology.topology.booleanTopology;
  checkEqual(
    failures,
    "add.topology.boolean.status",
    "partial",
    booleanTopology?.status
  );
  checkEqual(
    failures,
    "add.topology.boolean.commandReady",
    false,
    booleanTopology?.commandReady
  );
  checks += 2;

  const wallRoles =
    booleanTopology?.roleReadiness.filter(
      (role) => role.role === "addedWallFace" && role.commandReady
    ) ?? [];
  const capRoles =
    booleanTopology?.roleReadiness.filter(
      (role) => role.role === "addedCapFace" && role.commandReady
    ) ?? [];

  checkEqual(failures, "add.topology.addedWallFace.count", 4, wallRoles.length);
  checkEqual(failures, "add.topology.addedCapFace.count", 1, capRoles.length);
  checkIncludes(
    failures,
    "add.topology.cap.stableIds",
    capRoles.map((role) => role.roleStableId),
    "generated:face:v12_body_add:endCap"
  );
  checks += 3;

  return checks;
}

function verifyCircleToolBooleanTopology(engine, failures) {
  const cutTopology = executeQuery(engine, {
    query: "body.topology",
    bodyId: "v12_body_circle_cut"
  });
  const addTopology = executeQuery(engine, {
    query: "body.topology",
    bodyId: "v12_body_circle_add"
  });
  let checks = 0;

  checkEqual(failures, "circle.topology.cut.ok", true, cutTopology.ok);
  checkEqual(failures, "circle.topology.add.ok", true, addTopology.ok);
  checks += 2;

  if (cutTopology.ok) {
    const roles = cutTopology.topology.booleanTopology?.roleReadiness ?? [];
    checkSome(
      failures,
      "circle.topology.cut.wall",
      roles,
      (role) =>
        role.role === "cutWallFace" &&
        role.commandReady === true &&
        role.roleStableId === "generated:face:v12_body_circle_cut:side:circular"
    );
    checkSome(
      failures,
      "circle.topology.cut.startRim",
      roles,
      (role) =>
        role.role === "cutStartRimEdge" &&
        role.commandReady === true &&
        role.roleStableId ===
          "generated:edge:v12_body_circle_cut:start:circular"
    );
    checkSome(
      failures,
      "circle.topology.cut.terminalRim",
      roles,
      (role) =>
        role.role === "cutTerminalRimEdge" &&
        role.commandReady === true &&
        role.roleStableId === "generated:edge:v12_body_circle_cut:end:circular"
    );
    checks += 3;
  }

  if (addTopology.ok) {
    const roles = addTopology.topology.booleanTopology?.roleReadiness ?? [];
    checkSome(
      failures,
      "circle.topology.add.wall",
      roles,
      (role) =>
        role.role === "addedWallFace" &&
        role.commandReady === true &&
        role.roleStableId === "generated:face:v12_body_circle_add:side:circular"
    );
    checkSome(
      failures,
      "circle.topology.add.cap",
      roles,
      (role) =>
        role.role === "addedCapFace" &&
        role.commandReady === true &&
        role.roleStableId === "generated:face:v12_body_circle_add:endCap"
    );
    checkSome(
      failures,
      "circle.topology.add.edge",
      roles,
      (role) =>
        role.role === "addProfileEdge" &&
        role.commandReady === true &&
        role.roleStableId === "generated:edge:v12_body_circle_add:end:circular"
    );
    checks += 3;
  }

  return checks;
}

function verifyGeneratedReferences(engine, failures) {
  const faceStableId = "generated:face:v12_body_cut:side:uMin";
  const edgeStableId = "generated:edge:v12_body_cut:longitudinal:uMin:vMin";
  const references = executeQuery(engine, {
    query: "body.generatedReferences",
    bodyId: "v12_body_cut"
  });
  let checks = 0;

  checkEqual(failures, "references.ok", true, references.ok);
  checks += 1;

  if (!references.ok) {
    return checks;
  }

  checkEqual(failures, "references.faceCount", 4, references.faceCount);
  checkEqual(failures, "references.edgeCount", 4, references.edgeCount);
  checkIncludes(
    failures,
    "references.faces",
    references.faces.map((reference) => reference.stableId),
    faceStableId
  );
  checkIncludes(
    failures,
    "references.edges",
    references.edges.map((reference) => reference.stableId),
    edgeStableId
  );
  checks += 4;

  const faceResolution = executeQuery(engine, {
    query: "body.resolveGeneratedReference",
    bodyId: "v12_body_cut",
    stableId: faceStableId
  });
  const edgeResolution = executeQuery(engine, {
    query: "body.resolveGeneratedReference",
    bodyId: "v12_body_cut",
    stableId: edgeStableId
  });

  checkEqual(failures, "references.face.resolve", true, faceResolution.ok);
  checkEqual(failures, "references.edge.resolve", true, edgeResolution.ok);
  checks += 2;

  return checks;
}

function verifyAddGeneratedReferences(engine, failures) {
  const wallStableId = "generated:face:v12_body_add:side:uMin";
  const capStableId = "generated:face:v12_body_add:endCap";
  const references = executeQuery(engine, {
    query: "body.generatedReferences",
    bodyId: "v12_body_add"
  });
  let checks = 0;

  checkEqual(failures, "add.references.ok", true, references.ok);
  checks += 1;

  if (!references.ok) {
    return checks;
  }

  checkEqual(failures, "add.references.faceCount", 5, references.faceCount);
  checkEqual(failures, "add.references.edgeCount", 4, references.edgeCount);
  checkIncludes(
    failures,
    "add.references.faces",
    references.faces.map((reference) => reference.stableId),
    wallStableId
  );
  checkIncludes(
    failures,
    "add.references.faces",
    references.faces.map((reference) => reference.stableId),
    capStableId
  );
  checkIncludes(
    failures,
    "add.references.edges",
    references.edges.map((reference) => reference.stableId),
    "generated:edge:v12_body_add:end:uMin"
  );
  checks += 5;

  const wallResolution = executeQuery(engine, {
    query: "body.resolveGeneratedReference",
    bodyId: "v12_body_add",
    stableId: wallStableId
  });
  const capResolution = executeQuery(engine, {
    query: "body.resolveGeneratedReference",
    bodyId: "v12_body_add",
    stableId: capStableId
  });

  checkEqual(failures, "add.references.wall.resolve", true, wallResolution.ok);
  checkEqual(failures, "add.references.cap.resolve", true, capResolution.ok);
  checks += 2;

  return checks;
}

function verifyCircleToolGeneratedReferences(engine, failures) {
  const cutReferences = executeQuery(engine, {
    query: "body.generatedReferences",
    bodyId: "v12_body_circle_cut"
  });
  const addReferences = executeQuery(engine, {
    query: "body.generatedReferences",
    bodyId: "v12_body_circle_add"
  });
  let checks = 0;

  checkEqual(failures, "circle.references.cut.ok", true, cutReferences.ok);
  checkEqual(failures, "circle.references.add.ok", true, addReferences.ok);
  checks += 2;

  if (cutReferences.ok) {
    checkEqual(
      failures,
      "circle.references.cut.faceCount",
      1,
      cutReferences.faceCount
    );
    checkEqual(
      failures,
      "circle.references.cut.edgeCount",
      2,
      cutReferences.edgeCount
    );
    checkIncludes(
      failures,
      "circle.references.cut.faces",
      cutReferences.faces.map((reference) => reference.stableId),
      "generated:face:v12_body_circle_cut:side:circular"
    );
    checkIncludes(
      failures,
      "circle.references.cut.edges",
      cutReferences.edges.map((reference) => reference.stableId),
      "generated:edge:v12_body_circle_cut:end:circular"
    );
    checks += 4;
  }

  if (addReferences.ok) {
    checkEqual(
      failures,
      "circle.references.add.faceCount",
      2,
      addReferences.faceCount
    );
    checkEqual(
      failures,
      "circle.references.add.edgeCount",
      1,
      addReferences.edgeCount
    );
    checkIncludes(
      failures,
      "circle.references.add.faces",
      addReferences.faces.map((reference) => reference.stableId),
      "generated:face:v12_body_circle_add:endCap"
    );
    checkIncludes(
      failures,
      "circle.references.add.edges",
      addReferences.edges.map((reference) => reference.stableId),
      "generated:edge:v12_body_circle_add:end:circular"
    );
    checks += 4;
  }

  return checks;
}

function verifyMeasurements(engine, failures) {
  const faceMeasurement = executeQuery(engine, {
    query: "body.generatedReferenceMeasurements",
    bodyId: "v12_body_cut",
    stableId: "generated:face:v12_body_cut:side:uMin"
  });
  const edgeMeasurement = executeQuery(engine, {
    query: "body.generatedReferenceMeasurements",
    bodyId: "v12_body_cut",
    stableId: "generated:edge:v12_body_cut:longitudinal:uMin:vMin"
  });
  let checks = 0;

  checkEqual(failures, "measure.face.ok", true, faceMeasurement.ok);
  checkEqual(failures, "measure.edge.ok", true, edgeMeasurement.ok);
  checks += 2;

  if (faceMeasurement.ok) {
    checkEqual(
      failures,
      "measure.face.kind",
      "face",
      faceMeasurement.measurements.kind
    );
    checkEqual(
      failures,
      "measure.face.area",
      1.5,
      faceMeasurement.measurements.area
    );
    checks += 2;
  }

  if (edgeMeasurement.ok) {
    checkEqual(
      failures,
      "measure.edge.kind",
      "edge",
      edgeMeasurement.measurements.kind
    );
    checkEqual(
      failures,
      "measure.edge.length",
      1.5,
      edgeMeasurement.measurements.length
    );
    checks += 2;
  }

  return checks;
}

function verifyAddMeasurements(engine, failures) {
  const wallMeasurement = executeQuery(engine, {
    query: "body.generatedReferenceMeasurements",
    bodyId: "v12_body_add",
    stableId: "generated:face:v12_body_add:side:uMin"
  });
  const capMeasurement = executeQuery(engine, {
    query: "body.generatedReferenceMeasurements",
    bodyId: "v12_body_add",
    stableId: "generated:face:v12_body_add:endCap"
  });
  const edgeMeasurement = executeQuery(engine, {
    query: "body.generatedReferenceMeasurements",
    bodyId: "v12_body_add",
    stableId: "generated:edge:v12_body_add:end:uMin"
  });
  let checks = 0;

  checkEqual(failures, "add.measure.wall.ok", true, wallMeasurement.ok);
  checkEqual(failures, "add.measure.cap.ok", true, capMeasurement.ok);
  checkEqual(failures, "add.measure.edge.ok", true, edgeMeasurement.ok);
  checks += 3;

  if (wallMeasurement.ok) {
    checkEqual(
      failures,
      "add.measure.wall.kind",
      "face",
      wallMeasurement.measurements.kind
    );
    checkEqual(
      failures,
      "add.measure.wall.area",
      2,
      wallMeasurement.measurements.area
    );
    checks += 2;
  }

  if (capMeasurement.ok) {
    checkEqual(
      failures,
      "add.measure.cap.kind",
      "face",
      capMeasurement.measurements.kind
    );
    checkEqual(
      failures,
      "add.measure.cap.area",
      1,
      capMeasurement.measurements.area
    );
    checks += 2;
  }

  if (edgeMeasurement.ok) {
    checkEqual(
      failures,
      "add.measure.edge.kind",
      "edge",
      edgeMeasurement.measurements.kind
    );
    checkEqual(
      failures,
      "add.measure.edge.length",
      1,
      edgeMeasurement.measurements.length
    );
    checks += 2;
  }

  return checks;
}

function verifyCircleToolMeasurements(engine, failures) {
  const cutWallMeasurement = executeQuery(engine, {
    query: "body.generatedReferenceMeasurements",
    bodyId: "v12_body_circle_cut",
    stableId: "generated:face:v12_body_circle_cut:side:circular"
  });
  const cutRimMeasurement = executeQuery(engine, {
    query: "body.generatedReferenceMeasurements",
    bodyId: "v12_body_circle_cut",
    stableId: "generated:edge:v12_body_circle_cut:end:circular"
  });
  const addEdgeMeasurement = executeQuery(engine, {
    query: "body.generatedReferenceMeasurements",
    bodyId: "v12_body_circle_add",
    stableId: "generated:edge:v12_body_circle_add:end:circular"
  });
  let checks = 0;

  checkEqual(
    failures,
    "circle.measure.cutWall.ok",
    true,
    cutWallMeasurement.ok
  );
  checkEqual(failures, "circle.measure.cutRim.ok", true, cutRimMeasurement.ok);
  checkEqual(
    failures,
    "circle.measure.addEdge.ok",
    true,
    addEdgeMeasurement.ok
  );
  checks += 3;

  if (cutWallMeasurement.ok) {
    checkEqual(
      failures,
      "circle.measure.cutWall.kind",
      "face",
      cutWallMeasurement.measurements.kind
    );
    checkEqual(
      failures,
      "circle.measure.cutWall.surface",
      "cylinder",
      cutWallMeasurement.measurements.surfaceType
    );
    checks += 2;
  }

  if (cutRimMeasurement.ok) {
    checkEqual(
      failures,
      "circle.measure.cutRim.kind",
      "edge",
      cutRimMeasurement.measurements.kind
    );
    checkEqual(
      failures,
      "circle.measure.cutRim.curve",
      "circle",
      cutRimMeasurement.measurements.curveType
    );
    checks += 2;
  }

  if (addEdgeMeasurement.ok) {
    checkEqual(
      failures,
      "circle.measure.addEdge.kind",
      "edge",
      addEdgeMeasurement.measurements.kind
    );
    checkEqual(
      failures,
      "circle.measure.addEdge.curve",
      "circle",
      addEdgeMeasurement.measurements.curveType
    );
    checks += 2;
  }

  return checks;
}

function verifySelectionAndNaming(engine, failures) {
  const faceStableId = "generated:face:v12_body_cut:side:uMin";
  const edgeStableId = "generated:edge:v12_body_cut:longitudinal:uMin:vMin";
  const faceSelection = executeQuery(engine, {
    query: "selection.referenceCandidates",
    selection: {
      type: "generatedReference",
      bodyId: "v12_body_cut",
      stableId: faceStableId,
      expectedKind: "face"
    },
    requiredOperation: "feature.attachSketchPlane"
  });
  const edgeSelection = executeQuery(engine, {
    query: "selection.referenceCandidates",
    selection: {
      type: "generatedReference",
      bodyId: "v12_body_cut",
      stableId: edgeStableId,
      expectedKind: "edge"
    },
    requiredOperation: "feature.measureReference"
  });
  const chamferSelection = executeQuery(engine, {
    query: "selection.referenceCandidates",
    selection: {
      type: "generatedReference",
      bodyId: "v12_body_cut",
      stableId: edgeStableId,
      expectedKind: "edge"
    },
    requiredOperation: "feature.chamfer"
  });
  let checks = 0;

  checkEqual(
    failures,
    "selection.face.status",
    "resolved",
    faceSelection.status
  );
  checkEqual(
    failures,
    "selection.edge.status",
    "resolved",
    edgeSelection.status
  );
  checkEqual(
    failures,
    "selection.chamfer.status",
    "resolved",
    chamferSelection.status
  );
  checks += 3;

  const nameAndSketch = engine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "reference.nameGenerated",
        name: "v12_cut_wall_face",
        bodyId: "v12_body_cut",
        stableId: faceStableId
      },
      {
        op: "reference.nameGenerated",
        name: "v12_cut_wall_edge",
        bodyId: "v12_body_cut",
        stableId: edgeStableId
      },
      {
        op: "sketch.createOnFace",
        id: "v12_followup_sketch",
        name: "V12 follow-up sketch",
        referenceName: "v12_cut_wall_face"
      }
    ]
  });
  checkEqual(failures, "naming.batch.ok", true, nameAndSketch.ok);
  checks += 1;

  const resolvedEdge = executeQuery(engine, {
    query: "reference.resolveNamed",
    name: "v12_cut_wall_edge"
  });
  checkEqual(failures, "naming.edge.ok", true, resolvedEdge.ok);
  checks += 1;

  const chamfer = engine.executeBatch({
    version: "cadops.v1",
    mode: "dryRun",
    ops: [
      {
        op: "feature.chamfer",
        id: "v12_cut_wall_chamfer",
        bodyId: "v12_cut_wall_chamfer_body",
        targetBodyId: "v12_body_cut",
        edgeStableId,
        distance: 0.1
      }
    ]
  });
  checkEqual(failures, "edgeFinish.cutWallDryRun.ok", true, chamfer.ok);
  checkEqual(
    failures,
    "edgeFinish.cutWallDryRun.createdBody",
    "v12_cut_wall_chamfer_body",
    chamfer.createdBodyIds?.[0]
  );
  checks += 2;

  return checks;
}

function verifyAddSelectionAndNaming(engine, failures) {
  const wallStableId = "generated:face:v12_body_add:side:uMin";
  const capStableId = "generated:face:v12_body_add:endCap";
  const capSelection = executeQuery(engine, {
    query: "selection.referenceCandidates",
    selection: {
      type: "generatedReference",
      bodyId: "v12_body_add",
      stableId: capStableId,
      expectedKind: "face"
    },
    requiredOperation: "feature.attachSketchPlane"
  });
  const wallSelection = executeQuery(engine, {
    query: "selection.referenceCandidates",
    selection: {
      type: "generatedReference",
      bodyId: "v12_body_add",
      stableId: wallStableId,
      expectedKind: "face"
    },
    requiredOperation: "feature.measureReference"
  });
  const edgeSelection = executeQuery(engine, {
    query: "selection.referenceCandidates",
    selection: {
      type: "generatedReference",
      bodyId: "v12_body_add",
      stableId: "generated:edge:v12_body_add:end:uMin",
      expectedKind: "edge"
    },
    requiredOperation: "feature.measureReference"
  });
  const missingSeamSelection = executeQuery(engine, {
    query: "selection.referenceCandidates",
    selection: {
      type: "generatedReference",
      bodyId: "v12_body_add",
      stableId: "generated:edge:v12_body_add:longitudinal:uMin:vMin",
      expectedKind: "edge"
    },
    requiredOperation: "feature.chamfer"
  });
  let checks = 0;

  checkEqual(
    failures,
    "add.selection.cap.status",
    "resolved",
    capSelection.status
  );
  checkEqual(
    failures,
    "add.selection.wall.status",
    "resolved",
    wallSelection.status
  );
  checkEqual(
    failures,
    "add.selection.edge.status",
    "resolved",
    edgeSelection.status
  );
  checkEqual(
    failures,
    "add.selection.seam.status",
    "stale",
    missingSeamSelection.status
  );
  checks += 4;

  const nameAndSketch = engine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "reference.nameGenerated",
        name: "v12_added_cap_face",
        bodyId: "v12_body_add",
        stableId: capStableId
      },
      {
        op: "reference.nameGenerated",
        name: "v12_added_wall_face",
        bodyId: "v12_body_add",
        stableId: wallStableId
      },
      {
        op: "reference.nameGenerated",
        name: "v12_added_cap_edge",
        bodyId: "v12_body_add",
        stableId: "generated:edge:v12_body_add:end:uMin"
      },
      {
        op: "sketch.createOnFace",
        id: "v12_add_followup_sketch",
        name: "V12 add follow-up sketch",
        referenceName: "v12_added_cap_face"
      }
    ]
  });
  checkEqual(failures, "add.naming.batch.ok", true, nameAndSketch.ok);
  checks += 1;

  const resolvedWall = executeQuery(engine, {
    query: "reference.resolveNamed",
    name: "v12_added_wall_face"
  });
  checkEqual(failures, "add.naming.wall.ok", true, resolvedWall.ok);
  checks += 1;

  const resolvedEdge = executeQuery(engine, {
    query: "reference.resolveNamed",
    name: "v12_added_cap_edge"
  });
  checkEqual(failures, "add.naming.edge.ok", true, resolvedEdge.ok);
  checks += 1;

  return checks;
}

function verifyCircleToolSelectionAndNaming(engine, failures) {
  const cutFaceStableId = "generated:face:v12_body_circle_cut:side:circular";
  const cutEdgeStableId = "generated:edge:v12_body_circle_cut:end:circular";
  const addCapStableId = "generated:face:v12_body_circle_add:endCap";
  const addEdgeStableId = "generated:edge:v12_body_circle_add:end:circular";
  const cutFaceMeasure = executeQuery(engine, {
    query: "selection.referenceCandidates",
    selection: {
      type: "generatedReference",
      bodyId: "v12_body_circle_cut",
      stableId: cutFaceStableId,
      expectedKind: "face"
    },
    requiredOperation: "feature.measureReference"
  });
  const cutFaceSketch = executeQuery(engine, {
    query: "selection.referenceCandidates",
    selection: {
      type: "generatedReference",
      bodyId: "v12_body_circle_cut",
      stableId: cutFaceStableId,
      expectedKind: "face"
    },
    requiredOperation: "feature.attachSketchPlane"
  });
  const cutEdgeMeasure = executeQuery(engine, {
    query: "selection.referenceCandidates",
    selection: {
      type: "generatedReference",
      bodyId: "v12_body_circle_cut",
      stableId: cutEdgeStableId,
      expectedKind: "edge"
    },
    requiredOperation: "feature.measureReference"
  });
  const addCapSketch = executeQuery(engine, {
    query: "selection.referenceCandidates",
    selection: {
      type: "generatedReference",
      bodyId: "v12_body_circle_add",
      stableId: addCapStableId,
      expectedKind: "face"
    },
    requiredOperation: "feature.attachSketchPlane"
  });
  const addEdgeMeasure = executeQuery(engine, {
    query: "selection.referenceCandidates",
    selection: {
      type: "generatedReference",
      bodyId: "v12_body_circle_add",
      stableId: addEdgeStableId,
      expectedKind: "edge"
    },
    requiredOperation: "feature.measureReference"
  });
  let checks = 0;

  checkEqual(
    failures,
    "circle.selection.cutFace.measure",
    "resolved",
    cutFaceMeasure.status
  );
  checkEqual(
    failures,
    "circle.selection.cutFace.sketch",
    "non-commandable",
    cutFaceSketch.status
  );
  checkEqual(
    failures,
    "circle.selection.cutEdge.measure",
    "resolved",
    cutEdgeMeasure.status
  );
  checkEqual(
    failures,
    "circle.selection.addCap.sketch",
    "resolved",
    addCapSketch.status
  );
  checkEqual(
    failures,
    "circle.selection.addEdge.measure",
    "resolved",
    addEdgeMeasure.status
  );
  checks += 5;

  const nameAndSketch = engine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "reference.nameGenerated",
        name: "v12_circle_cut_wall",
        bodyId: "v12_body_circle_cut",
        stableId: cutFaceStableId
      },
      {
        op: "reference.nameGenerated",
        name: "v12_circle_cut_rim",
        bodyId: "v12_body_circle_cut",
        stableId: cutEdgeStableId
      },
      {
        op: "reference.nameGenerated",
        name: "v12_circle_add_edge",
        bodyId: "v12_body_circle_add",
        stableId: addEdgeStableId
      },
      {
        op: "sketch.createOnFace",
        id: "v12_circle_add_followup_sketch",
        name: "V12 circle add follow-up sketch",
        referenceName: "v12_circle_add_edge"
      }
    ]
  });
  checkEqual(
    failures,
    "circle.naming.invalidSketch.ok",
    false,
    nameAndSketch.ok
  );
  checkEqual(
    failures,
    "circle.naming.invalidSketch.code",
    "GENERATED_REFERENCE_KIND_MISMATCH",
    nameAndSketch.error?.code
  );
  checks += 2;

  const validNameAndSketch = engine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "reference.nameGenerated",
        name: "v12_circle_add_cap",
        bodyId: "v12_body_circle_add",
        stableId: addCapStableId
      },
      {
        op: "sketch.createOnFace",
        id: "v12_circle_add_cap_followup_sketch",
        name: "V12 circle add cap follow-up sketch",
        referenceName: "v12_circle_add_cap"
      }
    ]
  });
  checkEqual(
    failures,
    "circle.naming.validSketch.ok",
    true,
    validNameAndSketch.ok
  );
  checks += 1;

  return checks;
}

function verifyCutReferenceRepair(engine, failures) {
  const faceStableId = "generated:face:v12_body_cut:side:uMin";
  const edgeStableId = "generated:edge:v12_body_cut:longitudinal:uMin:vMin";
  let checks = 0;

  try {
    engine.applyBatch([
      {
        op: "feature.extrude",
        id: "v12_cut_repair_stale_feature",
        bodyId: "v12_cut_repair_stale_body",
        sketchId: "v12_target_sketch",
        entityId: "v12_target_rect",
        depth: 1,
        operationMode: "newBody"
      },
      {
        op: "reference.nameGenerated",
        name: "v12_cut_repaired_face",
        bodyId: "v12_cut_repair_stale_body",
        stableId: "generated:face:v12_cut_repair_stale_body:endCap"
      },
      {
        op: "reference.nameGenerated",
        name: "v12_cut_repaired_edge",
        bodyId: "v12_cut_repair_stale_body",
        stableId: "generated:edge:v12_cut_repair_stale_body:start:uMin"
      },
      {
        op: "feature.delete",
        id: "v12_cut_repair_stale_feature"
      }
    ]);
  } catch (error) {
    failures.push(`repair.cut.setup: threw ${formatError(error)}`);
    return checks + 1;
  }

  const staleHealth = executeQuery(engine, {
    query: "reference.health",
    target: { type: "namedReference", name: "v12_cut_repaired_face" }
  });
  checkEqual(failures, "repair.cut.staleHealth.ok", true, staleHealth.ok);
  checkEqual(
    failures,
    "repair.cut.staleHealth.status",
    "missing",
    staleHealth.status
  );
  checks += 2;

  let repair;
  try {
    repair = engine.applyBatch([
      {
        op: "reference.repairName",
        name: "v12_cut_repaired_face",
        bodyId: "v12_body_cut",
        stableId: faceStableId
      },
      {
        op: "reference.repairName",
        name: "v12_cut_repaired_edge",
        bodyId: "v12_body_cut",
        stableId: edgeStableId
      }
    ]);
  } catch (error) {
    failures.push(`repair.cut.commit: threw ${formatError(error)}`);
    return checks + 1;
  }

  const namedRepaired =
    repair.transaction?.diff?.references?.namedRepaired ?? [];
  checkSome(
    failures,
    "repair.cut.face.diff",
    namedRepaired,
    (entry) =>
      entry.after?.name === "v12_cut_repaired_face" &&
      entry.after?.bodyId === "v12_body_cut" &&
      entry.after?.stableId === faceStableId &&
      entry.after?.kind === "face"
  );
  checkSome(
    failures,
    "repair.cut.edge.diff",
    namedRepaired,
    (entry) =>
      entry.after?.name === "v12_cut_repaired_edge" &&
      entry.after?.bodyId === "v12_body_cut" &&
      entry.after?.stableId === edgeStableId &&
      entry.after?.kind === "edge"
  );
  checks += 2;

  const repairedEdge = executeQuery(engine, {
    query: "selection.referenceCandidates",
    selection: { type: "namedReference", name: "v12_cut_repaired_edge" },
    requiredOperation: "feature.measureReference"
  });
  checkEqual(
    failures,
    "repair.cut.edge.selection",
    "resolved",
    repairedEdge.status
  );
  checkSome(
    failures,
    "repair.cut.edge.commandable",
    repairedEdge.candidates ?? [],
    (candidate) =>
      candidate.commandable === true &&
      candidate.target?.bodyId === "v12_body_cut" &&
      candidate.target?.stableId === edgeStableId
  );
  checks += 2;

  checkNoBoundaryLeaks(
    failures,
    "repair.cut.diff",
    JSON.stringify(repair.transaction?.diff ?? {})
  );

  return checks;
}

function verifyAddReferenceRepair(engine, failures) {
  const capStableId = "generated:face:v12_body_add:endCap";
  const wallStableId = "generated:face:v12_body_add:side:uMin";
  const edgeStableId = "generated:edge:v12_body_add:end:uMin";
  let checks = 0;

  try {
    engine.applyBatch([
      {
        op: "feature.extrude",
        id: "v12_add_repair_stale_feature",
        bodyId: "v12_add_repair_stale_body",
        sketchId: "v12_add_target_sketch",
        entityId: "v12_add_target_rect",
        depth: 1,
        operationMode: "newBody"
      },
      {
        op: "reference.nameGenerated",
        name: "v12_add_repaired_cap",
        bodyId: "v12_add_repair_stale_body",
        stableId: "generated:face:v12_add_repair_stale_body:endCap"
      },
      {
        op: "reference.nameGenerated",
        name: "v12_add_repaired_wall",
        bodyId: "v12_add_repair_stale_body",
        stableId: "generated:face:v12_add_repair_stale_body:side:uMin"
      },
      {
        op: "reference.nameGenerated",
        name: "v12_add_repaired_edge",
        bodyId: "v12_add_repair_stale_body",
        stableId: "generated:edge:v12_add_repair_stale_body:end:uMin"
      },
      {
        op: "feature.delete",
        id: "v12_add_repair_stale_feature"
      }
    ]);
  } catch (error) {
    failures.push(`repair.add.setup: threw ${formatError(error)}`);
    return checks + 1;
  }

  const staleHealth = executeQuery(engine, {
    query: "reference.health",
    target: { type: "namedReference", name: "v12_add_repaired_cap" }
  });
  const staleWallHealth = executeQuery(engine, {
    query: "reference.health",
    target: { type: "namedReference", name: "v12_add_repaired_wall" }
  });
  const staleEdgeHealth = executeQuery(engine, {
    query: "reference.health",
    target: { type: "namedReference", name: "v12_add_repaired_edge" }
  });
  checkEqual(failures, "repair.add.staleHealth.ok", true, staleHealth.ok);
  checkEqual(
    failures,
    "repair.add.staleHealth.status",
    "missing",
    staleHealth.status
  );
  checkEqual(
    failures,
    "repair.add.staleWallHealth.ok",
    true,
    staleWallHealth.ok
  );
  checkEqual(
    failures,
    "repair.add.staleWallHealth.status",
    "missing",
    staleWallHealth.status
  );
  checkEqual(
    failures,
    "repair.add.staleEdgeHealth.ok",
    true,
    staleEdgeHealth.ok
  );
  checkEqual(
    failures,
    "repair.add.staleEdgeHealth.status",
    "missing",
    staleEdgeHealth.status
  );
  checks += 6;

  let repair;
  try {
    repair = engine.applyBatch([
      {
        op: "reference.repairName",
        name: "v12_add_repaired_cap",
        bodyId: "v12_body_add",
        stableId: capStableId
      },
      {
        op: "reference.repairName",
        name: "v12_add_repaired_wall",
        bodyId: "v12_body_add",
        stableId: wallStableId
      },
      {
        op: "reference.repairName",
        name: "v12_add_repaired_edge",
        bodyId: "v12_body_add",
        stableId: edgeStableId
      }
    ]);
  } catch (error) {
    failures.push(`repair.add.commit: threw ${formatError(error)}`);
    return checks + 1;
  }

  const namedRepaired =
    repair.transaction?.diff?.references?.namedRepaired ?? [];
  checkSome(
    failures,
    "repair.add.cap.diff",
    namedRepaired,
    (entry) =>
      entry.after?.name === "v12_add_repaired_cap" &&
      entry.after?.bodyId === "v12_body_add" &&
      entry.after?.stableId === capStableId &&
      entry.after?.kind === "face"
  );
  checkSome(
    failures,
    "repair.add.wall.diff",
    namedRepaired,
    (entry) =>
      entry.after?.name === "v12_add_repaired_wall" &&
      entry.after?.bodyId === "v12_body_add" &&
      entry.after?.stableId === wallStableId &&
      entry.after?.kind === "face"
  );
  checkSome(
    failures,
    "repair.add.edge.diff",
    namedRepaired,
    (entry) =>
      entry.after?.name === "v12_add_repaired_edge" &&
      entry.after?.bodyId === "v12_body_add" &&
      entry.after?.stableId === edgeStableId &&
      entry.after?.kind === "edge"
  );
  checks += 3;

  const repairedCap = executeQuery(engine, {
    query: "selection.referenceCandidates",
    selection: { type: "namedReference", name: "v12_add_repaired_cap" },
    requiredOperation: "feature.attachSketchPlane"
  });
  const repairedWall = executeQuery(engine, {
    query: "selection.referenceCandidates",
    selection: { type: "namedReference", name: "v12_add_repaired_wall" },
    requiredOperation: "feature.measureReference"
  });
  const repairedEdge = executeQuery(engine, {
    query: "selection.referenceCandidates",
    selection: { type: "namedReference", name: "v12_add_repaired_edge" },
    requiredOperation: "feature.measureReference"
  });
  checkEqual(
    failures,
    "repair.add.cap.selection",
    "resolved",
    repairedCap.status
  );
  checkSome(
    failures,
    "repair.add.cap.commandable",
    repairedCap.candidates ?? [],
    (candidate) =>
      candidate.commandable === true &&
      candidate.target?.bodyId === "v12_body_add" &&
      candidate.target?.stableId === capStableId
  );
  checkEqual(
    failures,
    "repair.add.wall.selection",
    "resolved",
    repairedWall.status
  );
  checkSome(
    failures,
    "repair.add.wall.commandable",
    repairedWall.candidates ?? [],
    (candidate) =>
      candidate.commandable === true &&
      candidate.target?.bodyId === "v12_body_add" &&
      candidate.target?.stableId === wallStableId
  );
  checkEqual(
    failures,
    "repair.add.edge.selection",
    "resolved",
    repairedEdge.status
  );
  checkSome(
    failures,
    "repair.add.edge.commandable",
    repairedEdge.candidates ?? [],
    (candidate) =>
      candidate.commandable === true &&
      candidate.target?.bodyId === "v12_body_add" &&
      candidate.target?.stableId === edgeStableId
  );
  checks += 6;

  checkNoBoundaryLeaks(
    failures,
    "repair.add.diff",
    JSON.stringify(repair.transaction?.diff ?? {})
  );

  return checks;
}

function verifyCutQueryAlignment(engine, failures) {
  const faceStableId = "generated:face:v12_body_cut:side:uMin";
  const edgeStableId = "generated:edge:v12_body_cut:longitudinal:uMin:vMin";
  const graph = executeQuery(engine, { query: "project.dependencyGraph" });
  const rebuildPlan = executeQuery(engine, { query: "project.rebuildPlan" });
  const editability = executeQuery(engine, {
    query: "feature.editability",
    featureId: "v12_feat_target",
    proposedEdit: { kind: "extrude", depth: 6 }
  });
  let checks = 0;

  checkEqual(failures, "query.cut.graph.ok", true, graph.ok);
  checkEqual(failures, "query.cut.rebuild.ok", true, rebuildPlan.ok);
  checkEqual(failures, "query.cut.editability.ok", true, editability.ok);
  checks += 3;

  checkSome(
    failures,
    "query.cut.graph.faceNode",
    graph.nodes ?? [],
    (node) =>
      node.kind === "generatedReference" &&
      node.status === "active" &&
      node.bodyId === "v12_body_cut" &&
      node.stableId === faceStableId
  );
  checkSome(
    failures,
    "query.cut.graph.edgeNode",
    graph.nodes ?? [],
    (node) =>
      node.kind === "generatedReference" &&
      node.status === "active" &&
      node.bodyId === "v12_body_cut" &&
      node.stableId === edgeStableId
  );
  checkSome(
    failures,
    "query.cut.graph.edgeName",
    graph.edges ?? [],
    (edge) =>
      edge.kind === "names" &&
      edge.referenceName === "v12_cut_repaired_edge" &&
      edge.stableId === edgeStableId
  );
  checks += 3;

  checkEqual(
    failures,
    "query.cut.rebuild.status",
    "repair-needed",
    rebuildPlan.status
  );
  checkSome(
    failures,
    "query.cut.rebuild.lifecycle",
    rebuildPlan.bodyLifecycles ?? [],
    (body) =>
      body.bodyId === "v12_body_cut" &&
      (body.primaryState === "repair-needed" ||
        body.primaryState === "replacement") &&
      body.states?.includes("repair-needed") &&
      body.referenceHealthStatus === "active" &&
      body.commandReady === false
  );
  checkAtLeast(
    failures,
    "query.cut.rebuild.generatedReferenceCount",
    rebuildPlan.affected?.generatedReferenceCount ?? 0,
    9
  );
  checks += 3;

  checkEqual(
    failures,
    "query.cut.editability.status",
    "editable",
    editability.status
  );
  checkSome(
    failures,
    "query.cut.editability.faceActive",
    editability.referenceChanges ?? [],
    (effect) =>
      effect.category === "active" &&
      effect.bodyId === "v12_body_cut" &&
      effect.stableId === faceStableId &&
      effect.sourceFeatureId === "v12_feat_target" &&
      effect.targetFeatureId === "v12_feat_cut"
  );
  checkSome(
    failures,
    "query.cut.editability.edgeActive",
    editability.referenceChanges ?? [],
    (effect) =>
      effect.category === "active" &&
      effect.bodyId === "v12_body_cut" &&
      effect.stableId === edgeStableId &&
      effect.sourceFeatureId === "v12_feat_target" &&
      effect.targetFeatureId === "v12_feat_cut"
  );
  checkSome(
    failures,
    "query.cut.editability.bodyRepairNeeded",
    editability.referenceChanges ?? [],
    (effect) =>
      effect.category === "replaced" &&
      effect.bodyId === "v12_body_cut" &&
      effect.diagnosticCode === "AMBIGUOUS_RESULT_TOPOLOGY"
  );
  checks += 4;

  checkNoBoundaryLeaks(
    failures,
    "query.cut.alignment",
    JSON.stringify({
      nodes: graph.nodes,
      edges: graph.edges,
      referenceHealth: graph.referenceHealth,
      bodyLifecycles: rebuildPlan.bodyLifecycles,
      affected: rebuildPlan.affected,
      referenceChanges: editability.referenceChanges
    })
  );

  return checks;
}

function verifyAddQueryAlignment(engine, failures) {
  const capStableId = "generated:face:v12_body_add:endCap";
  const wallStableId = "generated:face:v12_body_add:side:uMin";
  const edgeStableId = "generated:edge:v12_body_add:end:uMin";
  const graph = executeQuery(engine, { query: "project.dependencyGraph" });
  const rebuildPlan = executeQuery(engine, { query: "project.rebuildPlan" });
  const editability = executeQuery(engine, {
    query: "feature.editability",
    featureId: "v12_feat_add_target",
    proposedEdit: { kind: "extrude", depth: 6 }
  });
  let checks = 0;

  checkEqual(failures, "query.add.graph.ok", true, graph.ok);
  checkEqual(failures, "query.add.rebuild.ok", true, rebuildPlan.ok);
  checkEqual(failures, "query.add.editability.ok", true, editability.ok);
  checks += 3;

  checkSome(
    failures,
    "query.add.graph.capNode",
    graph.nodes ?? [],
    (node) =>
      node.kind === "generatedReference" &&
      node.status === "active" &&
      node.bodyId === "v12_body_add" &&
      node.stableId === capStableId
  );
  checkSome(
    failures,
    "query.add.graph.wallNode",
    graph.nodes ?? [],
    (node) =>
      node.kind === "generatedReference" &&
      node.status === "active" &&
      node.bodyId === "v12_body_add" &&
      node.stableId === wallStableId
  );
  checkSome(
    failures,
    "query.add.graph.edgeNode",
    graph.nodes ?? [],
    (node) =>
      node.kind === "generatedReference" &&
      node.status === "active" &&
      node.bodyId === "v12_body_add" &&
      node.stableId === edgeStableId
  );
  checkSome(
    failures,
    "query.add.graph.capName",
    graph.edges ?? [],
    (edge) =>
      edge.kind === "names" &&
      edge.referenceName === "v12_add_repaired_cap" &&
      edge.stableId === capStableId
  );
  checkSome(
    failures,
    "query.add.graph.edgeName",
    graph.edges ?? [],
    (edge) =>
      edge.kind === "names" &&
      edge.referenceName === "v12_added_cap_edge" &&
      edge.stableId === edgeStableId
  );
  checkSome(
    failures,
    "query.add.graph.edgeHealth",
    graph.referenceHealth ?? [],
    (entry) =>
      entry.source === "generatedReference" &&
      entry.status === "active" &&
      entry.commandable === true &&
      entry.bodyId === "v12_body_add" &&
      entry.stableId === edgeStableId
  );
  checks += 6;

  checkEqual(
    failures,
    "query.add.rebuild.status",
    "repair-needed",
    rebuildPlan.status
  );
  checkSome(
    failures,
    "query.add.rebuild.lifecycle",
    rebuildPlan.bodyLifecycles ?? [],
    (body) =>
      body.bodyId === "v12_body_add" &&
      (body.primaryState === "repair-needed" ||
        body.primaryState === "replacement") &&
      body.states?.includes("repair-needed") &&
      body.referenceHealthStatus === "active" &&
      body.commandReady === false
  );
  checkAtLeast(
    failures,
    "query.add.rebuild.generatedReferenceCount",
    rebuildPlan.affected?.generatedReferenceCount ?? 0,
    6
  );
  checks += 3;

  checkEqual(
    failures,
    "query.add.editability.status",
    "editable",
    editability.status
  );
  checkSome(
    failures,
    "query.add.editability.capActive",
    editability.referenceChanges ?? [],
    (effect) =>
      effect.category === "active" &&
      effect.bodyId === "v12_body_add" &&
      effect.stableId === capStableId &&
      effect.sourceFeatureId === "v12_feat_add_target" &&
      effect.targetFeatureId === "v12_feat_add"
  );
  checkSome(
    failures,
    "query.add.editability.wallActive",
    editability.referenceChanges ?? [],
    (effect) =>
      effect.category === "active" &&
      effect.bodyId === "v12_body_add" &&
      effect.stableId === wallStableId &&
      effect.sourceFeatureId === "v12_feat_add_target" &&
      effect.targetFeatureId === "v12_feat_add"
  );
  checkSome(
    failures,
    "query.add.editability.edgeActive",
    editability.referenceChanges ?? [],
    (effect) =>
      effect.category === "active" &&
      effect.bodyId === "v12_body_add" &&
      effect.stableId === edgeStableId &&
      effect.sourceFeatureId === "v12_feat_add_target" &&
      effect.targetFeatureId === "v12_feat_add"
  );
  checkSome(
    failures,
    "query.add.editability.bodyRepairNeeded",
    editability.referenceChanges ?? [],
    (effect) =>
      effect.category === "replaced" &&
      effect.bodyId === "v12_body_add" &&
      effect.diagnosticCode === "AMBIGUOUS_RESULT_TOPOLOGY"
  );
  checks += 5;

  checkNoBoundaryLeaks(
    failures,
    "query.add.alignment",
    JSON.stringify({
      nodes: graph.nodes,
      edges: graph.edges,
      referenceHealth: graph.referenceHealth,
      bodyLifecycles: rebuildPlan.bodyLifecycles,
      affected: rebuildPlan.affected,
      referenceChanges: editability.referenceChanges
    })
  );

  return checks;
}

function verifyCircleToolQueryAlignment(engine, failures) {
  const addEdgeStableId = "generated:edge:v12_body_circle_add:end:circular";
  const graph = executeQuery(engine, { query: "project.dependencyGraph" });
  const rebuildPlan = executeQuery(engine, { query: "project.rebuildPlan" });
  const editability = executeQuery(engine, {
    query: "feature.editability",
    featureId: "v12_feat_circle_add_target",
    proposedEdit: { kind: "extrude", depth: 6 }
  });
  const addEdgeHealth = executeQuery(engine, {
    query: "reference.health",
    target: {
      type: "generatedReference",
      bodyId: "v12_body_circle_add",
      stableId: addEdgeStableId,
      expectedKind: "edge"
    }
  });
  let checks = 0;

  checkEqual(failures, "circle.query.graph.ok", true, graph.ok);
  checkEqual(failures, "circle.query.rebuild.ok", true, rebuildPlan.ok);
  checkEqual(failures, "circle.query.editability.ok", true, editability.ok);
  checkEqual(failures, "circle.query.edgeHealth.ok", true, addEdgeHealth.ok);
  checks += 4;

  checkSome(
    failures,
    "circle.query.graph.addEdgeNode",
    graph.nodes ?? [],
    (node) =>
      node.kind === "generatedReference" &&
      node.status === "active" &&
      node.bodyId === "v12_body_circle_add" &&
      node.stableId === addEdgeStableId
  );
  checkSome(
    failures,
    "circle.query.graph.addEdgeHealth",
    graph.referenceHealth ?? [],
    (entry) =>
      entry.source === "generatedReference" &&
      entry.status === "active" &&
      entry.commandable === true &&
      entry.bodyId === "v12_body_circle_add" &&
      entry.stableId === addEdgeStableId
  );
  checks += 2;

  checkEqual(
    failures,
    "circle.query.edgeHealth.status",
    "active",
    addEdgeHealth.status
  );
  checkSome(
    failures,
    "circle.query.edgeHealth.commandable",
    addEdgeHealth.referenceHealth ?? [],
    (entry) =>
      entry.source === "generatedReference" &&
      entry.commandable === true &&
      entry.bodyId === "v12_body_circle_add" &&
      entry.stableId === addEdgeStableId
  );
  checks += 2;

  checkEqual(
    failures,
    "circle.query.rebuild.status",
    "repair-needed",
    rebuildPlan.status
  );
  checkSome(
    failures,
    "circle.query.rebuild.lifecycle",
    rebuildPlan.bodyLifecycles ?? [],
    (body) =>
      body.bodyId === "v12_body_circle_add" &&
      (body.primaryState === "repair-needed" ||
        body.primaryState === "replacement") &&
      body.states?.includes("repair-needed") &&
      body.referenceHealthStatus === "active"
  );
  checkAtLeast(
    failures,
    "circle.query.rebuild.generatedReferenceCount",
    rebuildPlan.affected?.generatedReferenceCount ?? 0,
    6
  );
  checks += 3;

  checkEqual(
    failures,
    "circle.query.editability.status",
    "editable",
    editability.status
  );
  checkSome(
    failures,
    "circle.query.editability.addEdgeActive",
    editability.referenceChanges ?? [],
    (effect) =>
      effect.category === "active" &&
      effect.bodyId === "v12_body_circle_add" &&
      effect.stableId === addEdgeStableId &&
      effect.kind === "edge" &&
      effect.sourceFeatureId === "v12_feat_circle_add_target" &&
      effect.targetFeatureId === "v12_feat_circle_add"
  );
  checks += 2;

  checkNoBoundaryLeaks(
    failures,
    "circle.query.alignment",
    JSON.stringify({
      nodes: graph.nodes,
      edges: graph.edges,
      referenceHealth: graph.referenceHealth,
      bodyLifecycles: rebuildPlan.bodyLifecycles,
      affected: rebuildPlan.affected,
      referenceChanges: editability.referenceChanges,
      addEdgeHealth: addEdgeHealth.referenceHealth
    })
  );

  return checks;
}

function verifyEditReferenceEffects(engine, failures) {
  const faceStableId = "generated:face:v12_body_cut:side:uMin";
  const edgeStableId = "generated:edge:v12_body_cut:longitudinal:uMin:vMin";
  let checks = 0;
  let edit;

  try {
    edit = engine.apply({
      op: "feature.updateExtrude",
      id: "v12_feat_target",
      depth: 4
    });
  } catch (error) {
    failures.push(`edit.commit: threw ${formatError(error)}`);
    return checks + 1;
  }

  const features = edit.transaction?.diff?.features ?? {};
  const modifiedFeatures = features.modified ?? [];
  const modifiedBodies = features.bodiesModified ?? [];
  const referenceEffects = features.referenceEffects ?? [];

  checkSome(
    failures,
    "edit.modified.sourceFeature",
    modifiedFeatures,
    (feature) => feature.id === "v12_feat_target"
  );
  checkSome(
    failures,
    "edit.modified.cutFeature",
    modifiedFeatures,
    (feature) => feature.id === "v12_feat_cut"
  );
  checkSome(
    failures,
    "edit.modified.sourceBody",
    modifiedBodies,
    (body) => body.id === "v12_body_target"
  );
  checkSome(
    failures,
    "edit.modified.cutBody",
    modifiedBodies,
    (body) => body.id === "v12_body_cut"
  );
  checks += 4;

  checkSome(
    failures,
    "edit.effects.faceGeneratedActive",
    referenceEffects,
    (effect) =>
      effect.category === "active" &&
      effect.bodyId === "v12_body_cut" &&
      effect.stableId === faceStableId &&
      effect.kind === "face" &&
      effect.sourceFeatureId === "v12_feat_target" &&
      effect.targetFeatureId === "v12_feat_cut"
  );
  checkSome(
    failures,
    "edit.effects.edgeGeneratedActive",
    referenceEffects,
    (effect) =>
      effect.category === "active" &&
      effect.bodyId === "v12_body_cut" &&
      effect.stableId === edgeStableId &&
      effect.kind === "edge" &&
      effect.sourceFeatureId === "v12_feat_target" &&
      effect.targetFeatureId === "v12_feat_cut"
  );
  checkSome(
    failures,
    "edit.effects.faceNamedActive",
    referenceEffects,
    (effect) =>
      effect.category === "active" &&
      effect.referenceName === "v12_cut_wall_face" &&
      effect.stableId === faceStableId
  );
  checkSome(
    failures,
    "edit.effects.edgeNamedActive",
    referenceEffects,
    (effect) =>
      effect.category === "active" &&
      effect.referenceName === "v12_cut_wall_edge" &&
      effect.stableId === edgeStableId
  );
  checkSome(
    failures,
    "edit.effects.ambiguousResultTopology",
    referenceEffects,
    (effect) =>
      effect.category === "replaced" &&
      effect.bodyId === "v12_body_cut" &&
      effect.diagnosticCode === "AMBIGUOUS_RESULT_TOPOLOGY"
  );
  checks += 5;

  const health = executeQuery(engine, {
    query: "reference.health",
    target: { type: "namedReference", name: "v12_cut_wall_edge" }
  });
  checkEqual(failures, "edit.edgeHealth.ok", true, health.ok);
  checkEqual(failures, "edit.edgeHealth.status", "active", health.status);
  checks += 2;

  const edgeHealth = health.referenceHealth?.find(
    (entry) =>
      entry.source === "namedReference" &&
      entry.referenceName === "v12_cut_wall_edge" &&
      entry.stableId === edgeStableId
  );
  checkEqual(failures, "edit.edgeHealth.entry", true, Boolean(edgeHealth));
  checks += 1;

  if (edgeHealth) {
    checkEqual(
      failures,
      "edit.edgeHealth.commandable",
      true,
      edgeHealth.commandable
    );
    checkIncludes(
      failures,
      "edit.edgeHealth.operations",
      edgeHealth.commandOperations ?? [],
      "feature.measureReference"
    );
    checkIncludes(
      failures,
      "edit.edgeHealth.operations",
      edgeHealth.commandOperations ?? [],
      "feature.selectReference"
    );
    checks += 3;
  }

  checkNoBoundaryLeaks(
    failures,
    "edit.referenceEffects",
    JSON.stringify(referenceEffects)
  );

  return checks;
}

function verifySketchProfileEditReferenceEffects(engine, failures) {
  const faceStableId = "generated:face:v12_body_cut:side:uMin";
  const edgeStableId = "generated:edge:v12_body_cut:longitudinal:uMin:vMin";
  let checks = 0;
  let edit;

  try {
    edit = engine.apply({
      op: "sketch.updateEntity",
      sketchId: "v12_target_sketch",
      entity: {
        id: "v12_target_rect",
        kind: "rectangle",
        center: [0, 0],
        width: 5,
        height: 4
      }
    });
  } catch (error) {
    failures.push(`sketchEdit.commit: threw ${formatError(error)}`);
    return checks + 1;
  }

  const features = edit.transaction?.diff?.features ?? {};
  const modifiedFeatures = features.modified ?? [];
  const modifiedBodies = features.bodiesModified ?? [];
  const referenceEffects = features.referenceEffects ?? [];

  checkSome(
    failures,
    "sketchEdit.modified.sourceFeature",
    modifiedFeatures,
    (feature) => feature.id === "v12_feat_target"
  );
  checkSome(
    failures,
    "sketchEdit.modified.cutFeature",
    modifiedFeatures,
    (feature) => feature.id === "v12_feat_cut"
  );
  checkSome(
    failures,
    "sketchEdit.modified.sourceBody",
    modifiedBodies,
    (body) => body.id === "v12_body_target"
  );
  checkSome(
    failures,
    "sketchEdit.modified.cutBody",
    modifiedBodies,
    (body) => body.id === "v12_body_cut"
  );
  checks += 4;

  checkSome(
    failures,
    "sketchEdit.effects.faceGeneratedActive",
    referenceEffects,
    (effect) =>
      effect.category === "active" &&
      effect.bodyId === "v12_body_cut" &&
      effect.stableId === faceStableId &&
      effect.kind === "face" &&
      effect.sourceFeatureId === "v12_feat_target" &&
      effect.targetFeatureId === "v12_feat_cut"
  );
  checkSome(
    failures,
    "sketchEdit.effects.edgeNamedActive",
    referenceEffects,
    (effect) =>
      effect.category === "active" &&
      effect.referenceName === "v12_cut_wall_edge" &&
      effect.stableId === edgeStableId
  );
  checkSome(
    failures,
    "sketchEdit.effects.ambiguousResultTopology",
    referenceEffects,
    (effect) =>
      effect.category === "replaced" &&
      effect.bodyId === "v12_body_cut" &&
      effect.diagnosticCode === "AMBIGUOUS_RESULT_TOPOLOGY"
  );
  checks += 3;

  const health = executeQuery(engine, {
    query: "reference.health",
    target: { type: "namedReference", name: "v12_cut_wall_edge" }
  });
  checkEqual(failures, "sketchEdit.edgeHealth.ok", true, health.ok);
  checkEqual(failures, "sketchEdit.edgeHealth.status", "active", health.status);
  checks += 2;

  checkNoBoundaryLeaks(
    failures,
    "sketchEdit.referenceEffects",
    JSON.stringify(referenceEffects)
  );

  return checks;
}

function verifySketchConstraintCreateReferenceEffects(engine, failures) {
  const faceStableId = "generated:face:v12_body_cut:side:uMin";
  const edgeStableId = "generated:edge:v12_body_cut:longitudinal:uMin:vMin";
  let checks = 0;
  let edit;

  try {
    edit = engine.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "v12_target_sketch",
        id: "v12_target_midline",
        start: [2, 4],
        end: [6, 8]
      },
      {
        op: "sketch.constraint.create",
        id: "v12_target_midpoint",
        name: "V12 target midpoint",
        sketchId: "v12_target_sketch",
        kind: "midpoint",
        lineEntityId: "v12_target_midline",
        target: { entityId: "v12_target_rect", role: "center" }
      }
    ]);
  } catch (error) {
    failures.push(`sketchConstraintCreate.commit: threw ${formatError(error)}`);
    return checks + 1;
  }

  const features = edit.transaction?.diff?.features ?? {};
  const referenceEffects = features.referenceEffects ?? [];

  checkSome(
    failures,
    "sketchConstraintCreate.modified.sourceFeature",
    features.modified ?? [],
    (feature) => feature.id === "v12_feat_target"
  );
  checkSome(
    failures,
    "sketchConstraintCreate.modified.cutFeature",
    features.modified ?? [],
    (feature) => feature.id === "v12_feat_cut"
  );
  checkSome(
    failures,
    "sketchConstraintCreate.effects.faceGeneratedActive",
    referenceEffects,
    (effect) =>
      effect.category === "active" &&
      effect.bodyId === "v12_body_cut" &&
      effect.stableId === faceStableId &&
      effect.kind === "face" &&
      effect.sourceFeatureId === "v12_feat_target" &&
      effect.targetFeatureId === "v12_feat_cut"
  );
  checkSome(
    failures,
    "sketchConstraintCreate.effects.edgeNamedActive",
    referenceEffects,
    (effect) =>
      effect.category === "active" &&
      effect.referenceName === "v12_cut_wall_edge" &&
      effect.stableId === edgeStableId
  );
  checkSome(
    failures,
    "sketchConstraintCreate.effects.ambiguousResultTopology",
    referenceEffects,
    (effect) =>
      effect.category === "replaced" &&
      effect.bodyId === "v12_body_cut" &&
      effect.diagnosticCode === "AMBIGUOUS_RESULT_TOPOLOGY"
  );
  checks += 5;

  const health = executeQuery(engine, {
    query: "reference.health",
    target: { type: "namedReference", name: "v12_cut_wall_edge" }
  });
  checkEqual(failures, "sketchConstraintCreate.edgeHealth.ok", true, health.ok);
  checkEqual(
    failures,
    "sketchConstraintCreate.edgeHealth.status",
    "active",
    health.status
  );
  checks += 2;

  checkNoBoundaryLeaks(
    failures,
    "sketchConstraintCreate.referenceEffects",
    JSON.stringify(referenceEffects)
  );

  return checks;
}

function verifyAddEditReferenceEffects(engine, failures) {
  const capStableId = "generated:face:v12_body_add:endCap";
  const wallStableId = "generated:face:v12_body_add:side:uMin";
  let checks = 0;
  let edit;

  try {
    edit = engine.apply({
      op: "feature.updateExtrude",
      id: "v12_feat_add_target",
      depth: 4
    });
  } catch (error) {
    failures.push(`add.edit.commit: threw ${formatError(error)}`);
    return checks + 1;
  }

  const features = edit.transaction?.diff?.features ?? {};
  const modifiedFeatures = features.modified ?? [];
  const modifiedBodies = features.bodiesModified ?? [];
  const referenceEffects = features.referenceEffects ?? [];

  checkSome(
    failures,
    "add.edit.modified.sourceFeature",
    modifiedFeatures,
    (feature) => feature.id === "v12_feat_add_target"
  );
  checkSome(
    failures,
    "add.edit.modified.addFeature",
    modifiedFeatures,
    (feature) => feature.id === "v12_feat_add"
  );
  checkSome(
    failures,
    "add.edit.modified.sourceBody",
    modifiedBodies,
    (body) => body.id === "v12_body_add_target"
  );
  checkSome(
    failures,
    "add.edit.modified.addBody",
    modifiedBodies,
    (body) => body.id === "v12_body_add"
  );
  checks += 4;

  checkSome(
    failures,
    "add.edit.effects.capGeneratedActive",
    referenceEffects,
    (effect) =>
      effect.category === "active" &&
      effect.bodyId === "v12_body_add" &&
      effect.stableId === capStableId &&
      effect.kind === "face" &&
      effect.sourceFeatureId === "v12_feat_add_target" &&
      effect.targetFeatureId === "v12_feat_add"
  );
  checkSome(
    failures,
    "add.edit.effects.wallGeneratedActive",
    referenceEffects,
    (effect) =>
      effect.category === "active" &&
      effect.bodyId === "v12_body_add" &&
      effect.stableId === wallStableId &&
      effect.kind === "face" &&
      effect.sourceFeatureId === "v12_feat_add_target" &&
      effect.targetFeatureId === "v12_feat_add"
  );
  checkSome(
    failures,
    "add.edit.effects.capNamedActive",
    referenceEffects,
    (effect) =>
      effect.category === "active" &&
      effect.referenceName === "v12_added_cap_face" &&
      effect.stableId === capStableId
  );
  checkSome(
    failures,
    "add.edit.effects.wallNamedActive",
    referenceEffects,
    (effect) =>
      effect.category === "active" &&
      effect.referenceName === "v12_added_wall_face" &&
      effect.stableId === wallStableId
  );
  checkSome(
    failures,
    "add.edit.effects.ambiguousResultTopology",
    referenceEffects,
    (effect) =>
      effect.category === "replaced" &&
      effect.bodyId === "v12_body_add" &&
      effect.diagnosticCode === "AMBIGUOUS_RESULT_TOPOLOGY"
  );
  checks += 5;

  const health = executeQuery(engine, {
    query: "reference.health",
    target: { type: "namedReference", name: "v12_added_cap_face" }
  });
  checkEqual(failures, "add.edit.capHealth.ok", true, health.ok);
  checkEqual(failures, "add.edit.capHealth.status", "active", health.status);
  checks += 2;

  const capHealth = health.referenceHealth?.find(
    (entry) =>
      entry.source === "namedReference" &&
      entry.referenceName === "v12_added_cap_face" &&
      entry.stableId === capStableId
  );
  checkEqual(failures, "add.edit.capHealth.entry", true, Boolean(capHealth));
  checks += 1;

  if (capHealth) {
    checkEqual(
      failures,
      "add.edit.capHealth.commandable",
      true,
      capHealth.commandable
    );
    checkIncludes(
      failures,
      "add.edit.capHealth.operations",
      capHealth.commandOperations ?? [],
      "feature.attachSketchPlane"
    );
    checkIncludes(
      failures,
      "add.edit.capHealth.operations",
      capHealth.commandOperations ?? [],
      "feature.measureReference"
    );
    checks += 3;
  }

  checkNoBoundaryLeaks(
    failures,
    "add.edit.referenceEffects",
    JSON.stringify(referenceEffects)
  );

  return checks;
}

function verifyAddDimensionEditReferenceEffects(engine, failures) {
  const capStableId = "generated:face:v12_body_add:endCap";
  const wallStableId = "generated:face:v12_body_add:side:uMin";
  let checks = 0;
  let edit;

  try {
    edit = engine.apply({
      op: "sketch.dimension.update",
      id: "v12_add_target_width",
      value: 5
    });
  } catch (error) {
    failures.push(`add.dimensionEdit.commit: threw ${formatError(error)}`);
    return checks + 1;
  }

  const features = edit.transaction?.diff?.features ?? {};
  const modifiedFeatures = features.modified ?? [];
  const modifiedBodies = features.bodiesModified ?? [];
  const referenceEffects = features.referenceEffects ?? [];

  checkSome(
    failures,
    "add.dimensionEdit.modified.sourceFeature",
    modifiedFeatures,
    (feature) => feature.id === "v12_feat_add_target"
  );
  checkSome(
    failures,
    "add.dimensionEdit.modified.addFeature",
    modifiedFeatures,
    (feature) => feature.id === "v12_feat_add"
  );
  checkSome(
    failures,
    "add.dimensionEdit.modified.sourceBody",
    modifiedBodies,
    (body) => body.id === "v12_body_add_target"
  );
  checkSome(
    failures,
    "add.dimensionEdit.modified.addBody",
    modifiedBodies,
    (body) => body.id === "v12_body_add"
  );
  checks += 4;

  checkSome(
    failures,
    "add.dimensionEdit.effects.capGeneratedActive",
    referenceEffects,
    (effect) =>
      effect.category === "active" &&
      effect.bodyId === "v12_body_add" &&
      effect.stableId === capStableId &&
      effect.kind === "face" &&
      effect.sourceFeatureId === "v12_feat_add_target" &&
      effect.targetFeatureId === "v12_feat_add"
  );
  checkSome(
    failures,
    "add.dimensionEdit.effects.wallNamedActive",
    referenceEffects,
    (effect) =>
      effect.category === "active" &&
      effect.referenceName === "v12_added_wall_face" &&
      effect.stableId === wallStableId
  );
  checkSome(
    failures,
    "add.dimensionEdit.effects.ambiguousResultTopology",
    referenceEffects,
    (effect) =>
      effect.category === "replaced" &&
      effect.bodyId === "v12_body_add" &&
      effect.diagnosticCode === "AMBIGUOUS_RESULT_TOPOLOGY"
  );
  checks += 3;

  const health = executeQuery(engine, {
    query: "reference.health",
    target: { type: "namedReference", name: "v12_added_wall_face" }
  });
  checkEqual(failures, "add.dimensionEdit.wallHealth.ok", true, health.ok);
  checkEqual(
    failures,
    "add.dimensionEdit.wallHealth.status",
    "active",
    health.status
  );
  checks += 2;

  checkNoBoundaryLeaks(
    failures,
    "add.dimensionEdit.referenceEffects",
    JSON.stringify(referenceEffects)
  );

  return checks;
}

function verifyAddDimensionCreateReferenceEffects(engine, failures) {
  const capStableId = "generated:face:v12_body_add:endCap";
  const wallStableId = "generated:face:v12_body_add:side:uMin";
  let checks = 0;
  let edit;

  try {
    edit = engine.apply({
      op: "sketch.dimension.create",
      id: "v12_add_target_height",
      name: "V12 add target height",
      sketchId: "v12_add_target_sketch",
      entityId: "v12_add_target_rect",
      target: { entityKind: "rectangle", role: "height" },
      value: 5
    });
  } catch (error) {
    failures.push(`add.dimensionCreate.commit: threw ${formatError(error)}`);
    return checks + 1;
  }

  const features = edit.transaction?.diff?.features ?? {};
  const referenceEffects = features.referenceEffects ?? [];

  checkSome(
    failures,
    "add.dimensionCreate.modified.sourceFeature",
    features.modified ?? [],
    (feature) => feature.id === "v12_feat_add_target"
  );
  checkSome(
    failures,
    "add.dimensionCreate.modified.addFeature",
    features.modified ?? [],
    (feature) => feature.id === "v12_feat_add"
  );
  checkSome(
    failures,
    "add.dimensionCreate.effects.capGeneratedActive",
    referenceEffects,
    (effect) =>
      effect.category === "active" &&
      effect.bodyId === "v12_body_add" &&
      effect.stableId === capStableId &&
      effect.kind === "face" &&
      effect.sourceFeatureId === "v12_feat_add_target" &&
      effect.targetFeatureId === "v12_feat_add"
  );
  checkSome(
    failures,
    "add.dimensionCreate.effects.wallNamedActive",
    referenceEffects,
    (effect) =>
      effect.category === "active" &&
      effect.referenceName === "v12_added_wall_face" &&
      effect.stableId === wallStableId
  );
  checkSome(
    failures,
    "add.dimensionCreate.effects.ambiguousResultTopology",
    referenceEffects,
    (effect) =>
      effect.category === "replaced" &&
      effect.bodyId === "v12_body_add" &&
      effect.diagnosticCode === "AMBIGUOUS_RESULT_TOPOLOGY"
  );
  checks += 5;

  const health = executeQuery(engine, {
    query: "reference.health",
    target: { type: "namedReference", name: "v12_added_cap_face" }
  });
  checkEqual(failures, "add.dimensionCreate.capHealth.ok", true, health.ok);
  checkEqual(
    failures,
    "add.dimensionCreate.capHealth.status",
    "active",
    health.status
  );
  checks += 2;

  checkNoBoundaryLeaks(
    failures,
    "add.dimensionCreate.referenceEffects",
    JSON.stringify(referenceEffects)
  );

  return checks;
}

async function verifySourceRoundTrip({ cadCore, engine, failures, label }) {
  const json = cadCore.exportCadProjectJson(engine);
  const parsed = cadCore.parseCadProjectJson(json);
  const restoredFromJson = cadCore.importCadProjectJson(json);
  const exported = await cadCore.exportCadProjectWcad(engine);
  const read = await cadCore.readCadProjectWcad(exported.bytes);
  const importedFromWcad = await cadCore.importCadProjectWcad(exported.bytes);
  const importedProject = cadCore.parseCadProjectJson(
    cadCore.exportCadProjectJson(importedFromWcad)
  );

  checkEqual(
    failures,
    `${label}.jsonRoundTrip`,
    stableJson(parsed),
    stableJson(
      cadCore.parseCadProjectJson(
        cadCore.exportCadProjectJson(restoredFromJson)
      )
    )
  );
  checkEqual(failures, `${label}.wcad.read.ok`, true, read.ok);
  checkEqual(
    failures,
    `${label}.wcad.packageVersion`,
    "partbench.wcad.v1",
    exported.manifest.packageVersion
  );
  checkEqual(
    failures,
    `${label}.wcad.schema`,
    parsed.schemaVersion,
    exported.manifest.document.schemaVersion
  );

  if (read.ok) {
    checkEqual(
      failures,
      `${label}.wcad.sourceIdentityAlgorithm`,
      "partbench-source-v1",
      exported.sourceIdentity.algorithm
    );
    checkEqual(
      failures,
      `${label}.wcadRoundTrip`,
      stableJson(parsed),
      stableJson(importedProject)
    );
    checkEqual(
      failures,
      `${label}.wcad.diagnostics`,
      0,
      read.diagnostics.length
    );
  }

  checkNoBoundaryLeaks(failures, `${label}.projectJson`, json);
  checkNoBoundaryLeaks(
    failures,
    `${label}.wcadMetadata`,
    JSON.stringify({
      manifest: exported.manifest,
      sourceIdentity: exported.sourceIdentity,
      project: read.project
    })
  );

  return read.ok ? 9 : 5;
}

function executeQuery(engine, query) {
  return engine.executeQuery({ version: "cadops.v1", query });
}

function createSampleResult({
  id,
  failures,
  topologyCheckCount,
  referenceCheckCount,
  measurementCheckCount,
  roundTripCheckCount
}) {
  return {
    id,
    status: failures.length > 0 ? "fail" : "pass",
    topologyCheckCount,
    referenceCheckCount,
    measurementCheckCount,
    roundTripCheckCount,
    failures
  };
}

function stableJson(value) {
  return JSON.stringify(sortForStableJson(value));
}

function sortForStableJson(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortForStableJson(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortForStableJson(item)])
    );
  }

  return value;
}

function checkEqual(failures, label, expected, actual) {
  if (actual !== expected) {
    failures.push(
      `${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    );
  }
}

function checkIncludes(failures, label, values, expected) {
  if (!values.includes(expected)) {
    failures.push(
      `${label}: expected ${JSON.stringify(values)} to include ${JSON.stringify(expected)}`
    );
  }
}

function checkSome(failures, label, values, predicate) {
  if (!values.some(predicate)) {
    failures.push(
      `${label}: expected a matching entry in ${JSON.stringify(values)}`
    );
  }
}

function checkAtLeast(failures, label, actual, minimum) {
  if (actual < minimum) {
    failures.push(`${label}: expected ${actual} to be at least ${minimum}`);
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function checkNoBoundaryLeaks(failures, label, text) {
  const patterns = [
    V11_RELEASE_BOUNDARY_LEAK_PATTERN,
    V12_RELEASE_BOUNDARY_LEAK_PATTERN
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      failures.push(`${label}: leaked private boundary token ${match[0]}`);
      return;
    }
  }
}

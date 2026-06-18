import { V8_RELEASE_BOUNDARY_LEAK_PATTERN } from "./v8-release-samples.mjs";

export const V10_RELEASE_BOUNDARY_LEAK_PATTERN =
  /rendererId|renderId|meshId|occtId|occtShape|cacheKey|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|fileHandle|fileSystemHandle|opfsPath|localPath|absolutePath|gpuBufferId|pixelId|viewportState/i;

export async function runV10ReleaseSampleSmoke(cadCore, options = {}) {
  const fixtures = options.fixtures ?? cadCore.listV10ReleaseSampleFixtures();
  const samples = [];

  for (const fixture of fixtures) {
    samples.push(await evaluateV10Fixture(cadCore, fixture));
  }

  const failedCount = samples.filter(
    (sample) => sample.status === "fail"
  ).length;
  const result = {
    ok: failedCount === 0,
    sampleCount: samples.length,
    passedCount: samples.length - failedCount,
    failedCount,
    editCheckCount: samples.reduce(
      (sum, sample) => sum + sample.editCheckCount,
      0
    ),
    rebuildCheckCount: samples.reduce(
      (sum, sample) => sum + sample.rebuildCheckCount,
      0
    ),
    repairCheckCount: samples.reduce(
      (sum, sample) => sum + sample.repairCheckCount,
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
    "V10 release smoke result",
    JSON.stringify(result)
  );
  checkNoBoundaryLeaks(
    boundaryFailures,
    "V10 release smoke result",
    JSON.stringify(fixtures)
  );

  if (boundaryFailures.length > 0) {
    return {
      ...result,
      ok: false,
      boundaryFailures
    };
  }

  return result;
}

export function formatV10ReleaseSampleSmokeSummary(result) {
  const lines = [
    `V10 release edit/rebuild smoke ${result.ok ? "passed" : "failed"}`,
    `samples: ${result.passedCount} passed, ${result.failedCount} failed, ${result.sampleCount} total`,
    `checks: ${result.editCheckCount} edit, ${result.rebuildCheckCount} rebuild, ${result.repairCheckCount} repair, ${result.roundTripCheckCount} round-trip`
  ];

  for (const sample of result.samples) {
    lines.push(
      `- ${sample.status} ${sample.id} | edits ${sample.editCheckCount} | rebuild ${sample.rebuild.status}/${sample.rebuild.lifecycleBodyCount} bodies | repairs ${sample.repairCheckCount} | round-trips ${sample.roundTripCheckCount}`
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

async function evaluateV10Fixture(cadCore, fixture) {
  const failures = [];
  const engine = new cadCore.CadEngine();
  const batch = cadCore.createV10ReleaseSampleBatch(fixture.id);
  const batchResponse = engine.executeBatch(batch);

  checkEqual(failures, "batch.version", "cadops.v1", batch.version);
  checkEqual(failures, "batch.mode", "commit", batch.mode);
  checkEqual(
    failures,
    "batch.ops.length",
    fixture.ops.length,
    batch.ops.length
  );
  checkEqual(failures, "batch.ok", true, batchResponse.ok);
  checkNoBoundaryLeaks(
    failures,
    "V10 fixture metadata",
    JSON.stringify(fixture)
  );

  let editCheckCount = 0;
  let rebuildCheckCount = 0;
  let repairCheckCount = 0;
  let roundTripCheckCount = 0;
  let rebuild = createEmptyRebuildSummary();

  if (batchResponse.ok) {
    try {
      const baseline = await verifySourceRoundTrip({
        cadCore,
        engine,
        failures,
        label: `${fixture.id}.initial`
      });
      roundTripCheckCount += baseline.checkCount;
    } catch (error) {
      failures.push(`initial source round-trip threw: ${formatError(error)}`);
    }

    try {
      editCheckCount += verifyEditability(engine, fixture, failures);
    } catch (error) {
      failures.push(`editability verification threw: ${formatError(error)}`);
    }

    try {
      rebuildCheckCount += verifyInitialRebuildPlan(engine, fixture, failures);
    } catch (error) {
      failures.push(
        `initial rebuild verification threw: ${formatError(error)}`
      );
    }

    try {
      switch (fixture.id) {
        case "v10-extrude-edit-attached-sketch": {
          const result = await runAttachedSketchEditChain({
            cadCore,
            engine,
            fixture,
            failures
          });
          editCheckCount += result.editCheckCount;
          rebuildCheckCount += result.rebuildCheckCount;
          repairCheckCount += result.repairCheckCount;
          roundTripCheckCount += result.roundTripCheckCount;
          rebuild = result.rebuild;
          break;
        }
        case "v10-c2-feature-lifecycle-edits": {
          const result = await runC2FeatureLifecycleChain({
            cadCore,
            engine,
            fixture,
            failures
          });
          editCheckCount += result.editCheckCount;
          rebuildCheckCount += result.rebuildCheckCount;
          repairCheckCount += result.repairCheckCount;
          roundTripCheckCount += result.roundTripCheckCount;
          rebuild = result.rebuild;
          break;
        }
        case "v10-named-reference-repair-roundtrip": {
          const result = await runNamedReferenceRepairChain({
            cadCore,
            engine,
            fixture,
            failures
          });
          editCheckCount += result.editCheckCount;
          rebuildCheckCount += result.rebuildCheckCount;
          repairCheckCount += result.repairCheckCount;
          roundTripCheckCount += result.roundTripCheckCount;
          rebuild = result.rebuild;
          break;
        }
        default:
          failures.push(`Unsupported V10 fixture id: ${fixture.id}`);
      }
    } catch (error) {
      failures.push(`V10 fixture chain threw: ${formatError(error)}`);
    }
  }

  const sample = {
    id: fixture.id,
    title: fixture.title,
    status: failures.length > 0 ? "fail" : "pass",
    editCheckCount,
    rebuildCheckCount,
    repairCheckCount,
    roundTripCheckCount,
    rebuild,
    failures
  };

  checkNoBoundaryLeaks(
    sample.failures,
    "emitted V10 sample smoke metadata",
    JSON.stringify(sample)
  );
  sample.status = sample.failures.length > 0 ? "fail" : "pass";

  return sample;
}

async function runAttachedSketchEditChain({
  cadCore,
  engine,
  fixture,
  failures
}) {
  const beforeJson = cadCore.exportCadProjectJson(engine);
  const dryRun = engine.executeBatch({
    version: "cadops.v1",
    mode: "dryRun",
    ops: [
      {
        op: "feature.updateExtrude",
        id: "v10_attached_source_extrude",
        depth: 6,
        side: "negative"
      }
    ]
  });

  checkEqual(failures, "attached.edit.dryRun.ok", true, dryRun.ok);
  checkEqual(
    failures,
    "attached.edit.dryRun.nonMutation",
    beforeJson,
    cadCore.exportCadProjectJson(engine)
  );

  const commit = engine.apply({
    op: "feature.updateExtrude",
    id: "v10_attached_source_extrude",
    depth: 6,
    side: "negative"
  });
  const plan = readQuery(engine, { query: "project.rebuildPlan" });
  const graph = readQuery(engine, { query: "project.dependencyGraph" });
  const health = readQuery(engine, {
    query: "reference.health",
    target: { type: "namedReference", name: "V10 attached top face" }
  });
  const selection = readQuery(engine, {
    query: "selection.referenceCandidates",
    selection: { type: "namedReference", name: "V10 attached top face" },
    requiredOperation: "feature.attachSketchPlane"
  });
  const childSketch = readQuery(engine, {
    query: "sketch.get",
    id: "v10_attached_child_sketch"
  });

  checkTransactionFeatureEffects(failures, "attached.edit", commit, {
    modifiedFeatureId: "v10_attached_source_extrude",
    modifiedBodyId: "v10_attached_source_body",
    expectedLifecycleCode: "REBUILD_DERIVED_PENDING"
  });
  checkRebuildPlan(failures, "attached.rebuild", fixture, plan);
  checkEqual(failures, "attached.graph.ok", true, graph.ok);
  checkEqual(failures, "attached.health.status", "active", health.status);
  checkEqual(
    failures,
    "attached.health.commandable",
    true,
    health.referenceHealth.some(
      (entry) =>
        entry.referenceName === "V10 attached top face" &&
        entry.status === "active" &&
        entry.commandable
    )
  );
  checkEqual(
    failures,
    "attached.selection.status",
    "resolved",
    selection.status
  );
  checkEqual(
    failures,
    "attached.selection.commandable",
    true,
    selection.candidates.some((candidate) => candidate.commandable)
  );
  checkEqual(
    failures,
    "attached.childSketch.attachment",
    "v10_attached_source_body",
    childSketch.sketch?.attachment?.bodyId
  );
  checkNoBoundaryLeaks(
    failures,
    "attached V10 query responses",
    JSON.stringify({ plan, graph, health, selection, childSketch })
  );

  const roundTrip = await verifySourceRoundTrip({
    cadCore,
    engine,
    failures,
    label: "attached.committed"
  });

  return {
    editCheckCount: 4,
    rebuildCheckCount: 4,
    repairCheckCount: 0,
    roundTripCheckCount: roundTrip.checkCount,
    rebuild: summarizeRebuild(plan)
  };
}

async function runC2FeatureLifecycleChain({
  cadCore,
  engine,
  fixture,
  failures
}) {
  const updates = [
    {
      op: "feature.updateRevolve",
      id: "v10_c2_revolve_feature",
      angleDegrees: 180
    },
    {
      op: "feature.updateHole",
      id: "v10_c2_hole_feature",
      depthMode: "throughAll",
      direction: "positive"
    },
    {
      op: "feature.updateChamfer",
      id: "v10_c2_chamfer_feature",
      distance: 0.55
    },
    {
      op: "feature.updateFillet",
      id: "v10_c2_fillet_feature",
      radius: 0.5
    }
  ];
  let editCheckCount = 0;

  for (const op of updates) {
    const beforeJson = cadCore.exportCadProjectJson(engine);
    const dryRun = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [op]
    });

    checkEqual(failures, `${op.op}.dryRun.ok`, true, dryRun.ok);
    checkEqual(
      failures,
      `${op.op}.dryRun.nonMutation`,
      beforeJson,
      cadCore.exportCadProjectJson(engine)
    );
    editCheckCount += 2;
  }

  const commit = engine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: updates
  });
  const plan = readQuery(engine, { query: "project.rebuildPlan" });
  const graph = readQuery(engine, { query: "project.dependencyGraph" });
  const holeReferences = readQuery(engine, {
    query: "body.generatedReferences",
    bodyId: "v10_c2_hole_body"
  });
  const revolveReferences = readQuery(engine, {
    query: "body.generatedReferences",
    bodyId: "v10_c2_revolve_body"
  });
  const holeHealth = readQuery(engine, {
    query: "reference.health",
    target: { type: "body", bodyId: "v10_c2_hole_body" }
  });
  const filletHealth = readQuery(engine, {
    query: "reference.health",
    target: { type: "body", bodyId: "v10_c2_fillet_body" }
  });
  const holeWallSelection = readQuery(engine, {
    query: "selection.referenceCandidates",
    selection: {
      type: "generatedReference",
      bodyId: "v10_c2_hole_body",
      stableId: "generated:face:v10_c2_hole_body:holeWall",
      expectedKind: "face"
    },
    requiredOperation: "feature.selectReference"
  });

  checkEqual(failures, "c2.commit.ok", true, commit.ok);
  checkEqual(
    failures,
    "c2.commit.modifiedFeatureCount",
    updates.length,
    commit.modifiedFeatureIds?.length ?? 0
  );
  checkRebuildPlan(failures, "c2.rebuild", fixture, plan);
  checkEqual(failures, "c2.graph.ok", true, graph.ok);
  checkEqual(
    failures,
    "c2.holeReferences.faceCount",
    1,
    holeReferences.faceCount
  );
  checkEqual(
    failures,
    "c2.holeReferences.edgeCount",
    1,
    holeReferences.edgeCount
  );
  checkEqual(
    failures,
    "c2.holeReferences.axisCount",
    1,
    holeReferences.axisCount
  );
  checkEqual(
    failures,
    "c2.holeReferences.holeWall",
    true,
    holeReferences.faces.some(
      (face) => face.stableId === "generated:face:v10_c2_hole_body:holeWall"
    )
  );
  checkEqual(
    failures,
    "c2.holeReferences.startRim",
    true,
    holeReferences.edges.some(
      (edge) => edge.stableId === "generated:edge:v10_c2_hole_body:startRim"
    )
  );
  checkEqual(
    failures,
    "c2.holeReferences.holeAxis",
    true,
    holeReferences.axes.some(
      (axis) => axis.stableId === "generated:axis:v10_c2_hole_body:holeAxis"
    )
  );
  checkEqual(
    failures,
    "c2.revolveReferences.axisCount",
    1,
    revolveReferences.axisCount
  );
  checkEqual(failures, "c2.holeHealth.status", "active", holeHealth.status);
  checkEqual(
    failures,
    "c2.filletHealth.status",
    "repair-needed",
    filletHealth.status
  );
  checkEqual(
    failures,
    "c2.holeWallSelection.status",
    "resolved",
    holeWallSelection.status
  );
  checkNoBoundaryLeaks(
    failures,
    "C2 V10 query responses",
    JSON.stringify({
      plan,
      graph,
      holeReferences,
      revolveReferences,
      holeHealth,
      filletHealth,
      holeWallSelection
    })
  );

  const roundTrip = await verifySourceRoundTrip({
    cadCore,
    engine,
    failures,
    label: "c2.committed"
  });

  return {
    editCheckCount: editCheckCount + 2,
    rebuildCheckCount: 8,
    repairCheckCount: 0,
    roundTripCheckCount: roundTrip.checkCount,
    rebuild: summarizeRebuild(plan)
  };
}

async function runNamedReferenceRepairChain({
  cadCore,
  engine,
  fixture,
  failures
}) {
  const initialHealth = readQuery(engine, {
    query: "reference.health",
    target: { type: "namedReference", name: "V10 repair face" }
  });

  checkEqual(
    failures,
    "repair.initialHealth.status",
    "active",
    initialHealth.status
  );

  engine.apply({ op: "feature.delete", id: "v10_repair_old_extrude" });

  const staleResolve = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "reference.resolveNamed", name: "V10 repair face" }
  });
  const staleHealth = readQuery(engine, {
    query: "reference.health",
    target: { type: "namedReference", name: "V10 repair face" }
  });
  const beforeRepairJson = cadCore.exportCadProjectJson(engine);
  const repairOp = {
    op: "reference.repairName",
    name: "V10 repair face",
    bodyId: "v10_repair_new_body",
    stableId: "generated:face:v10_repair_new_body:endCap"
  };
  const dryRun = engine.executeBatch({
    version: "cadops.v1",
    mode: "dryRun",
    ops: [repairOp]
  });

  checkEqual(failures, "repair.staleResolve.ok", false, staleResolve.ok);
  checkEqual(
    failures,
    "repair.staleHealth.status",
    "missing",
    staleHealth.status
  );
  checkEqual(failures, "repair.dryRun.ok", true, dryRun.ok);
  checkEqual(
    failures,
    "repair.dryRun.nonMutation",
    beforeRepairJson,
    cadCore.exportCadProjectJson(engine)
  );

  const repairCommit = engine.apply(repairOp);
  const repairedHealth = readQuery(engine, {
    query: "reference.health",
    target: { type: "namedReference", name: "V10 repair face" }
  });
  const repairedSelection = readQuery(engine, {
    query: "selection.referenceCandidates",
    selection: { type: "namedReference", name: "V10 repair face" },
    requiredOperation: "feature.attachSketchPlane"
  });

  checkEqual(
    failures,
    "repair.commit.diff",
    true,
    Boolean(repairCommit.transaction.diff.references?.namedRepaired?.length)
  );
  checkEqual(
    failures,
    "repair.repairedHealth.status",
    "active",
    repairedHealth.status
  );
  checkEqual(
    failures,
    "repair.repairedHealth.targetBody",
    true,
    repairedHealth.referenceHealth.some(
      (entry) =>
        entry.referenceName === "V10 repair face" &&
        entry.bodyId === "v10_repair_new_body" &&
        entry.commandable
    )
  );
  checkEqual(
    failures,
    "repair.repairedSelection.status",
    "resolved",
    repairedSelection.status
  );

  const editDryRunJson = cadCore.exportCadProjectJson(engine);
  const editDryRun = engine.executeBatch({
    version: "cadops.v1",
    mode: "dryRun",
    ops: [
      {
        op: "feature.updateExtrude",
        id: "v10_repair_new_extrude",
        depth: 5
      }
    ]
  });

  checkEqual(failures, "repair.editDryRun.ok", true, editDryRun.ok);
  checkEqual(
    failures,
    "repair.editDryRun.nonMutation",
    editDryRunJson,
    cadCore.exportCadProjectJson(engine)
  );

  engine.apply({
    op: "feature.updateExtrude",
    id: "v10_repair_new_extrude",
    depth: 5
  });

  const plan = readQuery(engine, { query: "project.rebuildPlan" });
  const graph = readQuery(engine, { query: "project.dependencyGraph" });
  const finalHealth = readQuery(engine, {
    query: "reference.health",
    target: { type: "namedReference", name: "V10 repair face" }
  });

  checkRebuildPlan(failures, "repair.rebuild", fixture, plan);
  checkEqual(failures, "repair.graph.ok", true, graph.ok);
  checkEqual(
    failures,
    "repair.finalHealth.status",
    "active",
    finalHealth.status
  );
  checkNoBoundaryLeaks(
    failures,
    "repair V10 query responses",
    JSON.stringify({
      initialHealth,
      staleResolve,
      staleHealth,
      repairedHealth,
      repairedSelection,
      plan,
      graph,
      finalHealth
    })
  );

  const roundTrip = await verifySourceRoundTrip({
    cadCore,
    engine,
    failures,
    label: "repair.committed"
  });

  return {
    editCheckCount: 4,
    rebuildCheckCount: 3,
    repairCheckCount: 7,
    roundTripCheckCount: roundTrip.checkCount,
    rebuild: summarizeRebuild(plan)
  };
}

function verifyEditability(engine, fixture, failures) {
  let checkCount = 0;

  for (const expectation of fixture.expectedEditability) {
    const proposedEdit = proposedEditForOperation(
      expectation.expectedCommitOperation
    );
    const response = readQuery(engine, {
      query: "feature.editability",
      featureId: expectation.featureId,
      proposedEdit
    });
    const label = `editability.${expectation.featureId}`;

    checkEqual(
      failures,
      `${label}.status`,
      expectation.expectedStatus,
      response.status
    );
    checkEqual(
      failures,
      `${label}.dryRun.commitOperation`,
      expectation.expectedCommitOperation,
      response.dryRun.commitOperation
    );
    checkEqual(
      failures,
      `${label}.requiresProjectSchemaMigration`,
      false,
      response.requiresProjectSchemaMigration
    );

    for (const category of expectation.expectedReferenceCategories) {
      checkEqual(
        failures,
        `${label}.referenceCategory.${category}`,
        true,
        response.referenceChanges.some((change) => change.category === category)
      );
    }

    checkNoBoundaryLeaks(failures, label, JSON.stringify(response));
    checkCount += 4 + expectation.expectedReferenceCategories.length;
  }

  return checkCount;
}

function verifyInitialRebuildPlan(engine, fixture, failures) {
  const plan = readQuery(engine, { query: "project.rebuildPlan" });

  checkEqual(
    failures,
    `${fixture.id}.initialRebuild.status`,
    fixture.expectedRebuild.initialStatus,
    plan.status
  );
  checkEqual(
    failures,
    `${fixture.id}.initialRebuild.requiresProjectSchemaMigration`,
    false,
    plan.requiresProjectSchemaMigration
  );
  checkNoBoundaryLeaks(
    failures,
    `${fixture.id}.initialRebuild`,
    JSON.stringify(plan)
  );

  return 2;
}

function checkRebuildPlan(failures, label, fixture, plan) {
  checkEqual(
    failures,
    `${label}.status`,
    fixture.expectedRebuild.committedStatus,
    plan.status
  );
  checkEqual(
    failures,
    `${label}.requiresProjectSchemaMigration`,
    false,
    plan.requiresProjectSchemaMigration
  );

  for (const bodyId of fixture.expectedRebuild.expectedLifecycleBodies) {
    checkEqual(
      failures,
      `${label}.lifecycleBody.${bodyId}`,
      true,
      plan.bodyLifecycles.some((lifecycle) => lifecycle.bodyId === bodyId)
    );
  }

  if (fixture.expectedRebuild.committedStatus === "pending") {
    checkEqual(
      failures,
      `${label}.pendingEffect`,
      true,
      plan.lifecycleEffects.some(
        (effect) => effect.diagnosticCode === "REBUILD_DERIVED_PENDING"
      )
    );
  }
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
    `${label}.project.schemaVersion`,
    cadCore.CURRENT_CAD_PROJECT_FORMAT_VERSION,
    parsed.schemaVersion
  );
  checkEqual(
    failures,
    `${label}.project.excludesV17`,
    false,
    json.includes("web-cad.project.v17")
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

  if (read.ok) {
    checkEqual(
      failures,
      `${label}.wcad.packageVersion`,
      "partbench.wcad.v1",
      exported.manifest.packageVersion
    );
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
    checkNoBoundaryLeaks(
      failures,
      `${label}.wcadMetadata`,
      JSON.stringify({
        manifest: exported.manifest,
        sourceIdentity: exported.sourceIdentity,
        project: read.project
      })
    );
  }

  checkNoBoundaryLeaks(failures, `${label}.projectJson`, json);

  return { checkCount: read.ok ? 8 : 4 };
}

function checkTransactionFeatureEffects(failures, label, result, expected) {
  const features = result.transaction?.diff?.features;

  checkEqual(
    failures,
    `${label}.modifiedFeature`,
    true,
    features?.modified?.some(
      (feature) => feature.id === expected.modifiedFeatureId
    ) ?? false
  );
  checkEqual(
    failures,
    `${label}.modifiedBody`,
    true,
    features?.bodiesModified?.some(
      (body) => body.id === expected.modifiedBodyId
    ) ?? false
  );
  checkEqual(
    failures,
    `${label}.lifecycleEffect`,
    true,
    features?.lifecycleEffects?.some(
      (effect) => effect.diagnosticCode === expected.expectedLifecycleCode
    ) ?? false
  );
}

function readQuery(engine, query) {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query
  });

  if (!response.ok) {
    throw new Error(
      `Expected ${query.query} response, got ${response.error?.code ?? "error"}`
    );
  }

  return response;
}

function proposedEditForOperation(op) {
  switch (op) {
    case "feature.updateExtrude":
      return { kind: "extrude", depth: 6, side: "negative" };
    case "feature.updateRevolve":
      return { kind: "revolve", angleDegrees: 180 };
    case "feature.updateHole":
      return { kind: "hole", depthMode: "throughAll", direction: "positive" };
    case "feature.updateChamfer":
      return { kind: "chamfer", distance: 0.55 };
    case "feature.updateFillet":
      return { kind: "fillet", radius: 0.5 };
    default:
      throw new Error(`Unsupported edit operation in V10 smoke: ${op}`);
  }
}

function summarizeRebuild(plan) {
  return {
    status: plan.status,
    lifecycleBodyCount: plan.bodyLifecycleCount,
    lifecycleEffectCount: plan.lifecycleEffectCount,
    diagnosticCodes: unique(
      plan.diagnostics.map((diagnostic) => diagnostic.code)
    ),
    lifecycleStates: unique(
      plan.bodyLifecycles.map((lifecycle) => lifecycle.primaryState)
    )
  };
}

function createEmptyRebuildSummary() {
  return {
    status: "unknown",
    lifecycleBodyCount: 0,
    lifecycleEffectCount: 0,
    diagnosticCodes: [],
    lifecycleStates: []
  };
}

function checkEqual(failures, label, expected, actual) {
  if (actual !== expected) {
    failures.push(
      `${label}: expected ${formatValue(expected)}, got ${formatValue(actual)}`
    );
  }
}

function checkNoBoundaryLeaks(failures, label, text) {
  if (
    V10_RELEASE_BOUNDARY_LEAK_PATTERN.test(text) ||
    V8_RELEASE_BOUNDARY_LEAK_PATTERN.test(text)
  ) {
    failures.push(
      `${label}: leaked raw renderer/mesh/OCCT/cache/selection-buffer/file-handle/viewport identifier`
    );
  }
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
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortForStableJson(child)])
    );
  }

  return value;
}

function unique(values) {
  return [...new Set(values)].sort();
}

function formatValue(value) {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

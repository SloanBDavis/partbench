export const V14_RELEASE_BOUNDARY_LEAK_PATTERN =
  /\b(?:rendererId|renderId|meshId|occtId|occtShape|cacheKey|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|fileHandle|fileSystemHandle|opfsPath|localPath|absolutePath|gpuId|gpuBuffer|gpuBufferId|exportArtifactId|pixelId|viewportState|topologyIndex|checkpointEntityId|checkpoint-local[-_a-z0-9]*)\b/i;

const V14_RELEASE_SOURCE_BOUNDARY_LEAK_PATTERN =
  /\b(?:rendererId|renderId|meshId|occtId|occtShape|cacheKey|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|fileHandle|fileSystemHandle|opfsPath|localPath|absolutePath|gpuId|gpuBuffer|gpuBufferId|exportArtifactId|pixelId|viewportState|topologyIndex)\b/i;

export async function runV14ReleaseSampleSmoke(cadCore, options = {}) {
  const fixtures = options.fixtures ?? cadCore.listV14ReleaseSampleFixtures();
  const samples = await Promise.all(
    fixtures.map((fixture) => evaluateV14Fixture(cadCore, fixture))
  );
  const failedCount = samples.filter(
    (sample) => sample.status === "fail"
  ).length;
  const invariantFailures = createReleaseGateInvariantFailures(samples);
  const result = {
    ok: failedCount === 0 && invariantFailures.length === 0,
    sampleCount: samples.length,
    passedCount: samples.length - failedCount,
    failedCount,
    operationCheckCount: sumSampleChecks(samples, "operationCheckCount"),
    readinessCheckCount: sumSampleChecks(samples, "readinessCheckCount"),
    lifecycleCheckCount: sumSampleChecks(samples, "lifecycleCheckCount"),
    roundTripCheckCount: sumSampleChecks(samples, "roundTripCheckCount"),
    boundaryCheckCount: sumSampleChecks(samples, "boundaryCheckCount"),
    samples,
    invariantFailures
  };
  const boundaryFailures = [];

  checkNoBoundaryLeaks(
    boundaryFailures,
    "V14 release smoke result",
    JSON.stringify(result)
  );

  if (boundaryFailures.length > 0) {
    return { ...result, ok: false, boundaryFailures };
  }

  return result;
}

export function formatV14ReleaseSampleSmokeSummary(result) {
  const lines = [
    `V14 topology-backed modeling smoke ${result.ok ? "passed" : "failed"}`,
    `samples: ${result.passedCount} passed, ${result.failedCount} failed, ${result.sampleCount} total`,
    `checks: ${result.operationCheckCount} operation, ${result.readinessCheckCount} readiness, ${result.lifecycleCheckCount} lifecycle, ${result.roundTripCheckCount} round-trip, ${result.boundaryCheckCount} boundary`
  ];

  for (const sample of result.samples) {
    lines.push(
      `- ${sample.status} ${sample.id} | operation ${sample.operationCheckCount} | readiness ${sample.readinessCheckCount} | lifecycle ${sample.lifecycleCheckCount} | round-trips ${sample.roundTripCheckCount} | boundary ${sample.boundaryCheckCount}`
    );

    for (const failure of sample.failures) {
      lines.push(`  - ${failure}`);
    }
  }

  for (const failure of result.boundaryFailures ?? []) {
    lines.push(`- boundary-fail ${failure}`);
  }

  for (const failure of result.invariantFailures ?? []) {
    lines.push(`- invariant-fail ${failure}`);
  }

  return lines.join("\n");
}

function createReleaseGateInvariantFailures(samples) {
  const failures = [];
  if (samples.length === 0) {
    failures.push("V14 release smoke requires at least one fixture.");
  }

  const totals = {
    operation: sumSampleChecks(samples, "operationCheckCount"),
    readiness: sumSampleChecks(samples, "readinessCheckCount"),
    lifecycle: sumSampleChecks(samples, "lifecycleCheckCount"),
    "round-trip": sumSampleChecks(samples, "roundTripCheckCount"),
    boundary: sumSampleChecks(samples, "boundaryCheckCount")
  };

  for (const [kind, count] of Object.entries(totals)) {
    if (count <= 0) {
      failures.push(`V14 release smoke requires ${kind} checks.`);
    }
  }

  return failures;
}

async function evaluateV14Fixture(cadCore, fixture) {
  const failures = [];
  const engine = new cadCore.CadEngine();
  const batch = cadCore.createV14ReleaseSampleBatch(fixture.id);
  let operationCheckCount = 0;
  let readinessCheckCount = 0;
  let lifecycleCheckCount = 0;
  let roundTripCheckCount = 0;
  let boundaryCheckCount = 0;

  checkEqual(failures, "batch.version", "cadops.v1", batch.version);
  checkEqual(failures, "batch.mode", "commit", batch.mode);
  checkEqual(
    failures,
    "batch.ops.length",
    fixture.ops.length,
    batch.ops.length
  );
  operationCheckCount += 3;

  const beforeDryRunJson = cadCore.exportCadProjectJson(engine);
  const dryRun = engine.executeBatch({ ...batch, mode: "dryRun" });
  checkEqual(failures, "dryRun.ok", true, dryRun.ok);
  checkEqual(
    failures,
    "dryRun.mutatesSource",
    beforeDryRunJson,
    cadCore.exportCadProjectJson(engine)
  );
  operationCheckCount += 2;

  const commit = engine.executeBatch(batch);
  checkEqual(failures, "commit.ok", true, commit.ok);
  operationCheckCount += 1;

  if (commit.ok) {
    for (const expectation of fixture.expectedFeatures) {
      checkIncludes(
        failures,
        "commit.createdFeatureIds",
        commit.createdFeatureIds,
        expectation.featureId
      );
      if (expectation.bodyId) {
        checkIncludes(
          failures,
          "commit.createdBodyIds",
          commit.createdBodyIds,
          expectation.bodyId
        );
      }
      operationCheckCount += expectation.bodyId ? 2 : 1;
    }
  }

  let jsonRestoredEngine;
  try {
    const json = cadCore.exportCadProjectJson(engine);
    const project = cadCore.parseCadProjectJson(json);
    jsonRestoredEngine = cadCore.importCadProjectJson(json);
    const expectedSchemaVersion =
      fixture.expectedTopology.checkpointCount > 0
        ? cadCore.CAD_PROJECT_FORMAT_VERSION_V18
        : cadCore.CAD_PROJECT_FORMAT_VERSION_V16;

    checkEqual(
      failures,
      "project.schemaVersion",
      expectedSchemaVersion,
      project.schemaVersion
    );
    checkNoSourceBoundaryLeaks(failures, "project JSON", json);
    roundTripCheckCount += 2;
    boundaryCheckCount += 1;
  } catch (error) {
    failures.push(`project JSON round-trip threw: ${formatError(error)}`);
  }

  if (jsonRestoredEngine) {
    lifecycleCheckCount += verifyLifecycleSurfaces(
      jsonRestoredEngine,
      fixture,
      failures
    );
    readinessCheckCount += verifyReadinessSurfaces(cadCore, fixture, failures);
    operationCheckCount += verifyBlockedBatches(
      cadCore,
      jsonRestoredEngine,
      fixture,
      failures
    );
    boundaryCheckCount += verifyQueryBoundarySurfaces(
      jsonRestoredEngine,
      fixture,
      failures
    );
    roundTripCheckCount += await verifyWcadRoundTrip(
      cadCore,
      jsonRestoredEngine,
      fixture,
      failures
    );
  }

  return finalizeSampleResult({
    id: fixture.id,
    status: failures.length === 0 ? "pass" : "fail",
    failures,
    operationCheckCount,
    readinessCheckCount,
    lifecycleCheckCount,
    roundTripCheckCount,
    boundaryCheckCount
  });
}

function verifyLifecycleSurfaces(engine, fixture, failures) {
  const structure = readQuery(engine, {
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  const health = readQuery(engine, {
    version: "cadops.v1",
    query: { query: "project.health" }
  });
  const graph = readQuery(engine, {
    version: "cadops.v1",
    query: { query: "project.dependencyGraph" }
  });
  const history = readQuery(engine, {
    version: "cadops.v1",
    query: { query: "transaction.history" }
  });
  const topology = readQuery(engine, {
    version: "cadops.v1",
    query: { query: "project.topologyIdentityReadiness" }
  });
  let checks = 0;

  checkQueryKind(failures, structure, "project.structure");
  checkQueryKind(failures, health, "project.health");
  checkQueryKind(failures, graph, "project.dependencyGraph");
  checkQueryKind(failures, history, "transaction.history");
  checkQueryKind(failures, topology, "project.topologyIdentityReadiness");
  checks += 5;

  if (structure.ok) {
    for (const expectation of fixture.expectedFeatures) {
      const feature = structure.features.find(
        (candidate) => candidate.id === expectation.featureId
      );
      checkEqual(
        failures,
        `${expectation.featureId}.kind`,
        expectation.kind,
        feature?.kind
      );
      checkExpectedProperties(failures, expectation.featureId, expectation, {
        bodyId: feature?.bodyId,
        targetBodyId: feature?.targetBodyId,
        targetTopologyAnchorId: feature?.targetTopologyAnchorId,
        operationMode: feature?.operationMode,
        topologyAnchorId: feature?.topologyAnchorId,
        namedReference: feature?.namedReference
      });
      checks += 1 + countExpectedProperties(expectation);
    }
  }

  if (health.ok) {
    for (const expectation of fixture.expectedFeatures) {
      const entries = [
        ...(health.authoredExtrudes ?? []),
        ...(health.authoredHoles ?? []),
        ...(health.authoredChamfers ?? []),
        ...(health.authoredFillets ?? [])
      ];
      const entry = entries.find(
        (candidate) => candidate.featureId === expectation.featureId
      );
      checkEqual(
        failures,
        `${expectation.featureId}.health`,
        "healthy",
        entry?.status
      );
      checks += 1;
    }
  }

  if (topology.ok) {
    checkEqual(
      failures,
      "topology.checkpointCount",
      fixture.expectedTopology.checkpointCount,
      topology.checkpointCount
    );
    checkEqual(
      failures,
      "topology.anchorCount",
      fixture.expectedTopology.anchorCount,
      topology.anchorCount
    );
    for (const anchorId of fixture.expectedTopology.anchorIds) {
      checkIncludes(
        failures,
        "topology.anchors",
        topology.anchors.map((anchor) => anchor.anchorId),
        anchorId
      );
    }
    checks += 2 + fixture.expectedTopology.anchorIds.length;
  }

  for (const editability of fixture.expectedEditability ?? []) {
    const response = readQuery(engine, {
      version: "cadops.v1",
      query: {
        query: "feature.editability",
        featureId: editability.featureId
      }
    });
    checkQueryKind(failures, response, "feature.editability");
    checkEqual(
      failures,
      `${editability.featureId}.editability`,
      editability.expectedStatus,
      response.status
    );
    checks += 2;
  }

  checkNoBoundaryLeaks(
    failures,
    "project.structure",
    JSON.stringify(structure)
  );
  checkNoBoundaryLeaks(failures, "project.health", JSON.stringify(health));
  checkNoBoundaryLeaks(
    failures,
    "project.dependencyGraph",
    JSON.stringify(graph)
  );
  checkNoSourceBoundaryLeaks(
    failures,
    "transaction.history",
    JSON.stringify(history)
  );
  checkNoBoundaryLeaks(
    failures,
    "topology readiness",
    JSON.stringify(topology)
  );

  return checks;
}

function verifyReadinessSurfaces(cadCore, fixture, failures) {
  const readinessEngine = new cadCore.CadEngine();
  const response = readinessEngine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: fixture.ops.slice(0, fixture.readinessOpCount ?? fixture.ops.length)
  });
  let checks = 0;

  checkEqual(failures, "readinessSetup.ok", true, response.ok);
  checks += 1;

  if (!response.ok) {
    return checks;
  }

  for (const expectation of fixture.expectedReadiness) {
    const readiness = readQuery(readinessEngine, {
      version: "cadops.v1",
      query: {
        query: "topology.commandTargetReadiness",
        target: expectation.target,
        desiredOperation: expectation.operation,
        ...(expectation.snapshot ? { snapshot: expectation.snapshot } : {})
      }
    });
    const selection = readQuery(readinessEngine, {
      version: "cadops.v1",
      query: {
        query: "selection.referenceCandidates",
        selection: expectation.target,
        requiredOperation: expectation.operation
      }
    });

    checkQueryKind(failures, readiness, "topology.commandTargetReadiness");
    checkQueryKind(failures, selection, "selection.referenceCandidates");
    if (readiness.ok) {
      checkEqual(
        failures,
        `${expectation.label}.status`,
        expectation.expectedStatus,
        readiness.status
      );
      checkEqual(
        failures,
        `${expectation.label}.commandable`,
        expectation.expectedCommandable,
        readiness.commandable
      );
      for (const operation of expectation.expectedSupportedOperations) {
        checkIncludes(
          failures,
          `${expectation.label}.supportedOperations`,
          readiness.supportedOperations,
          operation
        );
      }
      checkNoBoundaryLeaks(
        failures,
        `${expectation.label}.readiness`,
        JSON.stringify(readiness)
      );
      checks += 2 + expectation.expectedSupportedOperations.length;
    }

    if (
      selection.ok &&
      !(
        expectation.snapshot &&
        expectation.target.type === "topologyAnchor" &&
        expectation.expectedCommandable
      )
    ) {
      checkEqual(
        failures,
        `${expectation.label}.selectionCommandable`,
        expectation.expectedCommandable,
        selection.candidates.some((candidate) => candidate.commandable)
      );
      checkNoBoundaryLeaks(
        failures,
        `${expectation.label}.selection`,
        JSON.stringify(selection)
      );
      checks += 1;
    }
  }

  return checks;
}

function verifyBlockedBatches(cadCore, engine, fixture, failures) {
  let checks = 0;

  for (const blocked of fixture.expectedBlockedBatches ?? []) {
    const beforeJson = cadCore.exportCadProjectJson(engine);
    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: blocked.ops
    });

    checkEqual(failures, `${blocked.label}.ok`, false, response.ok);
    checkEqual(
      failures,
      `${blocked.label}.code`,
      blocked.expectedCode,
      response.error?.code
    );
    checkEqual(
      failures,
      `${blocked.label}.path`,
      blocked.expectedPath,
      response.error?.path
    );
    checkEqual(
      failures,
      `${blocked.label}.mutatesSource`,
      beforeJson,
      cadCore.exportCadProjectJson(engine)
    );
    checks += 4;
  }

  return checks;
}

function verifyQueryBoundarySurfaces(engine, fixture, failures) {
  const payload = {};
  let checks = 0;

  for (const expectation of fixture.expectedReadiness) {
    payload[expectation.label] = readQuery(engine, {
      version: "cadops.v1",
      query: {
        query: "topology.commandTargetReadiness",
        target: expectation.target,
        desiredOperation: expectation.operation,
        ...(expectation.snapshot ? { snapshot: expectation.snapshot } : {})
      }
    });
    checks += 1;
  }

  checkNoBoundaryLeaks(
    failures,
    "query boundary surfaces",
    JSON.stringify(payload)
  );
  return checks;
}

async function verifyWcadRoundTrip(cadCore, engine, fixture, failures) {
  let checks = 0;

  try {
    const project = cadCore.exportCadProject(engine);
    const checkpointPayloads = cadCore.createV14ReleaseSampleCheckpointPayloads(
      fixture.id
    );
    const exported =
      checkpointPayloads.length > 0
        ? await cadCore.exportCadProjectToWcad(project, {
            createdAt: "2026-06-26T00:00:00.000Z",
            modifiedAt: "2026-06-26T00:00:00.000Z",
            topologyCheckpoints: checkpointPayloads
          })
        : await cadCore.exportCadProjectWcad(engine, {
            createdAt: "2026-06-26T00:00:00.000Z",
            modifiedAt: "2026-06-26T00:00:00.000Z"
          });
    const read = await cadCore.readCadProjectWcad(exported.bytes);

    checkEqual(
      failures,
      "wcad.packageVersion",
      checkpointPayloads.length > 0 ? "partbench.wcad.v2" : "partbench.wcad.v1",
      exported.manifest.packageVersion
    );
    checkEqual(
      failures,
      "wcad.checkpointPayloadCount",
      checkpointPayloads.length,
      exported.checkpointPayloads?.length ?? 0
    );
    checkNoBoundaryLeaks(
      failures,
      "wcad manifest",
      JSON.stringify(exported.manifest)
    );
    checks += 2;

    if (!read.ok) {
      failures.push(
        `wcad read: expected ok, got ${JSON.stringify(read.issues)}`
      );
      return checks;
    }

    const wcadEngine = cadCore.importCadProject(read.project);
    checks += verifyLifecycleSurfaces(wcadEngine, fixture, failures);
    checkNoSourceBoundaryLeaks(
      failures,
      "wcad read project",
      JSON.stringify(read.project)
    );
    checks += 2;

    for (const expected of checkpointPayloads) {
      const actual = read.checkpointPayloads?.find(
        (payload) => payload.checkpointId === expected.checkpointId
      );
      checkEqual(
        failures,
        `wcad.${expected.checkpointId}.bodyId`,
        expected.bodyId,
        actual?.bodyId
      );
      checkEqual(
        failures,
        `wcad.${expected.checkpointId}.brepBytes`,
        bytesToHex(expected.brepBytes),
        bytesToHex(actual?.brepBytes)
      );
      checkEqual(
        failures,
        `wcad.${expected.checkpointId}.topologyBytes`,
        bytesToHex(expected.topologyBytes),
        bytesToHex(actual?.topologyBytes)
      );
      checkEqual(
        failures,
        `wcad.${expected.checkpointId}.signatureBytes`,
        bytesToHex(expected.signatureBytes),
        bytesToHex(actual?.signatureBytes)
      );
      checks += 4;
    }
  } catch (error) {
    failures.push(`wcad round-trip threw: ${formatError(error)}`);
  }

  return checks;
}

function readQuery(engine, query) {
  try {
    return engine.executeQuery(query);
  } catch (error) {
    return {
      ok: false,
      query: query.query?.query ?? "unknown",
      error: { message: formatError(error) }
    };
  }
}

function checkQueryKind(failures, response, expectedQuery) {
  if (!response?.ok || response.query !== expectedQuery) {
    failures.push(
      `${expectedQuery}: expected ok query response, got ${JSON.stringify(response)}`
    );
  }
}

function checkExpectedProperties(failures, label, expected, actual) {
  for (const key of [
    "bodyId",
    "targetBodyId",
    "targetTopologyAnchorId",
    "topologyAnchorId",
    "operationMode",
    "namedReference"
  ]) {
    if (expected[key] !== undefined) {
      checkEqual(failures, `${label}.${key}`, expected[key], actual[key]);
    }
  }
}

function countExpectedProperties(expectation) {
  return [
    "bodyId",
    "targetBodyId",
    "targetTopologyAnchorId",
    "topologyAnchorId",
    "operationMode",
    "namedReference"
  ].filter((key) => expectation[key] !== undefined).length;
}

function checkEqual(failures, label, expected, actual) {
  if (actual !== expected) {
    failures.push(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function checkIncludes(failures, label, values, expectedValue) {
  if (!values?.includes(expectedValue)) {
    failures.push(
      `${label}: expected ${JSON.stringify(values)} to include ${JSON.stringify(expectedValue)}`
    );
  }
}

function checkNoBoundaryLeaks(failures, label, text) {
  if (V14_RELEASE_BOUNDARY_LEAK_PATTERN.test(text)) {
    failures.push(`${label}: leaked renderer/kernel/browser/cache identifier`);
  }
}

function checkNoSourceBoundaryLeaks(failures, label, text) {
  if (V14_RELEASE_SOURCE_BOUNDARY_LEAK_PATTERN.test(text)) {
    failures.push(`${label}: leaked renderer/kernel/browser/cache identifier`);
  }
}

function sumSampleChecks(samples, key) {
  return samples.reduce((sum, sample) => sum + sample[key], 0);
}

function bytesToHex(bytes) {
  if (!bytes) {
    return undefined;
  }

  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function finalizeSampleResult(sample) {
  return {
    ...sample,
    failures: [...sample.failures].sort()
  };
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

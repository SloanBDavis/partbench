export const V13_RELEASE_BOUNDARY_LEAK_PATTERN =
  /\b(?:rendererId|renderId|meshId|occtId|occtShape|cacheKey|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|fileHandle|fileSystemHandle|opfsPath|localPath|absolutePath|gpuId|gpuBuffer|gpuBufferId|exportArtifactId|pixelId|viewportState|topologyIndex|checkpointEntityId|checkpoint-local[-_a-z0-9]*)\b/i;

const V13_RELEASE_SOURCE_BOUNDARY_LEAK_PATTERN =
  /\b(?:rendererId|renderId|meshId|occtId|occtShape|cacheKey|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|fileHandle|fileSystemHandle|opfsPath|localPath|absolutePath|gpuId|gpuBuffer|gpuBufferId|exportArtifactId|pixelId|viewportState|topologyIndex)\b/i;

export async function runV13ReleaseSampleSmoke(cadCore, options = {}) {
  const fixtures = options.fixtures ?? cadCore.listV13ReleaseSampleFixtures();
  const samples = await Promise.all(
    fixtures.map((fixture) => evaluateV13Fixture(cadCore, fixture))
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
    topologyCheckCount: samples.reduce(
      (sum, sample) => sum + sample.topologyCheckCount,
      0
    ),
    referenceCheckCount: samples.reduce(
      (sum, sample) => sum + sample.referenceCheckCount,
      0
    ),
    commandCheckCount: samples.reduce(
      (sum, sample) => sum + sample.commandCheckCount,
      0
    ),
    matchCheckCount: samples.reduce(
      (sum, sample) => sum + sample.matchCheckCount,
      0
    ),
    roundTripCheckCount: samples.reduce(
      (sum, sample) => sum + sample.roundTripCheckCount,
      0
    ),
    samples,
    invariantFailures
  };
  const boundaryFailures = [];

  checkNoBoundaryLeaks(
    boundaryFailures,
    "V13 release smoke result",
    JSON.stringify(result)
  );

  if (boundaryFailures.length > 0) {
    return { ...result, ok: false, boundaryFailures };
  }

  return result;
}

export function formatV13ReleaseSampleSmokeSummary(result) {
  const lines = [
    `V13 topology identity smoke ${result.ok ? "passed" : "failed"}`,
    `samples: ${result.passedCount} passed, ${result.failedCount} failed, ${result.sampleCount} total`,
    `checks: ${result.topologyCheckCount} topology, ${result.referenceCheckCount} reference, ${result.commandCheckCount} command, ${result.matchCheckCount} match, ${result.roundTripCheckCount} round-trip`
  ];

  for (const sample of result.samples) {
    lines.push(
      `- ${sample.status} ${sample.id} | topology ${sample.topologyCheckCount} | reference ${sample.referenceCheckCount} | command ${sample.commandCheckCount} | match ${sample.matchCheckCount} | round-trips ${sample.roundTripCheckCount}`
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
    failures.push("V13 release smoke requires at least one fixture.");
  }

  const totals = {
    topology: samples.reduce(
      (sum, sample) => sum + sample.topologyCheckCount,
      0
    ),
    reference: samples.reduce(
      (sum, sample) => sum + sample.referenceCheckCount,
      0
    ),
    command: samples.reduce((sum, sample) => sum + sample.commandCheckCount, 0),
    match: samples.reduce((sum, sample) => sum + sample.matchCheckCount, 0),
    "round-trip": samples.reduce(
      (sum, sample) => sum + sample.roundTripCheckCount,
      0
    )
  };

  for (const [kind, count] of Object.entries(totals)) {
    if (count <= 0) {
      failures.push(`V13 release smoke requires ${kind} checks.`);
    }
  }

  return failures;
}

async function evaluateV13Fixture(cadCore, fixture) {
  const failures = [];
  const engine = new cadCore.CadEngine();
  const batch = cadCore.createV13ReleaseSampleBatch(fixture.id);
  const batchResponse = engine.executeBatch(batch);
  let topologyCheckCount = 0;
  let referenceCheckCount = 0;
  let commandCheckCount = 0;
  let matchCheckCount = 0;
  let roundTripCheckCount = 0;

  checkEqual(failures, "batch.version", "cadops.v1", batch.version);
  checkEqual(failures, "batch.mode", "commit", batch.mode);
  checkEqual(
    failures,
    "batch.ops.length",
    fixture.ops.length,
    batch.ops.length
  );
  checkEqual(failures, "batch.ok", true, batchResponse.ok);

  let restoredEngine;
  if (batchResponse.ok) {
    try {
      const json = cadCore.exportCadProjectJson(engine);
      const project = cadCore.parseCadProjectJson(json);
      restoredEngine = cadCore.importCadProjectJson(json);

      checkEqual(
        failures,
        "project.schemaVersion",
        cadCore.CAD_PROJECT_FORMAT_VERSION_V18,
        project.schemaVersion
      );
      checkEqual(
        failures,
        "project.hasTopologyIdentity",
        true,
        Boolean(project.document.topologyIdentity)
      );
      checkNoSourceBoundaryLeaks(failures, "project JSON", json);
      roundTripCheckCount += 2;
    } catch (error) {
      failures.push(`project JSON round-trip threw: ${formatError(error)}`);
    }
  }

  if (restoredEngine) {
    roundTripCheckCount += await verifyWcadV2CheckpointRoundTrip(
      cadCore,
      restoredEngine,
      fixture,
      failures
    );
    topologyCheckCount += verifyTopologyReadiness(
      restoredEngine,
      fixture,
      failures
    );
    referenceCheckCount += verifyReferenceRepair(
      restoredEngine,
      fixture,
      failures
    );
    commandCheckCount += verifyTopologyAnchorCommand(
      restoredEngine,
      fixture,
      failures
    );
    matchCheckCount += verifyTopologyMatching(
      restoredEngine,
      fixture,
      failures
    );
  }

  return finalizeSampleResult({
    id: fixture.id,
    status: failures.length === 0 ? "pass" : "fail",
    failures,
    topologyCheckCount,
    referenceCheckCount,
    commandCheckCount,
    matchCheckCount,
    roundTripCheckCount
  });
}

async function verifyWcadV2CheckpointRoundTrip(
  cadCore,
  engine,
  fixture,
  failures
) {
  let checks = 0;

  try {
    const project = cadCore.exportCadProject(engine);
    const checkpointPayloads = cadCore.createV13ReleaseSampleCheckpointPayloads(
      fixture.id
    );
    const exported = await cadCore.exportCadProjectToWcad(project, {
      createdAt: "2026-06-21T00:00:00.000Z",
      modifiedAt: "2026-06-21T00:00:00.000Z",
      topologyCheckpoints: checkpointPayloads
    });
    const read = await cadCore.readCadProjectWcad(exported.bytes);

    checkEqual(
      failures,
      "wcad.packageVersion",
      "partbench.wcad.v2",
      exported.manifest.packageVersion
    );
    checkEqual(
      failures,
      "wcad.checkpointPayloadCount",
      fixture.expectedTopology.checkpointCount,
      exported.checkpointPayloads?.length ?? 0
    );
    checkEqual(
      failures,
      "wcad.sourceIdentity",
      exported.manifest.sourceIdentity.sha256,
      exported.sourceIdentity.sha256
    );
    checkNoBoundaryLeaks(
      failures,
      "wcad v2 manifest",
      JSON.stringify(exported.manifest)
    );
    checks += 3;

    if (!read.ok) {
      failures.push(
        `wcad read: expected ok, got ${JSON.stringify(read.issues)}`
      );
      return checks;
    }

    checkEqual(
      failures,
      "wcad.read.packageVersion",
      "partbench.wcad.v2",
      read.manifest.packageVersion
    );
    checkEqual(
      failures,
      "wcad.read.checkpointPayloadCount",
      fixture.expectedTopology.checkpointCount,
      read.checkpointPayloads?.length ?? 0
    );
    checkEqual(
      failures,
      "wcad.read.project.schemaVersion",
      cadCore.CAD_PROJECT_FORMAT_VERSION_V18,
      read.project.schemaVersion
    );
    checkEqual(
      failures,
      "wcad.read.sourceIdentity",
      read.manifest.sourceIdentity.sha256,
      read.sourceIdentity.sha256
    );
    checkNoSourceBoundaryLeaks(
      failures,
      "wcad read project",
      JSON.stringify(read.project)
    );
    checks += 4;

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
    failures.push(`wcad v2 checkpoint round-trip threw: ${formatError(error)}`);
  }

  return checks;
}

function verifyTopologyReadiness(engine, fixture, failures) {
  const readiness = readQuery(engine, {
    version: "cadops.v1",
    query: { query: "project.topologyIdentityReadiness" }
  });
  let checks = 0;

  checkQueryKind(failures, readiness, "project.topologyIdentityReadiness");
  if (readiness.ok) {
    checkEqual(
      failures,
      "topology.checkpointCount",
      fixture.expectedTopology.checkpointCount,
      readiness.checkpointCount
    );
    checkEqual(
      failures,
      "topology.anchorCount",
      fixture.expectedTopology.anchorCount,
      readiness.anchorCount
    );
    checkIncludes(
      failures,
      "topology.anchors",
      readiness.anchors.map((anchor) => anchor.anchorId),
      fixture.expectedTopology.repairedTopologyAnchorId
    );
    checkIncludes(
      failures,
      "topology.anchors",
      readiness.anchors.map((anchor) => anchor.anchorId),
      fixture.expectedTopology.downstreamTargetTopologyAnchorId
    );
    checkNoBoundaryLeaks(
      failures,
      "topology readiness",
      JSON.stringify(readiness)
    );
    checks += 4;
  }

  return checks;
}

function verifyReferenceRepair(engine, fixture, failures) {
  const named = readQuery(engine, {
    version: "cadops.v1",
    query: { query: "reference.listNamed" }
  });
  const selection = readQuery(engine, {
    version: "cadops.v1",
    query: {
      query: "selection.referenceCandidates",
      selection: {
        type: "namedReference",
        name: fixture.expectedTopology.repairedReferenceName
      },
      requiredOperation: "feature.selectReference"
    }
  });
  const health = readQuery(engine, {
    version: "cadops.v1",
    query: {
      query: "reference.health",
      target: {
        type: "namedReference",
        name: fixture.expectedTopology.repairedReferenceName
      }
    }
  });
  let checks = 0;

  checkQueryKind(failures, named, "reference.listNamed");
  checkQueryKind(failures, selection, "selection.referenceCandidates");
  checkQueryKind(failures, health, "reference.health");

  if (named.ok) {
    const repaired = named.references.find(
      (reference) =>
        reference.name === fixture.expectedTopology.repairedReferenceName
    );
    checkEqual(
      failures,
      "named.repaired.topologyAnchorId",
      fixture.expectedTopology.repairedTopologyAnchorId,
      repaired?.topologyAnchorId
    );
    checks += 1;
  }

  if (selection.ok) {
    checkEqual(failures, "selection.status", "resolved", selection.status);
    checkEqual(
      failures,
      "selection.target.topologyAnchorId",
      fixture.expectedTopology.repairedTopologyAnchorId,
      selection.candidates[0]?.target?.topologyAnchorId
    );
    checkNoBoundaryLeaks(
      failures,
      "selection response",
      JSON.stringify(selection)
    );
    checks += 2;
  }

  if (health.ok) {
    checkEqual(failures, "reference.health.status", "active", health.status);
    checkEqual(
      failures,
      "reference.health.topologyAnchorId",
      fixture.expectedTopology.repairedTopologyAnchorId,
      health.referenceHealth[0]?.topologyAnchorId
    );
    checkNoBoundaryLeaks(failures, "reference health", JSON.stringify(health));
    checks += 2;
  }

  return checks;
}

function verifyTopologyAnchorCommand(engine, fixture, failures) {
  const structure = readQuery(engine, {
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  let checks = 0;

  checkQueryKind(failures, structure, "project.structure");
  if (structure.ok) {
    const feature = structure.features.find(
      (candidate) =>
        candidate.id === fixture.expectedTopology.downstreamFeatureId
    );
    checkEqual(failures, "downstream.feature.kind", "extrude", feature?.kind);
    checkEqual(
      failures,
      "downstream.targetTopologyAnchorId",
      fixture.expectedTopology.downstreamTargetTopologyAnchorId,
      feature?.targetTopologyAnchorId
    );
    checkNoBoundaryLeaks(
      failures,
      "project.structure",
      JSON.stringify(structure)
    );
    checks += 2;
  }

  return checks;
}

function verifyTopologyMatching(engine, fixture, failures) {
  const match = readQuery(engine, {
    version: "cadops.v1",
    query: {
      query: "topology.matchSnapshots",
      previous: fixture.topologyMatchPrevious,
      candidates: fixture.topologyMatchCandidates
    }
  });
  let checks = 0;

  checkQueryKind(failures, match, "topology.matchSnapshots");
  if (match.ok) {
    const byPreviousEntity = new Map(
      match.matchResults.map((result) => [
        result.previousCheckpointEntityId,
        result
      ])
    );

    checkEqual(
      failures,
      "topology.match.resultCount",
      fixture.expectedTopologyMatches.length,
      match.resultCount
    );
    checks += 1;

    for (const expectation of fixture.expectedTopologyMatches) {
      const result = byPreviousEntity.get(
        expectation.previousCheckpointEntityId
      );
      checkEqual(
        failures,
        `match.${expectation.previousCheckpointEntityId}.state`,
        expectation.expectedState,
        result?.state
      );
      checkEqual(
        failures,
        `match.${expectation.previousCheckpointEntityId}.confidence`,
        expectation.expectedConfidence,
        result?.confidence
      );
      checks += 2;
    }

    checkNoBoundaryLeaks(failures, "topology match", JSON.stringify(match));
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

function checkEqual(failures, label, expected, actual) {
  if (actual !== expected) {
    failures.push(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function checkIncludes(failures, label, values, expectedValue) {
  if (!values.includes(expectedValue)) {
    failures.push(
      `${label}: expected ${JSON.stringify(values)} to include ${JSON.stringify(expectedValue)}`
    );
  }
}

function checkNoBoundaryLeaks(failures, label, text) {
  if (V13_RELEASE_BOUNDARY_LEAK_PATTERN.test(text)) {
    failures.push(`${label}: leaked renderer/kernel/browser/cache identifier`);
  }
}

function checkNoSourceBoundaryLeaks(failures, label, text) {
  if (V13_RELEASE_SOURCE_BOUNDARY_LEAK_PATTERN.test(text)) {
    failures.push(`${label}: leaked renderer/kernel/browser/cache identifier`);
  }
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

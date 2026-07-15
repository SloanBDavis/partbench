export const V15_RELEASE_BOUNDARY_LEAK_PATTERN =
  /\b(?:rendererId|renderId|meshId|occtId|occtShape|cacheKey|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|fileHandle|fileSystemHandle|opfsPath|localPath|absolutePath|gpuId|gpuBuffer|gpuBufferId|exportArtifactId|pixelId|viewportState|topologyIndex|checkpoint-local[-_a-z0-9]*)\b/i;

const V15_RELEASE_SOURCE_BOUNDARY_LEAK_PATTERN =
  /\b(?:rendererId|renderId|meshId|occtId|occtShape|cacheKey|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|fileHandle|fileSystemHandle|opfsPath|localPath|absolutePath|gpuId|gpuBuffer|gpuBufferId|exportArtifactId|pixelId|viewportState|topologyIndex)\b/i;

export async function runV15ReleaseSampleSmoke(cadCore, options = {}) {
  const fixtures = options.fixtures ?? cadCore.listV15ReleaseSampleFixtures();
  const samples = [];

  for (const fixture of fixtures) {
    samples.push(await evaluateV15Fixture(cadCore, fixture));
  }

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
    structureCheckCount: sumSampleChecks(samples, "structureCheckCount"),
    healthCheckCount: sumSampleChecks(samples, "healthCheckCount"),
    expressionCheckCount: sumSampleChecks(samples, "expressionCheckCount"),
    roundTripCheckCount: sumSampleChecks(samples, "roundTripCheckCount"),
    boundaryCheckCount: sumSampleChecks(samples, "boundaryCheckCount"),
    samples,
    invariantFailures
  };
  const boundaryFailures = [];

  checkNoBoundaryLeaks(
    boundaryFailures,
    "V15 release smoke result",
    JSON.stringify(result)
  );

  if (boundaryFailures.length > 0) {
    return { ...result, ok: false, boundaryFailures };
  }

  return result;
}

export function formatV15ReleaseSampleSmokeSummary(result) {
  const lines = [
    `V15 release hardening smoke ${result.ok ? "passed" : "failed"}`,
    `samples: ${result.passedCount} passed, ${result.failedCount} failed, ${result.sampleCount} total`,
    `checks: ${result.operationCheckCount} operation, ${result.structureCheckCount} structure, ${result.healthCheckCount} health, ${result.expressionCheckCount} expression, ${result.roundTripCheckCount} round-trip, ${result.boundaryCheckCount} boundary`
  ];

  for (const sample of result.samples) {
    lines.push(
      `- ${sample.status} ${sample.id} | operation ${sample.operationCheckCount} | structure ${sample.structureCheckCount} | health ${sample.healthCheckCount} | expression ${sample.expressionCheckCount} | round-trips ${sample.roundTripCheckCount} | boundary ${sample.boundaryCheckCount}`
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
    failures.push("V15 release smoke requires at least one fixture.");
  }

  const totals = {
    operation: sumSampleChecks(samples, "operationCheckCount"),
    structure: sumSampleChecks(samples, "structureCheckCount"),
    health: sumSampleChecks(samples, "healthCheckCount"),
    "round-trip": sumSampleChecks(samples, "roundTripCheckCount"),
    boundary: sumSampleChecks(samples, "boundaryCheckCount")
  };

  for (const [kind, count] of Object.entries(totals)) {
    if (count <= 0) {
      failures.push(`V15 release smoke requires ${kind} checks.`);
    }
  }

  return failures;
}

async function evaluateV15Fixture(cadCore, fixture) {
  const failures = [];
  const engine = new cadCore.CadEngine();
  const batch = cadCore.createV15ReleaseSampleBatch(fixture.id);
  let operationCheckCount = 0;
  let structureCheckCount = 0;
  let healthCheckCount = 0;
  let expressionCheckCount = 0;
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

  let restoredEngine;
  try {
    const json = cadCore.exportCadProjectJson(engine);
    const project = cadCore.parseCadProjectJson(json);
    restoredEngine = cadCore.importCadProjectJson(json);
    const usesV20Feature = fixture.expectedFeatures.some((feature) =>
      ["linearPattern", "circularPattern", "mirror"].includes(feature.kind)
    );
    const expectedSchemaVersion = usesV20Feature
      ? cadCore.CAD_PROJECT_FORMAT_VERSION_V20
      : cadCore.CAD_PROJECT_FORMAT_VERSION_V19;

    checkEqual(
      failures,
      "project.schemaVersion",
      expectedSchemaVersion,
      project.schemaVersion
    );
    checkNoSourceBoundaryLeaks(failures, "project JSON", json);
    roundTripCheckCount += 1;
    boundaryCheckCount += 1;

    const exported = await cadCore.exportCadProjectToWcad(project);
    const read = await cadCore.readCadProjectWcad(exported.bytes);
    checkEqual(failures, "wcad.read.ok", true, read.ok);
    if (read.ok) {
      checkEqual(
        failures,
        "wcad.schemaVersion",
        expectedSchemaVersion,
        read.project.schemaVersion
      );
    }
    roundTripCheckCount += 2;
  } catch (error) {
    failures.push(`round-trip threw: ${formatError(error)}`);
  }

  if (restoredEngine) {
    const structure = readQuery(restoredEngine, {
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    const health = readQuery(restoredEngine, {
      version: "cadops.v1",
      query: { query: "project.health" }
    });

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
      structureCheckCount += 1;

      for (const [field, expectedValue] of Object.entries(expectation)) {
        if (field === "featureId" || field === "kind") {
          continue;
        }

        checkEqual(
          failures,
          `${expectation.featureId}.${field}`,
          expectedValue,
          field === "mirrorPlane"
            ? feature?.plane?.kind === "standardPlane"
              ? feature.plane.plane
              : undefined
            : feature?.[field]
        );
        structureCheckCount += 1;
      }
    }

    checkIncludes(
      failures,
      "project.health.status",
      ["healthy", "under-defined"],
      health.status
    );
    healthCheckCount += 1;
    checkNoBoundaryLeaks(
      failures,
      "project structure and health",
      JSON.stringify({ structure, health })
    );
    boundaryCheckCount += 1;

    if (fixture.expectedParameters) {
      const evaluation = readQuery(restoredEngine, {
        version: "cadops.v1",
        query: { query: "project.parameterEvaluation" }
      });

      checkEqual(
        failures,
        "parameterEvaluation.status",
        "valid",
        evaluation.status
      );
      checkEqual(
        failures,
        "parameterEvaluation.mutatesSource",
        false,
        evaluation.mutatesSource
      );
      expressionCheckCount += 2;

      for (const expectation of fixture.expectedParameters) {
        const node = evaluation.nodes.find(
          (candidate) => candidate.parameterId === expectation.parameterId
        );

        checkEqual(
          failures,
          `${expectation.parameterId}.name`,
          expectation.name,
          node?.name
        );
        checkNumberClose(
          failures,
          `${expectation.parameterId}.value`,
          expectation.value,
          node?.value
        );
        expressionCheckCount += 2;

        if (expectation.expression !== undefined) {
          checkEqual(
            failures,
            `${expectation.parameterId}.expression`,
            expectation.expression,
            node?.expression
          );
          expressionCheckCount += 1;
        }

        if (expectation.references) {
          checkArrayEqual(
            failures,
            `${expectation.parameterId}.references`,
            expectation.references,
            node?.references ?? []
          );
          expressionCheckCount += 1;
        }

        if (expectation.dependents) {
          checkArrayEqual(
            failures,
            `${expectation.parameterId}.dependents`,
            expectation.dependents,
            node?.dependents ?? []
          );
          expressionCheckCount += 1;
        }
      }
    }

    for (const blocked of fixture.expectedBlockedBatches ?? []) {
      const beforeBlockedJson = cadCore.exportCadProjectJson(restoredEngine);
      const blockedResult = restoredEngine.executeBatch({
        version: "cadops.v1",
        mode: "dryRun",
        ops: blocked.ops
      });

      checkEqual(failures, `${blocked.label}.ok`, false, blockedResult.ok);
      checkEqual(
        failures,
        `${blocked.label}.code`,
        blocked.expectedCode,
        blockedResult.error?.code
      );
      checkEqual(
        failures,
        `${blocked.label}.mutatesSource`,
        beforeBlockedJson,
        cadCore.exportCadProjectJson(restoredEngine)
      );
      operationCheckCount += 3;
    }
  }

  return {
    id: fixture.id,
    status: failures.length === 0 ? "pass" : "fail",
    failures,
    operationCheckCount,
    structureCheckCount,
    healthCheckCount,
    expressionCheckCount,
    roundTripCheckCount,
    boundaryCheckCount
  };
}

function readQuery(engine, query) {
  const response = engine.executeQuery(query);

  if (!response.ok) {
    throw new Error(
      `Query ${query.query?.query ?? "unknown"} failed: ${response.error?.message}`
    );
  }

  return response;
}

function sumSampleChecks(samples, field) {
  return samples.reduce((sum, sample) => sum + sample[field], 0);
}

function checkEqual(failures, label, expected, actual) {
  if (!Object.is(expected, actual)) {
    failures.push(
      `${label}: expected ${formatValue(expected)}, got ${formatValue(actual)}`
    );
  }
}

function checkNumberClose(failures, label, expected, actual) {
  if (typeof actual !== "number" || Math.abs(expected - actual) > 1e-8) {
    failures.push(`${label}: expected ${expected}, got ${formatValue(actual)}`);
  }
}

function checkArrayEqual(failures, label, expected, actual) {
  if (
    expected.length !== actual.length ||
    expected.some((value, index) => value !== actual[index])
  ) {
    failures.push(
      `${label}: expected ${formatValue(expected)}, got ${formatValue(actual)}`
    );
  }
}

function checkIncludes(failures, label, expectedValues, actual) {
  if (!expectedValues.includes(actual)) {
    failures.push(
      `${label}: expected one of ${formatValue(expectedValues)}, got ${formatValue(actual)}`
    );
  }
}

function checkNoBoundaryLeaks(failures, label, text) {
  const match = text.match(V15_RELEASE_BOUNDARY_LEAK_PATTERN);
  if (match) {
    failures.push(`${label} leaked private identifier ${match[0]}`);
  }
}

function checkNoSourceBoundaryLeaks(failures, label, text) {
  const match = text.match(V15_RELEASE_SOURCE_BOUNDARY_LEAK_PATTERN);
  if (match) {
    failures.push(`${label} leaked private source identifier ${match[0]}`);
  }
}

function formatValue(value) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

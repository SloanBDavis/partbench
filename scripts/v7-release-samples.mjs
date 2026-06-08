export const RAW_DERIVED_ID_PATTERN =
  /rendererId|renderId|meshId|occtId|occtShape|cacheKey|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex/i;

export function runV7ReleaseSampleSmoke(cadCore, options = {}) {
  const fixtures = options.fixtures ?? cadCore.listV7ReleaseSampleFixtures();
  const samples = fixtures.map((fixture) => evaluateFixture(cadCore, fixture));
  const failedCount = samples.filter(
    (sample) => sample.status === "fail"
  ).length;

  return {
    ok: failedCount === 0,
    sampleCount: samples.length,
    passedCount: samples.length - failedCount,
    failedCount,
    samples
  };
}

export function formatV7ReleaseSampleSmokeSummary(result) {
  const lines = [
    `V7 release sample smoke ${result.ok ? "passed" : "failed"}`,
    `samples: ${result.passedCount} passed, ${result.failedCount} failed, ${result.sampleCount} total`
  ];

  for (const sample of result.samples) {
    const selectionText = `${sample.selection.queryCount} selections, ${sample.selection.candidateCount} candidates, ${sample.selection.commandableCount} commandable`;
    const exportText = sample.exportFormats
      .map(
        (format) =>
          `${format.format}:${format.status}${
            format.available ? ":available" : ":unavailable"
          }`
      )
      .join(", ");

    lines.push(
      `- ${sample.status} ${sample.id} | ${sample.title} | health ${sample.health.status}/${sample.health.issueCount} | ${selectionText} | exports ${exportText}`
    );

    for (const failure of sample.failures) {
      lines.push(`  - ${failure}`);
    }
  }

  return lines.join("\n");
}

function evaluateFixture(cadCore, fixture) {
  const failures = [];
  const engine = new cadCore.CadEngine();
  const batch = cadCore.createV7ReleaseSampleBatch(fixture.id);
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
  checkEqual(failures, "batch.mode response", "commit", batchResponse.mode);

  let parsedProject;
  let restoredEngine;
  let json = "";

  if (batchResponse.ok) {
    try {
      json = cadCore.exportCadProjectJson(engine);
      parsedProject = cadCore.parseCadProjectJson(json);
      restoredEngine = cadCore.importCadProjectJson(json);
    } catch (error) {
      failures.push(`project JSON round-trip threw: ${formatError(error)}`);
    }
  }

  if (parsedProject && restoredEngine) {
    checkEqual(
      failures,
      "project.schemaVersion",
      cadCore.CURRENT_CAD_PROJECT_FORMAT_VERSION,
      parsedProject.schemaVersion
    );
    checkEqual(
      failures,
      "project.schemaVersion excludes web-cad.project.v17",
      false,
      json.includes("web-cad.project.v17")
    );
    checkNoRawDerivedIds(failures, "project JSON", json);
    checkNoRawDerivedIds(
      failures,
      "sample fixture metadata",
      JSON.stringify(fixture)
    );

    const health = readQuery(restoredEngine, {
      version: "cadops.v1",
      query: { query: "project.health" }
    });
    const summary = readQuery(restoredEngine, {
      version: "cadops.v1",
      query: { query: "project.summary" }
    });
    const exportReadiness = readQuery(restoredEngine, {
      version: "cadops.v1",
      query: { query: "project.exportReadiness" }
    });

    checkQueryKind(failures, health, "project.health");
    checkQueryKind(failures, summary, "project.summary");
    checkQueryKind(failures, exportReadiness, "project.exportReadiness");

    if (health.ok) {
      checkEqual(
        failures,
        "project.health.status",
        fixture.expectedHealthStatus,
        health.status
      );
      checkEqual(
        failures,
        "project.health.issueCount",
        fixture.expectedHealthIssueCount,
        health.issueCount
      );
    }

    if (summary.ok) {
      verifyProjectSummary(failures, fixture, summary);
      checkNoRawDerivedIds(
        failures,
        "project.summary response",
        JSON.stringify(summary)
      );
    }

    if (exportReadiness.ok) {
      verifyExportReadiness(failures, fixture, exportReadiness);
      checkNoRawDerivedIds(
        failures,
        "project.exportReadiness response",
        JSON.stringify(exportReadiness)
      );
    }

    const selection = verifySelectionQueries(failures, restoredEngine, fixture);

    const sample = createSampleResult({
      failures,
      fixture,
      health,
      exportReadiness,
      selection
    });
    checkNoRawDerivedIds(
      sample.failures,
      "emitted sample smoke metadata",
      JSON.stringify(sample)
    );

    return finalizeSampleResult(sample);
  }

  const sample = createSampleResult({
    failures,
    fixture,
    health: undefined,
    exportReadiness: undefined,
    selection: {
      candidateCount: 0,
      commandableCount: 0,
      queryCount: 0
    }
  });
  checkNoRawDerivedIds(
    sample.failures,
    "emitted sample smoke metadata",
    JSON.stringify(sample)
  );

  return finalizeSampleResult(sample);
}

function verifyProjectSummary(failures, fixture, summary) {
  const counts = fixture.expectedSourceCounts;

  checkEqual(failures, "project.summary.units", fixture.units, summary.units);
  checkEqual(failures, "project.summary.objectCount", 0, summary.objectCount);
  checkEqual(
    failures,
    "project.summary.structure.partCount",
    1,
    summary.structure.partCount
  );
  checkEqual(
    failures,
    "project.summary.structure.primitiveCompatibilityBodyCount",
    0,
    summary.structure.primitiveCompatibilityBodyCount
  );
  checkEqual(
    failures,
    "project.summary.structure.authoredBodyFeatureCount",
    counts.featureCount,
    summary.structure.authoredBodyFeatureCount
  );
  for (const [field, expected] of Object.entries({
    sketchCount: counts.sketchCount,
    sketchEntityCount: counts.sketchEntityCount,
    featureCount: counts.featureCount,
    bodyCount: counts.bodyCount,
    activeBodyCount: counts.activeBodyCount,
    consumedBodyCount: counts.consumedBodyCount
  })) {
    checkEqual(
      failures,
      `project.summary.structure.${field}`,
      expected,
      summary.structure[field]
    );
  }

  checkEqual(
    failures,
    "project.summary.health.status",
    fixture.expectedHealthStatus,
    summary.health.status
  );
  checkEqual(
    failures,
    "project.summary.health.issueCount",
    fixture.expectedHealthIssueCount,
    summary.health.issueCount
  );

  for (const [field, expected] of Object.entries(
    fixture.expectedReferenceSummary
  )) {
    checkEqual(
      failures,
      `project.summary.references.${field}`,
      expected,
      summary.references[field]
    );
  }

  verifyExportReadinessFields(
    failures,
    fixture.expectedExportReadiness,
    summary.exportReadiness,
    "project.summary.exportReadiness"
  );
}

function verifyExportReadiness(failures, fixture, readiness) {
  verifyExportReadinessFields(
    failures,
    fixture.expectedExportReadiness,
    readiness,
    "project.exportReadiness"
  );
}

function verifyExportReadinessFields(failures, expected, actual, label) {
  for (const field of [
    "status",
    "canExportFiles",
    "bodyCount",
    "sourceSupportedBodyCount",
    "deferredBodyCount",
    "unavailableBodyCount"
  ]) {
    checkEqual(failures, `${label}.${field}`, expected[field], actual[field]);
  }

  for (const expectedFormat of expected.formats) {
    const actualFormat = actual.formats.find(
      (format) => format.format === expectedFormat.format
    );

    if (!actualFormat) {
      failures.push(`${label}.formats.${expectedFormat.format}: missing`);
      continue;
    }

    for (const field of [
      "status",
      "available",
      "sourceSupportedBodyCount",
      "deferredBodyCount",
      "unavailableBodyCount"
    ]) {
      checkEqual(
        failures,
        `${label}.formats.${expectedFormat.format}.${field}`,
        expectedFormat[field],
        actualFormat[field]
      );
    }
  }
}

function verifySelectionQueries(failures, engine, fixture) {
  let candidateCount = 0;
  let commandableCount = 0;

  for (const [
    index,
    expectation
  ] of fixture.expectedSelectionQueries.entries()) {
    const response = readQuery(engine, {
      version: "cadops.v1",
      query: {
        query: "selection.referenceCandidates",
        selection: expectation.selection,
        ...(expectation.requiredOperation
          ? { requiredOperation: expectation.requiredOperation }
          : {})
      }
    });
    const label = `selection.referenceCandidates[${index}]`;

    checkQueryKind(failures, response, "selection.referenceCandidates", label);

    if (!response.ok) {
      continue;
    }

    const commandable = response.candidates.filter(
      (candidate) => candidate.commandable
    ).length;
    candidateCount += response.candidateCount;
    commandableCount += commandable;

    checkEqual(
      failures,
      `${label}.status`,
      expectation.expectedStatus,
      response.status
    );
    checkEqual(
      failures,
      `${label}.candidateCount`,
      expectation.expectedCandidateCount,
      response.candidateCount
    );
    checkEqual(
      failures,
      `${label}.commandableCount`,
      expectation.expectedCommandableCount,
      commandable
    );

    if (expectation.expectedStatus === "resolved") {
      checkEqual(failures, `${label}.issueCount`, 0, response.issueCount);
    } else if (response.issueCount <= 0) {
      failures.push(
        `${label}.issueCount: expected > 0, got ${response.issueCount}`
      );
    }

    checkNoRawDerivedIds(failures, label, JSON.stringify(response));
  }

  return {
    candidateCount,
    commandableCount,
    queryCount: fixture.expectedSelectionQueries.length
  };
}

function createSampleResult({
  failures,
  fixture,
  health,
  exportReadiness,
  selection
}) {
  return {
    id: fixture.id,
    title: fixture.title,
    status: failures.length > 0 ? "fail" : "pass",
    health: {
      status: health?.ok ? health.status : "unknown",
      issueCount: health?.ok ? health.issueCount : 0
    },
    selection,
    exportFormats: (exportReadiness?.ok
      ? exportReadiness.formats
      : fixture.expectedExportReadiness.formats
    ).map((format) => ({
      available: format.available,
      format: format.format,
      status: format.status
    })),
    failures
  };
}

function finalizeSampleResult(sample) {
  sample.status = sample.failures.length > 0 ? "fail" : "pass";
  return sample;
}

function readQuery(engine, query) {
  return engine.executeQuery(query);
}

function checkQueryKind(
  failures,
  response,
  expectedQuery,
  label = expectedQuery
) {
  if (!response.ok) {
    failures.push(`${label}: expected ok response, got ${response.code}`);
    return;
  }

  checkEqual(failures, `${label}.query`, expectedQuery, response.query);
}

function checkEqual(failures, label, expected, actual) {
  if (actual !== expected) {
    failures.push(
      `${label}: expected ${formatValue(expected)}, got ${formatValue(actual)}`
    );
  }
}

function checkNoRawDerivedIds(failures, label, text) {
  if (RAW_DERIVED_ID_PATTERN.test(text)) {
    failures.push(
      `${label}: leaked raw derived renderer/mesh/OCCT/cache/selection-buffer identifier`
    );
  }
}

function formatValue(value) {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

import {
  RAW_DERIVED_ID_PATTERN,
  runV7ReleaseSampleSmoke
} from "./v7-release-samples.mjs";

export const V8_RELEASE_BOUNDARY_LEAK_PATTERN =
  /rendererId|renderId|meshId|occtId|occtShape|cacheKey|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|fileHandle|fileSystemHandle|opfsPath|localPath|absolutePath/i;

export async function runV8ReleaseSampleSmoke(cadCore, options = {}) {
  const fixtures = options.fixtures ?? cadCore.listV7ReleaseSampleFixtures();
  const sourceSmoke = runV7ReleaseSampleSmoke(cadCore, { fixtures });
  const sourceSamplesById = new Map(
    sourceSmoke.samples.map((sample) => [sample.id, sample])
  );
  const samples = [];

  for (const fixture of fixtures) {
    samples.push(
      await evaluateV8Fixture(
        cadCore,
        fixture,
        sourceSamplesById.get(fixture.id)
      )
    );
  }

  const corruptionChecks =
    fixtures.length > 0
      ? await evaluateWcadCorruptionChecks(cadCore, fixtures[0])
      : createSkippedCheck(
          "wcad-corruption",
          "No release fixtures were provided."
        );
  const unsupportedExactStep = evaluateUnsupportedExactStep(cadCore);
  const failedCount = samples.filter(
    (sample) => sample.status === "fail"
  ).length;
  const packageChecks = summarizePackageChecks(samples, corruptionChecks);
  const exactStepChecks = summarizeExactStepChecks(
    samples,
    unsupportedExactStep
  );
  const boundaryFailures = [];
  const result = {
    ok:
      failedCount === 0 &&
      corruptionChecks.status === "pass" &&
      unsupportedExactStep.status === "pass",
    sampleCount: samples.length,
    passedCount: samples.length - failedCount,
    failedCount,
    packageChecks,
    exactStepChecks,
    corruptionChecks,
    unsupportedExactStep,
    samples
  };

  checkNoBoundaryLeaks(
    boundaryFailures,
    "V8 release smoke result",
    JSON.stringify(result)
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

export function formatV8ReleaseSampleSmokeSummary(result) {
  const lines = [
    `V8 release package/export smoke ${result.ok ? "passed" : "failed"}`,
    `samples: ${result.passedCount} passed, ${result.failedCount} failed, ${result.sampleCount} total`,
    `wcad: ${result.packageChecks.wcadRoundTripCount} package round-trips, ${result.packageChecks.jsonToWcadRoundTripCount} JSON-to-WCAD round-trips, corruption ${result.corruptionChecks.status}`,
    `step: ${result.exactStepChecks.supportedSampleCount} supported samples, ${result.exactStepChecks.unsupportedSampleCount} unsupported/deferred samples, primitive unsupported ${result.unsupportedExactStep.status}`
  ];

  for (const sample of result.samples) {
    const exportText = sample.exportFormats
      .map(
        (format) =>
          `${format.format}:${format.status}${
            format.available ? ":available" : ":unavailable"
          }`
      )
      .join(", ");
    const wcadText = `${sample.wcad.packageVersion}/${sample.wcad.documentSchemaVersion}`;
    const stepText = `${sample.exactStep.status}:${sample.exactStep.exportableBodyCount} exportable`;

    lines.push(
      `- ${sample.status} ${sample.id} | wcad ${wcadText} | json->wcad ${sample.wcad.jsonToWcadCompatible ? "ok" : "fail"} | step ${stepText} | exports ${exportText}`
    );

    for (const failure of sample.failures) {
      lines.push(`  - ${failure}`);
    }
  }

  for (const failure of result.corruptionChecks.failures) {
    lines.push(`- corruption-fail ${failure}`);
  }

  for (const failure of result.unsupportedExactStep.failures) {
    lines.push(`- step-unsupported-fail ${failure}`);
  }

  for (const failure of result.boundaryFailures ?? []) {
    lines.push(`- boundary-fail ${failure}`);
  }

  return lines.join("\n");
}

async function evaluateV8Fixture(cadCore, fixture, sourceSample) {
  const failures = [...(sourceSample?.failures ?? [])];
  const engine = new cadCore.CadEngine();
  const batch = cadCore.createV7ReleaseSampleBatch(fixture.id);
  const batchResponse = engine.executeBatch(batch);
  let json = "";
  let parsedProject;
  let restoredFromJson;
  let wcad = createEmptyWcadSummary();
  let exactStep = createEmptyExactStepSummary();

  checkEqual(failures, "batch.ok", true, batchResponse.ok);

  if (batchResponse.ok) {
    try {
      json = cadCore.exportCadProjectJson(engine);
      parsedProject = cadCore.parseCadProjectJson(json);
      restoredFromJson = cadCore.importCadProjectJson(json);
    } catch (error) {
      failures.push(`project JSON compatibility threw: ${formatError(error)}`);
    }
  }

  if (parsedProject && restoredFromJson) {
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
    checkNoBoundaryLeaks(failures, "project JSON", json);

    try {
      wcad = await verifyWcadRoundTrip({
        cadCore,
        engine,
        restoredFromJson,
        parsedProject,
        failures
      });
    } catch (error) {
      failures.push(`WCAD round-trip threw: ${formatError(error)}`);
    }

    try {
      exactStep = verifyExactStepExport({
        engine: restoredFromJson,
        fixture,
        failures
      });
    } catch (error) {
      failures.push(`STEP exact export check threw: ${formatError(error)}`);
    }
  }

  const sample = {
    id: fixture.id,
    title: fixture.title,
    status: failures.length > 0 ? "fail" : "pass",
    health: sourceSample?.health ?? { status: "unknown", issueCount: 0 },
    selection: sourceSample?.selection ?? {
      candidateCount: 0,
      commandableCount: 0,
      queryCount: 0
    },
    exportFormats:
      sourceSample?.exportFormats ??
      fixture.expectedExportReadiness.formats.map((format) => ({
        available: format.available,
        format: format.format,
        status: format.status
      })),
    wcad,
    exactStep,
    failures
  };

  checkNoBoundaryLeaks(
    sample.failures,
    "emitted V8 sample smoke metadata",
    JSON.stringify(sample)
  );
  sample.status = sample.failures.length > 0 ? "fail" : "pass";

  return sample;
}

async function verifyWcadRoundTrip({
  cadCore,
  engine,
  restoredFromJson,
  parsedProject,
  failures
}) {
  const exported = await cadCore.exportCadProjectWcad(engine);
  const exportedFromJson = await cadCore.exportCadProjectWcad(restoredFromJson);
  const read = await cadCore.readCadProjectWcad(exportedFromJson.bytes);

  checkEqual(
    failures,
    "wcad.bytes.zipSignature",
    "80,75,3,4",
    [...exported.bytes.slice(0, 4)].join(",")
  );
  checkEqual(
    failures,
    "wcad.packageVersion",
    "partbench.wcad.v1",
    exported.manifest.packageVersion
  );
  checkEqual(
    failures,
    "wcad.document.schemaVersion",
    parsedProject.schemaVersion,
    exported.manifest.document.schemaVersion
  );
  checkEqual(
    failures,
    "wcad.sourceIdentity.algorithm",
    "partbench-source-v1",
    exported.sourceIdentity.algorithm
  );
  checkEqual(
    failures,
    "json-to-wcad.sourceIdentity",
    exported.sourceIdentity.sha256,
    exportedFromJson.sourceIdentity.sha256
  );
  checkEqual(
    failures,
    "wcad.source excludes web-cad.project.v17",
    false,
    JSON.stringify(exported.manifest).includes("web-cad.project.v17")
  );

  let packageRoundTripOk = false;
  let jsonToWcadCompatible = false;
  let diagnosticCount = 0;

  if (!read.ok) {
    failures.push(
      `WCAD read failed: ${read.issues.map((issue) => issue.code).join(", ")}`
    );
  } else {
    diagnosticCount = read.diagnostics.length;
    checkEqual(failures, "wcad.read.diagnostics", 0, read.diagnostics.length);
    checkEqual(
      failures,
      "wcad.read.sourceIdentity",
      exportedFromJson.sourceIdentity.sha256,
      read.sourceIdentity.sha256
    );
    packageRoundTripOk = stableJson(read.project) === stableJson(parsedProject);

    if (!packageRoundTripOk) {
      failures.push("WCAD package read did not preserve the parsed project.");
    }

    const imported = await cadCore.importCadProjectWcad(exportedFromJson.bytes);
    const importedProject = cadCore.parseCadProjectJson(
      cadCore.exportCadProjectJson(imported)
    );
    jsonToWcadCompatible =
      stableJson(importedProject) === stableJson(parsedProject);

    if (!jsonToWcadCompatible) {
      failures.push(
        "JSON import followed by WCAD export/import did not preserve the project."
      );
    }

    checkNoBoundaryLeaks(
      failures,
      "WCAD public package metadata",
      JSON.stringify({
        manifest: exported.manifest,
        sourceIdentity: exported.sourceIdentity,
        project: read.project
      })
    );
  }

  return {
    ok: packageRoundTripOk && jsonToWcadCompatible && diagnosticCount === 0,
    packageVersion: exported.manifest.packageVersion,
    documentSchemaVersion: exported.manifest.document.schemaVersion,
    sourceIdentityAlgorithm: exported.sourceIdentity.algorithm,
    byteLength: exported.bytes.byteLength,
    packageRoundTripOk,
    jsonToWcadCompatible,
    diagnosticCount
  };
}

function verifyExactStepExport({ engine, fixture, failures }) {
  const expectedStep = fixture.expectedExportReadiness.formats.find(
    (format) => format.format === "step"
  );
  const response = readProjectExactExport(engine);

  if (!expectedStep) {
    failures.push("fixture expectedExportReadiness is missing STEP.");
  }

  checkEqual(
    failures,
    "project.exportExact.query",
    "project.exportExact",
    response.query
  );
  checkEqual(failures, "project.exportExact.format", "step", response.format);
  checkEqual(
    failures,
    "project.exportExact.writerStatus",
    "available",
    response.writerStatus
  );
  checkEqual(
    failures,
    "project.exportExact.status",
    expectedStep?.status,
    response.status
  );
  checkEqual(
    failures,
    "project.exportExact.available",
    expectedStep?.available,
    response.available
  );
  checkEqual(
    failures,
    "project.exportExact.sourceSupportedBodyCount",
    expectedStep?.sourceSupportedBodyCount,
    response.sourceSupportedBodyCount
  );
  checkEqual(
    failures,
    "project.exportExact.artifact",
    undefined,
    response.artifact
  );
  checkNoBoundaryLeaks(
    failures,
    "project.exportExact response",
    JSON.stringify(response)
  );

  if (expectedStep?.available) {
    if (response.exportableBodyCount <= 0) {
      failures.push("project.exportExact.exportableBodyCount: expected > 0");
    }

    checkEqual(
      failures,
      "project.exportExact.exportSources.length",
      expectedStep.sourceSupportedBodyCount,
      response.exportSources.length
    );
  } else if (response.exportableBodyCount !== 0) {
    failures.push(
      `project.exportExact.exportableBodyCount: expected 0, got ${response.exportableBodyCount}`
    );
  }

  if (!expectedStep?.available && response.diagnosticCount <= 0) {
    failures.push("project.exportExact.diagnosticCount: expected > 0");
  }

  return {
    status: response.status,
    available: response.available,
    writerStatus: response.writerStatus,
    sourceSupportedBodyCount: response.sourceSupportedBodyCount,
    exportableBodyCount: response.exportableBodyCount,
    diagnosticCodes: unique(
      response.diagnostics.map((diagnostic) => diagnostic.code)
    )
  };
}

async function evaluateWcadCorruptionChecks(cadCore, fixture) {
  const failures = [];
  const engine = new cadCore.CadEngine();
  const batchResponse = engine.executeBatch(
    cadCore.createV7ReleaseSampleBatch(fixture.id)
  );

  if (!batchResponse.ok) {
    failures.push("fixture batch did not build for WCAD corruption checks.");
    return createCheckResult("wcad-corruption", failures, []);
  }

  const exported = await cadCore.exportCadProjectWcad(engine);
  const invalidZip = await cadCore.readCadProjectWcad(
    new Uint8Array([1, 2, 3])
  );
  const corruptedDocument = await cadCore.readCadProjectWcad(
    corruptFirstMatchingByte(exported.bytes, exported.documentBytes)
  );
  const issueCodes = [
    ...collectIssueCodes(invalidZip),
    ...collectIssueCodes(corruptedDocument)
  ];

  if (invalidZip.ok) {
    failures.push("invalid zip unexpectedly read as a valid WCAD package.");
  } else {
    requireIssueCode(
      failures,
      "invalid zip",
      invalidZip,
      "WCAD_INVALID_PACKAGE"
    );
    requireIssueCode(
      failures,
      "invalid zip",
      invalidZip,
      "WCAD_MISSING_MANIFEST"
    );
  }

  if (corruptedDocument.ok) {
    failures.push(
      "corrupted document entry unexpectedly read as a valid WCAD package."
    );
  } else {
    requireIssueCode(
      failures,
      "corrupted document entry",
      corruptedDocument,
      "WCAD_INVALID_PACKAGE"
    );
  }

  return createCheckResult("wcad-corruption", failures, unique(issueCodes));
}

function evaluateUnsupportedExactStep(cadCore) {
  const failures = [];
  const engine = new cadCore.CadEngine();

  engine.apply({
    op: "scene.createBox",
    id: "v8_unsupported_box",
    name: "Unsupported exact export box",
    dimensions: { width: 1, height: 2, depth: 3 }
  });

  const response = readProjectExactExport(engine, {
    bodyIds: ["body:v8_unsupported_box", "body_missing"]
  });

  checkEqual(
    failures,
    "unsupported STEP status",
    "unavailable",
    response.status
  );
  checkEqual(failures, "unsupported STEP available", false, response.available);
  checkEqual(
    failures,
    "unsupported STEP exportableBodyCount",
    0,
    response.exportableBodyCount
  );
  requireDiagnosticCode(
    failures,
    "unsupported STEP diagnostics",
    response.diagnostics,
    "EXPORT_EXACT_BODY_UNSUPPORTED"
  );
  requireDiagnosticCode(
    failures,
    "unsupported STEP diagnostics",
    response.diagnostics,
    "EXPORT_BODY_SOURCE_UNRESOLVED"
  );
  checkNoBoundaryLeaks(
    failures,
    "unsupported project.exportExact response",
    JSON.stringify(response)
  );

  return createCheckResult(
    "unsupported-exact-step",
    failures,
    unique(response.diagnostics.map((diagnostic) => diagnostic.code))
  );
}

function readProjectExactExport(engine, options = {}) {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "project.exportExact",
      format: "step",
      ...(options.bodyIds ? { bodyIds: options.bodyIds } : {}),
      ...(options.sourceIdentity
        ? { sourceIdentity: options.sourceIdentity }
        : {})
    }
  });

  if (!response.ok || response.query !== "project.exportExact") {
    throw new Error("Expected project.exportExact response.");
  }

  return response;
}

function summarizePackageChecks(samples, corruptionChecks) {
  return {
    wcadRoundTripCount: samples.filter(
      (sample) => sample.wcad.packageRoundTripOk
    ).length,
    jsonToWcadRoundTripCount: samples.filter(
      (sample) => sample.wcad.jsonToWcadCompatible
    ).length,
    sourceSeparationCheckCount: samples.filter(
      (sample) => sample.wcad.ok && sample.failures.length === 0
    ).length,
    corruptionStatus: corruptionChecks.status,
    corruptionIssueCodes: corruptionChecks.issueCodes
  };
}

function summarizeExactStepChecks(samples, unsupportedExactStep) {
  return {
    supportedSampleCount: samples.filter(
      (sample) => sample.exactStep.status === "supported"
    ).length,
    unsupportedSampleCount: samples.filter(
      (sample) => sample.exactStep.status !== "supported"
    ).length,
    exportableBodyCount: samples.reduce(
      (sum, sample) => sum + sample.exactStep.exportableBodyCount,
      0
    ),
    unsupportedPrimitiveStatus: unsupportedExactStep.status,
    unsupportedIssueCodes: unsupportedExactStep.issueCodes
  };
}

function createEmptyWcadSummary() {
  return {
    ok: false,
    packageVersion: "unknown",
    documentSchemaVersion: "unknown",
    sourceIdentityAlgorithm: "unknown",
    byteLength: 0,
    packageRoundTripOk: false,
    jsonToWcadCompatible: false,
    diagnosticCount: 0
  };
}

function createEmptyExactStepSummary() {
  return {
    status: "unknown",
    available: false,
    writerStatus: "unknown",
    sourceSupportedBodyCount: 0,
    exportableBodyCount: 0,
    diagnosticCodes: []
  };
}

function createSkippedCheck(id, reason) {
  return {
    id,
    status: "skip",
    issueCodes: [],
    failures: [reason]
  };
}

function createCheckResult(id, failures, issueCodes) {
  return {
    id,
    status: failures.length > 0 ? "fail" : "pass",
    issueCodes,
    failures
  };
}

function collectIssueCodes(result) {
  return result.ok
    ? result.diagnostics.map((diagnostic) => diagnostic.code)
    : result.issues.map((issue) => issue.code);
}

function requireIssueCode(failures, label, result, code) {
  const issueCodes = collectIssueCodes(result);

  if (!issueCodes.includes(code)) {
    failures.push(
      `${label}: expected issue ${code}, got ${issueCodes.join(", ")}`
    );
  }
}

function requireDiagnosticCode(failures, label, diagnostics, code) {
  if (!diagnostics.some((diagnostic) => diagnostic.code === code)) {
    failures.push(
      `${label}: expected diagnostic ${code}, got ${diagnostics
        .map((diagnostic) => diagnostic.code)
        .join(", ")}`
    );
  }
}

function corruptFirstMatchingByte(bytes, needle) {
  const offset = findSubarray(bytes, needle);

  if (offset === -1) {
    throw new Error("Could not find package entry bytes to corrupt.");
  }

  const corrupted = new Uint8Array(bytes);
  corrupted[offset] = corrupted[offset] ^ 0xff;

  return corrupted;
}

function findSubarray(bytes, needle) {
  if (needle.length === 0 || needle.length > bytes.length) {
    return -1;
  }

  for (let offset = 0; offset <= bytes.length - needle.length; offset += 1) {
    let matches = true;

    for (let index = 0; index < needle.length; index += 1) {
      if (bytes[offset + index] !== needle[index]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return offset;
    }
  }

  return -1;
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
    RAW_DERIVED_ID_PATTERN.test(text) ||
    V8_RELEASE_BOUNDARY_LEAK_PATTERN.test(text)
  ) {
    failures.push(
      `${label}: leaked renderer/mesh/OCCT/cache/file-handle/OPFS/selection-buffer implementation detail`
    );
  }
}

function stableJson(value) {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortJsonValue(value[key])])
    );
  }

  return value;
}

function unique(values) {
  return [...new Set(values)];
}

function formatValue(value) {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

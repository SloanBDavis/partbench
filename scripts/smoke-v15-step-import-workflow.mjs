import { register } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { V15_RELEASE_BOUNDARY_LEAK_PATTERN } from "./v15-release-samples.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const loaderPath = new URL("./ts-source-loader.mjs", import.meta.url);
const cadCorePath = pathToFileURL(
  resolve(repoRoot, "packages/cad-core/src/index.ts")
);
const args = new Set(process.argv.slice(2));

if (args.has("--help")) {
  console.log(`Usage: node scripts/smoke-v15-step-import-workflow.mjs [--json]

Runs the V15 STEP import workflow smoke through the async import resolver. The
smoke verifies dry-run preview, commit, imported-body status, explicit topology
anchors, sketch-on-imported-face, cut through an imported body, V19 JSON, and
.wcad checkpoint payload preservation.`);
  process.exitCode = 0;
} else {
  register(loaderPath, import.meta.url);

  const cadCore = await import(cadCorePath.href);
  const result = await runV15StepImportWorkflowSmoke(cadCore);

  if (args.has("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatV15StepImportWorkflowSmokeSummary(result));
  }

  process.exitCode = result.ok ? 0 : 1;
}

async function runV15StepImportWorkflowSmoke(cadCore) {
  const failures = [];
  let operationCheckCount = 0;
  let queryCheckCount = 0;
  let roundTripCheckCount = 0;
  let boundaryCheckCount = 0;
  const engine = new cadCore.CadEngine();
  const executor = new cadCore.AsyncCadCommandExecutor(
    engine,
    new cadCore.MockCadCommandWorker(),
    { stepImportResolver: createDeterministicStepImportResolver(cadCore) }
  );
  const importOp = {
    op: "project.importStep",
    sourceFileName: "v15-step-smoke.step",
    sourceFormat: "step",
    payloadRef: {
      kind: "transient",
      payloadId: "v15_step_smoke_payload",
      byteLength: 128
    },
    maxBodyCount: 1
  };

  const beforeDryRunJson = cadCore.exportCadProjectJson(engine);
  const dryRun = await executor.executeBatch({
    version: "cadops.v1",
    mode: "dryRun",
    ops: [importOp]
  });
  checkEqual(failures, "dryRun.ok", true, dryRun.ok);
  checkEqual(
    failures,
    "dryRun.mutatesSource",
    beforeDryRunJson,
    cadCore.exportCadProjectJson(engine)
  );
  checkEqual(
    failures,
    "dryRun.createdBodyCount",
    1,
    dryRun.createdBodyIds?.length
  );
  checkEqual(
    failures,
    "dryRun.checkpointPayloadCount",
    1,
    dryRun.importedStepCheckpointPayloads?.length
  );
  operationCheckCount += 4;

  const commit = await executor.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [importOp]
  });
  checkEqual(failures, "commit.ok", true, commit.ok);
  checkEqual(
    failures,
    "commit.createdBodyCount",
    1,
    commit.createdBodyIds?.length
  );
  checkEqual(
    failures,
    "commit.checkpointPayloadCount",
    1,
    commit.importedStepCheckpointPayloads?.length
  );
  operationCheckCount += 3;

  if (!commit.ok) {
    return finalizeResult({
      failures,
      operationCheckCount,
      queryCheckCount,
      roundTripCheckCount,
      boundaryCheckCount
    });
  }

  const importedBodyId = commit.createdBodyIds[0];
  const importedFeatureId = commit.createdFeatureIds[0];
  const checkpointId = `checkpoint_${importedBodyId}`;

  const anchorResult = engine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "topology.anchor.create",
        anchorId: "v15_step_imported_body_anchor",
        entityKind: "body",
        bodyId: importedBodyId,
        checkpointId,
        checkpointEntityId: "v15_step_imported_body_entity",
        sourceFeatureId: importedFeatureId,
        stableId: `generated:body:${importedBodyId}`,
        sourceSemanticRole: "imported body",
        signatureHash: "v15_step_imported_body_signature"
      },
      {
        op: "topology.anchor.create",
        anchorId: "v15_step_imported_face_anchor",
        entityKind: "face",
        bodyId: importedBodyId,
        checkpointId,
        checkpointEntityId: "v15_step_imported_planar_face_entity",
        sourceFeatureId: importedFeatureId,
        sourceSemanticRole: "imported planar face",
        signatureHash: "v15_step_imported_face_signature"
      }
    ]
  });
  checkEqual(failures, "anchorResult.ok", true, anchorResult.ok);
  operationCheckCount += 1;

  const cutResult = engine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "sketch.createOnFace",
        id: "v15_step_imported_face_sketch",
        name: "Imported face cut sketch",
        topologyAnchorId: "v15_step_imported_face_anchor",
        topologyAnchorProof: {
          kind: "axisAlignedPlanarFace",
          entityKind: "face",
          evidenceSource: "checkpointSnapshot",
          exposesCheckpointLocalIds: false,
          planarAxis: "z",
          planarCoordinate: 3,
          bounds: {
            min: [0, 0, 3],
            max: [4, 2, 3]
          }
        }
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v15_step_imported_face_sketch",
        id: "v15_step_imported_cut_rect",
        center: [1, 1],
        width: 0.5,
        height: 0.5
      },
      {
        op: "feature.extrude",
        id: "v15_step_imported_cut_feature",
        bodyId: "v15_step_imported_cut_body",
        name: "Imported body cut",
        sketchId: "v15_step_imported_face_sketch",
        entityId: "v15_step_imported_cut_rect",
        depth: 0.5,
        operationMode: "cut",
        targetTopologyAnchorId: "v15_step_imported_body_anchor"
      }
    ]
  });
  checkEqual(failures, "cutResult.ok", true, cutResult.ok);
  operationCheckCount += 1;

  const structure = readQuery(engine, {
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  const importReadiness = readQuery(engine, {
    version: "cadops.v1",
    query: { query: "project.importReadiness" }
  });
  const bodyStatus = readQuery(engine, {
    version: "cadops.v1",
    query: { query: "body.importedBodyStatus", bodyId: importedBodyId }
  });
  const health = readQuery(engine, {
    version: "cadops.v1",
    query: { query: "project.health" }
  });

  checkEqual(
    failures,
    "importReadiness.importedBodyCount",
    1,
    importReadiness.importedBodyCount
  );
  checkEqual(failures, "bodyStatus.imported", true, bodyStatus.imported);
  checkEqual(failures, "bodyStatus.status", "healthy", bodyStatus.status);
  checkIncludes(
    failures,
    "health.status",
    ["healthy", "under-defined", "unsupported"],
    health.status
  );
  checkEqual(
    failures,
    "cutFeature.present",
    true,
    structure.features.some(
      (feature) =>
        feature.id === "v15_step_imported_cut_feature" &&
        feature.kind === "extrude"
    )
  );
  queryCheckCount += 5;

  const json = cadCore.exportCadProjectJson(engine);
  const project = cadCore.parseCadProjectJson(json);
  const restored = cadCore.importCadProjectJson(json);
  const restoredStatus = readQuery(restored, {
    version: "cadops.v1",
    query: { query: "body.importedBodyStatus", bodyId: importedBodyId }
  });
  checkEqual(
    failures,
    "json.schemaVersion",
    cadCore.CAD_PROJECT_FORMAT_VERSION_V19,
    project.schemaVersion
  );
  checkEqual(
    failures,
    "restoredBodyStatus.status",
    "healthy",
    restoredStatus.status
  );
  checkNoBoundaryLeaks(failures, "project JSON", json);
  roundTripCheckCount += 2;
  boundaryCheckCount += 1;

  const wcad = await cadCore.exportCadProjectToWcad(project, {
    topologyCheckpoints: commit.importedStepCheckpointPayloads
  });
  const wcadRead = await cadCore.readCadProjectWcad(wcad.bytes);
  checkEqual(failures, "wcad.read.ok", true, wcadRead.ok);
  if (wcadRead.ok) {
    checkEqual(
      failures,
      "wcad.schemaVersion",
      cadCore.CAD_PROJECT_FORMAT_VERSION_V19,
      wcadRead.project.schemaVersion
    );
    checkEqual(
      failures,
      "wcad.checkpointPayloadCount",
      1,
      wcadRead.checkpointPayloads.length
    );
  }
  roundTripCheckCount += 3;

  checkNoBoundaryLeaks(
    failures,
    "workflow queries",
    JSON.stringify({ structure, importReadiness, bodyStatus, health })
  );
  boundaryCheckCount += 1;

  return finalizeResult({
    failures,
    operationCheckCount,
    queryCheckCount,
    roundTripCheckCount,
    boundaryCheckCount
  });
}

function createDeterministicStepImportResolver(cadCore) {
  const encoder = new TextEncoder();

  return {
    async resolveProjectImportStep(input) {
      const topologyPayload = {
        source: "kernel-derived",
        status: "ready",
        entityCounts: {
          bodyCount: 1,
          solidCount: 0,
          faceCount: 1,
          loopCount: 0,
          wireCount: 0,
          coedgeCount: 0,
          edgeCount: 0,
          vertexCount: 0,
          axisCount: 0
        },
        entityCount: 2,
        entities: [
          {
            localId: "v15_step_imported_body_entity",
            kind: "body",
            source: "kernel-derived",
            signature: "v15_step_imported_body_signature"
          },
          {
            localId: "v15_step_imported_planar_face_entity",
            kind: "face",
            source: "kernel-derived",
            signature: "v15_step_imported_face_signature"
          }
        ],
        unsupportedEntityKinds: [],
        adjacencyAvailable: false,
        signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
        signature: "v15_step_imported_topology_signature",
        diagnostics: []
      };
      const signaturePayload = {
        checkpointId: input.checkpointId,
        signatureAlgorithm: topologyPayload.signatureAlgorithm,
        signature: topologyPayload.signature,
        entityCount: topologyPayload.entityCount,
        entities: topologyPayload.entities.map((entity) => ({
          localId: entity.localId,
          kind: entity.kind,
          signature: entity.signature
        }))
      };

      return {
        resolvedBodies: [
          {
            featureId: input.featureId,
            bodyId: input.bodyId,
            checkpointId: input.checkpointId,
            name: "Imported smoke body",
            sourceIdentity: {
              algorithm: "partbench-source-v1",
              sha256:
                "4444444444444444444444444444444444444444444444444444444444444444"
            },
            healingApplied: false,
            diagnostics: [
              {
                code: "STEP_READER_AVAILABLE",
                severity: "info",
                message: "STEP reader accepted deterministic smoke bytes."
              },
              {
                code: "STEP_HEALING_NOT_REQUIRED",
                severity: "info",
                message: "No healing changes were required for the smoke body."
              }
            ]
          }
        ],
        checkpointPayloads: [
          {
            checkpointId: input.checkpointId,
            bodyId: input.bodyId,
            sourceFeatureId: input.featureId,
            units: input.document.units,
            kernel: {
              boundary: "geometry-kernel",
              snapshotAlgorithm: "partbench-derived-topology-snapshot-v1"
            },
            tolerance: {
              linearTolerance: 0.001,
              angularToleranceDegrees: 0.01
            },
            brepBytes: encoder.encode("v15 step smoke brep payload"),
            topologyBytes: cadCore.encodeWcadCanonicalCbor(topologyPayload),
            signatureBytes: cadCore.encodeWcadCanonicalCbor(signaturePayload)
          }
        ],
        diagnostics: [
          {
            code: "STEP_READER_AVAILABLE",
            severity: "info",
            message: "STEP reader accepted deterministic smoke bytes."
          }
        ]
      };
    }
  };
}

function finalizeResult({
  failures,
  operationCheckCount,
  queryCheckCount,
  roundTripCheckCount,
  boundaryCheckCount
}) {
  const invariantFailures = [];

  if (operationCheckCount <= 0) {
    invariantFailures.push("V15 STEP import smoke requires operation checks.");
  }
  if (queryCheckCount <= 0) {
    invariantFailures.push("V15 STEP import smoke requires query checks.");
  }
  if (roundTripCheckCount <= 0) {
    invariantFailures.push("V15 STEP import smoke requires round-trip checks.");
  }
  if (boundaryCheckCount <= 0) {
    invariantFailures.push("V15 STEP import smoke requires boundary checks.");
  }

  return {
    ok: failures.length === 0 && invariantFailures.length === 0,
    workflow: "v15-step-import",
    operationCheckCount,
    queryCheckCount,
    roundTripCheckCount,
    boundaryCheckCount,
    failures,
    invariantFailures
  };
}

function formatV15StepImportWorkflowSmokeSummary(result) {
  const lines = [
    `V15 STEP import workflow smoke ${result.ok ? "passed" : "failed"}`,
    `checks: ${result.operationCheckCount} operation, ${result.queryCheckCount} query, ${result.roundTripCheckCount} round-trip, ${result.boundaryCheckCount} boundary`
  ];

  for (const failure of result.failures) {
    lines.push(`- fail ${failure}`);
  }
  for (const failure of result.invariantFailures) {
    lines.push(`- invariant-fail ${failure}`);
  }

  return lines.join("\n");
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

function checkEqual(failures, label, expected, actual) {
  if (!Object.is(expected, actual)) {
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

function formatValue(value) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

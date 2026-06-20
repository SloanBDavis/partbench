import { V10_RELEASE_BOUNDARY_LEAK_PATTERN } from "./v10-release-samples.mjs";
import { V8_RELEASE_BOUNDARY_LEAK_PATTERN } from "./v8-release-samples.mjs";

export const V11_RELEASE_BOUNDARY_LEAK_PATTERN =
  /rendererId|renderId|meshId|occtId|occtShape|cacheKey|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|fileHandle|fileSystemHandle|opfsPath|localPath|absolutePath|gpuBufferId|pixelId|viewportState|solverMatrix|residualCache/i;

export async function runV11ReleaseSampleSmoke(cadCore) {
  const samples = [
    await evaluateCommandDrivenSketchChain(cadCore),
    await evaluateAdvancedConstraintSourceChain(cadCore)
  ];
  const failedCount = samples.filter(
    (sample) => sample.status === "fail"
  ).length;
  const result = {
    ok: failedCount === 0,
    sampleCount: samples.length,
    passedCount: samples.length - failedCount,
    failedCount,
    solverCheckCount: samples.reduce(
      (sum, sample) => sum + sample.solverCheckCount,
      0
    ),
    dryRunCheckCount: samples.reduce(
      (sum, sample) => sum + sample.dryRunCheckCount,
      0
    ),
    rebuildCheckCount: samples.reduce(
      (sum, sample) => sum + sample.rebuildCheckCount,
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
    "V11 release smoke result",
    JSON.stringify(result)
  );

  if (boundaryFailures.length > 0) {
    return { ...result, ok: false, boundaryFailures };
  }

  return result;
}

export function formatV11ReleaseSampleSmokeSummary(result) {
  const lines = [
    `V11 release sketch solver smoke ${result.ok ? "passed" : "failed"}`,
    `samples: ${result.passedCount} passed, ${result.failedCount} failed, ${result.sampleCount} total`,
    `checks: ${result.solverCheckCount} solver, ${result.dryRunCheckCount} dry-run, ${result.rebuildCheckCount} rebuild/reference, ${result.roundTripCheckCount} round-trip`
  ];

  for (const sample of result.samples) {
    lines.push(
      `- ${sample.status} ${sample.id} | solver ${sample.solverCheckCount} | dry-run ${sample.dryRunCheckCount} | rebuild ${sample.rebuildCheckCount} | round-trips ${sample.roundTripCheckCount}`
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

async function evaluateCommandDrivenSketchChain(cadCore) {
  const failures = [];
  const engine = new cadCore.CadEngine();
  let solverCheckCount = 0;
  let dryRunCheckCount = 0;
  let rebuildCheckCount = 0;
  let roundTripCheckCount = 0;

  const seed = engine.executeBatch(createCommandDrivenSeedBatch());
  checkEqual(failures, "core.seed.ok", true, seed.ok);
  checkEqual(failures, "core.seed.mode", "commit", seed.mode);
  checkIncludes(
    failures,
    "core.seed.createdSketchDimensionIds",
    seed.createdSketchDimensionIds ?? [],
    "v11_dim_rect_width"
  );
  checkIncludes(
    failures,
    "core.seed.createdSketchConstraintIds",
    seed.createdSketchConstraintIds ?? [],
    "v11_con_parallel"
  );
  checkIncludes(
    failures,
    "core.seed.createdFeatureIds",
    seed.createdFeatureIds ?? [],
    "v11_feat_rect"
  );

  const initialSolver = executeQuery(engine, {
    query: "sketch.solverStatus",
    sketchId: "v11_sketch_core"
  });
  solverCheckCount += verifyCoreSolverStatus(
    initialSolver,
    failures,
    "core.initialSolver"
  );

  const beforeDryRunJson = cadCore.exportCadProjectJson(engine);
  const dryRun = engine.executeBatch({
    version: "cadops.v1",
    mode: "dryRun",
    ops: [
      {
        op: "sketch.dimension.update",
        id: "v11_dim_rect_width",
        value: 5
      },
      {
        op: "sketch.constraint.create",
        id: "v11_con_vertical_extra",
        name: "Extra vertical",
        sketchId: "v11_sketch_core",
        entityId: "v11_line_vertical",
        kind: "vertical"
      }
    ]
  });
  dryRunCheckCount += verifyDryRun({
    cadCore,
    engine,
    failures,
    label: "core.dimensionConstraintDryRun",
    beforeJson: beforeDryRunJson,
    response: dryRun
  });

  const commit = engine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "sketch.dimension.update",
        id: "v11_dim_rect_width",
        value: 5
      }
    ]
  });
  checkEqual(failures, "core.commit.ok", true, commit.ok);
  checkIncludes(
    failures,
    "core.commit.modifiedSketchDimensionIds",
    commit.modifiedSketchDimensionIds ?? [],
    "v11_dim_rect_width"
  );
  checkIncludes(
    failures,
    "core.commit.modifiedSketchEntityIds",
    commit.modifiedSketchEntityIds ?? [],
    "v11_rect_profile"
  );

  const committedSolver = executeQuery(engine, {
    query: "sketch.solverStatus",
    sketchId: "v11_sketch_core"
  });
  solverCheckCount += verifyCoreSolverStatus(
    committedSolver,
    failures,
    "core.committedSolver"
  );
  checkEqual(
    failures,
    "core.committedWidth",
    5,
    committedSolver.dimensions.find(
      (dimension) => dimension.dimensionId === "v11_dim_rect_width"
    )?.effectiveValue
  );

  rebuildCheckCount += verifyRebuildAndReferences(engine, failures);
  roundTripCheckCount += await verifySourceRoundTrip({
    cadCore,
    engine,
    failures,
    label: "core"
  });

  return createSampleResult({
    id: "v11-command-sketch-feature-chain",
    failures,
    solverCheckCount,
    dryRunCheckCount,
    rebuildCheckCount,
    roundTripCheckCount
  });
}

async function evaluateAdvancedConstraintSourceChain(cadCore) {
  const failures = [];
  const engine = cadCore.importCadProject(
    createAdvancedConstraintProject(cadCore)
  );
  let solverCheckCount = 0;
  let dryRunCheckCount = 0;
  let rebuildCheckCount = 0;
  let roundTripCheckCount = 0;
  const beforeJson = cadCore.exportCadProjectJson(engine);
  const solver = executeQuery(engine, {
    query: "sketch.solverStatus",
    sketchId: "v11_sketch_advanced"
  });

  solverCheckCount += verifyAdvancedSolverStatus(solver, failures);
  checkEqual(
    failures,
    "advanced.queryNonMutation",
    beforeJson,
    cadCore.exportCadProjectJson(engine)
  );
  dryRunCheckCount += 1;

  roundTripCheckCount += await verifySourceRoundTrip({
    cadCore,
    engine,
    failures,
    label: "advanced"
  });

  return createSampleResult({
    id: "v11-advanced-constraint-source-chain",
    failures,
    solverCheckCount,
    dryRunCheckCount,
    rebuildCheckCount,
    roundTripCheckCount
  });
}

function createCommandDrivenSeedBatch() {
  return {
    version: "cadops.v1",
    mode: "commit",
    ops: [
      {
        op: "sketch.create",
        id: "v11_sketch_core",
        name: "V11 core solver chain",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v11_sketch_core",
        id: "v11_rect_profile",
        center: [0, 0],
        width: 4,
        height: 2
      },
      {
        op: "sketch.addCircle",
        sketchId: "v11_sketch_core",
        id: "v11_circle_profile",
        center: [8, 0],
        radius: 1
      },
      {
        op: "sketch.addLine",
        sketchId: "v11_sketch_core",
        id: "v11_line_base",
        start: [0, 4],
        end: [3, 4]
      },
      {
        op: "sketch.addLine",
        sketchId: "v11_sketch_core",
        id: "v11_line_parallel",
        start: [0, 6],
        end: [5, 6]
      },
      {
        op: "sketch.addLine",
        sketchId: "v11_sketch_core",
        id: "v11_line_vertical",
        start: [6, 4],
        end: [6, 8]
      },
      {
        op: "sketch.addPoint",
        sketchId: "v11_sketch_core",
        id: "v11_point_mid",
        point: [0, 4]
      },
      {
        op: "sketch.dimension.create",
        id: "v11_dim_rect_width",
        name: "Rectangle width",
        sketchId: "v11_sketch_core",
        entityId: "v11_rect_profile",
        target: { entityKind: "rectangle", role: "width" },
        value: 4
      },
      {
        op: "sketch.dimension.create",
        id: "v11_dim_line_length",
        name: "Base line length",
        sketchId: "v11_sketch_core",
        entityId: "v11_line_base",
        target: { entityKind: "line", role: "length" },
        value: 3
      },
      {
        op: "sketch.dimension.create",
        id: "v11_dim_circle_radius",
        name: "Circle radius",
        sketchId: "v11_sketch_core",
        entityId: "v11_circle_profile",
        target: { entityKind: "circle", role: "radius" },
        value: 1
      },
      {
        op: "sketch.constraint.create",
        id: "v11_con_horizontal",
        name: "Base horizontal",
        sketchId: "v11_sketch_core",
        entityId: "v11_line_base",
        kind: "horizontal"
      },
      {
        op: "sketch.constraint.create",
        id: "v11_con_fixed_start",
        name: "Fixed base start",
        sketchId: "v11_sketch_core",
        kind: "fixed",
        target: { entityId: "v11_line_base", role: "start" }
      },
      {
        op: "sketch.constraint.create",
        id: "v11_con_midpoint",
        name: "Point on midpoint",
        sketchId: "v11_sketch_core",
        kind: "midpoint",
        lineEntityId: "v11_line_base",
        target: { entityId: "v11_point_mid", role: "position" }
      },
      {
        op: "sketch.constraint.create",
        id: "v11_con_parallel",
        name: "Parallel lines",
        sketchId: "v11_sketch_core",
        kind: "parallel",
        primaryLineEntityId: "v11_line_base",
        secondaryLineEntityId: "v11_line_parallel"
      },
      {
        op: "sketch.constraint.create",
        id: "v11_con_perpendicular",
        name: "Perpendicular line",
        sketchId: "v11_sketch_core",
        kind: "perpendicular",
        primaryLineEntityId: "v11_line_base",
        secondaryLineEntityId: "v11_line_vertical"
      },
      {
        op: "feature.extrude",
        id: "v11_feat_rect",
        sketchId: "v11_sketch_core",
        entityId: "v11_rect_profile",
        depth: 2,
        operationMode: "newBody",
        bodyId: "v11_body_rect"
      }
    ]
  };
}

function createAdvancedConstraintProject(cadCore) {
  const engine = new cadCore.CadEngine();

  engine.applyBatch([
    {
      op: "sketch.create",
      id: "v11_sketch_advanced",
      name: "V11 advanced source chain",
      plane: "XY"
    },
    {
      op: "sketch.addLine",
      sketchId: "v11_sketch_advanced",
      id: "v11_adv_line_1",
      start: [0, 0],
      end: [4, 0]
    },
    {
      op: "sketch.addLine",
      sketchId: "v11_sketch_advanced",
      id: "v11_adv_line_2",
      start: [0, 1],
      end: [2, 4.464101615]
    },
    {
      op: "sketch.addCircle",
      sketchId: "v11_sketch_advanced",
      id: "v11_adv_circle_1",
      center: [1, 1],
      radius: 1
    },
    {
      op: "sketch.addCircle",
      sketchId: "v11_sketch_advanced",
      id: "v11_adv_circle_2",
      center: [1, 1],
      radius: 1
    },
    {
      op: "sketch.addPoint",
      sketchId: "v11_sketch_advanced",
      id: "v11_adv_point_1",
      point: [1, 0]
    },
    {
      op: "sketch.addPoint",
      sketchId: "v11_sketch_advanced",
      id: "v11_adv_point_2",
      point: [-1, 0]
    }
  ]);

  const project = engine.exportProject();
  return {
    ...project,
    schemaVersion: cadCore.CAD_PROJECT_FORMAT_VERSION_V17,
    document: {
      ...project.document,
      sketchConstraints: [
        ...(project.document.sketchConstraints ?? []),
        {
          id: "v11_adv_tangent",
          name: "Line circle tangent",
          sketchId: "v11_sketch_advanced",
          entityId: "v11_adv_circle_1",
          kind: "tangent",
          primaryTarget: { entityId: "v11_adv_line_1", entityKind: "line" },
          secondaryTarget: {
            entityId: "v11_adv_circle_1",
            entityKind: "circle"
          }
        },
        {
          id: "v11_adv_concentric",
          name: "Concentric circles",
          sketchId: "v11_sketch_advanced",
          entityId: "v11_adv_circle_2",
          kind: "concentric",
          primaryCircleEntityId: "v11_adv_circle_1",
          secondaryCircleEntityId: "v11_adv_circle_2"
        },
        {
          id: "v11_adv_equal_length",
          name: "Equal line length",
          sketchId: "v11_sketch_advanced",
          entityId: "v11_adv_line_2",
          kind: "equalLength",
          primaryLineEntityId: "v11_adv_line_1",
          secondaryLineEntityId: "v11_adv_line_2"
        },
        {
          id: "v11_adv_equal_radius",
          name: "Equal circle radius",
          sketchId: "v11_sketch_advanced",
          entityId: "v11_adv_circle_2",
          kind: "equalRadius",
          primaryCircleEntityId: "v11_adv_circle_1",
          secondaryCircleEntityId: "v11_adv_circle_2"
        },
        {
          id: "v11_adv_angle",
          name: "Sixty degrees",
          sketchId: "v11_sketch_advanced",
          entityId: "v11_adv_line_2",
          kind: "angle",
          primaryLineEntityId: "v11_adv_line_1",
          secondaryLineEntityId: "v11_adv_line_2",
          angleDegrees: 60
        },
        {
          id: "v11_adv_symmetry",
          name: "Symmetric points",
          sketchId: "v11_sketch_advanced",
          entityId: "v11_adv_point_2",
          kind: "symmetry",
          primaryTarget: { entityId: "v11_adv_point_1", role: "position" },
          secondaryTarget: { entityId: "v11_adv_point_2", role: "position" },
          symmetryLineEntityId: "v11_adv_line_1"
        }
      ],
      nextSketchConstraintNumber: 100
    },
    history: [],
    redoStack: []
  };
}

function verifyCoreSolverStatus(response, failures, label) {
  let checkCount = 0;

  checkEqual(failures, `${label}.ok`, true, response.ok);
  checkEqual(failures, `${label}.query`, "sketch.solverStatus", response.query);
  checkEqual(failures, `${label}.modelBuilt`, true, response.solver.modelBuilt);
  checkEqual(failures, `${label}.solverRan`, true, response.solver.solverRan);
  checkEqual(
    failures,
    `${label}.canSolveNumerically`,
    true,
    response.solver.canSolveNumerically
  );
  checkIncludes(
    failures,
    `${label}.constraintKinds`,
    response.constraints.map((constraint) => constraint.kind),
    "parallel"
  );
  checkIncludes(
    failures,
    `${label}.constraintKinds`,
    response.constraints.map((constraint) => constraint.kind),
    "perpendicular"
  );
  checkNoBoundaryLeaks(failures, label, JSON.stringify(response));

  checkCount += 8;
  return checkCount;
}

function verifyAdvancedSolverStatus(response, failures) {
  let checkCount = 0;

  checkEqual(failures, "advanced.solver.ok", true, response.ok);
  checkEqual(
    failures,
    "advanced.solver.schema",
    "web-cad.project.v17",
    response.sourceContract.currentProjectSchemaVersion
  );
  checkEqual(
    failures,
    "advanced.solver.modelBuilt",
    true,
    response.solver.modelBuilt
  );
  checkEqual(
    failures,
    "advanced.solver.solverRan",
    true,
    response.solver.solverRan
  );

  for (const kind of [
    "tangent",
    "concentric",
    "equalLength",
    "equalRadius",
    "angle",
    "symmetry"
  ]) {
    const entry = response.constraints.find(
      (constraint) => constraint.kind === kind
    );
    checkEqual(failures, `advanced.${kind}.present`, true, Boolean(entry));
    checkEqual(
      failures,
      `advanced.${kind}.sourceBacked`,
      true,
      entry?.sourceBacked
    );
    checkEqual(
      failures,
      `advanced.${kind}.numericalSupport`,
      true,
      entry?.supportedByNumericalSolver
    );
    checkCount += 3;
  }

  checkNoBoundaryLeaks(failures, "advanced.solver", JSON.stringify(response));

  return checkCount + 4;
}

function verifyDryRun({
  cadCore,
  engine,
  failures,
  label,
  beforeJson,
  response
}) {
  checkEqual(failures, `${label}.ok`, true, response.ok);
  checkEqual(failures, `${label}.mode`, "dryRun", response.mode);
  checkEqual(
    failures,
    `${label}.nonMutation`,
    beforeJson,
    cadCore.exportCadProjectJson(engine)
  );
  checkNoBoundaryLeaks(failures, label, JSON.stringify(response));
  return 4;
}

function verifyRebuildAndReferences(engine, failures) {
  const rebuildPlan = executeQuery(engine, { query: "project.rebuildPlan" });
  const referenceHealth = executeQuery(engine, {
    query: "reference.health",
    target: { type: "body", bodyId: "v11_body_rect" }
  });
  const editability = executeQuery(engine, {
    query: "feature.editability",
    featureId: "v11_feat_rect"
  });

  checkEqual(failures, "core.rebuild.ok", true, rebuildPlan.ok);
  checkEqual(
    failures,
    "core.rebuild.hasBody",
    true,
    rebuildPlan.bodyLifecycles.some((body) => body.bodyId === "v11_body_rect")
  );
  checkEqual(failures, "core.referenceHealth.ok", true, referenceHealth.ok);
  checkEqual(failures, "core.editability.ok", true, editability.ok);
  checkEqual(
    failures,
    "core.editability.featureId",
    "v11_feat_rect",
    editability.featureId
  );
  checkNoBoundaryLeaks(
    failures,
    "core.rebuild.references",
    JSON.stringify({ rebuildPlan, referenceHealth, editability })
  );

  return 6;
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
  solverCheckCount,
  dryRunCheckCount,
  rebuildCheckCount,
  roundTripCheckCount
}) {
  const sample = {
    id,
    status: failures.length > 0 ? "fail" : "pass",
    solverCheckCount,
    dryRunCheckCount,
    rebuildCheckCount,
    roundTripCheckCount,
    failures
  };

  checkNoBoundaryLeaks(
    sample.failures,
    "emitted V11 sample smoke metadata",
    JSON.stringify(sample)
  );
  sample.status = sample.failures.length > 0 ? "fail" : "pass";

  return sample;
}

function checkEqual(failures, label, expected, actual) {
  if (actual !== expected) {
    failures.push(
      `${label}: expected ${formatValue(expected)}, got ${formatValue(actual)}`
    );
  }
}

function checkIncludes(failures, label, values, expected) {
  if (!values.includes(expected)) {
    failures.push(`${label}: expected to include ${formatValue(expected)}`);
  }
}

function checkNoBoundaryLeaks(failures, label, text) {
  if (
    V11_RELEASE_BOUNDARY_LEAK_PATTERN.test(text) ||
    V10_RELEASE_BOUNDARY_LEAK_PATTERN.test(text) ||
    V8_RELEASE_BOUNDARY_LEAK_PATTERN.test(text)
  ) {
    failures.push(
      `${label}: leaked raw renderer/mesh/OCCT/cache/selection-buffer/file-handle/viewport/solver-cache identifier`
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
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortForStableJson(item)])
    );
  }

  return value;
}

function formatValue(value) {
  return JSON.stringify(value);
}

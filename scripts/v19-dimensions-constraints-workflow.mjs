import { isDeepStrictEqual } from "node:util";

export const V19_DIMENSIONS_CONSTRAINTS_WORKFLOW_VERSION =
  "partbench.v19-dimensions-constraints-workflow.v1";

const CADOPS_VERSION = "cadops.v1";

class V19DimensionsConstraintsWorkflowFailure extends Error {}

export function runV19DimensionsConstraintsWorkflow(cadCore, sketchSolver) {
  const checks = [];
  const failures = [];
  let summary = {};

  function check(id, condition, evidence) {
    const passed = condition === true;
    checks.push({ id, passed, evidence });
    if (!passed) {
      throw new V19DimensionsConstraintsWorkflowFailure(
        `V19 dimensions/constraints check failed: ${id}`
      );
    }
  }

  try {
    const literalEvidence = runLiteralTargetMatrix(cadCore);
    check(
      "literal-target-matrix",
      literalEvidence.every(
        (entry) =>
          entry.ok &&
          entry.status === "healthy" &&
          approximatelyEqual(entry.effectiveValue, entry.expectedValue)
      ),
      literalEvidence
    );

    const branchEvidence = literalEvidence.filter(
      ({ id }) =>
        id.includes("horizontal") ||
        id.includes("vertical") ||
        id.includes("point-line") ||
        id.startsWith("line-angle")
    );
    check(
      "direction-side-sense-matrix",
      isDeepStrictEqual(
        branchEvidence.map(({ id }) => id),
        [
          "point-horizontal-positive",
          "point-horizontal-negative",
          "point-vertical-positive",
          "point-vertical-negative",
          "point-line-left",
          "point-line-right",
          "line-angle-counterclockwise",
          "line-angle-clockwise"
        ]
      ) && branchEvidence.every(({ status }) => status === "healthy"),
      branchEvidence
    );

    const radialEvidence = literalEvidence.filter(
      ({ id }) => id.includes("radius") || id.includes("diameter")
    );
    check(
      "radius-diameter-equivalence",
      isDeepStrictEqual(
        radialEvidence.map(({ id, storedRadius }) => ({ id, storedRadius })),
        [
          { id: "circle-radius", storedRadius: 3 },
          { id: "circle-diameter", storedRadius: 4 },
          { id: "arc-radius", storedRadius: 3 },
          { id: "arc-diameter", storedRadius: 4 }
        ]
      ),
      radialEvidence
    );

    const parameterEvidence = runParameterMatrix(cadCore);
    check(
      "literal-parameter-value-source-matrix",
      parameterEvidence.allowed.every(
        (entry) =>
          entry.ok &&
          entry.valueSourceType === "parameter" &&
          approximatelyEqual(entry.effectiveValue, entry.expectedValue)
      ) &&
        parameterEvidence.rejectedAngle.ok === false &&
        parameterEvidence.rejectedAngle.code ===
          "SKETCH_DIMENSION_TARGET_UNSUPPORTED",
      parameterEvidence
    );

    const unitEvidence = runUnitModeMatrix(cadCore);
    check(
      "unit-mode-matrix",
      approximatelyEqual(unitEvidence.preserve.parameter, 0.5) &&
        approximatelyEqual(unitEvidence.preserve.diameter, 0.4) &&
        approximatelyEqual(unitEvidence.preserve.angle, 90) &&
        approximatelyEqual(unitEvidence.metadataOnly.distance, 3) &&
        approximatelyEqual(unitEvidence.metadataOnly.angle, 90),
      unitEvidence
    );

    const conflictEvidence = runConflictDeterminismProof(cadCore, sketchSolver);
    check(
      "conflict-determinism",
      conflictEvidence.firstStatus === "conflicting" &&
        conflictEvidence.secondStatus === "conflicting" &&
        conflictEvidence.first.length > 0 &&
        isDeepStrictEqual(conflictEvidence.first, conflictEvidence.second) &&
        conflictEvidence.coreRejected &&
        conflictEvidence.coreRollbackExact,
      conflictEvidence
    );

    const replayEvidence = runReplayUndoRedoProof(cadCore);
    check(
      "dimension-replay-undo-redo",
      replayEvidence.roundTripExact &&
        replayEvidence.undoRestoredCreateValue &&
        replayEvidence.redoRestoredUpdateValue &&
        replayEvidence.redoProjectExact,
      replayEvidence
    );

    const constraintEvidence = runConstraintLifecycleProof(cadCore);
    check(
      "constraint-command-lifecycle",
      constraintEvidence.created &&
        constraintEvidence.updated &&
        constraintEvidence.renamed &&
        constraintEvidence.deleted &&
        constraintEvidence.undoRestored &&
        constraintEvidence.redoDeleted &&
        constraintEvidence.diffKinds.join(",") ===
          "created,modified,modified,deleted",
      constraintEvidence
    );

    summary = {
      schemaVersion: cadCore.CAD_PROJECT_FORMAT_VERSION_V22,
      literalTargetCount: literalEvidence.length,
      parameterTargetCount: parameterEvidence.allowed.length,
      branchCount: branchEvidence.length,
      constraintLifecycleKinds: constraintEvidence.diffKinds
    };
  } catch (error) {
    failures.push({
      message: error instanceof Error ? error.message : String(error)
    });
  }

  return {
    version: V19_DIMENSIONS_CONSTRAINTS_WORKFLOW_VERSION,
    ok: failures.length === 0,
    checkCount: checks.length,
    passedCount: checks.filter(({ passed }) => passed).length,
    checks,
    failures,
    summary
  };
}

export function formatV19DimensionsConstraintsWorkflowSummary(result) {
  if (!result.ok) {
    return `V19 dimensions/constraints workflow smoke failed: ${result.passedCount}/${result.checkCount} checks passed.`;
  }
  return `V19 dimensions/constraints workflow smoke passed: ${result.passedCount}/${result.checkCount} checks passed across ${result.summary.literalTargetCount} literal targets and ${result.summary.parameterTargetCount} parameter targets.`;
}

function createDimensionEngine(cadCore) {
  const engine = new cadCore.CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "V19 matrix", plane: "XY" },
    {
      op: "sketch.addPoint",
      sketchId: "sketch_1",
      id: "origin",
      point: [0, 0]
    },
    {
      op: "sketch.addPoint",
      sketchId: "sketch_1",
      id: "positive",
      point: [3, 4]
    },
    {
      op: "sketch.addPoint",
      sketchId: "sketch_1",
      id: "negative",
      point: [-3, -4]
    },
    {
      op: "sketch.addPoint",
      sketchId: "sketch_1",
      id: "left_point",
      point: [5, 3]
    },
    {
      op: "sketch.addPoint",
      sketchId: "sketch_1",
      id: "right_point",
      point: [5, -3]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "east",
      start: [0, 0],
      end: [4, 0]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "north",
      start: [0, 0],
      end: [0, 4]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "south",
      start: [0, 0],
      end: [0, -4]
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "rectangle",
      center: [10, 0],
      width: 4,
      height: 3
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "circle",
      center: [16, 0],
      radius: 2
    },
    {
      op: "sketch.addArc",
      sketchId: "sketch_1",
      id: "arc",
      definition: {
        kind: "centerAngles",
        center: [22, 0],
        radius: 2,
        startAngleDegrees: 0,
        sweepAngleDegrees: 90
      }
    }
  ]);
  return engine;
}

function literalTargetCases() {
  return [
    {
      id: "rectangle-width",
      value: 6,
      target: {
        kind: "entityScalar",
        entityId: "rectangle",
        entityKind: "rectangle",
        role: "width"
      }
    },
    {
      id: "rectangle-height",
      value: 5,
      target: {
        kind: "entityScalar",
        entityId: "rectangle",
        entityKind: "rectangle",
        role: "height"
      }
    },
    {
      id: "line-length",
      value: 6,
      target: {
        kind: "entityScalar",
        entityId: "east",
        entityKind: "line",
        role: "length"
      }
    },
    {
      id: "circle-radius",
      value: 3,
      target: {
        kind: "entityScalar",
        entityId: "circle",
        entityKind: "circle",
        role: "radius"
      }
    },
    {
      id: "circle-diameter",
      value: 8,
      target: {
        kind: "entityScalar",
        entityId: "circle",
        entityKind: "circle",
        role: "diameter"
      }
    },
    {
      id: "arc-radius",
      value: 3,
      target: {
        kind: "entityScalar",
        entityId: "arc",
        entityKind: "arc",
        role: "radius"
      }
    },
    {
      id: "arc-diameter",
      value: 8,
      target: {
        kind: "entityScalar",
        entityId: "arc",
        entityKind: "arc",
        role: "diameter"
      }
    },
    {
      id: "arc-sweep",
      value: 60,
      target: {
        kind: "entityScalar",
        entityId: "arc",
        entityKind: "arc",
        role: "sweep"
      }
    },
    {
      id: "point-distance",
      value: 5,
      target: {
        kind: "pointPair",
        primary: pointTarget("origin"),
        secondary: pointTarget("positive"),
        measurement: "distance"
      }
    },
    {
      id: "point-horizontal-positive",
      value: 3,
      target: {
        kind: "pointPair",
        primary: pointTarget("origin"),
        secondary: pointTarget("positive"),
        measurement: "horizontal",
        direction: "positive"
      }
    },
    {
      id: "point-horizontal-negative",
      value: 3,
      target: {
        kind: "pointPair",
        primary: pointTarget("origin"),
        secondary: pointTarget("negative"),
        measurement: "horizontal",
        direction: "negative"
      }
    },
    {
      id: "point-vertical-positive",
      value: 4,
      target: {
        kind: "pointPair",
        primary: pointTarget("origin"),
        secondary: pointTarget("positive"),
        measurement: "vertical",
        direction: "positive"
      }
    },
    {
      id: "point-vertical-negative",
      value: 4,
      target: {
        kind: "pointPair",
        primary: pointTarget("origin"),
        secondary: pointTarget("negative"),
        measurement: "vertical",
        direction: "negative"
      }
    },
    {
      id: "point-line-left",
      value: 3,
      target: {
        kind: "pointLineDistance",
        point: pointTarget("left_point"),
        lineEntityId: "east",
        side: "left"
      }
    },
    {
      id: "point-line-right",
      value: 3,
      target: {
        kind: "pointLineDistance",
        point: pointTarget("right_point"),
        lineEntityId: "east",
        side: "right"
      }
    },
    {
      id: "line-angle-counterclockwise",
      value: 90,
      target: {
        kind: "lineAngle",
        primaryLineEntityId: "east",
        secondaryLineEntityId: "north",
        sense: "counterclockwise"
      }
    },
    {
      id: "line-angle-clockwise",
      value: 90,
      target: {
        kind: "lineAngle",
        primaryLineEntityId: "east",
        secondaryLineEntityId: "south",
        sense: "clockwise"
      }
    }
  ];
}

function pointTarget(entityId) {
  return { entityId, entityKind: "point", role: "position" };
}

function runLiteralTargetMatrix(cadCore) {
  return literalTargetCases().map(({ id, target, value }) => {
    const engine = createDimensionEngine(cadCore);
    const result = engine.executeBatch({
      version: CADOPS_VERSION,
      mode: "commit",
      ops: [
        {
          op: "sketch.dimension.create",
          id: `dimension_${id}`,
          name: id,
          sketchId: "sketch_1",
          target,
          value
        }
      ]
    });
    const dimension = readDimension(engine, `dimension_${id}`);
    const targetEntityId = target.entityId;
    const entity = targetEntityId
      ? engine
          .getDocument()
          .sketches.get("sketch_1")
          ?.entities.get(targetEntityId)
      : undefined;
    const storedRadius =
      (id.includes("circle-") || id.includes("arc-")) &&
      (id.includes("radius") || id.includes("diameter")) &&
      (entity?.kind === "circle" || entity?.kind === "arc")
        ? entity.radius
        : undefined;
    return {
      id,
      ok: result.ok,
      status: dimension?.status,
      effectiveValue: dimension?.effectiveValue,
      expectedValue: value,
      storedRadius
    };
  });
}

function runParameterMatrix(cadCore) {
  const cases = literalTargetCases().filter(
    ({ target }) => target.kind !== "lineAngle"
  );
  const allowed = cases.map(({ id, target, value }) => {
    const engine = createDimensionEngine(cadCore);
    const parameterId = `parameter_${id}`;
    engine.apply({
      op: "parameter.create",
      id: parameterId,
      name: `Parameter ${id}`,
      value
    });
    const result = engine.executeBatch({
      version: CADOPS_VERSION,
      mode: "commit",
      ops: [
        {
          op: "sketch.dimension.create",
          id: `parameter_dimension_${id}`,
          name: `Parameter ${id}`,
          sketchId: "sketch_1",
          target,
          parameterId
        }
      ]
    });
    const stored = engine
      .getDocument()
      .sketchDimensions.get(`parameter_dimension_${id}`);
    const dimension = readDimension(engine, `parameter_dimension_${id}`);
    return {
      id,
      ok: result.ok,
      valueSourceType: stored?.valueSource.type,
      effectiveValue: dimension?.effectiveValue,
      expectedValue: value
    };
  });

  const rejectedEngine = createDimensionEngine(cadCore);
  rejectedEngine.apply({
    op: "parameter.create",
    id: "angle_parameter",
    name: "Angle parameter",
    value: 90
  });
  const rejected = rejectedEngine.executeBatch({
    version: CADOPS_VERSION,
    mode: "commit",
    ops: [
      {
        op: "sketch.dimension.create",
        id: "parameter_angle",
        name: "Parameter angle",
        sketchId: "sketch_1",
        target: {
          kind: "lineAngle",
          primaryLineEntityId: "east",
          secondaryLineEntityId: "north",
          sense: "counterclockwise"
        },
        parameterId: "angle_parameter"
      }
    ]
  });

  return {
    allowed,
    rejectedAngle: rejected.ok
      ? { ok: true }
      : { ok: false, code: rejected.error.code }
  };
}

function runUnitModeMatrix(cadCore) {
  const preserve = createDimensionEngine(cadCore);
  preserve.applyBatch([
    {
      op: "parameter.create",
      id: "distance_parameter",
      name: "Distance",
      value: 5
    },
    {
      op: "sketch.dimension.create",
      id: "unit_diameter",
      name: "Diameter",
      sketchId: "sketch_1",
      target: {
        kind: "entityScalar",
        entityId: "circle",
        entityKind: "circle",
        role: "diameter"
      },
      value: 4
    },
    {
      op: "sketch.dimension.create",
      id: "unit_angle",
      name: "Angle",
      sketchId: "sketch_1",
      target: {
        kind: "lineAngle",
        primaryLineEntityId: "east",
        secondaryLineEntityId: "north",
        sense: "counterclockwise"
      },
      value: 90
    }
  ]);
  preserve.apply({
    op: "document.updateUnits",
    units: "cm",
    mode: "preservePhysicalSize"
  });

  const metadataOnly = createDimensionEngine(cadCore);
  metadataOnly.applyBatch([
    {
      op: "sketch.dimension.create",
      id: "metadata_distance",
      name: "Distance",
      sketchId: "sketch_1",
      target: {
        kind: "pointLineDistance",
        point: pointTarget("left_point"),
        lineEntityId: "east",
        side: "left"
      },
      value: 3
    },
    {
      op: "sketch.dimension.create",
      id: "metadata_angle",
      name: "Angle",
      sketchId: "sketch_1",
      target: {
        kind: "lineAngle",
        primaryLineEntityId: "east",
        secondaryLineEntityId: "north",
        sense: "counterclockwise"
      },
      value: 90
    }
  ]);
  metadataOnly.apply({
    op: "document.updateUnits",
    units: "cm",
    mode: "metadataOnly"
  });

  return {
    preserve: {
      parameter: preserve.getDocument().parameters.get("distance_parameter")
        ?.value,
      diameter: literalValue(preserve, "unit_diameter"),
      angle: literalValue(preserve, "unit_angle")
    },
    metadataOnly: {
      distance: literalValue(metadataOnly, "metadata_distance"),
      angle: literalValue(metadataOnly, "metadata_angle")
    }
  };
}

function runConflictDeterminismProof(cadCore, sketchSolver) {
  const dimensions = [
    {
      id: "z_horizontal",
      kind: "pointComponent",
      primaryTarget: { kind: "point", pointId: "origin" },
      secondaryTarget: { kind: "point", pointId: "positive" },
      axis: "horizontal",
      value: 3
    },
    {
      id: "a_horizontal",
      kind: "pointComponent",
      primaryTarget: { kind: "point", pointId: "origin" },
      secondaryTarget: { kind: "point", pointId: "positive" },
      axis: "horizontal",
      value: 2
    }
  ];
  const solveModel = (orderedDimensions) => ({
    version: sketchSolver.SKETCH_SOLVER_MODEL_VERSION,
    points: [
      { id: "origin", initial: [0, 0] },
      { id: "positive", initial: [2, 0] }
    ],
    dimensions: orderedDimensions,
    settings: { tolerance: 1e-7, angularToleranceDegrees: 0.1 }
  });
  const first = sketchSolver.solveSketch(solveModel(dimensions));
  const second = sketchSolver.solveSketch(
    solveModel([...dimensions].reverse())
  );
  const evidence = (result) =>
    result.diagnostics
      .filter(
        ({ code, sourceType }) =>
          code === "SKETCH_SOLVER_CONFLICTING" && sourceType === "dimension"
      )
      .map(({ code, sourceId, dimensionKind }) => ({
        code,
        sourceId,
        dimensionKind
      }));

  const coreEngine = createDimensionEngine(cadCore);
  coreEngine.apply({
    op: "sketch.dimension.create",
    id: "core_horizontal",
    name: "Core horizontal",
    sketchId: "sketch_1",
    target: {
      kind: "pointPair",
      primary: pointTarget("origin"),
      secondary: pointTarget("positive"),
      measurement: "horizontal",
      direction: "positive"
    },
    value: 3
  });
  const beforeRejected = cadCore.exportCadProjectJson(coreEngine);
  const rejected = coreEngine.executeBatch({
    version: CADOPS_VERSION,
    mode: "commit",
    ops: [
      {
        op: "sketch.dimension.create",
        id: "core_distance",
        name: "Core conflicting distance",
        sketchId: "sketch_1",
        target: {
          kind: "pointPair",
          primary: pointTarget("origin"),
          secondary: pointTarget("positive"),
          measurement: "distance"
        },
        value: 2
      }
    ]
  });

  return {
    firstStatus: first.status,
    secondStatus: second.status,
    first: evidence(first),
    second: evidence(second),
    coreRejected: rejected.ok === false,
    coreErrorCode: rejected.ok ? undefined : rejected.error.code,
    coreRollbackExact:
      cadCore.exportCadProjectJson(coreEngine) === beforeRejected
  };
}

function runReplayUndoRedoProof(cadCore) {
  const engine = createDimensionEngine(cadCore);
  engine.apply({
    op: "sketch.dimension.create",
    id: "replay_distance",
    name: "Replay distance",
    sketchId: "sketch_1",
    target: {
      kind: "pointPair",
      primary: pointTarget("origin"),
      secondary: pointTarget("positive"),
      measurement: "distance"
    },
    value: 5
  });
  const createProject = cadCore.exportCadProject(engine);
  engine.apply({
    op: "sketch.dimension.update",
    id: "replay_distance",
    value: 6
  });
  const updatedProject = cadCore.exportCadProject(engine);
  const json = cadCore.exportCadProjectJson(engine);
  const restored = cadCore.importCadProjectJson(json);
  const roundTripExact =
    cadCore.exportCadProjectJson(restored) === json &&
    isDeepStrictEqual(cadCore.exportCadProject(restored), updatedProject);
  restored.undo();
  const undoRestoredCreateValue =
    literalValue(restored, "replay_distance") === 5;
  restored.redo();
  const redoRestoredUpdateValue =
    literalValue(restored, "replay_distance") === 6;
  return {
    roundTripExact,
    undoRestoredCreateValue,
    redoRestoredUpdateValue,
    redoProjectExact: isDeepStrictEqual(
      cadCore.exportCadProject(restored),
      updatedProject
    ),
    createSchemaVersion: createProject.schemaVersion,
    updatedSchemaVersion: updatedProject.schemaVersion
  };
}

function runConstraintLifecycleProof(cadCore) {
  const engine = createDimensionEngine(cadCore);
  engine.apply({
    op: "sketch.addLine",
    sketchId: "sketch_1",
    id: "long_line",
    start: [10, 8],
    end: [16, 8]
  });
  const diffKinds = [];

  const created = engine.executeBatch({
    version: CADOPS_VERSION,
    mode: "commit",
    ops: [
      {
        op: "sketch.constraint.create",
        id: "equal_length",
        name: "Equal length",
        sketchId: "sketch_1",
        kind: "equalLength",
        primaryLineEntityId: "east",
        secondaryLineEntityId: "north"
      }
    ]
  });
  if (engine.getTransactions().at(-1)?.diff.sketchConstraints?.created) {
    diffKinds.push("created");
  }

  const updated = engine.executeBatch({
    version: CADOPS_VERSION,
    mode: "commit",
    ops: [
      {
        op: "sketch.constraint.update",
        id: "equal_length",
        definition: {
          kind: "equalLength",
          primaryLineEntityId: "east",
          secondaryLineEntityId: "long_line"
        }
      }
    ]
  });
  if (engine.getTransactions().at(-1)?.diff.sketchConstraints?.modified) {
    diffKinds.push("modified");
  }

  const renamed = engine.executeBatch({
    version: CADOPS_VERSION,
    mode: "commit",
    ops: [
      {
        op: "sketch.constraint.rename",
        id: "equal_length",
        name: "Renamed equal length"
      }
    ]
  });
  if (engine.getTransactions().at(-1)?.diff.sketchConstraints?.modified) {
    diffKinds.push("modified");
  }

  const beforeDelete = engine.createSnapshot();
  const deleted = engine.executeBatch({
    version: CADOPS_VERSION,
    mode: "commit",
    ops: [{ op: "sketch.constraint.delete", id: "equal_length" }]
  });
  if (engine.getTransactions().at(-1)?.diff.sketchConstraints?.deleted) {
    diffKinds.push("deleted");
  }
  engine.undo();
  const undoRestored = isDeepStrictEqual(engine.createSnapshot(), beforeDelete);
  engine.redo();

  return {
    created: created.ok,
    updated: updated.ok && updated.modifiedSketchEntityIds.length > 0,
    renamed:
      renamed.ok &&
      engine
        .getTransactions()
        .some(
          ({ ops }) =>
            ops[0]?.op === "sketch.constraint.rename" &&
            ops[0].id === "equal_length"
        ),
    deleted: deleted.ok,
    undoRestored,
    redoDeleted:
      engine.getDocument().sketchConstraints.has("equal_length") === false,
    diffKinds
  };
}

function readDimension(engine, id) {
  const response = engine.executeQuery({
    version: CADOPS_VERSION,
    query: { query: "sketch.dimension.get", id }
  });
  return response.ok ? response.dimension : undefined;
}

function literalValue(engine, id) {
  const source = engine.getDocument().sketchDimensions.get(id)?.valueSource;
  return source?.type === "literal" ? source.value : undefined;
}

function approximatelyEqual(left, right) {
  return (
    typeof left === "number" &&
    typeof right === "number" &&
    Math.abs(left - right) <= 1e-7
  );
}

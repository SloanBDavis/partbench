import {
  WCAD_PACKAGE_VERSION,
  type CadOpsVersion,
  type CadQueryResponse,
  type CadSketchSolverEngineSummary,
  type CadSketchProfileCandidateSummary,
  type CadSketchProfileValiditySummary,
  type CadSketchSolverConstraintSummary,
  type CadSketchSolverDeferredConstraintKind,
  type CadSketchSolverDeferredConstraintSummary,
  type CadSketchSolverDiagnostic,
  type CadSketchSolverDiagnosticCode,
  type CadSketchSolverDimensionSummary,
  type CadSketchSolverEntitySummary,
  type CadSketchSolverReadinessStatus,
  type CadSketchSolverSourceContract,
  type CadSketchSolverStatus,
  type CadSketchSolverTargetReference,
  type SketchConstraintEntry,
  type SketchConstraintIssue,
  type SketchDimensionEntry,
  type SketchDimensionIssue,
  type SketchEntitySnapshot,
  type SketchEvaluationIssue,
  type SketchId,
  type SketchPointTarget,
  type WcadDocumentSchemaVersion
} from "@web-cad/cad-protocol";

import {
  evaluateSketch,
  type SketchSolverDocument,
  type SketchSolverSketch
} from "./sketchSolver";
import {
  runSketchSolverPackageProbe,
  type SketchSolverPackageProbe
} from "./sketchSolverPackageMapping";

const SOURCE_BOUNDARY_NOTE =
  "V11 sketch solver status is derived from authoritative sketch entities, dimensions, constraints, profile source, and current project schema metadata.";
const DERIVED_BOUNDARY_NOTE =
  "Renderer meshes, OCCT indexes, GPU buffers, selection-buffer ids, viewport pixels, OPFS paths, file handles, and export artifacts are excluded from public sketch solver identities.";

const DEFERRED_CONSTRAINT_KINDS = [
  "distance"
] as const satisfies readonly CadSketchSolverDeferredConstraintKind[];

export interface CreateSketchSolverStatusResponseOptions {
  readonly cadOpsVersion: CadOpsVersion;
  readonly document: SketchSolverDocument;
  readonly sketch: SketchSolverSketch;
  readonly currentProjectSchemaVersion: WcadDocumentSchemaVersion;
}

export interface CreateSketchProfileValidityFromSourceOptions {
  readonly document: SketchSolverDocument;
  readonly sketch: SketchSolverSketch;
}

export function createSketchProfileValidityFromSource({
  document,
  sketch
}: CreateSketchProfileValidityFromSourceOptions): CadSketchProfileValiditySummary {
  const evaluation = evaluateSketch(document, sketch);
  const solverProbe = runSketchSolverPackageProbe(document, sketch);

  return createSketchProfileValidity(
    sketch,
    mapEvaluationStatus(evaluation.status),
    solverProbe
  );
}

export function createSketchSolverStatusResponse({
  cadOpsVersion,
  document,
  sketch,
  currentProjectSchemaVersion
}: CreateSketchSolverStatusResponseOptions): Extract<
  CadQueryResponse,
  { readonly ok: true; readonly query: "sketch.solverStatus" }
> {
  const evaluation = evaluateSketch(document, sketch);
  const solverProbe = runSketchSolverPackageProbe(document, sketch);
  const status = mapEvaluationStatus(evaluation.status);
  const entities = [...sketch.entities.values()].map((entity) =>
    createEntitySummary(sketch.id, entity)
  );
  const dimensions = evaluation.dimensions.map(createDimensionSummary);
  const constraints = evaluation.constraints.map(createConstraintSummary);
  const deferredConstraints = DEFERRED_CONSTRAINT_KINDS.map((kind) =>
    createDeferredConstraintSummary(sketch.id, kind)
  );
  const profileValidity = createSketchProfileValidity(
    sketch,
    status,
    solverProbe
  );
  const solverModelDiagnostic = createSolverModelBuildDiagnostic(
    sketch.id,
    solverProbe
  );
  const numericalSolverDiagnostic = createNumericalSolverDiagnostic(
    sketch.id,
    solverProbe
  );
  const diagnostics = [
    solverModelDiagnostic,
    numericalSolverDiagnostic,
    createDiagnostic({
      code: "SKETCH_SOLVER_PREVIEW_DEFERRED",
      severity: "info",
      message: "Solver-backed drag and edit previews are not available yet.",
      sketchId: sketch.id,
      expected: "non-mutating solve preview",
      received: "deferred"
    }),
    createDiagnostic({
      code:
        currentProjectSchemaVersion === "web-cad.project.v17" ||
        currentProjectSchemaVersion === "web-cad.project.v21"
          ? "SKETCH_SOLVER_STATUS_READY"
          : "SKETCH_SOLVER_SCHEMA_V17_DEFERRED",
      severity: "info",
      message:
        currentProjectSchemaVersion === "web-cad.project.v17" ||
        currentProjectSchemaVersion === "web-cad.project.v21"
          ? "Source-backed advanced sketch solver records are present and supported target combinations run through the numerical solver."
          : "V17 solver source records require project schema V21 when V17-only source is present.",
      sketchId: sketch.id,
      expected:
        "web-cad.project.v17 for legacy advanced source or web-cad.project.v21 for V17-only source",
      received: currentProjectSchemaVersion
    }),
    ...evaluation.issues.map((issue) =>
      createDiagnosticFromEvaluationIssue(sketch.id, issue)
    ),
    ...solverProbe.diagnostics,
    ...profileValidity.diagnostics,
    ...deferredConstraints.map((entry) => entry.diagnostic)
  ];

  return {
    ok: true,
    query: "sketch.solverStatus",
    cadOpsVersion,
    sketchId: evaluation.sketchId,
    sketchName: evaluation.sketchName,
    plane: evaluation.plane,
    status,
    readiness: chooseReadiness(status),
    solver: createSolverEngineSummary(solverProbe, numericalSolverDiagnostic),
    entityCount: entities.length,
    entities,
    dimensionCount: dimensions.length,
    dimensions,
    constraintCount: constraints.length,
    constraints,
    deferredConstraintCount: deferredConstraints.length,
    deferredConstraints,
    profileValidity,
    preview: {
      status: "deferred",
      willMutateDocument: false,
      supportedPreviewKinds: [],
      deferredPreviewKinds: [
        "entity.drag",
        "dimension.edit",
        "constraint.inference"
      ],
      diagnosticCount: 1,
      diagnostics: [
        createDiagnostic({
          code: "SKETCH_SOLVER_PREVIEW_DEFERRED",
          severity: "info",
          message: "Drag and dimension solve previews are not available yet.",
          sketchId: sketch.id
        })
      ]
    },
    sourceContract: createSourceContract(currentProjectSchemaVersion),
    diagnosticCount: diagnostics.length,
    diagnostics,
    sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
    derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
    requiresProjectSchemaMigration: false as const
  };
}

function createEntitySummary(
  sketchId: SketchId,
  entity: SketchEntitySnapshot
): CadSketchSolverEntitySummary {
  const targets = createEntityTargets(sketchId, entity);
  const diagnostics: CadSketchSolverDiagnostic[] = [];
  const degreesOfFreedom = getSketchEntityDegreesOfFreedom(entity);
  return {
    sketchId,
    entityId: entity.id,
    entityKind: entity.kind,
    construction: entity.construction,
    supported: true,
    variableCount: degreesOfFreedom,
    degreesOfFreedom,
    targetCount: targets.length,
    targets,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createDimensionSummary(
  dimension: SketchDimensionEntry
): CadSketchSolverDimensionSummary {
  const diagnostics = dimension.issues.map((issue) =>
    createDiagnosticFromDimensionIssue(dimension.sketchId, issue)
  );
  return {
    dimensionId: dimension.id,
    sketchId: dimension.sketchId,
    entityId: dimension.entityId,
    target: dimension.target,
    valueSource: dimension.valueSource,
    ...(dimension.effectiveValue !== undefined
      ? { effectiveValue: dimension.effectiveValue }
      : {}),
    status: dimension.status,
    supported: dimension.status === "healthy",
    targetRef: {
      type: "dimension",
      sketchId: dimension.sketchId,
      dimensionId: dimension.id,
      entityId: dimension.entityId,
      dimensionTarget: dimension.target
    },
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createConstraintSummary(
  constraint: SketchConstraintEntry
): CadSketchSolverConstraintSummary {
  const diagnostics = constraint.issues.map((issue) =>
    createDiagnosticFromConstraintIssue(constraint.sketchId, issue)
  );
  return {
    constraintId: constraint.id,
    sketchId: constraint.sketchId,
    kind: constraint.kind,
    status: "current-source",
    sourceBacked: true,
    supportedByCurrentEvaluator: constraint.status === "healthy",
    supportedByNumericalSolver:
      isConstraintSupportedByNumericalSolver(constraint),
    targetRefs: createConstraintTargets(constraint),
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createDeferredConstraintSummary(
  sketchId: SketchId,
  kind: CadSketchSolverDeferredConstraintKind
): CadSketchSolverDeferredConstraintSummary {
  const diagnostic = createDiagnostic({
    code: "SKETCH_SOLVER_UNSUPPORTED_CONSTRAINT",
    severity: "info",
    message: `V11 ${kind} constraints are reserved by the contract but deferred until a source/schema and solver implementation tranche.`,
    sketchId,
    constraintKind: kind,
    expected: "current source-backed solver constraint",
    received: "deferred contract case"
  });
  return {
    kind,
    status: "deferred",
    requiresProjectSchemaMigration: true,
    nextProjectSchemaVersion: "web-cad.project.v17",
    diagnostic
  };
}

function createSolverModelBuildDiagnostic(
  sketchId: SketchId,
  probe: SketchSolverPackageProbe
): CadSketchSolverDiagnostic {
  if (probe.modelBuilt && probe.model) {
    return createDiagnostic({
      code: "SKETCH_SOLVER_MODEL_BUILT",
      severity: "info",
      message:
        "Cad-core mapped authoritative sketch source into a normalized @web-cad/sketch-solver model.",
      sketchId,
      expected: "document-source-backed normalized solver model",
      received: `${probe.model.points.length} point variable(s), ${
        probe.model.scalars?.length ?? 0
      } scalar variable(s), ${
        probe.model.constraints?.length ?? 0
      } constraint(s), ${probe.model.dimensions?.length ?? 0} dimension(s)`
    });
  }

  return createDiagnostic({
    code: "SKETCH_SOLVER_NOT_RUN",
    severity: "warning",
    message:
      "Cad-core could not build a normalized @web-cad/sketch-solver model.",
    sketchId,
    expected: "document-source-backed normalized solver model",
    received: "not built"
  });
}

function createNumericalSolverDiagnostic(
  sketchId: SketchId,
  probe: SketchSolverPackageProbe
): CadSketchSolverDiagnostic {
  const status = probe.result?.status ?? "not-run";

  if (status === "converged") {
    return createDiagnostic({
      code: "SKETCH_SOLVER_NUMERICAL_STATUS_READY",
      severity: "info",
      message:
        "The normalized sketch source ran through @web-cad/sketch-solver and converged.",
      sketchId,
      expected: "converged solver package result",
      received: status
    });
  }

  if (status === "under-defined") {
    return createDiagnostic({
      code: "SKETCH_SOLVER_UNDER_DEFINED",
      severity: "warning",
      message:
        "The normalized sketch source ran through @web-cad/sketch-solver and remains under-defined.",
      sketchId,
      expected:
        "enough supported constraints or dimensions to define all variables",
      received: status
    });
  }

  if (status === "over-defined") {
    return createDiagnostic({
      code: "SKETCH_SOLVER_OVER_DEFINED",
      severity: "warning",
      message:
        "The normalized sketch source ran through @web-cad/sketch-solver and appears over-defined.",
      sketchId,
      expected: "independent supported constraints and dimensions",
      received: status
    });
  }

  if (status === "conflicting") {
    return createDiagnostic({
      code: "SKETCH_SOLVER_CONFLICTING",
      severity: "blocker",
      message:
        "The normalized sketch source ran through @web-cad/sketch-solver and has conflicting constraints or dimensions.",
      sketchId,
      expected: "converged solver package result",
      received: status
    });
  }

  if (status === "unsupported") {
    return createDiagnostic({
      code: "SKETCH_SOLVER_UNSUPPORTED_CONSTRAINT",
      severity: "warning",
      message:
        "The normalized sketch source includes constraints that @web-cad/sketch-solver reports as unsupported or deferred.",
      sketchId,
      expected: "supported D1 numerical constraint subset",
      received: status
    });
  }

  if (status === "failed") {
    return createDiagnostic({
      code: "SKETCH_SOLVER_FAILED",
      severity: "blocker",
      message:
        "The normalized sketch source ran through @web-cad/sketch-solver but did not produce a usable numerical result.",
      sketchId,
      expected: "converged, under-defined, over-defined, or unsupported result",
      received: status
    });
  }

  return createDiagnostic({
    code: "SKETCH_SOLVER_NOT_RUN",
    severity: "info",
    message:
      "The normalized sketch source did not run through @web-cad/sketch-solver.",
    sketchId,
    expected: "solver package execution",
    received: status
  });
}

function createSolverEngineSummary(
  probe: SketchSolverPackageProbe,
  diagnostic: CadSketchSolverDiagnostic
): CadSketchSolverEngineSummary {
  const result = probe.result;
  const modelVersion = result?.version ?? probe.model?.version;
  const canSolveNumerically =
    result !== undefined &&
    result.status !== "not-run" &&
    result.status !== "failed" &&
    result.status !== "unsupported";

  return {
    engine: "current-direct-evaluator",
    numericalSolverStatus: result?.status ?? "not-run",
    ...(modelVersion
      ? {
          numericalSolverEngine: "@web-cad/sketch-solver" as const,
          numericalSolverModelVersion: modelVersion
        }
      : {}),
    modelBuilt: probe.modelBuilt,
    solverRan: probe.solverRan,
    canSolveNumerically,
    deterministic: true,
    workerReady: false,
    ...(result
      ? {
          variableCount: result.variableCount,
          residualCount: result.residualCount,
          degreesOfFreedomEstimate: result.degreesOfFreedomEstimate,
          iterations: result.iterations,
          maxResidual: result.maxResidual,
          rmsResidual: result.rmsResidual
        }
      : {}),
    diagnosticCount: probe.diagnosticCount,
    diagnostics: probe.diagnostics,
    diagnostic
  };
}

function createSketchProfileValidity(
  sketch: SketchSolverSketch,
  status: CadSketchSolverStatus,
  solverProbe: SketchSolverPackageProbe
): CadSketchProfileValiditySummary {
  const effectiveStatus = chooseProfileValidityStatus(status, solverProbe);
  const blockerStatus = new Set<CadSketchSolverStatus>([
    "missing-target",
    "conflicting",
    "failed",
    "unsupported",
    "over-defined"
  ]);
  const profiles = [...sketch.entities.values()].map((entity) =>
    createProfileCandidate(
      sketch.id,
      entity,
      !blockerStatus.has(effectiveStatus)
    )
  );
  const validProfileCount = profiles.filter(
    (profile) => profile.featureReady
  ).length;
  const diagnostics: CadSketchSolverDiagnostic[] = profiles.flatMap(
    (profile) => profile.diagnostics
  );

  if (validProfileCount > 0) {
    diagnostics.push(
      createDiagnostic({
        code: "SKETCH_SOLVER_PROFILE_VALID",
        severity: "info",
        message: `Sketch ${sketch.id} has ${validProfileCount} closed source profile candidate(s).`,
        sketchId: sketch.id,
        expected: "closed rectangle or circle profile",
        received: `${validProfileCount} valid profile(s)`
      })
    );
  }

  return {
    status:
      validProfileCount > 0
        ? "valid"
        : profiles.some((profile) => profile.closed)
          ? "invalid"
          : "unsupported",
    profileCount: profiles.length,
    validProfileCount,
    profiles,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function chooseProfileValidityStatus(
  status: CadSketchSolverStatus,
  solverProbe: SketchSolverPackageProbe
): CadSketchSolverStatus {
  const blockingDiagnostic = solverProbe.diagnostics.find((diagnostic) =>
    [
      "SKETCH_SOLVER_MISSING_TARGET",
      "SKETCH_SOLVER_UNSUPPORTED_CONSTRAINT",
      "SKETCH_SOLVER_FAILED",
      "SKETCH_SOLVER_CONFLICTING",
      "SKETCH_SOLVER_OVER_DEFINED"
    ].includes(diagnostic.code)
  );

  if (blockingDiagnostic?.code === "SKETCH_SOLVER_MISSING_TARGET") {
    return "missing-target";
  }

  if (blockingDiagnostic?.code === "SKETCH_SOLVER_UNSUPPORTED_CONSTRAINT") {
    return "unsupported";
  }

  if (blockingDiagnostic?.code === "SKETCH_SOLVER_OVER_DEFINED") {
    return "over-defined";
  }

  if (blockingDiagnostic?.code === "SKETCH_SOLVER_CONFLICTING") {
    return "conflicting";
  }

  if (blockingDiagnostic) {
    return "failed";
  }

  const numericalStatus = solverProbe.result?.status;

  if (numericalStatus === "converged" || numericalStatus === "under-defined") {
    return status === "fully-defined" ? status : "solved";
  }

  if (
    numericalStatus === "over-defined" ||
    numericalStatus === "conflicting" ||
    numericalStatus === "failed" ||
    numericalStatus === "unsupported"
  ) {
    return numericalStatus;
  }

  return status;
}

function createProfileCandidate(
  sketchId: SketchId,
  entity: SketchEntitySnapshot,
  sourceHealthyEnoughForFeature: boolean
): CadSketchProfileCandidateSummary {
  if (entity.kind === "rectangle" || entity.kind === "circle") {
    const diagnostics = entity.construction
      ? [
          createDiagnostic({
            code: "SKETCH_SOLVER_UNSUPPORTED_ENTITY",
            severity: "warning",
            message:
              "Construction geometry is excluded from solid feature profile candidates.",
            sketchId,
            sketchEntityId: entity.id,
            expected: "non-construction closed profile",
            received: "construction geometry"
          })
        ]
      : [];
    return {
      sketchId,
      entityId: entity.id,
      entityKind: entity.kind,
      construction: entity.construction,
      profileKind: entity.kind,
      closed: true,
      featureReady:
        sourceHealthyEnoughForFeature && entity.construction === false,
      diagnosticCount: diagnostics.length,
      diagnostics
    };
  }

  const diagnostic = createDiagnostic({
    code: "SKETCH_SOLVER_PROFILE_OPEN",
    severity: "warning",
    message: `Sketch entity ${entity.id} is not a closed profile candidate for current feature creation.`,
    sketchId,
    sketchEntityId: entity.id,
    expected: "rectangle or circle closed profile",
    received: entity.kind
  });
  return {
    sketchId,
    entityId: entity.id,
    entityKind: entity.kind,
    construction: entity.construction,
    profileKind: "open",
    closed: false,
    featureReady: false,
    diagnosticCount: 1,
    diagnostics: [diagnostic]
  };
}

function createSourceContract(
  currentProjectSchemaVersion: WcadDocumentSchemaVersion
): CadSketchSolverSourceContract {
  const hasV17SourceRecords =
    currentProjectSchemaVersion === "web-cad.project.v17";
  return {
    currentProjectSchemaVersion,
    emittedProjectSchemaVersion: currentProjectSchemaVersion,
    packageVersion: WCAD_PACKAGE_VERSION,
    queryOnly: !hasV17SourceRecords,
    requiresProjectSchemaMigration: false,
    nextProjectSchemaVersion: "web-cad.project.v17",
    sourceRecordRequirements: [
      {
        recordKind: "advancedConstraint",
        status: hasV17SourceRecords ? "current-source" : "v17-required",
        requiresProjectSchemaMigration: !hasV17SourceRecords,
        nextProjectSchemaVersion: "web-cad.project.v17",
        reason: hasV17SourceRecords
          ? "Tangent, concentric, equal-radius, equal-length, angle, and symmetry constraints are persisted as V17 source records and are numerically supported by the solver package where their source target combination is supported."
          : "Tangent, concentric, equal, angle, and symmetry constraints require V17 source records before they can be persisted."
      },
      {
        recordKind: "constructionGeometry",
        status: "v17-required",
        requiresProjectSchemaMigration: true,
        nextProjectSchemaVersion: "web-cad.project.v17",
        reason:
          "Construction flags become source only when V11 commits construction geometry behavior."
      },
      {
        recordKind: "constraintLabel",
        status: "deferred",
        requiresProjectSchemaMigration: true,
        nextProjectSchemaVersion: "web-cad.project.v17",
        reason:
          "Persistent constraint labels are deferred until the product UI needs them as design intent."
      },
      {
        recordKind: "dimensionDisplayIntent",
        status: "deferred",
        requiresProjectSchemaMigration: true,
        nextProjectSchemaVersion: "web-cad.project.v17",
        reason:
          "Dimension display names or placement become source only if later UI tranches make them persistent design intent."
      },
      {
        recordKind: "solverSettings",
        status: "deferred",
        requiresProjectSchemaMigration: true,
        nextProjectSchemaVersion: "web-cad.project.v17",
        reason:
          "Solver settings remain implementation defaults until they affect source interpretation."
      },
      {
        recordKind: "sketchSolvePolicy",
        status: "deferred",
        requiresProjectSchemaMigration: true,
        nextProjectSchemaVersion: "web-cad.project.v17",
        reason:
          "Sketch-level solve policy is deferred until a later tranche needs persistent policy."
      }
    ]
  };
}

function mapEvaluationStatus(
  status: SketchDimensionEntry["status"]
): CadSketchSolverStatus {
  switch (status) {
    case "healthy":
      return "fully-defined";
    case "under-defined":
      return "under-defined";
    case "over-defined":
      return "over-defined";
    case "missing-target":
      return "missing-target";
    case "inconsistent":
      return "conflicting";
    case "invalid-value":
      return "failed";
    case "unsupported":
      return "unsupported";
  }
}

function chooseReadiness(
  status: CadSketchSolverStatus
): CadSketchSolverReadinessStatus {
  switch (status) {
    case "fully-defined":
    case "under-defined":
      return "ready";
    case "missing-target":
      return "missing";
    case "unsupported":
      return "unsupported";
    case "over-defined":
    case "conflicting":
    case "failed":
      return "blocked";
    case "not-run":
    case "solved":
    case "redundant":
      return "deferred";
  }
}

function isConstraintSupportedByNumericalSolver(
  constraint: SketchConstraintEntry
): boolean {
  if (constraint.kind === "tangent") {
    const pair = [
      constraint.primaryTarget.entityKind,
      constraint.secondaryTarget.entityKind
    ].sort();
    const pairKey = pair.join(":");
    return (
      pairKey === "circle:line" ||
      pairKey === "arc:line" ||
      pairKey === "arc:circle" ||
      pairKey === "arc:arc"
    );
  }

  const kind = constraint.kind;
  return (
    kind === "fixed" ||
    kind === "coincident" ||
    kind === "horizontal" ||
    kind === "vertical" ||
    kind === "midpoint" ||
    kind === "parallel" ||
    kind === "perpendicular" ||
    kind === "concentric" ||
    kind === "equalRadius" ||
    kind === "equalLength" ||
    kind === "angle" ||
    kind === "symmetry"
  );
}

function createEntityTargets(
  sketchId: SketchId,
  entity: SketchEntitySnapshot
): readonly CadSketchSolverTargetReference[] {
  const entityTarget: CadSketchSolverTargetReference = {
    type: "entity",
    sketchId,
    entityId: entity.id,
    entityKind: entity.kind
  };

  if (entity.kind === "point") {
    return [
      entityTarget,
      createPointTargetRef(sketchId, { entityId: entity.id, role: "position" })
    ];
  }

  if (entity.kind === "line") {
    return [
      entityTarget,
      createPointTargetRef(sketchId, { entityId: entity.id, role: "start" }),
      createPointTargetRef(sketchId, { entityId: entity.id, role: "end" })
    ];
  }

  if (entity.kind === "circle" || entity.kind === "rectangle") {
    return [
      entityTarget,
      createPointTargetRef(sketchId, { entityId: entity.id, role: "center" })
    ];
  }

  if (entity.kind === "arc") {
    return [
      entityTarget,
      createPointTargetRef(sketchId, {
        entityId: entity.id,
        entityKind: "arc",
        role: "center"
      }),
      createPointTargetRef(sketchId, {
        entityId: entity.id,
        entityKind: "arc",
        role: "start"
      }),
      createPointTargetRef(sketchId, {
        entityId: entity.id,
        entityKind: "arc",
        role: "end"
      })
    ];
  }

  return [entityTarget];
}

function createConstraintTargets(
  constraint: SketchConstraintEntry
): readonly CadSketchSolverTargetReference[] {
  const constraintTarget: CadSketchSolverTargetReference = {
    type: "constraint",
    sketchId: constraint.sketchId,
    constraintId: constraint.id,
    kind: constraint.kind
  };

  if (constraint.kind === "fixed") {
    return [
      constraintTarget,
      createPointTargetRef(constraint.sketchId, constraint.target)
    ];
  }

  if (constraint.kind === "coincident") {
    return [
      constraintTarget,
      createPointTargetRef(constraint.sketchId, constraint.primaryTarget),
      createPointTargetRef(constraint.sketchId, constraint.secondaryTarget)
    ];
  }

  if (constraint.kind === "midpoint") {
    return [
      constraintTarget,
      createPointTargetRef(constraint.sketchId, constraint.target),
      {
        type: "entity",
        sketchId: constraint.sketchId,
        entityId: constraint.lineEntityId,
        entityKind: "line"
      }
    ];
  }

  if (constraint.kind === "parallel" || constraint.kind === "perpendicular") {
    return [
      constraintTarget,
      {
        type: "entity",
        sketchId: constraint.sketchId,
        entityId: constraint.primaryLineEntityId,
        entityKind: "line"
      },
      {
        type: "entity",
        sketchId: constraint.sketchId,
        entityId: constraint.secondaryLineEntityId,
        entityKind: "line"
      }
    ];
  }

  if (constraint.kind === "tangent") {
    return [
      constraintTarget,
      {
        type: "entity",
        sketchId: constraint.sketchId,
        entityId: constraint.primaryTarget.entityId,
        entityKind: constraint.primaryTarget.entityKind
      },
      {
        type: "entity",
        sketchId: constraint.sketchId,
        entityId: constraint.secondaryTarget.entityId,
        entityKind: constraint.secondaryTarget.entityKind
      }
    ];
  }

  if (constraint.kind === "concentric" || constraint.kind === "equalRadius") {
    return [
      constraintTarget,
      {
        type: "entity",
        sketchId: constraint.sketchId,
        entityId: constraint.primaryTarget.entityId,
        entityKind: constraint.primaryTarget.entityKind
      },
      {
        type: "entity",
        sketchId: constraint.sketchId,
        entityId: constraint.secondaryTarget.entityId,
        entityKind: constraint.secondaryTarget.entityKind
      }
    ];
  }

  if (constraint.kind === "equalLength" || constraint.kind === "angle") {
    return [
      constraintTarget,
      {
        type: "entity",
        sketchId: constraint.sketchId,
        entityId: constraint.primaryLineEntityId,
        entityKind: "line"
      },
      {
        type: "entity",
        sketchId: constraint.sketchId,
        entityId: constraint.secondaryLineEntityId,
        entityKind: "line"
      }
    ];
  }

  if (constraint.kind === "symmetry") {
    return [
      constraintTarget,
      createPointTargetRef(constraint.sketchId, constraint.primaryTarget),
      createPointTargetRef(constraint.sketchId, constraint.secondaryTarget),
      {
        type: "entity",
        sketchId: constraint.sketchId,
        entityId: constraint.symmetryLineEntityId,
        entityKind: "line"
      }
    ];
  }

  return [
    constraintTarget,
    {
      type: "entity",
      sketchId: constraint.sketchId,
      entityId: constraint.entityId,
      entityKind: "line"
    }
  ];
}

function createPointTargetRef(
  sketchId: SketchId,
  target: SketchPointTarget
): CadSketchSolverTargetReference {
  return {
    type: "point",
    sketchId,
    entityId: target.entityId,
    role: target.role
  };
}

function createDiagnosticFromEvaluationIssue(
  sketchId: SketchId,
  issue: SketchEvaluationIssue
): CadSketchSolverDiagnostic {
  if (issue.code === "UNDER_DEFINED_SKETCH") {
    return createDiagnostic({
      code: "SKETCH_SOLVER_UNDER_DEFINED",
      severity: "warning",
      message: issue.message,
      sketchId,
      expected: issue.expected,
      received: issue.received
    });
  }

  if (issue.code === "OVER_DEFINED_SKETCH") {
    return createDiagnostic({
      code: "SKETCH_SOLVER_OVER_DEFINED",
      severity: "blocker",
      message: issue.message,
      sketchId,
      expected: issue.expected,
      received: issue.received
    });
  }

  if (isSketchConstraintEvaluationIssue(issue)) {
    return createDiagnosticFromConstraintIssue(sketchId, issue);
  }

  if (isSketchDimensionEvaluationIssue(issue)) {
    return createDiagnosticFromDimensionIssue(sketchId, issue);
  }

  return createDiagnostic({
    code: "SKETCH_SOLVER_FAILED",
    severity: "blocker",
    message: issue.message,
    sketchId,
    expected: issue.expected,
    received: issue.received
  });
}

function isSketchConstraintEvaluationIssue(
  issue: SketchEvaluationIssue
): issue is SketchConstraintIssue {
  return (
    issue.code === "CONFLICTING_CONSTRAINT" ||
    "sketchConstraintId" in issue ||
    "sketchPointTarget" in issue ||
    "primaryTarget" in issue ||
    "secondaryTarget" in issue ||
    "lineEntityId" in issue
  );
}

function isSketchDimensionEvaluationIssue(
  issue: SketchEvaluationIssue
): issue is SketchDimensionIssue {
  return (
    issue.code !== "UNDER_DEFINED_SKETCH" &&
    issue.code !== "OVER_DEFINED_SKETCH" &&
    !isSketchConstraintEvaluationIssue(issue)
  );
}

function createDiagnosticFromDimensionIssue(
  sketchId: SketchId,
  issue: SketchDimensionIssue
): CadSketchSolverDiagnostic {
  return createDiagnostic({
    code: mapIssueCode(issue.code),
    severity: mapIssueSeverity(issue.code),
    message: issue.message,
    sketchId: issue.sketchId ?? sketchId,
    sketchEntityId: issue.sketchEntityId,
    sketchDimensionId: issue.sketchDimensionId,
    expected: issue.expected,
    received: issue.received
  });
}

function createDiagnosticFromConstraintIssue(
  sketchId: SketchId,
  issue: SketchConstraintIssue
): CadSketchSolverDiagnostic {
  return createDiagnostic({
    code: mapIssueCode(issue.code),
    severity: mapIssueSeverity(issue.code),
    message: issue.message,
    sketchId: issue.sketchId ?? sketchId,
    sketchEntityId: issue.sketchEntityId,
    sketchConstraintId: issue.sketchConstraintId,
    target: issue.sketchPointTarget
      ? createPointTargetRef(
          issue.sketchId ?? sketchId,
          issue.sketchPointTarget
        )
      : undefined,
    expected: issue.expected,
    received: issue.received
  });
}

function mapIssueCode(
  code: SketchDimensionIssue["code"] | SketchConstraintIssue["code"]
): CadSketchSolverDiagnosticCode {
  switch (code) {
    case "SKETCH_NOT_FOUND":
    case "SKETCH_ENTITY_NOT_FOUND":
    case "PARAMETER_NOT_FOUND":
      return "SKETCH_SOLVER_MISSING_TARGET";
    case "UNSUPPORTED_TARGET":
      return "SKETCH_SOLVER_UNSUPPORTED_ENTITY";
    case "INCONSISTENT_CONSTRAINT":
    case "CONFLICTING_CONSTRAINT":
      return "SKETCH_SOLVER_CONFLICTING";
    case "INVALID_VALUE":
      return "SKETCH_SOLVER_FAILED";
    case "SKETCH_ARC_DIMENSION_INVALID":
      return "SKETCH_ARC_DIMENSION_INVALID";
    case "SKETCH_TANGENCY_OUTSIDE_ARC":
      return "SKETCH_TANGENCY_OUTSIDE_ARC";
    case "SKETCH_ARC_SOLVE_BRANCH_INVALID":
      return "SKETCH_ARC_SOLVE_BRANCH_INVALID";
  }
}

function mapIssueSeverity(
  code: SketchDimensionIssue["code"] | SketchConstraintIssue["code"]
): CadSketchSolverDiagnostic["severity"] {
  switch (code) {
    case "SKETCH_NOT_FOUND":
    case "SKETCH_ENTITY_NOT_FOUND":
    case "PARAMETER_NOT_FOUND":
    case "INCONSISTENT_CONSTRAINT":
    case "CONFLICTING_CONSTRAINT":
    case "INVALID_VALUE":
    case "SKETCH_ARC_DIMENSION_INVALID":
    case "SKETCH_TANGENCY_OUTSIDE_ARC":
    case "SKETCH_ARC_SOLVE_BRANCH_INVALID":
      return "blocker";
    case "UNSUPPORTED_TARGET":
      return "warning";
  }
}

function getSketchEntityDegreesOfFreedom(entity: SketchEntitySnapshot): number {
  if (entity.kind === "point") {
    return 2;
  }

  if (entity.kind === "line") {
    return 4;
  }

  if (entity.kind === "circle") {
    return 3;
  }

  if (entity.kind === "arc") {
    return 5;
  }

  return 4;
}

function createDiagnostic(
  diagnostic: CadSketchSolverDiagnostic
): CadSketchSolverDiagnostic {
  return diagnostic;
}

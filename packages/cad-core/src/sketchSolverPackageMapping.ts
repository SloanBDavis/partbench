import {
  SKETCH_SOLVER_MODEL_VERSION,
  solveSketch,
  type SketchSolveConstraint,
  type SketchSolveConstraintKind,
  type SketchSolveDiagnostic,
  type SketchSolveDimension,
  type SketchSolveModel,
  type SketchSolvePointVariable,
  type SketchSolveResult,
  type SketchSolveScalarVariable,
  type SketchSolverVec2
} from "@web-cad/sketch-solver";
import type {
  CadSketchSolverDiagnostic,
  CadSketchSolverDiagnosticCode,
  SketchConstraintSnapshot,
  SketchDimensionSnapshot,
  SketchEntityId,
  SketchId,
  SketchPointTarget
} from "@web-cad/cad-protocol";
import {
  cleanSketchNumber,
  evaluateSketchDimension,
  type SketchSolverDocument,
  type SketchSolverSketch
} from "./sketchSolver";

export interface SketchSolverPackageModelBuild {
  readonly modelBuilt: true;
  readonly model: SketchSolveModel;
  readonly mappedPointCount: number;
  readonly mappedScalarCount: number;
  readonly mappedConstraintCount: number;
  readonly mappedDimensionCount: number;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadSketchSolverDiagnostic[];
}

export interface SketchSolverPackageProbe {
  readonly modelBuilt: boolean;
  readonly solverRan: boolean;
  readonly model?: SketchSolveModel;
  readonly result?: SketchSolveResult;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly CadSketchSolverDiagnostic[];
}

export function createSketchSolveModelFromCadSource(
  document: SketchSolverDocument,
  sketch: SketchSolverSketch
): SketchSolverPackageModelBuild {
  const pointTargetIds = new Map<string, string>();
  const scalarIds = new Map<SketchEntityId, string>();
  const points: SketchSolvePointVariable[] = [];
  const scalars: SketchSolveScalarVariable[] = [];
  const constraints: SketchSolveConstraint[] = [];
  const dimensions: SketchSolveDimension[] = [];
  const diagnostics: CadSketchSolverDiagnostic[] = [];

  for (const entity of sketch.entities.values()) {
    if (entity.kind === "point") {
      addPointVariable({
        points,
        pointTargetIds,
        entityId: entity.id,
        role: "position",
        initial: entity.point
      });
      continue;
    }

    if (entity.kind === "line") {
      addPointVariable({
        points,
        pointTargetIds,
        entityId: entity.id,
        role: "start",
        initial: entity.start
      });
      addPointVariable({
        points,
        pointTargetIds,
        entityId: entity.id,
        role: "end",
        initial: entity.end
      });
      continue;
    }

    if (entity.kind === "rectangle") {
      addPointVariable({
        points,
        pointTargetIds,
        entityId: entity.id,
        role: "center",
        initial: entity.center
      });
      continue;
    }

    addPointVariable({
      points,
      pointTargetIds,
      entityId: entity.id,
      role: "center",
      initial: entity.center
    });
    const radiusId = createRadiusScalarId(entity.id);
    scalarIds.set(entity.id, radiusId);
    scalars.push({
      id: radiusId,
      initial: cleanSketchNumber(entity.radius)
    });
  }

  for (const constraint of document.sketchConstraints.values()) {
    if (constraint.sketchId !== sketch.id) {
      continue;
    }

    const mapped = mapConstraintToSketchSolveConstraint({
      constraint,
      sketch,
      pointTargetIds,
      scalarIds
    });

    if (mapped.constraint) {
      constraints.push(mapped.constraint);
    }

    diagnostics.push(...mapped.diagnostics);
  }

  for (const dimension of document.sketchDimensions.values()) {
    if (dimension.sketchId !== sketch.id) {
      continue;
    }

    const mapped = mapDimensionToSketchSolveDimension({
      document,
      dimension,
      sketch,
      pointTargetIds,
      scalarIds
    });

    if (mapped.dimension) {
      dimensions.push(mapped.dimension);
    }

    diagnostics.push(...mapped.diagnostics);
  }

  const model: SketchSolveModel = {
    version: SKETCH_SOLVER_MODEL_VERSION,
    points,
    scalars,
    constraints,
    dimensions
  };

  return {
    modelBuilt: true,
    model,
    mappedPointCount: points.length,
    mappedScalarCount: scalars.length,
    mappedConstraintCount: constraints.length,
    mappedDimensionCount: dimensions.length,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

export function runSketchSolverPackageProbe(
  document: SketchSolverDocument,
  sketch: SketchSolverSketch
): SketchSolverPackageProbe {
  const build = createSketchSolveModelFromCadSource(document, sketch);
  const result = solveSketch(build.model);
  const resultDiagnostics = result.diagnostics.map((diagnostic) =>
    createDiagnosticFromSketchSolveDiagnostic(sketch.id, diagnostic)
  );
  const diagnostics = [...build.diagnostics, ...resultDiagnostics];

  return {
    modelBuilt: true,
    solverRan: true,
    model: build.model,
    result,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function addPointVariable({
  points,
  pointTargetIds,
  entityId,
  role,
  initial
}: {
  readonly points: SketchSolvePointVariable[];
  readonly pointTargetIds: Map<string, string>;
  readonly entityId: SketchEntityId;
  readonly role: SketchPointTarget["role"];
  readonly initial: readonly [number, number];
}): void {
  const id = createPointTargetId(entityId, role);
  pointTargetIds.set(createPointTargetKey(entityId, role), id);
  points.push({
    id,
    initial: [cleanSketchNumber(initial[0]), cleanSketchNumber(initial[1])]
  });
}

function mapConstraintToSketchSolveConstraint({
  constraint,
  sketch,
  pointTargetIds,
  scalarIds
}: {
  readonly constraint: SketchConstraintSnapshot;
  readonly sketch: SketchSolverSketch;
  readonly pointTargetIds: ReadonlyMap<string, string>;
  readonly scalarIds: ReadonlyMap<SketchEntityId, string>;
}): {
  readonly constraint?: SketchSolveConstraint;
  readonly diagnostics: readonly CadSketchSolverDiagnostic[];
} {
  if (constraint.kind === "fixed") {
    const pointId = pointIdForTarget(pointTargetIds, constraint.target);

    if (!pointId) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Fixed point constraint target cannot be mapped to the numerical solver model.",
            sketchId: constraint.sketchId,
            sketchConstraintId: constraint.id,
            sketchEntityId: constraint.target.entityId,
            expected: "solver point target",
            received: constraint.target.role
          })
        ]
      };
    }

    return {
      constraint: {
        id: constraint.id,
        kind: "fixedPoint",
        pointId,
        value: cleanVec2(constraint.coordinate)
      },
      diagnostics: []
    };
  }

  if (constraint.kind === "coincident") {
    const pointAId = pointIdForTarget(pointTargetIds, constraint.primaryTarget);
    const pointBId = pointIdForTarget(
      pointTargetIds,
      constraint.secondaryTarget
    );

    if (!pointAId || !pointBId) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Coincident constraint targets cannot be mapped to the numerical solver model.",
            sketchId: constraint.sketchId,
            sketchConstraintId: constraint.id,
            sketchEntityId: constraint.entityId,
            expected: "two solver point targets",
            received: "missing point target"
          })
        ]
      };
    }

    return {
      constraint: {
        id: constraint.id,
        kind: "coincident",
        pointAId,
        pointBId
      },
      diagnostics: []
    };
  }

  if (constraint.kind === "horizontal" || constraint.kind === "vertical") {
    const entity = sketch.entities.get(constraint.entityId);

    if (!entity || entity.kind !== "line") {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Orientation constraint target cannot be mapped to a solver line.",
            sketchId: constraint.sketchId,
            sketchConstraintId: constraint.id,
            sketchEntityId: constraint.entityId,
            expected: "line entity",
            received: entity?.kind ?? "missing"
          })
        ]
      };
    }

    const startPointId = pointIdForTarget(pointTargetIds, {
      entityId: entity.id,
      role: "start"
    });
    const endPointId = pointIdForTarget(pointTargetIds, {
      entityId: entity.id,
      role: "end"
    });

    if (!startPointId || !endPointId) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Orientation constraint line endpoints cannot be mapped to solver points.",
            sketchId: constraint.sketchId,
            sketchConstraintId: constraint.id,
            sketchEntityId: constraint.entityId,
            expected: "line start and end solver points",
            received: "missing endpoint"
          })
        ]
      };
    }

    return {
      constraint: {
        id: constraint.id,
        kind: constraint.kind,
        startPointId,
        endPointId
      },
      diagnostics: []
    };
  }

  if (constraint.kind === "midpoint") {
    const midpointId = pointIdForTarget(pointTargetIds, constraint.target);
    const startPointId = pointIdForTarget(pointTargetIds, {
      entityId: constraint.lineEntityId,
      role: "start"
    });
    const endPointId = pointIdForTarget(pointTargetIds, {
      entityId: constraint.lineEntityId,
      role: "end"
    });

    if (!midpointId || !startPointId || !endPointId) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Midpoint constraint targets cannot be mapped to solver points.",
            sketchId: constraint.sketchId,
            sketchConstraintId: constraint.id,
            sketchEntityId: constraint.entityId,
            expected: "midpoint, line start, and line end solver points",
            received: "missing point target"
          })
        ]
      };
    }

    return {
      constraint: {
        id: constraint.id,
        kind: "midpoint",
        midpointId,
        startPointId,
        endPointId
      },
      diagnostics: []
    };
  }

  if (constraint.kind === "tangent") {
    const primaryEntity = sketch.entities.get(
      constraint.primaryTarget.entityId
    );
    const secondaryEntity = sketch.entities.get(
      constraint.secondaryTarget.entityId
    );
    const lineEntity =
      primaryEntity?.kind === "line"
        ? primaryEntity
        : secondaryEntity?.kind === "line"
          ? secondaryEntity
          : undefined;
    const circleEntity =
      primaryEntity?.kind === "circle"
        ? primaryEntity
        : secondaryEntity?.kind === "circle"
          ? secondaryEntity
          : undefined;

    if (!lineEntity || !circleEntity) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_UNSUPPORTED_CONSTRAINT",
            message:
              "Tangent constraints currently map to the numerical solver only for one line and one circle target.",
            sketchId: constraint.sketchId,
            sketchConstraintId: constraint.id,
            sketchEntityId: constraint.entityId,
            expected: "line-circle tangent targets",
            received: `${primaryEntity?.kind ?? "missing"}:${secondaryEntity?.kind ?? "missing"}`
          })
        ]
      };
    }

    const lineStartPointId = pointIdForTarget(pointTargetIds, {
      entityId: lineEntity.id,
      role: "start"
    });
    const lineEndPointId = pointIdForTarget(pointTargetIds, {
      entityId: lineEntity.id,
      role: "end"
    });
    const circleCenterPointId = pointIdForTarget(pointTargetIds, {
      entityId: circleEntity.id,
      role: "center"
    });
    const circleRadiusId = scalarIds.get(circleEntity.id);

    if (
      !lineStartPointId ||
      !lineEndPointId ||
      !circleCenterPointId ||
      !circleRadiusId
    ) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Tangent constraint targets cannot be mapped to solver line endpoints, circle center, and circle radius.",
            sketchId: constraint.sketchId,
            sketchConstraintId: constraint.id,
            sketchEntityId: constraint.entityId,
            expected: "line endpoints, circle center point, and radius scalar",
            received: "missing tangent solver target"
          })
        ]
      };
    }

    return {
      constraint: {
        id: constraint.id,
        kind: "tangent",
        lineStartPointId,
        lineEndPointId,
        circleCenterPointId,
        circleRadiusId
      },
      diagnostics: []
    };
  }

  if (constraint.kind === "symmetry") {
    const primaryPointId = pointIdForTarget(
      pointTargetIds,
      constraint.primaryTarget
    );
    const secondaryPointId = pointIdForTarget(
      pointTargetIds,
      constraint.secondaryTarget
    );
    const lineStartPointId = pointIdForTarget(pointTargetIds, {
      entityId: constraint.symmetryLineEntityId,
      role: "start"
    });
    const lineEndPointId = pointIdForTarget(pointTargetIds, {
      entityId: constraint.symmetryLineEntityId,
      role: "end"
    });

    if (
      !primaryPointId ||
      !secondaryPointId ||
      !lineStartPointId ||
      !lineEndPointId
    ) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Symmetry constraint targets cannot be mapped to solver points and a symmetry line.",
            sketchId: constraint.sketchId,
            sketchConstraintId: constraint.id,
            sketchEntityId: constraint.entityId,
            expected: "two solver point targets and line start/end points",
            received: "missing symmetry solver target"
          })
        ]
      };
    }

    return {
      constraint: {
        id: constraint.id,
        kind: "symmetry",
        primaryPointId,
        secondaryPointId,
        lineStartPointId,
        lineEndPointId
      },
      diagnostics: []
    };
  }

  if (
    constraint.kind === "parallel" ||
    constraint.kind === "perpendicular" ||
    constraint.kind === "equalLength" ||
    constraint.kind === "angle"
  ) {
    const primaryEntity = sketch.entities.get(constraint.primaryLineEntityId);
    const secondaryEntity = sketch.entities.get(
      constraint.secondaryLineEntityId
    );

    if (
      !primaryEntity ||
      primaryEntity.kind !== "line" ||
      !secondaryEntity ||
      secondaryEntity.kind !== "line"
    ) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Line-pair constraint targets cannot be mapped to solver lines.",
            sketchId: constraint.sketchId,
            sketchConstraintId: constraint.id,
            sketchEntityId: constraint.primaryLineEntityId,
            expected: "two line entities",
            received: `${primaryEntity?.kind ?? "missing"}:${secondaryEntity?.kind ?? "missing"}`
          })
        ]
      };
    }

    const primaryStartPointId = pointIdForTarget(pointTargetIds, {
      entityId: primaryEntity.id,
      role: "start"
    });
    const primaryEndPointId = pointIdForTarget(pointTargetIds, {
      entityId: primaryEntity.id,
      role: "end"
    });
    const secondaryStartPointId = pointIdForTarget(pointTargetIds, {
      entityId: secondaryEntity.id,
      role: "start"
    });
    const secondaryEndPointId = pointIdForTarget(pointTargetIds, {
      entityId: secondaryEntity.id,
      role: "end"
    });

    if (
      !primaryStartPointId ||
      !primaryEndPointId ||
      !secondaryStartPointId ||
      !secondaryEndPointId
    ) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Line-pair constraint endpoints cannot be mapped to solver points.",
            sketchId: constraint.sketchId,
            sketchConstraintId: constraint.id,
            sketchEntityId: constraint.primaryLineEntityId,
            expected: "line start and end solver points for both lines",
            received: "missing endpoint"
          })
        ]
      };
    }

    if (
      constraint.kind === "angle" &&
      !Number.isFinite(constraint.angleDegrees)
    ) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_FAILED",
            message:
              "Angle constraint target cannot be mapped with a non-finite angle value.",
            sketchId: constraint.sketchId,
            sketchConstraintId: constraint.id,
            sketchEntityId: constraint.primaryLineEntityId,
            expected: "finite angle value in degrees",
            received: String(constraint.angleDegrees)
          })
        ]
      };
    }

    return {
      constraint:
        constraint.kind === "angle"
          ? {
              id: constraint.id,
              kind: "angle",
              primaryStartPointId,
              primaryEndPointId,
              secondaryStartPointId,
              secondaryEndPointId,
              angleDegrees: cleanSketchNumber(constraint.angleDegrees)
            }
          : {
              id: constraint.id,
              kind: constraint.kind,
              primaryStartPointId,
              primaryEndPointId,
              secondaryStartPointId,
              secondaryEndPointId
            },
      diagnostics: []
    };
  }

  if (constraint.kind === "concentric") {
    const primaryEntity = sketch.entities.get(constraint.primaryCircleEntityId);
    const secondaryEntity = sketch.entities.get(
      constraint.secondaryCircleEntityId
    );

    if (
      !primaryEntity ||
      primaryEntity.kind !== "circle" ||
      !secondaryEntity ||
      secondaryEntity.kind !== "circle"
    ) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Concentric constraint targets cannot be mapped to solver circles.",
            sketchId: constraint.sketchId,
            sketchConstraintId: constraint.id,
            sketchEntityId: constraint.primaryCircleEntityId,
            expected: "two circle entities",
            received: `${primaryEntity?.kind ?? "missing"}:${secondaryEntity?.kind ?? "missing"}`
          })
        ]
      };
    }

    const primaryCenterPointId = pointIdForTarget(pointTargetIds, {
      entityId: primaryEntity.id,
      role: "center"
    });
    const secondaryCenterPointId = pointIdForTarget(pointTargetIds, {
      entityId: secondaryEntity.id,
      role: "center"
    });

    if (!primaryCenterPointId || !secondaryCenterPointId) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Concentric constraint centers cannot be mapped to solver points.",
            sketchId: constraint.sketchId,
            sketchConstraintId: constraint.id,
            sketchEntityId: constraint.primaryCircleEntityId,
            expected: "circle center solver points",
            received: "missing center point"
          })
        ]
      };
    }

    return {
      constraint: {
        id: constraint.id,
        kind: "concentric",
        primaryCenterPointId,
        secondaryCenterPointId
      },
      diagnostics: []
    };
  }

  if (constraint.kind === "equalRadius") {
    const primaryEntity = sketch.entities.get(constraint.primaryCircleEntityId);
    const secondaryEntity = sketch.entities.get(
      constraint.secondaryCircleEntityId
    );

    if (
      !primaryEntity ||
      primaryEntity.kind !== "circle" ||
      !secondaryEntity ||
      secondaryEntity.kind !== "circle"
    ) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Equal-radius constraint targets cannot be mapped to solver circles.",
            sketchId: constraint.sketchId,
            sketchConstraintId: constraint.id,
            sketchEntityId: constraint.primaryCircleEntityId,
            expected: "two circle entities",
            received: `${primaryEntity?.kind ?? "missing"}:${secondaryEntity?.kind ?? "missing"}`
          })
        ]
      };
    }

    const primaryRadiusId = scalarIds.get(primaryEntity.id);
    const secondaryRadiusId = scalarIds.get(secondaryEntity.id);

    if (!primaryRadiusId || !secondaryRadiusId) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Equal-radius constraint radii cannot be mapped to solver scalars.",
            sketchId: constraint.sketchId,
            sketchConstraintId: constraint.id,
            sketchEntityId: constraint.primaryCircleEntityId,
            expected: "circle radius solver scalars",
            received: "missing radius scalar"
          })
        ]
      };
    }

    return {
      constraint: {
        id: constraint.id,
        kind: "equalRadius",
        primaryRadiusId,
        secondaryRadiusId
      },
      diagnostics: []
    };
  }

  return {
    diagnostics: [
      createMappingDiagnostic({
        code: "SKETCH_SOLVER_UNSUPPORTED_CONSTRAINT",
        message:
          "Constraint target cannot be mapped to the numerical solver model.",
        sketchId: constraint.sketchId,
        sketchConstraintId: constraint.id,
        sketchEntityId: constraint.entityId,
        expected: "supported V11 solver constraint source",
        received: constraint.kind
      })
    ]
  };
}

function mapDimensionToSketchSolveDimension({
  document,
  dimension,
  sketch,
  pointTargetIds,
  scalarIds
}: {
  readonly document: SketchSolverDocument;
  readonly dimension: SketchDimensionSnapshot;
  readonly sketch: SketchSolverSketch;
  readonly pointTargetIds: ReadonlyMap<string, string>;
  readonly scalarIds: ReadonlyMap<SketchEntityId, string>;
}): {
  readonly dimension?: SketchSolveDimension;
  readonly diagnostics: readonly CadSketchSolverDiagnostic[];
} {
  const entry = evaluateSketchDimension(document, dimension, undefined, {
    checkConsistency: false
  });

  if (entry.effectiveValue === undefined) {
    return {
      diagnostics: [
        createMappingDiagnostic({
          code: "SKETCH_SOLVER_MISSING_TARGET",
          message:
            "Driving dimension value cannot be evaluated for the numerical solver model.",
          sketchId: dimension.sketchId,
          sketchDimensionId: dimension.id,
          sketchEntityId: dimension.entityId,
          expected: "literal or resolved parameter value",
          received: "missing value"
        })
      ]
    };
  }

  if (
    dimension.target.entityKind === "line" &&
    dimension.target.role === "length"
  ) {
    const entity = sketch.entities.get(dimension.entityId);

    if (!entity || entity.kind !== "line") {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Line length dimension target cannot be mapped to a solver line.",
            sketchId: dimension.sketchId,
            sketchDimensionId: dimension.id,
            sketchEntityId: dimension.entityId,
            expected: "line entity",
            received: entity?.kind ?? "missing"
          })
        ]
      };
    }

    const startPointId = pointIdForTarget(pointTargetIds, {
      entityId: entity.id,
      role: "start"
    });
    const endPointId = pointIdForTarget(pointTargetIds, {
      entityId: entity.id,
      role: "end"
    });

    if (!startPointId || !endPointId) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Line length dimension endpoints cannot be mapped to solver points.",
            sketchId: dimension.sketchId,
            sketchDimensionId: dimension.id,
            sketchEntityId: dimension.entityId,
            expected: "line start and end solver points",
            received: "missing endpoint"
          })
        ]
      };
    }

    return {
      dimension: {
        id: dimension.id,
        kind: "lineLength",
        startPointId,
        endPointId,
        value: cleanSketchNumber(entry.effectiveValue)
      },
      diagnostics: []
    };
  }

  if (
    dimension.target.entityKind === "circle" &&
    dimension.target.role === "radius"
  ) {
    const radiusId = scalarIds.get(dimension.entityId);

    if (!radiusId) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Circle radius dimension target cannot be mapped to a solver scalar.",
            sketchId: dimension.sketchId,
            sketchDimensionId: dimension.id,
            sketchEntityId: dimension.entityId,
            expected: "circle radius scalar",
            received: "missing scalar"
          })
        ]
      };
    }

    return {
      dimension: {
        id: dimension.id,
        kind: "circleRadius",
        radiusId,
        value: cleanSketchNumber(entry.effectiveValue)
      },
      diagnostics: []
    };
  }

  return {
    diagnostics: [
      createMappingDiagnostic({
        code: "SKETCH_SOLVER_UNSUPPORTED_ENTITY",
        message:
          "This driving dimension remains source-backed but is not mapped to the numerical solver package in D1.",
        sketchId: dimension.sketchId,
        sketchDimensionId: dimension.id,
        sketchEntityId: dimension.entityId,
        expected: "line.length or circle.radius dimension",
        received: `${dimension.target.entityKind}.${dimension.target.role}`
      })
    ]
  };
}

function pointIdForTarget(
  pointTargetIds: ReadonlyMap<string, string>,
  target: SketchPointTarget
): string | undefined {
  return pointTargetIds.get(createPointTargetKey(target.entityId, target.role));
}

function createPointTargetId(
  entityId: SketchEntityId,
  role: SketchPointTarget["role"]
): string {
  return `${entityId}:${role}`;
}

function createPointTargetKey(
  entityId: SketchEntityId,
  role: SketchPointTarget["role"]
): string {
  return `${entityId}\0${role}`;
}

function createRadiusScalarId(entityId: SketchEntityId): string {
  return `${entityId}:radius`;
}

function cleanVec2(value: readonly [number, number]): SketchSolverVec2 {
  return [cleanSketchNumber(value[0]), cleanSketchNumber(value[1])];
}

function createMappingDiagnostic({
  code,
  message,
  sketchId,
  sketchEntityId,
  sketchDimensionId,
  sketchConstraintId,
  expected,
  received
}: {
  readonly code: CadSketchSolverDiagnosticCode;
  readonly message: string;
  readonly sketchId: SketchId;
  readonly sketchEntityId?: SketchEntityId;
  readonly sketchDimensionId?: string;
  readonly sketchConstraintId?: string;
  readonly expected?: string;
  readonly received?: string;
}): CadSketchSolverDiagnostic {
  return {
    code,
    severity: code === "SKETCH_SOLVER_MISSING_TARGET" ? "blocker" : "info",
    message,
    sketchId,
    sketchEntityId,
    sketchDimensionId,
    sketchConstraintId,
    expected,
    received
  };
}

function createDiagnosticFromSketchSolveDiagnostic(
  sketchId: SketchId,
  diagnostic: SketchSolveDiagnostic
): CadSketchSolverDiagnostic {
  const constraintKind = mapSolverConstraintKind(diagnostic.constraintKind);
  return {
    code: mapSketchSolveDiagnosticCode(diagnostic.code),
    severity: diagnostic.severity,
    message: diagnostic.message,
    sketchId,
    ...(diagnostic.sourceType === "dimension"
      ? { sketchDimensionId: diagnostic.sourceId }
      : {}),
    ...(diagnostic.sourceType === "constraint"
      ? { sketchConstraintId: diagnostic.sourceId }
      : {}),
    ...(constraintKind ? { constraintKind } : {}),
    expected: diagnostic.expected,
    received:
      diagnostic.received ??
      (diagnostic.targetId ? "unmapped solver target" : undefined)
  };
}

function mapSolverConstraintKind(
  kind: SketchSolveConstraintKind | undefined
): CadSketchSolverDiagnostic["constraintKind"] | undefined {
  if (kind === undefined) {
    return undefined;
  }

  if (kind === "fixedPoint") {
    return "fixed";
  }

  if (
    kind === "coincident" ||
    kind === "horizontal" ||
    kind === "vertical" ||
    kind === "midpoint" ||
    kind === "parallel" ||
    kind === "perpendicular" ||
    kind === "tangent" ||
    kind === "concentric" ||
    kind === "equalLength" ||
    kind === "equalRadius" ||
    kind === "angle" ||
    kind === "symmetry"
  ) {
    return kind;
  }

  return undefined;
}

function mapSketchSolveDiagnosticCode(
  code: SketchSolveDiagnostic["code"]
): CadSketchSolverDiagnosticCode {
  switch (code) {
    case "SKETCH_SOLVER_MISSING_TARGET":
      return "SKETCH_SOLVER_MISSING_TARGET";
    case "SKETCH_SOLVER_UNSUPPORTED_CONSTRAINT":
      return "SKETCH_SOLVER_UNSUPPORTED_CONSTRAINT";
    case "SKETCH_SOLVER_UNDER_DEFINED":
      return "SKETCH_SOLVER_UNDER_DEFINED";
    case "SKETCH_SOLVER_OVER_DEFINED":
      return "SKETCH_SOLVER_OVER_DEFINED";
    case "SKETCH_SOLVER_CONFLICTING":
      return "SKETCH_SOLVER_CONFLICTING";
    case "SKETCH_SOLVER_NOT_RUN":
      return "SKETCH_SOLVER_NOT_RUN";
    case "SKETCH_SOLVER_REDUNDANT":
      return "SKETCH_SOLVER_REDUNDANT";
    case "SKETCH_SOLVER_INVALID_VALUE":
    case "SKETCH_SOLVER_NON_CONVERGENCE":
      return "SKETCH_SOLVER_FAILED";
  }
}

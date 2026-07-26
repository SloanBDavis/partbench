import {
  SKETCH_SOLVER_MODEL_VERSION,
  solveSketch,
  type SketchSolveArcVariable,
  type SketchSolveConstraint,
  type SketchSolveConstraintKind,
  type SketchSolveDiagnostic,
  type SketchSolveDimension,
  type SketchSolveModel,
  type SketchSolvePointVariable,
  type SketchSolvePointTarget as SketchSolverPointTarget,
  type SketchSolveCurveTarget as SketchSolverCurveTarget,
  type SketchSolveRadiusCurveTarget as SketchSolverRadiusCurveTarget,
  type SketchSolveResult,
  type SketchSolveScalarVariable,
  type SketchSolverVec2
} from "@web-cad/sketch-solver";
import type {
  CadSketchSolverDiagnostic,
  CadSketchSolverDiagnosticCode,
  SketchConstraintSnapshot,
  SketchCurveConstraintTarget,
  SketchDimensionSnapshotV22,
  SketchEntityId,
  SketchEntitySnapshot,
  SketchId,
  SketchPointTarget,
  SketchPointTargetV22,
  SketchPlane
} from "@web-cad/cad-protocol";
import { SKETCH_GEOMETRY_POLICY } from "./sketchGeometryPolicy";
import { createCanonicalSketchArcEntity } from "./sketchArcMath";
import { cleanSketchNumber } from "./sketchNumber";
import {
  normalizeSketchDimensionSnapshotV22,
  type SketchDimensionSnapshotCurrent
} from "./v22SourceShapes";

export interface SketchSolverPackageDocument {
  readonly parameters: ReadonlyMap<string, { readonly value: number }>;
  readonly sketchDimensions: ReadonlyMap<
    string,
    SketchDimensionSnapshotCurrent
  >;
  readonly sketchConstraints: ReadonlyMap<string, SketchConstraintSnapshot>;
}

export interface SketchSolverPackageSketch {
  readonly id: SketchId;
  readonly name: string;
  readonly plane: SketchPlane;
  readonly entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>;
}

export interface SketchSolverPackageModelBuild {
  readonly modelBuilt: true;
  readonly model: SketchSolveModel;
  readonly mappedPointCount: number;
  readonly mappedScalarCount: number;
  readonly mappedArcCount: number;
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
  document: SketchSolverPackageDocument,
  sketch: SketchSolverPackageSketch
): SketchSolverPackageModelBuild {
  const pointTargetIds = new Map<string, string>();
  const scalarIds = new Map<SketchEntityId, string>();
  const points: SketchSolvePointVariable[] = [];
  const scalars: SketchSolveScalarVariable[] = [];
  const arcs: SketchSolveArcVariable[] = [];
  const arcIds = new Set<SketchEntityId>();
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

    if (entity.kind === "circle") {
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
      continue;
    }

    if (entity.kind === "arc") {
      arcIds.add(entity.id);
      arcs.push({
        id: entity.id,
        initial: {
          center: cleanVec2(entity.center),
          radius: cleanSketchNumber(entity.radius),
          startAngleDegrees: cleanSketchNumber(entity.startAngleDegrees),
          sweepAngleDegrees: cleanSketchNumber(entity.sweepAngleDegrees)
        }
      });
    }
  }

  for (const constraint of document.sketchConstraints.values()) {
    if (constraint.sketchId !== sketch.id) {
      continue;
    }

    const mapped = mapConstraintToSketchSolveConstraint({
      constraint,
      sketch,
      pointTargetIds,
      scalarIds,
      arcIds
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
    const normalizedDimension = normalizeSketchDimensionSnapshotV22(dimension);

    const mapped = mapDimensionToSketchSolveDimension({
      document,
      dimension: normalizedDimension,
      sketch,
      pointTargetIds,
      scalarIds,
      arcIds
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
    arcs,
    constraints,
    dimensions,
    settings: {
      tolerance: SKETCH_GEOMETRY_POLICY.linearTolerance,
      angularToleranceDegrees: SKETCH_GEOMETRY_POLICY.angularToleranceDegrees
    }
  };

  return {
    modelBuilt: true,
    model,
    mappedPointCount: points.length,
    mappedScalarCount: scalars.length,
    mappedArcCount: arcs.length,
    mappedConstraintCount: constraints.length,
    mappedDimensionCount: dimensions.length,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

export function runSketchSolverPackageProbe(
  document: SketchSolverPackageDocument,
  sketch: SketchSolverPackageSketch
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

export function applySketchSolveResultToCadEntities(
  sketch: SketchSolverPackageSketch,
  result: SketchSolveResult
): ReadonlyMap<SketchEntityId, SketchEntitySnapshot> {
  const pointById = new Map(
    result.points.map((point) => [point.id, point.value])
  );
  const scalarById = new Map(
    result.scalars.map((scalar) => [scalar.id, scalar.value])
  );
  const arcById = new Map(result.arcs.map((arc) => [arc.id, arc]));
  const entities = new Map<SketchEntityId, SketchEntitySnapshot>();

  for (const entity of sketch.entities.values()) {
    if (entity.kind === "point") {
      entities.set(entity.id, {
        ...entity,
        point:
          pointById.get(createPointTargetId(entity.id, "position")) ??
          entity.point
      });
      continue;
    }
    if (entity.kind === "line") {
      entities.set(entity.id, {
        ...entity,
        start:
          pointById.get(createPointTargetId(entity.id, "start")) ??
          entity.start,
        end: pointById.get(createPointTargetId(entity.id, "end")) ?? entity.end
      });
      continue;
    }
    if (entity.kind === "rectangle") {
      entities.set(entity.id, {
        ...entity,
        center:
          pointById.get(createPointTargetId(entity.id, "center")) ??
          entity.center
      });
      continue;
    }
    if (entity.kind === "circle") {
      entities.set(entity.id, {
        ...entity,
        center:
          pointById.get(createPointTargetId(entity.id, "center")) ??
          entity.center,
        radius: scalarById.get(createRadiusScalarId(entity.id)) ?? entity.radius
      });
      continue;
    }

    const solved = arcById.get(entity.id);
    if (!solved) {
      entities.set(entity.id, entity);
      continue;
    }
    const canonical = createCanonicalSketchArcEntity(
      entity.id,
      {
        kind: "centerAngles",
        center: solved.center,
        radius: solved.radius,
        startAngleDegrees: solved.startAngleDegrees,
        sweepAngleDegrees: solved.sweepAngleDegrees
      },
      entity.construction,
      SKETCH_GEOMETRY_POLICY
    );
    entities.set(entity.id, canonical.ok ? canonical.value : entity);
  }

  return entities;
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
  scalarIds,
  arcIds
}: {
  readonly constraint: SketchConstraintSnapshot;
  readonly sketch: SketchSolverPackageSketch;
  readonly pointTargetIds: ReadonlyMap<string, string>;
  readonly scalarIds: ReadonlyMap<SketchEntityId, string>;
  readonly arcIds: ReadonlySet<SketchEntityId>;
}): {
  readonly constraint?: SketchSolveConstraint;
  readonly diagnostics: readonly CadSketchSolverDiagnostic[];
} {
  if (constraint.kind === "fixed") {
    const target = mapPointTarget(pointTargetIds, arcIds, constraint.target);

    if (!target) {
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
        target,
        value: cleanVec2(constraint.coordinate)
      },
      diagnostics: []
    };
  }

  if (constraint.kind === "coincident") {
    const primaryTarget = mapPointTarget(
      pointTargetIds,
      arcIds,
      constraint.primaryTarget
    );
    const secondaryTarget = mapPointTarget(
      pointTargetIds,
      arcIds,
      constraint.secondaryTarget
    );

    if (!primaryTarget || !secondaryTarget) {
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
        primaryTarget,
        secondaryTarget
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
    const primaryTarget = mapCurveTarget({
      sketch,
      pointTargetIds,
      scalarIds,
      arcIds,
      target: constraint.primaryTarget
    });
    const secondaryTarget = mapCurveTarget({
      sketch,
      pointTargetIds,
      scalarIds,
      arcIds,
      target: constraint.secondaryTarget
    });

    if (!primaryTarget || !secondaryTarget) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Tangent constraint targets cannot be mapped to solver curve targets.",
            sketchId: constraint.sketchId,
            sketchConstraintId: constraint.id,
            sketchEntityId: constraint.entityId,
            expected: "resolved line, circle, or arc curve targets",
            received: "missing tangent solver target"
          })
        ]
      };
    }

    return {
      constraint: {
        id: constraint.id,
        kind: "tangent",
        primaryTarget,
        secondaryTarget
      },
      diagnostics: []
    };
  }

  if (constraint.kind === "symmetry") {
    const primaryTarget = mapPointTarget(
      pointTargetIds,
      arcIds,
      constraint.primaryTarget
    );
    const secondaryTarget = mapPointTarget(
      pointTargetIds,
      arcIds,
      constraint.secondaryTarget
    );
    const axisTarget = mapCurveTarget({
      sketch,
      pointTargetIds,
      scalarIds,
      arcIds,
      target: {
        entityId: constraint.symmetryLineEntityId,
        entityKind: "line"
      }
    });

    if (!primaryTarget || !secondaryTarget || axisTarget?.kind !== "line") {
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
        primaryTarget,
        secondaryTarget,
        axisTarget
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
    const primaryTarget = mapRadiusCurveTarget({
      sketch,
      pointTargetIds,
      scalarIds,
      arcIds,
      target: constraint.primaryTarget
    });
    const secondaryTarget = mapRadiusCurveTarget({
      sketch,
      pointTargetIds,
      scalarIds,
      arcIds,
      target: constraint.secondaryTarget
    });

    if (!primaryTarget || !secondaryTarget) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Concentric constraint targets cannot be mapped to solver radius curves.",
            sketchId: constraint.sketchId,
            sketchConstraintId: constraint.id,
            sketchEntityId: constraint.primaryTarget.entityId,
            expected: "circle or arc radius curve targets",
            received: "missing concentric curve target"
          })
        ]
      };
    }

    return {
      constraint: {
        id: constraint.id,
        kind: "concentric",
        primaryTarget,
        secondaryTarget
      },
      diagnostics: []
    };
  }

  if (constraint.kind === "equalRadius") {
    const primaryTarget = mapRadiusCurveTarget({
      sketch,
      pointTargetIds,
      scalarIds,
      arcIds,
      target: constraint.primaryTarget
    });
    const secondaryTarget = mapRadiusCurveTarget({
      sketch,
      pointTargetIds,
      scalarIds,
      arcIds,
      target: constraint.secondaryTarget
    });

    if (!primaryTarget || !secondaryTarget) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Equal-radius constraint targets cannot be mapped to solver radius curves.",
            sketchId: constraint.sketchId,
            sketchConstraintId: constraint.id,
            sketchEntityId: constraint.primaryTarget.entityId,
            expected: "circle or arc radius curve targets",
            received: "missing equal-radius curve target"
          })
        ]
      };
    }

    return {
      constraint: {
        id: constraint.id,
        kind: "equalRadius",
        primaryTarget,
        secondaryTarget
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
  scalarIds,
  arcIds
}: {
  readonly document: SketchSolverPackageDocument;
  readonly dimension: SketchDimensionSnapshotV22;
  readonly sketch: SketchSolverPackageSketch;
  readonly pointTargetIds: ReadonlyMap<string, string>;
  readonly scalarIds: ReadonlyMap<SketchEntityId, string>;
  readonly arcIds: ReadonlySet<SketchEntityId>;
}): {
  readonly dimension?: SketchSolveDimension;
  readonly diagnostics: readonly CadSketchSolverDiagnostic[];
} {
  const effectiveValue =
    dimension.valueSource.type === "literal"
      ? dimension.valueSource.value
      : document.parameters.get(dimension.valueSource.parameterId)?.value;
  const primaryEntityId = getPrimaryDimensionEntityId(dimension);

  if (effectiveValue === undefined) {
    return {
      diagnostics: [
        createMappingDiagnostic({
          code: "SKETCH_SOLVER_MISSING_TARGET",
          message:
            "Driving dimension value cannot be evaluated for the numerical solver model.",
          sketchId: dimension.sketchId,
          sketchDimensionId: dimension.id,
          sketchEntityId: primaryEntityId,
          expected: "literal or resolved parameter value",
          received: "missing value"
        })
      ]
    };
  }

  if (!Number.isFinite(effectiveValue)) {
    return {
      diagnostics: [
        createMappingDiagnostic({
          code: "SKETCH_SOLVER_FAILED",
          message:
            "Driving dimension value must be finite before it enters the numerical solver model.",
          sketchId: dimension.sketchId,
          sketchDimensionId: dimension.id,
          sketchEntityId: primaryEntityId,
          expected: "finite effective value",
          received: String(effectiveValue)
        })
      ]
    };
  }

  if (dimension.target.kind === "entityScalar") {
    const target = dimension.target;
    const entity = sketch.entities.get(target.entityId);
    if (!entity || entity.kind !== target.entityKind) {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_MISSING_TARGET",
            message:
              "Scalar dimension target does not match its declared sketch entity kind.",
            sketchId: dimension.sketchId,
            sketchDimensionId: dimension.id,
            sketchEntityId: target.entityId,
            expected: `${target.entityKind}.${target.role}`,
            received: entity?.kind ?? "missing"
          })
        ]
      };
    }

    if (target.entityKind === "rectangle") {
      return {
        diagnostics: [
          createMappingDiagnostic({
            code: "SKETCH_SOLVER_UNSUPPORTED_ENTITY",
            message:
              "Rectangle width and height dimensions retain their source-backed direct-update behavior and do not add a numerical residual.",
            sketchId: dimension.sketchId,
            sketchDimensionId: dimension.id,
            sketchEntityId: target.entityId,
            expected: "cad-core direct rectangle dimension update",
            received: `rectangle.${target.role}`
          })
        ]
      };
    }

    if (target.entityKind === "line") {
      const lineTarget = mapDimensionLineTarget({
        dimension,
        sketch,
        pointTargetIds,
        entityId: target.entityId,
        label: "Line length dimension"
      });
      if (!lineTarget.target) {
        return { diagnostics: lineTarget.diagnostics };
      }
      return {
        dimension: {
          id: dimension.id,
          kind: "lineLength",
          startPointId: lineTarget.target.startPointId,
          endPointId: lineTarget.target.endPointId,
          value: cleanSketchNumber(effectiveValue)
        },
        diagnostics: []
      };
    }

    const solverValue =
      target.role === "diameter" ? effectiveValue / 2 : effectiveValue;
    if (target.entityKind === "circle") {
      const radiusId = scalarIds.get(target.entityId);
      if (!radiusId) {
        return {
          diagnostics: [
            createDimensionTargetDiagnostic(
              dimension,
              target.entityId,
              "Circle radius dimension target cannot be mapped to a solver scalar.",
              "circle radius scalar",
              "missing scalar"
            )
          ]
        };
      }
      return {
        dimension: {
          id: dimension.id,
          kind: "circleRadius",
          radiusId,
          value: cleanSketchNumber(solverValue)
        },
        diagnostics: []
      };
    }

    if (!arcIds.has(target.entityId)) {
      return {
        diagnostics: [
          createDimensionTargetDiagnostic(
            dimension,
            target.entityId,
            "Arc dimension target cannot be mapped to a solver arc variable.",
            "arc solver variable",
            "missing arc"
          )
        ]
      };
    }
    return {
      dimension: {
        id: dimension.id,
        kind: target.role === "sweep" ? "arcSweep" : "arcRadius",
        arcId: target.entityId,
        value: cleanSketchNumber(solverValue)
      },
      diagnostics: []
    };
  }

  if (dimension.target.kind === "pointPair") {
    const primary = mapDimensionPointTarget({
      dimension,
      sketch,
      pointTargetIds,
      arcIds,
      target: dimension.target.primary,
      label: "Primary point-pair"
    });
    const secondary = mapDimensionPointTarget({
      dimension,
      sketch,
      pointTargetIds,
      arcIds,
      target: dimension.target.secondary,
      label: "Secondary point-pair"
    });
    const diagnostics = [...primary.diagnostics, ...secondary.diagnostics];
    if (!primary.target || !secondary.target) {
      return { diagnostics };
    }
    if (dimension.target.measurement === "distance") {
      return {
        dimension: {
          id: dimension.id,
          kind: "pointDistance",
          primaryTarget: primary.target,
          secondaryTarget: secondary.target,
          value: cleanSketchNumber(effectiveValue)
        },
        diagnostics
      };
    }
    return {
      dimension: {
        id: dimension.id,
        kind: "pointComponent",
        primaryTarget: primary.target,
        secondaryTarget: secondary.target,
        axis: dimension.target.measurement,
        value: cleanSketchNumber(
          dimension.target.direction === "positive"
            ? effectiveValue
            : -effectiveValue
        )
      },
      diagnostics
    };
  }

  if (dimension.target.kind === "pointLineDistance") {
    const point = mapDimensionPointTarget({
      dimension,
      sketch,
      pointTargetIds,
      arcIds,
      target: dimension.target.point,
      label: "Point-line distance point"
    });
    const line = mapDimensionLineTarget({
      dimension,
      sketch,
      pointTargetIds,
      entityId: dimension.target.lineEntityId,
      label: "Point-line distance support"
    });
    const diagnostics = [...point.diagnostics, ...line.diagnostics];
    if (!point.target || !line.target) {
      return { diagnostics };
    }
    return {
      dimension: {
        id: dimension.id,
        kind: "pointLineDistance",
        pointTarget: point.target,
        lineTarget: line.target,
        side: dimension.target.side,
        value: cleanSketchNumber(effectiveValue)
      },
      diagnostics
    };
  }

  const primaryLine = mapDimensionLineTarget({
    dimension,
    sketch,
    pointTargetIds,
    entityId: dimension.target.primaryLineEntityId,
    label: "Primary line-angle"
  });
  const secondaryLine = mapDimensionLineTarget({
    dimension,
    sketch,
    pointTargetIds,
    entityId: dimension.target.secondaryLineEntityId,
    label: "Secondary line-angle"
  });
  const diagnostics = [
    ...primaryLine.diagnostics,
    ...secondaryLine.diagnostics
  ];
  if (!primaryLine.target || !secondaryLine.target) {
    return { diagnostics };
  }
  return {
    dimension: {
      id: dimension.id,
      kind: "lineAngle",
      primaryLineTarget: primaryLine.target,
      secondaryLineTarget: secondaryLine.target,
      sense: dimension.target.sense,
      value: cleanSketchNumber(effectiveValue)
    },
    diagnostics
  };
}

function getPrimaryDimensionEntityId(
  dimension: SketchDimensionSnapshotV22
): SketchEntityId {
  switch (dimension.target.kind) {
    case "entityScalar":
      return dimension.target.entityId;
    case "pointPair":
      return dimension.target.primary.entityId;
    case "pointLineDistance":
      return dimension.target.point.entityId;
    case "lineAngle":
      return dimension.target.primaryLineEntityId;
  }
}

function createDimensionTargetDiagnostic(
  dimension: SketchDimensionSnapshotV22,
  entityId: SketchEntityId,
  message: string,
  expected: string,
  received: string
): CadSketchSolverDiagnostic {
  return createMappingDiagnostic({
    code: "SKETCH_SOLVER_MISSING_TARGET",
    message,
    sketchId: dimension.sketchId,
    sketchDimensionId: dimension.id,
    sketchEntityId: entityId,
    expected,
    received
  });
}

function mapDimensionPointTarget({
  dimension,
  sketch,
  pointTargetIds,
  arcIds,
  target,
  label
}: {
  readonly dimension: SketchDimensionSnapshotV22;
  readonly sketch: SketchSolverPackageSketch;
  readonly pointTargetIds: ReadonlyMap<string, string>;
  readonly arcIds: ReadonlySet<SketchEntityId>;
  readonly target: SketchPointTargetV22;
  readonly label: string;
}): {
  readonly target?: SketchSolverPointTarget;
  readonly diagnostics: readonly CadSketchSolverDiagnostic[];
} {
  const entity = sketch.entities.get(target.entityId);
  if (!entity || entity.kind !== target.entityKind) {
    return {
      diagnostics: [
        createDimensionTargetDiagnostic(
          dimension,
          target.entityId,
          `${label} target does not match its declared sketch entity kind.`,
          `${target.entityKind}.${target.role}`,
          entity?.kind ?? "missing"
        )
      ]
    };
  }
  if (
    entity.kind === "line" &&
    getLineLength(entity) <= SKETCH_GEOMETRY_POLICY.linearTolerance
  ) {
    return {
      diagnostics: [
        createDimensionTargetDiagnostic(
          dimension,
          target.entityId,
          `${label} target cannot use an endpoint from a zero-length line.`,
          `line longer than ${SKETCH_GEOMETRY_POLICY.linearTolerance}`,
          "zero-length line"
        )
      ]
    };
  }
  const mapped = mapPointTarget(pointTargetIds, arcIds, target);
  return mapped
    ? { target: mapped, diagnostics: [] }
    : {
        diagnostics: [
          createDimensionTargetDiagnostic(
            dimension,
            target.entityId,
            `${label} target cannot be mapped to a solver point target.`,
            `${target.entityKind}.${target.role} solver point`,
            "missing point target"
          )
        ]
      };
}

function mapDimensionLineTarget({
  dimension,
  sketch,
  pointTargetIds,
  entityId,
  label
}: {
  readonly dimension: SketchDimensionSnapshotV22;
  readonly sketch: SketchSolverPackageSketch;
  readonly pointTargetIds: ReadonlyMap<string, string>;
  readonly entityId: SketchEntityId;
  readonly label: string;
}): {
  readonly target?: Extract<SketchSolverCurveTarget, { readonly kind: "line" }>;
  readonly diagnostics: readonly CadSketchSolverDiagnostic[];
} {
  const entity = sketch.entities.get(entityId);
  if (!entity || entity.kind !== "line") {
    return {
      diagnostics: [
        createDimensionTargetDiagnostic(
          dimension,
          entityId,
          `${label} target cannot be mapped to a solver line.`,
          "line entity",
          entity?.kind ?? "missing"
        )
      ]
    };
  }
  const length = getLineLength(entity);
  if (length <= SKETCH_GEOMETRY_POLICY.linearTolerance) {
    return {
      diagnostics: [
        createDimensionTargetDiagnostic(
          dimension,
          entityId,
          `${label} target cannot use a zero-length line.`,
          `line longer than ${SKETCH_GEOMETRY_POLICY.linearTolerance}`,
          String(cleanSketchNumber(length))
        )
      ]
    };
  }
  const startPointId = pointIdForTarget(pointTargetIds, {
    entityId,
    role: "start"
  });
  const endPointId = pointIdForTarget(pointTargetIds, {
    entityId,
    role: "end"
  });
  return startPointId && endPointId
    ? {
        target: { kind: "line", startPointId, endPointId },
        diagnostics: []
      }
    : {
        diagnostics: [
          createDimensionTargetDiagnostic(
            dimension,
            entityId,
            `${label} endpoints cannot be mapped to solver points.`,
            "line start and end solver points",
            "missing endpoint"
          )
        ]
      };
}

function getLineLength(
  line: Extract<SketchEntitySnapshot, { readonly kind: "line" }>
): number {
  return Math.hypot(line.end[0] - line.start[0], line.end[1] - line.start[1]);
}

function pointIdForTarget(
  pointTargetIds: ReadonlyMap<string, string>,
  target: Pick<SketchPointTargetV22, "entityId" | "role">
): string | undefined {
  return pointTargetIds.get(createPointTargetKey(target.entityId, target.role));
}

function mapPointTarget(
  pointTargetIds: ReadonlyMap<string, string>,
  arcIds: ReadonlySet<SketchEntityId>,
  target: SketchPointTarget | SketchPointTargetV22
): SketchSolverPointTarget | undefined {
  if (target.entityKind === "arc") {
    return arcIds.has(target.entityId)
      ? { kind: "arc", arcId: target.entityId, role: target.role }
      : undefined;
  }

  const pointId = pointIdForTarget(pointTargetIds, target);
  return pointId ? { kind: "point", pointId } : undefined;
}

function mapCurveTarget({
  sketch,
  pointTargetIds,
  scalarIds,
  arcIds,
  target
}: {
  readonly sketch: SketchSolverPackageSketch;
  readonly pointTargetIds: ReadonlyMap<string, string>;
  readonly scalarIds: ReadonlyMap<SketchEntityId, string>;
  readonly arcIds: ReadonlySet<SketchEntityId>;
  readonly target: SketchCurveConstraintTarget;
}): SketchSolverCurveTarget | undefined {
  const entity = sketch.entities.get(target.entityId);
  if (!entity || entity.kind !== target.entityKind) {
    return undefined;
  }

  if (target.entityKind === "arc") {
    return arcIds.has(target.entityId)
      ? { kind: "arc", arcId: target.entityId }
      : undefined;
  }

  if (target.entityKind === "line") {
    const startPointId = pointIdForTarget(pointTargetIds, {
      entityId: target.entityId,
      role: "start"
    });
    const endPointId = pointIdForTarget(pointTargetIds, {
      entityId: target.entityId,
      role: "end"
    });
    return startPointId && endPointId
      ? { kind: "line", startPointId, endPointId }
      : undefined;
  }

  const centerPointId = pointIdForTarget(pointTargetIds, {
    entityId: target.entityId,
    role: "center"
  });
  const radiusId = scalarIds.get(target.entityId);
  return centerPointId && radiusId
    ? { kind: "circle", centerPointId, radiusId }
    : undefined;
}

function mapRadiusCurveTarget(
  options: Parameters<typeof mapCurveTarget>[0]
): SketchSolverRadiusCurveTarget | undefined {
  const target = mapCurveTarget(options);
  return target?.kind === "circle" || target?.kind === "arc"
    ? target
    : undefined;
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
    case "SKETCH_TANGENCY_OUTSIDE_ARC":
      return "SKETCH_TANGENCY_OUTSIDE_ARC";
    case "SKETCH_ARC_SOLVE_BRANCH_INVALID":
      return "SKETCH_ARC_SOLVE_BRANCH_INVALID";
    case "SKETCH_ARC_DIMENSION_INVALID":
      return "SKETCH_ARC_DIMENSION_INVALID";
    case "SKETCH_DIMENSION_DISTANCE_INVALID":
      return "SKETCH_DIMENSION_DISTANCE_INVALID";
    case "SKETCH_DIMENSION_ANGLE_SENSE_INVALID":
      return "SKETCH_DIMENSION_ANGLE_SENSE_INVALID";
    case "SKETCH_SOLVER_INVALID_VALUE":
    case "SKETCH_SOLVER_NON_CONVERGENCE":
      return "SKETCH_SOLVER_FAILED";
  }
}

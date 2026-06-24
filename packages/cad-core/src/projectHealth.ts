import type {
  BodyId,
  CadAttachedSketchHealth,
  CadAuthoredChamferHealth,
  CadAuthoredExtrudeHealth,
  CadAuthoredFilletHealth,
  CadAuthoredHoleHealth,
  CadAuthoredRevolveHealth,
  CadBodyDerivedExactMetadataSnapshot,
  CadBodyTopologySnapshot,
  CadDependencyHealthIssue,
  CadDependencyHealthStatus,
  CadGeneratedEntityKind,
  CadGeneratedExtrudeFaceRole,
  CadNamedReferenceHealth,
  CadQueryError,
  CadParameterSnapshot,
  CadSketchConstraintHealth,
  CadSketchDimensionHealth,
  CadSketchEvaluationHealth,
  DocumentUnits,
  FeatureExtrudeOperationMode,
  FeatureExtrudeProfileKind,
  FeatureHoleDepthMode,
  FeatureHoleDirection,
  FeatureRevolveAxis,
  FeatureRevolveOperationMode,
  FeatureRevolveProfileKind,
  FeatureId,
  NamedGeneratedReferenceSnapshot,
  NamedReferenceName,
  ParameterId,
  PartId,
  ProjectHealthQueryResponse,
  SketchAttachmentSnapshot,
  SketchCompletenessIssue,
  SketchConstraintId,
  SketchConstraintIssue,
  SketchConstraintSnapshot,
  SketchDimensionIssue,
  SketchDimensionId,
  SketchDimensionSnapshot,
  SketchEntityId,
  SketchEntitySnapshot,
  SketchId,
  SketchPlane,
  CadTopologyIdentitySourceSnapshot
} from "@web-cad/cad-protocol";

import { createBodyTopology } from "./bodyTopology";
import {
  validateGeneratedReference,
  type GeneratedReferenceValidationError,
  type GeneratedReferencesDocument,
  type GeneratedReferencesExtrudeFeature,
  type GeneratedReferencesSketch
} from "./generatedReferences";
import {
  evaluateSketch,
  evaluateSketchConstraint,
  evaluateSketchDimension
} from "./sketchSolver";

export interface ProjectHealthOptions {
  readonly document: ProjectHealthDocument;
  readonly cadOpsVersion: ProjectHealthQueryResponse["cadOpsVersion"];
  readonly ownerPartId: PartId;
  readonly units: DocumentUnits;
  readonly bodyExists: (bodyId: BodyId) => boolean;
  readonly derivedExactMetadata?: readonly CadBodyDerivedExactMetadataSnapshot[];
}

export interface ProjectHealthDocument extends GeneratedReferencesDocument {
  readonly sketches: ReadonlyMap<SketchId, ProjectHealthSketch>;
  readonly features: ReadonlyMap<FeatureId, ProjectHealthFeature>;
  readonly parameters: ReadonlyMap<ParameterId, CadParameterSnapshot>;
  readonly sketchDimensions: ReadonlyMap<
    SketchDimensionId,
    SketchDimensionSnapshot
  >;
  readonly sketchConstraints: ReadonlyMap<
    SketchConstraintId,
    SketchConstraintSnapshot
  >;
  readonly namedReferences: ReadonlyMap<
    NamedReferenceName,
    NamedGeneratedReferenceSnapshot
  >;
  readonly topologyIdentity?: CadTopologyIdentitySourceSnapshot;
}

export interface ProjectHealthSketch extends GeneratedReferencesSketch {
  readonly id: SketchId;
  readonly name: string;
  readonly plane: SketchPlane;
  readonly attachment?: SketchAttachmentSnapshot;
  readonly entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>;
}

export type ProjectHealthFeature =
  | GeneratedReferencesExtrudeFeature
  | ProjectHealthRevolveFeature
  | ProjectHealthHoleFeature
  | ProjectHealthChamferFeature
  | ProjectHealthFilletFeature;

export interface ProjectHealthRevolveFeature {
  readonly id: FeatureId;
  readonly kind: "revolve";
  readonly bodyId: BodyId;
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
  readonly profileKind: FeatureRevolveProfileKind;
  readonly axis: FeatureRevolveAxis;
  readonly angleDegrees: number;
  readonly operationMode: FeatureRevolveOperationMode;
  readonly targetBodyId?: BodyId;
}

export interface ProjectHealthHoleFeature {
  readonly id: FeatureId;
  readonly kind: "hole";
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly sketchId: SketchId;
  readonly circleEntityId: SketchEntityId;
  readonly depthMode: FeatureHoleDepthMode;
  readonly depth?: number;
  readonly direction: FeatureHoleDirection;
}

export interface ProjectHealthChamferFeature {
  readonly id: FeatureId;
  readonly kind: "chamfer";
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly topologyAnchorId?: string;
  readonly distance: number;
}

export interface ProjectHealthFilletFeature {
  readonly id: FeatureId;
  readonly kind: "fillet";
  readonly bodyId: BodyId;
  readonly targetBodyId: BodyId;
  readonly edgeStableId?: string;
  readonly namedReference?: NamedReferenceName;
  readonly topologyAnchorId?: string;
  readonly radius: number;
}

export function createProjectHealth(
  options: ProjectHealthOptions
): ProjectHealthQueryResponse {
  const authoredFeatures = [...options.document.features.values()];
  const authoredExtrudes = authoredFeatures
    .filter(
      (feature): feature is GeneratedReferencesExtrudeFeature =>
        feature.kind === "extrude"
    )
    .map((feature) =>
      createAuthoredExtrudeHealth(options.document, feature, options)
    );
  const authoredRevolves = authoredFeatures
    .filter(
      (feature): feature is ProjectHealthRevolveFeature =>
        feature.kind === "revolve"
    )
    .map((feature) =>
      createAuthoredRevolveHealth(options.document, feature, options)
    );
  const authoredHoles = authoredFeatures
    .filter(
      (feature): feature is ProjectHealthHoleFeature => feature.kind === "hole"
    )
    .map((feature) =>
      createAuthoredHoleHealth(options.document, feature, options)
    );
  const authoredChamfers = authoredFeatures
    .filter(
      (feature): feature is ProjectHealthChamferFeature =>
        feature.kind === "chamfer"
    )
    .map((feature) =>
      createAuthoredChamferHealth(options.document, feature, options)
    );
  const authoredFillets = authoredFeatures
    .filter(
      (feature): feature is ProjectHealthFilletFeature =>
        feature.kind === "fillet"
    )
    .map((feature) =>
      createAuthoredFilletHealth(options.document, feature, options)
    );
  const attachedSketches = [...options.document.sketches.values()]
    .filter((sketch) => sketch.attachment !== undefined)
    .map((sketch) =>
      createAttachedSketchHealth(
        options.document,
        sketch,
        sketch.attachment as SketchAttachmentSnapshot,
        options
      )
    );
  const sketchDimensions = [...options.document.sketchDimensions.values()].map(
    (dimension) => createSketchDimensionHealth(options.document, dimension)
  );
  const sketchConstraints = [
    ...options.document.sketchConstraints.values()
  ].map((constraint) =>
    createSketchConstraintHealth(options.document, constraint)
  );
  const sketchEvaluations = [...options.document.sketches.values()].map(
    (sketch) => createSketchEvaluationHealth(options.document, sketch)
  );
  const namedReferences = [...options.document.namedReferences.values()].map(
    (reference) => createNamedReferenceHealth(reference, options)
  );
  const issueCount = [
    ...authoredExtrudes,
    ...authoredRevolves,
    ...authoredHoles,
    ...authoredChamfers,
    ...authoredFillets,
    ...attachedSketches,
    ...sketchEvaluations,
    ...sketchDimensions,
    ...sketchConstraints,
    ...namedReferences
  ].reduce((count, entry) => count + entry.issues.length, 0);

  return {
    ok: true,
    query: "project.health",
    cadOpsVersion: options.cadOpsVersion,
    status: combineHealthStatuses([
      ...authoredExtrudes.map((entry) => entry.status),
      ...authoredRevolves.map((entry) => entry.status),
      ...authoredHoles.map((entry) => entry.status),
      ...authoredChamfers.map((entry) => entry.status),
      ...authoredFillets.map((entry) => entry.status),
      ...attachedSketches.map((entry) => entry.status),
      ...sketchEvaluations.map((entry) => entry.status),
      ...sketchDimensions.map((entry) => entry.status),
      ...sketchConstraints.map((entry) => entry.status),
      ...namedReferences.map((entry) => entry.status)
    ]),
    issueCount,
    authoredExtrudeCount: authoredExtrudes.length,
    authoredRevolveCount: authoredRevolves.length,
    authoredHoleCount: authoredHoles.length,
    authoredChamferCount: authoredChamfers.length,
    authoredFilletCount: authoredFillets.length,
    attachedSketchCount: attachedSketches.length,
    sketchEvaluationCount: sketchEvaluations.length,
    sketchDimensionCount: sketchDimensions.length,
    sketchConstraintCount: sketchConstraints.length,
    namedReferenceCount: namedReferences.length,
    authoredExtrudes,
    authoredRevolves,
    authoredHoles,
    authoredChamfers,
    authoredFillets,
    attachedSketches,
    sketchEvaluations,
    sketchDimensions,
    sketchConstraints,
    namedReferences
  };
}

function createAuthoredExtrudeHealth(
  document: ProjectHealthDocument,
  feature: GeneratedReferencesExtrudeFeature,
  options: ProjectHealthOptions
): CadAuthoredExtrudeHealth {
  const issues: CadDependencyHealthIssue[] = [];
  const sketch = document.sketches.get(feature.sketchId);

  if (!sketch) {
    issues.push({
      code: "SKETCH_NOT_FOUND",
      message: `Source sketch does not exist for feature ${feature.id}: ${feature.sketchId}`,
      featureId: feature.id,
      bodyId: feature.bodyId,
      sketchId: feature.sketchId
    });
  } else {
    const entity = sketch.entities.get(feature.entityId);

    if (!entity) {
      issues.push({
        code: "SKETCH_ENTITY_NOT_FOUND",
        message: `Source sketch entity does not exist for feature ${feature.id}: ${feature.entityId}`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        sketchId: feature.sketchId,
        sketchEntityId: feature.entityId
      });
    } else if (!entityMatchesProfileKind(entity, feature.profileKind)) {
      issues.push({
        code: "PROFILE_KIND_MISMATCH",
        message: `Source sketch entity ${feature.entityId} is ${entity.kind}, but feature ${feature.id} expects ${feature.profileKind}.`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        sketchId: feature.sketchId,
        sketchEntityId: feature.entityId,
        expected: feature.profileKind,
        received: entity.kind
      });
    }
  }

  if (feature.operationMode === "add" || feature.operationMode === "cut") {
    const operationLabel = feature.operationMode === "add" ? "Add" : "Cut";

    if (!feature.targetBodyId) {
      issues.push({
        code: "BODY_NOT_FOUND",
        message: `${operationLabel} feature ${feature.id} is missing its target body.`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        expected: "targetBodyId",
        received: "missing"
      });
    } else {
      const targetFeature = [...document.features.values()].find(
        (candidate) => candidate.bodyId === feature.targetBodyId
      );

      if (!targetFeature) {
        issues.push({
          code: "BODY_NOT_FOUND",
          message: `${operationLabel} feature ${feature.id} targets a missing body: ${feature.targetBodyId}`,
          featureId: feature.id,
          bodyId: feature.targetBodyId
        });
      } else if (!isSupportedBooleanTarget(feature, targetFeature)) {
        issues.push({
          code: "UNSUPPORTED_BODY_REFERENCES",
          message: getUnsupportedBooleanFeatureMessage(feature.operationMode),
          featureId: feature.id,
          bodyId: feature.targetBodyId,
          expected:
            feature.operationMode === "add"
              ? "rectangle newBody target"
              : "rectangle or circle newBody target",
          received: describeFeatureForHealth(targetFeature)
        });
      }
    }
  }

  const topology = createBodyTopology({
    document,
    bodyId: feature.bodyId,
    units: options.units,
    ownerPartId: options.ownerPartId,
    derivedExactMetadata: getDerivedExactMetadataForBody(
      options,
      feature.bodyId
    ),
    bodyExists: options.bodyExists
  });
  const topologySnapshot = topology.ok ? topology.topology : undefined;

  return {
    featureId: feature.id,
    bodyId: feature.bodyId,
    sketchId: feature.sketchId,
    entityId: feature.entityId,
    profileKind: feature.profileKind,
    operationMode: feature.operationMode,
    ...(feature.targetBodyId ? { targetBodyId: feature.targetBodyId } : {}),
    ...(feature.targetTopologyAnchorId
      ? { targetTopologyAnchorId: feature.targetTopologyAnchorId }
      : {}),
    ...(topologySnapshot
      ? {
          topologyStatus: topologySnapshot.status,
          topologyModel: topologySnapshot.topologyModel,
          topologyAvailable: topologySnapshot.topologyAvailable,
          exactMeasurementsAvailable:
            topologySnapshot.exactMeasurementsAvailable,
          measurementConfidence: topologySnapshot.measurementConfidence,
          topologyIssueCount: topologySnapshot.issues.length
        }
      : {}),
    status: statusFromIssues(issues),
    issues
  };
}

function createAuthoredRevolveHealth(
  document: ProjectHealthDocument,
  feature: ProjectHealthRevolveFeature,
  options: ProjectHealthOptions
): CadAuthoredRevolveHealth {
  const issues: CadDependencyHealthIssue[] = [];
  const sketch = document.sketches.get(feature.sketchId);

  if (!sketch) {
    issues.push({
      code: "SKETCH_NOT_FOUND",
      message: `Source sketch does not exist for revolve feature ${feature.id}: ${feature.sketchId}`,
      featureId: feature.id,
      bodyId: feature.bodyId,
      sketchId: feature.sketchId
    });
  } else {
    const entity = sketch.entities.get(feature.entityId);

    if (!entity) {
      issues.push({
        code: "SKETCH_ENTITY_NOT_FOUND",
        message: `Source sketch entity does not exist for revolve feature ${feature.id}: ${feature.entityId}`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        sketchId: feature.sketchId,
        sketchEntityId: feature.entityId
      });
    } else if (!entityMatchesProfileKind(entity, feature.profileKind)) {
      issues.push({
        code: "PROFILE_KIND_MISMATCH",
        message: `Source sketch entity ${feature.entityId} is ${entity.kind}, but revolve feature ${feature.id} expects ${feature.profileKind}.`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        sketchId: feature.sketchId,
        sketchEntityId: feature.entityId,
        expected: feature.profileKind,
        received: entity.kind
      });
    }

    const axisEntity = sketch.entities.get(feature.axis.entityId);

    if (feature.axis.sketchId !== feature.sketchId) {
      issues.push({
        code: "UNSUPPORTED_BODY_REFERENCES",
        message: `Revolve feature ${feature.id} axis must reference the same sketch.`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        sketchId: feature.sketchId,
        sketchEntityId: feature.axis.entityId,
        expected: feature.sketchId,
        received: feature.axis.sketchId
      });
    } else if (!axisEntity) {
      issues.push({
        code: "SKETCH_ENTITY_NOT_FOUND",
        message: `Revolve axis line does not exist for feature ${feature.id}: ${feature.axis.entityId}`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        sketchId: feature.sketchId,
        sketchEntityId: feature.axis.entityId
      });
    } else if (axisEntity.kind !== "line") {
      issues.push({
        code: "UNSUPPORTED_BODY_REFERENCES",
        message: `Revolve axis entity ${feature.axis.entityId} is ${axisEntity.kind}, but feature ${feature.id} expects a line.`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        sketchId: feature.sketchId,
        sketchEntityId: feature.axis.entityId,
        expected: "line",
        received: axisEntity.kind
      });
    }
  }

  const topology = createBodyTopology({
    document,
    bodyId: feature.bodyId,
    units: options.units,
    ownerPartId: options.ownerPartId,
    derivedExactMetadata: getDerivedExactMetadataForBody(
      options,
      feature.bodyId
    ),
    bodyExists: options.bodyExists
  });
  const topologySnapshot = topology.ok ? topology.topology : undefined;

  return {
    featureId: feature.id,
    bodyId: feature.bodyId,
    sketchId: feature.sketchId,
    entityId: feature.entityId,
    profileKind: feature.profileKind,
    axis: feature.axis,
    angleDegrees: feature.angleDegrees,
    operationMode: feature.operationMode,
    ...(feature.targetBodyId ? { targetBodyId: feature.targetBodyId } : {}),
    ...(topologySnapshot
      ? {
          topologyStatus: topologySnapshot.status,
          topologyModel: topologySnapshot.topologyModel,
          topologyAvailable: topologySnapshot.topologyAvailable,
          exactMeasurementsAvailable:
            topologySnapshot.exactMeasurementsAvailable,
          measurementConfidence: topologySnapshot.measurementConfidence,
          topologyIssueCount: topologySnapshot.issues.length
        }
      : {}),
    status: statusFromIssues(issues),
    issues
  };
}

function createAuthoredHoleHealth(
  document: ProjectHealthDocument,
  feature: ProjectHealthHoleFeature,
  options: ProjectHealthOptions
): CadAuthoredHoleHealth {
  const issues: CadDependencyHealthIssue[] = [];
  const sketch = document.sketches.get(feature.sketchId);

  if (!sketch) {
    issues.push({
      code: "SKETCH_NOT_FOUND",
      message: `Source sketch does not exist for hole feature ${feature.id}: ${feature.sketchId}`,
      featureId: feature.id,
      bodyId: feature.bodyId,
      sketchId: feature.sketchId
    });
  } else {
    const entity = sketch.entities.get(feature.circleEntityId);

    if (!entity) {
      issues.push({
        code: "SKETCH_ENTITY_NOT_FOUND",
        message: `Hole circle entity does not exist for feature ${feature.id}: ${feature.circleEntityId}`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        sketchId: feature.sketchId,
        sketchEntityId: feature.circleEntityId
      });
    } else if (entity.kind !== "circle") {
      issues.push({
        code: "PROFILE_KIND_MISMATCH",
        message: `Hole source entity ${feature.circleEntityId} is ${entity.kind}, but feature ${feature.id} expects circle.`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        sketchId: feature.sketchId,
        sketchEntityId: feature.circleEntityId,
        expected: "circle",
        received: entity.kind
      });
    } else if (!Number.isFinite(entity.radius) || entity.radius <= 0) {
      issues.push({
        code: "PROFILE_KIND_MISMATCH",
        message: `Hole source circle ${feature.circleEntityId} must have a positive radius.`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        sketchId: feature.sketchId,
        sketchEntityId: feature.circleEntityId,
        expected: "positive radius",
        received: String(entity.radius)
      });
    }

    if (sketch.attachment?.kind === "generatedFace") {
      const validation = validateGeneratedReference({
        document,
        ownerPartId: options.ownerPartId,
        bodyId: sketch.attachment.bodyId,
        stableId: sketch.attachment.faceStableId,
        bodyExists: options.bodyExists,
        expectedKind: "face",
        requiredOperation: "feature.attachSketchPlane"
      });

      if (!validation.ok) {
        issues.push(
          createIssueFromGeneratedReferenceError(validation.error, {
            sketchId: sketch.id,
            bodyId: sketch.attachment.bodyId,
            stableId: sketch.attachment.faceStableId
          })
        );
      }
    } else if (sketch.attachment?.kind === "topologyAnchorFace") {
      const attachment = sketch.attachment;
      const anchor = document.topologyIdentity?.anchors.find(
        (candidate) => candidate.anchorId === attachment.topologyAnchorId
      );
      const checkpoint = document.topologyIdentity?.checkpoints.find(
        (candidate) => candidate.checkpointId === attachment.checkpointId
      );

      if (
        !anchor ||
        !checkpoint ||
        anchor.state !== "active" ||
        checkpoint.status !== "active" ||
        anchor.entityKind !== "face"
      ) {
        issues.push({
          code: "ATTACHMENT_SOURCE_MISMATCH",
          message: `Hole sketch ${sketch.id} topology anchor attachment does not resolve to an active face checkpoint.`,
          featureId: feature.id,
          bodyId: attachment.bodyId,
          sketchId: sketch.id,
          expected: "active face topology anchor and checkpoint",
          received: [
            attachment.topologyAnchorId,
            anchor?.state ?? "missing-anchor",
            attachment.checkpointId,
            checkpoint?.status ?? "missing-checkpoint",
            anchor?.entityKind ?? "missing-kind"
          ].join(":")
        });
      }
    }
  }

  const targetFeature = [...document.features.values()].find(
    (candidate) => candidate.bodyId === feature.targetBodyId
  );

  if (!targetFeature) {
    issues.push({
      code: "BODY_NOT_FOUND",
      message: `Hole feature ${feature.id} targets a missing body: ${feature.targetBodyId}`,
      featureId: feature.id,
      bodyId: feature.targetBodyId
    });
  } else if (targetFeature.id === feature.id) {
    issues.push({
      code: "UNSUPPORTED_BODY_REFERENCES",
      message: `Hole feature ${feature.id} cannot target its own result body.`,
      featureId: feature.id,
      bodyId: feature.targetBodyId
    });
  } else if (!isSupportedHoleTargetFeature(targetFeature)) {
    issues.push({
      code: "UNSUPPORTED_BODY_REFERENCES",
      message:
        "Hole features currently support circular tools cutting one active rectangle or circle newBody extrude target body.",
      featureId: feature.id,
      bodyId: feature.targetBodyId,
      expected: "active rectangle/circle newBody extrude target body",
      received: describeFeatureForHealth(targetFeature)
    });
  } else {
    const consumedBy = [...document.features.values()].find(
      (candidate) =>
        candidate.id !== feature.id &&
        isTargetConsumingProjectHealthFeature(candidate) &&
        candidate.targetBodyId === feature.targetBodyId
    );

    if (consumedBy) {
      issues.push({
        code: "UNSUPPORTED_BODY_REFERENCES",
        message: `Hole feature ${feature.id} targets body ${feature.targetBodyId}, but that body is already consumed by feature ${consumedBy.id}.`,
        featureId: feature.id,
        bodyId: feature.targetBodyId,
        expected: "active authored target body",
        received: consumedBy.id
      });
    }
  }

  if (feature.depthMode === "blind") {
    if (feature.depth === undefined || feature.depth <= 0) {
      issues.push({
        code: "UNSUPPORTED_BODY_REFERENCES",
        message: `Blind hole feature ${feature.id} must have a positive depth.`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        expected: "positive finite depth",
        received:
          feature.depth === undefined ? "missing" : String(feature.depth)
      });
    }
  } else if (feature.depth !== undefined) {
    issues.push({
      code: "UNSUPPORTED_BODY_REFERENCES",
      message: `throughAll hole feature ${feature.id} must not include depth.`,
      featureId: feature.id,
      bodyId: feature.bodyId,
      expected: "omitted depth",
      received: String(feature.depth)
    });
  }

  const topology = createBodyTopology({
    document,
    bodyId: feature.bodyId,
    units: options.units,
    ownerPartId: options.ownerPartId,
    derivedExactMetadata: getDerivedExactMetadataForBody(
      options,
      feature.bodyId
    ),
    bodyExists: options.bodyExists
  });
  const topologySnapshot = topology.ok ? topology.topology : undefined;

  return {
    featureId: feature.id,
    bodyId: feature.bodyId,
    targetBodyId: feature.targetBodyId,
    sketchId: feature.sketchId,
    circleEntityId: feature.circleEntityId,
    depthMode: feature.depthMode,
    ...(feature.depth !== undefined ? { depth: feature.depth } : {}),
    direction: feature.direction,
    ...(topologySnapshot
      ? {
          topologyStatus: topologySnapshot.status,
          topologyModel: topologySnapshot.topologyModel,
          topologyAvailable: topologySnapshot.topologyAvailable,
          exactMeasurementsAvailable:
            topologySnapshot.exactMeasurementsAvailable,
          measurementConfidence: topologySnapshot.measurementConfidence,
          topologyIssueCount: topologySnapshot.issues.length
        }
      : {}),
    status: statusFromIssues(issues),
    issues
  };
}

function createAuthoredChamferHealth(
  document: ProjectHealthDocument,
  feature: ProjectHealthChamferFeature,
  options: ProjectHealthOptions
): CadAuthoredChamferHealth {
  const { issues, topologySnapshot } = createEdgeFinishHealth(
    document,
    feature,
    "feature.chamfer",
    options
  );

  return {
    featureId: feature.id,
    bodyId: feature.bodyId,
    targetBodyId: feature.targetBodyId,
    ...(feature.edgeStableId ? { edgeStableId: feature.edgeStableId } : {}),
    ...(feature.namedReference
      ? { namedReference: feature.namedReference }
      : {}),
    ...(feature.topologyAnchorId
      ? { topologyAnchorId: feature.topologyAnchorId }
      : {}),
    distance: feature.distance,
    ...(topologySnapshot
      ? {
          topologyStatus: topologySnapshot.status,
          topologyModel: topologySnapshot.topologyModel,
          topologyAvailable: topologySnapshot.topologyAvailable,
          exactMeasurementsAvailable:
            topologySnapshot.exactMeasurementsAvailable,
          measurementConfidence: topologySnapshot.measurementConfidence,
          topologyIssueCount: topologySnapshot.issues.length
        }
      : {}),
    status: statusFromIssues(issues),
    issues
  };
}

function createAuthoredFilletHealth(
  document: ProjectHealthDocument,
  feature: ProjectHealthFilletFeature,
  options: ProjectHealthOptions
): CadAuthoredFilletHealth {
  const { issues, topologySnapshot } = createEdgeFinishHealth(
    document,
    feature,
    "feature.fillet",
    options
  );

  return {
    featureId: feature.id,
    bodyId: feature.bodyId,
    targetBodyId: feature.targetBodyId,
    ...(feature.edgeStableId ? { edgeStableId: feature.edgeStableId } : {}),
    ...(feature.namedReference
      ? { namedReference: feature.namedReference }
      : {}),
    ...(feature.topologyAnchorId
      ? { topologyAnchorId: feature.topologyAnchorId }
      : {}),
    radius: feature.radius,
    ...(topologySnapshot
      ? {
          topologyStatus: topologySnapshot.status,
          topologyModel: topologySnapshot.topologyModel,
          topologyAvailable: topologySnapshot.topologyAvailable,
          exactMeasurementsAvailable:
            topologySnapshot.exactMeasurementsAvailable,
          measurementConfidence: topologySnapshot.measurementConfidence,
          topologyIssueCount: topologySnapshot.issues.length
        }
      : {}),
    status: statusFromIssues(issues),
    issues
  };
}

function createEdgeFinishHealth(
  document: ProjectHealthDocument,
  feature: ProjectHealthChamferFeature | ProjectHealthFilletFeature,
  operation: "feature.chamfer" | "feature.fillet",
  options: ProjectHealthOptions
): {
  readonly issues: readonly CadDependencyHealthIssue[];
  readonly topologySnapshot?: CadBodyTopologySnapshot;
} {
  const issues: CadDependencyHealthIssue[] = [];
  const targetFeature = [...document.features.values()].find(
    (candidate) => candidate.bodyId === feature.targetBodyId
  );

  if (!targetFeature) {
    issues.push({
      code: "BODY_NOT_FOUND",
      message: `${formatEdgeFinishFeatureLabel(feature)} ${feature.id} targets a missing body: ${feature.targetBodyId}`,
      featureId: feature.id,
      bodyId: feature.targetBodyId
    });
  } else if (targetFeature.id === feature.id) {
    issues.push({
      code: "UNSUPPORTED_BODY_REFERENCES",
      message: `${formatEdgeFinishFeatureLabel(feature)} ${feature.id} cannot target its own result body.`,
      featureId: feature.id,
      bodyId: feature.targetBodyId
    });
  } else if (!isSupportedEdgeFinishTargetFeature(targetFeature)) {
    issues.push({
      code: "UNSUPPORTED_BODY_REFERENCES",
      message: `${formatEdgeFinishFeatureLabel(feature)} features currently support one stable generated edge on an active rectangle or circle newBody extrude target body.`,
      featureId: feature.id,
      bodyId: feature.targetBodyId,
      expected: "active rectangle/circle newBody extrude target body",
      received: describeFeatureForHealth(targetFeature)
    });
  } else {
    const consumedBy = [...document.features.values()].find(
      (candidate) =>
        candidate.id !== feature.id &&
        isTargetConsumingProjectHealthFeature(candidate) &&
        candidate.targetBodyId === feature.targetBodyId
    );

    if (consumedBy) {
      issues.push({
        code: "UNSUPPORTED_BODY_REFERENCES",
        message: `${formatEdgeFinishFeatureLabel(feature)} ${feature.id} targets body ${feature.targetBodyId}, but that body is already consumed by feature ${consumedBy.id}.`,
        featureId: feature.id,
        bodyId: feature.targetBodyId,
        expected: "active authored target body",
        received: consumedBy.id
      });
    }
  }

  const stableId = resolveEdgeFinishStableId(document, feature, issues);

  if (stableId) {
    const validation = validateGeneratedReference({
      document,
      ownerPartId: options.ownerPartId,
      bodyId: feature.targetBodyId,
      stableId,
      bodyExists: options.bodyExists,
      expectedKind: "edge",
      requiredOperation: operation
    });

    if (!validation.ok) {
      issues.push(
        createIssueFromGeneratedReferenceError(validation.error, {
          bodyId: feature.targetBodyId,
          stableId,
          referenceName: feature.namedReference
        })
      );
    }
  }

  const scalar = feature.kind === "chamfer" ? feature.distance : feature.radius;

  if (!Number.isFinite(scalar) || scalar <= 0) {
    issues.push({
      code: "UNSUPPORTED_BODY_REFERENCES",
      message: `${formatEdgeFinishFeatureLabel(feature)} ${feature.id} requires a positive finite ${feature.kind === "chamfer" ? "distance" : "radius"}.`,
      featureId: feature.id,
      bodyId: feature.bodyId,
      expected: "positive finite number",
      received: String(scalar)
    });
  }

  const topology = createBodyTopology({
    document,
    bodyId: feature.bodyId,
    units: options.units,
    ownerPartId: options.ownerPartId,
    derivedExactMetadata: getDerivedExactMetadataForBody(
      options,
      feature.bodyId
    ),
    bodyExists: options.bodyExists
  });

  return {
    issues,
    ...(topology.ok ? { topologySnapshot: topology.topology } : {})
  };
}

function getDerivedExactMetadataForBody(
  options: ProjectHealthOptions,
  bodyId: BodyId
): CadBodyDerivedExactMetadataSnapshot | undefined {
  return options.derivedExactMetadata?.find(
    (snapshot) => snapshot.bodyId === bodyId
  );
}

function resolveEdgeFinishStableId(
  document: ProjectHealthDocument,
  feature: ProjectHealthChamferFeature | ProjectHealthFilletFeature,
  issues: CadDependencyHealthIssue[]
): string | undefined {
  if (feature.edgeStableId) {
    return feature.edgeStableId;
  }

  if (!feature.namedReference) {
    issues.push({
      code: "GENERATED_REFERENCE_NOT_FOUND",
      message: `${formatEdgeFinishFeatureLabel(feature)} ${feature.id} is missing edgeStableId or namedReference.`,
      featureId: feature.id,
      bodyId: feature.targetBodyId,
      expected: "edgeStableId or namedReference",
      received: "missing"
    });
    return undefined;
  }

  const reference = document.namedReferences.get(feature.namedReference);

  if (!reference) {
    issues.push({
      code: "NAMED_REFERENCE_NOT_FOUND",
      message: `Named reference does not exist: ${feature.namedReference}`,
      featureId: feature.id,
      bodyId: feature.targetBodyId,
      referenceName: feature.namedReference
    });
    return undefined;
  }

  if (reference.bodyId !== feature.targetBodyId) {
    issues.push({
      code: "GENERATED_REFERENCE_NOT_FOUND",
      message: `Named reference ${feature.namedReference} resolves to body ${reference.bodyId}, not target body ${feature.targetBodyId}.`,
      featureId: feature.id,
      bodyId: feature.targetBodyId,
      stableId: reference.stableId,
      referenceName: feature.namedReference,
      expected: feature.targetBodyId,
      received: reference.bodyId
    });
    return undefined;
  }

  return reference.stableId;
}

function formatEdgeFinishFeatureLabel(
  feature: ProjectHealthChamferFeature | ProjectHealthFilletFeature
): "Chamfer" | "Fillet" {
  return feature.kind === "chamfer" ? "Chamfer" : "Fillet";
}

function createAttachedSketchHealth(
  document: ProjectHealthDocument,
  sketch: ProjectHealthSketch,
  attachment: SketchAttachmentSnapshot,
  options: ProjectHealthOptions
): CadAttachedSketchHealth {
  if (attachment.kind === "topologyAnchorFace") {
    const issues: CadDependencyHealthIssue[] = [];
    const anchor = document.topologyIdentity?.anchors.find(
      (candidate) => candidate.anchorId === attachment.topologyAnchorId
    );
    const checkpoint = document.topologyIdentity?.checkpoints.find(
      (candidate) => candidate.checkpointId === attachment.checkpointId
    );
    const resolves =
      Boolean(anchor) &&
      Boolean(checkpoint) &&
      anchor?.state === "active" &&
      checkpoint?.status === "active" &&
      anchor?.bodyId === attachment.bodyId &&
      anchor?.checkpointId === attachment.checkpointId &&
      anchor?.entityKind === "face";

    if (!resolves) {
      issues.push({
        code: "ATTACHMENT_SOURCE_MISMATCH",
        message: `Sketch attachment ${sketch.id} topology anchor does not resolve to an active face checkpoint.`,
        sketchId: sketch.id,
        bodyId: attachment.bodyId,
        expected: "active face topology anchor and checkpoint",
        received: [
          attachment.topologyAnchorId,
          anchor?.state ?? "missing-anchor",
          attachment.checkpointId,
          checkpoint?.status ?? "missing-checkpoint",
          anchor?.entityKind ?? "missing-kind"
        ].join(":")
      });
    }

    return {
      sketchId: sketch.id,
      sketchName: sketch.name,
      plane: sketch.plane,
      attachmentKind: attachment.kind,
      bodyId: attachment.bodyId,
      topologyAnchorId: attachment.topologyAnchorId,
      checkpointId: attachment.checkpointId,
      planarAxis: attachment.planarAxis,
      planarCoordinate: attachment.planarCoordinate,
      status: statusFromIssues(issues),
      resolves,
      eligibleForSketchPlane: resolves,
      resolvedKind: "face",
      issues
    };
  }

  const issues: CadDependencyHealthIssue[] = [];
  const validation = validateGeneratedReference({
    document,
    ownerPartId: options.ownerPartId,
    bodyId: attachment.bodyId,
    stableId: attachment.faceStableId,
    bodyExists: options.bodyExists,
    expectedKind: "face",
    requiredOperation: "feature.attachSketchPlane"
  });

  let resolves = false;
  let eligibleForSketchPlane = false;
  let resolvedKind: CadGeneratedEntityKind | undefined;
  let resolvedFaceRole: CadGeneratedExtrudeFaceRole | undefined;

  if (!validation.ok) {
    issues.push(
      createIssueFromGeneratedReferenceError(validation.error, {
        sketchId: sketch.id,
        bodyId: attachment.bodyId,
        stableId: attachment.faceStableId
      })
    );
  } else {
    resolves = true;
    resolvedKind = validation.kind;
    eligibleForSketchPlane = validation.reference.eligibleOperations.includes(
      "feature.attachSketchPlane"
    );

    if (validation.reference.kind === "face") {
      resolvedFaceRole = validation.reference
        .role as CadGeneratedExtrudeFaceRole;

      if (
        validation.reference.sourceFeatureId !== attachment.sourceFeatureId ||
        validation.reference.sourceSketchId !== attachment.sourceSketchId ||
        validation.reference.sourceSketchEntityId !==
          attachment.sourceSketchEntityId ||
        validation.reference.role !== attachment.faceRole
      ) {
        issues.push({
          code: "ATTACHMENT_SOURCE_MISMATCH",
          message: `Sketch attachment ${sketch.id} resolves to generated face metadata that does not match the saved attachment metadata.`,
          sketchId: sketch.id,
          bodyId: attachment.bodyId,
          stableId: attachment.faceStableId,
          expected: [
            attachment.sourceFeatureId,
            attachment.sourceSketchId,
            attachment.sourceSketchEntityId,
            attachment.faceRole
          ].join(":"),
          received: [
            validation.reference.sourceFeatureId,
            validation.reference.sourceSketchId,
            validation.reference.sourceSketchEntityId,
            validation.reference.role
          ].join(":")
        });
      }
    }
  }

  return {
    sketchId: sketch.id,
    sketchName: sketch.name,
    plane: sketch.plane,
    attachmentKind: attachment.kind,
    bodyId: attachment.bodyId,
    faceStableId: attachment.faceStableId,
    sourceFeatureId: attachment.sourceFeatureId,
    sourceSketchId: attachment.sourceSketchId,
    sourceSketchEntityId: attachment.sourceSketchEntityId,
    faceRole: attachment.faceRole,
    status: statusFromIssues(issues),
    resolves,
    eligibleForSketchPlane,
    ...(resolvedKind ? { resolvedKind } : {}),
    ...(resolvedFaceRole ? { resolvedFaceRole } : {}),
    issues
  };
}

function createSketchDimensionHealth(
  document: ProjectHealthDocument,
  dimension: SketchDimensionSnapshot
): CadSketchDimensionHealth {
  const entry = evaluateSketchDimension(document, dimension);
  const issues = entry.issues.map(createIssueFromSketchDimensionIssue);
  const parameterId =
    dimension.valueSource.type === "parameter"
      ? dimension.valueSource.parameterId
      : undefined;

  const affected = collectSketchDimensionAffectedFeatures(
    document,
    dimension.sketchId,
    dimension.entityId
  );

  return {
    dimensionId: dimension.id,
    dimensionName: dimension.name,
    sketchId: dimension.sketchId,
    entityId: dimension.entityId,
    target: dimension.target,
    valueSource: dimension.valueSource,
    status: statusFromIssues(issues),
    affectedFeatureIds: affected.featureIds,
    affectedBodyIds: affected.bodyIds,
    ...(entry.effectiveValue !== undefined
      ? { effectiveValue: entry.effectiveValue }
      : {}),
    ...(parameterId ? { parameterId } : {}),
    issues
  };
}

function createSketchEvaluationHealth(
  document: ProjectHealthDocument,
  sketch: ProjectHealthSketch
): CadSketchEvaluationHealth {
  const evaluation = evaluateSketch(document, sketch);
  const issues = evaluation.issues
    .filter(isSketchCompletenessIssue)
    .map(createIssueFromSketchCompletenessIssue);
  const affected = collectSketchEntityAffectedFeatures(
    document,
    getSketchEvaluationAffectedEntityIds(
      sketch,
      evaluation.drivenEntityIds
    ).map((entityId) => ({
      sketchId: sketch.id,
      entityId
    }))
  );

  return {
    sketchId: sketch.id,
    sketchName: sketch.name,
    plane: sketch.plane,
    status: statusFromSketchSolverStatus(evaluation.status, issues),
    drivenEntityIds: evaluation.drivenEntityIds,
    affectedFeatureIds: affected.featureIds,
    affectedBodyIds: affected.bodyIds,
    issues
  };
}

function getSketchEvaluationAffectedEntityIds(
  sketch: ProjectHealthSketch,
  drivenEntityIds: readonly SketchEntityId[]
): readonly SketchEntityId[] {
  const entityIds =
    drivenEntityIds.length > 0 ? drivenEntityIds : [...sketch.entities.keys()];

  return [...new Set(entityIds)];
}

function createSketchConstraintHealth(
  document: ProjectHealthDocument,
  constraint: SketchConstraintSnapshot
): CadSketchConstraintHealth {
  const entry = evaluateSketchConstraint(document, constraint);
  const issues = entry.issues.map(createIssueFromSketchConstraintIssue);
  const affected = collectSketchEntityAffectedFeatures(
    document,
    getSketchConstraintAffectedTargets(constraint)
  );

  return {
    constraintId: constraint.id,
    constraintName: constraint.name,
    sketchId: constraint.sketchId,
    entityId: constraint.entityId,
    kind: constraint.kind,
    status: statusFromIssues(issues),
    affectedFeatureIds: affected.featureIds,
    affectedBodyIds: affected.bodyIds,
    ...(constraint.kind === "fixed" ? { target: constraint.target } : {}),
    ...(constraint.kind === "coincident"
      ? {
          primaryTarget: constraint.primaryTarget,
          secondaryTarget: constraint.secondaryTarget
        }
      : {}),
    ...(constraint.kind === "midpoint"
      ? {
          lineEntityId: constraint.lineEntityId,
          target: constraint.target
        }
      : {}),
    ...(isLinePairSketchConstraint(constraint)
      ? {
          primaryLineEntityId: constraint.primaryLineEntityId,
          secondaryLineEntityId: constraint.secondaryLineEntityId
        }
      : {}),
    ...(constraint.kind === "tangent"
      ? {
          primaryCurveTarget: constraint.primaryTarget,
          secondaryCurveTarget: constraint.secondaryTarget
        }
      : {}),
    ...(constraint.kind === "concentric"
      ? {
          primaryCircleEntityId: constraint.primaryCircleEntityId,
          secondaryCircleEntityId: constraint.secondaryCircleEntityId
        }
      : {}),
    ...(constraint.kind === "equalLength"
      ? {
          primaryLineEntityId: constraint.primaryLineEntityId,
          secondaryLineEntityId: constraint.secondaryLineEntityId
        }
      : {}),
    ...(constraint.kind === "equalRadius"
      ? {
          primaryCircleEntityId: constraint.primaryCircleEntityId,
          secondaryCircleEntityId: constraint.secondaryCircleEntityId
        }
      : {}),
    ...(constraint.kind === "angle"
      ? {
          primaryLineEntityId: constraint.primaryLineEntityId,
          secondaryLineEntityId: constraint.secondaryLineEntityId,
          angleDegrees: constraint.angleDegrees
        }
      : {}),
    ...(constraint.kind === "symmetry"
      ? {
          primaryTarget: constraint.primaryTarget,
          secondaryTarget: constraint.secondaryTarget,
          symmetryLineEntityId: constraint.symmetryLineEntityId
        }
      : {}),
    ...(entry.primaryDirection
      ? { primaryDirection: entry.primaryDirection }
      : {}),
    ...(entry.secondaryDirection
      ? { secondaryDirection: entry.secondaryDirection }
      : {}),
    ...(entry.currentCoordinate
      ? { currentCoordinate: entry.currentCoordinate }
      : {}),
    ...(entry.primaryCurrentCoordinate
      ? { primaryCurrentCoordinate: entry.primaryCurrentCoordinate }
      : {}),
    ...(entry.secondaryCurrentCoordinate
      ? { secondaryCurrentCoordinate: entry.secondaryCurrentCoordinate }
      : {}),
    ...(entry.resolvedCoordinate
      ? { resolvedCoordinate: entry.resolvedCoordinate }
      : {}),
    issues
  };
}

function createNamedReferenceHealth(
  reference: NamedGeneratedReferenceSnapshot,
  options: ProjectHealthOptions
): CadNamedReferenceHealth {
  const issues: CadDependencyHealthIssue[] = [];
  const validation = validateGeneratedReference({
    document: options.document,
    ownerPartId: options.ownerPartId,
    bodyId: reference.bodyId,
    stableId: reference.stableId,
    bodyExists: options.bodyExists
  });

  let resolvedKind: CadGeneratedEntityKind | undefined;

  if (!validation.ok) {
    issues.push(
      createIssueFromGeneratedReferenceError(validation.error, {
        bodyId: reference.bodyId,
        stableId: reference.stableId,
        referenceName: reference.name
      })
    );
  } else {
    resolvedKind = validation.kind;

    if (validation.kind !== reference.kind) {
      issues.push({
        code: "NAMED_REFERENCE_KIND_CHANGED",
        message: `Named reference ${reference.name} resolved as ${validation.kind}, but was created as ${reference.kind}.`,
        bodyId: reference.bodyId,
        stableId: reference.stableId,
        referenceName: reference.name,
        expected: reference.kind,
        received: validation.kind
      });
    }
  }

  return {
    name: reference.name,
    bodyId: reference.bodyId,
    stableId: reference.stableId,
    kind: reference.kind,
    ...(reference.topologyAnchorId
      ? { topologyAnchorId: reference.topologyAnchorId }
      : {}),
    status: statusFromIssues(issues),
    ...(resolvedKind ? { resolvedKind } : {}),
    issues
  };
}

function collectSketchDimensionAffectedFeatures(
  document: ProjectHealthDocument,
  sketchId: SketchId,
  entityId: SketchEntityId
): {
  readonly featureIds: readonly FeatureId[];
  readonly bodyIds: readonly BodyId[];
} {
  return collectSketchEntityAffectedFeatures(document, [
    { sketchId, entityId }
  ]);
}

function collectSketchEntityAffectedFeatures(
  document: ProjectHealthDocument,
  targets: readonly {
    readonly sketchId: SketchId;
    readonly entityId: SketchEntityId;
  }[]
): {
  readonly featureIds: readonly FeatureId[];
  readonly bodyIds: readonly BodyId[];
} {
  const featureIds = new Set<FeatureId>();
  const bodyIds = new Set<BodyId>();

  for (const feature of document.features.values()) {
    if (
      hasSketchEntitySource(feature) &&
      targets.some(
        (target) =>
          feature.sketchId === target.sketchId &&
          getProjectHealthFeaturePrimaryEntityId(feature) === target.entityId
      )
    ) {
      featureIds.add(feature.id);
      bodyIds.add(feature.bodyId);
    }
  }

  let changed = true;

  while (changed) {
    changed = false;

    for (const feature of document.features.values()) {
      if (
        !isTargetConsumingProjectHealthFeature(feature) ||
        !bodyIds.has(feature.targetBodyId) ||
        featureIds.has(feature.id)
      ) {
        continue;
      }

      featureIds.add(feature.id);
      bodyIds.add(feature.bodyId);
      changed = true;
    }
  }

  return {
    featureIds: [...featureIds],
    bodyIds: [...bodyIds]
  };
}

function getProjectHealthFeaturePrimaryEntityId(
  feature: Exclude<
    ProjectHealthFeature,
    ProjectHealthChamferFeature | ProjectHealthFilletFeature
  >
): SketchEntityId {
  return feature.kind === "hole" ? feature.circleEntityId : feature.entityId;
}

function hasSketchEntitySource(
  feature: ProjectHealthFeature
): feature is Exclude<
  ProjectHealthFeature,
  ProjectHealthChamferFeature | ProjectHealthFilletFeature
> {
  return feature.kind !== "chamfer" && feature.kind !== "fillet";
}

function isTargetConsumingProjectHealthFeature(
  feature: ProjectHealthFeature
): feature is Extract<ProjectHealthFeature, { readonly targetBodyId: BodyId }> {
  return (
    (feature.kind === "extrude" &&
      (feature.operationMode === "add" || feature.operationMode === "cut") &&
      feature.targetBodyId !== undefined) ||
    feature.kind === "hole" ||
    feature.kind === "chamfer" ||
    feature.kind === "fillet"
  );
}

function getSketchConstraintAffectedTargets(
  constraint: SketchConstraintSnapshot
): readonly {
  readonly sketchId: SketchId;
  readonly entityId: SketchEntityId;
}[] {
  if (constraint.kind === "fixed") {
    return [
      {
        sketchId: constraint.sketchId,
        entityId: constraint.target.entityId
      }
    ];
  }

  if (constraint.kind === "coincident") {
    return [
      {
        sketchId: constraint.sketchId,
        entityId: constraint.primaryTarget.entityId
      },
      {
        sketchId: constraint.sketchId,
        entityId: constraint.secondaryTarget.entityId
      }
    ];
  }

  if (constraint.kind === "midpoint") {
    return [
      { sketchId: constraint.sketchId, entityId: constraint.lineEntityId },
      { sketchId: constraint.sketchId, entityId: constraint.target.entityId }
    ];
  }

  if (isLinePairSketchConstraint(constraint)) {
    return [
      {
        sketchId: constraint.sketchId,
        entityId: constraint.primaryLineEntityId
      },
      {
        sketchId: constraint.sketchId,
        entityId: constraint.secondaryLineEntityId
      }
    ];
  }

  if (constraint.kind === "tangent") {
    return [
      {
        sketchId: constraint.sketchId,
        entityId: constraint.primaryTarget.entityId
      },
      {
        sketchId: constraint.sketchId,
        entityId: constraint.secondaryTarget.entityId
      }
    ];
  }

  if (constraint.kind === "concentric" || constraint.kind === "equalRadius") {
    return [
      {
        sketchId: constraint.sketchId,
        entityId: constraint.primaryCircleEntityId
      },
      {
        sketchId: constraint.sketchId,
        entityId: constraint.secondaryCircleEntityId
      }
    ];
  }

  if (constraint.kind === "equalLength" || constraint.kind === "angle") {
    return [
      {
        sketchId: constraint.sketchId,
        entityId: constraint.primaryLineEntityId
      },
      {
        sketchId: constraint.sketchId,
        entityId: constraint.secondaryLineEntityId
      }
    ];
  }

  if (constraint.kind === "symmetry") {
    return [
      {
        sketchId: constraint.sketchId,
        entityId: constraint.primaryTarget.entityId
      },
      {
        sketchId: constraint.sketchId,
        entityId: constraint.secondaryTarget.entityId
      },
      {
        sketchId: constraint.sketchId,
        entityId: constraint.symmetryLineEntityId
      }
    ];
  }

  return [{ sketchId: constraint.sketchId, entityId: constraint.entityId }];
}

function isLinePairSketchConstraint(
  constraint: SketchConstraintSnapshot
): constraint is Extract<
  SketchConstraintSnapshot,
  { readonly kind: "parallel" | "perpendicular" }
> {
  return constraint.kind === "parallel" || constraint.kind === "perpendicular";
}

function createIssueFromGeneratedReferenceError(
  error: GeneratedReferenceValidationError,
  context: {
    readonly sketchId?: SketchId;
    readonly bodyId?: BodyId;
    readonly stableId?: string;
    readonly referenceName?: NamedReferenceName;
  }
): CadDependencyHealthIssue {
  const queryError = createQueryErrorFromGeneratedReferenceError(error);

  return {
    code: error.code,
    message: queryError.message,
    ...(context.sketchId ? { sketchId: context.sketchId } : {}),
    bodyId: context.bodyId ?? queryError.bodyId,
    ...((context.stableId ?? queryError.stableId)
      ? { stableId: context.stableId ?? queryError.stableId }
      : {}),
    ...(context.referenceName ? { referenceName: context.referenceName } : {}),
    ...(error.expectedKind ? { expected: error.expectedKind } : {}),
    ...(error.actualKind ? { received: error.actualKind } : {}),
    ...(error.requiredOperation ? { expected: error.requiredOperation } : {})
  };
}

function createIssueFromSketchDimensionIssue(
  issue: SketchDimensionIssue
): CadDependencyHealthIssue {
  return {
    code: mapSketchDimensionIssueCode(issue.code),
    message: issue.message,
    ...(issue.parameterId ? { parameterId: issue.parameterId } : {}),
    ...(issue.sketchDimensionId
      ? { sketchDimensionId: issue.sketchDimensionId }
      : {}),
    ...(issue.sketchId ? { sketchId: issue.sketchId } : {}),
    ...(issue.sketchEntityId ? { sketchEntityId: issue.sketchEntityId } : {}),
    ...(issue.expected ? { expected: issue.expected } : {}),
    ...(issue.received ? { received: issue.received } : {})
  };
}

function mapSketchDimensionIssueCode(
  code: SketchDimensionIssue["code"]
): CadDependencyHealthIssue["code"] {
  switch (code) {
    case "PARAMETER_NOT_FOUND":
    case "SKETCH_NOT_FOUND":
    case "SKETCH_ENTITY_NOT_FOUND":
      return code;

    case "UNSUPPORTED_TARGET":
      return "UNSUPPORTED_SKETCH_DIMENSION_TARGET";

    case "INVALID_VALUE":
      return "INVALID_SKETCH_DIMENSION_VALUE";

    case "INCONSISTENT_CONSTRAINT":
      return "INCONSISTENT_SKETCH_CONSTRAINT";
  }
}

function isSketchCompletenessIssue(
  issue: SketchDimensionIssue | SketchConstraintIssue | SketchCompletenessIssue
): issue is SketchCompletenessIssue {
  return (
    issue.code === "UNDER_DEFINED_SKETCH" ||
    issue.code === "OVER_DEFINED_SKETCH"
  );
}

function createIssueFromSketchCompletenessIssue(
  issue: SketchCompletenessIssue
): CadDependencyHealthIssue {
  return {
    code: issue.code,
    message: issue.message,
    sketchId: issue.sketchId,
    ...(issue.expected ? { expected: issue.expected } : {}),
    ...(issue.received ? { received: issue.received } : {})
  };
}

function createIssueFromSketchConstraintIssue(
  issue: SketchConstraintIssue
): CadDependencyHealthIssue {
  return {
    code: mapSketchConstraintIssueCode(issue.code),
    message: issue.message,
    ...(issue.sketchConstraintId
      ? { sketchConstraintId: issue.sketchConstraintId }
      : {}),
    ...(issue.sketchId ? { sketchId: issue.sketchId } : {}),
    ...(issue.sketchEntityId ? { sketchEntityId: issue.sketchEntityId } : {}),
    ...(issue.sketchPointTarget
      ? { sketchPointTarget: issue.sketchPointTarget }
      : {}),
    ...(issue.primaryTarget ? { primaryTarget: issue.primaryTarget } : {}),
    ...(issue.secondaryTarget
      ? { secondaryTarget: issue.secondaryTarget }
      : {}),
    ...(issue.lineEntityId ? { lineEntityId: issue.lineEntityId } : {}),
    ...(issue.expected ? { expected: issue.expected } : {}),
    ...(issue.received ? { received: issue.received } : {})
  };
}

function mapSketchConstraintIssueCode(
  code: SketchConstraintIssue["code"]
): CadDependencyHealthIssue["code"] {
  switch (code) {
    case "SKETCH_NOT_FOUND":
    case "SKETCH_ENTITY_NOT_FOUND":
      return code;

    case "UNSUPPORTED_TARGET":
      return "UNSUPPORTED_SKETCH_CONSTRAINT_TARGET";

    case "INVALID_VALUE":
      return "INVALID_SKETCH_CONSTRAINT_VALUE";

    case "INCONSISTENT_CONSTRAINT":
      return "INCONSISTENT_SKETCH_CONSTRAINT";

    case "CONFLICTING_CONSTRAINT":
      return "CONFLICTING_SKETCH_CONSTRAINT";
  }
}

function createQueryErrorFromGeneratedReferenceError(
  error: GeneratedReferenceValidationError
): CadQueryError {
  return {
    code:
      error.code === "GENERATED_REFERENCE_KIND_MISMATCH" ||
      error.code === "GENERATED_REFERENCE_OPERATION_NOT_ELIGIBLE"
        ? "GENERATED_REFERENCE_NOT_FOUND"
        : error.code,
    message: error.message,
    bodyId: error.bodyId,
    stableId: error.stableId
  };
}

function entityMatchesProfileKind(
  entity: SketchEntitySnapshot,
  profileKind: FeatureExtrudeProfileKind
): boolean {
  return (
    (profileKind === "rectangle" && entity.kind === "rectangle") ||
    (profileKind === "circle" && entity.kind === "circle")
  );
}

function isSupportedCutTargetProfileKind(
  profileKind: FeatureExtrudeProfileKind
): boolean {
  return profileKind === "rectangle" || profileKind === "circle";
}

function isSupportedAddTargetProfileKind(
  profileKind: FeatureExtrudeProfileKind
): boolean {
  return profileKind === "rectangle";
}

function isSupportedBooleanTarget(
  feature: GeneratedReferencesExtrudeFeature,
  targetFeature: ProjectHealthFeature
): boolean {
  if (
    targetFeature.kind !== "extrude" ||
    feature.profileKind !== "rectangle" ||
    targetFeature.operationMode !== "newBody"
  ) {
    return false;
  }

  if (feature.operationMode === "add") {
    return isSupportedAddTargetProfileKind(targetFeature.profileKind);
  }

  return isSupportedCutTargetProfileKind(targetFeature.profileKind);
}

function isSupportedHoleTargetFeature(feature: ProjectHealthFeature): boolean {
  return isSupportedEdgeFinishTargetFeature(feature);
}

function isSupportedEdgeFinishTargetFeature(
  feature: ProjectHealthFeature
): boolean {
  return (
    feature.kind === "extrude" &&
    feature.operationMode === "newBody" &&
    isSupportedCutTargetProfileKind(feature.profileKind)
  );
}

function describeFeatureForHealth(feature: ProjectHealthFeature): string {
  if (feature.kind === "hole") {
    return "hole result";
  }

  if (feature.kind === "chamfer") {
    return "chamfer result";
  }

  if (feature.kind === "fillet") {
    return "fillet result";
  }

  if (feature.kind === "revolve") {
    return `${feature.profileKind} revolve`;
  }

  return `${feature.profileKind} ${feature.operationMode}`;
}

function getUnsupportedBooleanFeatureMessage(
  operationMode: FeatureExtrudeOperationMode
): string {
  if (operationMode === "add") {
    return "Add features currently require a rectangle source and an active rectangle newBody target body.";
  }

  return "Cut features currently require a rectangle source and an active rectangle or circle newBody target body.";
}

function statusFromIssues(
  issues: readonly CadDependencyHealthIssue[]
): CadDependencyHealthStatus {
  if (issues.length === 0) {
    return "healthy";
  }

  return combineHealthStatuses(issues.map((issue) => statusFromIssue(issue)));
}

function combineHealthStatuses(
  statuses: readonly CadDependencyHealthStatus[]
): CadDependencyHealthStatus {
  if (statuses.includes("missing-source")) {
    return "missing-source";
  }

  if (statuses.includes("stale")) {
    return "stale";
  }

  if (statuses.includes("unsupported")) {
    return "unsupported";
  }

  if (statuses.includes("over-defined")) {
    return "over-defined";
  }

  if (statuses.includes("under-defined")) {
    return "under-defined";
  }

  return "healthy";
}

function statusFromSketchSolverStatus(
  status: "healthy" | "under-defined" | "over-defined" | string,
  issues: readonly CadDependencyHealthIssue[]
): CadDependencyHealthStatus {
  if (status === "under-defined" || status === "over-defined") {
    return status;
  }

  return statusFromIssues(issues);
}

function statusFromIssue(
  issue: Pick<CadDependencyHealthIssue, "code">
): CadDependencyHealthStatus {
  switch (issue.code) {
    case "PARAMETER_NOT_FOUND":
    case "SKETCH_NOT_FOUND":
    case "SKETCH_ENTITY_NOT_FOUND":
      return "missing-source";

    case "PROFILE_KIND_MISMATCH":
    case "UNSUPPORTED_SKETCH_DIMENSION_TARGET":
    case "INVALID_SKETCH_DIMENSION_VALUE":
    case "UNSUPPORTED_SKETCH_CONSTRAINT_TARGET":
    case "INVALID_SKETCH_CONSTRAINT_VALUE":
    case "INCONSISTENT_SKETCH_CONSTRAINT":
    case "CONFLICTING_SKETCH_CONSTRAINT":
    case "UNSUPPORTED_BODY_REFERENCES":
    case "GENERATED_REFERENCE_KIND_MISMATCH":
    case "GENERATED_REFERENCE_OPERATION_NOT_ELIGIBLE":
      return "unsupported";

    case "OVER_DEFINED_SKETCH":
      return "over-defined";

    case "UNDER_DEFINED_SKETCH":
      return "under-defined";

    case "BODY_NOT_FOUND":
    case "GENERATED_REFERENCE_NOT_FOUND":
    case "ATTACHMENT_SOURCE_MISMATCH":
    case "NAMED_REFERENCE_KIND_CHANGED":
    case "NAMED_REFERENCE_NOT_FOUND":
      return "stale";
  }
}

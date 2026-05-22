import type {
  BodyId,
  CadAttachedSketchHealth,
  CadAuthoredExtrudeHealth,
  CadDependencyHealthIssue,
  CadDependencyHealthStatus,
  CadGeneratedEntityKind,
  CadGeneratedExtrudeFaceRole,
  CadNamedReferenceHealth,
  CadQueryError,
  CadParameterSnapshot,
  CadSketchDimensionHealth,
  FeatureExtrudeProfileKind,
  FeatureId,
  NamedGeneratedReferenceSnapshot,
  NamedReferenceName,
  ParameterId,
  PartId,
  ProjectHealthQueryResponse,
  SketchAttachmentSnapshot,
  SketchDimensionId,
  SketchDimensionSnapshot,
  SketchDimensionTarget,
  SketchEntityId,
  SketchEntitySnapshot,
  SketchId,
  SketchPlane
} from "@web-cad/cad-protocol";

import {
  validateGeneratedReference,
  type GeneratedReferenceValidationError,
  type GeneratedReferencesDocument,
  type GeneratedReferencesFeature,
  type GeneratedReferencesSketch
} from "./generatedReferences";

export interface ProjectHealthOptions {
  readonly document: ProjectHealthDocument;
  readonly cadOpsVersion: ProjectHealthQueryResponse["cadOpsVersion"];
  readonly ownerPartId: PartId;
  readonly bodyExists: (bodyId: BodyId) => boolean;
}

export interface ProjectHealthDocument extends GeneratedReferencesDocument {
  readonly sketches: ReadonlyMap<SketchId, ProjectHealthSketch>;
  readonly features: ReadonlyMap<FeatureId, ProjectHealthFeature>;
  readonly parameters: ReadonlyMap<ParameterId, CadParameterSnapshot>;
  readonly sketchDimensions: ReadonlyMap<
    SketchDimensionId,
    SketchDimensionSnapshot
  >;
  readonly namedReferences: ReadonlyMap<
    NamedReferenceName,
    NamedGeneratedReferenceSnapshot
  >;
}

export interface ProjectHealthSketch extends GeneratedReferencesSketch {
  readonly id: SketchId;
  readonly name: string;
  readonly plane: SketchPlane;
  readonly attachment?: SketchAttachmentSnapshot;
  readonly entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>;
}

export type ProjectHealthFeature = GeneratedReferencesFeature;

export function createProjectHealth(
  options: ProjectHealthOptions
): ProjectHealthQueryResponse {
  const authoredExtrudes = [...options.document.features.values()].map(
    (feature) => createAuthoredExtrudeHealth(options.document, feature)
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
  const namedReferences = [...options.document.namedReferences.values()].map(
    (reference) => createNamedReferenceHealth(reference, options)
  );
  const issueCount = [
    ...authoredExtrudes,
    ...attachedSketches,
    ...sketchDimensions,
    ...namedReferences
  ].reduce((count, entry) => count + entry.issues.length, 0);

  return {
    ok: true,
    query: "project.health",
    cadOpsVersion: options.cadOpsVersion,
    status: combineHealthStatuses([
      ...authoredExtrudes.map((entry) => entry.status),
      ...attachedSketches.map((entry) => entry.status),
      ...sketchDimensions.map((entry) => entry.status),
      ...namedReferences.map((entry) => entry.status)
    ]),
    issueCount,
    authoredExtrudeCount: authoredExtrudes.length,
    attachedSketchCount: attachedSketches.length,
    sketchDimensionCount: sketchDimensions.length,
    namedReferenceCount: namedReferences.length,
    authoredExtrudes,
    attachedSketches,
    sketchDimensions,
    namedReferences
  };
}

function createAuthoredExtrudeHealth(
  document: ProjectHealthDocument,
  feature: ProjectHealthFeature
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
          received: `${targetFeature.profileKind} ${targetFeature.operationMode}`
        });
      }
    }
  }

  return {
    featureId: feature.id,
    bodyId: feature.bodyId,
    sketchId: feature.sketchId,
    entityId: feature.entityId,
    profileKind: feature.profileKind,
    operationMode: feature.operationMode,
    ...(feature.targetBodyId ? { targetBodyId: feature.targetBodyId } : {}),
    status: statusFromIssues(issues),
    issues
  };
}

function createAttachedSketchHealth(
  document: ProjectHealthDocument,
  sketch: ProjectHealthSketch,
  attachment: SketchAttachmentSnapshot,
  options: ProjectHealthOptions
): CadAttachedSketchHealth {
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
      resolvedFaceRole = validation.reference.role;

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
  const issues: CadDependencyHealthIssue[] = [];
  const sketch = document.sketches.get(dimension.sketchId);
  const parameterId =
    dimension.valueSource.type === "parameter"
      ? dimension.valueSource.parameterId
      : undefined;
  let entity: SketchEntitySnapshot | undefined;
  let effectiveValue: number | undefined;

  if (!sketch) {
    issues.push({
      code: "SKETCH_NOT_FOUND",
      message: `Sketch dimension ${dimension.id} targets a missing sketch: ${dimension.sketchId}`,
      sketchDimensionId: dimension.id,
      sketchId: dimension.sketchId,
      sketchEntityId: dimension.entityId
    });
  } else {
    entity = sketch.entities.get(dimension.entityId);

    if (!entity) {
      issues.push({
        code: "SKETCH_ENTITY_NOT_FOUND",
        message: `Sketch dimension ${dimension.id} targets a missing sketch entity: ${dimension.entityId}`,
        sketchDimensionId: dimension.id,
        sketchId: dimension.sketchId,
        sketchEntityId: dimension.entityId
      });
    } else if (!isSupportedSketchDimensionTarget(dimension.target, entity)) {
      issues.push({
        code: "UNSUPPORTED_SKETCH_DIMENSION_TARGET",
        message: `Sketch dimension ${dimension.id} target ${formatDimensionTarget(
          dimension.target
        )} is not supported by ${entity.kind} entity ${entity.id}.`,
        sketchDimensionId: dimension.id,
        sketchId: dimension.sketchId,
        sketchEntityId: dimension.entityId,
        expected: `target for ${entity.kind}`,
        received: formatDimensionTarget(dimension.target)
      });
    }
  }

  const resolvedValue = resolveSketchDimensionHealthValue(document, dimension);

  if (!resolvedValue.ok) {
    issues.push(resolvedValue.issue);
  } else {
    effectiveValue = resolvedValue.value;

    if (!Number.isFinite(effectiveValue) || effectiveValue <= 0) {
      issues.push({
        code: "INVALID_SKETCH_DIMENSION_VALUE",
        message: `Sketch dimension ${dimension.id} has an invalid effective value: ${effectiveValue}`,
        parameterId,
        sketchDimensionId: dimension.id,
        sketchId: dimension.sketchId,
        sketchEntityId: dimension.entityId,
        expected: "positive finite number",
        received: String(effectiveValue)
      });
    }
  }

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
    ...(effectiveValue !== undefined ? { effectiveValue } : {}),
    ...(parameterId ? { parameterId } : {}),
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
    status: statusFromIssues(issues),
    ...(resolvedKind ? { resolvedKind } : {}),
    issues
  };
}

function resolveSketchDimensionHealthValue(
  document: ProjectHealthDocument,
  dimension: SketchDimensionSnapshot
):
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly issue: CadDependencyHealthIssue } {
  if (dimension.valueSource.type === "literal") {
    return { ok: true, value: dimension.valueSource.value };
  }

  const parameter = document.parameters.get(dimension.valueSource.parameterId);

  if (!parameter) {
    return {
      ok: false,
      issue: {
        code: "PARAMETER_NOT_FOUND",
        message: `Sketch dimension ${dimension.id} references a missing parameter: ${dimension.valueSource.parameterId}`,
        parameterId: dimension.valueSource.parameterId,
        sketchDimensionId: dimension.id,
        sketchId: dimension.sketchId,
        sketchEntityId: dimension.entityId
      }
    };
  }

  return { ok: true, value: parameter.value };
}

function collectSketchDimensionAffectedFeatures(
  document: ProjectHealthDocument,
  sketchId: SketchId,
  entityId: SketchEntityId
): {
  readonly featureIds: readonly FeatureId[];
  readonly bodyIds: readonly BodyId[];
} {
  const directFeatures = [...document.features.values()].filter(
    (feature) => feature.sketchId === sketchId && feature.entityId === entityId
  );
  const featureIds = new Set<FeatureId>(
    directFeatures.map((feature) => feature.id)
  );
  const bodyIds = new Set<BodyId>(
    directFeatures.map((feature) => feature.bodyId)
  );

  for (const feature of document.features.values()) {
    if (
      feature.operationMode === "newBody" ||
      !feature.targetBodyId ||
      !bodyIds.has(feature.targetBodyId)
    ) {
      continue;
    }

    featureIds.add(feature.id);
    bodyIds.add(feature.bodyId);
  }

  return {
    featureIds: [...featureIds],
    bodyIds: [...bodyIds]
  };
}

function isSupportedSketchDimensionTarget(
  target: SketchDimensionTarget,
  entity: SketchEntitySnapshot
): boolean {
  if (entity.kind === "rectangle") {
    return target.entityKind === "rectangle";
  }

  if (entity.kind === "circle") {
    return target.entityKind === "circle";
  }

  return false;
}

function formatDimensionTarget(target: SketchDimensionTarget): string {
  return `${target.entityKind}.${target.role}`;
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
  feature: ProjectHealthFeature,
  targetFeature: ProjectHealthFeature
): boolean {
  if (
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

function getUnsupportedBooleanFeatureMessage(
  operationMode: ProjectHealthFeature["operationMode"]
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

  return "healthy";
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
    case "UNSUPPORTED_BODY_REFERENCES":
    case "GENERATED_REFERENCE_KIND_MISMATCH":
    case "GENERATED_REFERENCE_OPERATION_NOT_ELIGIBLE":
      return "unsupported";

    case "BODY_NOT_FOUND":
    case "GENERATED_REFERENCE_NOT_FOUND":
    case "ATTACHMENT_SOURCE_MISMATCH":
    case "NAMED_REFERENCE_KIND_CHANGED":
      return "stale";
  }
}

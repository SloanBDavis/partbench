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
  FeatureExtrudeProfileKind,
  FeatureId,
  NamedGeneratedReferenceSnapshot,
  NamedReferenceName,
  PartId,
  ProjectHealthQueryResponse,
  SketchAttachmentSnapshot,
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
  const namedReferences = [...options.document.namedReferences.values()].map(
    (reference) => createNamedReferenceHealth(reference, options)
  );
  const issueCount = [
    ...authoredExtrudes,
    ...attachedSketches,
    ...namedReferences
  ].reduce((count, entry) => count + entry.issues.length, 0);

  return {
    ok: true,
    query: "project.health",
    cadOpsVersion: options.cadOpsVersion,
    status: combineHealthStatuses([
      ...authoredExtrudes.map((entry) => entry.status),
      ...attachedSketches.map((entry) => entry.status),
      ...namedReferences.map((entry) => entry.status)
    ]),
    issueCount,
    authoredExtrudeCount: authoredExtrudes.length,
    attachedSketchCount: attachedSketches.length,
    namedReferenceCount: namedReferences.length,
    authoredExtrudes,
    attachedSketches,
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
    case "SKETCH_NOT_FOUND":
    case "SKETCH_ENTITY_NOT_FOUND":
      return "missing-source";

    case "PROFILE_KIND_MISMATCH":
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

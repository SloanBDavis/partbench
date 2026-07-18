import type {
  CadBatchValidationErrorCode,
  CadExactExportSweepBodySource,
  FeatureId,
  FeatureInputReferenceSemanticDiff,
  PartId,
  SketchEntityProfileRef,
  SketchPathDiagnosticCode,
  SketchPathRef,
  SweepFeatureV21
} from "@web-cad/cad-protocol";

import type { CadDocument } from "./index";
import { createSketchPathReadinessResponse } from "./sketchProfilePathQueries";
import { createSourceMeasurementFrame } from "./sourceMeasurementGeometry";

export type SweepResolution =
  | {
      readonly ok: true;
      readonly profile: SketchEntityProfileRef;
      readonly path: SketchPathRef;
      readonly pathKinds: readonly ("line" | "arc")[];
    }
  | {
      readonly ok: false;
      readonly code: CadBatchValidationErrorCode;
      readonly message: string;
      readonly sketchId?: string;
      readonly sketchEntityId?: string;
    };

/** Validates the complete V17 sweep profile/path support matrix. */
export function resolveSweep(
  document: CadDocument,
  profile: SketchEntityProfileRef,
  path: SketchPathRef
): SweepResolution {
  const profileSketch = document.sketches.get(profile.sketchId);
  const profileEntity = profileSketch?.entities.get(profile.entityId);
  if (!profileSketch || !profileEntity) {
    return {
      ok: false,
      code: "SWEEP_ENTITY_UNRESOLVED",
      message: "Sweep profile sketch or entity no longer resolves.",
      sketchId: profile.sketchId,
      sketchEntityId: profile.entityId
    };
  }
  if (profileEntity.kind !== "rectangle" && profileEntity.kind !== "circle") {
    return {
      ok: false,
      code: "SWEEP_PROFILE_UNSUPPORTED",
      message: "Sweep profile must be a rectangle or circle entity.",
      sketchId: profile.sketchId,
      sketchEntityId: profile.entityId
    };
  }
  if (profileEntity.construction) {
    return {
      ok: false,
      code: "SKETCH_PROFILE_CONSTRUCTION_ENTITY",
      message: "Sweep profile cannot use construction geometry.",
      sketchId: profile.sketchId,
      sketchEntityId: profile.entityId
    };
  }
  const pathEntityIds =
    path.kind === "entity"
      ? [path.entityId]
      : path.segments.map((segment) => segment.entityId);
  if (
    profile.sketchId === path.sketchId &&
    pathEntityIds.includes(profile.entityId)
  ) {
    return {
      ok: false,
      code: "SWEEP_PATH_UNSUPPORTED",
      message: "Sweep profile and path cannot identify the same sketch entity.",
      sketchId: path.sketchId,
      sketchEntityId: profile.entityId
    };
  }
  const pathSketch = document.sketches.get(path.sketchId);
  if (!pathSketch) {
    return {
      ok: false,
      code: "SWEEP_ENTITY_UNRESOLVED",
      message: "Sweep path sketch or entity no longer resolves.",
      sketchId: path.sketchId,
      sketchEntityId: pathEntityIds[0]
    };
  }
  const pathEntities = pathEntityIds.map((entityId) =>
    pathSketch.entities.get(entityId)
  );
  const missingIndex = pathEntities.findIndex((entity) => !entity);
  if (missingIndex >= 0) {
    return {
      ok: false,
      code: "SWEEP_ENTITY_UNRESOLVED",
      message: "Sweep path sketch or entity no longer resolves.",
      sketchId: path.sketchId,
      sketchEntityId: pathEntityIds[missingIndex]
    };
  }
  const unsupportedIndex = pathEntities.findIndex(
    (entity) => entity?.kind !== "line" && entity?.kind !== "arc"
  );
  if (unsupportedIndex >= 0) {
    return {
      ok: false,
      code: "SKETCH_PATH_ENTITY_UNSUPPORTED",
      message: "A single sweep path must be a line or circular arc entity.",
      sketchId: path.sketchId,
      sketchEntityId: pathEntityIds[unsupportedIndex]
    };
  }

  const pathKinds = pathEntities.map(
    (entity) => entity!.kind as "line" | "arc"
  );
  const needsV17FrameValidation =
    path.kind === "chain" || pathKinds.some((kind) => kind === "arc");

  const readiness = createSketchPathReadinessResponse(
    document,
    {
      query: "sketch.pathReadiness",
      path,
      ...(needsV17FrameValidation ? { sweepProfile: profile } : {})
    },
    "cadops.v1"
  );
  if (readiness.status !== "ready") {
    const diagnostic = readiness.diagnostics.find(
      (candidate) => candidate.severity === "blocker"
    );
    return {
      ok: false,
      code: mapPathDiagnosticToBatchError(diagnostic?.code),
      message: diagnostic?.message ?? "Sweep path is not feature-ready.",
      sketchId: diagnostic?.sketchId ?? path.sketchId,
      sketchEntityId: diagnostic?.entityId ?? pathEntityIds[0]
    };
  }

  return { ok: true, profile, path, pathKinds };
}

/** Resolves authoritative profile/path geometry and both sketch frames. */
export function createResolvedSweepSource(
  document: CadDocument,
  feature: SweepFeatureV21,
  ownerPartId: PartId,
  bodyName?: string
): CadExactExportSweepBodySource | undefined {
  const resolution = resolveSweep(document, feature.profile, feature.path);
  if (!resolution.ok) return undefined;
  const profileSketch = document.sketches.get(feature.profile.sketchId);
  const pathSketch = document.sketches.get(feature.path.sketchId);
  const profileEntity = profileSketch?.entities.get(feature.profile.entityId);
  if (
    !profileSketch ||
    !pathSketch ||
    !profileEntity ||
    (profileEntity.kind !== "rectangle" && profileEntity.kind !== "circle")
  ) {
    return undefined;
  }
  const profileFrame = createSourceMeasurementFrame(
    document,
    profileSketch,
    ownerPartId
  );
  const pathFrame = createSourceMeasurementFrame(
    document,
    pathSketch,
    ownerPartId
  );
  if (!profileFrame || !pathFrame) return undefined;
  const orientedRefs =
    resolution.path.kind === "entity"
      ? [resolution.path]
      : resolution.path.segments;
  const segments: CadExactExportSweepBodySource["path"]["segments"] =
    orientedRefs.map((reference) => {
      const entity = pathSketch.entities.get(reference.entityId)!;
      const forward = reference.orientation === "forward";
      if (entity.kind === "line") {
        return {
          kind: "line" as const,
          sourceEntityId: entity.id,
          start: forward ? entity.start : entity.end,
          end: forward ? entity.end : entity.start
        };
      }
      const arc = entity as Extract<typeof entity, { kind: "arc" }>;
      return {
        kind: "arc" as const,
        sourceEntityId: arc.id,
        center: arc.center,
        radius: arc.radius,
        startAngleDegrees: normalizeDegrees(
          forward
            ? arc.startAngleDegrees
            : arc.startAngleDegrees + arc.sweepAngleDegrees
        ),
        sweepAngleDegrees: forward
          ? arc.sweepAngleDegrees
          : -arc.sweepAngleDegrees
      };
    });
  const sourceIdentity = `partbench-sweep-path-v1:${JSON.stringify({
    profile: feature.profile,
    profileGeometry: profileEntity,
    profileFrame,
    path: feature.path,
    pathFrame,
    segments
  })}`;
  return {
    bodyId: feature.bodyId,
    ...(bodyName ? { bodyName } : {}),
    sourceKind: "authoredSweep",
    featureId: feature.id,
    profileSketchId: feature.profile.sketchId,
    profileEntityId: feature.profile.entityId,
    pathSketchId: feature.path.sketchId,
    pathEntityIds: orientedRefs.map((reference) => reference.entityId),
    profileFrame,
    profile:
      profileEntity.kind === "rectangle"
        ? {
            kind: "rectangle",
            center: profileEntity.center,
            width: profileEntity.width,
            height: profileEntity.height
          }
        : {
            kind: "circle",
            center: profileEntity.center,
            radius: profileEntity.radius
          },
    path: {
      frame: pathFrame,
      closed: false,
      segments,
      sourceIdentity
    },
    frameMode: "correctedFrenet",
    solidPolicy: "exactlyOne"
  };
}

/** @deprecated Compatibility alias retained for callers outside cad-core. */
export const resolveSingleEntitySweep = resolveSweep;

/** @deprecated Compatibility alias retained for callers outside cad-core. */
export const createResolvedSingleEntitySweepSource = createResolvedSweepSource;

export function createPathInputReference(
  featureId: FeatureId,
  after: SketchPathRef,
  before?: SketchPathRef
): FeatureInputReferenceSemanticDiff {
  const entityIds = (value: SketchPathRef): readonly string[] =>
    value.kind === "entity"
      ? [value.entityId]
      : value.segments.map((segment) => segment.entityId);
  return {
    featureId,
    inputKind: "path",
    ...(before ? { before } : {}),
    after,
    affectedSketchIds: [
      ...new Set([...(before ? [before.sketchId] : []), after.sketchId])
    ],
    affectedEntityIds: [
      ...new Set([...(before ? entityIds(before) : []), ...entityIds(after)])
    ]
  };
}

function normalizeDegrees(value: number): number {
  const normalized = ((value % 360) + 360) % 360;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function mapPathDiagnosticToBatchError(
  code: SketchPathDiagnosticCode | undefined
): CadBatchValidationErrorCode {
  if (code === "SKETCH_PATH_FRAME_INVALID") {
    return "SWEEP_PROFILE_PATH_FRAME_INVALID";
  }
  switch (code) {
    case "SKETCH_PATH_EMPTY":
    case "SKETCH_PATH_ENTITY_MISSING":
    case "SKETCH_PATH_ENTITY_UNSUPPORTED":
    case "SKETCH_PATH_ENTITY_REPEATED":
    case "SKETCH_PATH_DISCONNECTED":
    case "SKETCH_PATH_CLOSED_UNSUPPORTED":
    case "SKETCH_PATH_SELF_INTERSECTING":
    case "SKETCH_PATH_JOIN_NOT_TANGENT":
      return code;
    case "SKETCH_PATH_BRANCHING":
    case undefined:
      return "SWEEP_PATH_UNSUPPORTED";
  }
}

import type {
  CadBatchValidationErrorCode,
  CadExactExportResolvedSweepPathSegment,
  CadExactExportSweepBodySource,
  FeatureId,
  FeatureInputReferenceSemanticDiffCurrent,
  PartId,
  SketchPathDiagnosticCode,
  SketchPathRef,
  SketchProfileRefV22,
  SweepFeatureV21
} from "@web-cad/cad-protocol";

import type { CadDocument } from "./index";
import { createSketchPathReadinessResponse } from "./sketchProfilePathQueries";
import { resolveOrientedSketchSegment } from "./sketchWireGeometry";
import { createSourceMeasurementFrame } from "./sourceMeasurementGeometry";
import {
  mapRegionSourceIssueToBatchError,
  validateRegisteredV22RegionSource
} from "./v19RegionPolicyRegistry";

export type SweepPathEntityKind = "line" | "arc" | "spline";

export type SweepResolution =
  | {
      readonly ok: true;
      readonly profile: SketchProfileRefV22;
      readonly path: SketchPathRef;
      readonly pathKinds: readonly SweepPathEntityKind[];
    }
  | {
      readonly ok: false;
      readonly code: CadBatchValidationErrorCode;
      readonly message: string;
      readonly sketchId?: string;
      readonly sketchEntityId?: string;
    };

function profileEntityIds(profile: SketchProfileRefV22): readonly string[] {
  if (profile.kind === "entity") return [profile.entityId];
  if (profile.kind === "wire") {
    return profile.segments.map((segment) => segment.entityId);
  }
  return profile.regions.flatMap((region) =>
    [region.outer, ...region.holes].flatMap((loop) =>
      loop.kind === "entity"
        ? [loop.entityId]
        : loop.segments.map((segment) => segment.entityId)
    )
  );
}

export function resolveSweep(
  document: CadDocument,
  profile: SketchProfileRefV22,
  path: SketchPathRef
): SweepResolution {
  const profileSketch = document.sketches.get(profile.sketchId);
  if (!profileSketch) {
    return {
      ok: false,
      code: "SWEEP_ENTITY_UNRESOLVED",
      message: "Sweep profile sketch or entity no longer resolves.",
      sketchId: profile.sketchId
    };
  }
  if (profile.kind === "regions") {
    const validation = validateRegisteredV22RegionSource(profile, profileSketch);
    if (!validation.ok) {
      const issue = validation.issues[0];
      return {
        ok: false,
        code: mapRegionSourceIssueToBatchError(issue?.code),
        message: issue?.message ?? "Sweep regions profile is not feature-ready.",
        sketchId: profile.sketchId,
        sketchEntityId: issue?.entityId
      };
    }
    if (validation.normalizedProfile.regions.length !== 1) {
      return {
        ok: false,
        code: "SKETCH_REGION_CONSUMER_UNSUPPORTED",
        message: "A sweep regions profile accepts exactly one region.",
        sketchId: profile.sketchId
      };
    }
  } else if (profile.kind === "entity") {
    const profileEntity = profileSketch.entities.get(profile.entityId);
    if (!profileEntity) {
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
        message: "Sweep entity profile must be a rectangle or circle entity.",
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
  } else {
    return {
      ok: false,
      code: "SWEEP_PROFILE_UNSUPPORTED",
      message: "Sweep profile must be an entity or regions profile.",
      sketchId: profile.sketchId
    };
  }
  const pathEntityIds =
    path.kind === "entity"
      ? [path.entityId]
      : path.segments.map((segment) => segment.entityId);
  const overlapping = profileEntityIds(profile).some((entityId) =>
    pathEntityIds.includes(entityId)
  );
  if (profile.sketchId === path.sketchId && overlapping) {
    return {
      ok: false,
      code: "SWEEP_PATH_UNSUPPORTED",
      message: "Sweep profile and path cannot identify the same sketch entity.",
      sketchId: path.sketchId,
      sketchEntityId: profileEntityIds(profile)[0]
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
    (entity) =>
      entity?.kind !== "line" &&
      entity?.kind !== "arc" &&
      entity?.kind !== "spline"
  );
  if (unsupportedIndex >= 0) {
    return {
      ok: false,
      code: "SKETCH_PATH_ENTITY_UNSUPPORTED",
      message:
        "A sweep path must be a line, circular arc, or open spline entity.",
      sketchId: path.sketchId,
      sketchEntityId: pathEntityIds[unsupportedIndex]
    };
  }

  const pathKinds = pathEntities.map(
    (entity) => entity!.kind as SweepPathEntityKind
  );
  const needsV17FrameValidation =
    path.kind === "chain" ||
    pathKinds.some((kind) => kind === "arc" || kind === "spline");

  const readiness = createSketchPathReadinessResponse(
    document,
    {
      query: "sketch.pathReadiness",
      path,
      ...(needsV17FrameValidation && profile.kind === "entity"
        ? { sweepProfile: profile }
        : {})
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

export function createResolvedSweepSource(
  document: CadDocument,
  feature: SweepFeatureV21,
  ownerPartId: PartId,
  bodyName?: string
): CadExactExportSweepBodySource | undefined {
  const resolution = resolveSweep(document, feature.profile, feature.path);
  if (!resolution.ok) return undefined;
  if (feature.profile.kind !== "entity") return undefined;
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
  const segments: CadExactExportResolvedSweepPathSegment[] = [];
  for (const reference of orientedRefs) {
    const entity = pathSketch.entities.get(reference.entityId)!;
    const forward = reference.orientation === "forward";
    if (entity.kind === "line") {
      segments.push({
        kind: "line",
        sourceEntityId: entity.id,
        start: forward ? entity.start : entity.end,
        end: forward ? entity.end : entity.start
      });
      continue;
    }
    if (entity.kind === "spline") {
      const resolved = resolveOrientedSketchSegment(
        entity,
        reference.orientation
      );
      if (!resolved.ok || resolved.segment.kind !== "spline") {
        return undefined;
      }
      segments.push({
        kind: "spline",
        sourceEntityId: entity.id,
        points: resolved.segment.samples
      });
      continue;
    }
    if (entity.kind !== "arc") {
      return undefined;
    }
    segments.push({
      kind: "arc",
      sourceEntityId: entity.id,
      center: entity.center,
      radius: entity.radius,
      startAngleDegrees: normalizeDegrees(
        forward
          ? entity.startAngleDegrees
          : entity.startAngleDegrees + entity.sweepAngleDegrees
      ),
      sweepAngleDegrees: forward
        ? entity.sweepAngleDegrees
        : -entity.sweepAngleDegrees
    });
  }
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

export const resolveSingleEntitySweep = resolveSweep;

export const createResolvedSingleEntitySweepSource = createResolvedSweepSource;

export function createPathInputReference(
  featureId: FeatureId,
  after: SketchPathRef,
  before?: SketchPathRef
): FeatureInputReferenceSemanticDiffCurrent {
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

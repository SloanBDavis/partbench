import type {
  CadBatchValidationErrorCode,
  CadExactExportResolvedWireProfile,
  FeatureId,
  FeatureInputReferenceSemanticDiff,
  SketchProfileDiagnosticCode,
  SketchProfileRef,
  SketchWireProfileRef,
  PartId,
  SketchEntityId,
  SketchEntitySnapshot
} from "@web-cad/cad-protocol";

import type { CadDocument } from "./index";
import {
  createSketchProfileReadinessResponse,
  type SketchProfileReadinessDocument
} from "./sketchProfilePathQueries";
import { SKETCH_GEOMETRY_POLICY } from "./sketchGeometryPolicy";
import { createSourceMeasurementFrame } from "./sourceMeasurementGeometry";

export type WireExtrudeProfileResolution =
  | {
      readonly ok: true;
      readonly profile: SketchWireProfileRef;
      readonly orientationNormalized: boolean;
    }
  | {
      readonly ok: false;
      readonly code: CadBatchValidationErrorCode;
      readonly message: string;
      readonly sketchId?: string;
      readonly sketchEntityId?: string;
    };

/** Resolves the enabled V17 composite-profile extrude rows. */
export function resolveWireExtrudeProfile(
  document: SketchProfileReadinessDocument,
  profile: SketchWireProfileRef,
  operationMode: "newBody" | "add" | "cut",
  target?: {
    readonly targetBodyId?: string;
    readonly targetTopologyAnchorId?: string;
    readonly ignoreFeatureId?: string;
  }
): WireExtrudeProfileResolution {
  if (!document.sketches.has(profile.sketchId)) {
    return {
      ok: false,
      code: "SKETCH_NOT_FOUND",
      message: `Sketch does not exist: ${profile.sketchId}`,
      sketchId: profile.sketchId
    };
  }

  const consumer =
    operationMode === "newBody"
      ? {
          featureKind: "extrude" as const,
          operationMode: "newBody" as const
        }
      : {
          featureKind: "extrude" as const,
          operationMode,
          ...(target?.targetTopologyAnchorId
            ? { targetTopologyAnchorId: target.targetTopologyAnchorId }
            : target?.targetBodyId
              ? { targetBodyId: target.targetBodyId }
              : {})
        };
  const readinessDocument = {
    ...document,
    features: new Map(document.features)
  };
  if (target?.ignoreFeatureId) {
    readinessDocument.features.delete(target.ignoreFeatureId);
  }
  const readiness = createSketchProfileReadinessResponse(
    readinessDocument,
    { query: "sketch.profileReadiness", profile, consumer },
    "cadops.v1"
  );

  if (readiness.status === "ready") {
    return {
      ok: true,
      profile: readiness.normalizedProfile as SketchWireProfileRef,
      orientationNormalized: readiness.orientationNormalized
    };
  }

  const diagnostic = readiness.diagnostics.find(
    (candidate) => candidate.severity === "blocker"
  );
  return {
    ok: false,
    code: mapProfileDiagnosticToBatchError(diagnostic?.code),
    message:
      diagnostic?.message ?? "Composite wire profile is not feature-ready.",
    sketchId: diagnostic?.sketchId ?? profile.sketchId,
    sketchEntityId: diagnostic?.entityId
  };
}

/** Resolves the normalized authoritative wire into the shared exact/display recipe. */
export function createResolvedWireExtrudeProfile(
  document: CadDocument,
  profile: SketchWireProfileRef,
  ownerPartId: PartId
): CadExactExportResolvedWireProfile | undefined {
  const resolution = resolveWireExtrudeProfile(document, profile, "newBody");
  if (!resolution.ok) return undefined;
  const sketch = document.sketches.get(resolution.profile.sketchId);
  if (!sketch) return undefined;
  const frame = createSourceMeasurementFrame(document, sketch, ownerPartId);
  if (!frame) return undefined;

  return createResolvedWireExtrudeRecipe(resolution.profile, sketch.entities, {
    origin: frame.origin,
    uAxis: frame.uAxis,
    vAxis: frame.vAxis
  });
}

/** Pure normalized traversal mapping shared by display, exact metadata, and STEP. */
export function createResolvedWireExtrudeRecipe(
  profile: SketchWireProfileRef,
  entities: ReadonlyMap<SketchEntityId, SketchEntitySnapshot>,
  frame: CadExactExportResolvedWireProfile["frame"]
): CadExactExportResolvedWireProfile | undefined {
  const segments: CadExactExportResolvedWireProfile["segments"][number][] = [];
  for (const reference of profile.segments) {
    const entity = entities.get(reference.entityId);
    if (!entity || (entity.kind !== "line" && entity.kind !== "arc")) {
      return undefined;
    }
    if (entity.kind === "line") {
      segments.push({
        kind: "line",
        sourceEntityId: entity.id,
        start: reference.orientation === "forward" ? entity.start : entity.end,
        end: reference.orientation === "forward" ? entity.end : entity.start
      });
      continue;
    }
    const forward = reference.orientation === "forward";
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

  const identityRecipe = {
    sketchId: profile.sketchId,
    frame,
    segments,
    geometryPolicy: SKETCH_GEOMETRY_POLICY
  };
  return {
    kind: "wire",
    frame,
    closed: true,
    segments,
    sourceIdentity: `partbench-wire-extrude-v1:${JSON.stringify(identityRecipe)}`,
    geometryPolicy: SKETCH_GEOMETRY_POLICY
  };
}

function normalizeDegrees(value: number): number {
  const normalized = ((value % 360) + 360) % 360;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function mapProfileDiagnosticToBatchError(
  code: SketchProfileDiagnosticCode | undefined
): CadBatchValidationErrorCode {
  switch (code) {
    case "SKETCH_PROFILE_EMPTY":
    case "SKETCH_PROFILE_ENTITY_MISSING":
    case "SKETCH_PROFILE_ENTITY_UNSUPPORTED":
    case "SKETCH_PROFILE_CONSTRUCTION_ENTITY":
    case "SKETCH_PROFILE_ENTITY_REPEATED":
    case "SKETCH_PROFILE_DISCONNECTED":
    case "SKETCH_PROFILE_BRANCHING":
    case "SKETCH_PROFILE_OPEN":
    case "SKETCH_PROFILE_SELF_INTERSECTING":
    case "SKETCH_PROFILE_OVERLAPPING":
    case "SKETCH_PROFILE_AREA_TOO_SMALL":
    case "SKETCH_PROFILE_MULTIPLE_REGIONS_UNSUPPORTED":
    case "SKETCH_PROFILE_INNER_LOOP_UNSUPPORTED":
    case "SKETCH_PROFILE_CONSUMER_UNSUPPORTED":
    case "BODY_NOT_FOUND":
    case "UNSUPPORTED_BODY_REFERENCES":
    case "TOPOLOGY_ANCHOR_NOT_FOUND":
    case "INVALID_TOPOLOGY_ANCHOR":
    case "TARGET_BODY_REQUIRED":
    case "TARGET_BODY_NOT_SUPPORTED":
      return code;
    case "SKETCH_PROFILE_ORIENTATION_NORMALIZED":
    case undefined:
      return "SKETCH_PROFILE_CONSUMER_UNSUPPORTED";
  }
}

function profileEntityIds(profile: SketchProfileRef): readonly string[] {
  return profile.kind === "entity"
    ? [profile.entityId]
    : profile.segments.map((segment) => segment.entityId);
}

export function createProfileInputReference(
  featureId: FeatureId,
  after: SketchProfileRef,
  orientationNormalized: boolean,
  before?: SketchProfileRef
): FeatureInputReferenceSemanticDiff {
  const affectedSketchIds = [
    ...new Set([...(before ? [before.sketchId] : []), after.sketchId])
  ];
  const affectedEntityIds = [
    ...new Set([
      ...(before ? profileEntityIds(before) : []),
      ...profileEntityIds(after)
    ])
  ];
  return {
    featureId,
    inputKind: "profile",
    ...(before ? { before } : {}),
    after,
    ...(orientationNormalized ? { profileOrientationNormalized: true } : {}),
    affectedSketchIds,
    affectedEntityIds
  };
}

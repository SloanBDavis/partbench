import type {
  CadBatchValidationErrorCode,
  FeatureId,
  FeatureInputReferenceSemanticDiff,
  SketchProfileDiagnosticCode,
  SketchProfileRef,
  SketchWireProfileRef
} from "@web-cad/cad-protocol";

import type { CadDocument } from "./index";
import { createSketchProfileReadinessResponse } from "./sketchProfilePathQueries";

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

/** Resolves the sole enabled V17 composite-profile feature row. */
export function resolveNewBodyWireExtrudeProfile(
  document: CadDocument,
  profile: SketchWireProfileRef,
  operationMode: "newBody" | "add" | "cut"
): WireExtrudeProfileResolution {
  if (operationMode !== "newBody") {
    return {
      ok: false,
      code: "UNSUPPORTED_FEATURE_OPERATION",
      message:
        "Composite wire extrudes currently support newBody operation mode only."
    };
  }

  if (!document.sketches.has(profile.sketchId)) {
    return {
      ok: false,
      code: "SKETCH_NOT_FOUND",
      message: `Sketch does not exist: ${profile.sketchId}`,
      sketchId: profile.sketchId
    };
  }

  const readiness = createSketchProfileReadinessResponse(
    document,
    {
      query: "sketch.profileReadiness",
      profile,
      consumer: { featureKind: "extrude", operationMode: "newBody" }
    },
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

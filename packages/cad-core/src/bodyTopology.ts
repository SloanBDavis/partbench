import type {
  BodyId,
  CadBodyTopologyIssue,
  CadBodyTopologySnapshot,
  CadBodyTopologySourceIdentity,
  CadQueryError,
  DocumentUnits
} from "@web-cad/cad-protocol";

import type { CadDocument, Feature } from "./index";

export interface BodyTopologyRequest {
  readonly document: CadDocument;
  readonly bodyId: BodyId;
  readonly units: DocumentUnits;
  readonly bodyExists: (bodyId: BodyId) => boolean;
}

export type BodyTopologyResult =
  | {
      readonly ok: true;
      readonly topology: CadBodyTopologySnapshot;
    }
  | {
      readonly ok: false;
      readonly error: CadQueryError;
    };

export function createBodyTopology(
  request: BodyTopologyRequest
): BodyTopologyResult {
  const feature = [...request.document.features.values()].find(
    (candidate) => candidate.bodyId === request.bodyId
  );

  if (feature) {
    return {
      ok: true,
      topology: createUnsupportedAuthoredFeatureTopology(
        request.bodyId,
        request.units,
        feature
      )
    };
  }

  if (request.bodyExists(request.bodyId)) {
    return {
      ok: true,
      topology: createUnsupportedPrimitiveCompatibilityTopology(
        request.bodyId,
        request.units
      )
    };
  }

  return {
    ok: false,
    error: {
      code: "BODY_NOT_FOUND",
      message: `Body does not exist: ${request.bodyId}`,
      bodyId: request.bodyId
    }
  };
}

function createUnsupportedAuthoredFeatureTopology(
  bodyId: BodyId,
  units: DocumentUnits,
  feature: Feature
): CadBodyTopologySnapshot {
  const sourceIdentity: CadBodyTopologySourceIdentity = {
    bodyId,
    sourceKind: "authoredExtrude",
    cacheKey: createTopologyCacheKey({
      bodyId,
      sourceKind: "authoredExtrude",
      units,
      featureId: feature.id,
      operationMode: feature.operationMode,
      targetBodyId: feature.targetBodyId,
      sourceSketchId: feature.sketchId,
      sourceSketchEntityId: feature.entityId,
      profileKind: feature.profileKind,
      side: feature.side,
      depth: feature.depth
    }),
    units,
    featureId: feature.id,
    operationMode: feature.operationMode,
    targetBodyId: feature.targetBodyId,
    sourceSketchId: feature.sketchId,
    sourceSketchEntityId: feature.entityId,
    profileKind: feature.profileKind,
    side: feature.side,
    depth: feature.depth
  };
  const issues: CadBodyTopologyIssue[] = [
    {
      code: "UNSUPPORTED_BODY_TOPOLOGY",
      message:
        feature.operationMode === "newBody"
          ? "Exact topology is not derived yet for authored sketch-extrude bodies. Semantic generated references remain available through body.generatedReferences where supported."
          : "Exact topology is not derived yet for authored boolean result bodies.",
      bodyId,
      featureId: feature.id
    }
  ];

  return createUnsupportedTopologySnapshot({
    bodyId,
    units,
    sourceIdentity,
    issues
  });
}

function createUnsupportedPrimitiveCompatibilityTopology(
  bodyId: BodyId,
  units: DocumentUnits
): CadBodyTopologySnapshot {
  const sourceIdentity: CadBodyTopologySourceIdentity = {
    bodyId,
    sourceKind: "primitiveCompatibility",
    cacheKey: createTopologyCacheKey({
      bodyId,
      sourceKind: "primitiveCompatibility",
      units
    }),
    units
  };

  return createUnsupportedTopologySnapshot({
    bodyId,
    units,
    sourceIdentity,
    issues: [
      {
        code: "UNSUPPORTED_BODY_TOPOLOGY",
        message:
          "Exact topology is not derived for primitive compatibility bodies.",
        bodyId
      }
    ]
  });
}

function createUnsupportedTopologySnapshot(input: {
  readonly bodyId: BodyId;
  readonly units: DocumentUnits;
  readonly sourceIdentity: CadBodyTopologySourceIdentity;
  readonly issues: readonly CadBodyTopologyIssue[];
}): CadBodyTopologySnapshot {
  return {
    bodyId: input.bodyId,
    units: input.units,
    status: "unsupported",
    sourceKind: input.sourceIdentity.sourceKind,
    sourceIdentity: input.sourceIdentity,
    topologyAvailable: false,
    exactGeometryAvailable: false,
    exactMeasurementsAvailable: false,
    measurementConfidence: "none",
    issues: input.issues
  };
}

function createTopologyCacheKey(
  identity: Omit<CadBodyTopologySourceIdentity, "cacheKey">
): string {
  return `body-topology:v1:${JSON.stringify(identity)}`;
}

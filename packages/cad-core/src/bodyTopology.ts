import type {
  BodyId,
  CadBodyTopologyIssue,
  CadBodyTopologySnapshot,
  CadBodyTopologySourceIdentity,
  CadQueryError,
  DocumentUnits,
  PartId
} from "@web-cad/cad-protocol";

import {
  createBodyGeneratedReferences,
  type GeneratedReferencesDocument,
  type GeneratedReferencesFeature
} from "./generatedReferences";
import { createBodyMeasurements } from "./bodyMeasurements";

export interface BodyTopologyRequest {
  readonly document: GeneratedReferencesDocument;
  readonly bodyId: BodyId;
  readonly units: DocumentUnits;
  readonly ownerPartId: PartId;
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
    const topology = createAuthoredFeatureTopology(
      request.document,
      request.bodyId,
      request.units,
      request.ownerPartId,
      feature
    );

    return {
      ok: true,
      topology
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

function createAuthoredFeatureTopology(
  document: GeneratedReferencesDocument,
  bodyId: BodyId,
  units: DocumentUnits,
  ownerPartId: PartId,
  feature: GeneratedReferencesFeature
): CadBodyTopologySnapshot {
  const references = createBodyGeneratedReferences(
    document,
    bodyId,
    ownerPartId
  );
  const measurements = createBodyMeasurements(
    document,
    bodyId,
    units,
    ownerPartId
  );
  const profileSignature = references?.body.geometricSignature.profile;
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
      profileSignature,
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
    profileSignature,
    side: feature.side,
    depth: feature.depth
  };

  if (feature.operationMode === "newBody" && references && measurements) {
    return {
      bodyId,
      units,
      status: "healthy",
      sourceKind: "authoredExtrude",
      sourceIdentity,
      topologyModel: "semantic-source",
      topologyAvailable: true,
      exactGeometryAvailable: false,
      exactMeasurementsAvailable: true,
      measurementConfidence: "source-analytic",
      faceCount: references.faces.length,
      edgeCount: references.edges.length,
      vertexCount: references.vertices.length,
      issues: []
    };
  }

  const issues: CadBodyTopologyIssue[] = [
    {
      code:
        feature.operationMode === "newBody"
          ? "STALE_BODY_TOPOLOGY"
          : "AMBIGUOUS_BODY_TOPOLOGY",
      message:
        feature.operationMode === "newBody"
          ? "Semantic topology could not be derived because the authored extrude source profile or placement is stale."
          : "Stable generated topology references are ambiguous for authored boolean result bodies until boolean topology matching is implemented.",
      bodyId,
      featureId: feature.id
    }
  ];

  return createUnsupportedTopologySnapshot({
    bodyId,
    units,
    sourceIdentity,
    issues,
    status: feature.operationMode === "newBody" ? "stale" : "ambiguous"
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
  readonly status?: CadBodyTopologySnapshot["status"];
}): CadBodyTopologySnapshot {
  return {
    bodyId: input.bodyId,
    units: input.units,
    status: input.status ?? "unsupported",
    sourceKind: input.sourceIdentity.sourceKind,
    sourceIdentity: input.sourceIdentity,
    topologyModel: "none",
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

import type {
  BodyId,
  CadBodyDerivedExactMetadataSnapshot,
  CadBodyTopologyIssue,
  CadBodyTopologyIssueCode,
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
  readonly derivedExactMetadata?: CadBodyDerivedExactMetadataSnapshot;
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
      topology: applyDerivedExactMetadata(
        topology,
        request.derivedExactMetadata
      )
    };
  }

  if (request.bodyExists(request.bodyId)) {
    const topology = createUnsupportedPrimitiveCompatibilityTopology(
      request.bodyId,
      request.units
    );
    return {
      ok: true,
      topology: applyDerivedExactMetadata(
        topology,
        request.derivedExactMetadata
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

function applyDerivedExactMetadata(
  topology: CadBodyTopologySnapshot,
  metadata: CadBodyDerivedExactMetadataSnapshot | undefined
): CadBodyTopologySnapshot {
  if (!metadata) {
    return topology;
  }

  if (topology.sourceKind !== "authoredExtrude") {
    return applyDerivedExactMetadataIssue(topology, {
      code: "UNSUPPORTED_BODY_TOPOLOGY",
      status: "unsupported",
      message:
        "Derived exact metadata snapshots are supported only for authored bodies."
    });
  }

  if (metadata.bodyId !== topology.bodyId) {
    return applyDerivedExactMetadataIssue(topology, {
      code: "STALE_BODY_TOPOLOGY",
      status: "stale",
      message: `Derived exact metadata body mismatch for ${topology.bodyId}.`,
      expected: topology.bodyId,
      received: metadata.bodyId
    });
  }

  if (metadata.sourceIdentityCacheKey !== topology.sourceIdentity.cacheKey) {
    return applyDerivedExactMetadataIssue(topology, {
      code: "STALE_BODY_TOPOLOGY",
      status: "stale",
      message:
        "Derived exact metadata is stale for the current body source identity.",
      expected: topology.sourceIdentity.cacheKey,
      received: metadata.sourceIdentityCacheKey
    });
  }

  if (metadata.status === "ready") {
    if (!metadata.metadata) {
      return applyDerivedExactMetadataIssue(topology, {
        code: "INVALID_EXACT_GEOMETRY_RESULT",
        status: "kernel-failed",
        message:
          "Derived exact metadata was marked ready but did not include kernel metadata."
      });
    }

    return {
      ...topology,
      exactGeometryAvailable: true,
      exactMeasurementsAvailable: true,
      measurementConfidence: "kernel-derived",
      exactMetadata: {
        status: "healthy",
        ...metadata.metadata
      }
    };
  }

  return applyDerivedExactMetadataIssue(topology, {
    code: getDerivedExactMetadataIssueCode(metadata.status),
    status: metadata.status,
    message:
      metadata.error?.message ??
      getDerivedExactMetadataIssueMessage(metadata.status, topology.bodyId),
    received: metadata.error?.code
  });
}

function applyDerivedExactMetadataIssue(
  topology: CadBodyTopologySnapshot,
  issue: {
    readonly code: CadBodyTopologyIssueCode;
    readonly status: CadBodyTopologySnapshot["status"];
    readonly message: string;
    readonly expected?: string;
    readonly received?: string;
  }
): CadBodyTopologySnapshot {
  return {
    ...topology,
    status: issue.status,
    exactGeometryAvailable: false,
    issues: [
      ...topology.issues,
      {
        code: issue.code,
        message: issue.message,
        bodyId: topology.bodyId,
        featureId: topology.sourceIdentity.featureId,
        expected: issue.expected,
        received: issue.received
      }
    ]
  };
}

function getDerivedExactMetadataIssueCode(
  status: CadBodyDerivedExactMetadataSnapshot["status"]
): CadBodyTopologyIssueCode {
  switch (status) {
    case "ready":
      return "INVALID_EXACT_GEOMETRY_RESULT";
    case "unsupported":
      return "UNSUPPORTED_BODY_TOPOLOGY";
    case "stale":
      return "STALE_BODY_TOPOLOGY";
    case "kernel-failed":
      return "EXACT_GEOMETRY_KERNEL_FAILED";
    case "unavailable-binding":
      return "EXACT_GEOMETRY_BINDING_UNAVAILABLE";
  }
}

function getDerivedExactMetadataIssueMessage(
  status: Exclude<CadBodyDerivedExactMetadataSnapshot["status"], "ready">,
  bodyId: BodyId
): string {
  switch (status) {
    case "unsupported":
      return `Derived exact metadata is unsupported for body: ${bodyId}`;
    case "stale":
      return `Derived exact metadata is stale for body: ${bodyId}`;
    case "kernel-failed":
      return `Kernel-derived exact metadata failed for body: ${bodyId}`;
    case "unavailable-binding":
      return `Kernel exact metadata bindings are unavailable for body: ${bodyId}`;
  }
}

function createTopologyCacheKey(
  identity: Omit<CadBodyTopologySourceIdentity, "cacheKey">
): string {
  return `body-topology:v1:${JSON.stringify(identity)}`;
}

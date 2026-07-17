import type {
  BodyId,
  CadBodyDerivedExactMetadataSnapshot,
  CadBooleanResultTopologyDerivedExactValidationStatus,
  CadBooleanResultTopologyReadiness,
  CadBooleanResultTopologyRoleReadiness,
  CadBodyTopologyIssue,
  CadBodyTopologyIssueCode,
  CadBodyTopologySnapshot,
  CadBodyTopologySourceIdentity,
  CadGeneratedReferenceProfileSignature,
  CadQueryError,
  DocumentUnits,
  FeatureExtrudeProfileKind,
  PartId,
  Vec2
} from "@web-cad/cad-protocol";

import {
  createBodyGeneratedReferences,
  type GeneratedReferencesDocument,
  type GeneratedReferencesFeature
} from "./generatedReferences";
import { createBodyMeasurements } from "./bodyMeasurements";
import {
  getFeatureEntityProfileRef,
  getSupportedEntityProfileKind
} from "./normalizedFeatureInputs";
import { sha256Hex } from "./sha256";
import { createSourceMeasurementFrame } from "./sourceMeasurementGeometry";

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
  if (feature.kind !== "extrude") {
    return createUnsupportedAuthoredFeatureTopology(
      document,
      bodyId,
      units,
      feature
    );
  }

  if (feature.profile.kind === "wire") {
    return createCompositeExtrudeTopology(
      document,
      bodyId,
      units,
      ownerPartId,
      {
        ...feature,
        profile: feature.profile
      }
    );
  }

  const profileRef = getFeatureEntityProfileRef(feature);
  const profileEntity = profileRef
    ? document.sketches
        .get(profileRef.sketchId)
        ?.entities.get(profileRef.entityId)
    : undefined;
  const profileKind = getSupportedEntityProfileKind(profileEntity);

  if (!profileRef || !profileKind) {
    return createUnsupportedAuthoredFeatureTopology(
      document,
      bodyId,
      units,
      feature
    );
  }

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
    signature: createTopologySourceSignature({
      bodyId,
      sourceKind: "authoredExtrude",
      units,
      featureId: feature.id,
      operationMode: feature.operationMode,
      targetBodyId: feature.targetBodyId,
      targetTopologyAnchorId: feature.targetTopologyAnchorId,
      sourceSketchId: profileRef.sketchId,
      sourceSketchEntityId: profileRef.entityId,
      profileKind,
      profileSignature,
      side: feature.side,
      depth: feature.depth
    }),
    units,
    featureId: feature.id,
    operationMode: feature.operationMode,
    targetBodyId: feature.targetBodyId,
    targetTopologyAnchorId: feature.targetTopologyAnchorId,
    sourceSketchId: profileRef.sketchId,
    sourceSketchEntityId: profileRef.entityId,
    profileKind,
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

  const unsupportedTopology = createUnsupportedTopologySnapshot({
    bodyId,
    units,
    sourceIdentity,
    issues,
    status: feature.operationMode === "newBody" ? "stale" : "ambiguous"
  });

  if (feature.operationMode !== "newBody") {
    return {
      ...unsupportedTopology,
      booleanTopology: createBooleanResultTopologyReadiness({
        bodyId,
        feature,
        profileRef,
        profileKind,
        derivedExactValidationStatus: "notProvided"
      })
    };
  }

  return unsupportedTopology;
}

function createCompositeExtrudeTopology(
  document: GeneratedReferencesDocument,
  bodyId: BodyId,
  units: DocumentUnits,
  ownerPartId: PartId,
  feature: Extract<GeneratedReferencesFeature, { kind: "extrude" }> & {
    readonly profile: Extract<
      Extract<GeneratedReferencesFeature, { kind: "extrude" }>["profile"],
      { kind: "wire" }
    >;
  }
): CadBodyTopologySnapshot {
  const sourceSketchEntityIds = feature.profile.segments.map(
    (segment) => segment.entityId
  );
  const sketch = document.sketches.get(feature.profile.sketchId);
  const profileEntities = feature.profile.segments.map((segment) => {
    const entity = sketch?.entities.get(segment.entityId);
    return {
      entityId: segment.entityId,
      orientation: segment.orientation,
      geometry:
        entity?.kind === "line"
          ? {
              kind: entity.kind,
              start: entity.start,
              end: entity.end,
              construction: entity.construction
            }
          : entity?.kind === "arc"
            ? {
                kind: entity.kind,
                center: entity.center,
                radius: entity.radius,
                startAngleDegrees: entity.startAngleDegrees,
                sweepAngleDegrees: entity.sweepAngleDegrees,
                construction: entity.construction
              }
            : undefined
    };
  });
  const resolvedFrame = sketch
    ? createSourceMeasurementFrame(document, sketch, ownerPartId)
    : undefined;
  const sourceIdentityInput: Omit<CadBodyTopologySourceIdentity, "signature"> =
    {
      bodyId,
      sourceKind: "authoredExtrude",
      units,
      featureId: feature.id,
      operationMode: feature.operationMode,
      sourceSketchId: feature.profile.sketchId,
      sourceSketchEntityIds,
      profileKind: "wire",
      side: feature.side,
      depth: feature.depth,
      featureSourceSignature: sha256Hex(
        new TextEncoder().encode(
          JSON.stringify({
            profile: feature.profile,
            profileEntities,
            resolvedFrame: resolvedFrame ?? null
          })
        )
      )
    };
  const sourceIdentity: CadBodyTopologySourceIdentity = {
    ...sourceIdentityInput,
    signature: createTopologySourceSignature(sourceIdentityInput)
  };

  return createUnsupportedTopologySnapshot({
    bodyId,
    units,
    sourceIdentity,
    issues: [
      {
        code: "UNSUPPORTED_BODY_TOPOLOGY",
        message:
          "Composite wire extrude topology requires matching kernel-derived exact topology evidence.",
        bodyId,
        featureId: feature.id
      }
    ]
  });
}

function createBooleanResultTopologyReadiness(input: {
  readonly bodyId: BodyId;
  readonly feature: Extract<GeneratedReferencesFeature, { kind: "extrude" }>;
  readonly profileRef: {
    readonly sketchId: string;
    readonly entityId: string;
  };
  readonly profileKind: "rectangle" | "circle";
  readonly derivedExactValidationStatus: CadBooleanResultTopologyDerivedExactValidationStatus;
}): CadBooleanResultTopologyReadiness {
  const operationMode = input.feature.operationMode === "add" ? "add" : "cut";
  const roleReadiness = createBooleanRoleReadiness({
    bodyId: input.bodyId,
    operationMode,
    profileKind: input.profileKind
  });
  const hasSourceTopologyRole = roleReadiness.some(
    (role) =>
      role.entityKind !== "body" &&
      (role.status === "proven" || role.status === "command-ready")
  );
  const hasCommandReadyTopologyRole = roleReadiness.some(
    (role) => role.entityKind !== "body" && role.commandReady
  );

  return {
    contractVersion: "partbench.boolean-topology.v1",
    status: hasSourceTopologyRole ? "partial" : "ambiguous",
    commandReady: false,
    sourceSemanticsAvailable: true,
    derivedExactValidationStatus: input.derivedExactValidationStatus,
    sourceInputs: {
      featureId: input.feature.id,
      resultBodyId: input.bodyId,
      operationMode,
      targetBodyId: input.feature.targetBodyId,
      toolSketchId: input.profileRef.sketchId,
      toolSketchEntityId: input.profileRef.entityId,
      toolProfileKind: input.profileKind
    },
    roleReadiness,
    diagnostics: [
      {
        code: "BOOLEAN_TOPOLOGY_MATCHING_DEFERRED",
        severity: "blocking",
        message:
          "General boolean result topology matching remains deferred for unproven carried, split, terminal, and rim roles."
      },
      createBooleanRoleDerivationDiagnostic(hasSourceTopologyRole),
      createBooleanResultReferenceDiagnostic(hasCommandReadyTopologyRole),
      createBooleanExactValidationDiagnostic(input.derivedExactValidationStatus)
    ]
  };
}

function createBooleanRoleDerivationDiagnostic(
  hasProvenTopologyRole: boolean
): CadBooleanResultTopologyReadiness["diagnostics"][number] {
  if (hasProvenTopologyRole) {
    return {
      code: "BOOLEAN_SOURCE_ROLE_DERIVATION_PARTIAL",
      severity: "warning",
      message:
        "Some boolean result roles are source-semantic, but unproven roles remain ambiguous until explicit topology support proves them."
    };
  }

  return {
    code: "BOOLEAN_ROLE_DERIVATION_DEFERRED",
    severity: "blocking",
    message:
      "Boolean result face and edge roles are deferred until source-semantic role derivation is implemented."
  };
}

function createBooleanResultReferenceDiagnostic(
  hasCommandReadyTopologyRole: boolean
): CadBooleanResultTopologyReadiness["diagnostics"][number] {
  if (hasCommandReadyTopologyRole) {
    return {
      code: "BOOLEAN_RESULT_REFERENCES_PARTIAL_COMMAND_READY",
      severity: "warning",
      message:
        "Some boolean result face and edge roles are command-ready, while unproven boolean topology remains diagnostic-only."
    };
  }

  return {
    code: "BOOLEAN_RESULT_REFERENCES_NOT_COMMAND_READY",
    severity: "blocking",
    message:
      "Boolean result body generated topology remains non-commandable for reference-consuming commands."
  };
}

function createBooleanExactValidationDiagnostic(
  status: CadBooleanResultTopologyDerivedExactValidationStatus
): CadBooleanResultTopologyReadiness["diagnostics"][number] {
  switch (status) {
    case "notProvided":
      return {
        code: "BOOLEAN_EXACT_VALIDATION_NOT_PROVIDED",
        severity: "info",
        message:
          "No derived exact metadata snapshot was provided for boolean topology validation."
      };
    case "available":
      return {
        code: "BOOLEAN_EXACT_VALIDATION_AVAILABLE",
        severity: "info",
        message:
          "Derived exact metadata is available for validation, but it is not command-ready topology authority."
      };
    case "stale":
      return {
        code: "BOOLEAN_EXACT_VALIDATION_STALE",
        severity: "warning",
        message:
          "Derived exact metadata is stale for the current boolean result source identity."
      };
    case "unsupported":
      return {
        code: "BOOLEAN_EXACT_VALIDATION_UNSUPPORTED",
        severity: "warning",
        message:
          "Derived exact metadata is unsupported for this boolean result topology validation."
      };
    case "failed":
      return {
        code: "BOOLEAN_EXACT_VALIDATION_FAILED",
        severity: "warning",
        message:
          "Derived exact metadata failed for this boolean result topology validation."
      };
    case "unavailable":
      return {
        code: "BOOLEAN_EXACT_VALIDATION_UNAVAILABLE",
        severity: "warning",
        message:
          "Derived exact metadata bindings are unavailable for this boolean result topology validation."
      };
  }
}

function createBooleanRoleReadiness(input: {
  readonly bodyId: BodyId;
  readonly operationMode: "add" | "cut";
  readonly profileKind: FeatureExtrudeProfileKind;
}): readonly CadBooleanResultTopologyRoleReadiness[] {
  const common: CadBooleanResultTopologyRoleReadiness[] = [
    {
      role: "booleanResultBody",
      entityKind: "body",
      status: "proven",
      commandReady: false,
      roleStableId: `boolean-role:body:${input.bodyId}:result`,
      label: "Boolean result body",
      message:
        "Boolean result body identity is source-backed, but generated topology roles are not command-ready yet."
    },
    {
      role: "targetCarriedFace",
      entityKind: "face",
      status: "ambiguous",
      commandReady: false,
      message:
        "Target carried face roles require boolean topology matching before they can be command-ready."
    },
    {
      role: "targetModifiedFace",
      entityKind: "face",
      status: "ambiguous",
      commandReady: false,
      message:
        "Target modified face roles require boolean topology matching before they can be command-ready."
    },
    {
      role: "targetCarriedEdge",
      entityKind: "edge",
      status: "ambiguous",
      commandReady: false,
      message:
        "Target carried edge roles require boolean topology matching before they can be command-ready."
    }
  ];

  if (input.operationMode === "add") {
    return [
      ...common,
      ...createAddedWallFaceRoleReadiness(input.bodyId, input.profileKind),
      ...createAddedCapFaceRoleReadiness(input.bodyId, input.profileKind),
      ...createAddProfileEdgeRoleReadiness(input.bodyId, input.profileKind),
      {
        role: "addSeamEdge",
        entityKind: "edge",
        status: "ambiguous",
        commandReady: false,
        message:
          "Add seam edge roles are deferred until V12 role derivation proves source-semantic identity."
      },
      ...(input.profileKind === "rectangle"
        ? []
        : [
            {
              role: "addProfileEdge" as const,
              entityKind: "edge" as const,
              status: "ambiguous" as const,
              commandReady: false,
              message:
                "Add profile edge roles are deferred until V12 role derivation proves source-semantic identity."
            }
          ])
    ];
  }

  return [
    ...common,
    {
      role: "targetSplitFace",
      entityKind: "face",
      status: "ambiguous",
      commandReady: false,
      message:
        "Target split face roles are deferred until V12 role derivation proves source-semantic identity."
    },
    ...createCutWallFaceRoleReadiness(input.bodyId, input.profileKind),
    ...createCutStartRimEdgeRoleReadiness(input.bodyId, input.profileKind),
    {
      role: "cutTerminalFace",
      entityKind: "face",
      status: "ambiguous",
      commandReady: false,
      message:
        "Cut terminal face roles are deferred until V12 role derivation proves source-semantic identity."
    },
    ...createCutTerminalRimEdgeRoleReadiness(input.bodyId, input.profileKind),
    {
      role: "cutExitRimEdge",
      entityKind: "edge",
      status: "ambiguous",
      commandReady: false,
      message:
        "Cut exit rim edge roles are deferred until V12 role derivation proves source-semantic identity."
    },
    ...createCutWallProfileEdgeRoleReadiness(input.bodyId, input.profileKind),
    {
      role: "targetSplitEdge",
      entityKind: "edge",
      status: "ambiguous",
      commandReady: false,
      message:
        "Target split edge roles are deferred until V12 role derivation proves source-semantic identity."
    },
    {
      role: "intersectionVertex",
      entityKind: "vertex",
      status: "ambiguous",
      commandReady: false,
      message:
        "Intersection vertex roles are deferred until V12 role derivation proves source-semantic identity."
    }
  ];
}

function createAddedWallFaceRoleReadiness(
  bodyId: BodyId,
  profileKind: FeatureExtrudeProfileKind
): readonly CadBooleanResultTopologyRoleReadiness[] {
  if (profileKind === "rectangle") {
    return ["side:uMin", "side:uMax", "side:vMin", "side:vMax"].map(
      (sourceRole) =>
        createCommandReadyBooleanFaceRole({
          bodyId,
          role: "addedWallFace",
          sourceRole,
          label: `Added wall face ${sourceRole.replace("side:", "")}`
        })
    );
  }

  if (profileKind === "circle") {
    return [
      createCommandReadyBooleanFaceRole({
        bodyId,
        role: "addedWallFace",
        sourceRole: "side:circular",
        label: "Added circular wall face"
      })
    ];
  }

  return [
    {
      role: "addedWallFace",
      entityKind: "face",
      status: "ambiguous",
      commandReady: false,
      message:
        "Added wall face roles are deferred until V12 role derivation proves source-semantic identity."
    }
  ];
}

function createAddedCapFaceRoleReadiness(
  bodyId: BodyId,
  profileKind: FeatureExtrudeProfileKind
): readonly CadBooleanResultTopologyRoleReadiness[] {
  if (profileKind === "rectangle") {
    return [
      createCommandReadyBooleanFaceRole({
        bodyId,
        role: "addedCapFace",
        sourceRole: "endCap",
        label: "Added cap face"
      })
    ];
  }

  if (profileKind === "circle") {
    return [
      createCommandReadyBooleanFaceRole({
        bodyId,
        role: "addedCapFace",
        sourceRole: "endCap",
        label: "Added cap face"
      })
    ];
  }

  return [
    {
      role: "addedCapFace",
      entityKind: "face",
      status: "ambiguous",
      commandReady: false,
      message:
        "Added cap face roles are deferred until V12 role derivation proves source-semantic identity."
    }
  ];
}

function createCutWallFaceRoleReadiness(
  bodyId: BodyId,
  profileKind: FeatureExtrudeProfileKind
): readonly CadBooleanResultTopologyRoleReadiness[] {
  if (profileKind === "rectangle") {
    return ["side:uMin", "side:uMax", "side:vMin", "side:vMax"].map(
      (sourceRole) =>
        createCommandReadyBooleanFaceRole({
          bodyId,
          role: "cutWallFace",
          sourceRole,
          label: `Cut wall face ${sourceRole.replace("side:", "")}`
        })
    );
  }

  if (profileKind === "circle") {
    return [
      createCommandReadyBooleanFaceRole({
        bodyId,
        role: "cutWallFace",
        sourceRole: "side:circular",
        label: "Cut circular wall face"
      })
    ];
  }

  return [
    {
      role: "cutWallFace",
      entityKind: "face",
      status: "ambiguous",
      commandReady: false,
      message:
        "Cut wall face roles are deferred until V12 role derivation proves source-semantic identity."
    }
  ];
}

function createCommandReadyBooleanFaceRole(input: {
  readonly bodyId: BodyId;
  readonly role: "cutWallFace" | "addedWallFace" | "addedCapFace";
  readonly sourceRole: string;
  readonly label: string;
}): CadBooleanResultTopologyRoleReadiness {
  return {
    role: input.role,
    entityKind: "face",
    status: "command-ready",
    commandReady: true,
    roleStableId: `generated:face:${input.bodyId}:${input.sourceRole}`,
    label: input.label,
    sourceRole: input.sourceRole,
    message:
      "This boolean result face role is command-ready through the V12 generated-reference path."
  };
}

function createCutWallProfileEdgeRoleReadiness(
  bodyId: BodyId,
  profileKind: FeatureExtrudeProfileKind
): readonly CadBooleanResultTopologyRoleReadiness[] {
  if (profileKind === "rectangle") {
    return [
      "longitudinal:uMin:vMin",
      "longitudinal:uMin:vMax",
      "longitudinal:uMax:vMin",
      "longitudinal:uMax:vMax"
    ].map((sourceRole) =>
      createCommandReadyBooleanEdgeRole({
        bodyId,
        role: "cutWallProfileEdge",
        sourceRole,
        label: `Cut wall profile edge ${sourceRole
          .replace("longitudinal:", "")
          .replace(":", "/")}`
      })
    );
  }

  return [
    {
      role: "cutWallProfileEdge",
      entityKind: "edge",
      status: "ambiguous",
      commandReady: false,
      message:
        "Cut wall profile edge roles are deferred until V12 role derivation proves source-semantic identity."
    }
  ];
}

function createCutStartRimEdgeRoleReadiness(
  bodyId: BodyId,
  profileKind: FeatureExtrudeProfileKind
): readonly CadBooleanResultTopologyRoleReadiness[] {
  if (profileKind === "circle") {
    return [
      createCommandReadyBooleanEdgeRole({
        bodyId,
        role: "cutStartRimEdge",
        sourceRole: "start:circular",
        label: "Cut start circular rim edge"
      })
    ];
  }

  return [
    {
      role: "cutStartRimEdge",
      entityKind: "edge",
      status: "ambiguous",
      commandReady: false,
      message:
        "Cut start rim edge roles are deferred until V12 role derivation proves source-semantic identity."
    }
  ];
}

function createCutTerminalRimEdgeRoleReadiness(
  bodyId: BodyId,
  profileKind: FeatureExtrudeProfileKind
): readonly CadBooleanResultTopologyRoleReadiness[] {
  if (profileKind === "circle") {
    return [
      createCommandReadyBooleanEdgeRole({
        bodyId,
        role: "cutTerminalRimEdge",
        sourceRole: "end:circular",
        label: "Cut terminal circular rim edge"
      })
    ];
  }

  return [
    {
      role: "cutTerminalRimEdge",
      entityKind: "edge",
      status: "ambiguous",
      commandReady: false,
      message:
        "Cut terminal rim edge roles are deferred until V12 role derivation proves source-semantic identity."
    }
  ];
}

function createCommandReadyBooleanEdgeRole(input: {
  readonly bodyId: BodyId;
  readonly role:
    | "cutWallProfileEdge"
    | "cutStartRimEdge"
    | "cutTerminalRimEdge"
    | "addProfileEdge";
  readonly sourceRole: string;
  readonly label: string;
}): CadBooleanResultTopologyRoleReadiness {
  return {
    role: input.role,
    entityKind: "edge",
    status: "command-ready",
    commandReady: true,
    roleStableId: `generated:edge:${input.bodyId}:${input.sourceRole}`,
    label: input.label,
    sourceRole: input.sourceRole,
    message:
      "This boolean result edge role is command-ready for selection, naming, and measurement through the V12 generated-reference path."
  };
}

function createAddProfileEdgeRoleReadiness(
  bodyId: BodyId,
  profileKind: FeatureExtrudeProfileKind
): readonly CadBooleanResultTopologyRoleReadiness[] {
  if (profileKind === "rectangle") {
    return ["end:uMin", "end:uMax", "end:vMin", "end:vMax"].map((sourceRole) =>
      createCommandReadyBooleanEdgeRole({
        bodyId,
        role: "addProfileEdge",
        sourceRole,
        label: `Added cap profile edge ${sourceRole.replace("end:", "")}`
      })
    );
  }

  if (profileKind === "circle") {
    return [
      createCommandReadyBooleanEdgeRole({
        bodyId,
        role: "addProfileEdge",
        sourceRole: "end:circular",
        label: "Added cap circular edge"
      })
    ];
  }

  return [];
}

function createUnsupportedAuthoredFeatureTopology(
  document: GeneratedReferencesDocument,
  bodyId: BodyId,
  units: DocumentUnits,
  feature: GeneratedReferencesFeature
): CadBodyTopologySnapshot {
  const sourceKind = createAuthoredFeatureTopologySourceKind(feature);
  const sourceIdentityInput: Omit<CadBodyTopologySourceIdentity, "signature"> =
    feature.kind === "revolve"
      ? createRevolveSourceIdentityInput(document, bodyId, units, feature)
      : feature.kind === "hole"
        ? createHoleSourceIdentityInput(document, bodyId, units, feature)
        : feature.kind === "chamfer"
          ? createChamferSourceIdentityInput(bodyId, units, feature)
          : feature.kind === "fillet"
            ? createFilletSourceIdentityInput(bodyId, units, feature)
            : {
                bodyId,
                sourceKind,
                units,
                featureId: feature.id,
                featureSourceSignature: sha256Hex(
                  new TextEncoder().encode(JSON.stringify(feature))
                )
              };
  const sourceIdentity: CadBodyTopologySourceIdentity = {
    ...sourceIdentityInput,
    signature: createTopologySourceSignature(sourceIdentityInput)
  };

  return createUnsupportedTopologySnapshot({
    bodyId,
    units,
    sourceIdentity,
    issues: [
      {
        code: "UNSUPPORTED_BODY_TOPOLOGY",
        message:
          feature.kind === "hole"
            ? "Semantic topology references are not derived for authored hole result bodies yet."
            : feature.kind === "chamfer" || feature.kind === "fillet"
              ? "Semantic topology references are not derived for authored edge-finishing result bodies yet."
              : "Semantic topology references are not derived for authored revolve bodies yet.",
        bodyId,
        featureId: feature.id
      }
    ]
  });
}

function createAuthoredFeatureTopologySourceKind(
  feature: GeneratedReferencesFeature
): CadBodyTopologySourceIdentity["sourceKind"] {
  switch (feature.kind) {
    case "extrude":
      return "authoredExtrude";
    case "revolve":
      return "authoredRevolve";
    case "hole":
      return "authoredHole";
    case "chamfer":
      return "authoredChamfer";
    case "fillet":
      return "authoredFillet";
    case "importedBody":
      return "importedBody";
    case "linearPattern":
      return "authoredLinearPattern";
    case "circularPattern":
      return "authoredCircularPattern";
    case "mirror":
      return "authoredMirror";
    case "shell":
      return "authoredShell";
    case "sweep":
      return "authoredSweep";
    case "loft":
      return "authoredLoft";
  }
}

function createChamferSourceIdentityInput(
  bodyId: BodyId,
  units: DocumentUnits,
  feature: Extract<GeneratedReferencesFeature, { kind: "chamfer" }>
): Omit<CadBodyTopologySourceIdentity, "signature"> {
  return {
    bodyId,
    sourceKind: "authoredChamfer",
    units,
    featureId: feature.id,
    targetBodyId: feature.targetBodyId,
    ...(feature.edgeStableId ? { edgeStableId: feature.edgeStableId } : {}),
    ...(feature.namedReference
      ? { namedReference: feature.namedReference }
      : {}),
    ...(feature.topologyAnchorId
      ? { topologyAnchorId: feature.topologyAnchorId }
      : {}),
    chamferDistance: feature.distance
  };
}

function createFilletSourceIdentityInput(
  bodyId: BodyId,
  units: DocumentUnits,
  feature: Extract<GeneratedReferencesFeature, { kind: "fillet" }>
): Omit<CadBodyTopologySourceIdentity, "signature"> {
  return {
    bodyId,
    sourceKind: "authoredFillet",
    units,
    featureId: feature.id,
    targetBodyId: feature.targetBodyId,
    ...(feature.edgeStableId ? { edgeStableId: feature.edgeStableId } : {}),
    ...(feature.namedReference
      ? { namedReference: feature.namedReference }
      : {}),
    ...(feature.topologyAnchorId
      ? { topologyAnchorId: feature.topologyAnchorId }
      : {}),
    filletRadius: feature.radius
  };
}

function createHoleSourceIdentityInput(
  document: GeneratedReferencesDocument,
  bodyId: BodyId,
  units: DocumentUnits,
  feature: Extract<GeneratedReferencesFeature, { kind: "hole" }>
): Omit<CadBodyTopologySourceIdentity, "signature"> {
  return {
    bodyId,
    sourceKind: "authoredHole",
    units,
    featureId: feature.id,
    targetBodyId: feature.targetBodyId,
    targetTopologyAnchorId: feature.targetTopologyAnchorId,
    sourceSketchId: feature.sketchId,
    holeCircleEntityId: feature.circleEntityId,
    profileKind: "circle",
    profileSignature: createHoleCircleProfileSignature(document, feature),
    holeDepthMode: feature.depthMode,
    holeDepth: feature.depth,
    holeDirection: feature.direction
  };
}

function createHoleCircleProfileSignature(
  document: GeneratedReferencesDocument,
  feature: Extract<GeneratedReferencesFeature, { kind: "hole" }>
): CadGeneratedReferenceProfileSignature | undefined {
  const sketch = document.sketches.get(feature.sketchId);
  const entity = sketch?.entities.get(feature.circleEntityId);

  if (entity?.kind !== "circle") {
    return undefined;
  }

  return {
    kind: "circle",
    center: entity.center,
    radius: entity.radius
  };
}

function createRevolveSourceIdentityInput(
  document: GeneratedReferencesDocument,
  bodyId: BodyId,
  units: DocumentUnits,
  feature: Extract<GeneratedReferencesFeature, { kind: "revolve" }>
): Omit<CadBodyTopologySourceIdentity, "signature"> {
  const profile = getFeatureEntityProfileRef(feature);
  const entity = profile
    ? document.sketches.get(profile.sketchId)?.entities.get(profile.entityId)
    : undefined;
  const profileKind = getSupportedEntityProfileKind(entity);

  return {
    bodyId,
    sourceKind: "authoredRevolve",
    units,
    featureId: feature.id,
    operationMode: feature.operationMode,
    sourceSketchId: profile?.sketchId,
    sourceSketchEntityId: profile?.entityId,
    profileKind,
    profileSignature: createRevolveProfileSignature(document, feature),
    revolveAxis: feature.axis,
    revolveAxisSignature: createRevolveAxisSignature(document, feature),
    revolveAngleDegrees: feature.angleDegrees
  };
}

function createRevolveProfileSignature(
  document: GeneratedReferencesDocument,
  feature: Extract<GeneratedReferencesFeature, { kind: "revolve" }>
): CadGeneratedReferenceProfileSignature | undefined {
  const profile = getFeatureEntityProfileRef(feature);
  const entity = profile
    ? document.sketches.get(profile.sketchId)?.entities.get(profile.entityId)
    : undefined;

  if (entity?.kind === "rectangle") {
    return {
      kind: "rectangle",
      center: entity.center,
      width: entity.width,
      height: entity.height
    };
  }

  if (entity?.kind === "circle") {
    return {
      kind: "circle",
      center: entity.center,
      radius: entity.radius
    };
  }

  return undefined;
}

function createRevolveAxisSignature(
  document: GeneratedReferencesDocument,
  feature: Extract<GeneratedReferencesFeature, { kind: "revolve" }>
): { readonly start: Vec2; readonly end: Vec2 } | undefined {
  const sketch = document.sketches.get(feature.axis.sketchId);
  const axis = sketch?.entities.get(feature.axis.entityId);

  if (axis?.kind !== "line") {
    return undefined;
  }

  return {
    start: axis.start,
    end: axis.end
  };
}

function createUnsupportedPrimitiveCompatibilityTopology(
  bodyId: BodyId,
  units: DocumentUnits
): CadBodyTopologySnapshot {
  const sourceIdentity: CadBodyTopologySourceIdentity = {
    bodyId,
    sourceKind: "primitiveCompatibility",
    signature: createTopologySourceSignature({
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

  if (
    topology.sourceKind !== "authoredExtrude" &&
    topology.sourceKind !== "authoredRevolve" &&
    topology.sourceKind !== "authoredHole" &&
    topology.sourceKind !== "authoredChamfer" &&
    topology.sourceKind !== "authoredFillet"
  ) {
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

  if (metadata.sourceIdentitySignature !== topology.sourceIdentity.signature) {
    return applyDerivedExactMetadataIssue(topology, {
      code: "STALE_BODY_TOPOLOGY",
      status: "stale",
      message:
        "Derived exact metadata is stale for the current body source identity.",
      expected: topology.sourceIdentity.signature,
      received: metadata.sourceIdentitySignature
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

    const topologyCounts = metadata.metadata.topologyCounts;
    if (
      topology.sourceIdentity.profileKind === "wire" &&
      topologyCounts?.solidCount !== 1
    ) {
      return applyDerivedExactMetadataIssue(topology, {
        code: "INVALID_EXACT_GEOMETRY_RESULT",
        status: "kernel-failed",
        message:
          "Composite wire newBody exact metadata must prove exactly one solid.",
        expected: "solidCount=1",
        received:
          topologyCounts === undefined
            ? "topologyCounts missing"
            : `solidCount=${topologyCounts.solidCount}`
      });
    }
    const exactTopologyReady =
      topology.sourceIdentity.profileKind === "wire" &&
      topologyCounts?.solidCount === 1;

    return {
      ...topology,
      ...(exactTopologyReady
        ? {
            status: "healthy" as const,
            topologyModel: "kernel-derived" as const,
            topologyAvailable: true,
            faceCount: topologyCounts?.faceCount,
            edgeCount: topologyCounts?.edgeCount,
            vertexCount: topologyCounts?.vertexCount,
            issues: []
          }
        : {}),
      booleanTopology: updateBooleanExactValidationStatus(
        topology.booleanTopology,
        "available"
      ),
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
    code: getDerivedExactMetadataIssueCode(
      metadata.status,
      metadata.error?.code
    ),
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
    booleanTopology: updateBooleanExactValidationStatus(
      topology.booleanTopology,
      getBooleanExactValidationStatusForTopologyIssue(issue.status)
    ),
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

function updateBooleanExactValidationStatus(
  readiness: CadBooleanResultTopologyReadiness | undefined,
  status: CadBooleanResultTopologyDerivedExactValidationStatus
): CadBooleanResultTopologyReadiness | undefined {
  if (!readiness) {
    return undefined;
  }

  return {
    ...readiness,
    derivedExactValidationStatus: status,
    diagnostics: [
      ...readiness.diagnostics.filter(
        (diagnostic) => !diagnostic.code.startsWith("BOOLEAN_EXACT_VALIDATION_")
      ),
      createBooleanExactValidationDiagnostic(status)
    ]
  };
}

function getBooleanExactValidationStatusForTopologyIssue(
  status: CadBodyTopologySnapshot["status"]
): CadBooleanResultTopologyDerivedExactValidationStatus {
  switch (status) {
    case "healthy":
    case "ambiguous":
      return "available";
    case "stale":
      return "stale";
    case "unsupported":
      return "unsupported";
    case "kernel-failed":
      return "failed";
    case "unavailable-binding":
      return "unavailable";
  }
}

function getDerivedExactMetadataIssueCode(
  status: CadBodyDerivedExactMetadataSnapshot["status"],
  errorCode?: string
): CadBodyTopologyIssueCode {
  if (errorCode === "EMPTY_RESULT") {
    return "EMPTY_EXACT_GEOMETRY_RESULT";
  }

  if (errorCode === "INVALID_RESULT") {
    return "INVALID_EXACT_GEOMETRY_RESULT";
  }

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

function createTopologySourceSignature(
  identity: Omit<CadBodyTopologySourceIdentity, "signature">
): string {
  return `body-topology-source:v1:${sha256Hex(
    new TextEncoder().encode(JSON.stringify(identity))
  )}`;
}

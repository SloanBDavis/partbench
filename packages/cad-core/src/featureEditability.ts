import type {
  BodyId,
  CadBodySnapshot,
  CadFeatureEditAffectedSummary,
  CadFeatureEditDiagnostic,
  CadFeatureEditDiagnosticCode,
  CadFeatureEditDiagnosticSeverity,
  CadFeatureEditDryRunStatus,
  CadFeatureEditFieldDescriptor,
  CadFeatureEditProposal,
  CadFeatureEditabilityStatus,
  CadFeatureReferenceChangeCategory,
  CadFeatureReferenceChangeSummary,
  CadFeatureRebuildReadinessStatus,
  CadFeatureSummary,
  CadGeneratedReference,
  CadOpsVersion,
  CadTopologyIdentitySourceSnapshot,
  CadTopologyMatchResult,
  DocumentUnits,
  FeatureExtrudeSide,
  FeatureId,
  FeatureRevolveOperationMode,
  FeatureRevolveProfileKind,
  NamedGeneratedReferenceSnapshot,
  NamedReferenceName,
  SketchEntityId,
  SketchId,
  FeatureEditabilityQueryResponse
} from "@web-cad/cad-protocol";

import {
  createBodyGeneratedReferences,
  type GeneratedReferencesDocument
} from "./generatedReferences";
import {
  createFeatureProfileEditDiagnostic,
  findSketchProfileHealthEntry,
  type SketchProfileHealthEntry
} from "./sketchProfileHealth";
import { createTopologyAnchorReferenceChangesForBody } from "./topologyReferenceHealth";

const SOURCE_BOUNDARY_NOTE =
  "Feature editability is derived from authoritative document source features and semantic generated/named references.";
const DERIVED_BOUNDARY_NOTE =
  "Renderer meshes, OCCT indexes, OPFS paths, file handles, viewport state, and selection-buffer ids are excluded from editability and rebuild identity.";

export interface CreateFeatureEditabilityResponseOptions {
  readonly cadOpsVersion: CadOpsVersion;
  readonly featureId: FeatureId;
  readonly proposedEdit?: CadFeatureEditProposal;
  readonly units: DocumentUnits;
  readonly document: GeneratedReferencesDocument & {
    readonly topologyIdentity?: CadTopologyIdentitySourceSnapshot;
  };
  readonly features: readonly CadFeatureSummary[];
  readonly bodies: readonly CadBodySnapshot[];
  readonly namedReferences: readonly NamedGeneratedReferenceSnapshot[];
  readonly sketchProfileHealth?: readonly SketchProfileHealthEntry[];
  readonly topologyMatchResults?: readonly CadTopologyMatchResult[];
}

export function createFeatureEditabilityResponse(
  options: CreateFeatureEditabilityResponseOptions
): FeatureEditabilityQueryResponse {
  const feature = options.features.find(
    (candidate) => candidate.id === options.featureId
  );

  if (!feature) {
    const diagnostics = [
      createDiagnostic({
        code: "FEATURE_NOT_FOUND",
        severity: "blocker",
        message: `Feature does not exist: ${options.featureId}`,
        featureId: options.featureId
      })
    ];

    return createResponse({
      options,
      status: "missing",
      fields: [],
      diagnostics,
      rebuildStatus: "blocked",
      rebuildDiagnostics: diagnostics,
      dryRunStatus:
        options.proposedEdit === undefined ? "not-requested" : "blocked",
      dryRunDiagnostics: options.proposedEdit === undefined ? [] : diagnostics,
      affected: createAffectedSummary([], [], [], 0, 0),
      referenceChanges: []
    });
  }

  if (feature.kind === "primitive") {
    const diagnostics = [
      createDiagnostic({
        code: "FEATURE_EDIT_UNSUPPORTED",
        severity: "blocker",
        message:
          "Primitive compatibility features are scene-object source and cannot be edited with feature-history controls.",
        featureId: feature.id,
        bodyId: feature.bodyId,
        expected: "authored source feature",
        received: "primitive"
      })
    ];

    return createResponse({
      options,
      feature,
      status: "unsupported",
      fields: [],
      diagnostics,
      rebuildStatus: "unsupported",
      rebuildDiagnostics: diagnostics,
      dryRunStatus:
        options.proposedEdit === undefined ? "not-requested" : "unsupported",
      dryRunDiagnostics: options.proposedEdit === undefined ? [] : diagnostics,
      affected: createAffectedSummary([], [feature.id], [feature.bodyId], 0, 0),
      referenceChanges: createReferenceChangesForBody({
        options,
        bodyId: feature.bodyId,
        sourceFeatureId: feature.id,
        category: "unsupported",
        diagnosticCode: "FEATURE_EDIT_UNSUPPORTED",
        message:
          "Primitive compatibility body references are not source-feature edit references."
      })
    });
  }

  if (feature.kind === "extrude") {
    return createExtrudeEditabilityResponse(options, feature);
  }

  if (feature.kind === "revolve") {
    return createRevolveEditabilityResponse(options, feature);
  }

  if (feature.kind === "hole") {
    return createHoleEditabilityResponse(options, feature);
  }

  if (feature.kind === "chamfer") {
    return createEdgeFinishEditabilityResponse(options, feature);
  }

  if (feature.kind === "fillet") {
    return createEdgeFinishEditabilityResponse(options, feature);
  }

  if (feature.kind === "shell") {
    return createShellEditabilityResponse(options, feature);
  }

  return createDeferredSourceFeatureResponse(options, feature);
}

function createExtrudeEditabilityResponse(
  options: CreateFeatureEditabilityResponseOptions,
  feature: Extract<CadFeatureSummary, { readonly kind: "extrude" }>
): FeatureEditabilityQueryResponse {
  const body = options.bodies.find(
    (candidate) => candidate.id === feature.bodyId
  );
  const scopedRebuildConsumer = getScopedSourceExtrudeRebuildConsumer(
    options,
    feature,
    body
  );
  const scopedRebuildBlocker = scopedRebuildConsumer
    ? undefined
    : getScopedSourceExtrudeRebuildBlocker(options, feature, body);
  const blockingDiagnostics: CadFeatureEditDiagnostic[] = [];
  blockingDiagnostics.push(
    ...createProfileBlockingDiagnostics(options, feature.id)
  );

  if (body?.consumedByFeatureId && !scopedRebuildConsumer) {
    blockingDiagnostics.push(
      createDiagnostic({
        code: "FEATURE_EDIT_CONSUMED_BODY",
        severity: "blocker",
        message: scopedRebuildBlocker
          ? `Feature ${feature.id} cannot be edited safely because downstream result body ${scopedRebuildBlocker.consumerBodyId} is consumed by feature ${scopedRebuildBlocker.nextConsumerId}. Edit or repair that downstream feature before changing the original source.`
          : `Feature ${feature.id} cannot be edited safely because body ${feature.bodyId} is consumed by feature ${body.consumedByFeatureId}.`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        expected: scopedRebuildBlocker
          ? "one direct supported consuming feature"
          : "active feature body",
        received:
          scopedRebuildBlocker?.nextConsumerId ?? body.consumedByFeatureId
      })
    );
  }

  if (feature.operationMode !== "newBody") {
    blockingDiagnostics.push(
      createDiagnostic({
        code: "AMBIGUOUS_RESULT_TOPOLOGY",
        severity: "blocker",
        message:
          "This boolean result feature cannot be edited safely yet because its body-level result topology is only partially proven. Select a command-ready result face or edge for reference operations, or edit the original source feature.",
        featureId: feature.id,
        bodyId: feature.bodyId,
        targetBodyId: feature.targetBodyId,
        expected: "newBody extrude",
        received: feature.operationMode
      })
    );
  }

  const editable = blockingDiagnostics.length === 0;
  const fieldDiagnostics = editable ? [] : blockingDiagnostics;
  const fields: CadFeatureEditFieldDescriptor[] = [
    {
      path: "depth",
      label: "Depth",
      valueType: "number",
      currentValue: feature.depth,
      unit: options.units,
      editable,
      ...(editable
        ? { commitOperation: "feature.updateExtrude" as const }
        : {}),
      diagnostics: fieldDiagnostics
    },
    {
      path: "side",
      label: "Side",
      valueType: "enum",
      currentValue: feature.side,
      enumValues: ["positive", "negative", "symmetric"],
      editable,
      ...(editable
        ? { commitOperation: "feature.updateExtrude" as const }
        : {}),
      diagnostics: fieldDiagnostics
    }
  ];
  const supportDiagnostic = editable
    ? [
        createDiagnostic({
          code: "FEATURE_EDIT_SUPPORTED",
          severity: "info",
          message: scopedRebuildConsumer
            ? "Extrude depth and side can be edited through feature.updateExtrude with one direct downstream rebuild; this query does not mutate document state."
            : "Extrude depth and side can be edited through feature.updateExtrude; this query does not mutate document state.",
          featureId: feature.id,
          bodyId: feature.bodyId
        })
      ]
    : [];
  const scopedRebuildDiagnostics = scopedRebuildConsumer
    ? scopedRebuildConsumer.kind === "hole"
      ? []
      : [
          createDiagnostic({
            code: "AMBIGUOUS_RESULT_TOPOLOGY",
            severity: "warning",
            message:
              "The direct downstream source-model rebuild can commit, but downstream result generated topology remains repair-needed until a later stable-reference tranche proves it.",
            featureId: feature.id,
            bodyId: scopedRebuildConsumer.bodyId,
            targetBodyId: feature.bodyId,
            expected: "command-ready downstream result topology",
            received: scopedRebuildConsumer.kind
          })
        ]
    : [];
  const diagnostics = [
    ...supportDiagnostic,
    ...scopedRebuildDiagnostics,
    ...blockingDiagnostics
  ];
  const dryRunDiagnostics = createExtrudeDryRunDiagnostics(
    feature,
    options.proposedEdit,
    blockingDiagnostics
  );
  const dryRunStatus = chooseExtrudeDryRunStatus(
    options.proposedEdit,
    editable,
    dryRunDiagnostics
  );
  const referenceCategory: CadFeatureReferenceChangeCategory = editable
    ? scopedRebuildConsumer
      ? "consumed"
      : "active"
    : body?.consumedByFeatureId
      ? "consumed"
      : "ambiguous";
  const affectedFeatureIds = scopedRebuildConsumer
    ? [feature.id, scopedRebuildConsumer.id]
    : [feature.id];
  const affectedBodyIds = scopedRebuildConsumer
    ? [feature.bodyId, scopedRebuildConsumer.bodyId]
    : [feature.bodyId, ...(feature.targetBodyId ? [feature.targetBodyId] : [])];
  const generatedReferenceCount =
    countGeneratedReferences(options, feature.bodyId) +
    (scopedRebuildConsumer
      ? countGeneratedReferences(options, scopedRebuildConsumer.bodyId)
      : 0);
  const namedReferenceCount =
    countNamedReferences(options, feature.bodyId) +
    (scopedRebuildConsumer
      ? countNamedReferences(options, scopedRebuildConsumer.bodyId)
      : 0);
  const affected = createAffectedSummary(
    [
      feature.sketchId,
      ...(scopedRebuildConsumer && "sketchId" in scopedRebuildConsumer
        ? [scopedRebuildConsumer.sketchId]
        : [])
    ],
    affectedFeatureIds,
    affectedBodyIds,
    generatedReferenceCount,
    namedReferenceCount
  );
  const sourceReferenceChanges = createReferenceChangesForBody({
    options,
    bodyId: feature.bodyId,
    sourceFeatureId: feature.id,
    targetFeatureId: scopedRebuildConsumer?.id,
    category: referenceCategory,
    diagnosticCode: editable
      ? scopedRebuildConsumer
        ? "CONSUMED_REFERENCE_NOT_COMMAND_READY"
        : undefined
      : body?.consumedByFeatureId
        ? "FEATURE_EDIT_CONSUMED_BODY"
        : "AMBIGUOUS_RESULT_TOPOLOGY",
    message: editable
      ? scopedRebuildConsumer
        ? "Source references remain consumed while the direct downstream feature is rebuilt."
        : "Source generated references are active for this supported edit query."
      : "Source generated references require review before a committed edit can be considered command-ready."
  });
  const resultReferenceChanges = scopedRebuildConsumer
    ? [
        ...createScopedResultActiveReferenceChanges({
          options,
          sourceFeature: feature,
          consumingFeature: scopedRebuildConsumer
        }),
        createReferenceChange({
          category:
            scopedRebuildConsumer.kind === "hole" ? "active" : "replaced",
          bodyId: scopedRebuildConsumer.bodyId,
          sourceFeatureId: feature.id,
          targetFeatureId: scopedRebuildConsumer.id,
          ...(scopedRebuildConsumer.kind === "hole"
            ? {}
            : { diagnosticCode: "AMBIGUOUS_RESULT_TOPOLOGY" as const }),
          message:
            scopedRebuildConsumer.kind === "hole"
              ? "Direct downstream hole result references can be revalidated from source records."
              : "Direct downstream result can be revalidated from source records, but generated result topology remains repair-needed."
        })
      ]
    : [];

  return createResponse({
    options,
    feature,
    status: editable ? "editable" : "blocked",
    fields,
    diagnostics,
    rebuildStatus: editable ? "ready" : "blocked",
    rebuildDiagnostics: [...scopedRebuildDiagnostics, ...blockingDiagnostics],
    dryRunStatus,
    dryRunDiagnostics,
    commitOperation: "feature.updateExtrude",
    affected,
    referenceChanges: [...sourceReferenceChanges, ...resultReferenceChanges]
  });
}

function createRevolveEditabilityResponse(
  options: CreateFeatureEditabilityResponseOptions,
  feature: Extract<CadFeatureSummary, { readonly kind: "revolve" }>
): FeatureEditabilityQueryResponse {
  const body = options.bodies.find(
    (candidate) => candidate.id === feature.bodyId
  );
  const blockingDiagnostics = createResultBodyBlockingDiagnostics(
    feature.id,
    feature.bodyId,
    body?.consumedByFeatureId,
    "feature.updateRevolve"
  );
  blockingDiagnostics.push(
    ...createProfileBlockingDiagnostics(options, feature.id)
  );

  if (feature.operationMode !== "newBody") {
    blockingDiagnostics.push(
      createDiagnostic({
        code: "AMBIGUOUS_RESULT_TOPOLOGY",
        severity: "blocker",
        message:
          "This revolve result feature cannot be edited safely yet because downstream result topology is not command-ready.",
        featureId: feature.id,
        bodyId: feature.bodyId,
        targetBodyId: feature.targetBodyId,
        expected: "newBody revolve",
        received: feature.operationMode
      })
    );
  }

  return createSourceParameterEditabilityResponse({
    options,
    feature,
    fields: [
      {
        path: "angleDegrees",
        label: "Angle",
        valueType: "number",
        currentValue: feature.angleDegrees,
        unit: "deg"
      }
    ],
    blockingDiagnostics,
    commitOperation: "feature.updateRevolve",
    supportMessage:
      "Revolve angle can be edited through feature.updateRevolve; this query does not mutate document state.",
    dryRunDiagnostics: createRevolveDryRunDiagnostics(
      feature,
      options.proposedEdit,
      blockingDiagnostics
    ),
    affectedSketchIds: [feature.sketchId],
    affectedBodyIds: [feature.bodyId],
    referenceChanges: createRepairNeededResultReferenceChanges(feature)
  });
}

function createProfileBlockingDiagnostics(
  options: CreateFeatureEditabilityResponseOptions,
  featureId: FeatureId
): readonly CadFeatureEditDiagnostic[] {
  const profileHealth = findSketchProfileHealthEntry(
    options.sketchProfileHealth ?? [],
    featureId
  );

  return profileHealth && profileHealth.status !== "ready"
    ? [createFeatureProfileEditDiagnostic(profileHealth)]
    : [];
}

function createHoleEditabilityResponse(
  options: CreateFeatureEditabilityResponseOptions,
  feature: Extract<CadFeatureSummary, { readonly kind: "hole" }>
): FeatureEditabilityQueryResponse {
  const body = options.bodies.find(
    (candidate) => candidate.id === feature.bodyId
  );
  const targetBody = options.bodies.find(
    (candidate) => candidate.id === feature.targetBodyId
  );
  const blockingDiagnostics = createResultBodyBlockingDiagnostics(
    feature.id,
    feature.bodyId,
    body?.consumedByFeatureId,
    "feature.updateHole"
  );
  blockingDiagnostics.push(
    ...createProfileBlockingDiagnostics(options, feature.id)
  );

  if (targetBody?.consumedByFeatureId !== feature.id) {
    blockingDiagnostics.push(
      createDiagnostic({
        code: "CONSUMED_REFERENCE_NOT_COMMAND_READY",
        severity: "blocker",
        message:
          "Hole edits require the target body to be consumed by the hole feature being edited.",
        featureId: feature.id,
        bodyId: feature.bodyId,
        targetBodyId: feature.targetBodyId,
        expected: feature.id,
        received: targetBody?.consumedByFeatureId ?? "active target body"
      })
    );
  }

  return createSourceParameterEditabilityResponse({
    options,
    feature,
    fields: [
      {
        path: "depthMode",
        label: "Depth mode",
        valueType: "enum",
        currentValue: feature.depthMode,
        enumValues: ["throughAll", "blind"]
      },
      {
        path: "depth",
        label: "Depth",
        valueType: "number",
        currentValue: feature.depth,
        unit: options.units
      },
      {
        path: "direction",
        label: "Direction",
        valueType: "enum",
        currentValue: feature.direction,
        enumValues: ["positive", "negative"]
      }
    ],
    blockingDiagnostics,
    commitOperation: "feature.updateHole",
    supportMessage:
      "Hole depth mode, depth, and direction can be edited through feature.updateHole; this query does not mutate document state.",
    dryRunDiagnostics: createHoleDryRunDiagnostics(
      feature,
      options.proposedEdit,
      blockingDiagnostics
    ),
    affectedSketchIds: [feature.sketchId],
    affectedBodyIds: [feature.bodyId, feature.targetBodyId],
    referenceChanges: createRepairNeededResultReferenceChanges(feature)
  });
}

function createEdgeFinishEditabilityResponse(
  options: CreateFeatureEditabilityResponseOptions,
  feature: Extract<CadFeatureSummary, { readonly kind: "chamfer" | "fillet" }>
): FeatureEditabilityQueryResponse {
  const body = options.bodies.find(
    (candidate) => candidate.id === feature.bodyId
  );
  const targetBody = options.bodies.find(
    (candidate) => candidate.id === feature.targetBodyId
  );
  const blockingDiagnostics = createResultBodyBlockingDiagnostics(
    feature.id,
    feature.bodyId,
    body?.consumedByFeatureId,
    feature.kind === "chamfer"
      ? "feature.updateChamfer"
      : "feature.updateFillet"
  );

  if (targetBody?.consumedByFeatureId !== feature.id) {
    blockingDiagnostics.push(
      createDiagnostic({
        code: "CONSUMED_REFERENCE_NOT_COMMAND_READY",
        severity: "blocker",
        message:
          "Edge-finish edits require the target body to be consumed by the chamfer/fillet feature being edited.",
        featureId: feature.id,
        bodyId: feature.bodyId,
        targetBodyId: feature.targetBodyId,
        stableId: feature.edgeStableId,
        referenceName: feature.namedReference,
        topologyAnchorId: feature.topologyAnchorId,
        expected: feature.id,
        received: targetBody?.consumedByFeatureId ?? "active target body"
      })
    );
  }

  const isChamfer = feature.kind === "chamfer";
  const scalarPath = isChamfer ? "distance" : "radius";

  return createSourceParameterEditabilityResponse({
    options,
    feature,
    fields: [
      {
        path: scalarPath,
        label: isChamfer ? "Distance" : "Radius",
        valueType: "number",
        currentValue: isChamfer ? feature.distance : feature.radius,
        unit: options.units
      },
      {
        path: feature.topologyAnchorId
          ? "topologyAnchorId"
          : feature.namedReference
            ? "namedReference"
            : "edgeStableId",
        label: feature.topologyAnchorId
          ? "Topology anchor"
          : feature.namedReference
            ? "Named reference"
            : "Edge reference",
        valueType: "reference",
        currentValue:
          feature.topologyAnchorId ??
          feature.namedReference ??
          feature.edgeStableId
      }
    ],
    blockingDiagnostics,
    commitOperation: isChamfer
      ? "feature.updateChamfer"
      : "feature.updateFillet",
    supportMessage: isChamfer
      ? "Chamfer distance can be edited through feature.updateChamfer; this query does not mutate document state."
      : "Fillet radius can be edited through feature.updateFillet; this query does not mutate document state.",
    dryRunDiagnostics: isChamfer
      ? createChamferDryRunDiagnostics(
          feature,
          options.proposedEdit,
          blockingDiagnostics
        )
      : createFilletDryRunDiagnostics(
          feature,
          options.proposedEdit,
          blockingDiagnostics
        ),
    affectedSketchIds: [],
    affectedBodyIds: [feature.bodyId, feature.targetBodyId],
    referenceChanges: createRepairNeededResultReferenceChanges(feature)
  });
}

function createShellEditabilityResponse(
  options: CreateFeatureEditabilityResponseOptions,
  feature: Extract<CadFeatureSummary, { readonly kind: "shell" }>
): FeatureEditabilityQueryResponse {
  const body = options.bodies.find(
    (candidate) => candidate.id === feature.bodyId
  );
  const targetBody = options.bodies.find(
    (candidate) => candidate.id === feature.targetBodyId
  );
  const blockingDiagnostics = createResultBodyBlockingDiagnostics(
    feature.id,
    feature.bodyId,
    body?.consumedByFeatureId,
    "feature.updateShell"
  );

  if (targetBody?.consumedByFeatureId !== feature.id) {
    blockingDiagnostics.push(
      createDiagnostic({
        code: "CONSUMED_REFERENCE_NOT_COMMAND_READY",
        severity: "blocker",
        message:
          "Shell edits require the target body to be consumed by the shell feature being edited.",
        featureId: feature.id,
        bodyId: feature.bodyId,
        targetBodyId: feature.targetBodyId,
        expected: feature.id,
        received: targetBody?.consumedByFeatureId ?? "active target body"
      })
    );
  }

  return createSourceParameterEditabilityResponse({
    options,
    feature,
    fields: [
      {
        path: "wallThickness",
        label: "Wall thickness",
        valueType: "number",
        currentValue: feature.wallThickness,
        unit: options.units
      },
      {
        path: "openFaceRefs",
        label: "Open faces",
        valueType: "reference",
        currentValue: `${feature.openFaceRefs.length} open face${feature.openFaceRefs.length === 1 ? "" : "s"}`
      }
    ],
    blockingDiagnostics,
    commitOperation: "feature.updateShell",
    supportMessage:
      "Shell wall thickness and open faces can be edited through feature.updateShell; this query does not mutate document state.",
    dryRunDiagnostics: createShellDryRunDiagnostics(
      feature,
      options.proposedEdit,
      blockingDiagnostics
    ),
    affectedSketchIds: [],
    affectedBodyIds: [feature.bodyId, feature.targetBodyId],
    referenceChanges: createRepairNeededResultReferenceChanges(feature)
  });
}

interface SourceEditableFieldInput {
  readonly path: string;
  readonly label: string;
  readonly valueType: CadFeatureEditFieldDescriptor["valueType"];
  readonly currentValue?: number | string;
  readonly unit?: CadFeatureEditFieldDescriptor["unit"];
  readonly enumValues?: readonly string[];
}

function createSourceParameterEditabilityResponse(args: {
  readonly options: CreateFeatureEditabilityResponseOptions;
  readonly feature: Exclude<CadFeatureSummary, { readonly kind: "primitive" }>;
  readonly fields: readonly SourceEditableFieldInput[];
  readonly blockingDiagnostics: readonly CadFeatureEditDiagnostic[];
  readonly commitOperation: CadFeatureEditFieldDescriptor["commitOperation"];
  readonly supportMessage: string;
  readonly dryRunDiagnostics: readonly CadFeatureEditDiagnostic[];
  readonly affectedSketchIds: readonly SketchId[];
  readonly affectedBodyIds: readonly BodyId[];
  readonly referenceChanges: readonly CadFeatureReferenceChangeSummary[];
}): FeatureEditabilityQueryResponse {
  const editable = args.blockingDiagnostics.length === 0;
  const fieldDiagnostics = editable ? [] : args.blockingDiagnostics;
  const fields = args.fields.map((field) => ({
    ...field,
    editable: field.valueType === "reference" ? false : editable,
    ...(editable && field.valueType !== "reference"
      ? { commitOperation: args.commitOperation }
      : {}),
    diagnostics:
      field.valueType === "reference"
        ? [
            createDiagnostic({
              code: "FEATURE_EDIT_UNSUPPORTED",
              severity: "warning",
              message:
                "Reference retargeting is not supported here; only scalar/source parameter edits are available.",
              featureId: args.feature.id,
              bodyId: args.feature.bodyId,
              fieldPath: field.path
            })
          ]
        : fieldDiagnostics
  }));
  const supportDiagnostic = editable
    ? [
        createDiagnostic({
          code: "FEATURE_EDIT_SUPPORTED",
          severity: "info",
          message: args.supportMessage,
          featureId: args.feature.id,
          bodyId: args.feature.bodyId
        })
      ]
    : [];
  const topologyDiagnostic = editable
    ? [
        createDiagnostic({
          code: "AMBIGUOUS_RESULT_TOPOLOGY",
          severity: "warning",
          message:
            "Committed source parameter edits are supported, but result-body generated topology remains repair-needed until a later stable-reference tranche proves it.",
          featureId: args.feature.id,
          bodyId: args.feature.bodyId
        })
      ]
    : [];
  const diagnostics = [
    ...supportDiagnostic,
    ...topologyDiagnostic,
    ...args.blockingDiagnostics
  ];
  const dryRunStatus = chooseSourceDryRunStatus(
    args.options.proposedEdit,
    editable,
    args.dryRunDiagnostics
  );
  const targetBodyIds =
    "targetBodyId" in args.feature && args.feature.targetBodyId
      ? [args.feature.targetBodyId]
      : [];

  return createResponse({
    options: args.options,
    feature: args.feature,
    status: editable ? "editable" : "blocked",
    fields,
    diagnostics,
    rebuildStatus: editable ? "ready" : "blocked",
    rebuildDiagnostics: [...topologyDiagnostic, ...args.blockingDiagnostics],
    dryRunStatus,
    dryRunDiagnostics: args.dryRunDiagnostics,
    commitOperation: args.commitOperation,
    affected: createAffectedSummary(
      args.affectedSketchIds,
      [args.feature.id],
      [...args.affectedBodyIds, ...targetBodyIds],
      countGeneratedReferences(args.options, args.feature.bodyId),
      countNamedReferences(args.options, args.feature.bodyId)
    ),
    referenceChanges: args.referenceChanges
  });
}

function createResultBodyBlockingDiagnostics(
  featureId: FeatureId,
  bodyId: BodyId,
  consumedByFeatureId: FeatureId | undefined,
  operation: CadFeatureEditFieldDescriptor["commitOperation"]
): CadFeatureEditDiagnostic[] {
  if (!consumedByFeatureId) {
    return [];
  }

  return [
    createDiagnostic({
      code: "FEATURE_EDIT_CONSUMED_BODY",
      severity: "blocker",
      message: `Feature ${featureId} cannot be edited safely through ${operation} because result body ${bodyId} is consumed by feature ${consumedByFeatureId}.`,
      featureId,
      bodyId,
      expected: "active feature result body",
      received: consumedByFeatureId
    })
  ];
}

function getScopedSourceExtrudeRebuildConsumer(
  options: CreateFeatureEditabilityResponseOptions,
  feature: Extract<CadFeatureSummary, { readonly kind: "extrude" }>,
  body: CadBodySnapshot | undefined
): Exclude<CadFeatureSummary, { readonly kind: "primitive" }> | undefined {
  if (!body?.consumedByFeatureId || feature.operationMode !== "newBody") {
    return undefined;
  }

  const consumer = options.features.find(
    (
      candidate
    ): candidate is Exclude<
      CadFeatureSummary,
      { readonly kind: "primitive" }
    > =>
      candidate.kind !== "primitive" &&
      candidate.id === body.consumedByFeatureId &&
      "targetBodyId" in candidate &&
      candidate.targetBodyId === feature.bodyId
  );
  const consumerBody = consumer
    ? options.bodies.find((candidate) => candidate.id === consumer.bodyId)
    : undefined;

  if (!consumer || consumerBody?.consumedByFeatureId) {
    return undefined;
  }

  if (consumer.kind === "hole") {
    return isSourceExtrudeProfileSupportedForConsumingFeature(feature) &&
      isValidHoleConsumer(options, consumer)
      ? consumer
      : undefined;
  }

  if (consumer.kind === "chamfer" || consumer.kind === "fillet") {
    return isSourceExtrudeProfileSupportedForConsumingFeature(feature) &&
      isValidEdgeFinishConsumer(options, consumer)
      ? consumer
      : undefined;
  }

  if (
    consumer.kind === "extrude" &&
    consumer.operationMode === "cut" &&
    isBooleanToolProfileSupportedForConsumingFeature(consumer) &&
    isSourceExtrudeProfileSupportedForConsumingFeature(feature)
  ) {
    return consumer;
  }

  if (
    consumer.kind === "extrude" &&
    consumer.operationMode === "add" &&
    isBooleanToolProfileSupportedForConsumingFeature(consumer) &&
    feature.profileKind === "rectangle"
  ) {
    return consumer;
  }

  return undefined;
}

function getScopedSourceExtrudeRebuildBlocker(
  options: CreateFeatureEditabilityResponseOptions,
  feature: Extract<CadFeatureSummary, { readonly kind: "extrude" }>,
  body: CadBodySnapshot | undefined
):
  | { readonly consumerBodyId: BodyId; readonly nextConsumerId: FeatureId }
  | undefined {
  if (!body?.consumedByFeatureId || feature.operationMode !== "newBody") {
    return undefined;
  }

  const consumer = options.features.find(
    (
      candidate
    ): candidate is Exclude<
      CadFeatureSummary,
      { readonly kind: "primitive" }
    > =>
      candidate.kind !== "primitive" &&
      candidate.id === body.consumedByFeatureId &&
      "targetBodyId" in candidate &&
      candidate.targetBodyId === feature.bodyId
  );
  const nextConsumerId = consumer
    ? options.bodies.find((candidate) => candidate.id === consumer.bodyId)
        ?.consumedByFeatureId
    : undefined;

  return consumer && nextConsumerId
    ? { consumerBodyId: consumer.bodyId, nextConsumerId }
    : undefined;
}

function isSourceExtrudeProfileSupportedForConsumingFeature(
  feature: Extract<CadFeatureSummary, { readonly kind: "extrude" }>
): boolean {
  return (
    feature.profileKind === "rectangle" || feature.profileKind === "circle"
  );
}

function isBooleanToolProfileSupportedForConsumingFeature(
  feature: Exclude<CadFeatureSummary, { readonly kind: "primitive" }>
): boolean {
  return (
    "profileKind" in feature &&
    (feature.profileKind === "rectangle" || feature.profileKind === "circle")
  );
}

function isValidHoleConsumer(
  options: CreateFeatureEditabilityResponseOptions,
  consumer: Extract<CadFeatureSummary, { readonly kind: "hole" }>
): boolean {
  const sketch = options.document.sketches.get(consumer.sketchId);
  const entity = sketch?.entities.get(consumer.circleEntityId);

  return entity?.kind === "circle";
}

function isValidEdgeFinishConsumer(
  options: CreateFeatureEditabilityResponseOptions,
  consumer: Extract<CadFeatureSummary, { readonly kind: "chamfer" | "fillet" }>
): boolean {
  const stableId =
    consumer.edgeStableId ??
    (consumer.namedReference
      ? options.namedReferences.find(
          (reference) => reference.name === consumer.namedReference
        )?.stableId
      : undefined);

  if (!stableId) {
    return false;
  }

  const generatedReferences = createBodyGeneratedReferences(
    options.document,
    consumer.targetBodyId,
    "part:default"
  );

  return (
    generatedReferences?.edges.some(
      (reference) => reference.stableId === stableId
    ) ?? false
  );
}

function createRepairNeededResultReferenceChanges(
  feature: Exclude<CadFeatureSummary, { readonly kind: "primitive" }>
): readonly CadFeatureReferenceChangeSummary[] {
  return [
    createReferenceChange({
      category: "repair-needed",
      bodyId: feature.bodyId,
      sourceFeatureId: feature.id,
      diagnosticCode: "AMBIGUOUS_RESULT_TOPOLOGY",
      message:
        "Result-body generated references remain repair-needed for this feature family."
    })
  ];
}

function createScopedResultActiveReferenceChanges(args: {
  readonly options: CreateFeatureEditabilityResponseOptions;
  readonly sourceFeature: Extract<
    CadFeatureSummary,
    { readonly kind: "extrude" }
  >;
  readonly consumingFeature: Exclude<
    CadFeatureSummary,
    { readonly kind: "primitive" }
  >;
}): readonly CadFeatureReferenceChangeSummary[] {
  if (
    args.consumingFeature.kind !== "extrude" ||
    (args.consumingFeature.operationMode !== "cut" &&
      args.consumingFeature.operationMode !== "add")
  ) {
    return [];
  }

  const references = createBodyGeneratedReferences(
    args.options.document,
    args.consumingFeature.bodyId,
    "part:default"
  );
  const commandReadyReferences = listGeneratedReferences(references).filter(
    (reference) => reference.eligibleOperations.length > 0
  );
  const commandReadyStableIds = new Set(
    commandReadyReferences.map((reference) => reference.stableId)
  );
  const generatedReferenceChanges = commandReadyReferences.map((reference) =>
    createReferenceChange({
      category: "active",
      bodyId: args.consumingFeature.bodyId,
      stableId: reference.stableId,
      kind: reference.kind,
      sourceFeatureId: args.sourceFeature.id,
      targetFeatureId: args.consumingFeature.id,
      message:
        "Source-semantic result generated reference remains active after downstream source-model revalidation."
    })
  );
  const namedReferenceChanges = args.options.namedReferences
    .filter(
      (reference) =>
        reference.bodyId === args.consumingFeature.bodyId &&
        commandReadyStableIds.has(reference.stableId)
    )
    .map((reference) =>
      createNamedReferenceChange({
        name: reference.name,
        bodyId: reference.bodyId,
        stableId: reference.stableId,
        kind: reference.kind,
        category: "active",
        sourceFeatureId: args.sourceFeature.id,
        targetFeatureId: args.consumingFeature.id,
        message:
          "Source-semantic result named reference remains active after downstream source-model revalidation."
      })
    );

  return [...generatedReferenceChanges, ...namedReferenceChanges];
}

function createDeferredSourceFeatureResponse(
  options: CreateFeatureEditabilityResponseOptions,
  feature: Exclude<
    CadFeatureSummary,
    Extract<CadFeatureSummary, { readonly kind: "primitive" | "extrude" }>
  >
): FeatureEditabilityQueryResponse {
  const diagnostics = [
    createDiagnostic({
      code: "FEATURE_EDIT_COMMIT_DEFERRED",
      severity: "warning",
      message: `This ${feature.kind} feature has describable source fields, but committed editing is not supported yet.`,
      featureId: feature.id,
      bodyId: feature.bodyId,
      expected: "query-only editability contract",
      received: feature.kind
    }),
    createDiagnostic({
      code: "FEATURE_REBUILD_DEFERRED",
      severity: "warning",
      message:
        "Full transactional rebuild and downstream topology/reference repair are deferred for this source feature type.",
      featureId: feature.id,
      bodyId: feature.bodyId
    }),
    createDiagnostic({
      code: "REFERENCE_HEALTH_DEFERRED",
      severity: "warning",
      message:
        "Generated and named reference survival requires explicit repair support for this source feature type.",
      featureId: feature.id,
      bodyId: feature.bodyId
    })
  ];
  const fields = createDeferredFields(options.units, feature, diagnostics);
  const targetBodyIds =
    "targetBodyId" in feature && feature.targetBodyId
      ? [feature.targetBodyId]
      : [];
  const sourceSketchIds = "sketchId" in feature ? [feature.sketchId] : [];
  const sourceNamedReferences =
    "namedReference" in feature && feature.namedReference
      ? [feature.namedReference]
      : [];

  return createResponse({
    options,
    feature,
    status: "unsupported",
    fields,
    diagnostics,
    rebuildStatus: "deferred",
    rebuildDiagnostics: diagnostics,
    dryRunStatus:
      options.proposedEdit === undefined ? "not-requested" : "unsupported",
    dryRunDiagnostics: options.proposedEdit === undefined ? [] : diagnostics,
    affected: createAffectedSummary(
      sourceSketchIds,
      [feature.id],
      [feature.bodyId, ...targetBodyIds],
      countGeneratedReferences(options, feature.bodyId),
      countNamedReferences(options, feature.bodyId) +
        sourceNamedReferences.length
    ),
    referenceChanges: [
      ...createReferenceChangesForBody({
        options,
        bodyId: feature.bodyId,
        sourceFeatureId: feature.id,
        category: "unsupported",
        diagnosticCode: "FEATURE_EDIT_COMMIT_DEFERRED",
        message:
          "Generated references on this feature body are not command-ready for committed source edits yet."
      }),
      ...sourceNamedReferences.map((name) =>
        createNamedReferenceChange({
          name,
          bodyId:
            "targetBodyId" in feature && feature.targetBodyId
              ? feature.targetBodyId
              : feature.bodyId,
          category: "repair-needed",
          sourceFeatureId: feature.id,
          diagnosticCode: "REFERENCE_HEALTH_DEFERRED",
          message:
            "Source named reference repair is deferred for this feature edit query."
        })
      )
    ]
  });
}

function createDeferredFields(
  units: DocumentUnits,
  feature: Exclude<
    CadFeatureSummary,
    Extract<CadFeatureSummary, { readonly kind: "primitive" | "extrude" }>
  >,
  diagnostics: readonly CadFeatureEditDiagnostic[]
): readonly CadFeatureEditFieldDescriptor[] {
  if (feature.kind === "revolve") {
    return [
      {
        path: "angleDegrees",
        label: "Angle",
        valueType: "number",
        currentValue: feature.angleDegrees,
        unit: "deg",
        editable: false,
        diagnostics
      },
      {
        path: "operationMode",
        label: "Operation",
        valueType: "enum",
        currentValue: feature.operationMode,
        enumValues: [
          "newBody",
          "add",
          "cut"
        ] satisfies readonly FeatureRevolveOperationMode[],
        editable: false,
        diagnostics
      },
      {
        path: "profileKind",
        label: "Profile",
        valueType: "enum",
        currentValue: feature.profileKind,
        enumValues: [
          "rectangle",
          "circle"
        ] satisfies readonly FeatureRevolveProfileKind[],
        editable: false,
        diagnostics
      }
    ];
  }

  if (feature.kind === "hole") {
    return [
      {
        path: "depthMode",
        label: "Depth mode",
        valueType: "enum",
        currentValue: feature.depthMode,
        enumValues: ["throughAll", "blind"],
        editable: false,
        diagnostics
      },
      {
        path: "depth",
        label: "Depth",
        valueType: "number",
        currentValue: feature.depth,
        unit: units,
        editable: false,
        diagnostics
      },
      {
        path: "direction",
        label: "Direction",
        valueType: "enum",
        currentValue: feature.direction,
        enumValues: ["positive", "negative"],
        editable: false,
        diagnostics
      }
    ];
  }

  if (feature.kind === "chamfer") {
    return [
      {
        path: "distance",
        label: "Distance",
        valueType: "number",
        currentValue: feature.distance,
        unit: units,
        editable: false,
        diagnostics
      },
      createReferenceField(feature, diagnostics)
    ];
  }

  if (
    feature.kind === "importedBody" ||
    feature.kind === "linearPattern" ||
    feature.kind === "circularPattern" ||
    feature.kind === "mirror" ||
    feature.kind === "shell"
  ) {
    return [];
  }

  return [
    {
      path: "radius",
      label: "Radius",
      valueType: "number",
      currentValue: feature.radius,
      unit: units,
      editable: false,
      diagnostics
    },
    createReferenceField(feature, diagnostics)
  ];
}

function createReferenceField(
  feature: Extract<CadFeatureSummary, { readonly kind: "chamfer" | "fillet" }>,
  diagnostics: readonly CadFeatureEditDiagnostic[]
): CadFeatureEditFieldDescriptor {
  return {
    path: feature.topologyAnchorId
      ? "topologyAnchorId"
      : feature.namedReference
        ? "namedReference"
        : "edgeStableId",
    label: feature.topologyAnchorId
      ? "Topology anchor"
      : feature.namedReference
        ? "Named reference"
        : "Edge reference",
    valueType: "reference",
    currentValue:
      feature.topologyAnchorId ??
      feature.namedReference ??
      feature.edgeStableId,
    editable: false,
    diagnostics
  };
}

function createExtrudeDryRunDiagnostics(
  feature: Extract<CadFeatureSummary, { readonly kind: "extrude" }>,
  proposedEdit: CadFeatureEditProposal | undefined,
  blockingDiagnostics: readonly CadFeatureEditDiagnostic[]
): readonly CadFeatureEditDiagnostic[] {
  if (proposedEdit === undefined) {
    return [];
  }

  if (blockingDiagnostics.length > 0) {
    return blockingDiagnostics;
  }

  const diagnostics: CadFeatureEditDiagnostic[] = [];

  if (proposedEdit.kind !== "extrude") {
    diagnostics.push(
      createDiagnostic({
        code: "FEATURE_EDIT_INVALID_PROPOSAL",
        severity: "blocker",
        message: "Extrude editability dry-run expects an extrude proposal.",
        featureId: feature.id,
        bodyId: feature.bodyId,
        fieldPath: "kind",
        expected: "extrude",
        received: proposedEdit.kind
      })
    );
    return diagnostics;
  }

  if (proposedEdit.depth === undefined && proposedEdit.side === undefined) {
    diagnostics.push(
      createDiagnostic({
        code: "FEATURE_EDIT_INVALID_PROPOSAL",
        severity: "blocker",
        message: "Extrude edit dry-run requires depth or side.",
        featureId: feature.id,
        bodyId: feature.bodyId,
        expected: "depth or side",
        received: "no editable fields"
      })
    );
  }

  if (
    proposedEdit.depth !== undefined &&
    (!Number.isFinite(proposedEdit.depth) || proposedEdit.depth <= 0)
  ) {
    diagnostics.push(
      createDiagnostic({
        code: "FEATURE_EDIT_INVALID_PROPOSAL",
        severity: "blocker",
        message: "Extrude depth must be a finite number greater than zero.",
        featureId: feature.id,
        bodyId: feature.bodyId,
        fieldPath: "depth",
        expected: "finite positive number",
        received: String(proposedEdit.depth)
      })
    );
  }

  if (
    proposedEdit.side !== undefined &&
    !isFeatureExtrudeSide(proposedEdit.side)
  ) {
    diagnostics.push(
      createDiagnostic({
        code: "FEATURE_EDIT_INVALID_PROPOSAL",
        severity: "blocker",
        message: "Extrude side must be positive, negative, or symmetric.",
        featureId: feature.id,
        bodyId: feature.bodyId,
        fieldPath: "side",
        expected: "positive | negative | symmetric",
        received: String(proposedEdit.side)
      })
    );
  }

  return diagnostics;
}

function createRevolveDryRunDiagnostics(
  feature: Extract<CadFeatureSummary, { readonly kind: "revolve" }>,
  proposedEdit: CadFeatureEditProposal | undefined,
  blockingDiagnostics: readonly CadFeatureEditDiagnostic[]
): readonly CadFeatureEditDiagnostic[] {
  if (proposedEdit === undefined) {
    return [];
  }

  if (blockingDiagnostics.length > 0) {
    return blockingDiagnostics;
  }

  const diagnostics = createKindAndFieldDiagnostics(
    feature,
    proposedEdit,
    "revolve",
    ["angleDegrees"]
  );

  if (
    proposedEdit.kind === "revolve" &&
    proposedEdit.angleDegrees !== undefined &&
    (!Number.isFinite(proposedEdit.angleDegrees) ||
      proposedEdit.angleDegrees <= 0 ||
      proposedEdit.angleDegrees > 360)
  ) {
    diagnostics.push(
      createDiagnostic({
        code: "FEATURE_EDIT_INVALID_PROPOSAL",
        severity: "blocker",
        message:
          "Revolve angleDegrees must be a finite number greater than zero and <= 360.",
        featureId: feature.id,
        bodyId: feature.bodyId,
        fieldPath: "angleDegrees",
        expected: "finite positive number <= 360",
        received: String(proposedEdit.angleDegrees)
      })
    );
  }

  return diagnostics;
}

function createHoleDryRunDiagnostics(
  feature: Extract<CadFeatureSummary, { readonly kind: "hole" }>,
  proposedEdit: CadFeatureEditProposal | undefined,
  blockingDiagnostics: readonly CadFeatureEditDiagnostic[]
): readonly CadFeatureEditDiagnostic[] {
  if (proposedEdit === undefined) {
    return [];
  }

  if (blockingDiagnostics.length > 0) {
    return blockingDiagnostics;
  }

  const diagnostics = createKindAndFieldDiagnostics(
    feature,
    proposedEdit,
    "hole",
    ["depthMode", "depth", "direction"]
  );

  if (proposedEdit.kind !== "hole") {
    return diagnostics;
  }

  if (
    proposedEdit.depthMode !== undefined &&
    proposedEdit.depthMode !== "blind" &&
    proposedEdit.depthMode !== "throughAll"
  ) {
    diagnostics.push(
      createInvalidProposalDiagnostic(
        feature,
        "depthMode",
        "blind | throughAll",
        String(proposedEdit.depthMode)
      )
    );
  }

  if (
    proposedEdit.direction !== undefined &&
    proposedEdit.direction !== "positive" &&
    proposedEdit.direction !== "negative"
  ) {
    diagnostics.push(
      createInvalidProposalDiagnostic(
        feature,
        "direction",
        "positive | negative",
        String(proposedEdit.direction)
      )
    );
  }

  const depthMode = proposedEdit.depthMode ?? feature.depthMode;
  const depth =
    proposedEdit.depth !== undefined
      ? proposedEdit.depth
      : depthMode === feature.depthMode
        ? feature.depth
        : undefined;

  if (depthMode === "blind") {
    if (depth === undefined || !Number.isFinite(depth) || depth <= 0) {
      diagnostics.push(
        createInvalidProposalDiagnostic(
          feature,
          "depth",
          "finite positive number for blind hole",
          String(depth)
        )
      );
    }
  } else if (proposedEdit.depth !== undefined) {
    diagnostics.push(
      createInvalidProposalDiagnostic(
        feature,
        "depth",
        "omitted depth for throughAll hole",
        String(proposedEdit.depth)
      )
    );
  }

  return diagnostics;
}

function createChamferDryRunDiagnostics(
  feature: Extract<CadFeatureSummary, { readonly kind: "chamfer" }>,
  proposedEdit: CadFeatureEditProposal | undefined,
  blockingDiagnostics: readonly CadFeatureEditDiagnostic[]
): readonly CadFeatureEditDiagnostic[] {
  return createScalarDryRunDiagnostics(
    feature,
    proposedEdit,
    blockingDiagnostics,
    "chamfer",
    "distance"
  );
}

function createFilletDryRunDiagnostics(
  feature: Extract<CadFeatureSummary, { readonly kind: "fillet" }>,
  proposedEdit: CadFeatureEditProposal | undefined,
  blockingDiagnostics: readonly CadFeatureEditDiagnostic[]
): readonly CadFeatureEditDiagnostic[] {
  return createScalarDryRunDiagnostics(
    feature,
    proposedEdit,
    blockingDiagnostics,
    "fillet",
    "radius"
  );
}

function createShellDryRunDiagnostics(
  feature: Extract<CadFeatureSummary, { readonly kind: "shell" }>,
  proposedEdit: CadFeatureEditProposal | undefined,
  blockingDiagnostics: readonly CadFeatureEditDiagnostic[]
): readonly CadFeatureEditDiagnostic[] {
  if (proposedEdit === undefined) {
    return [];
  }

  if (blockingDiagnostics.length > 0) {
    return blockingDiagnostics;
  }

  const diagnostics = createKindAndFieldDiagnostics(
    feature,
    proposedEdit,
    "shell",
    ["wallThickness", "openFaceRefs"]
  );

  if (proposedEdit.kind !== "shell") {
    return diagnostics;
  }

  if (
    proposedEdit.wallThickness !== undefined &&
    (!Number.isFinite(proposedEdit.wallThickness) ||
      proposedEdit.wallThickness <= 0)
  ) {
    diagnostics.push(
      createInvalidProposalDiagnostic(
        feature,
        "wallThickness",
        "finite positive number",
        String(proposedEdit.wallThickness)
      )
    );
  }

  if (
    proposedEdit.openFaceRefs !== undefined &&
    !proposedEdit.openFaceRefs.every(isShellOpenFaceRefShape)
  ) {
    diagnostics.push(
      createInvalidProposalDiagnostic(
        feature,
        "openFaceRefs",
        "generatedFace, namedReference, or topologyAnchor refs",
        "invalid openFaceRefs"
      )
    );
  }

  return diagnostics;
}

function createScalarDryRunDiagnostics(
  feature: Extract<CadFeatureSummary, { readonly kind: "chamfer" | "fillet" }>,
  proposedEdit: CadFeatureEditProposal | undefined,
  blockingDiagnostics: readonly CadFeatureEditDiagnostic[],
  expectedKind: "chamfer" | "fillet",
  fieldPath: "distance" | "radius"
): readonly CadFeatureEditDiagnostic[] {
  if (proposedEdit === undefined) {
    return [];
  }

  if (blockingDiagnostics.length > 0) {
    return blockingDiagnostics;
  }

  const diagnostics = createKindAndFieldDiagnostics(
    feature,
    proposedEdit,
    expectedKind,
    [fieldPath]
  );
  const value =
    proposedEdit.kind === "chamfer"
      ? proposedEdit.distance
      : proposedEdit.kind === "fillet"
        ? proposedEdit.radius
        : undefined;

  if (
    proposedEdit.kind === expectedKind &&
    value !== undefined &&
    (!Number.isFinite(value) || value <= 0)
  ) {
    diagnostics.push(
      createInvalidProposalDiagnostic(
        feature,
        fieldPath,
        "finite positive number",
        String(value)
      )
    );
  }

  return diagnostics;
}

function createKindAndFieldDiagnostics(
  feature: Exclude<CadFeatureSummary, { readonly kind: "primitive" }>,
  proposedEdit: CadFeatureEditProposal,
  expectedKind: CadFeatureEditProposal["kind"],
  fieldPaths: readonly string[]
): CadFeatureEditDiagnostic[] {
  const diagnostics: CadFeatureEditDiagnostic[] = [];

  if (proposedEdit.kind !== expectedKind) {
    diagnostics.push(
      createDiagnostic({
        code: "FEATURE_EDIT_INVALID_PROPOSAL",
        severity: "blocker",
        message: `${expectedKind} editability dry-run expects a ${expectedKind} proposal.`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        fieldPath: "kind",
        expected: expectedKind,
        received: proposedEdit.kind
      })
    );
    return diagnostics;
  }

  if (!fieldPaths.some((fieldPath) => fieldPath in proposedEdit)) {
    diagnostics.push(
      createDiagnostic({
        code: "FEATURE_EDIT_INVALID_PROPOSAL",
        severity: "blocker",
        message: `${expectedKind} edit dry-run requires at least one editable field.`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        expected: fieldPaths.join(", "),
        received: "no editable fields"
      })
    );
  }

  return diagnostics;
}

function createInvalidProposalDiagnostic(
  feature: Exclude<CadFeatureSummary, { readonly kind: "primitive" }>,
  fieldPath: string,
  expected: string,
  received: string
): CadFeatureEditDiagnostic {
  return createDiagnostic({
    code: "FEATURE_EDIT_INVALID_PROPOSAL",
    severity: "blocker",
    message: `${fieldPath} is not valid for this feature edit dry-run.`,
    featureId: feature.id,
    bodyId: feature.bodyId,
    fieldPath,
    expected,
    received
  });
}

function chooseExtrudeDryRunStatus(
  proposedEdit: CadFeatureEditProposal | undefined,
  editable: boolean,
  diagnostics: readonly CadFeatureEditDiagnostic[]
): CadFeatureEditDryRunStatus {
  if (proposedEdit === undefined) {
    return "not-requested";
  }

  if (!editable) {
    return "blocked";
  }

  return diagnostics.length === 0 ? "valid" : "blocked";
}

function chooseSourceDryRunStatus(
  proposedEdit: CadFeatureEditProposal | undefined,
  editable: boolean,
  diagnostics: readonly CadFeatureEditDiagnostic[]
): CadFeatureEditDryRunStatus {
  if (proposedEdit === undefined) {
    return "not-requested";
  }

  if (!editable) {
    return "blocked";
  }

  return diagnostics.length === 0 ? "valid" : "blocked";
}

function createResponse(args: {
  readonly options: CreateFeatureEditabilityResponseOptions;
  readonly status: CadFeatureEditabilityStatus;
  readonly fields: readonly CadFeatureEditFieldDescriptor[];
  readonly diagnostics: readonly CadFeatureEditDiagnostic[];
  readonly rebuildStatus: CadFeatureRebuildReadinessStatus;
  readonly rebuildDiagnostics: readonly CadFeatureEditDiagnostic[];
  readonly dryRunStatus: CadFeatureEditDryRunStatus;
  readonly dryRunDiagnostics: readonly CadFeatureEditDiagnostic[];
  readonly affected: CadFeatureEditAffectedSummary;
  readonly referenceChanges: readonly CadFeatureReferenceChangeSummary[];
  readonly feature?: CadFeatureSummary;
  readonly commitOperation?: CadFeatureEditFieldDescriptor["commitOperation"];
}): FeatureEditabilityQueryResponse {
  return {
    ok: true,
    query: "feature.editability",
    cadOpsVersion: args.options.cadOpsVersion,
    featureId: args.options.featureId,
    status: args.status,
    ...(args.feature ? { feature: args.feature } : {}),
    fieldCount: args.fields.length,
    fields: args.fields,
    rebuildReadiness: {
      status: args.rebuildStatus,
      commitDeferred:
        args.rebuildStatus === "deferred" ||
        args.rebuildStatus === "unsupported",
      diagnosticCount: args.rebuildDiagnostics.length,
      diagnostics: args.rebuildDiagnostics
    },
    dryRun: {
      status: args.dryRunStatus,
      ...(args.options.proposedEdit
        ? { proposedEdit: args.options.proposedEdit }
        : {}),
      ...(args.dryRunStatus === "valid" && args.commitOperation
        ? { commitOperation: args.commitOperation }
        : {}),
      willMutateDocument: false,
      diagnosticCount: args.dryRunDiagnostics.length,
      diagnostics: args.dryRunDiagnostics
    },
    affected: args.affected,
    referenceChangeCount: args.referenceChanges.length,
    referenceChanges: args.referenceChanges,
    diagnosticCount: args.diagnostics.length,
    diagnostics: args.diagnostics,
    sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
    derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
    requiresProjectSchemaMigration: false
  };
}

function createAffectedSummary(
  sketchIds: readonly SketchId[],
  featureIds: readonly FeatureId[],
  bodyIds: readonly BodyId[],
  generatedReferenceCount: number,
  namedReferenceCount: number
): CadFeatureEditAffectedSummary {
  return {
    sketchIds: unique(sketchIds),
    featureIds: unique(featureIds),
    bodyIds: unique(bodyIds),
    generatedReferenceCount,
    namedReferenceCount
  };
}

function countGeneratedReferences(
  options: CreateFeatureEditabilityResponseOptions,
  bodyId: BodyId
): number {
  const references = createBodyGeneratedReferences(
    options.document,
    bodyId,
    "part:default"
  );

  return references ? listGeneratedReferences(references).length : 0;
}

function countNamedReferences(
  options: CreateFeatureEditabilityResponseOptions,
  bodyId: BodyId
): number {
  return options.namedReferences.filter(
    (reference) => reference.bodyId === bodyId
  ).length;
}

function createReferenceChangesForBody(args: {
  readonly options: CreateFeatureEditabilityResponseOptions;
  readonly bodyId: BodyId;
  readonly sourceFeatureId: FeatureId;
  readonly targetFeatureId?: FeatureId;
  readonly category: CadFeatureReferenceChangeCategory;
  readonly diagnosticCode?: CadFeatureEditDiagnosticCode;
  readonly message: string;
}): readonly CadFeatureReferenceChangeSummary[] {
  const generatedReferences = createBodyGeneratedReferences(
    args.options.document,
    args.bodyId,
    "part:default"
  );
  const changes = listGeneratedReferences(generatedReferences).map(
    (reference) =>
      createReferenceChange({
        category: args.category,
        bodyId: args.bodyId,
        stableId: reference.stableId,
        kind: reference.kind,
        sourceFeatureId: args.sourceFeatureId,
        targetFeatureId: args.targetFeatureId,
        diagnosticCode: args.diagnosticCode,
        message: args.message
      })
  );
  const namedReferenceChanges = args.options.namedReferences
    .filter((reference) => reference.bodyId === args.bodyId)
    .map((reference) =>
      createNamedReferenceChange({
        name: reference.name,
        bodyId: reference.bodyId,
        stableId: reference.stableId,
        kind: reference.kind,
        category: args.category,
        sourceFeatureId: args.sourceFeatureId,
        targetFeatureId: args.targetFeatureId,
        diagnosticCode: args.diagnosticCode,
        message: args.message
      })
    );
  const topologyAnchorChanges = createTopologyAnchorReferenceChangesForBody({
    topologyIdentity: args.options.document.topologyIdentity,
    topologyMatchResults: args.options.topologyMatchResults,
    bodyId: args.bodyId,
    sourceFeatureId: args.sourceFeatureId,
    targetFeatureId: args.targetFeatureId,
    fallbackCategory: args.category,
    diagnosticCode: args.diagnosticCode,
    fallbackMessage: args.message
  });

  return [...changes, ...namedReferenceChanges, ...topologyAnchorChanges];
}

function createNamedReferenceChange(args: {
  readonly name: NamedReferenceName;
  readonly bodyId: BodyId;
  readonly stableId?: string;
  readonly kind?: CadGeneratedReference["kind"];
  readonly category: CadFeatureReferenceChangeCategory;
  readonly sourceFeatureId: FeatureId;
  readonly targetFeatureId?: FeatureId;
  readonly diagnosticCode?: CadFeatureEditDiagnosticCode;
  readonly message: string;
}): CadFeatureReferenceChangeSummary {
  return createReferenceChange({
    category: args.category,
    bodyId: args.bodyId,
    stableId: args.stableId,
    kind: args.kind,
    referenceName: args.name,
    sourceFeatureId: args.sourceFeatureId,
    targetFeatureId: args.targetFeatureId,
    diagnosticCode: args.diagnosticCode,
    message: args.message
  });
}

function createReferenceChange(args: {
  readonly category: CadFeatureReferenceChangeCategory;
  readonly bodyId?: BodyId;
  readonly stableId?: string;
  readonly kind?: CadGeneratedReference["kind"];
  readonly referenceName?: NamedReferenceName;
  readonly sourceFeatureId?: FeatureId;
  readonly targetFeatureId?: FeatureId;
  readonly diagnosticCode?: CadFeatureEditDiagnosticCode;
  readonly message: string;
}): CadFeatureReferenceChangeSummary {
  return {
    category: args.category,
    ...(args.bodyId ? { bodyId: args.bodyId } : {}),
    ...(args.stableId ? { stableId: args.stableId } : {}),
    ...(args.kind ? { kind: args.kind } : {}),
    ...(args.referenceName ? { referenceName: args.referenceName } : {}),
    ...(args.sourceFeatureId ? { sourceFeatureId: args.sourceFeatureId } : {}),
    ...(args.targetFeatureId ? { targetFeatureId: args.targetFeatureId } : {}),
    ...(args.diagnosticCode ? { diagnosticCode: args.diagnosticCode } : {}),
    message: args.message
  };
}

function createDiagnostic(args: {
  readonly code: CadFeatureEditDiagnosticCode;
  readonly severity: CadFeatureEditDiagnosticSeverity;
  readonly message: string;
  readonly featureId?: FeatureId;
  readonly bodyId?: BodyId;
  readonly targetBodyId?: BodyId;
  readonly sketchId?: SketchId;
  readonly sketchEntityId?: SketchEntityId;
  readonly stableId?: string;
  readonly referenceName?: NamedReferenceName;
  readonly topologyAnchorId?: string;
  readonly fieldPath?: string;
  readonly expected?: string;
  readonly received?: string;
}): CadFeatureEditDiagnostic {
  return {
    code: args.code,
    severity: args.severity,
    message: args.message,
    ...(args.featureId ? { featureId: args.featureId } : {}),
    ...(args.bodyId ? { bodyId: args.bodyId } : {}),
    ...(args.targetBodyId ? { targetBodyId: args.targetBodyId } : {}),
    ...(args.sketchId ? { sketchId: args.sketchId } : {}),
    ...(args.sketchEntityId ? { sketchEntityId: args.sketchEntityId } : {}),
    ...(args.stableId ? { stableId: args.stableId } : {}),
    ...(args.referenceName ? { referenceName: args.referenceName } : {}),
    ...(args.topologyAnchorId
      ? { topologyAnchorId: args.topologyAnchorId }
      : {}),
    ...(args.fieldPath ? { fieldPath: args.fieldPath } : {}),
    ...(args.expected ? { expected: args.expected } : {}),
    ...(args.received ? { received: args.received } : {})
  };
}

function listGeneratedReferences(
  references: ReturnType<typeof createBodyGeneratedReferences>
): readonly CadGeneratedReference[] {
  if (!references) {
    return [];
  }

  return [
    references.body,
    ...references.faces,
    ...references.edges,
    ...references.vertices
  ];
}

function isFeatureExtrudeSide(value: unknown): value is FeatureExtrudeSide {
  return value === "positive" || value === "negative" || value === "symmetric";
}

function isShellOpenFaceRefShape(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const ref = value as Record<string, unknown>;

  if (ref.kind === "generatedFace") {
    return typeof ref.bodyId === "string" && typeof ref.stableId === "string";
  }

  if (ref.kind === "namedReference") {
    return typeof ref.name === "string";
  }

  if (ref.kind === "topologyAnchor") {
    return typeof ref.bodyId === "string" && typeof ref.anchorId === "string";
  }

  return false;
}

function unique<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

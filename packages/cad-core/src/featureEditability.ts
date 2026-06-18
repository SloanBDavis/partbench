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

const SOURCE_BOUNDARY_NOTE =
  "Feature editability is derived from authoritative document source features and semantic generated/named references.";
const DERIVED_BOUNDARY_NOTE =
  "Renderer meshes, OCCT indexes, OPFS paths, file handles, viewport state, and selection-buffer ids are excluded from editability and rebuild identity.";

export interface CreateFeatureEditabilityResponseOptions {
  readonly cadOpsVersion: CadOpsVersion;
  readonly featureId: FeatureId;
  readonly proposedEdit?: CadFeatureEditProposal;
  readonly units: DocumentUnits;
  readonly document: GeneratedReferencesDocument;
  readonly features: readonly CadFeatureSummary[];
  readonly bodies: readonly CadBodySnapshot[];
  readonly namedReferences: readonly NamedGeneratedReferenceSnapshot[];
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
          "Primitive compatibility features are scene-object source, not V10 editable source features.",
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

  return createDeferredSourceFeatureResponse(options, feature);
}

function createExtrudeEditabilityResponse(
  options: CreateFeatureEditabilityResponseOptions,
  feature: Extract<CadFeatureSummary, { readonly kind: "extrude" }>
): FeatureEditabilityQueryResponse {
  const body = options.bodies.find(
    (candidate) => candidate.id === feature.bodyId
  );
  const blockingDiagnostics: CadFeatureEditDiagnostic[] = [];

  if (body?.consumedByFeatureId) {
    blockingDiagnostics.push(
      createDiagnostic({
        code: "FEATURE_EDIT_CONSUMED_BODY",
        severity: "blocker",
        message: `Feature ${feature.id} cannot be edited safely because body ${feature.bodyId} is consumed by feature ${body.consumedByFeatureId}.`,
        featureId: feature.id,
        bodyId: feature.bodyId,
        expected: "active feature body",
        received: body.consumedByFeatureId
      })
    );
  }

  if (feature.operationMode !== "newBody") {
    blockingDiagnostics.push(
      createDiagnostic({
        code: "AMBIGUOUS_RESULT_TOPOLOGY",
        severity: "blocker",
        message:
          "V10 Tranche A does not claim command-ready edit/rebuild references for boolean extrude result topology.",
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
          message:
            "Extrude depth and side can be edited through feature.updateExtrude; this query does not mutate document state.",
          featureId: feature.id,
          bodyId: feature.bodyId
        })
      ]
    : [];
  const diagnostics = [...supportDiagnostic, ...blockingDiagnostics];
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
    ? "active"
    : body?.consumedByFeatureId
      ? "consumed"
      : "ambiguous";
  const affected = createAffectedSummary(
    [feature.sketchId],
    [feature.id],
    [feature.bodyId, ...(feature.targetBodyId ? [feature.targetBodyId] : [])],
    countGeneratedReferences(options, feature.bodyId),
    countNamedReferences(options, feature.bodyId)
  );

  return createResponse({
    options,
    feature,
    status: editable ? "editable" : "blocked",
    fields,
    diagnostics,
    rebuildStatus: editable ? "ready" : "blocked",
    rebuildDiagnostics: blockingDiagnostics,
    dryRunStatus,
    dryRunDiagnostics,
    affected,
    referenceChanges: createReferenceChangesForBody({
      options,
      bodyId: feature.bodyId,
      sourceFeatureId: feature.id,
      category: referenceCategory,
      diagnosticCode: editable
        ? undefined
        : body?.consumedByFeatureId
          ? "FEATURE_EDIT_CONSUMED_BODY"
          : "AMBIGUOUS_RESULT_TOPOLOGY",
      message: editable
        ? "Source generated references are active for this supported edit query."
        : "Source generated references require review before a committed edit can be considered command-ready."
    })
  });
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
      message: `V10 Tranche A can describe ${feature.kind} source fields, but committed edit/rebuild is deferred.`,
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
        "Generated and named reference survival is reported as repair-needed or unsupported until V10 rebuild/repair work lands.",
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
    path: feature.namedReference ? "namedReference" : "edgeStableId",
    label: feature.namedReference ? "Named reference" : "Edge reference",
    valueType: "reference",
    currentValue: feature.namedReference ?? feature.edgeStableId,
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
      ...(args.dryRunStatus === "valid"
        ? { commitOperation: "feature.updateExtrude" as const }
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
        diagnosticCode: args.diagnosticCode,
        message: args.message
      })
    );

  return [...changes, ...namedReferenceChanges];
}

function createNamedReferenceChange(args: {
  readonly name: NamedReferenceName;
  readonly bodyId: BodyId;
  readonly stableId?: string;
  readonly kind?: CadGeneratedReference["kind"];
  readonly category: CadFeatureReferenceChangeCategory;
  readonly sourceFeatureId: FeatureId;
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

function unique<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

import {
  CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE,
  WCAD_SOURCE_IDENTITY_ALGORITHM,
  isSketchRegionsProfileRef
} from "@web-cad/cad-protocol";
import type {
  CadBodySnapshot,
  CadBodySource,
  CadBodyDerivedExactMetadataSnapshot,
  CadCurrentExactResult,
  CadCurrentExactResultStatus,
  CadExactExportPlan,
  CadExactReadySubsetMetadata,
  CadExactResultDiagnostic,
  CadExactExportBooleanSource,
  CadExactExportBooleanResultSource,
  CadExactExportBodySource,
  CadExactExportPrimitiveExtrudeSource,
  CadExactExportSweepBodySource,
  CadExactExportWireExtrudeSource,
  CadExactExportSourceIdentityStatus,
  CadExactExportWriterStatus,
  CadExportBodyFormatReadiness,
  CadExportBodyReadiness,
  CadExportBodySourceKind,
  CadExportDiagnostic,
  CadExportKind,
  CadExportFormatId,
  CadExportFormatReadiness,
  CadExportReadinessStatus,
  CadOpsVersion,
  ProjectExactExportQuery,
  ProjectExactExportQueryResponse,
  ProjectExportReadinessQueryResponse,
  PartId,
  SketchLoopRef,
  SketchRegionsProfileRef,
  WcadSourceIdentity,
  WcadDocumentSchemaVersion
} from "@web-cad/cad-protocol";
import type {
  CadDocument,
  ExtrudeFeature,
  Feature,
  RevolveFeature,
  SweepFeature,
  SketchEntity
} from "./index";
import {
  getFeatureEntityProfileRef,
  getProfileEntityReferences,
  getSupportedEntityProfileKind
} from "./normalizedFeatureInputs";
import { createSourceMeasurementFrame } from "./sourceMeasurementGeometry";
import {
  createResolvedWireExtrudeProfile,
  createResolvedWireExtrudeRecipe,
  resolveWireExtrudeProfile
} from "./wireExtrudeProfile";
import { createBodyTopology } from "./bodyTopology";
import {
  CAD_DOWNSTREAM_BODY_OPERATIONS,
  createCadDownstreamBodyPolicyProjection,
  evaluateCadBodyDependencies
} from "./downstreamBodyPolicy";
import { createResolvedWireRevolveProfile } from "./wireRevolveProfile";
import { createResolvedRegionRevolveProfile } from "./regionRevolveProfile";
import { createResolvedSweepSource } from "./sweepProfile";
import { validateRegisteredV22RegionSource } from "./v19RegionPolicyRegistry";
import { encodeCanonicalCbor } from "./canonicalCbor";
import { sha256Hex } from "./sha256";

interface ProjectExportReadinessInput {
  readonly document: CadDocument;
  readonly cadOpsVersion: CadOpsVersion;
  readonly bodies: readonly CadBodySnapshot[];
  readonly exactStepWriterStatus?: CadExactExportWriterStatus;
  readonly derivedExactMetadata?: readonly CadBodyDerivedExactMetadataSnapshot[];
  readonly currentExactResults?: readonly CadCurrentExactResult[];
  readonly currentSourceIdentity?: WcadSourceIdentity;
}

interface ProjectExactExportInput extends ProjectExportReadinessInput {
  readonly query: ProjectExactExportQuery;
  readonly documentSchemaVersion: WcadDocumentSchemaVersion;
  readonly currentSourceIdentity: WcadSourceIdentity;
}

interface ExportFormatDefinition {
  readonly format: CadExportFormatId;
  readonly label: string;
  readonly exportKind: CadExportKind;
  readonly fileExtensions: readonly string[];
  readonly sourceBoundaryNote: string;
  readonly derivedBoundaryNote: string;
}

interface BodySourceCapability {
  readonly sourceKind: CadExportBodySourceKind;
  readonly sourceStatus: CadExportReadinessStatus;
  readonly diagnostics: readonly CadExportDiagnostic[];
}

interface BodySourceReadiness extends BodySourceCapability {
  readonly currentExactResult: CadCurrentExactResult;
}

export interface CurrentExactExportProjection {
  readonly plan: CadExactExportPlan;
  readonly currentExactResults: readonly CadCurrentExactResult[];
  readonly selectedBodies: readonly CadBodySnapshot[];
  readonly bodyReadiness: readonly CadExportBodyReadiness[];
  readonly selectionDiagnostics: readonly CadExportDiagnostic[];
  readonly globalDiagnostics: readonly CadExportDiagnostic[];
  readonly executable: boolean;
}

interface CurrentExactExportProjectionInput {
  readonly document: CadDocument;
  readonly bodies: readonly CadBodySnapshot[];
  readonly currentSourceIdentity: WcadSourceIdentity;
  readonly bodyIds?: readonly string[];
  readonly requestedSourceIdentity?: WcadSourceIdentity;
  readonly exactStepWriterStatus?: CadExactExportWriterStatus;
  readonly derivedExactMetadata?: readonly CadBodyDerivedExactMetadataSnapshot[];
  readonly currentExactResults?: readonly CadCurrentExactResult[];
}

const SOURCE_BOUNDARY_NOTE =
  "Classified from authoritative project bodies, features, sketches, and document units.";
const DERIVED_BOUNDARY_NOTE =
  "No derived display output, visualization cache, or export job state is read or persisted.";

const EXPORT_FORMATS: readonly ExportFormatDefinition[] = [
  {
    format: "step",
    label: "STEP",
    exportKind: "exact",
    fileExtensions: [".step", ".stp"],
    sourceBoundaryNote:
      "STEP uses exact body sources derived from authoritative CAD document state.",
    derivedBoundaryNote:
      "STEP readiness does not use derived visualization output."
  },
  {
    format: "glb",
    label: "Mesh/GLB visualization",
    exportKind: "visualization",
    fileExtensions: [".glb"],
    sourceBoundaryNote:
      "GLB would be visualization output derived from authoritative bodies, not project source.",
    derivedBoundaryNote:
      "Visualization file writing is not implemented and would not make display output authoritative."
  }
];

export function createProjectExportReadiness({
  document,
  cadOpsVersion,
  bodies,
  exactStepWriterStatus = "available",
  derivedExactMetadata = [],
  currentExactResults = [],
  currentSourceIdentity
}: ProjectExportReadinessInput): ProjectExportReadinessQueryResponse {
  const exactMetadataByBodyId = new Map(
    derivedExactMetadata.map((metadata) => [metadata.bodyId, metadata] as const)
  );
  const bodyReadiness = bodies.map((body) =>
    createBodyExportReadiness(
      document,
      bodies,
      body,
      exactStepWriterStatus,
      exactMetadataByBodyId.get(body.id)
    )
  );
  const projection = currentSourceIdentity
    ? createCurrentExactExportProjection({
        document,
        bodies,
        currentSourceIdentity,
        exactStepWriterStatus,
        derivedExactMetadata,
        currentExactResults
      })
    : undefined;
  const formatReadiness = EXPORT_FORMATS.map((format) =>
    createFormatReadiness(
      document.units,
      format,
      bodyReadiness,
      exactStepWriterStatus,
      projection?.executable ?? false
    )
  );
  const projectDiagnostics =
    bodies.length === 0
      ? [
          createProjectEmptyDiagnostic(
            "Project has no candidate bodies to export."
          )
        ]
      : [];
  const diagnostics = [
    ...projectDiagnostics,
    ...formatReadiness.flatMap((format) => format.diagnostics),
    ...bodyReadiness.flatMap((body) => body.diagnostics),
    ...(projection?.currentExactResults.flatMap((result) =>
      result.diagnostics.map((diagnostic) =>
        exactDiagnosticToExportDiagnostic(
          diagnostic,
          getBodyExportSourceKind(
            bodies.find((body) => body.id === result.bodyId)!
          )
        )
      )
    ) ?? [])
  ];
  const readySubset = projection
    ? createReadySubsetMetadata(projection.plan)
    : undefined;

  return {
    ok: true,
    query: "project.exportReadiness",
    cadOpsVersion,
    status: projection
      ? getProjectionReadinessStatus(projection)
      : chooseProjectStatus(bodyReadiness),
    canExportFiles: projection?.executable ?? false,
    units: document.units,
    sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
    derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
    formatCount: formatReadiness.length,
    formats: formatReadiness,
    bodyCount: bodyReadiness.length,
    sourceSupportedBodyCount: bodyReadiness.filter(
      (body) => body.sourceStatus === "supported"
    ).length,
    deferredBodyCount: bodyReadiness.filter(
      (body) => body.status === "deferred"
    ).length,
    unavailableBodyCount: bodyReadiness.filter(
      (body) => body.status === "unavailable"
    ).length,
    bodies: bodyReadiness,
    diagnosticCount: diagnostics.length,
    diagnostics,
    ...(projection
      ? {
          plan: projection.plan,
          currentExactResults: projection.currentExactResults,
          ...(readySubset ? { readySubset } : {})
        }
      : {})
  };
}

export function createProjectExactExport({
  document,
  cadOpsVersion,
  bodies,
  query,
  documentSchemaVersion,
  currentSourceIdentity,
  exactStepWriterStatus = "available"
}: ProjectExactExportInput): ProjectExactExportQueryResponse {
  const exactMetadataByBodyId = new Map(
    query.derivedExactMetadata?.map(
      (metadata) => [metadata.bodyId, metadata] as const
    ) ?? []
  );
  const projection = createCurrentExactExportProjection({
    document,
    bodies,
    currentSourceIdentity,
    bodyIds: query.bodyIds,
    requestedSourceIdentity: query.sourceIdentity,
    exactStepWriterStatus,
    derivedExactMetadata: [...exactMetadataByBodyId.values()],
    currentExactResults: query.currentExactResults
  });
  const requestedBodyIds =
    query.bodyIds && query.bodyIds.length > 0
      ? query.bodyIds
      : projection.selectedBodies.map((body) => body.id);
  const stepBodies = projection.bodyReadiness.map((body) => ({
    ...body,
    formats: body.formats.filter((format) => format.format === "step")
  }));
  const exportSources =
    projection.selectionDiagnostics.length === 0 &&
    projection.globalDiagnostics.length === 0
      ? stepBodies.flatMap((body, index) => {
          const status = projection.currentExactResults[index]?.status;
          if (status !== "ready" && status !== "pending") return [];
          const source = createExactExportBodySource(
            document,
            body,
            exactMetadataByBodyId.get(body.bodyId)
          );
          return source ? [source] : [];
        })
      : [];
  const sourceIdentityStatus = getSourceIdentityStatus(
    query.sourceIdentity,
    currentSourceIdentity
  );
  const diagnostics = [
    ...projection.globalDiagnostics,
    ...projection.selectionDiagnostics,
    ...stepBodies.flatMap((body) => body.diagnostics),
    ...projection.currentExactResults.flatMap((result) =>
      result.diagnostics.map((diagnostic) =>
        exactDiagnosticToExportDiagnostic(
          diagnostic,
          getBodyExportSourceKind(
            projection.selectedBodies.find((body) => body.id === result.bodyId)!
          )
        )
      )
    )
  ];
  const exportableBodyCount = projection.executable ? stepBodies.length : 0;
  const status: CadExportReadinessStatus = projection.executable
    ? "supported"
    : projection.globalDiagnostics.length > 0 ||
        projection.selectionDiagnostics.length > 0
      ? "unavailable"
      : stepBodies.some((body) => body.status === "deferred")
        ? "deferred"
        : "unavailable";
  const readySubset = createReadySubsetMetadata(projection.plan);

  return {
    ok: true,
    query: "project.exportExact",
    cadOpsVersion,
    format: "step",
    label: "STEP",
    exportKind: "exact",
    status,
    available: projection.executable,
    canExportFile: projection.executable,
    writerStatus: exactStepWriterStatus,
    units: document.units,
    fileExtensions: [".step", ".stp"],
    documentSchemaVersion,
    sourceIdentityAlgorithm: WCAD_SOURCE_IDENTITY_ALGORITHM,
    ...(query.sourceIdentity
      ? { requestedSourceIdentity: query.sourceIdentity }
      : {}),
    sourceIdentityStatus,
    requestedBodyIds,
    bodyCount: stepBodies.length,
    sourceSupportedBodyCount: stepBodies.filter(
      (body) => body.sourceStatus === "supported"
    ).length,
    deferredBodyCount: stepBodies.filter((body) => body.status === "deferred")
      .length,
    unavailableBodyCount: stepBodies.filter(
      (body) => body.status === "unavailable"
    ).length,
    exportableBodyCount,
    exportSources,
    bodies: stepBodies,
    diagnosticCount: diagnostics.length,
    diagnostics,
    plan: projection.plan,
    currentExactResults: projection.currentExactResults,
    ...(readySubset ? { readySubset } : {})
  };
}

export function createCurrentExactExportProjection({
  document,
  bodies,
  currentSourceIdentity,
  bodyIds = [],
  requestedSourceIdentity,
  exactStepWriterStatus = "available",
  derivedExactMetadata = [],
  currentExactResults: suppliedCurrentExactResults = []
}: CurrentExactExportProjectionInput): CurrentExactExportProjection {
  const bodyById = new Map(bodies.map((body) => [body.id, body] as const));
  const explicit = bodyIds.length > 0;
  const selectionDiagnostics: CadExportDiagnostic[] = [];
  const seen = new Set<string>();
  const selectedBodies = explicit
    ? bodyIds.flatMap((bodyId) => {
        if (seen.has(bodyId)) {
          selectionDiagnostics.push(createDuplicateExactBodyDiagnostic(bodyId));
          return [];
        }
        seen.add(bodyId);
        const body = bodyById.get(bodyId);
        if (!body) {
          selectionDiagnostics.push(createMissingExactBodyDiagnostic(bodyId));
          return [];
        }
        if (body.consumedByFeatureId) {
          selectionDiagnostics.push(createInactiveExactBodyDiagnostic(body));
        }
        return [body];
      })
    : bodies
        .filter((body) => !body.consumedByFeatureId)
        .sort((left, right) =>
          left.id < right.id ? -1 : left.id > right.id ? 1 : 0
        );
  const metadataByBodyId = new Map(
    derivedExactMetadata.map((metadata) => [metadata.bodyId, metadata] as const)
  );
  const bodyReadiness = selectedBodies.map((body) =>
    createBodyExportReadiness(
      document,
      bodies,
      body,
      exactStepWriterStatus,
      metadataByBodyId.get(body.id)
    )
  );
  const suppliedCurrentByBodyId = new Map(
    suppliedCurrentExactResults.map(
      (result) => [result.bodyId, result] as const
    )
  );
  const currentExactResults = bodyReadiness.map((body) => {
    const selectedBody = bodyById.get(body.bodyId)!;
    const classified = classifyBodySource(
      document,
      bodies,
      selectedBody,
      metadataByBodyId.get(body.bodyId)
    ).currentExactResult;
    return reconcileCurrentExactResult(
      document,
      bodies,
      selectedBody,
      classified,
      suppliedCurrentByBodyId.get(body.bodyId)
    );
  });
  const planBodies = selectedBodies.map((body, index) => {
    const current = currentExactResults[index]!;
    const currentDiagnostics = current.diagnostics.map((diagnostic) =>
      exactDiagnosticToExportDiagnostic(
        diagnostic,
        getBodyExportSourceKind(body)
      )
    );
    return {
      bodyId: body.id,
      bodyName: body.name?.trim() || body.id,
      partId: body.partId,
      featureId: body.featureId,
      sourceType: body.source.type,
      sourceIdentitySignature: getBodySourceIdentitySignature(
        document,
        bodies,
        body
      ),
      status: current.status === "ready" ? "ready" : "blocked",
      diagnostics: [...bodyReadiness[index]!.diagnostics, ...currentDiagnostics]
    } as const;
  });
  const orderedBodyIds = planBodies.map((body) => body.bodyId);
  const plan: CadExactExportPlan = {
    format: "step",
    schema: "AP242DIS",
    units: document.units,
    sourceIdentity: currentSourceIdentity,
    orderedBodyIds,
    allOrNothing: true,
    planIdentity: sha256Hex(
      encodeCanonicalCbor({
        format: "step",
        schema: "AP242DIS",
        units: document.units,
        sourceIdentity: currentSourceIdentity,
        orderedBodyIds,
        bodyNames: planBodies.map((body) => body.bodyName),
        bodySourceIdentitySignatures: planBodies.map(
          (body) => body.sourceIdentitySignature
        ),
        allOrNothing: true
      })
    ),
    bodies: planBodies
  };
  const globalDiagnostics = [
    ...(exactStepWriterStatus === "unavailable"
      ? [createStepWriterUnavailableDiagnostic()]
      : []),
    ...(requestedSourceIdentity &&
    getSourceIdentityStatus(requestedSourceIdentity, currentSourceIdentity) ===
      "mismatchedCurrent"
      ? [
          createSourceIdentityMismatchDiagnostic(
            requestedSourceIdentity,
            currentSourceIdentity
          )
        ]
      : []),
    ...(planBodies.length === 0
      ? [
          createProjectEmptyDiagnostic(
            "Project has no active bodies to export."
          )
        ]
      : [])
  ];
  const executable =
    selectionDiagnostics.length === 0 &&
    globalDiagnostics.length === 0 &&
    planBodies.length > 0 &&
    planBodies.every((body) => body.status === "ready");

  return {
    plan,
    currentExactResults,
    selectedBodies,
    bodyReadiness,
    selectionDiagnostics,
    globalDiagnostics,
    executable
  };
}

function createReadySubsetMetadata(
  plan: CadExactExportPlan
): CadExactReadySubsetMetadata | undefined {
  const ready = plan.bodies.filter((body) => body.status === "ready");
  if (ready.length === 0) return undefined;

  const toBody = (body: CadExactExportPlan["bodies"][number]) => ({
    bodyId: body.bodyId,
    bodyName: body.bodyName,
    diagnostics: body.diagnostics
  });
  return {
    orderedBodyIds: ready.map((body) => body.bodyId),
    includedBodies: ready.map(toBody),
    excludedBodies: plan.bodies
      .filter((body) => body.status === "blocked")
      .map(toBody),
    allOrNothing: true
  };
}

function createFormatReadiness(
  units: ProjectExportReadinessQueryResponse["units"],
  format: ExportFormatDefinition,
  bodies: readonly CadExportBodyReadiness[],
  exactStepWriterStatus: CadExactExportWriterStatus,
  stepExecutable: boolean
): CadExportFormatReadiness {
  const viableBodyCount = bodies.filter(
    (body) => body.status !== "unavailable"
  ).length;
  const sourceSupportedBodyCount = bodies.filter(
    (body) => body.sourceStatus === "supported"
  ).length;
  const stepAvailable = format.format === "step" && stepExecutable;
  const emptyDiagnostics =
    bodies.length === 0
      ? [
          createProjectEmptyDiagnostic(
            `${format.label} export has no candidate bodies.`
          )
        ]
      : [];
  const diagnostics =
    format.format === "step"
      ? [
          ...(exactStepWriterStatus === "unavailable"
            ? [createStepWriterUnavailableDiagnostic()]
            : []),
          ...emptyDiagnostics
        ]
      : [createWriterDiagnostic(format), ...emptyDiagnostics];

  return {
    format: format.format,
    label: format.label,
    exportKind: format.exportKind,
    status: stepAvailable
      ? "supported"
      : format.format === "step" && exactStepWriterStatus === "unavailable"
        ? "unavailable"
        : viableBodyCount === 0
          ? "unavailable"
          : "deferred",
    available: stepAvailable,
    writerStatus:
      format.format === "step" ? exactStepWriterStatus : "unavailable",
    fileExtensions: format.fileExtensions,
    units,
    sourceBoundaryNote: format.sourceBoundaryNote,
    derivedBoundaryNote: format.derivedBoundaryNote,
    candidateBodyCount: bodies.length,
    sourceSupportedBodyCount,
    deferredBodyCount: bodies.filter((body) => body.status === "deferred")
      .length,
    unavailableBodyCount: bodies.filter((body) => body.status === "unavailable")
      .length,
    diagnostics
  };
}

function createBodyExportReadiness(
  document: CadDocument,
  bodies: readonly CadBodySnapshot[],
  body: CadBodySnapshot,
  exactStepWriterStatus: CadExactExportWriterStatus,
  derivedExactMetadata?: CadBodyDerivedExactMetadataSnapshot
): CadExportBodyReadiness {
  const source = classifyBodySource(
    document,
    bodies,
    body,
    derivedExactMetadata
  );
  const status = exactStatusToReadiness(source.currentExactResult.status);
  const formats = EXPORT_FORMATS.map((format) =>
    createBodyFormatReadiness(format, body, source, exactStepWriterStatus)
  );

  return {
    bodyId: body.id,
    ...(body.name ? { bodyName: body.name } : {}),
    bodyKind: body.kind,
    featureId: body.featureId,
    partId: body.partId,
    sourceKind: source.sourceKind,
    sourceStatus: source.sourceStatus,
    status,
    ...(body.consumedByFeatureId
      ? { consumedByFeatureId: body.consumedByFeatureId }
      : {}),
    ...(body.objectId ? { objectId: body.objectId } : {}),
    ...(body.primitive ? { primitive: body.primitive } : {}),
    sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
    derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
    formats,
    diagnostics: source.diagnostics
  };
}

function createBodyFormatReadiness(
  format: ExportFormatDefinition,
  body: CadBodySnapshot,
  source: BodySourceReadiness,
  exactStepWriterStatus: CadExactExportWriterStatus
): CadExportBodyFormatReadiness {
  if (format.format === "step" && exactStepWriterStatus === "unavailable") {
    return {
      format: format.format,
      label: format.label,
      exportKind: format.exportKind,
      status: "unavailable",
      writerStatus: "unavailable",
      diagnostics: [
        createStepWriterUnavailableDiagnostic(body, source.sourceKind),
        ...source.diagnostics
      ]
    };
  }

  if (source.sourceStatus === "unavailable") {
    return {
      format: format.format,
      label: format.label,
      exportKind: format.exportKind,
      status: "unavailable",
      writerStatus: "unavailable",
      diagnostics: source.diagnostics
    };
  }

  if (
    format.format === "step" &&
    source.currentExactResult.status === "ready"
  ) {
    return {
      format: format.format,
      label: format.label,
      exportKind: format.exportKind,
      status: "supported",
      writerStatus: "available",
      diagnostics: []
    };
  }

  if (format.format === "step") {
    return {
      format: format.format,
      label: format.label,
      exportKind: format.exportKind,
      status: exactStatusToReadiness(source.currentExactResult.status),
      writerStatus: "available",
      diagnostics: source.diagnostics
    };
  }

  return {
    format: format.format,
    label: format.label,
    exportKind: format.exportKind,
    status: "deferred",
    writerStatus: "unavailable",
    diagnostics: [
      ...(source.sourceStatus === "deferred" ? source.diagnostics : []),
      createWriterDiagnostic(format, body, source.sourceKind)
    ]
  };
}

function classifyBodySource(
  document: CadDocument,
  bodies: readonly CadBodySnapshot[],
  body: CadBodySnapshot,
  derivedExactMetadata?: CadBodyDerivedExactMetadataSnapshot
): BodySourceReadiness {
  const sourceKind =
    CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE[body.source.type];
  const feature = document.features.get(body.featureId);
  const sourceRecordAvailable =
    body.source.type === "primitiveFeature"
      ? body.objectId !== undefined && document.objects.has(body.objectId)
      : feature?.bodyId === body.id &&
        feature.kind === expectedFeatureKind(body.source.type);
  const importedCheckpointAvailable =
    body.source.type !== "importedStepBody" ||
    (feature?.kind === "importedBody" &&
      document.topologyIdentity?.checkpoints.some(
        (checkpoint) =>
          checkpoint.checkpointId === feature.checkpointId &&
          checkpoint.bodyId === body.id &&
          checkpoint.status === "active"
      ) === true);
  const importedHoleUnsupported =
    body.source.type === "sketchHoleFeature" &&
    feature?.kind === "hole" &&
    [...document.features.values()].some(
      (candidate) =>
        candidate.bodyId === feature.targetBodyId &&
        candidate.kind === "importedBody"
    );

  if (
    body.consumedByFeatureId ||
    !sourceRecordAvailable ||
    !importedCheckpointAvailable ||
    importedHoleUnsupported
  ) {
    const capability = body.consumedByFeatureId
      ? classifyLegacyBodySource(document, body, derivedExactMetadata)
      : createUnresolvedBodySourceReadiness(body, sourceKind);
    const status: CadCurrentExactResultStatus = importedHoleUnsupported
      ? "unsupported"
      : "blocked";
    const diagnostic = createExactResultDiagnostic(
      body,
      status,
      importedHoleUnsupported
        ? "EXPORT_BODY_SOURCE_UNSUPPORTED"
        : "EXPORT_EXACT_SOURCE_UNAVAILABLE",
      importedHoleUnsupported
        ? `Hole body ${body.id} targets an imported body, which is outside the completed command matrix.`
        : !importedCheckpointAvailable
          ? `Imported body ${body.id} has no active checkpoint source record.`
          : (capability.diagnostics[0]?.message ??
            `Body ${body.id} has no current authoritative source record.`)
    );
    return {
      sourceKind,
      sourceStatus: "unavailable",
      currentExactResult: {
        status,
        bodyId: body.id,
        sourceType: body.source.type,
        diagnostics: [diagnostic]
      },
      diagnostics: [
        ...capability.diagnostics,
        exactDiagnosticToExportDiagnostic(diagnostic, sourceKind)
      ]
    };
  }

  const legacy = classifyLegacyBodySource(document, body, derivedExactMetadata);
  if (
    (body.source.type === "sketchExtrudeFeature" ||
      body.source.type === "sketchRevolveFeature") &&
    legacy.sourceStatus === "unavailable"
  ) {
    const diagnostic = createExactResultDiagnostic(
      body,
      "blocked",
      "EXPORT_EXACT_SOURCE_UNAVAILABLE",
      legacy.diagnostics[0]?.message ??
        `Body ${body.id} has unresolved authored source dependencies.`
    );
    return {
      sourceKind,
      sourceStatus: "unavailable",
      currentExactResult: {
        status: "blocked",
        bodyId: body.id,
        sourceType: body.source.type,
        diagnostics: [diagnostic]
      },
      diagnostics: [
        ...legacy.diagnostics,
        exactDiagnosticToExportDiagnostic(diagnostic, sourceKind)
      ]
    };
  }
  if (
    body.source.type === "sketchExtrudeFeature" &&
    feature?.kind === "extrude" &&
    feature.operationMode !== "newBody" &&
    derivedExactMetadata?.status === "ready" &&
    legacy.sourceStatus !== "supported"
  ) {
    const diagnostic = createExactResultDiagnostic(
      body,
      "blocked",
      "EXPORT_EXACT_SOURCE_UNAVAILABLE",
      legacy.diagnostics[0]?.message ??
        `Body ${body.id} has unresolved boolean-result dependencies.`
    );
    return {
      sourceKind,
      sourceStatus: "supported",
      currentExactResult: {
        status: "blocked",
        bodyId: body.id,
        sourceType: body.source.type,
        diagnostics: [diagnostic]
      },
      diagnostics: [
        ...legacy.diagnostics,
        exactDiagnosticToExportDiagnostic(diagnostic, sourceKind)
      ]
    };
  }

  const currentExactResult = createCurrentExactResult(
    document,
    bodies,
    body,
    derivedExactMetadata
  );
  const capability = createBodyDiagnostic(
    "EXPORT_BODY_SOURCE_SUPPORTED",
    "supported",
    `Body ${body.id} has completed ${body.source.type} source semantics.`,
    body,
    sourceKind
  );
  return {
    sourceKind,
    sourceStatus: "supported",
    currentExactResult,
    diagnostics: [
      capability,
      ...currentExactResult.diagnostics.map((diagnostic) =>
        exactDiagnosticToExportDiagnostic(diagnostic, sourceKind)
      )
    ]
  };
}

const FEATURE_KIND_BY_BODY_SOURCE_TYPE = {
  primitiveFeature: "primitive",
  sketchExtrudeFeature: "extrude",
  sketchRevolveFeature: "revolve",
  sketchHoleFeature: "hole",
  edgeChamferFeature: "chamfer",
  edgeFilletFeature: "fillet",
  linearPatternFeature: "linearPattern",
  circularPatternFeature: "circularPattern",
  mirrorFeature: "mirror",
  combineFeature: "combine",
  offsetFeature: "offset",
  alignFeature: "align",
  draftFeature: "draft",
  shellFeature: "shell",
  sweepFeature: "sweep",
  loftFeature: "loft",
  importedStepBody: "importedBody"
} as const satisfies Record<
  CadBodySource["type"],
  Feature["kind"] | "primitive"
>;

function expectedFeatureKind(
  sourceType: CadBodySource["type"]
): Feature["kind"] | "primitive" {
  return FEATURE_KIND_BY_BODY_SOURCE_TYPE[sourceType];
}

function createCurrentExactResult(
  document: CadDocument,
  bodies: readonly CadBodySnapshot[],
  body: CadBodySnapshot,
  metadata: CadBodyDerivedExactMetadataSnapshot | undefined
): CadCurrentExactResult {
  const sourceIdentitySignature = getBodySourceIdentitySignature(
    document,
    bodies,
    body
  );
  if (!metadata) {
    return createBlockedCurrentExactResult(
      body,
      "pending",
      "EXPORT_EXACT_SOURCE_UNAVAILABLE",
      `Body ${body.id} is source-eligible but has no current exact result evidence.`
    );
  }
  if (metadata.sourceIdentitySignature !== sourceIdentitySignature) {
    return createBlockedCurrentExactResult(
      body,
      "stale",
      "EXPORT_EXACT_SOURCE_STALE",
      `Body ${body.id} exact result evidence is stale.`,
      sourceIdentitySignature,
      metadata.sourceIdentitySignature
    );
  }
  if (metadata.status === "ready") {
    if (!metadata.metadata) {
      return createBlockedCurrentExactResult(
        body,
        "failed",
        "EXPORT_EXACT_ARTIFACT_INVALID",
        `Body ${body.id} exact result is marked ready without metadata.`
      );
    }
    if (BODY_TOPOLOGY_VALIDATED_SOURCE_TYPES.has(body.source.type)) {
      const topology = createBodyTopology({
        document,
        bodyId: body.id,
        units: document.units,
        ownerPartId: body.partId,
        bodyExists: (bodyId) =>
          bodies.some((candidate) => candidate.id === bodyId),
        derivedExactMetadata: metadata
      });
      if (
        !topology.ok ||
        topology.topology.status !== "healthy" ||
        !topology.topology.exactGeometryAvailable
      ) {
        const topologyStatus = topology.ok
          ? topology.topology.status
          : "ambiguous";
        const issue = topology.ok ? topology.topology.issues.at(-1) : undefined;
        const status: Exclude<CadCurrentExactResultStatus, "ready"> =
          topologyStatus === "stale"
            ? "stale"
            : topologyStatus === "unsupported"
              ? "unsupported"
              : topologyStatus === "kernel-failed"
                ? "failed"
                : "blocked";
        return createBlockedCurrentExactResult(
          body,
          status,
          status === "stale"
            ? "EXPORT_EXACT_SOURCE_STALE"
            : status === "failed"
              ? "EXPORT_EXACT_ARTIFACT_FAILED"
              : status === "unsupported"
                ? "EXPORT_BODY_SOURCE_UNSUPPORTED"
                : "EXPORT_EXACT_SOURCE_UNAVAILABLE",
          issue?.message ?? `Body ${body.id} exact topology is not current.`,
          issue?.expected,
          issue?.received
        );
      }
    }
    return {
      status: "ready",
      bodyId: body.id,
      sourceType: body.source.type,
      sourceIdentitySignature,
      diagnostics: []
    };
  }
  const status: CadCurrentExactResultStatus =
    metadata.status === "stale"
      ? "stale"
      : metadata.status === "unsupported"
        ? "unsupported"
        : metadata.status === "kernel-failed"
          ? "failed"
          : "blocked";
  const code: CadExportDiagnostic["code"] =
    status === "stale"
      ? "EXPORT_EXACT_SOURCE_STALE"
      : status === "failed"
        ? "EXPORT_EXACT_ARTIFACT_FAILED"
        : status === "unsupported"
          ? "EXPORT_BODY_SOURCE_UNSUPPORTED"
          : "EXPORT_EXACT_SOURCE_UNAVAILABLE";
  return createBlockedCurrentExactResult(
    body,
    status,
    code,
    metadata.error?.message ??
      `Body ${body.id} exact result status is ${metadata.status}.`
  );
}

const BODY_TOPOLOGY_VALIDATED_SOURCE_TYPES: ReadonlySet<CadBodySource["type"]> =
  new Set([
    "sketchExtrudeFeature",
    "sketchRevolveFeature",
    "sketchHoleFeature",
    "edgeChamferFeature",
    "edgeFilletFeature",
    "sweepFeature"
  ]);

function createBlockedCurrentExactResult(
  body: CadBodySnapshot,
  status: Exclude<CadCurrentExactResultStatus, "ready">,
  code: CadExportDiagnostic["code"],
  message: string,
  expected?: string,
  received?: string
): CadCurrentExactResult {
  return {
    status,
    bodyId: body.id,
    sourceType: body.source.type,
    diagnostics: [
      createExactResultDiagnostic(
        body,
        status,
        code,
        message,
        expected,
        received
      )
    ]
  };
}

function createExactResultDiagnostic(
  body: CadBodySnapshot,
  status: CadCurrentExactResultStatus,
  code: CadExportDiagnostic["code"],
  message: string,
  expected?: string,
  received?: string
): CadExactResultDiagnostic {
  return {
    code,
    status,
    message,
    bodyId: body.id,
    sourceType: body.source.type,
    featureId: body.featureId,
    ...(expected ? { expected } : {}),
    ...(received ? { received } : {})
  };
}

function exactDiagnosticToExportDiagnostic(
  diagnostic: CadExactResultDiagnostic,
  sourceKind: CadExportBodySourceKind
): CadExportDiagnostic {
  return {
    code: diagnostic.code,
    status:
      diagnostic.status === "ready"
        ? "supported"
        : diagnostic.status === "pending" || diagnostic.status === "stale"
          ? "deferred"
          : "unavailable",
    format: "step",
    message: diagnostic.message,
    ...(diagnostic.bodyId ? { bodyId: diagnostic.bodyId } : {}),
    ...(diagnostic.featureId ? { featureId: diagnostic.featureId } : {}),
    sourceKind,
    ...(diagnostic.expected ? { expected: diagnostic.expected } : {}),
    ...(diagnostic.received ? { received: diagnostic.received } : {})
  };
}

function getBodySourceIdentitySignature(
  document: CadDocument,
  bodies: readonly CadBodySnapshot[],
  body: CadBodySnapshot
): string {
  const topology = createBodyTopology({
    document,
    bodyId: body.id,
    units: document.units,
    ownerPartId: body.partId,
    bodyExists: (bodyId) => bodies.some((candidate) => candidate.id === bodyId)
  });
  return topology.ok
    ? topology.topology.sourceIdentity.signature
    : sha256Hex(
        encodeCanonicalCbor({
          bodyId: body.id,
          source: body.source,
          units: document.units
        })
      );
}

function exactStatusToReadiness(
  status: CadCurrentExactResultStatus
): CadExportReadinessStatus {
  return status === "ready"
    ? "supported"
    : status === "pending" || status === "stale"
      ? "deferred"
      : "unavailable";
}

function reconcileCurrentExactResult(
  document: CadDocument,
  bodies: readonly CadBodySnapshot[],
  body: CadBodySnapshot,
  classified: CadCurrentExactResult,
  supplied: CadCurrentExactResult | undefined
): CadCurrentExactResult {
  let result: CadCurrentExactResult;
  if (
    !supplied ||
    supplied.sourceType !== body.source.type ||
    classified.status === "unsupported" ||
    classified.status === "blocked"
  ) {
    result = classified;
  } else if (supplied.status !== "ready") {
    result = supplied;
  } else {
    const sourceIdentitySignature = getBodySourceIdentitySignature(
      document,
      bodies,
      body
    );
    result =
      supplied.sourceIdentitySignature !== sourceIdentitySignature
        ? createBlockedCurrentExactResult(
            body,
            "stale",
            "EXPORT_EXACT_SOURCE_STALE",
            `Exact result for body ${body.id} does not match the current body source.`,
            sourceIdentitySignature,
            supplied.sourceIdentitySignature
          )
        : classified.status === "ready"
          ? supplied
          : classified;
  }

  const dependency = evaluateCadBodyDependencies(document, bodies, body.id);
  const suppliedShapePolicies = new Set(
    result.downstreamReadiness?.flatMap((entry) =>
      entry.shapePolicy ? [entry.shapePolicy] : []
    )
  );
  const suppliedShapePolicy =
    suppliedShapePolicies.size === 1
      ? [...suppliedShapePolicies][0]
      : undefined;
  return {
    ...result,
    downstreamReadiness: CAD_DOWNSTREAM_BODY_OPERATIONS.map((operation) => {
      return createCadDownstreamBodyPolicyProjection({
        bodyId: body.id,
        featureId: body.featureId,
        sourceType: body.source.type,
        operation,
        lifecycle: body.consumedByFeatureId ? "consumed" : "active",
        dependencyStatus: dependency.status,
        dependencyCycle: dependency.cycle,
        exactStatus: result.status,
        shapePolicy:
          result.status === "ready"
            ? (result.artifactEvidence?.shapePolicy ?? suppliedShapePolicy)
            : undefined,
        diagnostics: result.diagnostics
      }).readiness;
    })
  };
}

function classifyLegacyBodySource(
  document: CadDocument,
  body: CadBodySnapshot,
  derivedExactMetadata?: CadBodyDerivedExactMetadataSnapshot
): BodySourceCapability {
  const sourceKind = getBodyExportSourceKind(body);

  if (body.consumedByFeatureId) {
    return {
      sourceKind,
      sourceStatus: "unavailable",
      diagnostics: [
        createBodyDiagnostic(
          "EXPORT_BODY_CONSUMED",
          "unavailable",
          `Body ${body.id} is consumed by feature ${body.consumedByFeatureId} and is not an active export candidate.`,
          body,
          sourceKind,
          {
            consumedByFeatureId: body.consumedByFeatureId,
            expected: "active body",
            received: "consumed body"
          }
        )
      ]
    };
  }

  if (body.source.type === "primitiveFeature") {
    return {
      sourceKind,
      sourceStatus: "unavailable",
      diagnostics: [
        createBodyDiagnostic(
          "EXPORT_PRIMITIVE_SOURCE_UNAVAILABLE",
          "unavailable",
          `Primitive scene object body ${body.id} uses compatibility source semantics; CAD file export readiness covers authored body features.`,
          body,
          sourceKind,
          {
            objectId: body.source.objectId,
            expected: "authored CAD body feature",
            received: body.primitive ?? "primitive object"
          }
        )
      ]
    };
  }

  if (body.source.type === "sketchExtrudeFeature") {
    const feature = document.features.get(body.featureId);

    if (!feature || feature.kind !== "extrude") {
      return createUnresolvedBodySourceReadiness(body, sourceKind);
    }

    const regionProfile = getRegionExtrudeProfile(feature);
    if (regionProfile) {
      const recipe = createExactRegionExtrudeRecipe(
        document,
        feature,
        body.partId,
        new Set()
      );
      if (!recipe) {
        return createUnresolvedBodySourceReadiness(body, sourceKind);
      }
      const currentExactResult =
        feature.operationMode === "newBody" ||
        hasCurrentReadyExactResultEvidence(
          document,
          body,
          derivedExactMetadata
        );
      return currentExactResult
        ? {
            sourceKind,
            sourceStatus: "supported",
            diagnostics: [
              createBodyDiagnostic(
                "EXPORT_BODY_SOURCE_SUPPORTED",
                "supported",
                `Region extrude ${feature.operationMode} body ${body.id} has a canonical exact STEP recipe${feature.operationMode === "newBody" ? "" : " and current exact result evidence"}.`,
                body,
                sourceKind
              )
            ]
          }
        : {
            sourceKind,
            sourceStatus: "deferred",
            diagnostics: [
              createBodyDiagnostic(
                "EXPORT_RESULT_BODY_DEFERRED",
                "deferred",
                `Region extrude ${feature.operationMode} body ${body.id} requires current exact one-solid result evidence before STEP export.`,
                body,
                sourceKind,
                {
                  expected: "current exact region result evidence",
                  received: "missing or stale exact result"
                }
              )
            ]
          };
    }

    if (
      feature.operationMode !== "newBody" &&
      feature.profile.kind === "wire" &&
      hasCurrentReadyExactResultEvidence(
        document,
        body,
        derivedExactMetadata
      ) &&
      createExactBooleanSource(document, feature, body.partId, new Set())
    ) {
      return {
        sourceKind,
        sourceStatus: "supported",
        diagnostics: [
          createBodyDiagnostic(
            "EXPORT_BODY_SOURCE_SUPPORTED",
            "supported",
            `Composite wire ${feature.operationMode} result body ${body.id} has current exact result evidence and a recursive exact STEP recipe.`,
            body,
            sourceKind
          )
        ]
      };
    }

    if (feature.operationMode !== "newBody") {
      return {
        sourceKind,
        sourceStatus: "deferred",
        diagnostics: [
          createBodyDiagnostic(
            "EXPORT_RESULT_BODY_DEFERRED",
            "deferred",
            `Extrude result body ${body.id} is source-modeled, but ${feature.operationMode} result export readiness is deferred until result-body writing is implemented.`,
            body,
            sourceKind,
            {
              expected: "authored rectangle/circle newBody extrude",
              received: `${feature.operationMode} extrude result`
            }
          )
        ]
      };
    }

    if (feature.profile.kind === "wire") {
      const resolved = createResolvedWireExtrudeProfile(
        document,
        feature.profile,
        body.partId
      );
      if (!resolved) {
        return createUnresolvedBodySourceReadiness(body, sourceKind);
      }
      return {
        sourceKind,
        sourceStatus: "supported",
        diagnostics: [
          createBodyDiagnostic(
            "EXPORT_BODY_SOURCE_SUPPORTED",
            "supported",
            `Authored composite wire newBody extrude body ${body.id} has a resolved exact STEP recipe.`,
            body,
            sourceKind
          )
        ]
      };
    }

    const profile = getFeatureEntityProfileRef(feature);
    const entity = profile
      ? document.sketches.get(profile.sketchId)?.entities.get(profile.entityId)
      : undefined;
    const profileKind = getSupportedEntityProfileKind(entity);

    if (!profileKind) {
      return createUnresolvedBodySourceReadiness(body, sourceKind);
    }

    return {
      sourceKind,
      sourceStatus: "supported",
      diagnostics: [
        createBodyDiagnostic(
          "EXPORT_BODY_SOURCE_SUPPORTED",
          "supported",
          `Authored ${profileKind} newBody extrude body ${body.id} has supported source semantics for future file export.`,
          body,
          sourceKind
        )
      ]
    };
  }

  if (body.source.type === "sketchRevolveFeature") {
    const feature = document.features.get(body.featureId);
    const authoredProfile =
      feature?.kind === "revolve"
        ? (feature.profile as import("@web-cad/cad-protocol").SketchProfileRefV22)
        : undefined;
    if (
      feature?.kind === "revolve" &&
      (authoredProfile?.kind === "wire" || authoredProfile?.kind === "regions")
    ) {
      const resolved =
        authoredProfile.kind === "wire"
          ? createResolvedWireRevolveProfile(
              document,
              authoredProfile,
              feature.axis,
              body.partId
            )
          : createResolvedRegionRevolveProfile(
              document,
              authoredProfile,
              feature.axis,
              body.partId
            );
      if (feature.operationMode !== "newBody" || !resolved) {
        return createUnresolvedBodySourceReadiness(body, sourceKind);
      }
      return {
        sourceKind,
        sourceStatus: "supported",
        diagnostics: [
          createBodyDiagnostic(
            "EXPORT_BODY_SOURCE_SUPPORTED",
            "supported",
            `Authored ${authoredProfile.kind === "regions" ? "region" : "composite wire"} revolve body ${body.id} has a resolved exact STEP recipe.`,
            body,
            sourceKind
          )
        ]
      };
    }
  }

  if (body.source.type === "sweepFeature") {
    const feature = document.features.get(body.featureId);
    const isCurvedV17Sweep =
      feature?.kind === "sweep" &&
      (feature.path.kind === "chain" ||
        document.sketches
          .get(feature.path.sketchId)
          ?.entities.get(feature.path.entityId)?.kind === "arc");
    const resolved =
      feature?.kind === "sweep" && isCurvedV17Sweep
        ? createResolvedSweepSource(document, feature, body.partId, body.name)
        : undefined;
    if (!resolved) {
      return {
        sourceKind,
        sourceStatus: "deferred",
        diagnostics: [
          createBodyDiagnostic(
            "EXPORT_RESULT_BODY_DEFERRED",
            "deferred",
            `Sweep body ${body.id} is source-modeled, but only V17 curved sweep exact export is enabled.`,
            body,
            sourceKind,
            {
              expected: "resolved V17 arc or G1 line/arc-chain sweep",
              received: "legacy or unresolved sweep"
            }
          )
        ]
      };
    }
    return {
      sourceKind,
      sourceStatus: "supported",
      diagnostics: [
        createBodyDiagnostic(
          "EXPORT_BODY_SOURCE_SUPPORTED",
          "supported",
          `Authored curved sweep body ${body.id} has a resolved exact STEP recipe.`,
          body,
          sourceKind
        )
      ]
    };
  }

  if (
    body.source.type === "sketchRevolveFeature" ||
    body.source.type === "sketchHoleFeature" ||
    body.source.type === "edgeChamferFeature" ||
    body.source.type === "edgeFilletFeature" ||
    body.source.type === "shellFeature"
  ) {
    return {
      sourceKind,
      sourceStatus: "deferred",
      diagnostics: [
        createBodyDiagnostic(
          "EXPORT_RESULT_BODY_DEFERRED",
          "deferred",
          `Result body ${body.id} is source-modeled, but export readiness for this V6 result-body source is deferred until the export writer boundary supports it.`,
          body,
          sourceKind,
          {
            expected: "writer-supported result body",
            received: body.source.type
          }
        )
      ]
    };
  }

  return createUnresolvedBodySourceReadiness(body, sourceKind);
}

function createUnresolvedBodySourceReadiness(
  body: CadBodySnapshot,
  sourceKind: CadExportBodySourceKind
): BodySourceCapability {
  return {
    sourceKind,
    sourceStatus: "unavailable",
    diagnostics: [
      createBodyDiagnostic(
        "EXPORT_BODY_SOURCE_UNRESOLVED",
        "unavailable",
        `Body ${body.id} no longer resolves to a supported authoritative source feature.`,
        body,
        sourceKind,
        {
          expected: "resolvable authored body feature",
          received: body.source.type
        }
      )
    ]
  };
}

function chooseProjectStatus(
  bodies: readonly CadExportBodyReadiness[]
): CadExportReadinessStatus {
  if (
    bodies.length === 0 ||
    bodies.some((body) => body.status === "unavailable")
  ) {
    return "unavailable";
  }

  if (bodies.some((body) => body.status === "deferred")) {
    return "deferred";
  }

  return "supported";
}

function getProjectionReadinessStatus(
  projection: CurrentExactExportProjection
): CadExportReadinessStatus {
  if (projection.executable) return "supported";
  if (projection.globalDiagnostics.length > 0) return "unavailable";
  return projection.currentExactResults.some(
    (result) => result.status === "pending" || result.status === "stale"
  )
    ? "deferred"
    : "unavailable";
}

function getBodyExportSourceKind(
  body: CadBodySnapshot
): CadExportBodySourceKind {
  switch (body.source.type) {
    case "primitiveFeature":
      return "primitiveCompatibility";
    case "sketchExtrudeFeature":
      return "authoredExtrude";
    case "sketchRevolveFeature":
      return "authoredRevolve";
    case "sketchHoleFeature":
      return "authoredHole";
    case "edgeChamferFeature":
      return "authoredChamfer";
    case "edgeFilletFeature":
      return "authoredFillet";
    case "shellFeature":
      return "authoredShell";
    case "importedStepBody":
      return "importedBody";
    case "linearPatternFeature":
    case "circularPatternFeature":
    case "mirrorFeature":
    case "combineFeature":
    case "offsetFeature":
    case "alignFeature":
    case "draftFeature":
    case "loftFeature":
      return "unresolvedSource";
    case "sweepFeature":
      return "authoredSweep";
  }
}

function createWriterDiagnostic(
  format: ExportFormatDefinition,
  body?: CadBodySnapshot,
  sourceKind?: CadExportBodySourceKind
): CadExportDiagnostic {
  if (format.exportKind === "exact") {
    return {
      code: "EXPORT_BODY_SOURCE_SUPPORTED",
      status: "supported",
      message:
        "STEP exact export writer is available through the geometry boundary for supported source bodies.",
      format: format.format,
      ...(body
        ? {
            bodyId: body.id,
            ...(body.name ? { bodyName: body.name } : {}),
            bodyKind: body.kind,
            featureId: body.featureId,
            ...(body.objectId ? { objectId: body.objectId } : {})
          }
        : {}),
      ...(sourceKind ? { sourceKind } : {}),
      expected: "geometry-worker STEP writer capability",
      received: "writer available"
    };
  }

  return {
    code: "EXPORT_WRITER_NOT_IMPLEMENTED",
    status: "deferred",
    message: `${format.label} file export is not implemented yet; this query reports readiness and blockers only.`,
    format: format.format,
    ...(body
      ? {
          bodyId: body.id,
          ...(body.name ? { bodyName: body.name } : {}),
          bodyKind: body.kind,
          featureId: body.featureId,
          ...(body.objectId ? { objectId: body.objectId } : {})
        }
      : {}),
    ...(sourceKind ? { sourceKind } : {}),
    expected: "file writer",
    received: "readiness contract only"
  };
}

function getSourceIdentityStatus(
  requested: WcadSourceIdentity | undefined,
  current: WcadSourceIdentity
): CadExactExportSourceIdentityStatus {
  if (!requested) {
    return "notProvided";
  }

  return requested.algorithm === current.algorithm &&
    requested.sha256 === current.sha256
    ? "matchedCurrent"
    : "mismatchedCurrent";
}

function createSourceIdentityMismatchDiagnostic(
  requested: WcadSourceIdentity,
  current: WcadSourceIdentity
): CadExportDiagnostic {
  return {
    code: "EXPORT_SOURCE_IDENTITY_MISMATCH",
    status: "unavailable",
    format: "step",
    message:
      "Requested source identity does not match the current authoritative project source.",
    expected: current.sha256,
    received: requested.sha256
  };
}

function createStepWriterUnavailableDiagnostic(
  body?: CadBodySnapshot,
  sourceKind?: CadExportBodySourceKind
): CadExportDiagnostic {
  return {
    code: "EXPORT_EXACT_WRITER_UNAVAILABLE",
    status: "unavailable",
    format: "step",
    message:
      "STEP exact export writer is unavailable through the geometry boundary.",
    ...(body
      ? {
          bodyId: body.id,
          ...(body.name ? { bodyName: body.name } : {}),
          bodyKind: body.kind,
          featureId: body.featureId,
          ...(body.objectId ? { objectId: body.objectId } : {})
        }
      : {}),
    ...(sourceKind ? { sourceKind } : {}),
    expected: "geometry-worker STEP writer capability",
    received: "writer unavailable"
  };
}

function createMissingExactBodyDiagnostic(bodyId: string): CadExportDiagnostic {
  return {
    code: "EXPORT_BODY_SELECTION_INVALID",
    status: "unavailable",
    format: "step",
    bodyId,
    message: `Requested body ${bodyId} does not exist in the current authoritative project structure.`,
    expected: "current body id",
    received: "missing body id"
  };
}

function createDuplicateExactBodyDiagnostic(
  bodyId: string
): CadExportDiagnostic {
  return {
    code: "EXPORT_BODY_DUPLICATE",
    status: "unavailable",
    format: "step",
    bodyId,
    message: `Requested body ${bodyId} appears more than once.`,
    expected: "unique ordered body ids",
    received: bodyId
  };
}

function createInactiveExactBodyDiagnostic(
  body: CadBodySnapshot
): CadExportDiagnostic {
  return {
    code: "EXPORT_BODY_NOT_ACTIVE",
    status: "unavailable",
    format: "step",
    bodyId: body.id,
    bodyName: body.name,
    bodyKind: body.kind,
    featureId: body.featureId,
    consumedByFeatureId: body.consumedByFeatureId,
    message: `Requested body ${body.id} is consumed and is not an active export body.`,
    expected: "active body",
    received: "consumed body"
  };
}

function createExactExportBodySource(
  document: CadDocument,
  body: CadExportBodyReadiness,
  derivedExactMetadata?: CadBodyDerivedExactMetadataSnapshot
): CadExactExportBodySource | undefined {
  const feature = document.features.get(body.featureId);

  if (!feature) {
    return undefined;
  }

  if (feature.kind === "revolve") {
    return createExactRevolveBodySource(document, body, feature);
  }

  if (feature.kind === "sweep") {
    return createExactSweepBodySource(document, body, feature);
  }

  if (feature.kind !== "extrude") return undefined;

  const regionProfile = getRegionExtrudeProfile(feature);
  if (regionProfile) {
    if (
      feature.operationMode !== "newBody" &&
      (!derivedExactMetadata ||
        !hasCurrentReadyExactResultEvidence(
          document,
          { id: body.bodyId, partId: body.partId },
          derivedExactMetadata
        ))
    ) {
      return undefined;
    }
    const sketch = document.sketches.get(regionProfile.sketchId);
    const recipe = createExactRegionExtrudeRecipe(
      document,
      feature,
      body.partId,
      new Set()
    );
    if (!sketch || !recipe) return undefined;
    return {
      bodyId: body.bodyId,
      ...(body.bodyName ? { bodyName: body.bodyName } : {}),
      sourceKind: "authoredExtrude",
      kind: "regionExtrude",
      featureId: feature.id,
      sourceSketchId: regionProfile.sketchId,
      sourceSketchEntityIds: getProfileEntityReferences(regionProfile).map(
        (reference) => reference.entityId
      ),
      sketchPlane: sketch.plane,
      depth: feature.depth,
      side: feature.side,
      regions: regionProfile,
      recipe,
      ...(feature.targetBodyId ? { targetBodyId: feature.targetBodyId } : {}),
      ...(feature.targetTopologyAnchorId
        ? { targetTopologyAnchorId: feature.targetTopologyAnchorId }
        : {}),
      ...(derivedExactMetadata
        ? {
            exactResultSourceIdentitySignature:
              derivedExactMetadata.sourceIdentitySignature
          }
        : {}),
      solidPolicy: "positiveVolumeSingleSolid"
    };
  }

  if (feature.operationMode !== "newBody" && feature.profile.kind === "wire") {
    if (
      !derivedExactMetadata ||
      !hasCurrentReadyExactResultEvidence(
        document,
        { id: body.bodyId, partId: body.partId },
        derivedExactMetadata
      )
    ) {
      return undefined;
    }
    const source = createExactBooleanSource(
      document,
      feature,
      body.partId,
      new Set()
    );
    const sketch = document.sketches.get(feature.profile.sketchId);
    if (!source || !isExactBooleanResultSource(source) || !sketch) {
      return undefined;
    }
    return {
      bodyId: body.bodyId,
      ...(body.bodyName ? { bodyName: body.bodyName } : {}),
      sourceKind: "authoredExtrude",
      featureId: feature.id,
      sourceSketchId: feature.profile.sketchId,
      sourceSketchEntityIds: feature.profile.segments.map(
        (segment) => segment.entityId
      ),
      sketchPlane: sketch.plane,
      depth: feature.depth,
      side: feature.side,
      targetBodyId: feature.targetBodyId!,
      ...(feature.targetTopologyAnchorId
        ? { targetTopologyAnchorId: feature.targetTopologyAnchorId }
        : {}),
      exactResultSourceIdentitySignature:
        derivedExactMetadata.sourceIdentitySignature,
      kind: "booleanExtrudes",
      operation: feature.operationMode,
      target: source.target,
      tool: source.tool
    };
  }

  if (feature.operationMode !== "newBody") return undefined;

  if (feature.profile.kind === "wire") {
    const sketch = document.sketches.get(feature.profile.sketchId);
    const resolved = createResolvedWireExtrudeProfile(
      document,
      feature.profile,
      body.partId
    );
    if (!sketch || !resolved) return undefined;
    return {
      bodyId: body.bodyId,
      ...(body.bodyName ? { bodyName: body.bodyName } : {}),
      sourceKind: "authoredExtrude",
      featureId: feature.id,
      sourceSketchId: feature.profile.sketchId,
      sourceSketchEntityIds: feature.profile.segments.map(
        (segment) => segment.entityId
      ),
      sketchPlane: sketch.plane,
      profile: resolved,
      depth: feature.depth,
      side: feature.side
    };
  }

  const profile = getFeatureEntityProfileRef(feature);
  const sketch = profile ? document.sketches.get(profile.sketchId) : undefined;
  const entity = sketch?.entities.get(profile?.entityId ?? "");

  if (!profile || !sketch || !entity || !isExactExportExtrudeEntity(entity)) {
    return undefined;
  }

  const frame = createSourceMeasurementFrame(document, sketch, body.partId);

  if (!frame) {
    return undefined;
  }

  return {
    bodyId: body.bodyId,
    ...(body.bodyName ? { bodyName: body.bodyName } : {}),
    sourceKind: "authoredExtrude",
    featureId: feature.id,
    sourceSketchId: profile.sketchId,
    sourceSketchEntityId: profile.entityId,
    sketchPlane: sketch.plane,
    profile:
      entity.kind === "rectangle"
        ? {
            kind: entity.kind,
            center: entity.center,
            width: entity.width,
            height: entity.height
          }
        : {
            kind: entity.kind,
            center: entity.center,
            radius: entity.radius
          },
    depth: feature.depth,
    side: feature.side,
    ...(sketch.attachment
      ? {
          placementFrame: {
            origin: frame.origin,
            uAxis: frame.uAxis,
            vAxis: frame.vAxis
          }
        }
      : {})
  };
}

function createExactRevolveBodySource(
  document: CadDocument,
  body: CadExportBodyReadiness,
  feature: RevolveFeature
): CadExactExportBodySource | undefined {
  const profile =
    feature.profile as import("@web-cad/cad-protocol").SketchProfileRefV22;
  if (
    feature.operationMode !== "newBody" ||
    (profile.kind !== "wire" && profile.kind !== "regions")
  ) {
    return undefined;
  }
  const sketch = document.sketches.get(profile.sketchId);
  const resolved =
    profile.kind === "wire"
      ? createResolvedWireRevolveProfile(
          document,
          profile,
          feature.axis,
          body.partId
        )
      : createResolvedRegionRevolveProfile(
          document,
          profile,
          feature.axis,
          body.partId
        );
  if (!sketch || !resolved) return undefined;
  return {
    bodyId: body.bodyId,
    ...(body.bodyName ? { bodyName: body.bodyName } : {}),
    sourceKind: "authoredRevolve",
    featureId: feature.id,
    sourceSketchId: profile.sketchId,
    sourceSketchEntityIds: getProfileEntityReferences(profile).map(
      (reference) => reference.entityId
    ),
    sketchPlane: sketch.plane,
    profile: resolved.profile,
    axis: resolved.axis,
    angleDegrees: feature.angleDegrees,
    solidPolicy: "exactlyOne"
  };
}

function createExactSweepBodySource(
  document: CadDocument,
  body: CadExportBodyReadiness,
  feature: SweepFeature
): CadExactExportSweepBodySource | undefined {
  return createResolvedSweepSource(
    document,
    feature,
    body.partId,
    body.bodyName
  );
}

function hasCurrentReadyExactResultEvidence(
  document: CadDocument,
  body: Pick<CadBodySnapshot, "id" | "partId">,
  metadata: CadBodyDerivedExactMetadataSnapshot | undefined
): boolean {
  if (!metadata) return false;
  const topology = createBodyTopology({
    document,
    bodyId: body.id,
    units: document.units,
    ownerPartId: body.partId,
    bodyExists: (bodyId) =>
      [...document.features.values()].some(
        (feature) => feature.bodyId === bodyId
      ),
    derivedExactMetadata: metadata
  });
  return (
    topology.ok &&
    topology.topology.status === "healthy" &&
    topology.topology.exactGeometryAvailable &&
    metadata.status === "ready"
  );
}

function createExactBooleanSource(
  document: CadDocument,
  feature: ExtrudeFeature,
  ownerPartId: PartId,
  visitedFeatureIds: ReadonlySet<string>
): CadExactExportBooleanSource | undefined {
  if (visitedFeatureIds.has(feature.id)) return undefined;
  if (getRegionExtrudeProfile(feature)) {
    return createExactRegionExtrudeRecipe(
      document,
      feature,
      ownerPartId,
      visitedFeatureIds
    );
  }
  if (feature.operationMode !== "newBody" && feature.profile.kind === "wire") {
    const resolution = resolveWireExtrudeProfile(
      document,
      feature.profile,
      feature.operationMode,
      {
        targetBodyId: feature.targetBodyId,
        targetTopologyAnchorId: feature.targetTopologyAnchorId,
        ignoreFeatureId: feature.id
      }
    );
    if (!resolution.ok) return undefined;
  }
  const visited = new Set(visitedFeatureIds).add(feature.id);
  const tool = createExactExtrudeToolSource(document, feature, ownerPartId);
  if (!tool) return undefined;
  if (feature.operationMode === "newBody") {
    return tool;
  }
  if (!feature.targetBodyId) return undefined;
  const targetFeature = [...document.features.values()].find(
    (candidate): candidate is ExtrudeFeature =>
      candidate.kind === "extrude" && candidate.bodyId === feature.targetBodyId
  );
  if (!targetFeature) return undefined;
  const target = createExactBooleanSource(
    document,
    targetFeature,
    ownerPartId,
    visited
  );
  if (!target) return undefined;
  if (feature.operationMode === "cut") {
    return { kind: "booleanExtrudes", operation: "cut", target, tool };
  }
  return { kind: "booleanExtrudes", operation: "add", target, tool };
}

function getRegionExtrudeProfile(
  feature: ExtrudeFeature
): SketchRegionsProfileRef | undefined {
  const profile = (feature as unknown as { readonly profile?: unknown })
    .profile;
  return isSketchRegionsProfileRef(profile) ? profile : undefined;
}

function createExactRegionExtrudeRecipe(
  document: CadDocument,
  feature: ExtrudeFeature,
  ownerPartId: PartId,
  visitedFeatureIds: ReadonlySet<string>
): CadExactExportBooleanSource | undefined {
  if (visitedFeatureIds.has(feature.id)) return undefined;
  const profile = getRegionExtrudeProfile(feature);
  const sketch = profile ? document.sketches.get(profile.sketchId) : undefined;
  if (!profile || !sketch) return undefined;
  const validation = validateRegisteredV22RegionSource(profile, {
    id: sketch.id,
    entities: sketch.entities
  });
  if (!validation.ok) return undefined;
  const regionTools = validation.normalizedProfile.regions.map((region) =>
    createExactRegionMaterialSource(
      document,
      validation.normalizedProfile.sketchId,
      region.outer,
      region.holes,
      feature,
      ownerPartId
    )
  );
  if (regionTools.some((tool) => tool === undefined)) return undefined;
  const tools = regionTools as readonly CadExactExportBooleanSource[];
  if (feature.operationMode === "newBody") {
    return tools.length === 1 ? tools[0] : undefined;
  }
  if (!feature.targetBodyId) return undefined;
  const targetFeature = [...document.features.values()].find(
    (candidate): candidate is ExtrudeFeature =>
      candidate.kind === "extrude" && candidate.bodyId === feature.targetBodyId
  );
  if (!targetFeature) return undefined;
  const visited = new Set(visitedFeatureIds).add(feature.id);
  const target = createExactBooleanSource(
    document,
    targetFeature,
    ownerPartId,
    visited
  );
  if (!target) return undefined;
  return tools.reduce<CadExactExportBooleanSource>(
    (currentTarget, tool) => ({
      kind: "booleanExtrudes",
      operation: feature.operationMode === "add" ? "add" : "cut",
      materialPolicy: "regionPositiveVolumeSingleSolid",
      target: currentTarget,
      tool
    }),
    target
  );
}

function createExactRegionMaterialSource(
  document: CadDocument,
  sketchId: string,
  outer: SketchLoopRef,
  holes: readonly SketchLoopRef[],
  feature: ExtrudeFeature,
  ownerPartId: PartId
): CadExactExportBooleanSource | undefined {
  const outerSource = createExactRegionLoopSource(
    document,
    sketchId,
    outer,
    feature,
    ownerPartId
  );
  if (!outerSource) return undefined;
  let result: CadExactExportBooleanSource = outerSource;
  for (const hole of holes) {
    const holeSource = createExactRegionLoopSource(
      document,
      sketchId,
      hole,
      feature,
      ownerPartId
    );
    if (!holeSource) return undefined;
    result = {
      kind: "booleanExtrudes",
      operation: "cut",
      materialPolicy: "regionPositiveVolumeSingleSolid",
      target: result,
      tool: holeSource
    };
  }
  return result;
}

function createExactRegionLoopSource(
  document: CadDocument,
  sketchId: string,
  loop: SketchLoopRef,
  feature: ExtrudeFeature,
  ownerPartId: PartId
):
  | CadExactExportPrimitiveExtrudeSource
  | CadExactExportWireExtrudeSource
  | undefined {
  const sketch = document.sketches.get(sketchId);
  if (!sketch) return undefined;
  if (loop.kind === "wire") {
    const frame = createSourceMeasurementFrame(document, sketch, ownerPartId);
    if (!frame) return undefined;
    const profile = createResolvedWireExtrudeRecipe(
      { kind: "wire", sketchId, segments: loop.segments },
      sketch.entities,
      {
        origin: frame.origin,
        uAxis: frame.uAxis,
        vAxis: frame.vAxis
      }
    );
    return profile
      ? {
          sketchPlane: sketch.plane,
          profile,
          depth: feature.depth,
          side: feature.side
        }
      : undefined;
  }
  const entity = sketch.entities.get(loop.entityId);
  if (!entity || !isExactExportExtrudeEntity(entity)) return undefined;
  const frame = createSourceMeasurementFrame(document, sketch, ownerPartId);
  if (!frame) return undefined;
  return {
    sketchPlane: sketch.plane,
    profile:
      entity.kind === "rectangle"
        ? {
            kind: "rectangle",
            center: entity.center,
            width: entity.width,
            height: entity.height
          }
        : {
            kind: "circle",
            center: entity.center,
            radius: entity.radius
          },
    depth: feature.depth,
    side: feature.side,
    ...(sketch.attachment
      ? {
          placementFrame: {
            origin: frame.origin,
            uAxis: frame.uAxis,
            vAxis: frame.vAxis
          }
        }
      : {})
  };
}

function isExactBooleanResultSource(
  source: CadExactExportBooleanSource
): source is CadExactExportBooleanResultSource {
  return "kind" in source && source.kind === "booleanExtrudes";
}

function createExactExtrudeToolSource(
  document: CadDocument,
  feature: ExtrudeFeature,
  ownerPartId: PartId
):
  | CadExactExportPrimitiveExtrudeSource
  | CadExactExportWireExtrudeSource
  | undefined {
  const sketch = document.sketches.get(feature.profile.sketchId);
  if (!sketch) return undefined;
  if (feature.profile.kind === "wire") {
    const profile = createResolvedWireExtrudeProfile(
      document,
      feature.profile,
      ownerPartId
    );
    return profile
      ? {
          sketchPlane: sketch.plane,
          profile,
          depth: feature.depth,
          side: feature.side
        }
      : undefined;
  }
  const entity = sketch.entities.get(feature.profile.entityId);
  if (!entity || !isExactExportExtrudeEntity(entity)) return undefined;
  const frame = createSourceMeasurementFrame(document, sketch, ownerPartId);
  if (!frame) return undefined;
  return {
    sketchPlane: sketch.plane,
    profile:
      entity.kind === "rectangle"
        ? {
            kind: "rectangle",
            center: entity.center,
            width: entity.width,
            height: entity.height
          }
        : {
            kind: "circle",
            center: entity.center,
            radius: entity.radius
          },
    depth: feature.depth,
    side: feature.side,
    ...(sketch.attachment
      ? {
          placementFrame: {
            origin: frame.origin,
            uAxis: frame.uAxis,
            vAxis: frame.vAxis
          }
        }
      : {})
  };
}

function isExactExportExtrudeEntity(
  entity: SketchEntity
): entity is Extract<SketchEntity, { readonly kind: "rectangle" | "circle" }> {
  return entity.kind === "rectangle" || entity.kind === "circle";
}

function createProjectEmptyDiagnostic(message: string): CadExportDiagnostic {
  return {
    code: "EXPORT_PROJECT_EMPTY",
    status: "unavailable",
    message,
    expected: "at least one active authored body",
    received: "empty project"
  };
}

function createBodyDiagnostic(
  code: CadExportDiagnostic["code"],
  status: CadExportReadinessStatus,
  message: string,
  body: CadBodySnapshot,
  sourceKind: CadExportBodySourceKind,
  details: {
    readonly objectId?: string;
    readonly consumedByFeatureId?: string;
    readonly expected?: string;
    readonly received?: string;
  } = {}
): CadExportDiagnostic {
  return {
    code,
    status,
    message,
    bodyId: body.id,
    ...(body.name ? { bodyName: body.name } : {}),
    bodyKind: body.kind,
    sourceKind,
    featureId: body.featureId,
    ...(details.objectId ? { objectId: details.objectId } : {}),
    ...(details.consumedByFeatureId
      ? { consumedByFeatureId: details.consumedByFeatureId }
      : {}),
    ...(details.expected ? { expected: details.expected } : {}),
    ...(details.received ? { received: details.received } : {})
  };
}

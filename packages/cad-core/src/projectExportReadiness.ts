import { WCAD_SOURCE_IDENTITY_ALGORITHM } from "@web-cad/cad-protocol";
import type {
  CadBodySnapshot,
  CadExactExportBodySource,
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
  WcadSourceIdentity,
  WcadDocumentSchemaVersion
} from "@web-cad/cad-protocol";
import type { CadDocument, ExtrudeFeature, SketchEntity } from "./index";
import {
  getFeatureEntityProfileRef,
  getSupportedEntityProfileKind
} from "./featureSourceReferences";
import { createSourceMeasurementFrame } from "./sourceMeasurementGeometry";

interface ProjectExportReadinessInput {
  readonly document: CadDocument;
  readonly cadOpsVersion: CadOpsVersion;
  readonly bodies: readonly CadBodySnapshot[];
  readonly exactStepWriterStatus?: CadExactExportWriterStatus;
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

interface BodySourceReadiness {
  readonly sourceKind: CadExportBodySourceKind;
  readonly sourceStatus: CadExportReadinessStatus;
  readonly diagnostics: readonly CadExportDiagnostic[];
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
  exactStepWriterStatus = "available"
}: ProjectExportReadinessInput): ProjectExportReadinessQueryResponse {
  const bodyReadiness = bodies.map((body) =>
    createBodyExportReadiness(document, body, exactStepWriterStatus)
  );
  const formatReadiness = EXPORT_FORMATS.map((format) =>
    createFormatReadiness(
      document.units,
      format,
      bodyReadiness,
      exactStepWriterStatus
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
    ...bodyReadiness.flatMap((body) => body.diagnostics)
  ];

  return {
    ok: true,
    query: "project.exportReadiness",
    cadOpsVersion,
    status: chooseProjectStatus(bodyReadiness),
    canExportFiles:
      exactStepWriterStatus === "available" &&
      bodyReadiness.some((body) => body.sourceStatus === "supported"),
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
    diagnostics
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
  const readiness = createProjectExportReadiness({
    document,
    cadOpsVersion,
    bodies,
    exactStepWriterStatus
  });
  const bodyById = new Map(
    readiness.bodies.map((body) => [body.bodyId, body] as const)
  );
  const requestedBodyIds = query.bodyIds ?? [];
  const hasRequestedBodyFilter = requestedBodyIds.length > 0;
  const selectedBodies = !hasRequestedBodyFilter
    ? readiness.bodies
    : requestedBodyIds.flatMap((bodyId) => {
        const body = bodyById.get(bodyId);

        return body ? [body] : [];
      });
  const stepBodies = selectedBodies.map((body) => ({
    ...body,
    formats: body.formats.filter((format) => format.format === "step")
  }));
  const missingDiagnostics = requestedBodyIds
    .filter((bodyId) => !bodyById.has(bodyId))
    .map((bodyId) => createMissingExactBodyDiagnostic(bodyId));
  const unsupportedDiagnostics = stepBodies
    .filter((body) => body.sourceStatus !== "supported")
    .map((body) => createUnsupportedExactBodyDiagnostic(body));
  const blockingUnsupportedDiagnostics = hasRequestedBodyFilter
    ? unsupportedDiagnostics
    : [];
  const exportSources = stepBodies
    .filter((body) => body.sourceStatus === "supported")
    .map((body) => createExactExportBodySource(document, body))
    .filter(
      (source): source is CadExactExportBodySource => source !== undefined
    );
  const supportedStepBodies = stepBodies.filter(
    (body) => body.sourceStatus === "supported"
  );
  const sourceDiagnostics =
    exportSources.length === supportedStepBodies.length
      ? []
      : supportedStepBodies
          .filter(
            (body) =>
              !exportSources.some((source) => source.bodyId === body.bodyId)
          )
          .map((body) => createUnsupportedExactBodyDiagnostic(body));
  const sourceIdentityStatus = getSourceIdentityStatus(
    query.sourceIdentity,
    currentSourceIdentity
  );
  const sourceIdentityDiagnostics =
    sourceIdentityStatus === "mismatchedCurrent" && query.sourceIdentity
      ? [
          createSourceIdentityMismatchDiagnostic(
            query.sourceIdentity,
            currentSourceIdentity
          )
        ]
      : [];
  const writerUnavailableDiagnostics =
    exactStepWriterStatus === "unavailable"
      ? [createStepWriterUnavailableDiagnostic()]
      : [];
  const diagnostics = [
    ...writerUnavailableDiagnostics,
    ...sourceIdentityDiagnostics,
    ...missingDiagnostics,
    ...unsupportedDiagnostics,
    ...sourceDiagnostics,
    ...stepBodies.flatMap((body) => body.diagnostics)
  ];
  const exportableBodyCount =
    missingDiagnostics.length === 0 &&
    blockingUnsupportedDiagnostics.length === 0 &&
    sourceIdentityStatus !== "mismatchedCurrent" &&
    exactStepWriterStatus === "available"
      ? exportSources.length
      : 0;
  const status: CadExportReadinessStatus =
    exactStepWriterStatus === "unavailable" ||
    sourceIdentityStatus === "mismatchedCurrent"
      ? "unavailable"
      : exportableBodyCount > 0
        ? "supported"
        : stepBodies.every((body) => body.status === "unavailable")
          ? "unavailable"
          : "deferred";

  return {
    ok: true,
    query: "project.exportExact",
    cadOpsVersion,
    format: "step",
    label: "STEP",
    exportKind: "exact",
    status,
    available: exportableBodyCount > 0,
    canExportFile: exportableBodyCount > 0,
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
    exportSources:
      missingDiagnostics.length === 0 &&
      blockingUnsupportedDiagnostics.length === 0 &&
      sourceIdentityStatus !== "mismatchedCurrent" &&
      exactStepWriterStatus === "available"
        ? exportSources
        : [],
    bodies: stepBodies,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createFormatReadiness(
  units: ProjectExportReadinessQueryResponse["units"],
  format: ExportFormatDefinition,
  bodies: readonly CadExportBodyReadiness[],
  exactStepWriterStatus: CadExactExportWriterStatus
): CadExportFormatReadiness {
  const viableBodyCount = bodies.filter(
    (body) => body.status !== "unavailable"
  ).length;
  const sourceSupportedBodyCount = bodies.filter(
    (body) => body.sourceStatus === "supported"
  ).length;
  const stepAvailable =
    format.format === "step" &&
    exactStepWriterStatus === "available" &&
    sourceSupportedBodyCount > 0;
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
  body: CadBodySnapshot,
  exactStepWriterStatus: CadExactExportWriterStatus
): CadExportBodyReadiness {
  const source = classifyBodySource(document, body);
  const status = chooseBodyStatus(source.sourceStatus);
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

  if (format.format === "step" && source.sourceStatus === "supported") {
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
      status: "deferred",
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
  body: CadBodySnapshot
): BodySourceReadiness {
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
): BodySourceReadiness {
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
  if (bodies.every((body) => body.status === "unavailable")) {
    return "unavailable";
  }

  if (bodies.some((body) => body.status === "supported")) {
    return "supported";
  }

  return "deferred";
}

function chooseBodyStatus(
  sourceStatus: CadExportReadinessStatus
): CadExportReadinessStatus {
  if (sourceStatus === "unavailable") {
    return "unavailable";
  }

  return sourceStatus;
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
    case "sweepFeature":
    case "loftFeature":
      return "unresolvedSource";
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
    code: "EXPORT_BODY_SOURCE_UNRESOLVED",
    status: "unavailable",
    format: "step",
    bodyId,
    message: `Requested body ${bodyId} does not exist in the current authoritative project structure.`,
    expected: "current body id",
    received: "missing body id"
  };
}

function createExactExportBodySource(
  document: CadDocument,
  body: CadExportBodyReadiness
): CadExactExportBodySource | undefined {
  const feature = document.features.get(body.featureId);

  if (!feature || feature.kind !== "extrude") {
    return undefined;
  }

  if (feature.operationMode !== "newBody") {
    return undefined;
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

function isExactExportExtrudeEntity(
  entity: SketchEntity
): entity is Extract<SketchEntity, { readonly kind: "rectangle" | "circle" }> {
  return entity.kind === "rectangle" || entity.kind === "circle";
}

function createUnsupportedExactBodyDiagnostic(
  body: CadExportBodyReadiness
): CadExportDiagnostic {
  return {
    code: "EXPORT_EXACT_BODY_UNSUPPORTED",
    status: body.sourceStatus,
    format: "step",
    bodyId: body.bodyId,
    ...(body.bodyName ? { bodyName: body.bodyName } : {}),
    bodyKind: body.bodyKind,
    featureId: body.featureId,
    sourceKind: body.sourceKind,
    ...(body.objectId ? { objectId: body.objectId } : {}),
    ...(body.consumedByFeatureId
      ? { consumedByFeatureId: body.consumedByFeatureId }
      : {}),
    message: `Body ${body.bodyId} is not in the supported exact STEP source subset for this tranche.`,
    expected: "supported authored rectangle/circle newBody extrude",
    received: body.sourceKind
  };
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

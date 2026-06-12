import { WCAD_SOURCE_IDENTITY_ALGORITHM } from "@web-cad/cad-protocol";
import type {
  CadBodySnapshot,
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
  WcadDocumentSchemaVersion
} from "@web-cad/cad-protocol";
import type { CadDocument } from "./index";

interface ProjectExportReadinessInput {
  readonly document: CadDocument;
  readonly cadOpsVersion: CadOpsVersion;
  readonly bodies: readonly CadBodySnapshot[];
}

interface ProjectExactExportInput extends ProjectExportReadinessInput {
  readonly query: ProjectExactExportQuery;
  readonly documentSchemaVersion: WcadDocumentSchemaVersion;
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
      "STEP requires an exact body writer from authoritative CAD source; E1 reports readiness only.",
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
  bodies
}: ProjectExportReadinessInput): ProjectExportReadinessQueryResponse {
  const bodyReadiness = bodies.map((body) =>
    createBodyExportReadiness(document, body)
  );
  const formatReadiness = EXPORT_FORMATS.map((format) =>
    createFormatReadiness(document.units, format, bodyReadiness)
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
    canExportFiles: false,
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
  documentSchemaVersion
}: ProjectExactExportInput): ProjectExactExportQueryResponse {
  const readiness = createProjectExportReadiness({
    document,
    cadOpsVersion,
    bodies
  });
  const bodyById = new Map(
    readiness.bodies.map((body) => [body.bodyId, body] as const)
  );
  const requestedBodyIds = query.bodyIds ?? [];
  const selectedBodies =
    requestedBodyIds.length === 0
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
  const writerDiagnostic = createExactWriterUnavailableDiagnostic();
  const diagnostics = [
    writerDiagnostic,
    ...missingDiagnostics,
    ...unsupportedDiagnostics,
    ...stepBodies.flatMap((body) => body.diagnostics)
  ];

  return {
    ok: true,
    query: "project.exportExact",
    cadOpsVersion,
    format: "step",
    label: "STEP",
    exportKind: "exact",
    status: "unavailable",
    available: false,
    canExportFile: false,
    writerStatus: "unavailable",
    units: document.units,
    fileExtensions: [".step", ".stp"],
    documentSchemaVersion,
    sourceIdentityAlgorithm: WCAD_SOURCE_IDENTITY_ALGORITHM,
    ...(query.sourceIdentity
      ? { requestedSourceIdentity: query.sourceIdentity }
      : {}),
    sourceIdentityStatus: query.sourceIdentity
      ? "providedUnchecked"
      : "notProvided",
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
    exportableBodyCount: 0,
    bodies: stepBodies,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createFormatReadiness(
  units: ProjectExportReadinessQueryResponse["units"],
  format: ExportFormatDefinition,
  bodies: readonly CadExportBodyReadiness[]
): CadExportFormatReadiness {
  const viableBodyCount = bodies.filter(
    (body) => body.status !== "unavailable"
  ).length;
  const emptyDiagnostics =
    bodies.length === 0
      ? [
          createProjectEmptyDiagnostic(
            `${format.label} export has no candidate bodies.`
          )
        ]
      : [];
  const diagnostics = [createWriterDiagnostic(format), ...emptyDiagnostics];

  return {
    format: format.format,
    label: format.label,
    exportKind: format.exportKind,
    status: viableBodyCount === 0 ? "unavailable" : "deferred",
    available: false,
    writerStatus: "unavailable",
    fileExtensions: format.fileExtensions,
    units,
    sourceBoundaryNote: format.sourceBoundaryNote,
    derivedBoundaryNote: format.derivedBoundaryNote,
    candidateBodyCount: bodies.length,
    sourceSupportedBodyCount: bodies.filter(
      (body) => body.sourceStatus === "supported"
    ).length,
    deferredBodyCount: bodies.filter((body) => body.status === "deferred")
      .length,
    unavailableBodyCount: bodies.filter((body) => body.status === "unavailable")
      .length,
    diagnostics
  };
}

function createBodyExportReadiness(
  document: CadDocument,
  body: CadBodySnapshot
): CadExportBodyReadiness {
  const source = classifyBodySource(document, body);
  const status = chooseBodyStatus(source.sourceStatus);
  const formats = EXPORT_FORMATS.map((format) =>
    createBodyFormatReadiness(format, body, source)
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
  source: BodySourceReadiness
): CadExportBodyFormatReadiness {
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

    return {
      sourceKind,
      sourceStatus: "supported",
      diagnostics: [
        createBodyDiagnostic(
          "EXPORT_BODY_SOURCE_SUPPORTED",
          "supported",
          `Authored ${feature.profileKind} newBody extrude body ${body.id} has supported source semantics for future file export.`,
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
    body.source.type === "edgeFilletFeature"
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

  return "deferred";
}

function chooseBodyStatus(
  sourceStatus: CadExportReadinessStatus
): CadExportReadinessStatus {
  if (sourceStatus === "unavailable") {
    return "unavailable";
  }

  return "deferred";
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
  }
}

function createWriterDiagnostic(
  format: ExportFormatDefinition,
  body?: CadBodySnapshot,
  sourceKind?: CadExportBodySourceKind
): CadExportDiagnostic {
  if (format.exportKind === "exact") {
    return {
      code: "EXPORT_EXACT_WRITER_UNAVAILABLE",
      status: "unavailable",
      message:
        "STEP exact export writer is unavailable through the geometry boundary; this query reports readiness and blockers only.",
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
      received: "writer unavailable"
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

function createExactWriterUnavailableDiagnostic(): CadExportDiagnostic {
  return {
    code: "EXPORT_EXACT_WRITER_UNAVAILABLE",
    status: "unavailable",
    format: "step",
    message:
      "STEP exact export writer is unavailable through the geometry boundary; no STEP bytes were produced.",
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

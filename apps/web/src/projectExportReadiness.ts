import type {
  CadExportBodyReadiness,
  CadExportFormatReadiness,
  CadExportReadinessStatus,
  ProjectExportReadinessQueryResponse
} from "@web-cad/cad-protocol";

export interface ProjectExportReadinessDisplay {
  readonly statusLabel: string;
  readonly detail: string;
  readonly sourceDetail: string;
  readonly derivedDetail: string;
  readonly bodySummary: string;
  readonly formatRows: readonly ProjectExportReadinessRow[];
  readonly bodyRows: readonly ProjectExportReadinessRow[];
}

export interface ProjectExportReadinessRow {
  readonly id: string;
  readonly label: string;
  readonly status: CadExportReadinessStatus;
  readonly statusLabel: string;
  readonly detail: string;
  readonly limitation: string;
  readonly nextStep: string;
}

export interface ProjectVisualizationExportDisplayStatus {
  readonly status: CadExportReadinessStatus;
  readonly available: boolean;
  readonly detail: string;
  readonly limitation: string;
  readonly nextStep: string;
  readonly exportableBodyCount: number;
  readonly skippedBodyCount: number;
  readonly vertexCount: number;
  readonly triangleCount: number;
}

export function createProjectExportReadinessDisplay(
  readiness: ProjectExportReadinessQueryResponse,
  visualizationExport?: ProjectVisualizationExportDisplayStatus
): ProjectExportReadinessDisplay {
  return {
    statusLabel: getExportReadinessStatusLabel(
      chooseDisplayStatus(readiness.status, visualizationExport?.status)
    ),
    detail: visualizationExport?.available
      ? readiness.canExportFiles
        ? "STEP and Visualization GLB export are available for supported bodies."
        : "Visualization GLB export is available. STEP needs a supported source body."
      : readiness.canExportFiles
        ? "STEP export is available for supported bodies."
        : "STEP export needs a supported body. Visualization GLB needs ready display geometry.",
    sourceDetail:
      "Candidate bodies come from the current project contents and units.",
    derivedDetail: visualizationExport
      ? `Visualization GLB can use ${visualizationExport.exportableBodyCount} ready display mesh${visualizationExport.exportableBodyCount === 1 ? "" : "es"}.`
      : "Display output is not used for STEP export.",
    bodySummary: `${readiness.sourceSupportedBodyCount} source supported, ${readiness.deferredBodyCount} deferred, ${readiness.unavailableBodyCount} unavailable${
      visualizationExport
        ? `; ${visualizationExport.exportableBodyCount} visualization ready`
        : ""
    }`,
    formatRows: readiness.formats.map((format) =>
      createFormatRow(format, visualizationExport)
    ),
    bodyRows: readiness.bodies.map(createBodyRow)
  };
}

export function getExportReadinessStatusLabel(
  status: CadExportReadinessStatus
): string {
  switch (status) {
    case "supported":
      return "Supported";
    case "deferred":
      return "Deferred";
    case "unavailable":
      return "Unavailable";
  }
}

function createFormatRow(
  format: CadExportFormatReadiness,
  visualizationExport: ProjectVisualizationExportDisplayStatus | undefined
): ProjectExportReadinessRow {
  if (format.format === "glb" && visualizationExport) {
    return {
      id: format.format,
      label: format.label,
      status: visualizationExport.status,
      statusLabel: getExportReadinessStatusLabel(visualizationExport.status),
      detail: visualizationExport.available
        ? `${format.label} export is available for ${visualizationExport.exportableBodyCount} ready visualization body${visualizationExport.exportableBodyCount === 1 ? "" : "ies"}.`
        : visualizationExport.detail,
      limitation: visualizationExport.available
        ? `${visualizationExport.vertexCount} vertices and ${visualizationExport.triangleCount} triangles will be written as display output.${
            visualizationExport.skippedBodyCount > 0
              ? ` ${visualizationExport.skippedBodyCount} body${visualizationExport.skippedBodyCount === 1 ? "" : "ies"} skipped: ${visualizationExport.limitation}`
              : ""
          }`
        : visualizationExport.limitation,
      nextStep: visualizationExport.nextStep
    };
  }

  const writerDiagnostic = format.diagnostics.find(
    (diagnostic) =>
      diagnostic.code === "EXPORT_EXACT_WRITER_UNAVAILABLE" ||
      diagnostic.code === "EXPORT_WRITER_NOT_IMPLEMENTED"
  );
  const emptyDiagnostic = format.diagnostics.find(
    (diagnostic) => diagnostic.code === "EXPORT_PROJECT_EMPTY"
  );

  return {
    id: format.format,
    label: format.label,
    status: format.status,
    statusLabel: getExportReadinessStatusLabel(format.status),
    detail: format.available
      ? `${format.label} export is available for current source bodies.`
      : format.exportKind === "exact"
        ? `${format.label} exact export needs at least one supported source body.`
        : `${format.label} export files are not available yet.`,
    limitation:
      emptyDiagnostic?.message ??
      writerDiagnostic?.message ??
      "No format-specific blocker reported.",
    nextStep:
      format.status === "unavailable"
        ? "Create an authored body before exporting."
        : format.exportKind === "exact"
          ? "Use the STEP download action from Project/File."
          : "Implement the file writer before enabling downloads."
  };
}

function chooseDisplayStatus(
  sourceStatus: CadExportReadinessStatus,
  visualizationStatus: CadExportReadinessStatus | undefined
): CadExportReadinessStatus {
  if (visualizationStatus === "supported") {
    return "supported";
  }

  return sourceStatus;
}

function createBodyRow(
  body: CadExportBodyReadiness
): ProjectExportReadinessRow {
  const primaryDiagnostic =
    body.diagnostics.find((diagnostic) => diagnostic.status !== "supported") ??
    body.diagnostics[0];
  const label = body.bodyName
    ? `${body.bodyName} (${body.bodyId})`
    : body.bodyId;

  return {
    id: body.bodyId,
    label,
    status: body.status,
    statusLabel: getExportReadinessStatusLabel(body.status),
    detail:
      body.sourceStatus === "supported"
        ? "Source body is supported for exact STEP export."
        : getBodySourceDetail(body),
    limitation:
      primaryDiagnostic?.message ?? "No body-specific blocker reported.",
    nextStep:
      body.status === "unavailable"
        ? "Use an active authored body with supported source semantics."
        : "Use a supported active authored body for exact export."
  };
}

function getBodySourceDetail(body: CadExportBodyReadiness): string {
  switch (body.sourceKind) {
    case "authoredExtrude":
      return body.consumedByFeatureId
        ? "Authored extrude source is consumed by a later feature."
        : "Authored extrude source is waiting on export support.";
    case "authoredRevolve":
      return "Revolve result-body export readiness is deferred.";
    case "authoredHole":
      return "Hole result-body export readiness is deferred.";
    case "authoredChamfer":
      return "Chamfer result-body export readiness is deferred.";
    case "authoredFillet":
      return "Fillet result-body export readiness is deferred.";
    case "primitiveCompatibility":
      return "Primitive object source is not treated as an authored CAD export body.";
    case "unresolvedSource":
      return "Body source can no longer be resolved for export readiness.";
  }
}

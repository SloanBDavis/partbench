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
      ? `Visualization GLB can use ${visualizationExport.exportableBodyCount} ${visualizationExport.exportableBodyCount === 1 ? "body with" : "bodies with"} ready display geometry.`
      : "Display output is not used for STEP export.",
    bodySummary: `${readiness.sourceSupportedBodyCount} ready for STEP, ${readiness.deferredBodyCount} not ready yet, ${readiness.unavailableBodyCount} unavailable${
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
      return "Not ready yet";
    case "unavailable":
      return "Unavailable";
  }
}

function createFormatRow(
  format: CadExportFormatReadiness,
  visualizationExport: ProjectVisualizationExportDisplayStatus | undefined
): ProjectExportReadinessRow {
  const label = formatExportFormatLabel(format);

  if (format.format === "glb" && visualizationExport) {
    return {
      id: format.format,
      label,
      status: visualizationExport.status,
      statusLabel: getExportReadinessStatusLabel(visualizationExport.status),
      detail: visualizationExport.available
        ? `${label} export is available for ${formatVisualizationBodyCount(visualizationExport.exportableBodyCount)}.`
        : visualizationExport.detail,
      limitation: visualizationExport.available
        ? `${visualizationExport.vertexCount} vertices and ${visualizationExport.triangleCount} triangles will be written as display output.${
            visualizationExport.skippedBodyCount > 0
              ? ` ${formatBodyCount(visualizationExport.skippedBodyCount)} skipped: ${visualizationExport.limitation}`
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
    label,
    status: format.status,
    statusLabel: getExportReadinessStatusLabel(format.status),
    detail: format.available
      ? `${label} export is available for current source bodies.`
      : format.exportKind === "exact"
        ? `${label} exact export needs at least one supported source body.`
        : `${label} export files are not available yet.`,
    limitation:
      emptyDiagnostic?.message ??
      formatExportFormatMessage(writerDiagnostic?.message) ??
      "No format-specific blocker reported.",
    nextStep:
      format.status === "unavailable"
        ? "Create an authored body before exporting."
        : format.exportKind === "exact"
          ? "Use the STEP download action from Project/File."
          : "Implement the file writer before enabling downloads."
  };
}

function formatExportFormatLabel(format: CadExportFormatReadiness): string {
  return format.format === "glb" ? "Visualization GLB" : format.label;
}

function formatExportFormatMessage(
  message: string | undefined
): string | undefined {
  return message?.replace(/\bMesh\/GLB visualization\b/g, "Visualization GLB");
}

function formatBodyCount(count: number): string {
  return `${count} ${count === 1 ? "body" : "bodies"}`;
}

function formatVisualizationBodyCount(count: number): string {
  return `${count} ready visualization ${count === 1 ? "body" : "bodies"}`;
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
        ? "Body is ready for exact STEP export."
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
      return "Revolve bodies are not ready for STEP export yet.";
    case "authoredHole":
      return "Hole bodies are not ready for STEP export yet.";
    case "authoredChamfer":
      return "Chamfer bodies are not ready for STEP export yet.";
    case "authoredFillet":
      return "Fillet bodies are not ready for STEP export yet.";
    case "authoredShell":
      return "Shell bodies are not ready for STEP export yet.";
    case "importedBody":
      return "Imported STEP bodies need checkpoint-backed export support.";
    case "primitiveCompatibility":
      return "Primitive object source is not treated as an authored CAD export body.";
    case "unresolvedSource":
      return "Body source can no longer be resolved for export readiness.";
  }
}

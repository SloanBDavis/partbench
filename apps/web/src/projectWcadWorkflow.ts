import type {
  WcadPackageExportResult,
  WcadPackageReadResult
} from "@web-cad/cad-core";
import {
  WCAD_PACKAGE_EXTENSION,
  type WcadDocumentSchemaVersion,
  type WcadPackageValidationIssue,
  type WcadPackageVersion,
  type WcadSourceIdentity
} from "@web-cad/cad-protocol";

export const DEFAULT_WCAD_PROJECT_FILE_NAME = "partbench-project.wcad";
export const WCAD_MIME_TYPE = "application/vnd.partbench.wcad";

export type ProjectFileStorageMode =
  | "unsaved"
  | "wcadHandle"
  | "uploadedFallback"
  | "downloadedFallback"
  | "jsonFallback";

export type ProjectFileOperation =
  | "open"
  | "save"
  | "saveAs"
  | "download"
  | "jsonImport";

export type ProjectFileOperationStatus =
  | "idle"
  | "opened"
  | "saved"
  | "downloaded"
  | "importedJson"
  | "failed"
  | "cancelled";

export interface ProjectFileOperationResult {
  readonly operation: ProjectFileOperation;
  readonly status: ProjectFileOperationStatus;
  readonly message: string;
  readonly detail?: string;
}

export interface ProjectFileWorkflowState {
  readonly mode: ProjectFileStorageMode;
  readonly fileName?: string;
  readonly dirty: boolean;
  readonly packageVersion?: WcadPackageVersion;
  readonly documentSchemaVersion?: WcadDocumentSchemaVersion;
  readonly sourceIdentity?: WcadSourceIdentity;
  readonly lastResult?: ProjectFileOperationResult;
  readonly diagnostics: readonly WcadPackageValidationIssue[];
}

export interface WcadWritableFileStreamLike {
  write(data: Uint8Array): Promise<void> | void;
  close(): Promise<void> | void;
  abort?: () => Promise<void> | void;
}

export interface WcadFileHandleLike {
  readonly name?: string;
  getFile(): Promise<WcadFileLike>;
  createWritable(): Promise<WcadWritableFileStreamLike>;
}

export interface WcadFileLike {
  readonly name?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface WcadFilePickerTargetLike {
  showOpenFilePicker?: (
    options: WcadOpenFilePickerOptionsLike
  ) => Promise<readonly WcadFileHandleLike[]>;
  showSaveFilePicker?: (
    options: WcadSaveFilePickerOptionsLike
  ) => Promise<WcadFileHandleLike>;
}

export interface WcadOpenFilePickerOptionsLike {
  readonly multiple: false;
  readonly types: readonly WcadFilePickerAcceptTypeLike[];
  readonly excludeAcceptAllOption?: boolean;
}

export interface WcadSaveFilePickerOptionsLike {
  readonly suggestedName: string;
  readonly types: readonly WcadFilePickerAcceptTypeLike[];
  readonly excludeAcceptAllOption?: boolean;
}

export interface WcadFilePickerAcceptTypeLike {
  readonly description: string;
  readonly accept: Record<string, readonly string[]>;
}

export function createInitialProjectFileWorkflowState(): ProjectFileWorkflowState {
  return {
    mode: "unsaved",
    dirty: false,
    diagnostics: [],
    lastResult: {
      operation: "saveAs",
      status: "idle",
      message: "No project file has been saved yet."
    }
  };
}

export function markProjectFileDirty(
  state: ProjectFileWorkflowState
): ProjectFileWorkflowState {
  if (state.dirty) {
    return state;
  }

  return { ...state, dirty: true };
}

export function createProjectFileStateFromExport(
  exported: WcadPackageExportResult,
  input: {
    readonly mode: Extract<
      ProjectFileStorageMode,
      "wcadHandle" | "downloadedFallback"
    >;
    readonly fileName?: string;
    readonly operation: Extract<ProjectFileOperation, "save" | "saveAs">;
  }
): ProjectFileWorkflowState {
  return {
    mode: input.mode,
    fileName: input.fileName,
    dirty: false,
    packageVersion: exported.manifest.packageVersion,
    documentSchemaVersion: exported.manifest.document.schemaVersion,
    sourceIdentity: exported.sourceIdentity,
    diagnostics: [],
    lastResult: {
      operation: input.operation,
      status: input.mode === "downloadedFallback" ? "downloaded" : "saved",
      message:
        input.mode === "downloadedFallback"
          ? "Downloaded .wcad package."
          : "Saved .wcad package.",
      detail: formatSourceIdentityDetail(exported.sourceIdentity)
    }
  };
}

export function createProjectFileStateFromRead(
  result: WcadPackageReadResult,
  input: {
    readonly current: ProjectFileWorkflowState;
    readonly mode: Extract<
      ProjectFileStorageMode,
      "wcadHandle" | "uploadedFallback"
    >;
    readonly fileName?: string;
  }
): ProjectFileWorkflowState {
  if (!result.ok) {
    return createProjectFileFailureState(input.current, {
      operation: "open",
      fileName: input.fileName,
      diagnostics: result.issues,
      message: "Could not open .wcad package."
    });
  }

  return {
    mode: input.mode,
    fileName: input.fileName,
    dirty: false,
    packageVersion: result.manifest.packageVersion,
    documentSchemaVersion: result.manifest.document.schemaVersion,
    sourceIdentity: result.sourceIdentity,
    diagnostics: result.diagnostics,
    lastResult: {
      operation: "open",
      status: "opened",
      message: "Opened .wcad package.",
      detail: formatSourceIdentityDetail(result.sourceIdentity)
    }
  };
}

export function createJsonFallbackProjectFileState(
  fileName: string | undefined
): ProjectFileWorkflowState {
  return {
    mode: "jsonFallback",
    fileName,
    dirty: false,
    diagnostics: [],
    lastResult: {
      operation: "jsonImport",
      status: "importedJson",
      message: "Imported project JSON.",
      detail: "JSON remains an interchange/debug workflow."
    }
  };
}

export function createProjectFileFailureState(
  current: ProjectFileWorkflowState,
  input: {
    readonly operation: ProjectFileOperation;
    readonly fileName?: string;
    readonly diagnostics?: readonly WcadPackageValidationIssue[];
    readonly message: string;
    readonly detail?: string;
  }
): ProjectFileWorkflowState {
  return {
    ...current,
    fileName: input.fileName ?? current.fileName,
    diagnostics: input.diagnostics ?? [],
    lastResult: {
      operation: input.operation,
      status: "failed",
      message: input.message,
      detail:
        input.detail ??
        summarizeWcadDiagnostics(input.diagnostics ?? [], "No diagnostics.")
    }
  };
}

export function createProjectFileCancelledState(
  current: ProjectFileWorkflowState,
  operation: Extract<ProjectFileOperation, "open" | "saveAs">
): ProjectFileWorkflowState {
  return {
    ...current,
    lastResult: {
      operation,
      status: "cancelled",
      message:
        operation === "open"
          ? "Open .wcad was cancelled."
          : "Save As .wcad was cancelled."
    }
  };
}

export function getProjectFileStorageModeLabel(
  mode: ProjectFileStorageMode
): string {
  switch (mode) {
    case "unsaved":
      return "Unsaved";
    case "wcadHandle":
      return ".wcad file";
    case "uploadedFallback":
      return "Uploaded .wcad";
    case "downloadedFallback":
      return "Downloaded .wcad";
    case "jsonFallback":
      return "JSON fallback";
  }
}

export function getProjectFileDirtyLabel(
  state: ProjectFileWorkflowState
): string {
  if (state.mode === "unsaved") {
    return "Not saved";
  }

  if (state.dirty) {
    return "Unsaved changes";
  }

  if (state.mode === "jsonFallback") {
    return "JSON imported";
  }

  return "Saved";
}

export function getProjectFileDirectSaveLabel(
  state: ProjectFileWorkflowState,
  fileSystemAccessAvailable: boolean
): string {
  if (state.mode === "wcadHandle") {
    return fileSystemAccessAvailable ? "Available" : "Handle unavailable";
  }

  return fileSystemAccessAvailable ? "Save As required" : "Download fallback";
}

export function getProjectFileNameLabel(
  state: ProjectFileWorkflowState
): string {
  if (
    state.fileName &&
    (state.mode === "wcadHandle" ||
      state.mode === "uploadedFallback" ||
      state.mode === "downloadedFallback")
  ) {
    return state.fileName;
  }

  return "Untitled project";
}

export function createWcadFilePickerAcceptTypes(): readonly WcadFilePickerAcceptTypeLike[] {
  return [
    {
      description: "Partbench WCAD package",
      accept: {
        [WCAD_MIME_TYPE]: [WCAD_PACKAGE_EXTENSION],
        "application/zip": [WCAD_PACKAGE_EXTENSION]
      }
    }
  ];
}

export async function pickWcadOpenFile(
  target: WcadFilePickerTargetLike
): Promise<WcadFileHandleLike> {
  if (typeof target.showOpenFilePicker !== "function") {
    throw new Error("File System Access open picker is unavailable.");
  }

  const handles = await target.showOpenFilePicker({
    multiple: false,
    types: createWcadFilePickerAcceptTypes(),
    excludeAcceptAllOption: false
  });
  const handle = handles[0];

  if (!handle) {
    throw new Error("No .wcad file was selected.");
  }

  return handle;
}

export async function pickWcadSaveFile(
  target: WcadFilePickerTargetLike,
  suggestedName = DEFAULT_WCAD_PROJECT_FILE_NAME
): Promise<WcadFileHandleLike> {
  if (typeof target.showSaveFilePicker !== "function") {
    throw new Error("File System Access save picker is unavailable.");
  }

  return target.showSaveFilePicker({
    suggestedName: ensureWcadFileExtension(suggestedName),
    types: createWcadFilePickerAcceptTypes(),
    excludeAcceptAllOption: false
  });
}

export async function readBytesFromWcadFile(
  file: WcadFileLike
): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

export async function writeBytesToWcadHandle(
  handle: WcadFileHandleLike,
  bytes: Uint8Array
): Promise<void> {
  const writable = await handle.createWritable();

  try {
    await writable.write(bytes);
    await writable.close();
  } catch (error) {
    await abortWritableQuietly(writable);
    throw error;
  }
}

async function abortWritableQuietly(
  writable: WcadWritableFileStreamLike
): Promise<void> {
  try {
    await writable.abort?.();
  } catch {
    // Preserve the original write or close failure.
  }
}

export function ensureWcadFileExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const base = trimmed.length > 0 ? trimmed : DEFAULT_WCAD_PROJECT_FILE_NAME;

  return base.toLowerCase().endsWith(WCAD_PACKAGE_EXTENSION)
    ? base
    : `${base}${WCAD_PACKAGE_EXTENSION}`;
}

export function isFilePickerAbort(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { readonly name?: unknown }).name === "AbortError"
  );
}

export function formatWcadValidationIssue(
  issue: WcadPackageValidationIssue
): string {
  return [
    issue.code,
    issue.entryPath ? `entry ${issue.entryPath}` : undefined,
    issue.path ? `at ${issue.path}` : undefined,
    issue.message
  ]
    .filter(Boolean)
    .join(" - ");
}

export function summarizeWcadDiagnostics(
  issues: readonly WcadPackageValidationIssue[],
  emptyMessage = "No package diagnostics."
): string {
  if (issues.length === 0) {
    return emptyMessage;
  }

  const errorCount = issues.filter(
    (issue) => issue.severity === "error"
  ).length;
  const warningCount = issues.length - errorCount;
  const parts = [
    errorCount > 0
      ? `${errorCount} package ${errorCount === 1 ? "error" : "errors"}`
      : undefined,
    warningCount > 0
      ? `${warningCount} package ${warningCount === 1 ? "warning" : "warnings"}`
      : undefined
  ].filter(Boolean);

  return parts.join(", ");
}

export function formatSourceIdentityDetail(
  sourceIdentity: WcadSourceIdentity
): string {
  return `${sourceIdentity.algorithm}:${sourceIdentity.sha256.slice(0, 12)}`;
}

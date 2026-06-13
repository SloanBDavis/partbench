export type ProjectStorageMode =
  | "jsonImportExport"
  | "fileSystemAccess"
  | "opfs"
  | "wcadPackage";

export type ProjectStorageAvailability =
  | "active"
  | "available"
  | "unavailable"
  | "deferred";

export interface ProjectStorageCapabilityEntry {
  readonly mode: ProjectStorageMode;
  readonly availability: ProjectStorageAvailability;
  readonly available: boolean;
  readonly label: string;
  readonly detail: string;
  readonly limitation: string;
  readonly nextStep: string;
}

export interface ProjectStorageCapabilityStatus {
  readonly activeMode: ProjectStorageMode;
  readonly jsonDownloadAvailable: boolean;
  readonly jsonUploadAvailable: boolean;
  readonly jsonFallbackAvailable: boolean;
  readonly wcadDownloadAvailable: boolean;
  readonly wcadUploadAvailable: boolean;
  readonly wcadFallbackAvailable: boolean;
  readonly fileSystemAccessAvailable: boolean;
  readonly opfsApiDetected: boolean;
  readonly entries: readonly ProjectStorageCapabilityEntry[];
  readonly jsonImportExport: ProjectStorageCapabilityEntry;
  readonly fileSystemAccess: ProjectStorageCapabilityEntry;
  readonly opfs: ProjectStorageCapabilityEntry;
  readonly wcadPackage: ProjectStorageCapabilityEntry;
}

export interface ProjectStorageCapabilityTarget {
  readonly Blob?: unknown;
  readonly File?: unknown;
  readonly URL?: {
    readonly createObjectURL?: unknown;
    readonly revokeObjectURL?: unknown;
  };
  readonly document?: {
    readonly createElement?: unknown;
  };
  readonly navigator?: {
    readonly storage?: {
      readonly getDirectory?: unknown;
    };
  };
  readonly showOpenFilePicker?: unknown;
  readonly showSaveFilePicker?: unknown;
}

export function createProjectStorageCapabilityStatus(
  target: ProjectStorageCapabilityTarget = {}
): ProjectStorageCapabilityStatus {
  const jsonDownloadAvailable =
    typeof target.Blob === "function" &&
    typeof target.URL?.createObjectURL === "function" &&
    typeof target.URL?.revokeObjectURL === "function" &&
    typeof target.document?.createElement === "function";
  const jsonUploadAvailable = hasFileText(target.File);
  const jsonFallbackAvailable = jsonDownloadAvailable && jsonUploadAvailable;
  const wcadDownloadAvailable = jsonDownloadAvailable;
  const wcadUploadAvailable = jsonUploadAvailable;
  const wcadFallbackAvailable = wcadDownloadAvailable && wcadUploadAvailable;
  const fileSystemAccessAvailable =
    typeof target.showOpenFilePicker === "function" &&
    typeof target.showSaveFilePicker === "function";
  const opfsApiDetected =
    typeof target.navigator?.storage?.getDirectory === "function";

  const jsonImportExport: ProjectStorageCapabilityEntry = {
    mode: "jsonImportExport",
    availability: jsonFallbackAvailable ? "available" : "unavailable",
    available: jsonFallbackAvailable,
    label: "JSON import/export",
    detail: jsonFallbackAvailable
      ? "JSON download and file load are available for interchange/debug."
      : "JSON import/export is missing download or upload primitives in this runtime.",
    limitation: jsonFallbackAvailable
      ? "JSON remains an interchange/debug workflow, not the primary project-file workflow."
      : "Download and load controls should remain disabled until browser file primitives are available.",
    nextStep: jsonFallbackAvailable
      ? "Use explicit Export JSON and Import JSON controls when text interchange is needed."
      : "Use a browser with Blob URL download and File.text upload support."
  };

  const fileSystemAccess: ProjectStorageCapabilityEntry = {
    mode: "fileSystemAccess",
    availability: fileSystemAccessAvailable ? "available" : "unavailable",
    available: fileSystemAccessAvailable,
    label: "Direct open/save",
    detail: fileSystemAccessAvailable
      ? "This browser can open and save .wcad project files directly."
      : "This browser does not expose direct open/save file pickers.",
    limitation: fileSystemAccessAvailable
      ? "Permission stays in this browser session and is never written into the project file."
      : "The app will fall back to .wcad upload/download without retaining a file handle.",
    nextStep: fileSystemAccessAvailable
      ? "Use Open .wcad, Save, and Save As from the Project/File panel."
      : "Use Open .wcad upload and Save As .wcad download fallback."
  };

  const opfs: ProjectStorageCapabilityEntry = {
    mode: "opfs",
    availability: opfsApiDetected ? "available" : "unavailable",
    available: opfsApiDetected,
    label: "Local mesh cache",
    detail: opfsApiDetected
      ? "Browser-private rebuildable cache status and clear are available."
      : "This browser does not expose local cache storage.",
    limitation:
      "No project source, recovery store, thumbnail, export artifact, or package source is stored in OPFS.",
    nextStep:
      "Use Project/File cache status and Clear cache; supported mesh artifacts are rebuildable."
  };

  const wcadPackage: ProjectStorageCapabilityEntry = {
    mode: "wcadPackage",
    availability:
      fileSystemAccessAvailable || wcadFallbackAvailable
        ? "active"
        : "unavailable",
    available: fileSystemAccessAvailable || wcadFallbackAvailable,
    label: ".wcad project file",
    detail:
      fileSystemAccessAvailable || wcadFallbackAvailable
        ? "Partbench can open and save supported projects as .wcad files."
        : "This runtime is missing both direct file handles and upload/download fallback primitives.",
    limitation:
      "Thumbnails, package-unpack cache, persisted STEP artifacts, and file-handle persistence remain out of scope.",
    nextStep: fileSystemAccessAvailable
      ? "Use direct .wcad file handles for open/save/save-as."
      : wcadFallbackAvailable
        ? "Use upload for Open .wcad and download for Save As .wcad."
        : "Use a browser with File System Access or Blob/File fallback support."
  };

  return {
    activeMode: wcadPackage.available ? "wcadPackage" : "jsonImportExport",
    jsonDownloadAvailable,
    jsonUploadAvailable,
    jsonFallbackAvailable,
    wcadDownloadAvailable,
    wcadUploadAvailable,
    wcadFallbackAvailable,
    fileSystemAccessAvailable,
    opfsApiDetected,
    entries: [wcadPackage, fileSystemAccess, jsonImportExport, opfs],
    jsonImportExport,
    fileSystemAccess,
    opfs,
    wcadPackage
  };
}

export function getProjectStorageAvailabilityLabel(
  availability: ProjectStorageAvailability
): string {
  switch (availability) {
    case "active":
      return "Active";
    case "available":
      return "Available";
    case "deferred":
      return "Deferred";
    case "unavailable":
      return "Unavailable";
  }
}

function hasFileText(fileConstructor: unknown): boolean {
  if (typeof fileConstructor !== "function") {
    return false;
  }

  const prototype = (fileConstructor as { readonly prototype?: unknown })
    .prototype;

  return (
    typeof prototype === "object" &&
    prototype !== null &&
    typeof (prototype as { readonly text?: unknown }).text === "function"
  );
}

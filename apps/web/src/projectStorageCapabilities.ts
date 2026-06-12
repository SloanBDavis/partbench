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
      ? "Browser download and file-input load are available for web-cad.project.v16 JSON."
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
    label: "Direct browser file handles",
    detail: fileSystemAccessAvailable
      ? "showOpenFilePicker and showSaveFilePicker are present for direct .wcad open/save/save-as."
      : "This browser/runtime does not expose both direct file picker APIs.",
    limitation: fileSystemAccessAvailable
      ? "File handles stay in app-only browser state and are never written into project source."
      : "The app will fall back to .wcad upload/download without retaining a file handle.",
    nextStep: fileSystemAccessAvailable
      ? "Use Open .wcad, Save, and Save As from the Project/File panel."
      : "Use Open .wcad upload and Save As .wcad download fallback."
  };

  const opfs: ProjectStorageCapabilityEntry = {
    mode: "opfs",
    availability: opfsApiDetected ? "available" : "unavailable",
    available: opfsApiDetected,
    label: "OPFS browser cache",
    detail: opfsApiDetected
      ? "OPFS API is detected for browser-private rebuildable cache status and clear."
      : "This browser/runtime does not expose navigator.storage.getDirectory.",
    limitation:
      "No project source, recovery store, thumbnail, mesh artifact, or package source is stored in OPFS.",
    nextStep:
      "Use Project/File cache status and Clear cache; future tranches can populate rebuildable artifacts."
  };

  const wcadPackage: ProjectStorageCapabilityEntry = {
    mode: "wcadPackage",
    availability:
      fileSystemAccessAvailable || wcadFallbackAvailable
        ? "active"
        : "unavailable",
    available: fileSystemAccessAvailable || wcadFallbackAvailable,
    label: "Native .wcad package",
    detail:
      fileSystemAccessAvailable || wcadFallbackAvailable
        ? "Partbench can write and read partbench.wcad.v1 packages for supported projects."
        : "This runtime is missing both direct file handles and upload/download fallback primitives.",
    limitation:
      "OPFS artifact population, thumbnails, mesh caches, STEP export, and file-handle persistence remain out of scope.",
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

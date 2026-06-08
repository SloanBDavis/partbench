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
  const fileSystemAccessAvailable =
    typeof target.showOpenFilePicker === "function" &&
    typeof target.showSaveFilePicker === "function";
  const opfsApiDetected =
    typeof target.navigator?.storage?.getDirectory === "function";

  const jsonImportExport: ProjectStorageCapabilityEntry = {
    mode: "jsonImportExport",
    availability: jsonFallbackAvailable ? "active" : "unavailable",
    available: jsonFallbackAvailable,
    label: "JSON import/export",
    detail: jsonFallbackAvailable
      ? "Active mode: browser download and file-input load for web-cad.project.v16 JSON."
      : "Active mode is JSON import/export, but this runtime is missing download or upload primitives.",
    limitation: jsonFallbackAvailable
      ? "This is an interchange workflow, not direct file-handle save/open."
      : "Download and load controls should remain disabled until browser file primitives are available.",
    nextStep: jsonFallbackAvailable
      ? "Use Generate export, Download project, Load file, and Import project."
      : "Use a browser with Blob URL download and File.text upload support."
  };

  const fileSystemAccess: ProjectStorageCapabilityEntry = {
    mode: "fileSystemAccess",
    availability: fileSystemAccessAvailable ? "available" : "unavailable",
    available: fileSystemAccessAvailable,
    label: "Direct browser file handles",
    detail: fileSystemAccessAvailable
      ? "showOpenFilePicker and showSaveFilePicker are present."
      : "This browser/runtime does not expose both direct file picker APIs.",
    limitation:
      "D2 only reports this capability; it does not call picker APIs or request permissions.",
    nextStep:
      "A later storage tranche can wire direct open/save/save-as after the permission flow is scoped."
  };

  const opfs: ProjectStorageCapabilityEntry = {
    mode: "opfs",
    availability: "deferred",
    available: false,
    label: "OPFS browser cache",
    detail: opfsApiDetected
      ? "OPFS API was detected, but Partbench does not use OPFS in this tranche."
      : "OPFS is intentionally not used in this tranche.",
    limitation:
      "No recovery store, thumbnail store, mesh cache, or package cache is written.",
    nextStep:
      "A future storage tranche must define source/cache separation before enabling OPFS."
  };

  const wcadPackage: ProjectStorageCapabilityEntry = {
    mode: "wcadPackage",
    availability: "deferred",
    available: false,
    label: "Native .wcad package",
    detail:
      "Native package read/write is intentionally deferred in this tranche.",
    limitation:
      "No manifest, document.cbor, commands.cbor, thumbnails, or cache artifacts are created.",
    nextStep:
      "Introduce package storage only with format tests, migrations, and source/cache separation checks."
  };

  return {
    activeMode: "jsonImportExport",
    jsonDownloadAvailable,
    jsonUploadAvailable,
    jsonFallbackAvailable,
    fileSystemAccessAvailable,
    opfsApiDetected,
    entries: [jsonImportExport, fileSystemAccess, opfs, wcadPackage],
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

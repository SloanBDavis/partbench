import { CadEngine, exportCadProjectJson } from "@web-cad/cad-core";
import { describe, expect, it, vi } from "vitest";
import { createProjectStorageCapabilityStatus } from "./projectStorageCapabilities";

describe("project storage capability helpers", () => {
  it("reports the JSON download/upload fallback as the active default mode", () => {
    const status = createProjectStorageCapabilityStatus(
      createJsonFallbackTarget()
    );

    expect(status.activeMode).toBe("jsonImportExport");
    expect(status.jsonDownloadAvailable).toBe(true);
    expect(status.jsonUploadAvailable).toBe(true);
    expect(status.jsonFallbackAvailable).toBe(true);
    expect(status.jsonImportExport).toMatchObject({
      mode: "jsonImportExport",
      availability: "active",
      available: true,
      label: "JSON import/export"
    });
    expect(status.fileSystemAccess.availability).toBe("unavailable");
  });

  it("reports File System Access as available when both picker APIs are present", () => {
    const status = createProjectStorageCapabilityStatus({
      ...createJsonFallbackTarget(),
      showOpenFilePicker: () => undefined,
      showSaveFilePicker: () => undefined
    });

    expect(status.fileSystemAccessAvailable).toBe(true);
    expect(status.fileSystemAccess).toMatchObject({
      mode: "fileSystemAccess",
      availability: "available",
      available: true
    });
    expect(status.fileSystemAccess.limitation).toContain(
      "does not call picker APIs"
    );
  });

  it("reports File System Access as unavailable unless both picker APIs are present", () => {
    const status = createProjectStorageCapabilityStatus({
      ...createJsonFallbackTarget(),
      showOpenFilePicker: () => undefined
    });

    expect(status.fileSystemAccessAvailable).toBe(false);
    expect(status.fileSystemAccess).toMatchObject({
      mode: "fileSystemAccess",
      availability: "unavailable",
      available: false
    });
  });

  it("keeps OPFS deferred even when the browser API is detected", () => {
    const status = createProjectStorageCapabilityStatus({
      ...createJsonFallbackTarget(),
      navigator: {
        storage: {
          getDirectory: () => undefined
        }
      }
    });

    expect(status.opfsApiDetected).toBe(true);
    expect(status.opfs).toMatchObject({
      mode: "opfs",
      availability: "deferred",
      available: false
    });
    expect(status.opfs.detail).toContain("OPFS API was detected");
    expect(status.opfs.limitation).toContain("No recovery store");
  });

  it("keeps native .wcad packages deferred", () => {
    const status = createProjectStorageCapabilityStatus(
      createJsonFallbackTarget()
    );

    expect(status.wcadPackage).toMatchObject({
      mode: "wcadPackage",
      availability: "deferred",
      available: false,
      label: "Native .wcad package"
    });
    expect(status.wcadPackage.detail).toContain("intentionally deferred");
  });

  it("does not invoke browser APIs while evaluating capabilities", () => {
    const createObjectURL = vi.fn();
    const revokeObjectURL = vi.fn();
    const createElement = vi.fn();
    const openPicker = vi.fn();
    const savePicker = vi.fn();
    const getDirectory = vi.fn();
    const fileText = vi.fn();
    const BlobConstructor = vi.fn();
    const FileConstructor = vi.fn();
    FileConstructor.prototype.text = fileText;

    const status = createProjectStorageCapabilityStatus({
      Blob: BlobConstructor,
      File: FileConstructor,
      URL: { createObjectURL, revokeObjectURL },
      document: { createElement },
      navigator: { storage: { getDirectory } },
      showOpenFilePicker: openPicker,
      showSaveFilePicker: savePicker
    });

    expect(status.jsonFallbackAvailable).toBe(true);
    expect(status.fileSystemAccessAvailable).toBe(true);
    expect(status.opfsApiDetected).toBe(true);
    expect(BlobConstructor).not.toHaveBeenCalled();
    expect(FileConstructor).not.toHaveBeenCalled();
    expect(fileText).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(createElement).not.toHaveBeenCalled();
    expect(openPicker).not.toHaveBeenCalled();
    expect(savePicker).not.toHaveBeenCalled();
    expect(getDirectory).not.toHaveBeenCalled();
  });

  it("keeps capability state out of exported project JSON", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    const beforeJson = exportCadProjectJson(engine);
    const status = createProjectStorageCapabilityStatus({
      ...createJsonFallbackTarget(),
      showOpenFilePicker: () => undefined,
      showSaveFilePicker: () => undefined,
      navigator: {
        storage: {
          getDirectory: () => undefined
        }
      }
    });
    const exported = JSON.parse(exportCadProjectJson(engine)) as Record<
      string,
      unknown
    >;

    expect(status.entries).toHaveLength(4);
    expect(exported).not.toHaveProperty("storageCapabilities");
    expect(exported).not.toHaveProperty("storageCapabilityStatus");
    expect(exported).not.toHaveProperty("activeStorageMode");
    expect(JSON.stringify(exported)).not.toContain("File System Access");
    expect(JSON.stringify(exported)).not.toContain(".wcad");
    expect(exportCadProjectJson(engine)).toBe(beforeJson);
  });
});

function createJsonFallbackTarget() {
  function FileConstructor() {
    return undefined;
  }

  FileConstructor.prototype.text = () => "";

  return {
    Blob: function BlobConstructor() {
      return undefined;
    },
    File: FileConstructor,
    URL: {
      createObjectURL: () => "",
      revokeObjectURL: () => undefined
    },
    document: {
      createElement: () => ({})
    }
  };
}

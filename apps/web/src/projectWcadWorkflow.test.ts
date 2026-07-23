import { CadEngine, exportCadProjectWcad } from "@web-cad/cad-core";
import { describe, expect, it, vi } from "vitest";
import {
  createInitialProjectFileWorkflowState,
  createJsonFallbackProjectFileState,
  createProjectFileFailureState,
  createProjectFileStateFromExport,
  createProjectFileStateFromRead,
  ensureWcadFileExtension,
  formatWcadValidationIssue,
  getProjectFileDirectSaveLabel,
  getProjectFileDirtyLabel,
  getProjectFileNameLabel,
  getProjectFileStorageModeLabel,
  markProjectFileDirty,
  pickWcadOpenFile,
  pickWcadSaveFile,
  readBytesFromWcadFile,
  summarizeWcadDiagnostics,
  writeBytesToWcadHandle,
  type WcadFileHandleLike
} from "./projectWcadWorkflow";

describe("project WCAD workflow helpers", () => {
  it("tracks unsaved, dirty, saved, uploaded, and JSON fallback state", async () => {
    const engine = createRectangleExtrudeEngine();
    const exported = await exportCadProjectWcad(engine);
    const initial = createInitialProjectFileWorkflowState();
    const dirty = markProjectFileDirty(initial);

    expect(initial.mode).toBe("unsaved");
    expect(getProjectFileStorageModeLabel(initial.mode)).toBe("Unsaved");
    expect(getProjectFileNameLabel(initial)).toBe("Untitled project");
    expect(getProjectFileDirtyLabel(initial)).toBe("Not saved");
    expect(getProjectFileDirtyLabel(dirty)).toBe("Not saved");

    const saved = createProjectFileStateFromExport(exported, {
      mode: "wcadHandle",
      fileName: "bracket.wcad",
      operation: "saveAs"
    });

    expect(saved).toMatchObject({
      mode: "wcadHandle",
      fileName: "bracket.wcad",
      dirty: false,
      packageVersion: "partbench.wcad.v1",
      documentSchemaVersion: "web-cad.project.v16"
    });
    expect(saved.sourceIdentity?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(saved.lastResult?.status).toBe("saved");
    expect(getProjectFileNameLabel(saved)).toBe("bracket.wcad");
    expect(getProjectFileDirtyLabel(saved)).toBe("Saved");

    const dirtySaved = markProjectFileDirty(saved);

    expect(getProjectFileDirtyLabel(dirtySaved)).toBe("Unsaved changes");

    const jsonFallback = createJsonFallbackProjectFileState("debug.json");

    expect(jsonFallback).toMatchObject({
      mode: "jsonFallback",
      fileName: "debug.json",
      dirty: false
    });
    expect(getProjectFileNameLabel(jsonFallback)).toBe("Untitled project");
    expect(getProjectFileDirtyLabel(jsonFallback)).toBe("JSON imported");
    expect(jsonFallback.sourceIdentity).toBeUndefined();
  });

  it("creates opened and failed states from cad-core read diagnostics", async () => {
    const engine = createRectangleExtrudeEngine();
    const exported = await exportCadProjectWcad(engine);
    const opened = createProjectFileStateFromRead(
      {
        ok: true,
        project: engine.exportProject(),
        manifest: exported.manifest,
        sourceIdentity: exported.sourceIdentity,
        diagnostics: []
      },
      {
        current: createInitialProjectFileWorkflowState(),
        mode: "uploadedFallback",
        fileName: "upload.wcad"
      }
    );

    expect(opened.mode).toBe("uploadedFallback");
    expect(opened.lastResult?.status).toBe("opened");
    expect(getProjectFileDirectSaveLabel(opened, false)).toBe(
      "Download fallback"
    );

    const failed = createProjectFileStateFromRead(
      {
        ok: false,
        issues: [
          {
            code: "WCAD_MISSING_MANIFEST",
            severity: "error",
            message: "WCAD package is missing manifest.json.",
            entryPath: "manifest.json",
            entryRole: "manifest"
          }
        ]
      },
      {
        current: opened,
        mode: "uploadedFallback",
        fileName: "bad.wcad"
      }
    );

    expect(failed.mode).toBe("uploadedFallback");
    expect(failed.fileName).toBe("bad.wcad");
    expect(failed.lastResult?.status).toBe("failed");
    expect(summarizeWcadDiagnostics(failed.diagnostics)).toBe(
      "1 package error"
    );
    const [diagnostic] = failed.diagnostics;
    if (!diagnostic) {
      throw new Error("Expected missing-manifest diagnostic.");
    }
    expect(formatWcadValidationIssue(diagnostic)).toContain(
      "WCAD_MISSING_MANIFEST"
    );
  });

  it("wraps File System Access picker and handle operations without persisting handles", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const write = vi.fn();
    const close = vi.fn();
    const handle: WcadFileHandleLike = {
      name: "picked.wcad",
      getFile: async () => ({
        name: "picked.wcad",
        arrayBuffer: async () => bytes.buffer
      }),
      createWritable: async () => ({ write, close })
    };
    const openPicker = vi.fn(async () => [handle]);
    const savePicker = vi.fn(async () => handle);

    expect(await pickWcadOpenFile({ showOpenFilePicker: openPicker })).toBe(
      handle
    );
    expect(
      await pickWcadSaveFile({ showSaveFilePicker: savePicker }, "part")
    ).toBe(handle);
    expect(savePicker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: "part.wcad" })
    );

    await writeBytesToWcadHandle(handle, bytes);

    expect(write).toHaveBeenCalledWith(bytes);
    expect(close).toHaveBeenCalledTimes(1);
    await expect(
      readBytesFromWcadFile(await handle.getFile())
    ).resolves.toEqual(bytes);

    const writeFailure = new Error("permission revoked");
    const abort = vi.fn();
    const failingHandle: WcadFileHandleLike = {
      getFile: async () => ({
        arrayBuffer: async () => new ArrayBuffer(0)
      }),
      createWritable: async () => ({
        write: async () => {
          throw writeFailure;
        },
        close: vi.fn(),
        abort
      })
    };

    await expect(writeBytesToWcadHandle(failingHandle, bytes)).rejects.toThrow(
      "permission revoked"
    );
    expect(abort).toHaveBeenCalledTimes(1);

    const savedState = createProjectFileStateFromExport(
      await exportCadProjectWcad(createRectangleExtrudeEngine()),
      {
        mode: "wcadHandle",
        fileName: handle.name,
        operation: "save"
      }
    );

    expect(JSON.stringify(savedState)).not.toMatch(
      /fileHandle|opfs|renderer|mesh|occt|selectionBuffer|localPath/i
    );
  });

  it("formats filenames and failure diagnostics without changing source metadata", () => {
    const current = createInitialProjectFileWorkflowState();
    const failed = createProjectFileFailureState(current, {
      operation: "saveAs",
      message: "Could not save .wcad package.",
      detail: "Permission denied."
    });

    expect(ensureWcadFileExtension("part")).toBe("part.wcad");
    expect(ensureWcadFileExtension("part.wcad")).toBe("part.wcad");
    expect(failed).toMatchObject({
      mode: "unsaved",
      dirty: false,
      lastResult: {
        operation: "saveAs",
        status: "failed",
        detail: "Permission denied."
      }
    });
  });
});

function createRectangleExtrudeEngine(): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_wcad_workflow",
      name: "Profile",
      plane: "XY"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_wcad_workflow",
      id: "rect_wcad_workflow",
      center: [0, 0],
      width: 2,
      height: 1
    },
    {
      op: "feature.extrude",
      id: "feat_wcad_workflow",
      bodyId: "body_wcad_workflow",
      sketchId: "sketch_wcad_workflow",
      entityId: "rect_wcad_workflow",
      depth: 1
    }
  ]);

  return engine;
}

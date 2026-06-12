import {
  CAD_PROJECT_FORMAT_VERSION_V1,
  CadEngine,
  CURRENT_CAD_PROJECT_FORMAT_VERSION,
  exportCadProject,
  exportCadProjectJson
} from "@web-cad/cad-core";
import type { ProjectExportReadinessQueryResponse } from "@web-cad/cad-protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createProjectJsonWorkflowState } from "../projectJson";
import { createProjectStorageCapabilityStatus } from "../projectStorageCapabilities";
import { ProjectJsonPanel } from "./ProjectJsonPanel";

describe("ProjectJsonPanel", () => {
  it("renders current source, loaded draft, migration, and replacement impact", () => {
    const currentEngine = new CadEngine();

    currentEngine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 2, depth: 3 }
    });

    const draftProject = exportCadProject(new CadEngine());
    const legacyDraft = {
      ...draftProject,
      schemaVersion: CAD_PROJECT_FORMAT_VERSION_V1,
      document: {
        units: draftProject.document.units,
        objects: draftProject.document.objects,
        nextObjectNumber: draftProject.document.nextObjectNumber
      }
    };
    const markup = renderToStaticMarkup(
      createElement(ProjectJsonPanel, {
        disabled: false,
        projectJson: JSON.stringify(legacyDraft),
        storageCapabilities: createProjectStorageCapabilityStatus(
          createJsonFallbackTarget()
        ),
        workflow: createProjectJsonWorkflowState({
          currentProject: exportCadProject(currentEngine),
          draftJson: JSON.stringify(legacyDraft),
          draftSource: { kind: "loadedFile", fileName: "legacy-v1.json" }
        }),
        onProjectJsonChange: () => undefined,
        onProjectFileLoaded: () => undefined,
        onProjectFileError: () => undefined,
        onExport: () => undefined,
        onDownload: () => undefined,
        onImport: () => undefined
      })
    );

    expect(markup).toContain("Current source");
    expect(markup).toContain("cad-core document");
    expect(markup).toContain("Loaded file");
    expect(markup).toContain("legacy-v1.json");
    expect(markup).toContain("Legacy schema accepted");
    expect(markup).toContain(CURRENT_CAD_PROJECT_FORMAT_VERSION);
    expect(markup).toContain("Will replace current document");
    expect(markup).toContain("Draft contains no undo or redo history.");
    expect(markup).toContain("Preview source");
  });

  it("renders generated-export same-document-source state without replacement impact", () => {
    const engine = new CadEngine();
    const projectJson = exportCadProjectJson(engine);
    const markup = renderToStaticMarkup(
      createElement(ProjectJsonPanel, {
        disabled: false,
        projectJson,
        storageCapabilities: createProjectStorageCapabilityStatus(
          createJsonFallbackTarget()
        ),
        workflow: createProjectJsonWorkflowState({
          currentProject: exportCadProject(engine),
          draftJson: projectJson,
          draftSource: { kind: "generatedExport" }
        }),
        onProjectJsonChange: () => undefined,
        onProjectFileLoaded: () => undefined,
        onProjectFileError: () => undefined,
        onExport: () => undefined,
        onDownload: () => undefined,
        onImport: () => undefined
      })
    );

    expect(markup).toContain("Generated export");
    expect(markup).toContain("Current schema");
    expect(markup).toContain("No document source change detected");
    expect(markup).toContain("may still restore undo/redo history");
  });

  it("renders structured validation issues and disables import", () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectJsonPanel, {
        disabled: false,
        projectJson: "{",
        storageCapabilities: createProjectStorageCapabilityStatus(
          createJsonFallbackTarget()
        ),
        workflow: createProjectJsonWorkflowState({
          currentProject: exportCadProject(new CadEngine()),
          draftJson: "{",
          draftSource: { kind: "edited" }
        }),
        onProjectJsonChange: () => undefined,
        onProjectFileLoaded: () => undefined,
        onProjectFileError: () => undefined,
        onExport: () => undefined,
        onDownload: () => undefined,
        onImport: () => undefined
      })
    );

    expect(markup).toContain("Pasted or edited JSON");
    expect(markup).toContain("Schema blocked");
    expect(markup).toContain("Import blocked");
    expect(markup).toContain("Import validation");
    expect(markup).toContain("INVALID_JSON");
    expect(markup).toContain("Project JSON could not be parsed.");
    expect(markup).toMatch(
      /<button type="button" disabled="">Import JSON<\/button>/
    );
  });

  it("renders empty draft state with import disabled", () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectJsonPanel, {
        disabled: false,
        projectJson: "",
        storageCapabilities: createProjectStorageCapabilityStatus(
          createJsonFallbackTarget()
        ),
        workflow: createProjectJsonWorkflowState({
          currentProject: exportCadProject(new CadEngine()),
          draftJson: "",
          draftSource: { kind: "empty" }
        }),
        onProjectJsonChange: () => undefined,
        onProjectFileLoaded: () => undefined,
        onProjectFileError: () => undefined,
        onExport: () => undefined,
        onDownload: () => undefined,
        onImport: () => undefined
      })
    );

    expect(markup).toContain("Empty draft");
    expect(markup).toContain("No schema");
    expect(markup).toContain("No import preview");
    expect(markup).toMatch(
      /<button type="button" disabled="">Import JSON<\/button>/
    );
  });

  it("renders .wcad workflow status with JSON as interchange fallback", () => {
    const engine = new CadEngine();
    const markup = renderToStaticMarkup(
      createElement(ProjectJsonPanel, {
        disabled: false,
        projectJson: "",
        storageCapabilities: createProjectStorageCapabilityStatus({
          ...createJsonFallbackTarget(),
          showOpenFilePicker: () => undefined,
          showSaveFilePicker: () => undefined,
          navigator: {
            storage: {
              getDirectory: () => undefined
            }
          }
        }),
        workflow: createProjectJsonWorkflowState({
          currentProject: exportCadProject(engine),
          draftJson: "",
          draftSource: { kind: "empty" }
        }),
        onProjectJsonChange: () => undefined,
        onProjectFileLoaded: () => undefined,
        onProjectFileError: () => undefined,
        onExport: () => undefined,
        onDownload: () => undefined,
        onImport: () => undefined
      })
    );

    expect(markup).toContain("Open .wcad");
    expect(markup).toContain("Save As");
    expect(markup).toContain("Saved");
    expect(markup).toContain("No project file has been saved yet");
    expect(markup).toContain("Save/open status");
    expect(markup).toContain("Active storage mode is .wcad package workflow");
    expect(markup).toContain("JSON import/export");
    expect(markup).toContain("Available");
    expect(markup).toContain("Direct browser file handles");
    expect(markup).toContain("Available");
    expect(markup).toContain("app-only browser state");
    expect(markup).toContain("OPFS browser cache");
    expect(markup).toContain("OPFS cache");
    expect(markup).toContain("Clear cache");
    expect(markup).toContain("partbench.opfs-cache.v1");
    expect(markup).toContain("Browser-private rebuildable cache only");
    expect(markup).toContain("Native .wcad package");
    expect(markup).toContain("Active");
    expect(markup).toContain("No project source");
    expect(markup).toContain("partbench.wcad.v1");
  });

  it("renders OPFS cache diagnostics without exposing implementation handles", () => {
    const engine = new CadEngine();
    const markup = renderToStaticMarkup(
      createElement(ProjectJsonPanel, {
        disabled: false,
        projectJson: "",
        opfsCacheStatus: {
          state: "invalid",
          available: true,
          indexVersion: "partbench.opfs-cache.v1",
          entryCount: 1,
          validEntryCount: 0,
          staleEntryCount: 1,
          unsupportedEntryCount: 0,
          corruptEntryCount: 0,
          diagnostics: [
            {
              code: "OPFS_STALE_SOURCE_IDENTITY",
              severity: "warning",
              message: "OPFS cache entry belongs to a stale source identity.",
              cacheKey: "semantic-cache-key",
              artifactKind: "derivedMesh"
            }
          ],
          lastResult: "OPFS cache index read."
        },
        storageCapabilities: createProjectStorageCapabilityStatus({
          ...createJsonFallbackTarget(),
          navigator: {
            storage: {
              getDirectory: () => undefined
            }
          }
        }),
        workflow: createProjectJsonWorkflowState({
          currentProject: exportCadProject(engine),
          draftJson: "",
          draftSource: { kind: "empty" }
        }),
        onProjectJsonChange: () => undefined,
        onProjectFileLoaded: () => undefined,
        onProjectFileError: () => undefined,
        onExport: () => undefined,
        onDownload: () => undefined,
        onImport: () => undefined
      })
    );

    expect(markup).toContain("OPFS cache");
    expect(markup).toContain("Invalid");
    expect(markup).toContain("OPFS_STALE_SOURCE_IDENTITY");
    expect(markup).toContain(".wcad unchanged");
    expect(markup).not.toMatch(
      /fileHandle|opfsPath|rendererId|meshId|occtId|selectionBufferId/i
    );
  });

  it("renders export readiness without internal display-state identifiers", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_export",
        name: "Profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_export",
        id: "rect_export",
        center: [0, 0],
        width: 2,
        height: 1
      },
      {
        op: "feature.extrude",
        id: "feat_export",
        bodyId: "body_export",
        sketchId: "sketch_export",
        entityId: "rect_export",
        depth: 1
      }
    ]);

    const markup = renderToStaticMarkup(
      createElement(ProjectJsonPanel, {
        disabled: false,
        exportReadiness: readExportReadiness(engine),
        projectJson: "",
        storageCapabilities: createProjectStorageCapabilityStatus(
          createJsonFallbackTarget()
        ),
        workflow: createProjectJsonWorkflowState({
          currentProject: exportCadProject(engine),
          draftJson: "",
          draftSource: { kind: "empty" }
        }),
        onProjectJsonChange: () => undefined,
        onProjectFileLoaded: () => undefined,
        onProjectFileError: () => undefined,
        onExport: () => undefined,
        onDownload: () => undefined,
        onImport: () => undefined
      })
    );

    expect(markup).toContain("Export readiness");
    expect(markup).toContain("Supported");
    expect(markup).toContain("STEP");
    expect(markup).toContain("Mesh/GLB visualization");
    expect(markup).toContain("Exact STEP export is available");
    expect(markup).toContain("Source body is supported");
    expect(markup).toContain(
      "Display output and temporary visualization state"
    );
    const exportSectionStart = markup.indexOf('aria-label="Export readiness"');
    const exportSectionEnd = markup.indexOf(
      '<dl class="project-capability-list" aria-label="Export body status"',
      exportSectionStart
    );
    const exportReadinessMarkup = markup.slice(
      exportSectionStart,
      exportSectionEnd
    );
    expect(exportReadinessMarkup).toContain("Download STEP");
    expect(exportReadinessMarkup).not.toMatch(
      /OCCT|renderer|cache|selection-buffer/i
    );
  });

  it("renders available visualization GLB export separately from project JSON controls", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_export",
        name: "Profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_export",
        id: "rect_export",
        center: [0, 0],
        width: 2,
        height: 1
      },
      {
        op: "feature.extrude",
        id: "feat_export",
        bodyId: "body_export",
        sketchId: "sketch_export",
        entityId: "rect_export",
        depth: 1
      }
    ]);

    const markup = renderToStaticMarkup(
      createElement(ProjectJsonPanel, {
        disabled: false,
        exportReadiness: readExportReadiness(engine),
        visualizationDownloadAvailable: true,
        visualizationExport: {
          status: "supported",
          available: true,
          detail:
            "GLB visualization export is available for ready derived display meshes.",
          limitation:
            "Ready derived visualization meshes can be written as a transient GLB artifact.",
          nextStep:
            "Download the GLB visualization artifact from the Project panel.",
          exportableBodyCount: 1,
          skippedBodyCount: 0,
          vertexCount: 24,
          triangleCount: 12
        },
        projectJson: "",
        storageCapabilities: createProjectStorageCapabilityStatus(
          createJsonFallbackTarget()
        ),
        workflow: createProjectJsonWorkflowState({
          currentProject: exportCadProject(engine),
          draftJson: "",
          draftSource: { kind: "empty" }
        }),
        onProjectJsonChange: () => undefined,
        onProjectFileLoaded: () => undefined,
        onProjectFileError: () => undefined,
        onExport: () => undefined,
        onDownload: () => undefined,
        onDownloadStep: () => undefined,
        onDownloadVisualization: () => undefined,
        onImport: () => undefined
      })
    );

    const exportSectionStart = markup.indexOf('aria-label="Export readiness"');
    const exportSectionEnd = markup.indexOf(
      '<dl class="project-capability-list" aria-label="Export body status"',
      exportSectionStart
    );
    const exportReadinessMarkup = markup.slice(
      exportSectionStart,
      exportSectionEnd
    );

    expect(exportReadinessMarkup).toContain("Supported");
    expect(exportReadinessMarkup).toContain(
      "Exact STEP and Mesh/GLB visualization"
    );
    expect(exportReadinessMarkup).toContain(
      "Mesh/GLB visualization export is available"
    );
    expect(exportReadinessMarkup).toContain("Download STEP");
    expect(exportReadinessMarkup).toContain("Download visualization GLB");
    expect(exportReadinessMarkup).not.toMatch(
      /<button type="button" disabled="">Download visualization GLB<\/button>/
    );
    const jsonInterchangeStart = markup.indexOf(
      "<summary>JSON interchange</summary>"
    );
    const jsonButtonRow = markup.slice(jsonInterchangeStart);

    expect(jsonButtonRow).toContain("Export JSON");
    expect(jsonButtonRow).toContain("Download JSON");
    expect(jsonButtonRow).not.toContain("Download STEP");
    expect(jsonButtonRow).not.toContain("Download visualization GLB");
  });

  it("renders primitive-only export readiness as unavailable", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_export",
      name: "Reference box",
      dimensions: { width: 1, height: 2, depth: 3 }
    });

    const markup = renderToStaticMarkup(
      createElement(ProjectJsonPanel, {
        disabled: false,
        exportReadiness: readExportReadiness(engine),
        projectJson: "",
        storageCapabilities: createProjectStorageCapabilityStatus(
          createJsonFallbackTarget()
        ),
        workflow: createProjectJsonWorkflowState({
          currentProject: exportCadProject(engine),
          draftJson: "",
          draftSource: { kind: "empty" }
        }),
        onProjectJsonChange: () => undefined,
        onProjectFileLoaded: () => undefined,
        onProjectFileError: () => undefined,
        onExport: () => undefined,
        onDownload: () => undefined,
        onImport: () => undefined
      })
    );

    const exportSectionStart = markup.indexOf('aria-label="Export readiness"');
    const exportSectionEnd = markup.indexOf(
      '<div class="button-row"',
      exportSectionStart
    );
    const exportReadinessMarkup = markup.slice(
      exportSectionStart,
      exportSectionEnd
    );

    expect(exportReadinessMarkup).toContain("Unavailable");
    expect(exportReadinessMarkup).toContain("Primitive object source");
    expect(exportReadinessMarkup).toContain("not treated as an authored CAD");
    expect(exportReadinessMarkup).toContain("STEP");
    expect(exportReadinessMarkup).toContain("Mesh/GLB visualization");
    expect(exportReadinessMarkup).not.toMatch(
      /OCCT|renderer|cache|selection-buffer/i
    );
  });

  it("disables file-specific controls when .wcad and JSON fallback primitives are unavailable", () => {
    const engine = new CadEngine();
    const markup = renderToStaticMarkup(
      createElement(ProjectJsonPanel, {
        disabled: false,
        projectJson: "",
        storageCapabilities: createProjectStorageCapabilityStatus({}),
        workflow: createProjectJsonWorkflowState({
          currentProject: exportCadProject(engine),
          draftJson: "",
          draftSource: { kind: "empty" }
        }),
        onProjectJsonChange: () => undefined,
        onProjectFileLoaded: () => undefined,
        onProjectFileError: () => undefined,
        onExport: () => undefined,
        onDownload: () => undefined,
        onImport: () => undefined
      })
    );

    expect(markup).toMatch(
      /<button type="button" disabled="">Open \.wcad<\/button>/
    );
    expect(markup).toMatch(/<button type="button" disabled="">Save<\/button>/);
    expect(markup).toMatch(
      /<button type="button" disabled="">Save As<\/button>/
    );
    expect(markup).toMatch(
      /<button id="project-opfs-cache-clear" type="button">Clear cache<\/button>/
    );
    expect(markup).toMatch(/<button type="button">Export JSON<\/button>/);
    expect(markup).toMatch(
      /<button type="button" disabled="">Download JSON<\/button>/
    );
    expect(markup).toMatch(
      /<button type="button" disabled="">Load JSON<\/button>/
    );
  });
});

function readExportReadiness(
  engine: CadEngine
): ProjectExportReadinessQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.exportReadiness" }
  });

  if (!response.ok || response.query !== "project.exportReadiness") {
    throw new Error("Expected project export readiness.");
  }

  return response;
}

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

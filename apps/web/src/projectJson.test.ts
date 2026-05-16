import {
  CadEngine,
  exportCadProject,
  exportCadProjectJson
} from "@web-cad/cad-core";
import { describe, expect, it } from "vitest";
import {
  createProjectJsonPreview,
  formatProjectJsonSummary,
  getProjectImportStatusText,
  summarizeCadProject
} from "./projectJson";

describe("projectJson helpers", () => {
  it("summarizes current project source-of-truth metadata", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 2, depth: 3 }
    });
    engine.apply({
      op: "document.updateUnits",
      units: "cm",
      mode: "preservePhysicalSize"
    });

    expect(summarizeCadProject(exportCadProject(engine))).toEqual({
      schemaVersion: "web-cad.project.v1",
      units: "cm",
      objectCount: 1,
      objectKindSummary: "box 1",
      transactionCount: 2,
      redoTransactionCount: 0
    });
  });

  it("previews valid project JSON before import", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createCylinder",
      id: "cylinder_1",
      dimensions: { radius: 1, height: 4 }
    });
    engine.undo();

    const preview = createProjectJsonPreview(exportCadProjectJson(engine));

    expect(preview.status).toBe("valid");

    if (preview.status !== "valid") {
      throw new Error("Expected a valid project preview.");
    }

    expect(preview.summary).toEqual({
      schemaVersion: "web-cad.project.v1",
      units: "mm",
      objectCount: 0,
      objectKindSummary: "none",
      transactionCount: 0,
      redoTransactionCount: 1
    });
    expect(formatProjectJsonSummary(preview.summary)).toBe(
      "web-cad.project.v1, 0 object(s), 0 transaction(s), 1 redo"
    );
    expect(getProjectImportStatusText(preview)).toBe(
      "Ready to import web-cad.project.v1, 0 object(s), 0 transaction(s), 1 redo. Import replaces the current document and restores available undo/redo history."
    );
  });

  it("summarizes multiple primitive types in stable order", () => {
    const engine = new CadEngine();

    engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.createTorus",
          id: "torus_1",
          dimensions: { majorRadius: 2, minorRadius: 0.5 }
        },
        {
          op: "scene.createBox",
          id: "box_1",
          dimensions: { width: 1, height: 1, depth: 1 }
        },
        {
          op: "scene.createCone",
          id: "cone_1",
          dimensions: { radius: 1, height: 2 }
        }
      ]
    });

    const summary = summarizeCadProject(exportCadProject(engine));

    expect(summary.objectKindSummary).toBe("box 1, cone 1, torus 1");
    expect(formatProjectJsonSummary(summary)).toBe(
      "web-cad.project.v1, 3 object(s) (box 1, cone 1, torus 1), 1 transaction(s)"
    );
  });

  it("describes empty project JSON input as not ready for import", () => {
    const preview = createProjectJsonPreview(" ");

    expect(preview).toEqual({ status: "empty" });
    expect(getProjectImportStatusText(preview)).toBe(
      "Generate, load, or paste project JSON to preview source-of-truth data before import."
    );
  });

  it("returns structured import issues for malformed JSON", () => {
    const preview = createProjectJsonPreview("{");

    expect(preview.status).toBe("invalid");

    if (preview.status !== "invalid") {
      throw new Error("Expected an invalid project preview.");
    }

    expect(preview.issues).toEqual([
      {
        code: "INVALID_JSON",
        path: "$",
        message: "Project JSON could not be parsed."
      }
    ]);
    expect(preview.message).toContain("Invalid Web CAD project JSON");
    expect(getProjectImportStatusText(preview)).toBe(
      "Import is blocked until the project JSON validates successfully."
    );
  });

  it("returns structured import issues for unsupported project versions", () => {
    const project = JSON.parse(exportCadProjectJson(new CadEngine())) as {
      schemaVersion: string;
    };
    const preview = createProjectJsonPreview(
      JSON.stringify({
        ...project,
        schemaVersion: "web-cad.project.v0"
      })
    );

    expect(preview.status).toBe("invalid");

    if (preview.status !== "invalid") {
      throw new Error("Expected an invalid project preview.");
    }

    expect(preview.issues).toEqual([
      {
        code: "UNSUPPORTED_PROJECT_VERSION",
        path: "$.schemaVersion",
        message: "Unsupported project schemaVersion: web-cad.project.v0."
      }
    ]);
  });

  it("blocks previews for transaction history that cannot be imported", () => {
    const project = JSON.parse(exportCadProjectJson(new CadEngine())) as object;
    const preview = createProjectJsonPreview(
      JSON.stringify({
        ...project,
        history: [
          {
            id: "txn_1",
            status: "committed",
            ops: [
              {
                op: "scene.updateTransform",
                id: "missing",
                transform: { translation: [1, 2, 3] }
              }
            ],
            diff: {
              created: [],
              modified: [{ id: "missing", kind: "box" }],
              deleted: []
            }
          }
        ]
      })
    );

    expect(preview.status).toBe("invalid");

    if (preview.status !== "invalid") {
      throw new Error("Expected an invalid project preview.");
    }

    expect(preview.issues).toEqual([
      expect.objectContaining({
        code: "INVALID_TRANSACTION_HISTORY",
        path: "$.history"
      })
    ]);
  });
});

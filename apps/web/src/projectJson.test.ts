import {
  CadEngine,
  exportCadProject,
  exportCadProjectJson
} from "@web-cad/cad-core";
import { describe, expect, it } from "vitest";
import {
  createProjectJsonPreview,
  formatProjectJsonSummary,
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
      transactionCount: 0,
      redoTransactionCount: 1
    });
    expect(formatProjectJsonSummary(preview.summary)).toBe(
      "web-cad.project.v1, 0 object(s), 0 transaction(s), 1 redo"
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
});

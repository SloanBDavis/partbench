import {
  CadEngine,
  CURRENT_CAD_PROJECT_FORMAT_VERSION,
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
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      units: "cm",
      objectCount: 1,
      objectKindSummary: "box 1",
      sketchCount: 0,
      sketchEntityCount: 0,
      authoredFeatureCount: 0,
      namedReferenceCount: 0,
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
      schemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      units: "mm",
      objectCount: 0,
      objectKindSummary: "none",
      sketchCount: 0,
      sketchEntityCount: 0,
      authoredFeatureCount: 0,
      namedReferenceCount: 0,
      transactionCount: 0,
      redoTransactionCount: 1
    });
    expect(formatProjectJsonSummary(preview.summary)).toBe(
      `${CURRENT_CAD_PROJECT_FORMAT_VERSION}, 0 object(s), 0 transaction(s), 1 redo`
    );
    expect(getProjectImportStatusText(preview)).toBe(
      `Ready to import ${CURRENT_CAD_PROJECT_FORMAT_VERSION}, 0 object(s), 0 transaction(s), 1 redo. Import replaces the current document and restores available undo/redo history.`
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
      `${CURRENT_CAD_PROJECT_FORMAT_VERSION}, 3 object(s) (box 1, cone 1, torus 1), 1 transaction(s)`
    );
  });

  it("summarizes sketch source-of-truth data", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "line_1",
        start: [0, 0],
        end: [1, 1]
      }
    ]);

    const summary = summarizeCadProject(exportCadProject(engine));

    expect(summary.sketchCount).toBe(1);
    expect(summary.sketchEntityCount).toBe(1);
    expect(formatProjectJsonSummary(summary)).toBe(
      `${CURRENT_CAD_PROJECT_FORMAT_VERSION}, 0 object(s), 1 sketch(es), 1 sketch entity(ies), 1 transaction(s)`
    );
  });

  it("summarizes V2 authored features and named references", () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "rect_1",
        center: [0, 0],
        width: 2,
        height: 3
      },
      {
        op: "feature.extrude",
        id: "feat_1",
        bodyId: "body_1",
        sketchId: "sketch_1",
        entityId: "rect_1",
        depth: 4,
        side: "positive",
        operationMode: "newBody"
      },
      {
        op: "reference.nameGenerated",
        name: "Mounting face",
        bodyId: "body_1",
        stableId: "generated:face:body_1:endCap"
      }
    ]);

    const preview = createProjectJsonPreview(exportCadProjectJson(engine));

    expect(preview.status).toBe("valid");

    if (preview.status !== "valid") {
      throw new Error("Expected a valid project preview.");
    }

    expect(preview.summary.authoredFeatureCount).toBe(1);
    expect(preview.summary.namedReferenceCount).toBe(1);
    expect(formatProjectJsonSummary(preview.summary)).toBe(
      `${CURRENT_CAD_PROJECT_FORMAT_VERSION}, 0 object(s), 1 sketch(es), 1 sketch entity(ies), 1 authored feature(s), 1 named reference(s), 1 transaction(s)`
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
    expect(preview.message).toContain("Invalid Partbench project JSON");
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

import {
  CAD_PROJECT_FORMAT_VERSION_V18,
  CAD_PROJECT_FORMAT_VERSION_V1,
  CadEngine,
  CURRENT_CAD_PROJECT_FORMAT_VERSION,
  exportCadProject,
  exportCadProjectJson
} from "@web-cad/cad-core";
import { describe, expect, it } from "vitest";
import {
  createProjectJsonDraftSourceForEditorValue,
  createProjectJsonPreview,
  createProjectJsonWorkflowState,
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
      "0 object(s), 0 transaction(s), 1 redo"
    );
    expect(getProjectImportStatusText(preview)).toBe(
      "Ready to import 0 object(s), 0 transaction(s), 1 redo. Import replaces the current document and restores available undo/redo history."
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
      "3 object(s) (box 1, cone 1, torus 1), 1 transaction(s)"
    );
  });

  it("summarizes sketch project data", () => {
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
      "0 object(s), 1 sketch(es), 1 sketch entity(ies), 1 transaction(s)"
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
      "1 object(s) (body 1), 1 sketch(es), 1 sketch entity(ies), 1 authored feature(s), 1 named reference(s), 1 transaction(s)"
    );
  });

  it("describes empty project JSON input as not ready for import", () => {
    const preview = createProjectJsonPreview(" ");

    expect(preview).toEqual({ status: "empty" });
    expect(getProjectImportStatusText(preview)).toBe(
      "Generate, load, or paste project JSON to preview project data before import."
    );
  });

  it("summarizes empty import draft workflow state", () => {
    const engine = new CadEngine();
    const workflow = createProjectJsonWorkflowState({
      currentProject: exportCadProject(engine),
      draftJson: " ",
      draftSource: { kind: "empty" }
    });

    expect(workflow.current.sourceLabel).toBe("Current project");
    expect(workflow.draft.source).toMatchObject({
      kind: "empty",
      label: "Empty draft"
    });
    expect(workflow.draft.preview.status).toBe("empty");
    expect(workflow.draft.schema).toMatchObject({
      status: "empty",
      label: "No format info"
    });
    expect(workflow.draft.impact).toBeUndefined();
  });

  it("detects pasted or edited JSON that matches the current export", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 2, depth: 3 }
    });

    const minifiedCurrentJson = JSON.stringify(
      JSON.parse(exportCadProjectJson(engine))
    );
    const workflow = createProjectJsonWorkflowState({
      currentProject: exportCadProject(engine),
      draftJson: minifiedCurrentJson,
      draftSource:
        createProjectJsonDraftSourceForEditorValue(minifiedCurrentJson)
    });

    expect(workflow.draft.source).toMatchObject({
      kind: "edited",
      label: "Pasted or edited JSON"
    });
    expect(workflow.draft.schema).toMatchObject({
      status: "current",
      sourceSchemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION,
      normalizedSchemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION
    });
    expect(workflow.draft.impact).toMatchObject({
      sameDocumentSourceAsCurrent: true,
      wouldReplaceCurrentDocument: false,
      restoresUndoRedoHistory: true,
      undoTransactionCount: 1,
      redoTransactionCount: 0,
      label: "No document source change detected"
    });
    expect(
      getProjectImportStatusText(workflow.draft.preview, workflow.draft.impact)
    ).toContain("may still restore undo/redo history");
  });

  it("keeps same document source detection separate from undo history", () => {
    const currentEngine = new CadEngine();
    const draftEngine = new CadEngine();
    const createBox = {
      op: "scene.createBox" as const,
      id: "box_1",
      dimensions: { width: 1, height: 2, depth: 3 }
    };

    currentEngine.apply(createBox);
    draftEngine.apply(createBox);
    draftEngine.apply({
      op: "scene.createSphere",
      id: "sphere_1",
      dimensions: { radius: 2 }
    });
    draftEngine.undo();

    const workflow = createProjectJsonWorkflowState({
      currentProject: exportCadProject(currentEngine),
      draftJson: exportCadProjectJson(draftEngine),
      draftSource: { kind: "loadedFile", fileName: "same-part.json" }
    });

    expect(workflow.draft.impact).toMatchObject({
      sameDocumentSourceAsCurrent: true,
      wouldReplaceCurrentDocument: false,
      restoresUndoRedoHistory: true,
      undoTransactionCount: 1,
      redoTransactionCount: 1,
      label: "No document source change detected"
    });
    expect(workflow.draft.impact?.historyDetail).toBe(
      "Restores 1 undo transaction(s) and 1 redo transaction(s)."
    );
  });

  it("reports replacement and undo history impact for valid drafts", () => {
    const currentEngine = new CadEngine();
    const draftEngine = new CadEngine();

    draftEngine.apply({
      op: "scene.createCylinder",
      id: "cylinder_1",
      dimensions: { radius: 1, height: 4 }
    });
    draftEngine.apply({
      op: "scene.createSphere",
      id: "sphere_1",
      dimensions: { radius: 2 }
    });
    draftEngine.undo();

    const workflow = createProjectJsonWorkflowState({
      currentProject: exportCadProject(currentEngine),
      draftJson: exportCadProjectJson(draftEngine),
      draftSource: { kind: "generatedExport" }
    });

    expect(workflow.draft.preview.status).toBe("valid");
    expect(workflow.draft.impact).toMatchObject({
      sameDocumentSourceAsCurrent: false,
      wouldReplaceCurrentDocument: true,
      restoresUndoRedoHistory: true,
      undoTransactionCount: 1,
      redoTransactionCount: 1,
      label: "Will replace current document"
    });
    expect(workflow.draft.impact?.historyDetail).toBe(
      "Restores 1 undo transaction(s) and 1 redo transaction(s)."
    );
  });

  it("surfaces legacy schema migration through cad-core import behavior", () => {
    const engine = new CadEngine();
    const currentProject = exportCadProject(engine);
    const legacyV1Project = {
      ...currentProject,
      schemaVersion: CAD_PROJECT_FORMAT_VERSION_V1,
      document: {
        units: currentProject.document.units,
        objects: currentProject.document.objects,
        nextObjectNumber: currentProject.document.nextObjectNumber
      }
    };
    const workflow = createProjectJsonWorkflowState({
      currentProject,
      draftJson: JSON.stringify(legacyV1Project),
      draftSource: { kind: "loadedFile", fileName: "legacy-v1.json" }
    });

    expect(workflow.draft.source).toMatchObject({
      kind: "loadedFile",
      fileName: "legacy-v1.json"
    });
    expect(workflow.draft.preview.status).toBe("valid");
    expect(workflow.draft.schema).toMatchObject({
      status: "legacyMigrated",
      label: "Older format accepted",
      sourceSchemaVersion: CAD_PROJECT_FORMAT_VERSION_V1,
      normalizedSchemaVersion: CURRENT_CAD_PROJECT_FORMAT_VERSION
    });
    expect(workflow.draft.schema.detail).toContain("during import");
  });

  it("reports supported topology schemas without legacy migration copy", () => {
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
        op: "topology.checkpoint.create",
        checkpointId: "checkpoint_1",
        bodyId: "body_1",
        sourceFeatureId: "feat_1",
        sourceIdentity: {
          algorithm: "partbench-source-v1",
          sha256:
            "1111111111111111111111111111111111111111111111111111111111111111"
        },
        status: "active"
      },
      {
        op: "topology.anchor.create",
        anchorId: "anchor_body_1",
        entityKind: "body",
        bodyId: "body_1",
        checkpointId: "checkpoint_1",
        checkpointEntityId: "checkpoint-body-1",
        sourceFeatureId: "feat_1",
        stableId: "generated:body:body_1",
        sourceSemanticRole: "source body",
        signatureHash: "body_signature_1"
      }
    ]);

    const projectJson = exportCadProjectJson(engine);
    const workflow = createProjectJsonWorkflowState({
      currentProject: exportCadProject(new CadEngine()),
      draftJson: projectJson,
      draftSource: createProjectJsonDraftSourceForEditorValue(projectJson)
    });

    expect(workflow.draft.schema).toMatchObject({
      status: "current",
      label: "Supported format",
      sourceSchemaVersion: CAD_PROJECT_FORMAT_VERSION_V18,
      normalizedSchemaVersion: CAD_PROJECT_FORMAT_VERSION_V18
    });
    expect(workflow.draft.schema.detail).toBe(
      `${CAD_PROJECT_FORMAT_VERSION_V18} imports without migration.`
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

  it("keeps invalid workflow issues structured with code, path, and message", () => {
    const workflow = createProjectJsonWorkflowState({
      currentProject: exportCadProject(new CadEngine()),
      draftJson: "{",
      draftSource: { kind: "edited" }
    });

    expect(workflow.draft.preview.status).toBe("invalid");
    expect(workflow.draft.validationIssues).toEqual([
      {
        code: "INVALID_JSON",
        path: "$",
        message: "Project JSON could not be parsed."
      }
    ]);
    expect(workflow.draft.schema).toMatchObject({
      status: "invalid",
      label: "Format not recognized"
    });
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

  it("does not serialize app-layer workflow state into project JSON", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    const beforeJson = exportCadProjectJson(engine);
    const workflow = createProjectJsonWorkflowState({
      currentProject: exportCadProject(engine),
      draftJson: beforeJson,
      draftSource: {
        kind: "downloadedExport",
        fileName: "partbench-project.json"
      }
    });
    const exported = JSON.parse(exportCadProjectJson(engine)) as Record<
      string,
      unknown
    >;

    expect(workflow.draft.source).toMatchObject({
      kind: "downloadedExport",
      fileName: "partbench-project.json"
    });
    expect(exported).not.toHaveProperty("workflow");
    expect(exported).not.toHaveProperty("projectJsonDraftSource");
    expect(JSON.stringify(exported)).not.toContain("partbench-project.json");
    expect(exportCadProjectJson(engine)).toBe(beforeJson);
  });
});

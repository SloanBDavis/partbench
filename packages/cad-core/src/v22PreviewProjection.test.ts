import { describe, expect, it } from "vitest";
import type { CadBatch } from "@web-cad/cad-protocol";
import {
  CadEngine,
  createCadProjectSourceIdentity,
  exportCadProject
} from "./index";
import { projectCadBatch } from "@web-cad/cad-core/preview-projection";

function createEngineWithRedo(): CadEngine {
  const engine = new CadEngine();
  engine.apply({
    op: "scene.createBox",
    id: "box_1",
    dimensions: { width: 1, height: 2, depth: 3 }
  });
  engine.apply({
    op: "scene.createSphere",
    id: "sphere_1",
    dimensions: { radius: 2 }
  });
  engine.undo();
  return engine;
}

const updateBatch: CadBatch = {
  version: "cadops.v1",
  mode: "commit",
  ops: [
    {
      op: "scene.updateBoxDimensions",
      id: "box_1",
      dimensions: { width: 4, height: 5, depth: 6 }
    }
  ]
};

describe("V22 disposable preview projection", () => {
  it("matches committing the same batch on an independent clone", () => {
    const engine = createEngineWithRedo();
    const beforeProject = exportCadProject(engine);
    const beforeDocument = engine.getDocument();
    const beforeTransactions = engine.getTransactions();
    const beforeRedoStack = engine.getRedoStack();
    const beforeEpoch = engine.getSourceAuthorityEpoch();
    const beforeSourceIdentity = createCadProjectSourceIdentity(beforeProject);

    const expectedEngine = CadEngine.fromProject(beforeProject);
    const expectedResponse = expectedEngine.executeBatch(updateBatch);
    const expectedProject = exportCadProject(expectedEngine);

    const projected = projectCadBatch(engine, updateBatch);

    expect(projected.ok).toBe(true);
    expect(projected.projectedEngine).not.toBe(engine);
    expect(projected.validationResponse).toMatchObject({
      ok: true,
      mode: "dryRun"
    });
    expect(projected.response).toEqual(expectedResponse);
    expect(projected.document).toEqual(expectedEngine.getDocument());
    expect(projected.project).toEqual(expectedProject);
    expect(projected.sourceIdentity).toEqual(
      createCadProjectSourceIdentity(expectedProject)
    );

    expect(engine.getDocument()).toEqual(beforeDocument);
    expect(exportCadProject(engine)).toEqual(beforeProject);
    expect(engine.getTransactions()).toEqual(beforeTransactions);
    expect(engine.getRedoStack()).toEqual(beforeRedoStack);
    expect(engine.getSourceAuthorityEpoch()).toBe(beforeEpoch);
    expect(createCadProjectSourceIdentity(exportCadProject(engine))).toEqual(
      beforeSourceIdentity
    );

    const detachedMutation = projected.projectedEngine.executeBatch({
      ...updateBatch,
      ops: [
        {
          op: "scene.updateBoxDimensions",
          id: "box_1",
          dimensions: { width: 7, height: 8, depth: 9 }
        }
      ]
    });
    expect(detachedMutation.ok).toBe(true);
    expect(exportCadProject(engine)).toEqual(beforeProject);
    expect(projected.projectedEngine.getDocument()).not.toEqual(
      beforeDocument
    );
  });

  it("accepts dry-run batches without changing the projected or live source", () => {
    const engine = createEngineWithRedo();
    const beforeProject = exportCadProject(engine);
    const dryRunBatch: CadBatch = { ...updateBatch, mode: "dryRun" };

    const projected = projectCadBatch(engine, dryRunBatch);

    expect(projected.ok).toBe(true);
    expect(projected.validationResponse).toMatchObject({
      ok: true,
      mode: "dryRun"
    });
    expect(projected.response).toMatchObject({ ok: true, mode: "commit" });
    expect(projected.project).not.toEqual(beforeProject);
    expect(projected.document).not.toEqual(engine.getDocument());
    expect(exportCadProject(engine)).toEqual(beforeProject);
  });

  it("returns validation failure without mutating live or projected source state", () => {
    const engine = createEngineWithRedo();
    const beforeProject = exportCadProject(engine);
    const beforeDocument = engine.getDocument();
    const beforeTransactions = engine.getTransactions();
    const beforeRedoStack = engine.getRedoStack();
    const beforeEpoch = engine.getSourceAuthorityEpoch();

    const projected = projectCadBatch(engine, {
      ...updateBatch,
      ops: [
        {
          op: "scene.updateBoxDimensions",
          id: "missing_box",
          dimensions: { width: 4, height: 5, depth: 6 }
        }
      ]
    });

    expect(projected.ok).toBe(false);
    expect(projected.projectedEngine).not.toBe(engine);
    expect(projected.validationResponse).toMatchObject({
      ok: false,
      mode: "dryRun"
    });
    expect(projected.response).toEqual(projected.validationResponse);
    expect(projected.project).toEqual(beforeProject);
    expect(projected.document).toEqual(beforeDocument);
    expect(engine.getDocument()).toEqual(beforeDocument);
    expect(exportCadProject(engine)).toEqual(beforeProject);
    expect(engine.getTransactions()).toEqual(beforeTransactions);
    expect(engine.getRedoStack()).toEqual(beforeRedoStack);
    expect(engine.getSourceAuthorityEpoch()).toBe(beforeEpoch);

    const detachedMutation = projected.projectedEngine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.createBox",
          id: "detached_only_box",
          dimensions: { width: 1, height: 1, depth: 1 }
        }
      ]
    });
    expect(detachedMutation.ok).toBe(true);
    expect(exportCadProject(engine)).toEqual(beforeProject);
  });
});

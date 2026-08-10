import type {
  CadBatch,
  CadBatchResponse,
  WcadSourceIdentity
} from "@web-cad/cad-protocol";
import {
  CadEngine,
  createCadProjectSourceIdentity,
  exportCadProject,
  type CadDocument,
  type CadProject
} from "./engine";

/**
 * The source-only result of evaluating an existing CADOps batch on a
 * disposable engine projection.
 *
 * The projected document and project are detached snapshots. The operation
 * never changes the engine on which it is called, including its transaction
 * history, redo stack, source-authority epoch, and source identity.
 */
export type CadBatchProjectionResult =
  | {
      readonly ok: true;
      readonly validationResponse: CadBatchResponse;
      readonly response: Extract<CadBatchResponse, { readonly ok: true }>;
      /**
       * The disposable engine that owns the projected source state. It is
       * always distinct from the engine on which the projectCadBatch helper
       * was called.
       */
      readonly projectedEngine: CadEngine;
      readonly document: CadDocument;
      readonly project: CadProject;
      readonly sourceIdentity: WcadSourceIdentity;
    }
  | {
      readonly ok: false;
      readonly validationResponse: CadBatchResponse;
      readonly response: Extract<CadBatchResponse, { readonly ok: false }>;
      /**
       * The disposable engine that owns the projected source state. It is
       * always distinct from the engine on which the projectCadBatch helper
       * was called.
       */
      readonly projectedEngine: CadEngine;
      readonly document: CadDocument;
      readonly project: CadProject;
      readonly sourceIdentity: WcadSourceIdentity;
    };

/**
 * Validate and project an existing CADOps batch against a detached copy of
 * an engine's current project.
 *
 * Validation always uses an ordinary dry-run response first. A successful
 * validation is then applied as a commit to the detached engine, regardless
 * of the input batch mode, so callers receive the source state that Apply
 * would produce. No command or source state is written to the source engine.
 */
export function projectCadBatch(
  engine: CadEngine,
  batch: CadBatch
): CadBatchProjectionResult {
  const projectedEngine = CadEngine.fromProject(exportCadProject(engine));
  const validationBatch: CadBatch = {
    ...batch,
    mode: "dryRun",
    ...(batch.audit
      ? {
          audit: {
            ...batch.audit,
            intent: "dryRun"
          }
        }
      : {})
  };
  const validationResponse = projectedEngine.executeBatch(validationBatch);

  if (!validationResponse.ok) {
    const project = exportCadProject(projectedEngine);
    return {
      ok: false,
      validationResponse,
      response: validationResponse,
      projectedEngine,
      document: projectedEngine.getDocument(),
      project,
      sourceIdentity: createCadProjectSourceIdentity(project)
    };
  }

  const commitBatch: CadBatch = {
    ...batch,
    mode: "commit",
    ...(batch.audit
      ? {
          audit: {
            ...batch.audit,
            intent: "commit"
          }
        }
      : {})
  };
  const response = projectedEngine.executeBatch(commitBatch);
  const project = exportCadProject(projectedEngine);

  if (!response.ok) {
    return {
      ok: false,
      validationResponse,
      response,
      projectedEngine,
      document: projectedEngine.getDocument(),
      project,
      sourceIdentity: createCadProjectSourceIdentity(project)
    };
  }

  return {
    ok: true,
    validationResponse,
    response,
    projectedEngine,
    document: projectedEngine.getDocument(),
    project,
    sourceIdentity: createCadProjectSourceIdentity(project)
  };
}

import { isDeepStrictEqual } from "node:util";

export const V19_HISTORY_BASELINE_WORKFLOW_VERSION =
  "partbench.v19-history-baseline-workflow.v1";

const CADOPS_VERSION = "cadops.v1";
const BASELINE_PARAMETER_ID = "param_imported_width";
const BASELINE_PARAMETER_VALUE = 12;
const CURRENT_PARAMETER_VALUE = 27.5;

class V19HistoryBaselineWorkflowFailure extends Error {}

export async function runV19HistoryBaselineWorkflow(cadCore) {
  const checks = [];
  const failures = [];
  let summary = {};

  function check(id, condition, evidence) {
    const passed = condition === true;
    checks.push({ id, passed, evidence });
    if (!passed) {
      throw new V19HistoryBaselineWorkflowFailure(
        `V19 history-baseline check failed: ${id}`
      );
    }
  }

  try {
    const seedEngine = new cadCore.CadEngine();
    seedEngine.apply({
      op: "parameter.create",
      id: BASELINE_PARAMETER_ID,
      name: "Imported width",
      value: BASELINE_PARAMETER_VALUE,
      description: "Historyless import fixture"
    });
    const seededProject = cadCore.exportCadProject(seedEngine);
    const historylessProject = {
      ...globalThis.structuredClone(seededProject),
      history: [],
      redoStack: []
    };
    const baselineSnapshot = globalThis.structuredClone(
      historylessProject.document
    );

    check(
      "historyless-nonempty-source",
      historylessProject.history.length === 0 &&
        historylessProject.redoStack.length === 0 &&
        historylessProject.historyBaseline === undefined &&
        readSnapshotParameterValue(
          historylessProject.document,
          BASELINE_PARAMETER_ID
        ) === BASELINE_PARAMETER_VALUE,
      {
        schemaVersion: historylessProject.schemaVersion,
        historyCount: historylessProject.history.length,
        redoCount: historylessProject.redoStack.length,
        baselinePresent: historylessProject.historyBaseline !== undefined,
        parameterValue: readSnapshotParameterValue(
          historylessProject.document,
          BASELINE_PARAMETER_ID
        )
      }
    );

    const engine = cadCore.importCadProject(historylessProject);
    const update = engine.executeBatch({
      version: CADOPS_VERSION,
      mode: "commit",
      ops: [
        {
          op: "parameter.update",
          id: BASELINE_PARAMETER_ID,
          value: CURRENT_PARAMETER_VALUE
        }
      ]
    });

    check(
      "parameter-overwrite",
      update.ok === true &&
        readEngineParameterValue(engine, BASELINE_PARAMETER_ID) ===
          CURRENT_PARAMETER_VALUE &&
        engine.getTransactions().length === 1,
      {
        ok: update.ok,
        parameterValue: readEngineParameterValue(engine, BASELINE_PARAMETER_ID),
        transactionCount: engine.getTransactions().length
      }
    );

    const currentProject = cadCore.exportCadProject(engine);
    const currentSnapshot = globalThis.structuredClone(currentProject.document);

    check(
      "v22-history-baseline",
      currentProject.schemaVersion === cadCore.CAD_PROJECT_FORMAT_VERSION_V22 &&
        currentProject.historyBaseline !== undefined &&
        isDeepStrictEqual(currentProject.historyBaseline, baselineSnapshot) &&
        currentProject.history.length === 1 &&
        currentProject.redoStack.length === 0,
      {
        schemaVersion: currentProject.schemaVersion,
        baselinePresent: currentProject.historyBaseline !== undefined,
        baselineExact: isDeepStrictEqual(
          currentProject.historyBaseline,
          baselineSnapshot
        ),
        baselineParameterValue: readSnapshotParameterValue(
          currentProject.historyBaseline,
          BASELINE_PARAMETER_ID
        ),
        historyCount: currentProject.history.length,
        redoCount: currentProject.redoStack.length
      }
    );

    const json = cadCore.exportCadProjectJson(engine);
    const jsonEngine = cadCore.importCadProjectJson(json);
    const jsonProject = cadCore.exportCadProject(jsonEngine);

    check(
      "json-round-trip",
      isDeepStrictEqual(jsonProject, currentProject) &&
        isDeepStrictEqual(
          JSON.parse(json).historyBaseline,
          currentProject.historyBaseline
        ),
      {
        projectExact: isDeepStrictEqual(jsonProject, currentProject),
        baselineExact: isDeepStrictEqual(
          JSON.parse(json).historyBaseline,
          currentProject.historyBaseline
        ),
        jsonByteLength: new TextEncoder().encode(json).byteLength
      }
    );

    const firstWcad = await cadCore.exportCadProjectWcad(engine);
    const secondWcad = await cadCore.exportCadProjectWcad(
      cadCore.importCadProject(globalThis.structuredClone(currentProject))
    );
    const wcadRead = await cadCore.readCadProjectWcad(firstWcad.bytes);
    const wcadEngine = wcadRead.ok
      ? cadCore.importCadProject(wcadRead.project)
      : undefined;
    const wcadProject = wcadEngine
      ? cadCore.exportCadProject(wcadEngine)
      : undefined;

    check(
      "wcad-cbor-round-trip",
      wcadRead.ok === true &&
        wcadProject !== undefined &&
        isDeepStrictEqual(wcadProject, currentProject) &&
        isDeepStrictEqual(firstWcad.commandsBytes, secondWcad.commandsBytes) &&
        firstWcad.commandsBytes.byteLength > 0,
      {
        readOk: wcadRead.ok,
        projectExact: isDeepStrictEqual(wcadProject, currentProject),
        commandsCborExact: isDeepStrictEqual(
          firstWcad.commandsBytes,
          secondWcad.commandsBytes
        ),
        commandsByteLength: firstWcad.commandsBytes.byteLength,
        packageByteLength: firstWcad.bytes.byteLength,
        diagnostics: wcadRead.ok ? wcadRead.diagnostics : wcadRead.issues
      }
    );

    const restoredEngines = [
      { transport: "json", engine: jsonEngine },
      { transport: "wcad", engine: wcadEngine }
    ];
    const undoEvidence = restoredEngines.map(
      ({ transport, engine: restored }) => {
        if (!restored) {
          return {
            transport,
            transactionId: undefined,
            snapshotExact: false,
            parameterValue: undefined
          };
        }
        const result = restored.undo();
        return {
          transport,
          transactionId: result?.transaction.id,
          snapshotExact: isDeepStrictEqual(
            restored.createSnapshot(),
            baselineSnapshot
          ),
          parameterValue: readEngineParameterValue(
            restored,
            BASELINE_PARAMETER_ID
          )
        };
      }
    );

    check(
      "undo-exact-baseline",
      undoEvidence.every(
        ({ transactionId, snapshotExact, parameterValue }) =>
          typeof transactionId === "string" &&
          snapshotExact &&
          parameterValue === BASELINE_PARAMETER_VALUE
      ),
      undoEvidence
    );

    const redoEvidence = restoredEngines.map(
      ({ transport, engine: restored }) => {
        if (!restored) {
          return {
            transport,
            transactionId: undefined,
            snapshotExact: false,
            projectExact: false,
            parameterValue: undefined
          };
        }
        const result = restored.redo();
        return {
          transport,
          transactionId: result?.transaction.id,
          snapshotExact: isDeepStrictEqual(
            restored.createSnapshot(),
            currentSnapshot
          ),
          projectExact: isDeepStrictEqual(
            cadCore.exportCadProject(restored),
            currentProject
          ),
          parameterValue: readEngineParameterValue(
            restored,
            BASELINE_PARAMETER_ID
          )
        };
      }
    );

    check(
      "redo-exact-current",
      redoEvidence.every(
        ({ transactionId, snapshotExact, projectExact, parameterValue }) =>
          typeof transactionId === "string" &&
          snapshotExact &&
          projectExact &&
          parameterValue === CURRENT_PARAMETER_VALUE
      ),
      redoEvidence
    );

    check(
      "deterministic-source-authority",
      isDeepStrictEqual(firstWcad.sourceIdentity, secondWcad.sourceIdentity) &&
        isDeepStrictEqual(firstWcad.bytes, secondWcad.bytes),
      {
        sourceIdentityExact: isDeepStrictEqual(
          firstWcad.sourceIdentity,
          secondWcad.sourceIdentity
        ),
        packageBytesExact: isDeepStrictEqual(firstWcad.bytes, secondWcad.bytes),
        sourceIdentity: firstWcad.sourceIdentity
      }
    );

    summary = {
      schemaVersion: currentProject.schemaVersion,
      baselineParameterValue: BASELINE_PARAMETER_VALUE,
      currentParameterValue: CURRENT_PARAMETER_VALUE,
      transactionCount: currentProject.history.length,
      transportCount: restoredEngines.length,
      wcadPackageVersion: firstWcad.manifest.packageVersion
    };
  } catch (error) {
    failures.push({
      message: error instanceof Error ? error.message : String(error)
    });
  }

  return {
    version: V19_HISTORY_BASELINE_WORKFLOW_VERSION,
    ok: failures.length === 0,
    checkCount: checks.length,
    passedCount: checks.filter(({ passed }) => passed).length,
    checks,
    failures,
    summary
  };
}

export function formatV19HistoryBaselineWorkflowSummary(result) {
  if (!result.ok) {
    return `V19 history-baseline workflow smoke failed: ${result.passedCount}/${result.checkCount} checks passed.`;
  }

  return `V19 history-baseline workflow smoke passed: ${result.passedCount}/${result.checkCount} checks passed across JSON and WCAD CBOR round-trips.`;
}

function readEngineParameterValue(engine, parameterId) {
  return engine.getDocument().parameters.get(parameterId)?.value;
}

function readSnapshotParameterValue(snapshot, parameterId) {
  return snapshot?.parameters.find(({ id }) => id === parameterId)?.value;
}

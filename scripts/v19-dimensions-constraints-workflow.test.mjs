import { describe, expect, it } from "vitest";

import * as cadCore from "../packages/cad-core/src/index.ts";
import * as sketchSolver from "../packages/sketch-solver/src/index.ts";
import {
  formatV19DimensionsConstraintsWorkflowSummary,
  runV19DimensionsConstraintsWorkflow,
  V19_DIMENSIONS_CONSTRAINTS_WORKFLOW_VERSION
} from "./v19-dimensions-constraints-workflow.mjs";

describe("V19 dimensions and constraints workflow smoke", () => {
  it("proves the deterministic target, value-source, unit, conflict, replay, and constraint matrix", () => {
    const first = runV19DimensionsConstraintsWorkflow(cadCore, sketchSolver);
    const second = runV19DimensionsConstraintsWorkflow(cadCore, sketchSolver);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: V19_DIMENSIONS_CONSTRAINTS_WORKFLOW_VERSION,
      ok: true,
      checkCount: 8,
      passedCount: 8,
      failures: [],
      summary: {
        schemaVersion: cadCore.CAD_PROJECT_FORMAT_VERSION_V22,
        literalTargetCount: 17,
        parameterTargetCount: 15,
        branchCount: 8,
        constraintLifecycleKinds: ["created", "modified", "modified", "deleted"]
      }
    });
    expect(first.checks.map(({ id }) => id)).toEqual([
      "literal-target-matrix",
      "direction-side-sense-matrix",
      "radius-diameter-equivalence",
      "literal-parameter-value-source-matrix",
      "unit-mode-matrix",
      "conflict-determinism",
      "dimension-replay-undo-redo",
      "constraint-command-lifecycle"
    ]);
    expect(formatV19DimensionsConstraintsWorkflowSummary(first)).toContain(
      "V19 dimensions/constraints workflow smoke passed: 8/8 checks passed"
    );
  });
});

import { describe, expect, it } from "vitest";
import * as cadCore from "../packages/cad-core/src/index.ts";
import { GeometryKernelWorker } from "../packages/geometry-worker/src/index.ts";
import { executeProjectExactStepExport } from "../apps/web/src/projectExactStepExport.ts";
import {
  formatV17SmokeSummary,
  runV17GeometryWorkflow
} from "./v17-release-samples.mjs";

const workflow = process.env.PARTBENCH_V17_SMOKE_WORKFLOW;
const supported = ["arcs-profiles", "composite-features", "curved-sweep"];

describe.skipIf(!supported.includes(workflow))(
  "V17 real geometry smoke",
  () => {
    it(`${workflow} crosses cad-core, the async worker, and real OCCT`, async () => {
      const result = await runV17GeometryWorkflow(workflow, {
        cadCore,
        GeometryKernelWorker,
        executeProjectExactStepExport
      });
      console.log(formatV17SmokeSummary(result));
      expect(result).toMatchObject({
        ok: true,
        workflow,
        realGeometry: true,
        passedCount: 1,
        failedCount: 0
      });
      expect(result.stepByteLength).toBeGreaterThan(1_000);
    }, 120_000);
  }
);

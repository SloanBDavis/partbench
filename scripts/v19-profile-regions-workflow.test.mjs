import { describe, expect, it } from "vitest";
import * as cadCore from "../packages/cad-core/src/index.ts";
import {
  GeometryKernelWorker,
  createExactBodyMetadataWorkerRequest,
  createExactTopologyCheckpointPayloadWorkerRequest,
  createExtrudeBooleanWorkerRequest,
  createRevolveProfileWorkerRequest
} from "../packages/geometry-worker/src/index.ts";
import {
  createCurrentDerivedExactMetadataSnapshots,
  readProjectExactStepExport
} from "../apps/web/src/projectExactExportQueries.ts";
import {
  createDerivedExactMetadataCacheKey,
  createExactMetadataRuntimeInput
} from "../apps/web/src/derivedExactMetadata.ts";
import {
  createExtrudeDerivedGeometrySources,
  createRevolveDerivedGeometrySources
} from "../apps/web/src/derivedGeometrySources.ts";
import { executeProjectExactStepExport } from "../apps/web/src/projectExactStepExport.ts";
import { exportProjectWcadWithTopologyCheckpoints } from "../apps/web/src/projectWcadTopologyCheckpoints.ts";
import {
  formatV19ProfileRegionsWorkflowSummary,
  runV19ProfileRegionsWorkflow
} from "./v19-profile-regions-workflow.mjs";

describe("V19 real profile-regions workflow", () => {
  it("proves region extrude and revolved hollow release scenarios", async () => {
    const result = await runV19ProfileRegionsWorkflow({
      cadCore,
      GeometryKernelWorker,
      createExactBodyMetadataWorkerRequest,
      createExactTopologyCheckpointPayloadWorkerRequest,
      createExtrudeBooleanWorkerRequest,
      createRevolveProfileWorkerRequest,
      createCurrentDerivedExactMetadataSnapshots,
      createDerivedExactMetadataCacheKey,
      createExactMetadataRuntimeInput,
      createExtrudeDerivedGeometrySources,
      createRevolveDerivedGeometrySources,
      executeProjectExactStepExport,
      exportProjectWcadWithTopologyCheckpoints,
      readProjectExactStepExport
    });

    console.log(formatV19ProfileRegionsWorkflowSummary(result));
    expect(result).toMatchObject({
      ok: true,
      realGeometry: true,
      passedCount: 9,
      checkCount: 9,
      failures: []
    });
  }, 180_000);
});

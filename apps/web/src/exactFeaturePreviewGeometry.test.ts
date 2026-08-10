import {
  CadEngine,
  createV15ReleaseSampleBatch,
  exportCadProjectJson,
  sha256Hex,
  type CadBatch
} from "@web-cad/cad-core";
import type { GeometryKernelExactBodyArtifact } from "@web-cad/geometry-worker";
import { describe, expect, it } from "vitest";

import type {
  DerivedExactBodyArtifactInput,
  DerivedGeometryExecutionContext,
  DerivedGeometryRuntime
} from "./derivedGeometryRuntime";
import { projectExactFeaturePreviewGeometry } from "./exactFeaturePreviewGeometry";
import { preflightExactDownstreamGeometryCommand } from "./holeGeometryPreflight";

const SAMPLE_BATCH = createV15ReleaseSampleBatch("v15-linear-pattern");
const PATTERN_UPDATE: CadBatch = {
  version: "cadops.v1",
  mode: "commit",
  ops: [
    {
      op: "feature.updateLinearPattern",
      id: "v15_linear_pattern_feature",
      spacing: 50
    }
  ]
};

describe("projectExactFeaturePreviewGeometry", () => {
  it("projects created bodies to the active result and returns ghosted meshes without mutating live source", async () => {
    const engine = new CadEngine();
    const runtime = createRuntime();
    const beforeProject = exportCadProjectJson(engine);
    const beforeTransactions = engine.getTransactions();
    const beforeEpoch = engine.getSourceAuthorityEpoch();

    const result = await projectExactFeaturePreviewGeometry({
      engine,
      batch: SAMPLE_BATCH,
      runtime
    });

    expect(result.response).toMatchObject({ ok: true, mode: "commit" });
    expect(result.affectedBodyIds).toEqual(["v15_linear_result_body"]);
    expect(result.meshes).toHaveLength(1);
    expect(result.meshes[0]).toMatchObject({
      id: "preview:v15_linear_result_body",
      presentation: "preview"
    });
    expect(runtime.artifactInputs.length).toBeGreaterThan(0);
    expect(exportCadProjectJson(engine)).toBe(beforeProject);
    expect(engine.getTransactions()).toEqual(beforeTransactions);
    expect(engine.getSourceAuthorityEpoch()).toBe(beforeEpoch);
  });

  it("uses an explicit consumed body target but returns its active descendant", async () => {
    const engine = new CadEngine();
    engine.applyBatch(SAMPLE_BATCH.ops);
    const result = await projectExactFeaturePreviewGeometry({
      engine,
      batch: PATTERN_UPDATE,
      bodyId: "v15_linear_seed_body",
      runtime: createRuntime()
    });

    expect(result.affectedBodyIds).toEqual(["v15_linear_result_body"]);
    expect(result.artifacts.map((artifact) => artifact.bodyId)).toEqual([
      "v15_linear_result_body"
    ]);
  });

  it("fails before geometry work when dry-run or projected commit rejects the batch", async () => {
    const engine = new CadEngine();
    const runtime = createRuntime();
    await expect(
      projectExactFeaturePreviewGeometry({
        engine,
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "feature.updateLinearPattern",
              id: "missing-pattern",
              spacing: 50
            }
          ]
        },
        runtime
      })
    ).rejects.toMatchObject({
      name: "ExactFeaturePreviewGeometryError",
      kind: "command",
      response: { ok: false }
    });
    expect(runtime.artifactInputs).toHaveLength(0);
  });

  it("rejects stale and aborted work at the projection boundary", async () => {
    const engine = new CadEngine();
    const runtime = createRuntime();
    await expect(
      projectExactFeaturePreviewGeometry({
        engine,
        batch: SAMPLE_BATCH,
        runtime,
        isCurrent: () => false
      })
    ).rejects.toMatchObject({ kind: "stale" });

    const controller = new AbortController();
    controller.abort();
    await expect(
      projectExactFeaturePreviewGeometry({
        engine,
        batch: SAMPLE_BATCH,
        runtime,
        signal: controller.signal
      })
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("checks the injected current assertion during and after artifact build", async () => {
    const engine = new CadEngine();
    const runtime = createRuntime();
    let assertions = 0;
    const result = await projectExactFeaturePreviewGeometry({
      engine,
      batch: SAMPLE_BATCH,
      runtime,
      isCurrent: () => {
        assertions += 1;
      }
    });

    expect(result.meshes[0]?.presentation).toBe("preview");
    expect(assertions).toBeGreaterThan(3);
  });

  it("keeps the existing user preflight artifact context when reused by downstream preflight", async () => {
    const engine = new CadEngine();
    engine.applyBatch(SAMPLE_BATCH.ops);
    const runtime = createRuntime();
    const result = await preflightExactDownstreamGeometryCommand({
      engine,
      ops: PATTERN_UPDATE.ops,
      runtime
    });

    expect(result).toMatchObject({ ok: true });
    expect(runtime.artifactContexts).toEqual(
      expect.arrayContaining([{ intent: "user", userKind: "preflight" }])
    );
  });
});

function createRuntime(): DerivedGeometryRuntime & {
  readonly artifactInputs: DerivedExactBodyArtifactInput[];
  readonly artifactContexts: DerivedGeometryExecutionContext[];
} {
  const artifactInputs: DerivedExactBodyArtifactInput[] = [];
  const artifactContexts: DerivedGeometryExecutionContext[] = [];
  const unused = () => {
    throw new Error("Only exact body artifact work is expected.");
  };
  return {
    artifactInputs,
    artifactContexts,
    async exactBodyArtifact(input, context) {
      artifactInputs.push(input);
      if (context) artifactContexts.push(context);
      return {
        artifact: createArtifact(input, artifactInputs.length),
        metrics: { objectId: input.id, roundTripMs: 1 },
        message: "mock exact preview artifact"
      };
    },
    executeExactStepExport: unused,
    tessellateBox: unused,
    tessellateCylinder: unused,
    tessellateSphere: unused,
    tessellateCone: unused,
    tessellateTorus: unused,
    tessellateExtrude: unused,
    revolveProfile: unused,
    booleanExtrudes: unused,
    edgeFinish: unused,
    linearPattern: unused,
    circularPattern: unused,
    mirror: unused,
    shell: unused,
    sweep: unused,
    loft: unused,
    exactBodyMetadata: unused,
    exactTopologyCheckpointPayload: unused,
    importStep: unused,
    hole: unused,
    cancelModelWork() {
      return 0;
    },
    resumeModelWork() {
      return 0;
    },
    getModelWorkSnapshot() {
      return {
        generation: 0,
        stopped: false,
        active: false,
        queuedCount: 0,
        cancelledUserKinds: []
      };
    },
    subscribeModelWork() {
      return () => undefined;
    },
    dispose() {}
  };
}

function createArtifact(
  input: DerivedExactBodyArtifactInput,
  index: number
): GeometryKernelExactBodyArtifact {
  const brepBytes = new Uint8Array([index]);
  const sourceKind = input.source
    .kind as GeometryKernelExactBodyArtifact["sourceKind"];
  return {
    artifactVersion: "partbench.exact-body-artifact.v1",
    bodyId: input.bodyId,
    sourceType: input.sourceType,
    documentSourceIdentity: input.documentSourceIdentity,
    bodySourceIdentitySignature: input.bodySourceIdentitySignature,
    sourceCacheKeySha256: input.sourceCacheKeySha256,
    sourceGraphNodeCount: input.sourceGraphNodeCount,
    units: input.units,
    shapePolicy: input.shapePolicy,
    sourceKind,
    brepFormat: "occt-brep",
    brepWriter: "BRepTools.Write_3",
    brepBytes,
    brepByteLength: brepBytes.byteLength,
    brepSha256: sha256Hex(brepBytes),
    metadata: {
      sourceKind,
      bounds: { min: [0, 0, 0], max: [1, 1, 1] },
      volume: 1,
      surfaceArea: 6,
      centroid: [0.5, 0.5, 0.5],
      topologyCounts: {
        solidCount: 1,
        faceCount: 0,
        edgeCount: 0,
        vertexCount: 0
      },
      measurementSource: "kernel-derived",
      measurementConfidence: "kernel-derived",
      diagnostics: []
    },
    topologySnapshot: {
      sourceKind,
      status: "ready",
      entityCounts: {
        bodyCount: 1,
        solidCount: 1,
        faceCount: 0,
        wireCount: 0,
        loopCount: 0,
        coedgeCount: 0,
        edgeCount: 0,
        vertexCount: 0,
        axisCount: 0
      },
      entityCount: 0,
      entities: [],
      unsupportedEntityKinds: [],
      adjacencyAvailable: false,
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
      signature: `topology:${input.bodyId}`,
      source: "kernel-derived",
      diagnostics: []
    },
    displayMesh: {
      primitive: "extrude",
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      indices: new Uint32Array([0, 1, 2]),
      vertexCount: 3,
      triangleCount: 1,
      faceCount: 1
    }
  };
}

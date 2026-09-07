import { expect, it, vi } from "vitest";
import {
  executeGeometryKernelExactBodyDataArtifactRequest,
  executeGeometryKernelRequest,
  type ExactBodyArtifactRequest
} from "./index";
import { executeGeometryKernelExactBodyDataArtifactWithFactory } from "./kernel";

const request: ExactBodyArtifactRequest = {
  id: "headless-artifact",
  version: "geometry-kernel.v1",
  op: "geometry.exactBodyArtifact",
  bodyId: "body",
  sourceType: "primitiveFeature",
  documentSourceIdentity: {
    algorithm: "partbench-source-v1",
    sha256: "a".repeat(64)
  },
  bodySourceIdentitySignature: `body-topology-source:v1:${"b".repeat(64)}`,
  sourceCacheKeySha256: "c".repeat(64),
  sourceGraphNodeCount: 1,
  units: "mm",
  shapePolicy: "singleSolid",
  source: {
    kind: "box",
    dimensions: { width: 60, height: 40, depth: 8 },
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  }
};

it("uses identical validated exact evidence for displayed and headless hosts", async () => {
  const data = await executeGeometryKernelExactBodyDataArtifactRequest(request);
  const displayed = await executeGeometryKernelRequest(request);
  if (!data.ok) throw new Error(data.error.message);
  if (!displayed.ok) throw new Error(displayed.error.message);
  expect(data.artifact).not.toHaveProperty("displayMesh");
  expect(data.artifact).not.toHaveProperty("viewportPickMap");
  expect(displayed.artifact).toMatchObject(data.artifact);
  expect(data.artifact.metadata.volume).toBeCloseTo(60 * 40 * 8, 8);

  const corrupted = await executeGeometryKernelExactBodyDataArtifactRequest({
    ...request,
    source: {
      ...data.artifact,
      kind: "bodyArtifact",
      topologySignature: data.artifact.topologySnapshot.signature,
      brepSha256: "d".repeat(64)
    }
  });
  expect(corrupted).toMatchObject({
    ok: false,
    error: { code: "INVALID_DIMENSIONS" }
  });
}, 120_000);

it("rejects invalid requests before evaluating geometry and invalid exact results afterward", async () => {
  const factory = vi.fn(async () => {
    const response =
      await executeGeometryKernelExactBodyDataArtifactRequest(request);
    if (!response.ok) throw new Error(response.error.message);
    return {
      ...response.artifact,
      metadata: { ...response.artifact.metadata, volume: Number.NaN }
    };
  });
  const invalidInput =
    await executeGeometryKernelExactBodyDataArtifactWithFactory(factory, {
      ...request,
      sourceGraphNodeCount: 0
    });
  expect(invalidInput).toMatchObject({
    ok: false,
    error: { code: "INVALID_DIMENSIONS" }
  });
  expect(factory).not.toHaveBeenCalled();
  const invalidResult =
    await executeGeometryKernelExactBodyDataArtifactWithFactory(
      factory,
      request
    );
  expect(invalidResult).toMatchObject({
    ok: false,
    error: { code: "INVALID_RESULT" }
  });
}, 120_000);

import { describe, expect, it } from "vitest";

import { createDerivedGeometryRuntime } from "./derivedGeometryRuntime.browser";

const input = {
  id: "v21_runtime_artifact",
  bodyId: "body_box",
  sourceType: "primitiveFeature",
  documentSourceIdentity: {
    algorithm: "partbench-source-v1" as const,
    sha256: "a".repeat(64)
  },
  bodySourceIdentitySignature: `body-topology-source:v1:${"b".repeat(64)}`,
  sourceCacheKeySha256: "c".repeat(64),
  sourceGraphNodeCount: 1,
  units: "mm" as const,
  shapePolicy: "singleSolid" as const,
  source: {
    kind: "box" as const,
    dimensions: { width: 2, height: 3, depth: 4 },
    transform: {
      translation: [0, 0, 0] as const,
      rotation: [0, 0, 0] as const,
      scale: [1, 1, 1] as const
    }
  }
};

describe("V21 exact body artifact runtime", () => {
  it("rejects artifact work after deterministic disposal", async () => {
    const runtime = createDerivedGeometryRuntime();
    runtime.dispose();
    await expect(runtime.exactBodyArtifact(input)).rejects.toThrow(/disposed/i);
  });

  it("cancels queued artifact work without returning a partial artifact", async () => {
    const runtime = createDerivedGeometryRuntime();
    runtime.cancelModelWork("V21 artifact cancelled.");
    await expect(runtime.exactBodyArtifact(input)).rejects.toThrow(
      /stopped|cancelled/i
    );
    expect(runtime.getModelWorkSnapshot()).toMatchObject({
      stopped: true,
      active: false
    });
    runtime.dispose();
  });
});

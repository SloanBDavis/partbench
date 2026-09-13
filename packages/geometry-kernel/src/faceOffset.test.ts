import { expect, it } from "vitest";
import { executeGeometryKernelRequest } from "./index";
import type { ExactBodyArtifactRequest } from "./kernel";

it("evaluates a verified shared face-offset artifact through the ordinary geometry request", async () => {
  const base: ExactBodyArtifactRequest = {
    id: "offset-base",
    version: "geometry-kernel.v1",
    op: "geometry.exactBodyArtifact",
    bodyId: "offset-base",
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
      dimensions: { width: 2, height: 3, depth: 4 },
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      }
    }
  };
  const initial = await executeGeometryKernelRequest(base);
  if (!initial.ok) throw new Error(initial.error.message);
  const face = initial.artifact.topologySnapshot.entities.find(
    (entity) => entity.kind === "face"
  )!;
  const edited = await executeGeometryKernelRequest({
    ...base,
    id: "offset-edit",
    bodyId: "offset-edit",
    sourceType: "faceOffsetFeature",
    sourceGraphNodeCount: 2,
    source: {
      kind: "faceOffset",
      target: {
        ...initial.artifact,
        kind: "bodyArtifact",
        topologySignature: initial.artifact.topologySnapshot.signature
      },
      checkpointEntityId: face.localId,
      distance: 0.5
    }
  });
  if (!edited.ok) throw new Error(edited.error.message);
  expect(edited.artifact.sourceKind).toBe("faceOffset");
  expect(edited.artifact.metadata.volume).toBeCloseTo(
    initial.artifact.metadata.volume + face.area! * 0.5,
    7
  );
  expect(edited.artifact.viewportPickMap?.faces.length).toBe(6);
  const cut = await executeGeometryKernelRequest({
    ...base,
    id: "offset-cut",
    bodyId: "offset-cut",
    sourceType: "sketchExtrudeFeature",
    sourceGraphNodeCount: 3,
    source: {
      kind: "artifactBoolean",
      target: {
        ...edited.artifact,
        kind: "bodyArtifact",
        topologySignature: edited.artifact.topologySnapshot.signature
      },
      operation: "cut",
      tool: {
        sketchPlane: "XY",
        profile: {
          kind: "circle",
          center: [
            edited.artifact.metadata.centroid[0],
            edited.artifact.metadata.centroid[1]
          ],
          radius: 0.25
        },
        placementFrame: {
          origin: [0, 0, edited.artifact.metadata.bounds.max[2]],
          uAxis: [1, 0, 0],
          vAxis: [0, 1, 0]
        },
        depth: 0.5,
        side: "negative"
      }
    }
  });
  if (!cut.ok) throw new Error(cut.error.message);
  expect(cut.artifact.metadata.volume).toBeCloseTo(
    edited.artifact.metadata.volume - Math.PI * 0.25 ** 2 * 0.5,
    6
  );
}, 120_000);

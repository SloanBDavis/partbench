import { expect, it } from "vitest";
import {
  createOcctExactBodyArtifactWithInstance,
  createOcctExactBodyDataArtifactWithInstance,
  createOcctExactTopologyCheckpointPayloadWithInstance,
  loadOcct,
  type OcctExactBodyArtifactInput
} from "./index";

it("preserves exact evidence while headless artifacts and checkpoints never mesh", async () => {
  const oc = await loadOcct();
  const withoutDisplay = new Proxy(oc, {
    get(target, key) {
      if (
        key === "BRepMesh_IncrementalMesh_2" ||
        key === "GCPnts_TangentialDeflection_3"
      ) {
        throw new Error("Headless geometry requested viewport work.");
      }
      return Reflect.get(target, key);
    }
  });
  const transform = {
    translation: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
  } as const;
  const sources: OcctExactBodyArtifactInput["source"][] = [
    { kind: "box", dimensions: { width: 60, height: 40, depth: 8 }, transform },
    { kind: "cylinder", dimensions: { radius: 30, height: 40 }, transform }
  ];
  for (const source of sources) {
    const displayed = createOcctExactBodyArtifactWithInstance(oc, { source });
    const data = createOcctExactBodyDataArtifactWithInstance(withoutDisplay, {
      source
    });
    expect(data).not.toHaveProperty("displayMesh");
    expect(data).not.toHaveProperty("viewportPickMap");
    expect(displayed.displayMesh.triangleCount).toBeGreaterThan(0);
    expect(data.brepBytes).toEqual(displayed.brepBytes);
    expect(data.metadata).toEqual(displayed.metadata);
    expect(data.topologySnapshot).toEqual(displayed.topologySnapshot);
    const checkpoint = createOcctExactTopologyCheckpointPayloadWithInstance(
      withoutDisplay,
      { source, checkpointId: "checkpoint", bodyId: "body" }
    );
    expect(checkpoint.brepBytes).toEqual(data.brepBytes);
    expect(checkpoint.topologySnapshot).toEqual(data.topologySnapshot);
  }
}, 120_000);

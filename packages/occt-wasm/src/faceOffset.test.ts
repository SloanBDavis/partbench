import { describe, expect, it } from "vitest";
import { loadOcct } from "./index";
import {
  createOcctExactBodyDataArtifactWithInstance,
  type OcctCheckpointBodyArtifactSource
} from "./exactCheckpointPayload";
import { createOcctStepImportWithInstance } from "./stepImport";
import { createOcctStepExportWithInstance } from "./exactStepExport";

describe("shared exact face offsets", () => {
  it("moves an arbitrarily oriented planar face on an exact imported body and rejects removal", async () => {
    const oc = await loadOcct();
    const box = createOcctExactBodyDataArtifactWithInstance(oc, {
      source: {
        kind: "box",
        dimensions: { width: 2, height: 3, depth: 4 },
        transform: {
          translation: [10, 20, 30],
          rotation: [20, 30, 40],
          scale: [1, 1, 1]
        }
      }
    });
    const artifact = createOcctStepExportWithInstance(oc, {
      units: "mm",
      bodies: [{ ...box, bodyId: "box", bodyName: "Box", brepSha256: "" }]
    });
    const imported = createOcctStepImportWithInstance(oc, {
      sourceFileName: "box.step",
      bytes: artifact.bytes
    }).bodies[0]!;
    const checkpoint: OcctCheckpointBodyArtifactSource = {
      kind: "checkpointBody",
      ...imported.checkpointPayload,
      topologySourceKind: "importedBody",
      topologySignature: imported.topologySnapshot.signature,
      brepSha256: ""
    };
    const face = imported.topologySnapshot.entities.find(
      (entity) => entity.kind === "face"
    )!;
    const beforeVolume = box.metadata.volume;
    const changed = createOcctExactBodyDataArtifactWithInstance(oc, {
      source: {
        kind: "faceOffset",
        target: checkpoint,
        checkpointEntityId: face.localId,
        distance: 1
      }
    });
    expect(changed.sourceKind).toBe("faceOffset");
    expect(changed.metadata.volume).toBeCloseTo(beforeVolume + face.area!, 6);
    expect(changed.topologySnapshot.entityCounts.solidCount).toBe(1);
    expect(changed.topologySnapshot.entityCounts.faceCount).toBe(6);
    expect(() =>
      createOcctExactBodyDataArtifactWithInstance(oc, {
        source: {
          kind: "faceOffset",
          target: checkpoint,
          checkpointEntityId: face.localId,
          distance: -20
        }
      })
    ).toThrow(/remove|retain/);
  }, 120_000);

  it("resizes a seam-split cylindrical bore on exact BRep and supports another edit after STEP roundtrip", async () => {
    const oc = await loadOcct();
    const outer = new oc.BRepPrimAPI_MakeCylinder_1(5, 10);
    const inner = new oc.BRepPrimAPI_MakeCylinder_1(2, 10);
    const outerShape = outer.Shape();
    const innerShape = inner.Shape();
    const progress = new oc.Message_ProgressRange_1();
    const cut = new oc.BRepAlgoAPI_Cut_3(outerShape, innerShape, progress);
    const unsegmented = cut.Shape();
    const divide = new oc.ShapeUpgrade_ShapeDivideClosed(unsegmented);
    divide.SetNbSplitPoints(1);
    divide.Perform(true);
    const shape = divide.Result();
    const filename = "/tmp/face-offset-bore.brep";
    try {
      oc.BRepTools.Write_3(shape, filename, progress);
      const source = createOcctExactBodyDataArtifactWithInstance(oc, {
        source: { kind: "importedBody", brepBytes: oc.FS.readFile(filename) }
      });
      const checkpoint: OcctCheckpointBodyArtifactSource = {
        kind: "checkpointBody",
        ...source,
        topologySourceKind: "importedBody",
        topologySignature: source.topologySnapshot.signature,
        brepSha256: ""
      };
      expect(
        source.topologySnapshot.entities.filter(
          (entity) =>
            entity.kind === "face" &&
            entity.surfaceClass === "cylinder" &&
            entity.radius === 2
        )
      ).toHaveLength(2);
      const bore = source.topologySnapshot.entities.find(
        (entity) =>
          entity.kind === "face" &&
          entity.surfaceClass === "cylinder" &&
          entity.radius === 2
      )!;
      const changed = createOcctExactBodyDataArtifactWithInstance(oc, {
        source: {
          kind: "faceOffset",
          target: checkpoint,
          checkpointEntityId: bore.localId,
          distance: -1
        }
      });
      expect(changed.metadata.volume).toBeCloseTo(Math.PI * (25 - 9) * 10, 6);
      expect(
        changed.topologySnapshot.entities.some(
          (entity) =>
            entity.kind === "face" &&
            entity.surfaceClass === "cylinder" &&
            Math.abs(entity.radius! - 3) < 1e-7
        )
      ).toBe(true);
      const output = createOcctStepExportWithInstance(oc, {
        units: "mm",
        bodies: [
          { ...changed, bodyId: "tube", bodyName: "Bored part", brepSha256: "" }
        ]
      });
      const imported = createOcctStepImportWithInstance(oc, {
        bytes: output.bytes,
        sourceFileName: "changed.step"
      }).bodies[0]!;
      const newBore = imported.topologySnapshot.entities.find(
        (entity) =>
          entity.kind === "face" &&
          entity.surfaceClass === "cylinder" &&
          Math.abs(entity.radius! - 3) < 1e-7
      )!;
      const revised = createOcctExactBodyDataArtifactWithInstance(oc, {
        source: {
          kind: "faceOffset",
          target: {
            kind: "checkpointBody",
            ...imported.checkpointPayload,
            topologySourceKind: "importedBody",
            topologySignature: imported.topologySnapshot.signature,
            brepSha256: ""
          },
          checkpointEntityId: newBore.localId,
          distance: 0.5
        }
      });
      expect(revised.metadata.volume).toBeCloseTo(
        Math.PI * (25 - 6.25) * 10,
        6
      );
    } finally {
      oc.FS.unlink(filename);
      shape.delete();
      divide.delete();
      unsegmented.delete();
      cut.delete();
      progress.delete();
      innerShape.delete();
      outerShape.delete();
      inner.delete();
      outer.delete();
    }
  }, 120_000);
});

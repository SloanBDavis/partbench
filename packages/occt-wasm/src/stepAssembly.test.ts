import { describe, expect, it } from "vitest";
import { loadOcct } from "./index";
import { createOcctExactBodyArtifactWithInstance } from "./exactCheckpointPayload";
import { createOcctExactBodyMetadataWithInstance } from "./exactMetadata";
import { createOcctStepExportWithInstance } from "./exactStepExport";
import { createOcctStepImportWithInstance } from "./stepImport";
import {
  OCCT_STEP_IDENTITY_PLACEMENT as identity,
  type OcctStepAssembly
} from "./stepAssembly";

describe("editable STEP assembly exchange", () => {
  it("keeps a multi-solid part together and rejects limits before topology extraction", async () => {
    const oc = await loadOcct();
    const compound = new oc.TopoDS_Compound();
    const builder = new oc.BRep_Builder();
    const first = new oc.BRepPrimAPI_MakeBox_2(2, 3, 4);
    const second = new oc.BRepPrimAPI_MakeBox_2(1, 1, 1);
    const firstShape = first.Shape();
    const secondShape = second.Shape();
    const progress = new oc.Message_ProgressRange_1();
    const filename = "/tmp/step-assembly-test-compound.brep";
    try {
      builder.MakeCompound(compound);
      builder.Add(compound, firstShape);
      builder.Add(compound, secondShape);
      expect(oc.BRepTools.Write_3(compound, filename, progress)).toBe(true);
      const brepBytes = oc.FS.readFile(filename);
      const body = {
        bodyId: "multi",
        bodyName: "Two-solid part",
        brepFormat: "occt-brep" as const,
        brepByteLength: brepBytes.byteLength,
        brepBytes,
        brepSha256: ""
      };
      const artifact = createOcctStepExportWithInstance(oc, {
        units: "mm",
        bodies: [body]
      });
      const imported = createOcctStepImportWithInstance(oc, {
        bytes: artifact.bytes,
        sourceFileName: "compound.step",
        maxBodyCount: 1
      });
      expect(imported.bodyCount).toBe(1);
      expect(imported.bodies[0]?.solidCount).toBe(2);
      expect(imported.bodies[0]?.shapeType).toBe("compound");
      expect(imported.assembly?.occurrenceCount).toBe(1);

      const multiple = createOcctStepExportWithInstance(oc, {
        units: "mm",
        bodies: [body, { ...body, bodyId: "another", bodyName: "Another part" }]
      });
      let topologyCalls = 0;
      const noTopology = new Proxy(oc, {
        get(target, key) {
          if (key === "BRepCheck_Analyzer")
            return class {
              constructor() {
                topologyCalls++;
                throw new Error("Limit checked too late");
              }
            };
          return Reflect.get(target, key);
        }
      });
      expect(() =>
        createOcctStepImportWithInstance(noTopology, {
          bytes: multiple.bytes,
          sourceFileName: "too-many.step",
          maxBodyCount: 1
        })
      ).toThrow(/part definitions.*maxBodyCount/);
      expect(topologyCalls).toBe(0);
    } finally {
      oc.FS.unlink(filename);
      progress.delete();
      secondShape.delete();
      firstShape.delete();
      second.delete();
      first.delete();
      builder.delete();
      compound.delete();
    }
  }, 120_000);

  it("preserves nested repeated parts, names, colors, placements and mixed document units", async () => {
    const oc = await loadOcct();
    const exact = createOcctExactBodyArtifactWithInstance(oc, {
      source: {
        kind: "box",
        dimensions: { width: 2, depth: 3, height: 4 },
        transform: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      }
    });
    const assembly: OcctStepAssembly = {
      definitions: [
        {
          id: "pair",
          name: "Pair Ω",
          components: [
            {
              id: "one",
              definitionId: "part",
              name: "First part",
              transform: identity
            },
            {
              id: "two",
              definitionId: "part",
              name: "Rotated part",
              transform: [0, -1, 0, 10, 1, 0, 0, 0, 0, 0, 1, 0],
              color: [0.1, 0.2, 0.3]
            }
          ]
        },
        {
          id: "root",
          name: "Engine",
          components: [
            {
              id: "pair-one",
              definitionId: "pair",
              name: "Pair left",
              transform: identity
            },
            {
              id: "pair-two",
              definitionId: "pair",
              name: "Pair right",
              transform: [1, 0, 0, 25, 0, 1, 0, 0, 0, 0, 1, 0]
            }
          ]
        }
      ],
      roots: [
        {
          id: "engine",
          definitionId: "root",
          name: "Engine",
          transform: identity
        }
      ],
      occurrenceCount: 4
    };
    const artifact = createOcctStepExportWithInstance(oc, {
      units: "cm",
      assembly,
      bodies: [
        {
          bodyId: "part",
          bodyName: "Piston Ω",
          color: [0.3, 0.4, 0.5],
          brepFormat: "occt-brep",
          brepByteLength: exact.brepByteLength,
          brepSha256: "",
          brepBytes: exact.brepBytes
        }
      ]
    });
    const imported = createOcctStepImportWithInstance(oc, {
      bytes: artifact.bytes,
      sourceFileName: "engine.step",
      units: "mm",
      maxBodyCount: 1
    });
    expect(imported.bodyCount).toBe(1);
    expect(imported.assembly?.occurrenceCount).toBe(4);
    expect(imported.assembly?.definitions).toHaveLength(2);
    expect(imported.bodies[0]?.bodyName).toBe("Piston Ω");
    expect(imported.bodies[0]?.color?.[0]).toBeCloseTo(0.3, 5);
    const pair = imported.assembly!.definitions.find(
      (item) => item.name === "Pair Ω"
    )!;
    expect(pair.components.map((item) => item.name)).toEqual([
      "First part",
      "Rotated part"
    ]);
    expect(pair.components[0]?.definitionId).toBe(
      pair.components[1]?.definitionId
    );
    expect(pair.components[1]?.transform[3]).toBeCloseTo(100, 7);
    expect(pair.components[1]?.transform[1]).toBeCloseTo(-1, 7);
    expect(pair.components[1]?.color?.[1]).toBeCloseTo(0.2, 5);
    const bounds = imported.bodies[0]!.bounds;
    expect(bounds.max[0] - bounds.min[0]).toBeCloseTo(20, 6);
    const exportedAgain = createOcctStepExportWithInstance(oc, {
      units: "mm",
      assembly: imported.assembly,
      bodies: imported.bodies.map((body) => ({
        ...body.checkpointPayload,
        bodyId: body.definitionId,
        bodyName: body.bodyName!,
        color: body.color,
        brepSha256: ""
      }))
    });
    const reopened = createOcctStepImportWithInstance(oc, {
      bytes: exportedAgain.bytes,
      sourceFileName: "reopened.step",
      units: "in"
    });
    expect(reopened.assembly?.occurrenceCount).toBe(4);
    expect(reopened.assembly?.definitions).toHaveLength(2);
    const reopenedPair = reopened.assembly!.definitions.find(
      (item) => item.name === "Pair Ω"
    )!;
    expect(reopenedPair.components[1]?.transform[3]).toBeCloseTo(100 / 25.4, 7);
    const metadata = createOcctExactBodyMetadataWithInstance(oc, {
      source: {
        kind: "importedBody",
        brepBytes: reopened.bodies[0]!.checkpointPayload.brepBytes
      }
    });
    expect(metadata.volume).toBeCloseTo(24_000 / 25.4 ** 3, 7);
  }, 120_000);
});

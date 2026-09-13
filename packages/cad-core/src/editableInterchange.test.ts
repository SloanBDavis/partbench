import { describe, expect, it } from "vitest";
import { CadEngine, exportCadProjectJson, importCadProjectJson } from "./index";
import type { CadPlanarFrame } from "@web-cad/cad-protocol";

const frame: CadPlanarFrame = {
  origin: [4, 5, 6],
  xDirection: [1, 0, 0],
  yDirection: [0, Math.SQRT1_2, Math.SQRT1_2],
  normal: [0, -Math.SQRT1_2, Math.SQRT1_2]
};
function seed(imported: boolean) {
  let engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "s", name: "Plate", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "s",
      id: "r",
      center: [0, 0],
      width: 10,
      height: 8
    },
    {
      op: "feature.extrude",
      id: "f",
      bodyId: "b",
      sketchId: "s",
      entityId: "r",
      depth: 6
    },
    {
      op: "topology.checkpoint.create",
      checkpointId: "c",
      bodyId: "b",
      sourceFeatureId: "f",
      sourceIdentity: {
        algorithm: "partbench-source-v1",
        sha256: "a".repeat(64)
      },
      status: "active"
    },
    {
      op: "topology.anchor.create",
      anchorId: "a",
      entityKind: "face",
      bodyId: "b",
      checkpointId: "c",
      checkpointEntityId: "snapshot-local:face:1",
      sourceFeatureId: "f",
      signatureHash: "fnv1a32:12345678"
    }
  ]);
  if (imported) {
    const document = engine.getDocument();
    engine = new CadEngine({
      ...document,
      features: new Map([
        [
          "f",
          {
            id: "f",
            kind: "importedBody",
            sourceFileName: "plate.step",
            sourceFormat: "step",
            bodyId: "b",
            checkpointId: "c",
            healingApplied: false
          }
        ]
      ])
    });
  }
  return engine;
}

describe("ordinary editable interchange features", () => {
  it.each([false, true])(
    "preserves a general face sketch and signed offset through update, history, and source reopen (imported=%s)",
    (imported) => {
      const engine = seed(imported);
      engine.apply({
        op: "sketch.createOnFace",
        id: "attached",
        name: "Mount",
        topologyAnchorId: "a",
        topologyAnchorProof: {
          kind: "planarFace",
          entityKind: "face",
          evidenceSource: "checkpointSnapshot",
          exposesCheckpointLocalIds: false,
          planeFrame: frame
        }
      });
      expect(
        engine.getDocument().sketches.get("attached")?.attachment
      ).toMatchObject({ planeFrame: frame });
      const result = engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "feature.faceOffset",
            id: "edit",
            bodyId: "edited",
            targetBodyId: "b",
            faceRef: { kind: "topologyAnchor", bodyId: "b", anchorId: "a" },
            distance: -1
          }
        ]
      });
      expect(result).toMatchObject({ ok: true });
      expect(engine.getDocument().features.get("edit")).toMatchObject({
        kind: "offset",
        targetBodyId: "b",
        source: { kind: "directFace" },
        distance: 1,
        side: "inward"
      });
      engine.apply({ op: "feature.updateFaceOffset", id: "edit", distance: 2 });
      expect(engine.getDocument().features.get("edit")).toMatchObject({
        distance: 2,
        side: "outward"
      });
      engine.undo();
      expect(engine.getDocument().features.get("edit")).toMatchObject({
        distance: 1,
        side: "inward"
      });
      engine.redo();
      const reopened = importCadProjectJson(exportCadProjectJson(engine));
      expect(
        reopened.getDocument().sketches.get("attached")?.attachment
      ).toMatchObject({ planeFrame: frame });
      reopened.apply({
        op: "feature.updateFaceOffset",
        id: "edit",
        distance: -0.5
      });
      expect(reopened.getDocument().features.get("edit")).toMatchObject({
        distance: 0.5,
        side: "inward"
      });
      expect(
        reopened.executeBatch({
          version: "cadops.v1",
          mode: "commit",
          ops: [{ op: "feature.updateFaceOffset", id: "edit", distance: 0 }]
        })
      ).toMatchObject({ ok: false });
      expect(reopened.getDocument().features.get("edit")).toMatchObject({
        distance: 0.5
      });
    }
  );

  it("keeps repeated assembly occurrences attached to ordinary feature results through undo and redo", () => {
    const engine = seed(true);
    engine.applyBatch([
      { op: "assembly.create", id: "assembly", name: "Pair" },
      {
        op: "assembly.instance.insert",
        assemblyId: "assembly",
        id: "first",
        definition: { kind: "body", bodyId: "b" }
      },
      {
        op: "assembly.instance.insert",
        assemblyId: "assembly",
        id: "second",
        definition: { kind: "body", bodyId: "b" },
        transform: { translation: [20, 0, 0] }
      }
    ]);
    const definitions = () =>
      engine
        .getDocument()
        .assemblies.get("assembly")!
        .instances.map((instance) => instance.definition);
    engine.apply({
      op: "feature.faceOffset",
      id: "edit",
      bodyId: "edited",
      targetBodyId: "b",
      faceRef: { kind: "topologyAnchor", bodyId: "b", anchorId: "a" },
      distance: -1
    });
    expect(definitions()).toEqual([
      { kind: "body", bodyId: "edited" },
      { kind: "body", bodyId: "edited" }
    ]);
    expect(
      engine.getDocument().assemblies.get("assembly")!.instances[1]!.transform
        .translation
    ).toEqual([20, 0, 0]);
    engine.undo();
    expect(definitions()).toEqual([
      { kind: "body", bodyId: "b" },
      { kind: "body", bodyId: "b" }
    ]);
    engine.redo();
    expect(definitions()).toEqual([
      { kind: "body", bodyId: "edited" },
      { kind: "body", bodyId: "edited" }
    ]);
    engine.apply({ op: "feature.delete", id: "edit" });
    expect(definitions()).toEqual([
      { kind: "body", bodyId: "b" },
      { kind: "body", bodyId: "b" }
    ]);
    const before = exportCadProjectJson(engine);
    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "assembly.instance.insert",
            assemblyId: "assembly",
            id: "invalid",
            definition: { kind: "body", bodyId: "b" },
            color: [1, 2, 0]
          }
        ]
      })
    ).toMatchObject({ ok: false });
    expect(exportCadProjectJson(engine)).toBe(before);
  });

  it("copies an exact base independently with new checkpoint ownership and native replay", () => {
    const engine = seed(true);
    engine.apply({
      op: "feature.copyBody",
      id: "copy_feature",
      bodyId: "copy_body",
      sourceBodyId: "b",
      sourceCheckpointId: "c",
      checkpointId: "copy_checkpoint"
    });
    expect(engine.getDocument().features.get("copy_feature")).toMatchObject({
      kind: "importedBody",
      sourceFormat: "brep",
      bodyId: "copy_body",
      checkpointId: "copy_checkpoint"
    });
    expect(engine.getDocument().features.get("f")).toMatchObject({
      bodyId: "b",
      sourceFormat: "step"
    });
    expect(
      engine
        .getDocument()
        .topologyIdentity?.checkpoints.find(
          (checkpoint) => checkpoint.checkpointId === "copy_checkpoint"
        )
    ).toMatchObject({
      bodyId: "copy_body",
      sourceFeatureId: "copy_feature",
      status: "active"
    });
    engine.undo();
    expect(engine.getDocument().features.has("copy_feature")).toBe(false);
    engine.redo();
    const reopened = importCadProjectJson(exportCadProjectJson(engine));
    expect(reopened.getDocument().features.get("copy_feature")).toMatchObject({
      sourceFormat: "brep",
      checkpointId: "copy_checkpoint"
    });
    expect(
      reopened.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "feature.copyBody",
            sourceBodyId: "b",
            sourceCheckpointId: "missing"
          }
        ]
      })
    ).toMatchObject({ ok: false });
  });

  it("rejects invalid face frames before committing source", () => {
    const engine = seed(false);
    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "sketch.createOnFace",
            id: "bad",
            name: "Bad frame",
            topologyAnchorId: "a",
            topologyAnchorProof: {
              kind: "planarFace",
              entityKind: "face",
              evidenceSource: "checkpointSnapshot",
              exposesCheckpointLocalIds: false,
              planeFrame: { ...frame, normal: [1, 0, 0] }
            }
          }
        ]
      })
    ).toMatchObject({ ok: false });
    expect(engine.getDocument().sketches.has("bad")).toBe(false);
  });
});

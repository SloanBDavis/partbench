import { describe, expect, it } from "vitest";
import {
  CadEngine,
  resolveAssemblyOccurrence,
  sha256Hex
} from "@web-cad/cad-core";
import type { CadOp } from "@web-cad/cad-protocol";
import { prepareIndependentOccurrence } from "./shared/independentOccurrence";
import type { CurrentExactBodyArtifactEvidence } from "./shared/currentExactBodyResolver";

function fixture() {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "profile", name: "Profile", plane: "XY" },
    {
      op: "sketch.addCircle",
      sketchId: "profile",
      id: "circle",
      center: [0, 0],
      radius: 1
    },
    {
      op: "feature.extrude",
      id: "source_feature",
      bodyId: "source_body",
      sketchId: "profile",
      entityId: "circle",
      depth: 2
    },
    { op: "assembly.create", id: "root" },
    { op: "assembly.create", id: "shared" },
    {
      op: "assembly.instance.insert",
      assemblyId: "shared",
      id: "leaf",
      definition: { kind: "body", bodyId: "source_body" }
    },
    {
      op: "assembly.mate.create",
      assemblyId: "shared",
      id: "ground",
      kind: "fixed",
      instanceId: "leaf"
    },
    {
      op: "assembly.instance.insert",
      assemblyId: "root",
      id: "left",
      definition: { kind: "assembly", assemblyId: "shared" }
    },
    {
      op: "assembly.instance.insert",
      assemblyId: "root",
      id: "right",
      definition: { kind: "assembly", assemblyId: "shared" }
    }
  ]);
  const bytes = new TextEncoder().encode("namespace allocation fixture");
  // This unit test exercises ID allocation and document transactions only;
  // the real exact artifact/copy round trip is covered by interchange.test.ts.
  const artifact = {
    bodyId: "source_body",
    units: "mm",
    brepBytes: bytes,
    brepByteLength: bytes.byteLength,
    brepSha256: sha256Hex(bytes),
    topologySnapshot: {
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
      signature: "namespace-fixture",
      entityCount: 0,
      entities: []
    }
  } as unknown as CurrentExactBodyArtifactEvidence;
  return {
    engine,
    artifact,
    bodyId: `body_${engine.createSnapshot().nextBodyNumber}`
  };
}

describe("independent occurrence namespace allocation", () => {
  it.each([false, true])(
    "retains normal IDs and avoids reserved IDs when collisions=%s",
    (collisions) => {
      const { engine, artifact, bodyId } = fixture();
      if (collisions) {
        const sourceIdentity = {
          algorithm: "partbench-source-v1" as const,
          sha256: artifact.brepSha256
        };
        engine.applyBatch([
          {
            op: "topology.checkpoint.create",
            checkpointId: `checkpoint_${bodyId}`,
            bodyId: "source_body",
            sourceFeatureId: "source_feature",
            sourceIdentity,
            status: "stale"
          },
          {
            op: "topology.checkpoint.create",
            checkpointId: `checkpoint_copy_source_${bodyId}`,
            bodyId: "source_body",
            sourceFeatureId: "source_feature",
            sourceIdentity,
            status: "stale"
          },
          {
            op: "assembly.create",
            id: `${bodyId}_assembly_0`,
            name: "Existing unrelated assembly"
          },
          {
            op: "assembly.instance.insert",
            assemblyId: `${bodyId}_assembly_0`,
            id: `${bodyId}_instance_0_0`,
            definition: { kind: "body", bodyId: "source_body" }
          },
          {
            op: "assembly.mate.create",
            assemblyId: `${bodyId}_assembly_0`,
            id: `${bodyId}_assembly_0_2_mate_0`,
            kind: "fixed",
            instanceId: `${bodyId}_instance_0_0`
          }
        ]);
      }
      const before = engine.exportProject();
      const prepared = prepareIndependentOccurrence({
        engine,
        artifact,
        rootAssemblyId: "root",
        instancePath: ["left", "leaf"]
      });
      expect(engine.exportProject()).toEqual(before);
      const suffix = collisions ? "_2" : "";
      const assemblyId = `${bodyId}_assembly_0${suffix}`;
      const clonedInstance = `${bodyId}_instance_0_0${suffix}`;
      expect(prepared.bodyId).toBe(bodyId);
      expect(prepared.instancePath).toEqual(["left", clonedInstance]);
      expect(
        prepared.checkpointPayloads.map((payload) => payload.checkpointId)
      ).toEqual([
        `checkpoint_copy_source_${bodyId}${suffix}`,
        `checkpoint_${bodyId}${suffix}`
      ]);
      expect(
        prepared.ops.find((op) => op.op === "assembly.create")
      ).toMatchObject({ id: assemblyId });
      expect(
        prepared.ops.find((op) => op.op === "assembly.mate.create")
      ).toMatchObject({
        assemblyId,
        id: `${assemblyId}_mate_0${suffix}`,
        instanceId: clonedInstance
      });
      expect(() =>
        engine.applyBatch(prepared.ops as readonly CadOp[])
      ).not.toThrow();
      const assemblies = engine.createSnapshot().assemblies ?? [];
      expect(
        resolveAssemblyOccurrence(assemblies, "root", prepared.instancePath)
          ?.instance.definition
      ).toEqual({ kind: "body", bodyId });
      expect(
        resolveAssemblyOccurrence(assemblies, "root", ["right", "leaf"])
          ?.instance.definition
      ).toEqual({ kind: "body", bodyId: "source_body" });
    }
  );
});

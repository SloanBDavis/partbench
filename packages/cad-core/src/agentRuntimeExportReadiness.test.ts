import { describe, expect, it } from "vitest";
import type { CadBodyDerivedExactMetadataSnapshot } from "@web-cad/cad-protocol";
import { CadEngine } from "./engine";

describe("current exact primitive-profile boolean export readiness", () => {
  it.each(["add", "cut"] as const)(
    "exports a rectangle %s only with current exact evidence",
    (operationMode) => {
      const engine = new CadEngine();
      engine.applyBatch([
        { op: "sketch.create", id: "base_sketch", name: "Base", plane: "XY" },
        {
          op: "sketch.addRectangle",
          sketchId: "base_sketch",
          id: "base_profile",
          center: [0, 0],
          width: 20,
          height: 10
        },
        {
          op: "feature.extrude",
          id: "base_extrude",
          bodyId: "base",
          sketchId: "base_sketch",
          entityId: "base_profile",
          depth: 4
        },
        { op: "sketch.create", id: "tool_sketch", name: "Tool", plane: "XY" },
        {
          op: "sketch.addRectangle",
          sketchId: "tool_sketch",
          id: "tool_profile",
          center: [0, 0],
          width: 4,
          height: 2
        },
        {
          op: "feature.extrude",
          id: "result_extrude",
          bodyId: "result",
          sketchId: "tool_sketch",
          entityId: "tool_profile",
          depth: 2,
          side: operationMode === "add" ? "negative" : "positive",
          operationMode,
          targetBodyId: "base"
        }
      ]);
      const topology = engine.executeQuery({
        version: "cadops.v1",
        query: { query: "body.topology", bodyId: "result" }
      });
      if (!topology.ok || topology.query !== "body.topology")
        throw new Error("Missing source topology.");
      const entities = (
        [
          ["body", 1],
          ["solid", 1],
          ["face", 11],
          ["edge", 24],
          ["vertex", 16]
        ] as const
      ).flatMap(([kind, count]) =>
        Array.from({ length: count }, (_, index) => ({
          localId: `snapshot-local:${kind}:${index + 1}`,
          kind,
          source: "kernel-derived" as const,
          signature: `test:${kind}:${index + 1}`
        }))
      );
      const metadata: CadBodyDerivedExactMetadataSnapshot = {
        bodyId: "result",
        sourceIdentitySignature: topology.topology.sourceIdentity.signature,
        status: "ready",
        metadata: {
          source: "kernel-derived",
          confidence: "kernel-derived",
          bounds: {
            min: [-10, -5, -2],
            max: [10, 5, 4],
            size: [20, 10, 6],
            center: [0, 0, 1]
          },
          volume: operationMode === "add" ? 816 : 784,
          surfaceArea: 1000,
          centroid: [0, 0, 2],
          topologyCounts: {
            solidCount: 1,
            faceCount: 11,
            edgeCount: 24,
            vertexCount: 16
          },
          topologySnapshot: {
            source: "kernel-derived",
            status: "ready",
            entityCounts: {
              bodyCount: 1,
              solidCount: 1,
              faceCount: 11,
              wireCount: 0,
              edgeCount: 24,
              vertexCount: 16,
              loopCount: 0,
              coedgeCount: 0,
              axisCount: 0
            },
            entityCount: entities.length,
            entities,
            unsupportedEntityKinds: [],
            adjacencyAvailable: false,
            signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
            signature: "fnv1a32:00000001",
            diagnostics: []
          },
          diagnostics: []
        }
      };
      const read = (
        derivedExactMetadata: readonly CadBodyDerivedExactMetadataSnapshot[]
      ) =>
        engine.executeQuery({
          version: "cadops.v1",
          query: {
            query: "project.exportExact",
            format: "step",
            bodyIds: ["result"],
            derivedExactMetadata
          }
        });
      expect(read([])).toMatchObject({ ok: true, available: false });
      const ready = read([metadata]);
      if (!ready.ok) throw new Error(JSON.stringify(ready.error));
      expect(ready).toMatchObject({
        ok: true,
        available: true,
        plan: { orderedBodyIds: ["result"], bodies: [{ status: "ready" }] }
      });
      expect(
        read([{ ...metadata, sourceIdentitySignature: "stale-source" }])
      ).toMatchObject({ ok: true, available: false });
    }
  );
});

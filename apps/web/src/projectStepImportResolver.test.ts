import {
  AsyncCadCommandExecutor,
  CadEngine,
  MockCadCommandWorker,
  exportCadProject,
  exportCadProjectJson
} from "@web-cad/cad-core";
import { describe, expect, it, vi } from "vitest";
import type {
  DerivedGeometryRuntime,
  DerivedStepImportInput,
  DerivedStepImportResult
} from "./derivedGeometryRuntime";
import {
  createProjectStepImportPayloadStore,
  createProjectStepImportResolver
} from "./projectStepImportResolver";

describe("projectStepImportResolver", () => {
  it("resolves transient STEP payloads through the derived geometry runtime for cad-core commits", async () => {
    const payloadBytes = new TextEncoder().encode(
      "ISO-10303-21; fake STEP payload"
    );
    const payloadStore = createProjectStepImportPayloadStore();
    const importStep = vi.fn(
      async (input: DerivedStepImportInput): Promise<DerivedStepImportResult> =>
        createStepImportResult(input)
    );
    const engine = new CadEngine();
    const executor = new AsyncCadCommandExecutor(
      engine,
      new MockCadCommandWorker(),
      {
        stepImportResolver: createProjectStepImportResolver({
          getRuntime: () =>
            ({
              importStep
            }) satisfies Pick<DerivedGeometryRuntime, "importStep">,
          payloadStore
        })
      }
    );

    payloadStore.putPayload("step_payload_1", payloadBytes);

    const response = await executor.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "project.importStep",
          sourceFileName: "bracket.step",
          sourceFormat: "step",
          payloadRef: {
            kind: "transient",
            payloadId: "step_payload_1",
            byteLength: payloadBytes.byteLength
          },
          maxBodyCount: 1
        }
      ]
    });
    const project = exportCadProject(engine);
    const json = exportCadProjectJson(engine);

    expect(response).toMatchObject({
      ok: true,
      mode: "commit",
      createdFeatureIds: ["feat_1"],
      createdBodyIds: ["body_1"],
      importedStepCheckpointPayloads: [
        expect.objectContaining({
          checkpointId: "checkpoint_body_1",
          bodyId: "body_1",
          sourceFeatureId: "feat_1"
        })
      ],
      importedStepPreviewBodies: [
        {
          featureId: "feat_1",
          bodyId: "body_1",
          checkpointId: "checkpoint_body_1",
          name: "Imported bracket",
          bounds: {
            min: [0, 0, 0],
            max: [4, 2, 1],
            size: [4, 2, 1],
            center: [2, 1, 0.5]
          }
        }
      ],
      importedStepDiagnostics: [
        expect.objectContaining({
          code: "STEP_READER_AVAILABLE",
          featureId: "feat_1",
          bodyId: "body_1",
          checkpointId: "checkpoint_body_1"
        })
      ]
    });
    expect(importStep).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceFileName: "bracket.step",
        bytes: payloadBytes,
        maxBodyCount: 1,
        units: "mm"
      })
    );
    expect(project.document.features).toEqual([
      expect.objectContaining({
        kind: "importedBody",
        bodyId: "body_1",
        checkpointId: "checkpoint_body_1",
        sourceFileName: "bracket.step",
        healingApplied: true
      })
    ]);
    expect(json).toContain("project.importStep");
    expect(json).toContain("bracket.step");
    expect(json).not.toContain("fake STEP payload");
    expect(json).not.toMatch(
      /occtShape|meshId|rendererId|selectionBufferId|fileHandle|localPath|opfsPath/i
    );
  });

  it("prepares multi-body assembly geometry once for dry-run and commit while allocating current document IDs", async () => {
    const bytes = new TextEncoder().encode(
      "ISO-10303-21; prepared assembly fixture"
    );
    const payloadStore = createProjectStepImportPayloadStore();
    const importStep = vi.fn(
      async (
        input: DerivedStepImportInput
      ): Promise<DerivedStepImportResult> => {
        const single = createStepImportResult(input);
        const transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0] as const;
        return {
          ...single,
          bodyCount: 2,
          bodies: [
            {
              ...single.bodies[0]!,
              definitionId: "part_a",
              bodyName: "Bracket"
            },
            { ...single.bodies[0]!, definitionId: "part_b", bodyName: "Pin" }
          ],
          assembly: {
            definitions: [
              {
                id: "module",
                name: "Module",
                components: [
                  {
                    id: "a",
                    definitionId: "part_a",
                    name: "Bracket A",
                    transform
                  },
                  { id: "b", definitionId: "part_b", name: "Pin", transform },
                  {
                    id: "a_again",
                    definitionId: "part_a",
                    name: "Bracket B",
                    transform
                  }
                ]
              }
            ],
            roots: [
              {
                id: "module_root",
                definitionId: "module",
                name: "Module",
                transform
              }
            ],
            occurrenceCount: 3
          }
        };
      }
    );
    const engine = new CadEngine();
    const resolver = createProjectStepImportResolver({
      getRuntime: () => ({ importStep }),
      payloadStore
    });
    const executor = new AsyncCadCommandExecutor(
      engine,
      new MockCadCommandWorker(),
      { stepImportResolver: resolver }
    );
    payloadStore.putPayload("assembly", bytes);
    const ops = [
      {
        op: "project.importStep",
        sourceFileName: "module.step",
        sourceFormat: "step",
        payloadRef: {
          kind: "transient",
          payloadId: "assembly",
          byteLength: bytes.byteLength
        }
      }
    ] as const;
    const before = engine.exportProject();
    expect(
      await executor.executeBatch({ version: "cadops.v1", mode: "dryRun", ops })
    ).toMatchObject({ ok: true, createdBodyIds: ["body_1", "body_2"] });
    expect(engine.exportProject()).toEqual(before);
    engine.applyBatch([
      { op: "sketch.create", id: "existing", name: "Existing", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "existing",
        id: "circle",
        center: [0, 0],
        radius: 1
      },
      {
        op: "feature.extrude",
        id: "feat_1",
        bodyId: "body_1",
        sketchId: "existing",
        entityId: "circle",
        depth: 1
      }
    ]);
    engine.applyBatch([
      {
        op: "assembly.create",
        id: "step_feat_2_assembly_1",
        name: "Existing reserved name"
      },
      {
        op: "topology.checkpoint.create",
        checkpointId: "checkpoint_body_2",
        bodyId: "body_1",
        sourceFeatureId: "feat_1",
        sourceIdentity: {
          algorithm: "partbench-source-v1",
          sha256: "a".repeat(64)
        },
        status: "active"
      }
    ]);
    const committed = await executor.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops
    });
    expect(committed).toMatchObject({
      ok: true,
      createdBodyIds: ["body_2", "body_3"],
      createdFeatureIds: ["feat_2", "feat_3"]
    });
    expect(
      engine
        .createSnapshot()
        .topologyIdentity?.checkpoints.some(
          (checkpoint) => checkpoint.checkpointId === "checkpoint_body_2_2"
        )
    ).toBe(true);
    expect(
      engine
        .createSnapshot()
        .assemblies?.find((assembly) => assembly.name === "Module")?.id
    ).toBe("step_feat_2_assembly_1_2");
    expect(importStep).toHaveBeenCalledTimes(1);
    expect(importStep.mock.calls[0]![0]).not.toHaveProperty("maxBodyCount");
    expect(importStep.mock.calls[0]![0]).not.toHaveProperty("bodyId");
    const snapshot = engine.createSnapshot();
    expect(
      snapshot.features
        .filter((feature) => feature.kind === "importedBody")
        .map((feature) => feature.name)
    ).toEqual(["Bracket", "Pin"]);
    expect(
      snapshot.assemblies
        ?.flatMap((assembly) => assembly.instances)
        .filter((instance) => instance.definition.kind === "body")
        .map(
          (instance) =>
            instance.definition.kind === "body" && instance.definition.bodyId
        )
    ).toEqual(["body_2", "body_3", "body_2"]);
    payloadStore.deletePayload("assembly");
    const stable = engine.exportProject();
    await expect(
      executor.executeBatch({ version: "cadops.v1", mode: "commit", ops })
    ).rejects.toThrow("no longer available");
    expect(engine.exportProject()).toEqual(stable);
  });
});

function createStepImportResult(
  input: DerivedStepImportInput
): DerivedStepImportResult {
  const bodyId = input.bodyId ?? "body_imported_1";
  const checkpointId = input.checkpointId ?? "checkpoint_imported_1";
  const brepBytes = new TextEncoder().encode("imported checkpoint brep bytes");
  const topologySnapshot = {
    sourceKind: "importedBody" as const,
    source: "kernel-derived" as const,
    status: "partial" as const,
    entityCounts: {
      bodyCount: 1,
      solidCount: 1,
      faceCount: 6,
      wireCount: 0,
      edgeCount: 12,
      vertexCount: 8,
      loopCount: 0,
      coedgeCount: 0,
      axisCount: 0
    },
    entityCount: 1,
    entities: [
      {
        localId: "checkpoint-local-imported-body",
        kind: "body" as const,
        source: "kernel-derived" as const,
        signature: "imported-body-signature",
        bounds: {
          min: [0, 0, 0] as const,
          max: [4, 2, 1] as const
        }
      }
    ],
    unsupportedEntityKinds: [] as const,
    adjacencyAvailable: false,
    signatureAlgorithm: "partbench-derived-topology-snapshot-v1" as const,
    signature: "imported-body-topology-signature",
    diagnostics: [
      {
        code: "GEOMETRY_TOPOLOGY_SNAPSHOT_EXTRACTED" as const,
        severity: "info" as const,
        message: "Test topology snapshot extracted."
      }
    ]
  };

  return {
    sourceFormat: "step",
    sourceFileName: input.sourceFileName,
    bodyCount: 1,
    bodies: [
      {
        sourceFormat: "step",
        sourceFileName: input.sourceFileName,
        bodyName: "Imported bracket",
        shapeType: "solid",
        bounds: {
          min: [0, 0, 0],
          max: [4, 2, 1]
        },
        solidCount: 1,
        faceCount: 6,
        edgeCount: 12,
        vertexCount: 8,
        topologySnapshot,
        checkpointPayload: {
          checkpointId,
          bodyId,
          sourceKind: "importedBody",
          brepFormat: "occt-brep",
          brepWriter: "BRepTools.Write_3",
          brepBytes,
          brepByteLength: brepBytes.byteLength,
          topologySnapshot,
          signaturePayload: {
            checkpointId,
            signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
            signature: topologySnapshot.signature,
            entityCount: topologySnapshot.entityCount,
            entities: topologySnapshot.entities.map((entity) => ({
              localId: entity.localId,
              kind: entity.kind,
              signature: entity.signature
            }))
          }
        },
        healingApplied: true,
        diagnostics: []
      }
    ],
    diagnostics: [
      {
        code: "STEP_READER_AVAILABLE",
        severity: "info",
        message: "Test STEP reader available."
      }
    ],
    metrics: {
      objectId: input.id,
      roundTripMs: 1
    },
    message: `Imported STEP geometry for ${input.sourceFileName}.`
  };
}

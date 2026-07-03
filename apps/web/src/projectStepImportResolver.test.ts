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
        bodyId: "body_1",
        checkpointId: "checkpoint_body_1"
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

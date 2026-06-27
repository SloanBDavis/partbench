import {
  CadEngine,
  exportCadProjectJson,
  importCadProjectJson
} from "@web-cad/cad-core";
import type { RenderTriangleMesh } from "@web-cad/renderer";
import type {
  CadBatchResponse,
  CadOp,
  ProjectStructureQueryResponse,
  ProjectHealthQueryResponse,
  TopologyAnchorCreationPlanQueryResponse
} from "@web-cad/cad-protocol";
import { describe, expect, it, vi } from "vitest";
import {
  buildAddSketchCircleOp,
  buildBatch,
  buildFeatureHoleOp,
  WEB_UI_ACTOR
} from "./cadCommands";
import { createEffectiveHoleTargetForm } from "./sketchPanelUi";
import { createSketchOnFaceCommandPlan } from "./sketchOnFacePromotion";
import { preflightHoleGeometryCommand } from "./holeGeometryPreflight";
import type {
  DerivedGeometryHoleInput,
  DerivedGeometryResult,
  DerivedGeometryRuntime
} from "./derivedGeometryRuntime";

describe("V14 result hole workflow", () => {
  it("creates a circle hole from a promoted result-face sketch without dropping topology target anchors", async () => {
    const engine = createCircleResultBodyEngine();
    const createFacePlan = vi.fn(async () => ({
      ok: true as const,
      plan: createResultFacePlan()
    }));
    const sketchPlan = await createSketchOnFaceCommandPlan({
      engine,
      features: readStructure(engine).features,
      sketches: [],
      generatedFacesByKey: new Map(),
      runtime: {
        exactTopologyCheckpointPayload: vi.fn()
      },
      form: {
        id: "sketch_result_hole",
        name: "Result face hole sketch",
        bodyId: "body_circle_cut",
        faceStableId: "generated:face:body_circle_cut:side:uMin",
        topologyAnchorProof: {
          kind: "axisAlignedPlanarFace",
          entityKind: "face",
          evidenceSource: "checkpointSnapshot",
          exposesCheckpointLocalIds: false,
          planarAxis: "z",
          planarCoordinate: 3,
          bounds: { min: [-1, -1, 3], max: [1, 1, 3] }
        }
      },
      createAnchorPlan: createFacePlan
    });

    expect(sketchPlan).toMatchObject({
      ok: true,
      status: "ready",
      topologyAnchorId: "anchor_face_circle_cut_side"
    });
    if (!sketchPlan.ok) {
      throw new Error(sketchPlan.message);
    }
    expect(createFacePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          bodyId: "body_circle_cut",
          stableId: "generated:face:body_circle_cut:side:uMin",
          kind: "face"
        }
      })
    );
    expect(sketchPlan.ops.at(-1)).toEqual({
      op: "sketch.createOnFace",
      id: "sketch_result_hole",
      name: "Result face hole sketch",
      topologyAnchorId: "anchor_face_circle_cut_side",
      topologyAnchorProof: expect.objectContaining({
        kind: "axisAlignedPlanarFace",
        exposesCheckpointLocalIds: false
      })
    });
    expect(execute(engine, sketchPlan.ops, "dryRun")).toMatchObject({
      ok: true,
      createdSketchIds: ["sketch_result_hole"]
    });
    execute(engine, sketchPlan.ops, "commit");

    const circleOp = buildAddSketchCircleOp("sketch_result_hole", {
      id: "circle_result_hole",
      x: 0,
      y: 0,
      x2: 0,
      y2: 0,
      width: 0,
      height: 0,
      radius: 0.25
    });
    const holeForm = createEffectiveHoleTargetForm(
      {
        id: "feat_result_hole",
        bodyId: "body_result_hole",
        targetBodyId: "",
        name: "Result body hole",
        depthMode: "throughAll" as const,
        depth: 1,
        direction: "positive" as const
      },
      {
        bodyId: "body_circle_cut",
        targetTopologyAnchorId: "anchor_body_circle"
      }
    );
    const holeOp = buildFeatureHoleOp(
      "sketch_result_hole",
      "circle_result_hole",
      holeForm
    );

    expect(holeOp).toEqual({
      op: "feature.hole",
      id: "feat_result_hole",
      bodyId: "body_result_hole",
      targetTopologyAnchorId: "anchor_body_circle",
      name: "Result body hole",
      sketchId: "sketch_result_hole",
      circleEntityId: "circle_result_hole",
      depthMode: "throughAll",
      direction: "positive"
    });
    expect(holeOp).not.toHaveProperty("targetBodyId");
    expect(execute(engine, [circleOp, holeOp], "dryRun")).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_result_hole"],
      createdBodyIds: ["body_result_hole"]
    });
    execute(engine, [circleOp, holeOp], "commit");

    const structure = readStructure(engine);
    const health = readHealth(engine);
    const reopened = importCadProjectJson(exportCadProjectJson(engine));

    expect(structure.features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "feat_result_hole",
          kind: "hole",
          targetBodyId: "body_circle_cut",
          targetTopologyAnchorId: "anchor_body_circle",
          source: expect.objectContaining({
            targetBodyId: "body_circle_cut",
            targetTopologyAnchorId: "anchor_body_circle"
          })
        })
      ])
    );
    expect(
      engine.getDocument().sketches.get("sketch_result_hole")
    ).toMatchObject({
      id: "sketch_result_hole",
      attachment: {
        kind: "topologyAnchorFace",
        bodyId: "body_circle_cut",
        topologyAnchorId: "anchor_face_circle_cut_side",
        checkpointId: "checkpoint_circle_cut",
        planarAxis: "z",
        planarCoordinate: 3
      }
    });
    expect(health.authoredHoles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          featureId: "feat_result_hole",
          targetBodyId: "body_circle_cut",
          targetTopologyAnchorId: "anchor_body_circle",
          status: "healthy"
        })
      ])
    );
    expect(readStructure(reopened).bodies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "body_result_hole",
          source: expect.objectContaining({
            type: "sketchHoleFeature",
            targetBodyId: "body_circle_cut",
            targetTopologyAnchorId: "anchor_body_circle"
          })
        })
      ])
    );
    expect(JSON.stringify({ sketchPlan, holeOp, structure })).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|fileHandle|opfsPath|localPath|checkpoint-local/i
    );
  });

  it("preflights result-body hole geometry without mutating source", async () => {
    const { engine, holeOp } = createAttachedResultHoleFixture();
    const beforeJson = exportCadProjectJson(engine);
    const runtime = createHolePreflightRuntime(async (input) =>
      createGeometryResult(input.id)
    );
    const result = await preflightHoleGeometryCommand({
      engine,
      ops: [holeOp],
      bodyId: "body_result_hole",
      runtime
    });

    expect(result).toMatchObject({
      ok: true,
      response: {
        createdFeatureIds: ["feat_result_hole"],
        createdBodyIds: ["body_result_hole"]
      }
    });
    expect(runtime.holeInputs).toEqual([
      expect.objectContaining({
        id: "body_result_hole",
        target: expect.objectContaining({
          kind: "booleanExtrudes",
          operation: "cut"
        }),
        tool: expect.objectContaining({
          sketchPlane: "XY",
          circle: {
            kind: "circle",
            center: [0, 0],
            radius: 0.25
          },
          depthMode: "throughAll",
          direction: "positive",
          placementFrame: expect.objectContaining({
            origin: expect.any(Array),
            uAxis: expect.any(Array),
            vAxis: expect.any(Array)
          })
        })
      })
    ]);
    expect(exportCadProjectJson(engine)).toBe(beforeJson);
    expect(readStructure(engine).features).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "feat_result_hole" })
      ])
    );
  });

  it("blocks result-body hole commits when geometry preflight fails", async () => {
    const { engine, holeOp } = createAttachedResultHoleFixture();
    const beforeJson = exportCadProjectJson(engine);
    const runtime = createHolePreflightRuntime(async () => {
      throw new Error("The selected hole does not cut the target body.");
    });
    const result = await preflightHoleGeometryCommand({
      engine,
      ops: [holeOp],
      bodyId: "body_result_hole",
      runtime
    });

    expect(result).toEqual({
      ok: false,
      reason: "runtime",
      message:
        "Could not create this hole on the selected target. The selected hole does not cut the target body."
    });
    expect(runtime.holeInputs).toHaveLength(1);
    expect(exportCadProjectJson(engine)).toBe(beforeJson);
    expect(readStructure(engine).features).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "feat_result_hole" })
      ])
    );
  });

  it("formats result-body hole preflight runtime failures for product surfaces", async () => {
    const { engine, holeOp } = createAttachedResultHoleFixture();
    const beforeJson = exportCadProjectJson(engine);
    const runtime = createHolePreflightRuntime(async () => {
      throw new Error(
        "Geometry worker response does not contain an exact topology checkpoint payload for OCCT-mesh renderer-hit:face-1 checkpoint-local:face-1."
      );
    });
    const result = await preflightHoleGeometryCommand({
      engine,
      ops: [holeOp],
      bodyId: "body_result_hole",
      runtime
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "runtime",
      message:
        "Could not create this hole on the selected target. Display geometry evidence is incomplete for display geometry internal render target."
    });
    if (result.ok) {
      throw new Error("Expected hole preflight to fail.");
    }
    expect(result.message).not.toMatch(
      /Geometry worker|checkpoint payload|OCCT|renderer-hit|checkpoint-local|mesh/i
    );
    expect(exportCadProjectJson(engine)).toBe(beforeJson);
    expect(readStructure(engine).features).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "feat_result_hole" })
      ])
    );
  });
});

function createCircleResultBodyEngine(): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    {
      op: "sketch.create",
      id: "sketch_circle_source",
      name: "Circle source",
      plane: "XY"
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_circle_source",
      id: "circle_source",
      center: [0, 0],
      radius: 1
    },
    {
      op: "feature.extrude",
      id: "feat_circle_source",
      bodyId: "body_circle",
      sketchId: "sketch_circle_source",
      entityId: "circle_source",
      depth: 3,
      operationMode: "newBody"
    },
    {
      op: "topology.checkpoint.create",
      checkpointId: "checkpoint_circle_source",
      bodyId: "body_circle",
      sourceFeatureId: "feat_circle_source",
      sourceIdentity: sourceIdentity("2"),
      status: "active"
    },
    {
      op: "topology.anchor.create",
      anchorId: "anchor_body_circle",
      entityKind: "body",
      bodyId: "body_circle",
      checkpointId: "checkpoint_circle_source",
      checkpointEntityId: "checkpoint_circle_source_body",
      stableId: "generated:body:body_circle",
      sourceFeatureId: "feat_circle_source",
      sourceSemanticRole: "source body",
      signatureHash: "circle_body_signature"
    },
    {
      op: "sketch.create",
      id: "sketch_circle_cut",
      name: "Circle result cut",
      plane: "XY"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_circle_cut",
      id: "rect_circle_cut",
      center: [0, 0],
      width: 0.5,
      height: 0.5
    },
    {
      op: "feature.extrude",
      id: "feat_circle_cut",
      bodyId: "body_circle_cut",
      sketchId: "sketch_circle_cut",
      entityId: "rect_circle_cut",
      depth: 1,
      operationMode: "cut",
      targetTopologyAnchorId: "anchor_body_circle"
    }
  ]);

  return engine;
}

function createResultFacePlan(): TopologyAnchorCreationPlanQueryResponse {
  const ops: readonly CadOp[] = [
    {
      op: "topology.checkpoint.create",
      checkpointId: "checkpoint_circle_cut",
      bodyId: "body_circle_cut",
      sourceFeatureId: "feat_circle_cut",
      sourceIdentity: sourceIdentity("3"),
      status: "active"
    },
    {
      op: "topology.anchor.create",
      anchorId: "anchor_face_circle_cut_side",
      entityKind: "face",
      bodyId: "body_circle_cut",
      checkpointId: "checkpoint_circle_cut",
      checkpointEntityId: "checkpoint_circle_cut_side_face",
      sourceFeatureId: "feat_circle_cut",
      signatureHash: "circle_cut_side_face_signature"
    }
  ];

  return {
    ok: true,
    query: "topology.anchorCreationPlan",
    cadOpsVersion: "cadops.v1",
    status: "ready",
    bodyId: "body_circle_cut",
    stableId: "generated:face:body_circle_cut:side:uMin",
    checkpointId: "checkpoint_circle_cut",
    anchorId: "anchor_face_circle_cut_side",
    sourceFeatureId: "feat_circle_cut",
    createsCheckpoint: true,
    createsAnchor: true,
    opCount: ops.length,
    ops,
    proposedBatch: buildBatch("commit", ops, WEB_UI_ACTOR),
    diagnosticCount: 0,
    diagnostics: [],
    sourceBoundaryNote: "Uses public source topology identity.",
    derivedBoundaryNote: "Does not expose renderer or checkpoint-local ids.",
    mutatesSource: false
  };
}

function createAttachedResultHoleFixture(): {
  readonly engine: CadEngine;
  readonly holeOp: Extract<CadOp, { readonly op: "feature.hole" }>;
} {
  const engine = createCircleResultBodyEngine();

  execute(
    engine,
    [
      ...createResultFacePlan().ops,
      {
        op: "sketch.createOnFace",
        id: "sketch_result_hole",
        name: "Result face hole sketch",
        topologyAnchorId: "anchor_face_circle_cut_side",
        topologyAnchorProof: createResultFaceProof()
      },
      buildAddSketchCircleOp("sketch_result_hole", {
        id: "circle_result_hole",
        x: 0,
        y: 0,
        x2: 0,
        y2: 0,
        width: 0,
        height: 0,
        radius: 0.25
      })
    ],
    "commit"
  );

  const holeForm = createEffectiveHoleTargetForm(
    {
      id: "feat_result_hole",
      bodyId: "body_result_hole",
      targetBodyId: "",
      name: "Result body hole",
      depthMode: "throughAll" as const,
      depth: 1,
      direction: "positive" as const
    },
    {
      bodyId: "body_circle_cut",
      targetTopologyAnchorId: "anchor_body_circle"
    }
  );
  const holeOp = buildFeatureHoleOp(
    "sketch_result_hole",
    "circle_result_hole",
    holeForm
  );

  return { engine, holeOp };
}

function createResultFaceProof() {
  return {
    kind: "axisAlignedPlanarFace" as const,
    entityKind: "face" as const,
    evidenceSource: "checkpointSnapshot" as const,
    exposesCheckpointLocalIds: false as const,
    planarAxis: "z" as const,
    planarCoordinate: 3,
    bounds: {
      min: [-1, -1, 3] as const,
      max: [1, 1, 3] as const
    }
  };
}

function execute(
  engine: CadEngine,
  ops: readonly CadOp[],
  mode: "commit" | "dryRun"
): CadBatchResponse {
  return engine.executeBatch(buildBatch(mode, ops, WEB_UI_ACTOR));
}

function readStructure(engine: CadEngine): ProjectStructureQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });

  if (!response.ok || response.query !== "project.structure") {
    throw new Error("Expected project.structure response.");
  }

  return response;
}

function readHealth(engine: CadEngine): ProjectHealthQueryResponse {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.health" }
  });

  if (!response.ok || response.query !== "project.health") {
    throw new Error("Expected project.health response.");
  }

  return response;
}

function sourceIdentity(seed: string) {
  return {
    algorithm: "partbench-source-v1" as const,
    sha256: seed.repeat(64)
  };
}

function createHolePreflightRuntime(
  handler: (input: DerivedGeometryHoleInput) => Promise<DerivedGeometryResult>
): DerivedGeometryRuntime & {
  readonly holeInputs: readonly DerivedGeometryHoleInput[];
} {
  const holeInputs: DerivedGeometryHoleInput[] = [];
  const unused = () => {
    throw new Error("Only hole geometry is preflighted by this test runtime.");
  };

  return {
    holeInputs,
    tessellateBox: unused,
    tessellateCylinder: unused,
    tessellateSphere: unused,
    tessellateCone: unused,
    tessellateTorus: unused,
    tessellateExtrude: unused,
    revolveProfile: unused,
    booleanExtrudes: unused,
    edgeFinish: unused,
    exactBodyMetadata: unused,
    exactTopologyCheckpointPayload: unused,
    hole(input) {
      holeInputs.push(input);
      return handler(input);
    },
    dispose() {}
  };
}

function createGeometryResult(objectId: string): DerivedGeometryResult {
  const mesh: RenderTriangleMesh = {
    id: objectId,
    kind: "mesh",
    vertices: [],
    indices: [],
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };

  return {
    mesh,
    metrics: {
      objectId,
      roundTripMs: 1,
      vertexCount: 0,
      triangleCount: 0
    },
    message: `Displayed derived geometry for ${objectId}.`
  };
}

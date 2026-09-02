import {
  CadEngine,
  encodeWcadCanonicalCbor,
  exportCadProjectJson,
  importCadProjectJson,
  sha256Hex,
  type WcadTopologyCheckpointPayloadInput
} from "@web-cad/cad-core";
import type {
  CadBatchResponse,
  CadOp,
  ProjectStructureQueryResponse,
  ProjectHealthQueryResponse,
  TopologyAnchorCreationPlanQueryResponse
} from "@web-cad/cad-protocol";
import type { GeometryKernelExactBodyArtifact } from "@web-cad/geometry-worker";
import { describe, expect, it, vi } from "vitest";
import {
  buildAddSketchCircleOp,
  buildBatch,
  buildFeatureHoleOp,
  WEB_UI_ACTOR
} from "./cadCommands";
import { createEffectiveHoleTargetForm } from "./sketchPanelUi";
import { defaultSketchEntityForm } from "./sketchEntityForms";
import { createSketchOnFaceCommandPlan } from "./sketchOnFacePromotion";
import { preflightExactDownstreamGeometryCommand } from "./holeGeometryPreflight";
import type {
  DerivedExactBodyArtifactInput,
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
      ...defaultSketchEntityForm,
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
    const runtime = createHolePreflightRuntime();
    const result = await preflightExactDownstreamGeometryCommand({
      engine,
      ops: [holeOp],
      bodyId: "body_result_hole",
      runtime,
      checkpointPayloads: createResultCheckpointPayloads()
    });

    expect(result).toMatchObject({
      ok: true,
      response: {
        createdFeatureIds: ["feat_result_hole"],
        createdBodyIds: ["body_result_hole"]
      }
    });
    expect(runtime.artifactInputs.at(-1)).toMatchObject({
      bodyId: "body_result_hole",
      shapePolicy: "singleShapeOneOrMoreSolids",
      source: {
        kind: "artifactHole",
        target: { kind: "bodyArtifact", bodyId: "body_circle_cut" },
        tool: {
          sketchPlane: "XY",
          circle: { kind: "circle", center: [0, 0], radius: 0.25 },
          depthMode: "throughAll",
          direction: "positive"
        }
      }
    });
    expect(runtime.artifactInputs).toHaveLength(2);
    expect(result).toMatchObject({ sourceAuthorityEpoch: expect.any(Number) });
    expect(exportCadProjectJson(engine)).toBe(beforeJson);
    expect(readStructure(engine).features).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "feat_result_hole" })
      ])
    );
  });

  it("preflights every independent hole result in one agent batch", async () => {
    const engine = new CadEngine();
    engine.applyBatch([
      {
        op: "scene.createBox",
        id: "agent_target_a",
        dimensions: { width: 4, height: 4, depth: 4 }
      },
      {
        op: "scene.createBox",
        id: "agent_target_b",
        dimensions: { width: 4, height: 4, depth: 4 }
      },
      {
        op: "sketch.create",
        id: "agent_hole_a",
        name: "Agent hole A",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "agent_hole_a",
        id: "agent_circle_a",
        center: [0, 0],
        radius: 0.25
      },
      {
        op: "sketch.create",
        id: "agent_hole_b",
        name: "Agent hole B",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "agent_hole_b",
        id: "agent_circle_b",
        center: [0, 0],
        radius: 0.25
      }
    ]);
    const ops: readonly CadOp[] = [
      {
        op: "feature.hole",
        id: "agent_feature_hole_a",
        bodyId: "agent_body_hole_a",
        targetBodyId: "body:agent_target_a",
        sketchId: "agent_hole_a",
        circleEntityId: "agent_circle_a",
        depthMode: "throughAll",
        direction: "positive"
      },
      {
        op: "feature.hole",
        id: "agent_feature_hole_b",
        bodyId: "agent_body_hole_b",
        targetBodyId: "body:agent_target_b",
        sketchId: "agent_hole_b",
        circleEntityId: "agent_circle_b",
        depthMode: "blind",
        depth: 2,
        direction: "negative"
      }
    ];
    const beforeJson = exportCadProjectJson(engine);
    const runtime = createHolePreflightRuntime();

    const result = await preflightExactDownstreamGeometryCommand({
      engine,
      ops,
      runtime
    });
    if (!result.ok) throw new Error(result.message);
    expect(result).toMatchObject({ ok: true });
    expect(
      runtime.artifactInputs
        .filter((input) => input.source.kind === "artifactHole")
        .map((input) => input.bodyId)
    ).toEqual(["agent_body_hole_a", "agent_body_hole_b"]);
    expect(exportCadProjectJson(engine)).toBe(beforeJson);
  });

  it("preflights a pattern from its exact artifact without mutating source", async () => {
    const engine = new CadEngine();
    engine.apply({
      op: "scene.createBox",
      id: "pattern_seed",
      dimensions: { width: 2, height: 2, depth: 2 }
    });
    const op = {
      op: "feature.linearPattern" as const,
      id: "pattern_feature",
      bodyId: "pattern_body",
      seedBodyId: "body:pattern_seed",
      direction: { kind: "globalAxis" as const, axis: "x" as const },
      spacing: 3,
      instanceCount: 2
    };
    const beforeJson = exportCadProjectJson(engine);
    const runtime = createHolePreflightRuntime();

    const result = await preflightExactDownstreamGeometryCommand({
      engine,
      ops: [op],
      runtime
    });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error(result.message);
    expect(result.artifacts.map(({ bodyId }) => bodyId)).toEqual([
      "pattern_body"
    ]);
    expect(runtime.artifactInputs).toHaveLength(2);
    expect(runtime.artifactInputs.at(-1)?.source).toMatchObject({
      kind: "artifactLinearPattern",
      seed: { kind: "bodyArtifact", bodyId: "body:pattern_seed" },
      instanceCount: 2
    });
    expect(exportCadProjectJson(engine)).toBe(beforeJson);
  });

  it("preflights only the surviving root of a chained exact batch", async () => {
    const engine = new CadEngine();
    engine.apply({
      op: "scene.createBox",
      id: "chain_seed",
      dimensions: { width: 2, height: 2, depth: 2 }
    });
    const runtime = createHolePreflightRuntime();
    const result = await preflightExactDownstreamGeometryCommand({
      engine,
      ops: [
        {
          op: "feature.linearPattern",
          id: "chain_pattern",
          bodyId: "chain_pattern_body",
          seedBodyId: "body:chain_seed",
          direction: { kind: "globalAxis", axis: "x" },
          spacing: 3,
          instanceCount: 2
        },
        {
          op: "feature.shell",
          id: "chain_shell",
          bodyId: "chain_shell_body",
          targetBodyId: "chain_pattern_body",
          wallThickness: 0.25,
          openFaceRefs: []
        }
      ],
      runtime
    });

    expect(result).toMatchObject({
      ok: true,
      artifacts: [{ bodyId: "chain_shell_body" }]
    });
    if (!result.ok) throw new Error(result.message);
    expect(result.artifacts.map(({ bodyId }) => bodyId)).toEqual([
      "chain_shell_body"
    ]);
  });

  it("reuses an unchanged exact dependency across a projected commit", async () => {
    const engine = new CadEngine();
    engine.apply({
      op: "scene.createBox",
      id: "cached_seed",
      dimensions: { width: 2, height: 2, depth: 2 }
    });
    const patternOp: CadOp = {
      op: "feature.linearPattern",
      id: "cached_pattern",
      bodyId: "cached_pattern_body",
      seedBodyId: "body:cached_seed",
      direction: { kind: "globalAxis", axis: "x" },
      spacing: 3,
      instanceCount: 2
    };
    const firstRuntime = createHolePreflightRuntime();
    const first = await preflightExactDownstreamGeometryCommand({
      engine,
      ops: [patternOp],
      runtime: firstRuntime
    });
    if (!first.ok) throw new Error(first.message);
    engine.apply(patternOp);

    const secondRuntime = createHolePreflightRuntime();
    const second = await preflightExactDownstreamGeometryCommand({
      engine,
      ops: [
        {
          op: "feature.shell",
          id: "cached_shell",
          bodyId: "cached_shell_body",
          targetBodyId: "cached_pattern_body",
          wallThickness: 0.25,
          openFaceRefs: []
        }
      ],
      runtime: secondRuntime,
      existingArtifacts: first.artifacts
    });

    expect(second).toMatchObject({ ok: true });
    expect(secondRuntime.artifactInputs.map(({ bodyId }) => bodyId)).toEqual([
      "cached_shell_body"
    ]);
  });

  it("blocks result-body hole commits when geometry preflight fails", async () => {
    const { engine, holeOp } = createAttachedResultHoleFixture();
    const beforeJson = exportCadProjectJson(engine);
    const runtime = createHolePreflightRuntime((input) => {
      if (input.bodyId !== "body_result_hole") return;
      throw Object.assign(
        new Error("Hole tool has no positive-volume intersection."),
        { code: "EMPTY_RESULT" }
      );
    });
    const result = await preflightExactDownstreamGeometryCommand({
      engine,
      ops: [holeOp],
      bodyId: "body_result_hole",
      runtime,
      checkpointPayloads: createResultCheckpointPayloads()
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "runtime",
      diagnosticCode: "HOLE_TOOL_NO_INTERSECTION",
      message: expect.stringContaining(
        "Could not apply this hole (HOLE_TOOL_NO_INTERSECTION)."
      )
    });
    expect(runtime.artifactInputs).toHaveLength(2);
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
    const runtime = createHolePreflightRuntime((input) => {
      if (input.bodyId !== "body_result_hole") return;
      throw new Error(
        "Geometry worker response does not contain an exact topology checkpoint payload for OCCT-mesh renderer-hit:face-1 checkpoint-local:face-1."
      );
    });
    const result = await preflightExactDownstreamGeometryCommand({
      engine,
      ops: [holeOp],
      bodyId: "body_result_hole",
      runtime,
      checkpointPayloads: createResultCheckpointPayloads()
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "runtime",
      diagnosticCode: "EXPORT_EXACT_ARTIFACT_FAILED"
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

  it.each([
    ["INVALID_RESULT", "HOLE_RESULT_INVALID"],
    ["GEOMETRY_JOB_GENERATION_CANCELLED", "EXPORT_CANCELLED"]
  ] as const)(
    "maps nested runtime diagnostic %s",
    async (runtimeCode, diagnosticCode) => {
      const { engine, holeOp } = createAttachedResultHoleFixture();
      const runtime = createHolePreflightRuntime((input) => {
        if (input.bodyId !== "body_result_hole") return;
        throw Object.assign(new Error("Injected exact runtime failure."), {
          details: { code: runtimeCode }
        });
      });

      await expect(
        preflightExactDownstreamGeometryCommand({
          engine,
          ops: [holeOp],
          runtime,
          checkpointPayloads: createResultCheckpointPayloads()
        })
      ).resolves.toMatchObject({
        ok: false,
        reason: "runtime",
        diagnosticCode
      });
    }
  );

  it("rejects a human preflight when source authority changes", async () => {
    const { engine, holeOp } = createAttachedResultHoleFixture();
    const runtime = createHolePreflightRuntime((input) => {
      if (input.bodyId !== "body_result_hole") return;
      engine.apply({
        op: "sketch.rename",
        id: "sketch_result_hole",
        name: "Changed during preflight"
      });
    });

    await expect(
      preflightExactDownstreamGeometryCommand({
        engine,
        ops: [holeOp],
        runtime,
        checkpointPayloads: createResultCheckpointPayloads()
      })
    ).resolves.toMatchObject({
      ok: false,
      reason: "source",
      message: expect.stringContaining("project changed")
    });
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
        ...defaultSketchEntityForm,
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

function createResultCheckpointPayloads(): readonly WcadTopologyCheckpointPayloadInput[] {
  return [
    createResultCheckpointPayload(
      "checkpoint_circle_source",
      "body_circle",
      "feat_circle_source",
      "extrude",
      1
    ),
    createResultCheckpointPayload(
      "checkpoint_circle_cut",
      "body_circle_cut",
      "feat_circle_cut",
      "booleanExtrudes",
      2
    )
  ];
}

function createResultCheckpointPayload(
  checkpointId: string,
  bodyId: string,
  sourceFeatureId: string,
  sourceKind: "extrude" | "booleanExtrudes",
  marker: number
): WcadTopologyCheckpointPayloadInput {
  const brepBytes = new Uint8Array([marker]);
  return {
    checkpointId,
    bodyId,
    sourceFeatureId,
    kernel: {
      boundary: "geometry-kernel",
      snapshotAlgorithm: "partbench-derived-topology-snapshot-v1"
    },
    tolerance: {
      linearTolerance: 0.001,
      angularToleranceDegrees: 0.01
    },
    brepBytes,
    brepByteLength: brepBytes.byteLength,
    brepSha256: sha256Hex(brepBytes),
    topologyBytes: encodeWcadCanonicalCbor({
      sourceKind,
      signature: `topology:${bodyId}`
    }),
    signatureBytes: encodeWcadCanonicalCbor({
      checkpointId,
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
      signature: `topology:${bodyId}`,
      entityCount: 0,
      entities: []
    })
  };
}

function createHolePreflightRuntime(
  onArtifact?: (input: DerivedExactBodyArtifactInput) => void
): DerivedGeometryRuntime & {
  readonly artifactInputs: readonly DerivedExactBodyArtifactInput[];
} {
  const artifactInputs: DerivedExactBodyArtifactInput[] = [];
  const unused = () => {
    throw new Error("Only hole geometry is preflighted by this test runtime.");
  };

  return {
    artifactInputs,
    async exactBodyArtifact(input) {
      artifactInputs.push(input);
      onArtifact?.(input);
      return {
        artifact: createExactBodyArtifact(input, artifactInputs.length),
        metrics: { objectId: input.id, roundTripMs: 1 },
        message: `Built ${input.bodyId}`
      };
    },
    executeExactStepExport: unused,
    tessellateBox: unused,
    tessellateCylinder: unused,
    tessellateSphere: unused,
    tessellateCone: unused,
    tessellateTorus: unused,
    tessellateExtrude: unused,
    revolveProfile: unused,
    booleanExtrudes: unused,
    edgeFinish: unused,
    linearPattern: unused,
    circularPattern: unused,
    mirror: unused,
    shell: unused,
    draft: unused,
    sweep: unused,
    loft: unused,
    exactBodyMetadata: unused,
    exactTopologyCheckpointPayload: unused,
    importStep: unused,
    hole: unused,
    cancelModelWork() {
      return 0;
    },
    resumeModelWork() {
      return 0;
    },
    getModelWorkSnapshot() {
      return {
        generation: 0,
        stopped: false,
        active: false,
        queuedCount: 0,
        cancelledUserKinds: []
      };
    },
    subscribeModelWork() {
      return () => undefined;
    },
    dispose() {}
  };
}

function createExactBodyArtifact(
  input: DerivedExactBodyArtifactInput,
  index: number
): GeometryKernelExactBodyArtifact {
  const brepBytes = new Uint8Array([index]);
  const sourceKind = input.source
    .kind as GeometryKernelExactBodyArtifact["sourceKind"];
  const topologyEntities = [
    {
      localId: `body:${input.bodyId}`,
      kind: "body" as const,
      source: "kernel-derived" as const,
      signature: `body:${input.bodyId}`
    },
    {
      localId: `solid:${input.bodyId}:1`,
      kind: "solid" as const,
      source: "kernel-derived" as const,
      signature: `solid:${input.bodyId}:1`
    }
  ];
  return {
    artifactVersion: "partbench.exact-body-artifact.v1",
    bodyId: input.bodyId,
    sourceType: input.sourceType,
    documentSourceIdentity: input.documentSourceIdentity,
    bodySourceIdentitySignature: input.bodySourceIdentitySignature,
    sourceCacheKeySha256: input.sourceCacheKeySha256,
    sourceGraphNodeCount: input.sourceGraphNodeCount,
    units: input.units,
    shapePolicy: input.shapePolicy,
    sourceKind,
    brepFormat: "occt-brep",
    brepWriter: "BRepTools.Write_3",
    brepBytes,
    brepByteLength: brepBytes.byteLength,
    brepSha256: sha256Hex(brepBytes),
    metadata: {
      sourceKind,
      bounds: { min: [0, 0, 0], max: [1, 1, 1] },
      volume: 1,
      surfaceArea: 6,
      centroid: [0.5, 0.5, 0.5],
      topologyCounts: {
        solidCount: 1,
        faceCount: 0,
        edgeCount: 0,
        vertexCount: 0
      },
      measurementSource: "kernel-derived",
      measurementConfidence: "kernel-derived",
      diagnostics: []
    },
    topologySnapshot: {
      sourceKind,
      status: "ready",
      entityCounts: {
        bodyCount: 1,
        solidCount: 1,
        faceCount: 0,
        wireCount: 0,
        loopCount: 0,
        coedgeCount: 0,
        edgeCount: 0,
        vertexCount: 0,
        axisCount: 0
      },
      entityCount: topologyEntities.length,
      entities: topologyEntities,
      unsupportedEntityKinds: [],
      adjacencyAvailable: false,
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
      signature: `topology:${input.bodyId}`,
      source: "kernel-derived",
      diagnostics: []
    },
    displayMesh: {
      primitive: "extrude",
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      indices: new Uint32Array([0, 1, 2]),
      vertexCount: 3,
      triangleCount: 1,
      faceCount: 1
    }
  };
}

import { describe, expect, it } from "vitest";
import type {
  CadBatchResponse,
  ProjectStructureQueryResponse
} from "@web-cad/cad-protocol";

import {
  AsyncCadCommandExecutor,
  CadEngine,
  CadProjectImportError,
  SnapshotCadCommandWorker,
  createCadProjectSourceIdentity,
  exportCadProject,
  exportCadProjectJson,
  importCadProject
} from "./index";

function createHoleRetargetEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_targets", name: "Targets", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_targets",
      id: "rectangle_old",
      center: [0, 0],
      width: 6,
      height: 6
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_targets",
      id: "rectangle_new",
      center: [0, 0],
      width: 6,
      height: 6
    },
    {
      op: "feature.extrude",
      id: "feature_old_target",
      bodyId: "body_old_target",
      sketchId: "sketch_targets",
      entityId: "rectangle_old",
      depth: 4
    },
    {
      op: "feature.extrude",
      id: "feature_new_target",
      bodyId: "body_new_target",
      sketchId: "sketch_targets",
      entityId: "rectangle_new",
      depth: 4
    },
    { op: "sketch.create", id: "sketch_hole", name: "Hole", plane: "XY" },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_hole",
      id: "circle_hole",
      center: [0, 0],
      radius: 0.5
    },
    {
      op: "feature.hole",
      id: "feature_hole",
      bodyId: "body_hole",
      targetBodyId: "body_old_target",
      sketchId: "sketch_hole",
      circleEntityId: "circle_hole",
      depthMode: "blind",
      depth: 2,
      direction: "negative"
    }
  ]);
  return engine;
}

function addBodyAnchor(
  engine: CadEngine,
  bodyId = "body_new_target",
  featureId = "feature_new_target"
): void {
  engine.applyBatch([
    {
      op: "topology.checkpoint.create",
      checkpointId: `checkpoint_${bodyId}`,
      bodyId,
      sourceFeatureId: featureId,
      sourceIdentity: {
        algorithm: "partbench-source-v1",
        sha256: "a".repeat(64)
      },
      status: "active"
    },
    {
      op: "topology.anchor.create",
      anchorId: `anchor_${bodyId}`,
      entityKind: "body",
      bodyId,
      checkpointId: `checkpoint_${bodyId}`,
      checkpointEntityId: "body:0",
      sourceFeatureId: featureId,
      signatureHash: `signature-${bodyId}`
    }
  ]);
}

function addHoleResultTopology(engine: CadEngine): void {
  addBodyAnchor(engine, "body_hole", "feature_hole");
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

function expectRetargetLifecycle(
  engine: CadEngine,
  targetBodyId: string
): void {
  const bodies = readStructure(engine).bodies;
  const oldTarget = bodies.find((body) => body.id === "body_old_target");
  const newTarget = bodies.find((body) => body.id === "body_new_target");

  if (targetBodyId === "body_new_target") {
    expect(oldTarget).not.toHaveProperty("consumedByFeatureId");
    expect(newTarget).toMatchObject({ consumedByFeatureId: "feature_hole" });
  } else {
    expect(oldTarget).toMatchObject({ consumedByFeatureId: "feature_hole" });
    expect(newTarget).not.toHaveProperty("consumedByFeatureId");
  }
}

function expectFailureWithoutMutation(
  engine: CadEngine,
  response: CadBatchResponse,
  before: string,
  code: string
): void {
  expect(response).toMatchObject({ ok: false, error: { code } });
  expect(exportCadProjectJson(engine)).toBe(before);
}

describe("feature.updateHole retarget", () => {
  it("reactivates and consumes targets atomically while retaining identities through history and save/open", () => {
    const engine = createHoleRetargetEngine();
    addBodyAnchor(engine);
    addHoleResultTopology(engine);
    const beforeSourceIdentity = createCadProjectSourceIdentity(
      exportCadProject(engine)
    );
    const beforeEpoch = engine.getSourceAuthorityEpoch();

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.updateHole",
          id: "feature_hole",
          targetTopologyAnchorId: "anchor_body_new_target"
        }
      ]
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.semanticDiff.features?.modified).toEqual([
      expect.objectContaining({ id: "feature_hole", bodyId: "body_hole" })
    ]);
    expect(response.semanticDiff.features?.bodiesModified).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "body_old_target",
          featureId: "feature_old_target"
        }),
        expect.objectContaining({
          id: "body_new_target",
          featureId: "feature_new_target"
        }),
        expect.objectContaining({ id: "body_hole", featureId: "feature_hole" })
      ])
    );
    expect(response.semanticDiff.features?.lifecycleEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bodyId: "body_old_target",
          primaryState: "active"
        }),
        expect.objectContaining({
          bodyId: "body_new_target",
          primaryState: "consumed"
        }),
        expect.objectContaining({
          bodyId: "body_hole",
          primaryState: "derived-rebuild-pending"
        })
      ])
    );
    expect(response.semanticDiff.features?.referenceEffects).toContainEqual(
      expect.objectContaining({
        bodyId: "body_hole",
        category: "repair-needed"
      })
    );
    expect(
      response.semanticDiff.references?.topologyCheckpointsDeleted
    ).toContainEqual(
      expect.objectContaining({ checkpointId: "checkpoint_body_hole" })
    );
    expect(
      response.semanticDiff.references?.topologyAnchorsDeleted
    ).toContainEqual(expect.objectContaining({ anchorId: "anchor_body_hole" }));
    expect(engine.getSourceAuthorityEpoch()).toBe(beforeEpoch + 1);
    expect(engine.getDocument().features.get("feature_hole")).toMatchObject({
      id: "feature_hole",
      bodyId: "body_hole",
      targetBodyId: "body_new_target",
      targetTopologyAnchorId: "anchor_body_new_target"
    });
    expectRetargetLifecycle(engine, "body_new_target");
    expect(
      engine
        .getDocument()
        .topologyIdentity?.checkpoints.some(
          (checkpoint) => checkpoint.bodyId === "body_hole"
        )
    ).toBe(false);
    expect(
      createCadProjectSourceIdentity(exportCadProject(engine))
    ).not.toEqual(beforeSourceIdentity);

    engine.undo();
    const undoneFeature = engine.getDocument().features.get("feature_hole");
    expect(undoneFeature).toMatchObject({
      id: "feature_hole",
      bodyId: "body_hole",
      targetBodyId: "body_old_target"
    });
    expect(
      undoneFeature?.kind === "hole"
        ? undoneFeature.targetTopologyAnchorId
        : "unexpected feature"
    ).toBeUndefined();
    expectRetargetLifecycle(engine, "body_old_target");
    expect(
      engine
        .getDocument()
        .topologyIdentity?.checkpoints.some(
          (checkpoint) => checkpoint.bodyId === "body_hole"
        )
    ).toBe(true);

    engine.redo();
    expectRetargetLifecycle(engine, "body_new_target");
    const opened = importCadProject(exportCadProject(engine));
    expect(opened.getDocument()).toEqual(engine.getDocument());
    expectRetargetLifecycle(opened, "body_new_target");
    expect(opened.getTransactions().at(-1)?.ops).toEqual([
      {
        op: "feature.updateHole",
        id: "feature_hole",
        targetTopologyAnchorId: "anchor_body_new_target"
      }
    ]);
  });

  it("dry-runs direct body retarget source validation without mutation", () => {
    const engine = createHoleRetargetEngine();
    const before = exportCadProjectJson(engine);
    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [
        {
          op: "feature.updateHole",
          id: "feature_hole",
          targetBodyId: "body_new_target",
          direction: "positive"
        }
      ]
    });

    expect(response).toMatchObject({ ok: true, mode: "dryRun" });
    expect(exportCadProjectJson(engine)).toBe(before);
  });

  it("changes an anchor selector on the same body without reactivating its target", () => {
    const engine = createHoleRetargetEngine();
    addBodyAnchor(engine, "body_old_target", "feature_old_target");

    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.updateHole",
          id: "feature_hole",
          targetTopologyAnchorId: "anchor_body_old_target"
        }
      ]
    });

    expect(response).toMatchObject({
      ok: true,
      semanticDiff: {
        features: {
          bodiesModified: [{ id: "body_hole", featureId: "feature_hole" }],
          lifecycleEffects: [
            expect.objectContaining({
              bodyId: "body_old_target",
              primaryState: "consumed"
            }),
            expect.objectContaining({
              bodyId: "body_hole",
              primaryState: "derived-rebuild-pending"
            })
          ]
        }
      }
    });
    expect(
      response.ok
        ? (response.semanticDiff.features?.referenceEffects ?? []).some(
            (effect) =>
              effect.bodyId === "body_old_target" &&
              effect.category === "active"
          )
        : true
    ).toBe(false);
    expect(engine.getDocument().features.get("feature_hole")).toMatchObject({
      targetBodyId: "body_old_target",
      targetTopologyAnchorId: "anchor_body_old_target",
      bodyId: "body_hole"
    });
    expectRetargetLifecycle(engine, "body_old_target");
  });

  it("rejects mixed, self, consumed, missing, and unavailable-anchor targets with zero mutation", () => {
    const cases = [
      {
        op: {
          op: "feature.updateHole" as const,
          id: "feature_hole",
          targetBodyId: "body_new_target",
          targetTopologyAnchorId: "anchor_body_new_target"
        },
        code: "INVALID_TOPOLOGY_ANCHOR"
      },
      {
        op: {
          op: "feature.updateHole" as const,
          id: "feature_hole",
          targetBodyId: "body_hole"
        },
        code: "UNSUPPORTED_FEATURE_OPERATION"
      },
      {
        op: {
          op: "feature.updateHole" as const,
          id: "feature_hole",
          targetBodyId: "body_missing"
        },
        code: "BODY_NOT_FOUND"
      },
      {
        op: {
          op: "feature.updateHole" as const,
          id: "feature_hole",
          targetTopologyAnchorId: "anchor_missing"
        },
        code: "TOPOLOGY_ANCHOR_NOT_FOUND"
      }
    ];

    for (const testCase of cases) {
      const engine = createHoleRetargetEngine();
      const before = exportCadProjectJson(engine);
      const response = engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [testCase.op]
      });
      expectFailureWithoutMutation(engine, response, before, testCase.code);
    }

    const consumedEngine = createHoleRetargetEngine();
    consumedEngine.apply({
      op: "feature.hole",
      id: "feature_blocker",
      bodyId: "body_blocker",
      targetBodyId: "body_new_target",
      sketchId: "sketch_hole",
      circleEntityId: "circle_hole",
      depthMode: "throughAll",
      direction: "positive"
    });
    const consumedBefore = exportCadProjectJson(consumedEngine);
    const consumed = consumedEngine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.updateHole",
          id: "feature_hole",
          targetBodyId: "body_new_target"
        }
      ]
    });
    expectFailureWithoutMutation(
      consumedEngine,
      consumed,
      consumedBefore,
      "UNSUPPORTED_FEATURE_OPERATION"
    );

    const atomicEngine = createHoleRetargetEngine();
    const atomicBefore = exportCadProjectJson(atomicEngine);
    const atomic = atomicEngine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "sketch.rename",
          id: "sketch_targets",
          name: "Must roll back"
        },
        {
          op: "feature.updateHole",
          id: "feature_hole",
          targetBodyId: "body_missing"
        }
      ]
    });
    expectFailureWithoutMutation(
      atomicEngine,
      atomic,
      atomicBefore,
      "BODY_NOT_FOUND"
    );
  });

  it("rejects descendant chains and stale authority fences without retarget mutation", async () => {
    const descendantEngine = createHoleRetargetEngine();
    descendantEngine.apply({
      op: "feature.hole",
      id: "feature_descendant",
      bodyId: "body_descendant",
      targetBodyId: "body_hole",
      sketchId: "sketch_hole",
      circleEntityId: "circle_hole",
      depthMode: "throughAll",
      direction: "positive"
    });
    const descendantBefore = exportCadProjectJson(descendantEngine);
    const descendant = descendantEngine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.updateHole",
          id: "feature_hole",
          targetBodyId: "body_new_target"
        }
      ]
    });
    expectFailureWithoutMutation(
      descendantEngine,
      descendant,
      descendantBefore,
      "FEATURE_NOT_EDITABLE"
    );

    const staleEngine = createHoleRetargetEngine();
    const executor = new AsyncCadCommandExecutor(
      staleEngine,
      new SnapshotCadCommandWorker()
    );
    const staleEpoch = staleEngine.getSourceAuthorityEpoch();
    staleEngine.apply({
      op: "sketch.rename",
      id: "sketch_targets",
      name: "Targets changed during preflight"
    });
    const staleBefore = exportCadProjectJson(staleEngine);
    const stale = await executor.executeBatchAtSourceAuthorityEpoch(
      {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "feature.updateHole",
            id: "feature_hole",
            targetBodyId: "body_new_target"
          }
        ]
      },
      staleEpoch
    );

    expect(stale).toBeUndefined();
    expect(exportCadProjectJson(staleEngine)).toBe(staleBefore);
  });

  it("rejects imported hole dependency cycles", () => {
    const project = exportCadProject(createHoleRetargetEngine());
    const cyclicProject = {
      ...project,
      document: {
        ...project.document,
        features: [
          ...project.document.features.map((feature) =>
            feature.id === "feature_hole"
              ? { ...feature, targetBodyId: "body_cycle" }
              : feature
          ),
          {
            id: "feature_cycle",
            kind: "hole" as const,
            bodyId: "body_cycle",
            targetBodyId: "body_hole",
            sketchId: "sketch_hole",
            circleEntityId: "circle_hole",
            depthMode: "throughAll" as const,
            direction: "positive" as const
          }
        ]
      }
    };

    expect(() => importCadProject(cyclicProject)).toThrow(
      CadProjectImportError
    );
    try {
      importCadProject(cyclicProject);
    } catch (error) {
      expect(error).toBeInstanceOf(CadProjectImportError);
      expect(
        (error as CadProjectImportError).issues.some((issue) =>
          issue.message.includes("feature dependency cycle")
        )
      ).toBe(true);
    }
  });
});

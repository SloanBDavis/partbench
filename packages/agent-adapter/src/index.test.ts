import {
  CAD_PROJECT_FORMAT_VERSION_V18,
  CadEngine,
  createEmptyTopologyIdentitySourceSnapshot,
  createWcadV2CheckpointEntryPaths,
  importCadProjectJson
} from "@web-cad/cad-core";
import type {
  CadBodyDerivedExactMetadataSnapshot,
  CadOp,
  CadTopologyMatchResult
} from "@web-cad/cad-protocol";
import { describe, expect, it, vi } from "vitest";
import {
  CadOpsAgentAdapter,
  type CadOpsAgentCurrentExactEvidence,
  type CadOpsAgentQueryRequest,
  type CadOpsAgentQueryResponse,
  executeCadOpsAgentQueryRequest,
  executeCadOpsAgentRequest,
  parseCadAgentExactExportProposal,
  parseCadAgentExactExportRequest,
  parseCadAgentExactExportResult,
  parseCadOpsAgentQueryRequestJson,
  parseCadOpsAgentRequestJson
} from "./index";

function createTopologyAnchorEngine(): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "rect_1",
      center: [0, 0],
      width: 2,
      height: 2
    },
    {
      op: "feature.extrude",
      id: "feat_rect_1",
      bodyId: "body_rect_1",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 1
    }
  ]);

  const document = engine.getDocument();
  const topologyIdentity = createEmptyTopologyIdentitySourceSnapshot();
  const paths = createWcadV2CheckpointEntryPaths("checkpoint_1");

  return new CadEngine({
    ...document,
    topologyIdentity: {
      ...topologyIdentity,
      checkpoints: [
        {
          checkpointId: "checkpoint_1",
          bodyId: "body_rect_1",
          sourceFeatureId: "feat_rect_1",
          sourceIdentity: {
            algorithm: "partbench-source-v1",
            sha256:
              "1111111111111111111111111111111111111111111111111111111111111111"
          },
          packageVersion: "partbench.wcad.v2",
          projectSchemaVersion: CAD_PROJECT_FORMAT_VERSION_V18,
          brepEntryPath: paths.brep,
          topologyEntryPath: paths.topology,
          signatureEntryPath: paths.signature,
          status: "active",
          diagnostics: []
        }
      ],
      anchors: [
        {
          anchorId: "anchor_face_1",
          entityKind: "face",
          bodyId: "body_rect_1",
          checkpointId: "checkpoint_1",
          checkpointEntityId: "checkpoint-local-face-1",
          sourceFeatureId: "feat_rect_1",
          stableId: "generated:face:body_rect_1:endCap",
          sourceSemanticRole: "end cap",
          signatureHash: "face_signature_1",
          state: "active",
          diagnostics: []
        }
      ]
    }
  });
}

function createTopologyAnchorRepairEngine(): CadEngine {
  const engine = createTopologyAnchorEngine();
  const document = engine.getDocument();
  const topologyIdentity = document.topologyIdentity;
  const paths = createWcadV2CheckpointEntryPaths("checkpoint_2");

  if (!topologyIdentity) {
    throw new Error("Expected topology identity fixture.");
  }

  return new CadEngine({
    ...document,
    topologyIdentity: {
      ...topologyIdentity,
      checkpoints: [
        ...topologyIdentity.checkpoints,
        {
          checkpointId: "checkpoint_2",
          bodyId: "body_rect_1",
          sourceFeatureId: "feat_rect_1",
          sourceIdentity: {
            algorithm: "partbench-source-v1",
            sha256:
              "2222222222222222222222222222222222222222222222222222222222222222"
          },
          packageVersion: "partbench.wcad.v2",
          projectSchemaVersion: CAD_PROJECT_FORMAT_VERSION_V18,
          brepEntryPath: paths.brep,
          topologyEntryPath: paths.topology,
          signatureEntryPath: paths.signature,
          status: "active",
          diagnostics: []
        }
      ]
    }
  });
}

function createRepairPlanExactMetadata(): CadBodyDerivedExactMetadataSnapshot {
  return {
    bodyId: "body_rect_1",
    sourceIdentitySignature: "agent-test-source-signature",
    status: "ready",
    metadata: {
      source: "kernel-derived",
      confidence: "kernel-derived",
      topologySnapshot: {
        source: "kernel-derived",
        status: "ready",
        entityCounts: {
          bodyCount: 0,
          solidCount: 0,
          faceCount: 1,
          loopCount: 0,
          wireCount: 0,
          coedgeCount: 0,
          edgeCount: 0,
          vertexCount: 0,
          axisCount: 0
        },
        entityCount: 1,
        entities: [
          {
            localId: "snapshot-local:face:repaired",
            kind: "face",
            source: "kernel-derived",
            signature: "face_signature_1"
          }
        ],
        unsupportedEntityKinds: [],
        adjacencyAvailable: false,
        signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
        signature: "agent-test-topology-signature",
        diagnostics: []
      },
      diagnostics: []
    }
  };
}

function createTopologyAnchorMatchResult(): CadTopologyMatchResult {
  return {
    anchorId: "anchor_face_1",
    previousStableId: "generated:face:body_rect_1:endCap",
    candidateStableId: "generated:face:body_rect_1:endCap",
    previousCheckpointId: "checkpoint_1",
    candidateCheckpointId: "checkpoint_2",
    entityKind: "face",
    state: "replaced",
    confidence: "high",
    confidenceScore: 0.9,
    evidenceCount: 1,
    evidence: [
      {
        kind: "sourceLineage",
        confidence: "high",
        message: "Matched by source lineage."
      }
    ],
    diagnosticCount: 0,
    diagnostics: []
  };
}

describe("agent-adapter", () => {
  it("runs a CADOps dry-run batch without mutating the engine", () => {
    const engine = new CadEngine();
    const response = executeCadOpsAgentRequest(engine, {
      requestId: "agent_req_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      batch: {
        version: "cadops.v1",
        mode: "dryRun",
        ops: [
          {
            op: "scene.createBox",
            id: "preview_box",
            dimensions: { width: 1, height: 2, depth: 3 }
          }
        ]
      }
    });

    expect(response).toEqual({
      ok: true,
      requestId: "agent_req_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      mode: "dryRun",
      semanticDiff: {
        created: [{ id: "preview_box", kind: "box" }],
        modified: [],
        deleted: []
      },
      createdIds: ["preview_box"],
      modifiedIds: [],
      deletedIds: [],
      warnings: [],
      transactionId: undefined,
      audit: {
        source: "agent-adapter",
        requestId: "agent_req_1",
        intent: "dryRun",
        operationCount: 1
      },
      review: {
        requestedMode: "dryRun",
        effectiveIntent: "dryRun",
        operationCount: 1,
        entityChanges: {
          objects: { created: 1, modified: 0, deleted: 0 },
          sketches: { created: 0, modified: 0, deleted: 0 },
          sketchEntities: { created: 0, modified: 0, deleted: 0 },
          parameters: { created: 0, modified: 0, deleted: 0 },
          sketchDimensions: { created: 0, modified: 0, deleted: 0 },
          sketchConstraints: { created: 0, modified: 0, deleted: 0 },
          features: { created: 0, modified: 0, deleted: 0 },
          bodies: { created: 0, modified: 0, deleted: 0 },
          namedReferences: { created: 0, modified: 0, deleted: 0 }
        },
        operations: [
          {
            index: 0,
            op: "scene.createBox",
            intent: "create",
            label: "Create box preview_box",
            objectId: "preview_box"
          }
        ],
        audit: {
          source: "agent-adapter",
          requestId: "agent_req_1",
          intent: "dryRun",
          operationCount: 1,
          actor: {
            type: "agent",
            id: "agent-adapter",
            name: "Agent Adapter"
          }
        },
        commitGate: {
          commitsRequireExplicitPermission: true,
          dryRunsRequirePermission: false,
          permissionProvided: false,
          blocked: false,
          message: "Dry-run requested; commit permission is not required."
        },
        hints: [],
        blockers: []
      }
    });
    expect(engine.getDocument().objects.size).toBe(0);
  });

  it("passes topology checkpoint creation through cad.batch with review labels", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "rect_1",
        center: [0, 0],
        width: 2,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "feat_rect_1",
        bodyId: "body_rect_1",
        sketchId: "sketch_1",
        entityId: "rect_1",
        depth: 1
      }
    ]);
    const op = {
      op: "topology.checkpoint.create" as const,
      checkpointId: "checkpoint_agent_1",
      bodyId: "body_rect_1",
      sourceIdentity: {
        algorithm: "partbench-source-v1" as const,
        sha256:
          "5555555555555555555555555555555555555555555555555555555555555555"
      },
      status: "missing" as const
    };

    const response = executeCadOpsAgentRequest(engine, {
      requestId: "agent_req_topology_checkpoint",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [op]
      }
    });

    expect(response).toMatchObject({
      ok: true,
      mode: "commit",
      review: {
        operations: [
          expect.objectContaining({
            op: "topology.checkpoint.create",
            intent: "create",
            bodyId: "body_rect_1",
            label:
              "Create topology checkpoint checkpoint_agent_1 for body_rect_1"
          })
        ]
      }
    });
    expect(engine.getDocument().topologyIdentity?.checkpoints).toEqual([
      expect.objectContaining({
        checkpointId: "checkpoint_agent_1",
        status: "missing"
      })
    ]);
  });

  it("passes topology anchor commands through cad.batch with review labels", () => {
    const engine = createTopologyAnchorEngine();
    const op = {
      op: "topology.anchor.create" as const,
      anchorId: "anchor_face_2",
      entityKind: "face" as const,
      bodyId: "body_rect_1",
      checkpointId: "checkpoint_1",
      checkpointEntityId: "checkpoint-local-face-2",
      stableId: "generated:face:body_rect_1:startCap"
    };
    const dryRun = executeCadOpsAgentRequest(engine, {
      requestId: "agent_req_topology_anchor_dry",
      adapterVersion: "web-cad.agent-adapter.v1",
      batch: {
        version: "cadops.v1",
        mode: "dryRun",
        ops: [op]
      }
    });

    expect(dryRun).toMatchObject({
      ok: true,
      mode: "dryRun",
      review: {
        entityChanges: {
          namedReferences: { created: 1, modified: 0, deleted: 0 }
        },
        operations: [
          expect.objectContaining({
            op: "topology.anchor.create",
            intent: "create",
            bodyId: "body_rect_1",
            stableId: "generated:face:body_rect_1:startCap"
          })
        ]
      }
    });
    expect(
      engine
        .getDocument()
        .topologyIdentity?.anchors.some(
          (anchor) => anchor.anchorId === "anchor_face_2"
        )
    ).toBe(false);

    const commit = executeCadOpsAgentRequest(engine, {
      requestId: "agent_req_topology_anchor_commit",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [op]
      }
    });

    expect(commit).toMatchObject({
      ok: true,
      mode: "commit",
      review: {
        entityChanges: {
          namedReferences: { created: 1, modified: 0, deleted: 0 }
        }
      }
    });
    expect(engine.getDocument().topologyIdentity?.anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ anchorId: "anchor_face_2" })
      ])
    );
  });

  it("runs a CADOps commit batch and returns the transaction ID", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.execute({
      requestId: "agent_req_2",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      actor: {
        type: "agent",
        id: "fixture-agent",
        name: "Fixture Agent"
      },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createCylinder",
            id: "committed_cylinder",
            dimensions: { radius: 2, height: 8 }
          }
        ]
      }
    });

    expect(response).toEqual({
      ok: true,
      requestId: "agent_req_2",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      mode: "commit",
      semanticDiff: {
        created: [{ id: "committed_cylinder", kind: "cylinder" }],
        modified: [],
        deleted: []
      },
      createdIds: ["committed_cylinder"],
      modifiedIds: [],
      deletedIds: [],
      warnings: [],
      transactionId: "txn_1",
      actor: {
        type: "agent",
        id: "fixture-agent",
        name: "Fixture Agent"
      },
      audit: {
        source: "agent-adapter",
        requestId: "agent_req_2",
        intent: "commit",
        operationCount: 1
      },
      review: {
        requestedMode: "commit",
        effectiveIntent: "commit",
        operationCount: 1,
        entityChanges: {
          objects: { created: 1, modified: 0, deleted: 0 },
          sketches: { created: 0, modified: 0, deleted: 0 },
          sketchEntities: { created: 0, modified: 0, deleted: 0 },
          parameters: { created: 0, modified: 0, deleted: 0 },
          sketchDimensions: { created: 0, modified: 0, deleted: 0 },
          sketchConstraints: { created: 0, modified: 0, deleted: 0 },
          features: { created: 0, modified: 0, deleted: 0 },
          bodies: { created: 0, modified: 0, deleted: 0 },
          namedReferences: { created: 0, modified: 0, deleted: 0 }
        },
        operations: [
          {
            index: 0,
            op: "scene.createCylinder",
            intent: "create",
            label: "Create cylinder committed_cylinder",
            objectId: "committed_cylinder"
          }
        ],
        audit: {
          source: "agent-adapter",
          requestId: "agent_req_2",
          intent: "commit",
          operationCount: 1,
          actor: {
            type: "agent",
            id: "fixture-agent",
            name: "Fixture Agent"
          }
        },
        commitGate: {
          commitsRequireExplicitPermission: true,
          dryRunsRequirePermission: false,
          permissionProvided: true,
          blocked: false,
          message:
            "Commit requested and explicitly allowed by adapter permissions."
        },
        hints: [],
        blockers: []
      }
    });
    expect(adapter.getEngine().getTransactions()[0]?.actor).toEqual({
      type: "agent",
      id: "fixture-agent",
      name: "Fixture Agent"
    });
    expect(adapter.getEngine().getTransactions()[0]?.audit).toEqual(
      response.audit
    );
    expect(
      adapter.getEngine().executeQuery({
        version: "cadops.v1",
        query: { query: "transaction.history" }
      })
    ).toMatchObject({
      ok: true,
      query: "transaction.history",
      transactionCount: 1,
      transactions: [
        {
          id: "txn_1",
          actor: {
            type: "agent",
            id: "fixture-agent",
            name: "Fixture Agent"
          },
          audit: response.audit
        }
      ]
    });
    expect(
      adapter.getEngine().getDocument().objects.get("committed_cylinder")?.kind
    ).toBe("cylinder");
  });

  it("blocks commit batches unless the caller explicitly allows commit", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.execute({
      requestId: "agent_req_blocked_commit",
      adapterVersion: "web-cad.agent-adapter.v1",
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createBox",
            id: "blocked_box",
            dimensions: { width: 1, height: 1, depth: 1 }
          }
        ]
      }
    });

    expect(response).toMatchObject({
      ok: false,
      requestId: "agent_req_blocked_commit",
      mode: "commit",
      error: {
        code: "COMMIT_NOT_ALLOWED",
        path: "$.permissions.allowCommit",
        expected: "true",
        received: "false"
      },
      audit: {
        source: "agent-adapter",
        requestId: "agent_req_blocked_commit",
        intent: "commit",
        operationCount: 1
      },
      review: {
        requestedMode: "commit",
        effectiveIntent: "commit",
        operationCount: 1,
        entityChanges: {
          objects: { created: 0, modified: 0, deleted: 0 }
        },
        operations: [
          {
            index: 0,
            op: "scene.createBox",
            intent: "create",
            label: "Create box blocked_box",
            objectId: "blocked_box"
          }
        ],
        audit: {
          source: "agent-adapter",
          requestId: "agent_req_blocked_commit",
          intent: "commit",
          operationCount: 1,
          actor: {
            type: "agent",
            id: "agent-adapter",
            name: "Agent Adapter"
          }
        },
        commitGate: {
          permissionProvided: false,
          blocked: true
        },
        blockers: [
          {
            code: "COMMIT_NOT_ALLOWED",
            severity: "blocker",
            path: "$.permissions.allowCommit"
          }
        ]
      }
    });
    expect(adapter.getEngine().getDocument().objects.size).toBe(0);
  });

  it("returns importable Partbench project JSON when agent batch handoff is requested", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.execute({
      requestId: "agent_req_project_handoff",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      projectHandoff: { includeProjectJson: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createBox",
            id: "handoff_box",
            dimensions: { width: 1, height: 2, depth: 3 }
          }
        ]
      }
    });

    expect(response).toMatchObject({
      ok: true,
      projectHandoff: {
        kind: "partbenchProjectJson",
        importTarget: "Partbench JSON import",
        sourceBoundaryNote:
          "Project JSON contains Partbench project source only; it does not include renderer IDs, mesh IDs, OCCT handles, viewport state, OPFS paths, or file handles."
      }
    });
    expect(response.ok && response.projectHandoff?.schemaVersion).toBe(
      response.ok && response.projectHandoff?.project.schemaVersion
    );
    expect(
      response.ok && response.projectHandoff?.project.document.objects
    ).toContainEqual(
      expect.objectContaining({ id: "handoff_box", kind: "box" })
    );
    expect(
      JSON.parse((response.ok && response.projectHandoff?.projectJson) || "{}")
    ).toMatchObject({
      schemaVersion: response.ok && response.projectHandoff?.schemaVersion,
      document: {
        objects: [expect.objectContaining({ id: "handoff_box", kind: "box" })]
      }
    });

    const importedEngine = importCadProjectJson(
      (response.ok && response.projectHandoff?.projectJson) || "{}"
    );

    expect(
      importedEngine.getDocument().objects.get("handoff_box")
    ).toMatchObject({
      id: "handoff_box",
      kind: "box"
    });
    expect(JSON.stringify(response)).not.toMatch(
      /rendererId|meshId|occtId|opfsPath|fileHandle/i
    );
  });

  it("returns dry-run project handoff from an isolated preview without mutating the adapter engine", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.execute({
      requestId: "agent_req_dry_project_handoff",
      adapterVersion: "web-cad.agent-adapter.v1",
      projectHandoff: { includeProjectJson: true },
      batch: {
        version: "cadops.v1",
        mode: "dryRun",
        ops: [
          {
            op: "scene.createCylinder",
            id: "preview_cylinder",
            dimensions: { radius: 1, height: 2 }
          }
        ]
      }
    });

    expect(response).toMatchObject({
      ok: true,
      mode: "dryRun",
      projectHandoff: {
        kind: "partbenchProjectJson",
        importTarget: "Partbench JSON import",
        sourceBoundaryNote:
          "Preview project JSON was generated from an isolated dry-run engine. It contains Partbench project source only; it does not include renderer IDs, mesh IDs, OCCT handles, viewport state, OPFS paths, or file handles."
      }
    });
    expect(
      response.ok && response.projectHandoff?.project.document.objects
    ).toContainEqual(
      expect.objectContaining({ id: "preview_cylinder", kind: "cylinder" })
    );
    expect(adapter.getEngine().getDocument().objects.size).toBe(0);
    expect(adapter.getEngine().getTransactions()).toHaveLength(0);
  });

  it("reviews both arc definitions and construction toggles without changing legacy reviews", () => {
    const adapter = new CadOpsAgentAdapter();
    const request = parseCadOpsAgentRequestJson(
      JSON.stringify({
        requestId: "agent_req_v17_arc_review",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_arc",
              name: "Arc sketch",
              plane: "XY"
            },
            {
              op: "sketch.addLine",
              sketchId: "sketch_arc",
              id: "line_legacy",
              start: [0, 0],
              end: [1, 0]
            },
            {
              op: "sketch.addArc",
              sketchId: "sketch_arc",
              id: "arc_center",
              construction: true,
              definition: {
                kind: "centerAngles",
                center: [0, 0],
                radius: 2,
                startAngleDegrees: 0,
                sweepAngleDegrees: 90
              }
            },
            {
              op: "sketch.addArc",
              sketchId: "sketch_arc",
              id: "arc_three_point",
              definition: {
                kind: "threePoint",
                start: [1, 0],
                pointOnArc: [0, 1],
                end: [-1, 0]
              }
            },
            {
              op: "sketch.setEntityConstruction",
              sketchId: "sketch_arc",
              entityId: "arc_center",
              construction: false
            }
          ]
        }
      })
    );

    const response = adapter.execute(request);

    expect(response.ok).toBe(true);
    expect(response.ok && response.review.operations).toEqual(
      expect.arrayContaining([
        {
          index: 1,
          op: "sketch.addLine",
          intent: "create",
          label: "Add line line_legacy to sketch_arc",
          sketchId: "sketch_arc",
          sketchEntityId: "line_legacy"
        },
        {
          index: 2,
          op: "sketch.addArc",
          intent: "create",
          label:
            "Add center-angle arc arc_center to sketch_arc as construction geometry",
          sketchId: "sketch_arc",
          sketchEntityId: "arc_center",
          construction: true,
          arcDefinition: "centerAngles"
        },
        {
          index: 3,
          op: "sketch.addArc",
          intent: "create",
          label:
            "Add three-point arc arc_three_point to sketch_arc as regular geometry",
          sketchId: "sketch_arc",
          sketchEntityId: "arc_three_point",
          construction: false,
          arcDefinition: "threePoint"
        },
        {
          index: 4,
          op: "sketch.setEntityConstruction",
          intent: "modify",
          label: "Set arc_center in sketch_arc to regular geometry",
          sketchId: "sketch_arc",
          sketchEntityId: "arc_center",
          construction: false
        }
      ])
    );
    expect(JSON.stringify(response.review)).not.toMatch(
      /circumcenter|tessell|kernel|occt|solver/i
    );
  });

  it("returns a reviewable dry-run preview for a representative V7 workflow", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.execute({
      requestId: "agent_req_workflow_preview",
      adapterVersion: "web-cad.agent-adapter.v1",
      actor: {
        type: "agent",
        id: "workflow-agent",
        name: "Workflow Agent"
      },
      source: {
        source: "agent-workflow-preview",
        toolName: "cad.batch"
      },
      batch: {
        version: "cadops.v1",
        mode: "dryRun",
        ops: [
          {
            op: "sketch.create",
            id: "sketch_preview",
            name: "Preview profile",
            plane: "XY"
          },
          {
            op: "sketch.addRectangle",
            sketchId: "sketch_preview",
            id: "rect_preview",
            center: [0, 0],
            width: 4,
            height: 2
          },
          {
            op: "sketch.addCircle",
            sketchId: "sketch_preview",
            id: "circle_preview",
            center: [1, 0],
            radius: 0.25
          },
          {
            op: "feature.extrude",
            id: "feat_preview",
            bodyId: "body_preview",
            sketchId: "sketch_preview",
            entityId: "rect_preview",
            depth: 6
          },
          {
            op: "reference.nameGenerated",
            name: "Preview end face",
            bodyId: "body_preview",
            stableId: "generated:face:body_preview:endCap"
          }
        ]
      }
    });

    expect(response).toMatchObject({
      ok: true,
      mode: "dryRun",
      createdSketchIds: ["sketch_preview"],
      createdSketchEntityIds: ["rect_preview", "circle_preview"],
      createdFeatureIds: ["feat_preview"],
      createdBodyIds: ["body_preview"],
      review: {
        requestedMode: "dryRun",
        effectiveIntent: "dryRun",
        operationCount: 5,
        entityChanges: {
          sketches: { created: 1, modified: 0, deleted: 0 },
          sketchEntities: { created: 2, modified: 0, deleted: 0 },
          features: { created: 1, modified: 0, deleted: 0 },
          bodies: { created: 1, modified: 0, deleted: 0 },
          namedReferences: { created: 1, modified: 0, deleted: 0 }
        },
        operations: [
          {
            index: 0,
            op: "sketch.create",
            intent: "create",
            label: "Create sketch sketch_preview on XY",
            sketchId: "sketch_preview"
          },
          {
            index: 1,
            op: "sketch.addRectangle",
            intent: "create",
            label: "Add rectangle rect_preview to sketch_preview",
            sketchId: "sketch_preview",
            sketchEntityId: "rect_preview"
          },
          {
            index: 2,
            op: "sketch.addCircle",
            intent: "create",
            label: "Add circle circle_preview to sketch_preview",
            sketchId: "sketch_preview",
            sketchEntityId: "circle_preview"
          },
          {
            index: 3,
            op: "feature.extrude",
            intent: "create",
            label:
              "Create new body extrude feature feat_preview from sketch_preview/rect_preview",
            sketchId: "sketch_preview",
            sketchEntityId: "rect_preview",
            featureId: "feat_preview",
            bodyId: "body_preview"
          },
          {
            index: 4,
            op: "reference.nameGenerated",
            intent: "create",
            label: "Name generated reference Preview end face on body_preview",
            referenceName: "Preview end face",
            bodyId: "body_preview",
            stableId: "generated:face:body_preview:endCap"
          }
        ],
        audit: {
          source: "agent-workflow-preview",
          requestId: "agent_req_workflow_preview",
          toolName: "cad.batch",
          intent: "dryRun",
          operationCount: 5,
          actor: {
            type: "agent",
            id: "workflow-agent",
            name: "Workflow Agent"
          }
        },
        commitGate: {
          permissionProvided: false,
          blocked: false
        },
        hints: [],
        blockers: []
      }
    });
    if (!response.ok) {
      throw new Error("Expected workflow preview to succeed.");
    }
    expect(response.transactionId).toBeUndefined();
    expect(adapter.getEngine().getDocument().sketches.size).toBe(0);
    expect(adapter.getEngine().getDocument().features.size).toBe(0);
    expect(
      adapter.getEngine().executeQuery({
        version: "cadops.v1",
        query: { query: "project.structure" }
      })
    ).toMatchObject({
      ok: true,
      bodyCount: 0
    });
    expect(JSON.stringify(response.review)).not.toMatch(
      /\b(mesh|occt|renderer|selection-buffer)\b/i
    );
  });

  it("returns structured CADOps validation errors", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.execute({
      requestId: "agent_req_3",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.deleteObject",
            id: "missing_object"
          }
        ]
      }
    });

    expect(response).toMatchObject({
      ok: false,
      requestId: "agent_req_3",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      mode: "commit",
      error: {
        code: "OBJECT_NOT_FOUND",
        message: "Object does not exist: missing_object",
        opIndex: 0,
        op: "scene.deleteObject",
        objectId: "missing_object",
        path: "$.ops[0].id"
      },
      errors: [
        expect.objectContaining({
          code: "OBJECT_NOT_FOUND",
          message: "Object does not exist: missing_object",
          opIndex: 0,
          op: "scene.deleteObject",
          objectId: "missing_object",
          path: "$.ops[0].id"
        })
      ],
      createdIds: [],
      modifiedIds: [],
      deletedIds: [],
      warnings: [],
      review: {
        requestedMode: "commit",
        effectiveIntent: "commit",
        operationCount: 1,
        operations: [
          {
            index: 0,
            op: "scene.deleteObject",
            intent: "delete",
            label: "Delete object missing_object",
            objectId: "missing_object",
            destructive: true
          }
        ],
        hints: [
          {
            code: "DESTRUCTIVE_DELETE",
            severity: "warning",
            opIndex: 0,
            op: "scene.deleteObject"
          }
        ],
        blockers: [
          {
            code: "VALIDATION_ERROR",
            severity: "blocker",
            errorCode: "OBJECT_NOT_FOUND",
            opIndex: 0,
            op: "scene.deleteObject",
            path: "$.ops[0].id"
          }
        ]
      }
    });
  });

  it("returns an empty-batch review blocker", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.execute({
      requestId: "agent_req_empty_batch",
      adapterVersion: "web-cad.agent-adapter.v1",
      batch: {
        version: "cadops.v1",
        mode: "dryRun",
        ops: []
      }
    });

    expect(response).toMatchObject({
      ok: false,
      requestId: "agent_req_empty_batch",
      mode: "dryRun",
      error: {
        code: "EMPTY_BATCH"
      },
      review: {
        requestedMode: "dryRun",
        effectiveIntent: "dryRun",
        operationCount: 0,
        operations: [],
        blockers: [
          {
            code: "EMPTY_BATCH",
            severity: "blocker",
            message: "Batch has no operations to review or execute."
          }
        ]
      }
    });
    expect(adapter.getEngine().getTransactions()).toEqual([]);
  });

  it("surfaces non-empty CADOps warnings as review hints", () => {
    const adapter = new CadOpsAgentAdapter({
      executeBatch: () => ({
        ok: true,
        mode: "dryRun",
        createdIds: [],
        modifiedIds: [],
        deletedIds: [],
        warnings: ["Synthetic warning for review coverage."]
      })
    } as unknown as CadEngine);

    const response = adapter.execute({
      requestId: "agent_req_warning_hint",
      adapterVersion: "web-cad.agent-adapter.v1",
      batch: {
        version: "cadops.v1",
        mode: "dryRun",
        ops: [
          {
            op: "scene.createBox",
            id: "warning_box",
            dimensions: { width: 1, height: 1, depth: 1 }
          }
        ]
      }
    });

    expect(response).toMatchObject({
      ok: true,
      warnings: ["Synthetic warning for review coverage."],
      review: {
        hints: [
          {
            code: "WARNINGS_PRESENT",
            severity: "warning",
            message:
              "CADOps returned 1 warning(s); review warnings before commit."
          }
        ]
      }
    });
  });

  it("returns structured unit update mode validation errors", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.execute({
      requestId: "agent_req_bad_unit_mode",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "document.updateUnits",
            units: "in",
            mode: "reinterpret" as never
          }
        ]
      }
    });

    expect(response).toMatchObject({
      ok: false,
      requestId: "agent_req_bad_unit_mode",
      error: {
        code: "INVALID_UNIT_UPDATE_MODE",
        path: "$.ops[0].mode",
        expected: "metadataOnly or preservePhysicalSize",
        received: "reinterpret"
      },
      createdIds: [],
      modifiedIds: [],
      deletedIds: [],
      warnings: []
    });
    expect(adapter.getEngine().getTransactions()).toEqual([]);
  });

  it("returns structured actor validation errors from CADOps", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.execute({
      requestId: "agent_req_bad_actor",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      actor: {
        type: "robot" as never
      },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createBox",
            id: "box_1",
            dimensions: { width: 1, height: 1, depth: 1 }
          }
        ]
      }
    });

    expect(response).toMatchObject({
      ok: false,
      requestId: "agent_req_bad_actor",
      error: {
        code: "INVALID_ACTOR",
        path: "$.actor.type",
        expected: "human, agent, script, or system",
        received: "robot"
      }
    });
    expect(adapter.getEngine().getTransactions()).toEqual([]);
  });

  it("supports JSON request parsing for external callers", () => {
    const adapter = new CadOpsAgentAdapter();
    const request = parseCadOpsAgentRequestJson(
      JSON.stringify({
        requestId: "agent_req_json",
        adapterVersion: "web-cad.agent-adapter.v1",
        permissions: { allowCommit: true },
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "scene.createBox",
              id: "json_box",
              dimensions: { width: 4, height: 5, depth: 6 }
            },
            {
              op: "scene.updateTransform",
              id: "json_box",
              transform: { translation: [1, 2, 3] }
            },
            {
              op: "scene.updateBoxDimensions",
              id: "json_box",
              dimensions: { width: 7, height: 8, depth: 9 }
            },
            {
              op: "scene.renameObject",
              id: "json_box",
              name: "JSON box"
            },
            {
              op: "document.updateUnits",
              units: "in"
            }
          ]
        }
      })
    );

    const responseJson = adapter.executeJson(JSON.stringify(request));
    const response = JSON.parse(responseJson) as {
      readonly ok: boolean;
      readonly requestId: string;
      readonly createdIds: readonly string[];
      readonly modifiedIds: readonly string[];
      readonly transactionId?: string;
    };

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_req_json",
      createdIds: ["json_box"],
      modifiedIds: ["json_box"],
      transactionId: "txn_1"
    });
    expect(
      adapter.getEngine().getDocument().objects.get("json_box")?.transform
        .translation
    ).toEqual([1, 2, 3]);
    expect(
      adapter.getEngine().getDocument().objects.get("json_box")?.dimensions
    ).toEqual({ width: 7, height: 8, depth: 9 });
    expect(
      adapter.getEngine().getDocument().objects.get("json_box")?.name
    ).toBe("JSON box");
    expect(adapter.getEngine().getDocument().units).toBe("in");
  });

  it("accepts and reviews mirror feature batches from external JSON callers (Slice F pass-through)", () => {
    const adapter = new CadOpsAgentAdapter();
    const request = parseCadOpsAgentRequestJson(
      JSON.stringify({
        requestId: "agent_req_mirror",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_m",
              name: "Profile",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_m",
              id: "rect_m",
              center: [1, 1],
              width: 4,
              height: 2
            },
            {
              op: "feature.extrude",
              id: "feat_seed",
              bodyId: "body_seed",
              sketchId: "sketch_m",
              entityId: "rect_m",
              depth: 3
            },
            {
              op: "feature.mirror",
              id: "feat_mirror",
              bodyId: "body_mirror",
              seedBodyId: "body_seed",
              mirrorPlane: "YZ",
              includeOriginal: true
            },
            { op: "feature.updateMirror", id: "feat_mirror", mirrorPlane: "XZ" }
          ]
        }
      })
    );

    const response = adapter.execute(request);

    expect(response.ok).toBe(true);
    expect(response.ok && response.review.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: "feature.mirror",
          intent: "create",
          featureId: "feat_mirror",
          bodyId: "body_mirror",
          targetBodyId: "body_seed",
          label: expect.stringContaining("union with original")
        }),
        expect.objectContaining({
          op: "feature.updateMirror",
          intent: "modify",
          featureId: "feat_mirror"
        })
      ])
    );
  });

  it("accepts and reviews feature.combine batches from external JSON callers", () => {
    const adapter = new CadOpsAgentAdapter();
    const request = parseCadOpsAgentRequestJson(
      JSON.stringify({
        requestId: "agent_req_combine",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            { op: "sketch.create", id: "sketch_hub", name: "Hub", plane: "XY" },
            {
              op: "sketch.addCircle",
              sketchId: "sketch_hub",
              id: "circle_hub",
              center: [0, 0],
              radius: 20
            },
            {
              op: "feature.extrude",
              id: "feat_hub",
              bodyId: "body_hub",
              sketchId: "sketch_hub",
              entityId: "circle_hub",
              depth: 10
            },
            {
              op: "sketch.create",
              id: "sketch_step",
              name: "Step",
              plane: "XY"
            },
            {
              op: "sketch.addCircle",
              sketchId: "sketch_step",
              id: "circle_step",
              center: [0, 0],
              radius: 12
            },
            {
              op: "feature.extrude",
              id: "feat_step",
              bodyId: "body_step",
              sketchId: "sketch_step",
              entityId: "circle_step",
              depth: 8
            },
            {
              op: "feature.combine",
              id: "feat_union",
              bodyId: "body_pulley",
              mode: "union",
              targetBodyId: "body_hub",
              toolBodyId: "body_step"
            }
          ]
        }
      })
    );

    const response = adapter.execute(request);

    expect(response.ok).toBe(true);
    expect(response.ok && response.review.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: "feature.combine",
          intent: "create",
          featureId: "feat_union",
          bodyId: "body_pulley",
          targetBodyId: "body_hub",
          label: expect.stringContaining("union")
        })
      ])
    );
  });

  it("accepts and reviews feature.combine intersect batches from external JSON callers", () => {
    const adapter = new CadOpsAgentAdapter();
    const request = parseCadOpsAgentRequestJson(
      JSON.stringify({
        requestId: "agent_req_combine_intersect",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_block_a",
              name: "Block A",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_block_a",
              id: "rect_a",
              center: [0, 0],
              width: 20,
              height: 20
            },
            {
              op: "feature.extrude",
              id: "feat_block_a",
              bodyId: "body_block_a",
              sketchId: "sketch_block_a",
              entityId: "rect_a",
              depth: 10
            },
            {
              op: "sketch.create",
              id: "sketch_block_b",
              name: "Block B",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_block_b",
              id: "rect_b",
              center: [10, 0],
              width: 20,
              height: 20
            },
            {
              op: "feature.extrude",
              id: "feat_block_b",
              bodyId: "body_block_b",
              sketchId: "sketch_block_b",
              entityId: "rect_b",
              depth: 10
            },
            {
              op: "feature.combine",
              id: "feat_intersect",
              bodyId: "body_overlap",
              mode: "intersect",
              targetBodyId: "body_block_a",
              toolBodyId: "body_block_b"
            }
          ]
        }
      })
    );

    const response = adapter.execute(request);

    expect(response.ok).toBe(true);
    expect(response.ok && response.review.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: "feature.combine",
          intent: "create",
          featureId: "feat_intersect",
          bodyId: "body_overlap",
          targetBodyId: "body_block_a",
          label: expect.stringContaining("intersect")
        })
      ])
    );
  });

  it("accepts and reviews feature.align batches from external JSON callers", () => {
    const adapter = new CadOpsAgentAdapter();
    const request = parseCadOpsAgentRequestJson(
      JSON.stringify({
        requestId: "agent_req_align",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            { op: "sketch.create", id: "sketch_target", name: "Target", plane: "XY" },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_target",
              id: "rect_target",
              center: [0, 0],
              width: 20,
              height: 20
            },
            {
              op: "feature.extrude",
              id: "feat_target",
              bodyId: "body_target",
              sketchId: "sketch_target",
              entityId: "rect_target",
              depth: 10
            },
            {
              op: "sketch.create",
              id: "sketch_source_face",
              name: "Face source",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_source_face",
              id: "rect_source_face",
              center: [40, 0],
              width: 10,
              height: 10
            },
            {
              op: "feature.extrude",
              id: "feat_source_face",
              bodyId: "body_source_face",
              sketchId: "sketch_source_face",
              entityId: "rect_source_face",
              depth: 8
            },
            {
              op: "feature.align",
              id: "feat_align_face",
              bodyId: "body_align_face",
              seedBodyId: "body_source_face",
              sourceFace: {
                kind: "generatedFace",
                bodyId: "body_source_face",
                stableId: "generated:face:body_source_face:endCap"
              },
              target: {
                kind: "planarFace",
                face: {
                  kind: "generatedFace",
                  bodyId: "body_target",
                  stableId: "generated:face:body_target:endCap"
                }
              }
            }
          ]
        }
      })
    );

    const response = adapter.execute(request);

    expect(response.ok).toBe(true);
    expect(response.ok && response.review.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: "feature.align",
          intent: "create",
          featureId: "feat_align_face",
          bodyId: "body_align_face",
          targetBodyId: "body_source_face",
          label: expect.stringContaining("planar face")
        })
      ])
    );
  });

  it("accepts and reviews feature.draft batches from external JSON callers", () => {
    const adapter = new CadOpsAgentAdapter();
    const request = parseCadOpsAgentRequestJson(
      JSON.stringify({
        requestId: "agent_req_draft",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            { op: "sketch.create", id: "sketch_block", name: "Block", plane: "XY" },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_block",
              id: "rect_block",
              center: [0, 0],
              width: 10,
              height: 10
            },
            {
              op: "feature.extrude",
              id: "feat_block",
              bodyId: "body_block",
              sketchId: "sketch_block",
              entityId: "rect_block",
              depth: 8
            },
            {
              op: "feature.draft",
              id: "feat_draft_side",
              bodyId: "body_draft_side",
              targetBodyId: "body_block",
              faces: [
                {
                  kind: "generatedFace",
                  bodyId: "body_block",
                  stableId: "generated:face:body_block:side:uMax"
                }
              ],
              angleDegrees: 10,
              neutralPlane: {
                kind: "planarFace",
                face: {
                  kind: "generatedFace",
                  bodyId: "body_block",
                  stableId: "generated:face:body_block:startCap"
                }
              }
            }
          ]
        }
      })
    );

    const response = adapter.execute(request);

    expect(response.ok).toBe(true);
    expect(response.ok && response.review.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: "feature.draft",
          intent: "create",
          featureId: "feat_draft_side",
          bodyId: "body_draft_side",
          targetBodyId: "body_block",
          label: expect.stringContaining("10°")
        })
      ])
    );
  });

  it("accepts and reviews feature.offset batches from external JSON callers", () => {
    const adapter = new CadOpsAgentAdapter();
    const request = parseCadOpsAgentRequestJson(
      JSON.stringify({
        requestId: "agent_req_offset",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            { op: "sketch.create", id: "sketch_plate", name: "Plate", plane: "XY" },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_plate",
              id: "rect_plate",
              center: [0, 0],
              width: 20,
              height: 12
            },
            {
              op: "feature.offset",
              id: "feat_profile_offset",
              bodyId: "body_profile_offset",
              source: {
                kind: "sketchProfile",
                profile: {
                  kind: "entity",
                  sketchId: "sketch_plate",
                  entityId: "rect_plate"
                }
              },
              distance: 4,
              side: "outward"
            },
            {
              op: "feature.updateOffset",
              id: "feat_profile_offset",
              distance: 6
            }
          ]
        }
      })
    );

    const response = adapter.execute(request);

    expect(response.ok).toBe(true);
    expect(response.ok && response.review.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: "feature.offset",
          intent: "create",
          featureId: "feat_profile_offset",
          bodyId: "body_profile_offset",
          label: expect.stringContaining("sketch profile")
        }),
        expect.objectContaining({
          op: "feature.updateOffset",
          intent: "modify",
          featureId: "feat_profile_offset"
        })
      ])
    );
  });

  it("accepts and reviews datum.axis.create and circular pattern around that axis", () => {
    const adapter = new CadOpsAgentAdapter();
    const request = parseCadOpsAgentRequestJson(
      JSON.stringify({
        requestId: "agent_req_datum_axis",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            { op: "sketch.create", id: "sketch_block", name: "Block", plane: "XY" },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_block",
              id: "rect_block",
              center: [20, 0],
              width: 10,
              height: 10
            },
            {
              op: "feature.extrude",
              id: "feat_block",
              bodyId: "body_block",
              sketchId: "sketch_block",
              entityId: "rect_block",
              depth: 8
            },
            {
              op: "datum.axis.create",
              id: "datum_axis_z",
              name: "Z axis",
              axis: { kind: "globalAxis", axis: "z" }
            },
            {
              op: "feature.circularPattern",
              id: "feat_pattern",
              bodyId: "body_patterned",
              seedBodyId: "body_block",
              rotationAxis: { kind: "datumAxis", datumId: "datum_axis_z" },
              totalAngleDegrees: 360,
              instanceCount: 4
            }
          ]
        }
      })
    );
    const response = adapter.execute(request);

    expect(response.ok).toBe(true);
    expect(response.ok && response.review.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: "datum.axis.create",
          intent: "create",
          datumId: "datum_axis_z",
          label: expect.stringContaining("datum axis")
        }),
        expect.objectContaining({
          op: "feature.circularPattern",
          intent: "create",
          label: expect.stringContaining("datum_axis_z")
        })
      ])
    );
  });

  it("accepts and reviews a grown extrude-add feature-pattern batch", () => {
    const adapter = new CadOpsAgentAdapter();
    const request = parseCadOpsAgentRequestJson(
      JSON.stringify({
        requestId: "agent_req_extrude_add_pattern",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            { op: "sketch.create", id: "sketch_plate", name: "Plate", plane: "XY" },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_plate",
              id: "rect_plate",
              center: [0, 0],
              width: 60,
              height: 24
            },
            {
              op: "feature.extrude",
              id: "feat_plate",
              bodyId: "body_plate",
              sketchId: "sketch_plate",
              entityId: "rect_plate",
              depth: 6
            },
            { op: "sketch.create", id: "sketch_boss", name: "Boss", plane: "XY" },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_boss",
              id: "rect_boss",
              center: [-16, 0],
              width: 8,
              height: 8
            },
            {
              op: "feature.extrude",
              id: "feat_boss",
              bodyId: "body_boss",
              sketchId: "sketch_boss",
              entityId: "rect_boss",
              depth: 10,
              operationMode: "add",
              targetBodyId: "body_plate"
            },
            {
              op: "feature.linearPattern",
              id: "feat_pattern",
              bodyId: "body_patterned",
              seedFeatureId: "feat_boss",
              direction: { kind: "globalAxis", axis: "x" },
              spacing: 16,
              instanceCount: 3
            }
          ]
        }
      })
    );
    const response = adapter.execute(request);

    expect(response.ok).toBe(true);
    expect(response.ok && response.review.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: "feature.extrude",
          intent: "create",
          featureId: "feat_boss",
          operationMode: "add"
        }),
        expect.objectContaining({
          op: "feature.linearPattern",
          intent: "create",
          featureId: "feat_pattern",
          label: expect.stringContaining("feat_boss")
        })
      ])
    );
  });

  it("accepts and reviews datum.plane.create and sketch.create on a datum", () => {
    const adapter = new CadOpsAgentAdapter();
    const request = parseCadOpsAgentRequestJson(
      JSON.stringify({
        requestId: "agent_req_datums",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "datum.plane.create",
              id: "datum_ear_a",
              name: "Ear A",
              plane: { kind: "standardPlane", plane: "XZ", offset: 15 }
            },
            {
              op: "sketch.create",
              id: "sketch_ear_a",
              name: "Ear A",
              datumId: "datum_ear_a"
            }
          ]
        }
      })
    );
    const response = adapter.execute(request);

    expect(response.ok).toBe(true);
    expect(response.ok && response.review.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: "datum.plane.create",
          intent: "create",
          datumId: "datum_ear_a",
          label: expect.stringContaining("datum")
        }),
        expect.objectContaining({
          op: "sketch.create",
          intent: "create",
          sketchId: "sketch_ear_a",
          datumId: "datum_ear_a",
          label: expect.stringContaining("datum_ear_a")
        })
      ])
    );
  });

  it("accepts and reviews shell feature batches from external JSON callers (Slice G pass-through)", () => {
    const adapter = new CadOpsAgentAdapter();
    const request = parseCadOpsAgentRequestJson(
      JSON.stringify({
        requestId: "agent_req_shell",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "sketch.create",
              id: "sketch_s",
              name: "Profile",
              plane: "XY"
            },
            {
              op: "sketch.addRectangle",
              sketchId: "sketch_s",
              id: "rect_s",
              center: [0, 0],
              width: 4,
              height: 2
            },
            {
              op: "feature.extrude",
              id: "feat_seed",
              bodyId: "body_seed",
              sketchId: "sketch_s",
              entityId: "rect_s",
              depth: 3
            },
            {
              op: "feature.shell",
              id: "feat_shell",
              bodyId: "body_shell",
              targetBodyId: "body_seed",
              wallThickness: 0.2,
              openFaceRefs: [
                {
                  kind: "generatedFace",
                  bodyId: "body_seed",
                  stableId: "generated:face:body_seed:endCap"
                }
              ]
            },
            {
              op: "feature.updateShell",
              id: "feat_shell",
              wallThickness: 0.3,
              openFaceRefs: []
            }
          ]
        }
      })
    );

    const response = adapter.execute(request);

    expect(response.ok).toBe(true);
    expect(response.ok && response.review.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: "feature.shell",
          intent: "create",
          featureId: "feat_shell",
          bodyId: "body_shell",
          targetBodyId: "body_seed",
          label: expect.stringContaining("thickness 0.2")
        }),
        expect.objectContaining({
          op: "feature.updateShell",
          intent: "modify",
          featureId: "feat_shell",
          label: expect.stringContaining("Update shell feature feat_shell")
        })
      ])
    );
  });

  it("accepts parameter expression batches and evaluation queries from external JSON callers (Slice H pass-through)", () => {
    const adapter = new CadOpsAgentAdapter();
    const request = parseCadOpsAgentRequestJson(
      JSON.stringify({
        requestId: "agent_req_parameter_expression",
        adapterVersion: "web-cad.agent-adapter.v1",
        permissions: { allowCommit: true },
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            { op: "parameter.create", id: "p_width", name: "Width", value: 10 },
            { op: "parameter.create", id: "p_half", name: "Half", value: 1 },
            {
              op: "parameter.setExpression",
              id: "p_half",
              expression: "Width / 2"
            }
          ]
        }
      })
    );

    const response = adapter.execute(request);

    expect(response.ok).toBe(true);
    expect(response.ok && response.review.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: "parameter.setExpression",
          intent: "modify",
          parameterId: "p_half"
        })
      ])
    );

    const query = adapter.query(
      parseCadOpsAgentQueryRequestJson(
        JSON.stringify({
          requestId: "agent_req_parameter_evaluation",
          adapterVersion: "web-cad.agent-adapter.v1",
          query: {
            version: "cadops.v1",
            query: { query: "project.parameterEvaluation" }
          }
        })
      )
    );

    expect(query).toMatchObject({
      ok: true,
      query: "project.parameterEvaluation",
      status: "valid",
      expressionCount: 1,
      nodes: expect.arrayContaining([
        expect.objectContaining({
          parameterId: "p_half",
          expression: "Width / 2",
          references: ["p_width"]
        })
      ])
    });
  });

  it("supports JSON feature extrude batches for external callers", () => {
    const adapter = new CadOpsAgentAdapter();
    const request = {
      requestId: "agent_req_json_extrude",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "sketch.create",
            id: "sketch_1",
            name: "Profile",
            plane: "XY"
          },
          {
            op: "sketch.addRectangle",
            sketchId: "sketch_1",
            id: "rect_1",
            center: [0, 0],
            width: 2,
            height: 3
          },
          {
            op: "feature.extrude",
            id: "feat_1",
            bodyId: "body_1",
            sketchId: "sketch_1",
            entityId: "rect_1",
            depth: 4,
            operationMode: "newBody"
          }
        ]
      }
    };

    const response = JSON.parse(
      adapter.executeJson(JSON.stringify(request))
    ) as {
      readonly ok: boolean;
      readonly createdFeatureIds?: readonly string[];
      readonly createdBodyIds?: readonly string[];
    };
    const structure = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(response).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_1"],
      createdBodyIds: ["body_1"]
    });
    expect(structure).toMatchObject({
      ok: true,
      features: [{ id: "feat_1", kind: "extrude", operationMode: "newBody" }],
      bodies: [{ id: "body_1", featureId: "feat_1" }]
    });
  });

  it("round-trips a V17 composite wire newBody extrude for external JSON callers", () => {
    const adapter = new CadOpsAgentAdapter();
    const profile = {
      kind: "wire",
      sketchId: "agent_wire_sketch",
      segments: [
        { entityId: "agent_wire_bottom", orientation: "forward" },
        { entityId: "agent_wire_arc", orientation: "forward" },
        { entityId: "agent_wire_top", orientation: "forward" },
        { entityId: "agent_wire_left", orientation: "forward" }
      ]
    };
    const response = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_v17_wire_extrude",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [
              {
                op: "sketch.create",
                id: "agent_wire_sketch",
                name: "Composite wire",
                plane: "XY"
              },
              {
                op: "sketch.addLine",
                sketchId: "agent_wire_sketch",
                id: "agent_wire_bottom",
                start: [0, 0],
                end: [4, 0]
              },
              {
                op: "sketch.addArc",
                sketchId: "agent_wire_sketch",
                id: "agent_wire_arc",
                definition: {
                  kind: "centerAngles",
                  center: [4, 2],
                  radius: 2,
                  startAngleDegrees: -90,
                  sweepAngleDegrees: 180
                }
              },
              {
                op: "sketch.addLine",
                sketchId: "agent_wire_sketch",
                id: "agent_wire_top",
                start: [4, 4],
                end: [0, 4]
              },
              {
                op: "sketch.addLine",
                sketchId: "agent_wire_sketch",
                id: "agent_wire_left",
                start: [0, 4],
                end: [0, 0]
              },
              {
                op: "feature.extrude",
                id: "agent_wire_extrude",
                bodyId: "agent_wire_body",
                profile,
                depth: 5,
                operationMode: "newBody"
              }
            ]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly createdFeatureIds?: readonly string[];
      readonly createdBodyIds?: readonly string[];
      readonly review?: { readonly operations: readonly unknown[] };
    };
    const structure = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(response).toMatchObject({
      ok: true,
      createdFeatureIds: ["agent_wire_extrude"],
      createdBodyIds: ["agent_wire_body"],
      review: {
        operations: expect.arrayContaining([
          expect.objectContaining({
            op: "feature.extrude",
            sketchId: "agent_wire_sketch",
            operationMode: "newBody",
            label:
              "Create new body extrude feature agent_wire_extrude from agent_wire_sketch composite wire"
          })
        ])
      }
    });
    expect(structure).toMatchObject({
      ok: true,
      features: [
        {
          id: "agent_wire_extrude",
          kind: "extrude",
          profile,
          operationMode: "newBody"
        }
      ],
      bodies: [
        {
          id: "agent_wire_body",
          featureId: "agent_wire_extrude",
          source: { profile }
        }
      ]
    });

    expect(
      JSON.parse(
        adapter.executeJson(
          JSON.stringify({
            requestId: "agent_req_v17_wire_extrude_mixed_source",
            adapterVersion: "web-cad.agent-adapter.v1",
            batch: {
              version: "cadops.v1",
              mode: "dryRun",
              ops: [
                {
                  op: "feature.extrude",
                  profile,
                  sketchId: "agent_wire_sketch",
                  entityId: "agent_wire_bottom",
                  depth: 5,
                  operationMode: "newBody"
                }
              ]
            }
          })
        )
      )
    ).toMatchObject({
      ok: false,
      error: {
        code: "COMMAND_INPUT_AMBIGUOUS",
        path: "$.ops[0].profile"
      }
    });
  });

  it("round-trips composite wire cut dry-run and commit through an anchored add result", () => {
    const adapter = new CadOpsAgentAdapter();
    const profile = {
      kind: "wire",
      sketchId: "agent_add_wire_sketch",
      segments: [
        { entityId: "agent_add_wire_bottom", orientation: "forward" },
        { entityId: "agent_add_wire_right", orientation: "forward" },
        { entityId: "agent_add_wire_top", orientation: "forward" },
        { entityId: "agent_add_wire_left", orientation: "forward" }
      ]
    };
    const seed = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_v17_wire_add_seed",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [
              {
                op: "sketch.create",
                id: "agent_add_target_sketch",
                name: "Composite add target",
                plane: "XY"
              },
              {
                op: "sketch.addRectangle",
                sketchId: "agent_add_target_sketch",
                id: "agent_add_target_rect",
                center: [0, 0],
                width: 10,
                height: 10
              },
              {
                op: "feature.extrude",
                id: "agent_add_target_feature",
                bodyId: "agent_add_target_body",
                sketchId: "agent_add_target_sketch",
                entityId: "agent_add_target_rect",
                depth: 4
              },
              {
                op: "topology.checkpoint.create",
                checkpointId: "agent_add_target_checkpoint",
                bodyId: "agent_add_target_body",
                sourceFeatureId: "agent_add_target_feature",
                sourceIdentity: {
                  algorithm: "partbench-source-v1",
                  sha256:
                    "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
                },
                status: "active"
              },
              {
                op: "topology.anchor.create",
                anchorId: "agent_add_target_anchor",
                entityKind: "body",
                bodyId: "agent_add_target_body",
                checkpointId: "agent_add_target_checkpoint",
                checkpointEntityId: "agent-add-target-body",
                sourceFeatureId: "agent_add_target_feature",
                stableId: "generated:body:agent_add_target_body"
              },
              {
                op: "sketch.create",
                id: "agent_add_wire_sketch",
                name: "Composite add wire",
                plane: "XY"
              },
              {
                op: "sketch.addLine",
                sketchId: "agent_add_wire_sketch",
                id: "agent_add_wire_bottom",
                start: [-2, -1],
                end: [2, -1]
              },
              {
                op: "sketch.addArc",
                sketchId: "agent_add_wire_sketch",
                id: "agent_add_wire_right",
                definition: {
                  kind: "centerAngles",
                  center: [2, 0],
                  radius: 1,
                  startAngleDegrees: -90,
                  sweepAngleDegrees: 180
                }
              },
              {
                op: "sketch.addLine",
                sketchId: "agent_add_wire_sketch",
                id: "agent_add_wire_top",
                start: [2, 1],
                end: [-2, 1]
              },
              {
                op: "sketch.addArc",
                sketchId: "agent_add_wire_sketch",
                id: "agent_add_wire_left",
                definition: {
                  kind: "centerAngles",
                  center: [-2, 0],
                  radius: 1,
                  startAngleDegrees: 90,
                  sweepAngleDegrees: 180
                }
              },
              {
                op: "feature.extrude",
                id: "agent_add_wire_feature",
                bodyId: "agent_add_wire_body",
                profile,
                depth: 2,
                side: "symmetric",
                operationMode: "add",
                targetTopologyAnchorId: "agent_add_target_anchor"
              },
              {
                op: "topology.checkpoint.create",
                checkpointId: "agent_add_result_checkpoint",
                bodyId: "agent_add_wire_body",
                sourceFeatureId: "agent_add_wire_feature",
                sourceIdentity: {
                  algorithm: "partbench-source-v1",
                  sha256:
                    "abababababababababababababababababababababababababababababababab"
                },
                status: "active"
              },
              {
                op: "topology.anchor.create",
                anchorId: "agent_add_result_anchor",
                entityKind: "body",
                bodyId: "agent_add_wire_body",
                checkpointId: "agent_add_result_checkpoint",
                checkpointEntityId: "agent-add-result-body",
                sourceFeatureId: "agent_add_wire_feature",
                stableId: "generated:body:agent_add_wire_body"
              }
            ]
          }
        })
      )
    );
    const operation = {
      op: "feature.extrude",
      id: "agent_cut_wire_feature",
      bodyId: "agent_cut_wire_body",
      profile,
      depth: 1,
      operationMode: "cut",
      targetTopologyAnchorId: "agent_add_result_anchor"
    };
    const directTarget = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_v17_wire_cut_direct_target",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: {
            version: "cadops.v1",
            mode: "dryRun",
            ops: [
              {
                ...operation,
                side: "negative",
                targetBodyId: "agent_add_wire_body",
                targetTopologyAnchorId: undefined
              }
            ]
          }
        })
      )
    );
    const dryRun = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_v17_wire_cut_dry_run",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: {
            version: "cadops.v1",
            mode: "dryRun",
            ops: [{ ...operation, side: "symmetric" }]
          }
        })
      )
    );
    const beforeCommit = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    const commit = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_v17_wire_cut_commit",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [{ ...operation, side: "negative" }]
          }
        })
      )
    );
    const structure = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_req_v17_wire_cut_structure",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "project.structure" }
      }
    });

    expect(seed).toMatchObject({ ok: true });
    expect(directTarget).toMatchObject({
      ok: false,
      error: {
        code: "UNSUPPORTED_BODY_REFERENCES",
        path: "$.ops[0].profile"
      }
    });
    expect(beforeCommit).not.toMatchObject({
      features: expect.arrayContaining([
        expect.objectContaining({ id: "agent_cut_wire_feature" })
      ])
    });
    for (const response of [dryRun, commit]) {
      expect(response).toMatchObject({
        ok: true,
        createdFeatureIds: ["agent_cut_wire_feature"],
        createdBodyIds: ["agent_cut_wire_body"],
        semanticDiff: {
          features: {
            created: [
              expect.objectContaining({
                id: "agent_cut_wire_feature",
                profile,
                operationMode: "cut",
                targetBodyId: "agent_add_wire_body",
                targetTopologyAnchorId: "agent_add_result_anchor"
              })
            ],
            inputReferences: [
              expect.objectContaining({
                featureId: "agent_cut_wire_feature",
                after: profile
              })
            ]
          }
        },
        review: {
          operations: [
            expect.objectContaining({
              op: "feature.extrude",
              sketchId: "agent_add_wire_sketch",
              operationMode: "cut",
              targetTopologyAnchorId: "agent_add_result_anchor",
              label:
                "Create cut extrude feature agent_cut_wire_feature from agent_add_wire_sketch composite wire"
            })
          ]
        }
      });
    }
    expect(dryRun).toMatchObject({
      mode: "dryRun",
      semanticDiff: {
        features: {
          created: [expect.objectContaining({ side: "symmetric" })]
        }
      }
    });
    expect(commit).toMatchObject({
      mode: "commit",
      semanticDiff: {
        features: {
          created: [expect.objectContaining({ side: "negative" })]
        }
      }
    });
    expect(structure).toMatchObject({
      ok: true,
      requestId: "agent_req_v17_wire_cut_structure",
      query: "project.structure",
      features: expect.arrayContaining([
        expect.objectContaining({
          id: "agent_cut_wire_feature",
          profile,
          depth: 1,
          side: "negative",
          operationMode: "cut",
          targetBodyId: "agent_add_wire_body",
          targetTopologyAnchorId: "agent_add_result_anchor"
        })
      ]),
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "agent_add_wire_body",
          consumedByFeatureId: "agent_cut_wire_feature"
        }),
        expect.objectContaining({
          id: "agent_cut_wire_body",
          featureId: "agent_cut_wire_feature",
          source: expect.objectContaining({ profile })
        })
      ])
    });
  });

  it("passes feature.revolve through JSON batch commit", () => {
    const adapter = new CadOpsAgentAdapter();
    const response = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_json_revolve",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [
              {
                op: "sketch.create",
                id: "sketch_1",
                name: "Revolve",
                plane: "XY"
              },
              {
                op: "sketch.addRectangle",
                sketchId: "sketch_1",
                id: "rect_1",
                center: [2, 0],
                width: 1,
                height: 2
              },
              {
                op: "sketch.addLine",
                sketchId: "sketch_1",
                id: "axis_1",
                start: [0, -2],
                end: [0, 2]
              },
              {
                op: "feature.revolve",
                id: "feat_revolve_1",
                bodyId: "body_revolve_1",
                sketchId: "sketch_1",
                entityId: "rect_1",
                axis: {
                  type: "sketchLine",
                  sketchId: "sketch_1",
                  entityId: "axis_1"
                },
                angleDegrees: 180,
                operationMode: "newBody"
              }
            ]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly createdFeatureIds?: readonly string[];
      readonly createdBodyIds?: readonly string[];
    };
    const structure = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(response).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_revolve_1"],
      createdBodyIds: ["body_revolve_1"]
    });
    expect(structure).toMatchObject({
      ok: true,
      features: [{ id: "feat_revolve_1", kind: "revolve", angleDegrees: 180 }],
      bodies: [
        {
          id: "body_revolve_1",
          featureId: "feat_revolve_1",
          source: { type: "sketchRevolveFeature" }
        }
      ]
    });
  });

  it("keeps feature.hole source-dry-runnable through JSON", () => {
    const adapter = new CadOpsAgentAdapter();
    const response = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_json_hole",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: {
            version: "cadops.v1",
            mode: "dryRun",
            ops: [
              {
                op: "sketch.create",
                id: "sketch_target",
                name: "Target",
                plane: "XY"
              },
              {
                op: "sketch.addRectangle",
                sketchId: "sketch_target",
                id: "rect_target",
                center: [0, 0],
                width: 4,
                height: 3
              },
              {
                op: "feature.extrude",
                id: "feat_target",
                bodyId: "body_target",
                sketchId: "sketch_target",
                entityId: "rect_target",
                depth: 2
              },
              {
                op: "sketch.create",
                id: "sketch_hole",
                name: "Hole",
                plane: "XY"
              },
              {
                op: "sketch.addCircle",
                sketchId: "sketch_hole",
                id: "circle_hole",
                center: [0, 0],
                radius: 0.5
              },
              {
                op: "feature.hole",
                id: "feat_hole",
                bodyId: "body_hole",
                targetBodyId: "body_target",
                sketchId: "sketch_hole",
                circleEntityId: "circle_hole",
                depthMode: "throughAll",
                direction: "positive"
              }
            ]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly createdFeatureIds?: readonly string[];
      readonly createdBodyIds?: readonly string[];
    };
    expect(response).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_target", "feat_hole"],
      createdBodyIds: ["body_target", "body_hole"]
    });
    expect(adapter.getEngine().getDocument().features.size).toBe(0);
  });

  it("passes feature.chamfer and feature.fillet through JSON batch commit", () => {
    const adapter = new CadOpsAgentAdapter();
    const response = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_json_edge_finish",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [
              {
                op: "sketch.create",
                id: "sketch_target",
                name: "Target",
                plane: "XY"
              },
              {
                op: "sketch.addRectangle",
                sketchId: "sketch_target",
                id: "rect_target",
                center: [0, 0],
                width: 4,
                height: 3
              },
              {
                op: "feature.extrude",
                id: "feat_target",
                bodyId: "body_target",
                sketchId: "sketch_target",
                entityId: "rect_target",
                depth: 2
              },
              {
                op: "feature.chamfer",
                id: "feat_chamfer",
                bodyId: "body_chamfer",
                targetBodyId: "body_target",
                edgeStableId: "generated:edge:body_target:start:uMin",
                distance: 0.2
              }
            ]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly createdFeatureIds?: readonly string[];
      readonly createdBodyIds?: readonly string[];
    };

    expect(response).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_target", "feat_chamfer"],
      createdBodyIds: ["body_target", "body_chamfer"]
    });

    const secondAdapter = new CadOpsAgentAdapter();
    const filletResponse = JSON.parse(
      secondAdapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_json_fillet",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [
              {
                op: "sketch.create",
                id: "sketch_circle",
                name: "Circle",
                plane: "XY"
              },
              {
                op: "sketch.addCircle",
                sketchId: "sketch_circle",
                id: "circle_target",
                center: [0, 0],
                radius: 2
              },
              {
                op: "feature.extrude",
                id: "feat_circle",
                bodyId: "body_circle",
                sketchId: "sketch_circle",
                entityId: "circle_target",
                depth: 3
              },
              {
                op: "reference.nameGenerated",
                name: "Roundable edge",
                bodyId: "body_circle",
                stableId: "generated:edge:body_circle:end:circular"
              },
              {
                op: "feature.fillet",
                id: "feat_fillet",
                bodyId: "body_fillet",
                targetBodyId: "body_circle",
                namedReference: "Roundable edge",
                radius: 0.25
              }
            ]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly createdFeatureIds?: readonly string[];
      readonly createdBodyIds?: readonly string[];
    };

    expect(filletResponse).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_circle", "feat_fillet"],
      createdBodyIds: ["body_circle", "body_fillet"]
    });
  });

  it("passes rectangle add extrudes through JSON batch dry-run and commit", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_add",
      entityId: "rect_add",
      featureId: "feat_seed_add",
      bodyId: "body_seed_add"
    });

    const batch = {
      version: "cadops.v1" as const,
      mode: "commit" as const,
      ops: [
        {
          op: "feature.extrude" as const,
          id: "feat_add",
          bodyId: "body_add",
          targetBodyId: "body_seed_add",
          sketchId: "sketch_add",
          entityId: "rect_add",
          depth: 2,
          operationMode: "add" as const
        }
      ]
    };
    const dryRun = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_add_dry_run",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: { ...batch, mode: "dryRun" }
        })
      )
    );
    const commit = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_add_commit",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch
        })
      )
    );
    const structure = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(dryRun).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_add"],
      createdBodyIds: ["body_add"]
    });
    expect(commit).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_add"],
      createdBodyIds: ["body_add"]
    });
    expect(structure).toMatchObject({
      ok: true,
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_seed_add",
          consumedByFeatureId: "feat_add"
        }),
        expect.objectContaining({ id: "body_add", featureId: "feat_add" })
      ])
    });
    expect(
      executeCadOpsAgentQueryRequest(adapter.getEngine(), {
        requestId: "agent_add_edge_selection_refs",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: {
            query: "selection.referenceCandidates",
            selection: {
              type: "generatedReference",
              bodyId: "body_add",
              stableId: "generated:edge:body_add:end:uMin",
              expectedKind: "edge"
            },
            requiredOperation: "feature.measureReference"
          }
        }
      })
    ).toMatchObject({
      ok: true,
      query: "selection.referenceCandidates",
      status: "resolved",
      candidateCount: 1,
      candidates: [
        expect.objectContaining({
          commandable: true,
          commandOperations: expect.arrayContaining([
            "reference.nameGenerated",
            "feature.measureReference",
            "feature.selectReference"
          ]),
          target: {
            type: "generatedReference",
            bodyId: "body_add",
            stableId: "generated:edge:body_add:end:uMin",
            kind: "edge"
          },
          reference: expect.objectContaining({
            kind: "edge",
            role: "end:uMin"
          })
        })
      ]
    });
  });

  it("passes rectangle cut extrudes through JSON batch dry-run and commit", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_cut",
      entityId: "rect_cut",
      featureId: "feat_seed_cut",
      bodyId: "body_seed_cut"
    });

    const batch = {
      version: "cadops.v1" as const,
      mode: "commit" as const,
      ops: [
        {
          op: "feature.extrude" as const,
          id: "feat_cut",
          bodyId: "body_cut",
          targetBodyId: "body_seed_cut",
          sketchId: "sketch_cut",
          entityId: "rect_cut",
          depth: 1,
          operationMode: "cut" as const
        }
      ]
    };
    const dryRun = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_cut_dry_run",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: { ...batch, mode: "dryRun" }
        })
      )
    );
    const commit = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_cut_commit",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch
        })
      )
    );

    expect(dryRun).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_cut"],
      createdBodyIds: ["body_cut"]
    });
    expect(commit).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_cut"],
      createdBodyIds: ["body_cut"]
    });
  });

  it("passes circle-target cut extrudes through JSON batch dry-run and commit", () => {
    const adapter = new CadOpsAgentAdapter();
    const seed = adapter.execute({
      requestId: "agent_req_seed_circle_cut_target",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "sketch.create",
            id: "sketch_circle_cut",
            name: "Profile",
            plane: "XY"
          },
          {
            op: "sketch.addCircle",
            sketchId: "sketch_circle_cut",
            id: "circle_target",
            center: [0, 0],
            radius: 2
          },
          {
            op: "sketch.addRectangle",
            sketchId: "sketch_circle_cut",
            id: "rect_tool",
            center: [0, 0],
            width: 1,
            height: 1
          },
          {
            op: "feature.extrude",
            id: "feat_circle_target",
            bodyId: "body_circle_target",
            sketchId: "sketch_circle_cut",
            entityId: "circle_target",
            depth: 4
          }
        ]
      }
    });

    expect(seed).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_circle_target"],
      createdBodyIds: ["body_circle_target"]
    });

    const batch = {
      version: "cadops.v1" as const,
      mode: "commit" as const,
      ops: [
        {
          op: "feature.extrude" as const,
          id: "feat_circle_cut",
          bodyId: "body_circle_cut",
          targetBodyId: "body_circle_target",
          sketchId: "sketch_circle_cut",
          entityId: "rect_tool",
          depth: 1,
          operationMode: "cut" as const
        }
      ]
    };
    const dryRun = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_circle_cut_dry_run",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: { ...batch, mode: "dryRun" }
        })
      )
    );
    const commit = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_circle_cut_commit",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch
        })
      )
    );

    expect(dryRun).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_circle_cut"],
      createdBodyIds: ["body_circle_cut"]
    });
    expect(commit).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_circle_cut"],
      createdBodyIds: ["body_circle_cut"]
    });
    expect(
      adapter.getEngine().executeQuery({
        version: "cadops.v1",
        query: { query: "project.structure" }
      })
    ).toMatchObject({
      ok: true,
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_circle_target",
          consumedByFeatureId: "feat_circle_cut"
        }),
        expect.objectContaining({ id: "body_circle_cut" })
      ])
    });
  });

  it("passes feature.updateExtrude through JSON batch dry-run and commit", () => {
    const adapter = new CadOpsAgentAdapter();
    seedExtrudeFeature(adapter, {
      sketchId: "sketch_update",
      entityId: "rect_update",
      featureId: "feat_update",
      bodyId: "body_update"
    });

    const dryRun = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_update_extrude_dry_run",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: {
            version: "cadops.v1",
            mode: "dryRun",
            ops: [
              {
                op: "feature.updateExtrude",
                id: "feat_update",
                depth: 9,
                side: "negative"
              }
            ]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly modifiedFeatureIds?: readonly string[];
      readonly modifiedBodyIds?: readonly string[];
      readonly transactionId?: string;
    };
    const dryRunStructure = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(dryRun).toMatchObject({
      ok: true,
      mode: "dryRun",
      modifiedFeatureIds: ["feat_update"],
      modifiedBodyIds: ["body_update"],
      audit: {
        source: "agent-adapter",
        requestId: "agent_req_update_extrude_dry_run",
        intent: "dryRun",
        operationCount: 1
      }
    });
    expect(dryRun.transactionId).toBeUndefined();
    expect(dryRunStructure).toMatchObject({
      ok: true,
      features: [{ id: "feat_update", depth: 4, side: "positive" }],
      bodies: [{ id: "body_update", featureId: "feat_update" }]
    });

    const commit = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_update_extrude_commit",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          actor: {
            type: "agent",
            id: "feature-update-agent",
            name: "Feature Update Agent"
          },
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [
              {
                op: "feature.updateExtrude",
                id: "feat_update",
                depth: 9,
                side: "symmetric"
              }
            ]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly modifiedFeatureIds?: readonly string[];
      readonly modifiedBodyIds?: readonly string[];
      readonly transactionId?: string;
    };
    const committedStructure = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    const history = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_req_update_extrude_history",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "transaction.history" }
      }
    });

    expect(commit).toMatchObject({
      ok: true,
      mode: "commit",
      modifiedFeatureIds: ["feat_update"],
      modifiedBodyIds: ["body_update"],
      transactionId: "txn_2",
      actor: {
        type: "agent",
        id: "feature-update-agent",
        name: "Feature Update Agent"
      },
      audit: {
        source: "agent-adapter",
        requestId: "agent_req_update_extrude_commit",
        intent: "commit",
        operationCount: 1
      }
    });
    expect(committedStructure).toMatchObject({
      ok: true,
      features: [{ id: "feat_update", depth: 9, side: "symmetric" }],
      bodies: [{ id: "body_update", featureId: "feat_update" }]
    });

    if (!history.ok || history.query !== "transaction.history") {
      throw new Error("Expected transaction.history agent response.");
    }

    expect(history.transactions.at(-1)?.diff.features).toMatchObject({
      referenceEffects: expect.arrayContaining([
        expect.objectContaining({
          category: "active",
          bodyId: "body_update",
          sourceFeatureId: "feat_update"
        })
      ])
    });
  });

  it("passes feature.updateHole through JSON batch dry-run and commit", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_hole_target",
      entityId: "rect_hole_target",
      featureId: "feat_hole_target",
      bodyId: "body_hole_target"
    });
    adapter.getEngine().applyBatch([
      { op: "sketch.create", id: "sketch_hole", name: "Hole", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_hole",
        id: "circle_hole",
        center: [0, 0],
        radius: 0.4
      },
      {
        op: "feature.hole",
        id: "feat_hole",
        bodyId: "body_hole",
        targetBodyId: "body_hole_target",
        sketchId: "sketch_hole",
        circleEntityId: "circle_hole",
        depthMode: "blind",
        depth: 1,
        direction: "negative"
      }
    ]);

    const dryRun = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_update_hole_dry_run",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: {
            version: "cadops.v1",
            mode: "dryRun",
            ops: [
              {
                op: "feature.updateHole",
                id: "feat_hole",
                depthMode: "throughAll",
                direction: "positive"
              }
            ]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly modifiedFeatureIds?: readonly string[];
      readonly modifiedBodyIds?: readonly string[];
    };

    expect(dryRun).toMatchObject({
      ok: true,
      mode: "dryRun",
      modifiedFeatureIds: ["feat_hole"],
      modifiedBodyIds: ["body_hole"]
    });
    expect(
      adapter.getEngine().getDocument().features.get("feat_hole")
    ).toMatchObject({
      kind: "hole",
      depthMode: "blind",
      depth: 1,
      direction: "negative"
    });

    const commit = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_update_hole_commit",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [
              {
                op: "feature.updateHole",
                id: "feat_hole",
                depthMode: "throughAll",
                direction: "positive"
              }
            ]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly modifiedFeatureIds?: readonly string[];
      readonly modifiedBodyIds?: readonly string[];
    };

    expect(commit).toMatchObject({
      ok: false,
      mode: "commit",
      error: { code: "UNSUPPORTED_FEATURE_OPERATION" }
    });
    expect(
      adapter.getEngine().getDocument().features.get("feat_hole")
    ).toMatchObject({
      kind: "hole",
      depthMode: "blind",
      depth: 1,
      direction: "negative"
    });
    expect(
      (
        adapter.getEngine().getDocument().features.get("feat_hole") as
          | { readonly depth?: number }
          | undefined
      )?.depth
    ).toBe(1);
  });

  it("accepts one hole retarget input and rejects mixed target fields", () => {
    expect(
      parseCadOpsAgentRequestJson(
        JSON.stringify({
          requestId: "agent_req_update_hole_target",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: {
            version: "cadops.v1",
            mode: "dryRun",
            ops: [
              {
                op: "feature.updateHole",
                id: "feat_hole",
                targetBodyId: "body_target"
              }
            ]
          }
        })
      ).batch.ops[0]
    ).toMatchObject({ targetBodyId: "body_target" });

    expect(() =>
      parseCadOpsAgentRequestJson(
        JSON.stringify({
          requestId: "agent_req_update_hole_mixed_target",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: {
            version: "cadops.v1",
            mode: "dryRun",
            ops: [
              {
                op: "feature.updateHole",
                id: "feat_hole",
                targetBodyId: "body_target",
                targetTopologyAnchorId: "anchor_target"
              }
            ]
          }
        })
      )
    ).toThrow("Invalid CADOps agent adapter request.");
  });

  it("keeps widened hole creates source-dry-runnable but blocks standalone commits without exact preflight", () => {
    const adapter = new CadOpsAgentAdapter();
    adapter.getEngine().applyBatch([
      {
        op: "sketch.create",
        id: "sketch_widened_hole_target",
        name: "Widened hole target",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_widened_hole_target",
        id: "rect_widened_hole_target",
        center: [2, 0],
        width: 2,
        height: 2
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_widened_hole_target",
        id: "axis_widened_hole_target",
        start: [0, -2],
        end: [0, 2],
        construction: true
      },
      {
        op: "feature.revolve",
        id: "feat_widened_hole_target",
        bodyId: "body_widened_hole_target",
        sketchId: "sketch_widened_hole_target",
        entityId: "rect_widened_hole_target",
        axis: {
          type: "sketchLine",
          sketchId: "sketch_widened_hole_target",
          entityId: "axis_widened_hole_target"
        },
        angleDegrees: 360
      },
      {
        op: "sketch.create",
        id: "sketch_widened_hole",
        name: "Widened hole",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_widened_hole",
        id: "circle_widened_hole",
        center: [2, 0],
        radius: 0.25
      }
    ]);
    const op = {
      op: "feature.hole" as const,
      id: "feat_widened_hole",
      bodyId: "body_widened_hole",
      targetBodyId: "body_widened_hole_target",
      sketchId: "sketch_widened_hole",
      circleEntityId: "circle_widened_hole",
      depthMode: "throughAll" as const,
      direction: "positive" as const
    };

    expect(
      adapter.execute({
        requestId: "agent_req_widened_hole_dry_run",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: { version: "cadops.v1", mode: "dryRun", ops: [op] }
      })
    ).toMatchObject({ ok: true, mode: "dryRun" });

    expect(
      adapter.execute({
        requestId: "agent_req_widened_hole_commit",
        adapterVersion: "web-cad.agent-adapter.v1",
        permissions: { allowCommit: true },
        batch: { version: "cadops.v1", mode: "commit", ops: [op] }
      })
    ).toMatchObject({
      ok: false,
      mode: "commit",
      error: {
        code: "UNSUPPORTED_FEATURE_OPERATION",
        opIndex: 0,
        op: "feature.hole"
      },
      review: {
        blockers: [
          expect.objectContaining({
            code: "VALIDATION_ERROR",
            errorCode: "UNSUPPORTED_FEATURE_OPERATION"
          })
        ]
      }
    });
    expect(
      adapter.getEngine().getDocument().features.has("feat_widened_hole")
    ).toBe(false);
  });

  it("keeps hole retarget source-dry-runnable but blocks its standalone commit", () => {
    const adapter = new CadOpsAgentAdapter();
    seedExtrudeFeature(adapter, {
      sketchId: "sketch_retarget_source",
      entityId: "rect_retarget_source",
      featureId: "feat_retarget_source",
      bodyId: "body_retarget_source"
    });
    seedExtrudeFeature(adapter, {
      sketchId: "sketch_retarget_destination",
      entityId: "rect_retarget_destination",
      featureId: "feat_retarget_destination",
      bodyId: "body_retarget_destination"
    });
    adapter.getEngine().applyBatch([
      {
        op: "sketch.create",
        id: "sketch_retarget_hole",
        name: "Retarget hole",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_retarget_hole",
        id: "circle_retarget_hole",
        center: [0, 0],
        radius: 0.25
      },
      {
        op: "feature.hole",
        id: "feat_retarget_hole",
        bodyId: "body_retarget_hole",
        targetBodyId: "body_retarget_source",
        sketchId: "sketch_retarget_hole",
        circleEntityId: "circle_retarget_hole",
        depthMode: "throughAll",
        direction: "positive"
      }
    ]);
    const op = {
      op: "feature.updateHole" as const,
      id: "feat_retarget_hole",
      targetBodyId: "body_retarget_destination"
    };

    expect(
      adapter.execute({
        requestId: "agent_req_retarget_hole_dry_run",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: { version: "cadops.v1", mode: "dryRun", ops: [op] }
      })
    ).toMatchObject({ ok: true, mode: "dryRun" });
    expect(
      adapter.execute({
        requestId: "agent_req_retarget_hole_commit",
        adapterVersion: "web-cad.agent-adapter.v1",
        permissions: { allowCommit: true },
        batch: { version: "cadops.v1", mode: "commit", ops: [op] }
      })
    ).toMatchObject({
      ok: false,
      error: {
        code: "UNSUPPORTED_FEATURE_OPERATION",
        op: "feature.updateHole"
      }
    });
    expect(
      adapter.getEngine().getDocument().features.get("feat_retarget_hole")
    ).toMatchObject({ targetBodyId: "body_retarget_source" });
  });

  it("keeps pattern, mirror, and shell source-dry-runnable but blocks standalone exact commits", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      {
        op: "scene.createBox",
        id: "linear_seed",
        dimensions: { width: 4, height: 4, depth: 4 }
      },
      {
        op: "scene.createBox",
        id: "circular_seed",
        dimensions: { width: 4, height: 4, depth: 4 }
      },
      {
        op: "scene.createBox",
        id: "mirror_seed",
        dimensions: { width: 4, height: 4, depth: 4 }
      },
      {
        op: "scene.createBox",
        id: "shell_target",
        dimensions: { width: 4, height: 4, depth: 4 }
      },
      {
        op: "feature.linearPattern",
        id: "linear_existing",
        bodyId: "body_linear_existing",
        seedBodyId: "body:linear_seed",
        direction: { kind: "globalAxis", axis: "x" },
        spacing: 5,
        instanceCount: 2
      },
      {
        op: "feature.circularPattern",
        id: "circular_existing",
        bodyId: "body_circular_existing",
        seedBodyId: "body:circular_seed",
        rotationAxis: { kind: "globalAxis", axis: "z" },
        totalAngleDegrees: 360,
        instanceCount: 2
      },
      {
        op: "feature.mirror",
        id: "mirror_existing",
        bodyId: "body_mirror_existing",
        seedBodyId: "body:mirror_seed",
        mirrorPlane: "XY",
        includeOriginal: false
      },
      {
        op: "feature.shell",
        id: "shell_existing",
        bodyId: "body_shell_existing",
        targetBodyId: "body:shell_target",
        wallThickness: 0.2,
        openFaceRefs: []
      }
    ]);
    const adapter = new CadOpsAgentAdapter(engine);
    const ops: readonly CadOp[] = [
      {
        op: "feature.updateLinearPattern",
        id: "linear_existing",
        spacing: 6
      },
      {
        op: "feature.updateCircularPattern",
        id: "circular_existing",
        totalAngleDegrees: 180
      },
      {
        op: "feature.updateMirror",
        id: "mirror_existing",
        includeOriginal: true
      },
      {
        op: "feature.updateShell",
        id: "shell_existing",
        wallThickness: 0.3
      }
    ];

    for (const [index, op] of ops.entries()) {
      expect(
        adapter.execute({
          requestId: `agent_exact_dry_run_${index}`,
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: { version: "cadops.v1", mode: "dryRun", ops: [op] }
        })
      ).toMatchObject({ ok: true, mode: "dryRun" });
      expect(
        adapter.execute({
          requestId: `agent_exact_commit_${index}`,
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch: { version: "cadops.v1", mode: "commit", ops: [op] }
        })
      ).toMatchObject({
        ok: false,
        mode: "commit",
        error: { code: "UNSUPPORTED_FEATURE_OPERATION", op: op.op }
      });
    }
  });

  it("passes sketch.updateEntity profile edits through JSON batch dry-run and commit", () => {
    const adapter = new CadOpsAgentAdapter();
    seedExtrudeFeature(adapter, {
      sketchId: "sketch_profile_update",
      entityId: "rect_profile_update",
      featureId: "feat_profile_update",
      bodyId: "body_profile_update"
    });

    const dryRun = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_profile_update_dry_run",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: {
            version: "cadops.v1",
            mode: "dryRun",
            ops: [
              {
                op: "sketch.updateEntity",
                sketchId: "sketch_profile_update",
                entity: {
                  id: "rect_profile_update",
                  kind: "rectangle",
                  center: [1, 2],
                  width: 7,
                  height: 8
                }
              }
            ]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly modifiedSketchEntityIds?: readonly string[];
      readonly modifiedFeatureIds?: readonly string[];
      readonly modifiedBodyIds?: readonly string[];
    };
    const dryRunSketch = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "sketch.get", id: "sketch_profile_update" }
    });

    expect(dryRun).toMatchObject({
      ok: true,
      mode: "dryRun",
      modifiedSketchEntityIds: ["rect_profile_update"],
      modifiedFeatureIds: ["feat_profile_update"],
      modifiedBodyIds: ["body_profile_update"],
      audit: {
        source: "agent-adapter",
        requestId: "agent_req_profile_update_dry_run",
        intent: "dryRun",
        operationCount: 1
      }
    });
    expect(dryRunSketch).toMatchObject({
      ok: true,
      sketch: {
        entities: [
          {
            id: "rect_profile_update",
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 3
          }
        ]
      }
    });

    const commit = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_profile_update_commit",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [
              {
                op: "sketch.updateEntity",
                sketchId: "sketch_profile_update",
                entity: {
                  id: "rect_profile_update",
                  kind: "rectangle",
                  center: [1, 2],
                  width: 7,
                  height: 8
                }
              }
            ]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly modifiedSketchEntityIds?: readonly string[];
      readonly modifiedFeatureIds?: readonly string[];
      readonly modifiedBodyIds?: readonly string[];
    };
    const committedSketch = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "sketch.get", id: "sketch_profile_update" }
    });

    expect(commit).toMatchObject({
      ok: true,
      mode: "commit",
      modifiedSketchEntityIds: ["rect_profile_update"],
      modifiedFeatureIds: ["feat_profile_update"],
      modifiedBodyIds: ["body_profile_update"],
      transactionId: "txn_2",
      audit: {
        source: "agent-adapter",
        requestId: "agent_req_profile_update_commit",
        intent: "commit",
        operationCount: 1
      }
    });
    expect(committedSketch).toMatchObject({
      ok: true,
      sketch: {
        entities: [
          {
            id: "rect_profile_update",
            kind: "rectangle",
            center: [1, 2],
            width: 7,
            height: 8
          }
        ]
      }
    });
  });

  it("passes feature.delete through JSON batch dry-run and commit", () => {
    const adapter = new CadOpsAgentAdapter();
    seedExtrudeFeature(adapter, {
      sketchId: "sketch_delete",
      entityId: "rect_delete",
      featureId: "feat_delete",
      bodyId: "body_delete"
    });

    const dryRun = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_delete_dry_run",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: {
            version: "cadops.v1",
            mode: "dryRun",
            ops: [{ op: "feature.delete", id: "feat_delete" }]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly deletedFeatureIds?: readonly string[];
      readonly deletedBodyIds?: readonly string[];
      readonly transactionId?: string;
    };
    const dryRunStructure = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(dryRun).toMatchObject({
      ok: true,
      mode: "dryRun",
      deletedFeatureIds: ["feat_delete"],
      deletedBodyIds: ["body_delete"],
      audit: {
        source: "agent-adapter",
        requestId: "agent_req_delete_dry_run",
        intent: "dryRun",
        operationCount: 1
      }
    });
    expect(dryRunStructure).toMatchObject({
      ok: true,
      features: [{ id: "feat_delete" }],
      bodies: [{ id: "body_delete", featureId: "feat_delete" }]
    });

    const commit = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_delete_commit",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          actor: {
            type: "agent",
            id: "feature-delete-agent",
            name: "Feature Delete Agent"
          },
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [{ op: "feature.delete", id: "feat_delete" }]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly deletedFeatureIds?: readonly string[];
      readonly deletedBodyIds?: readonly string[];
      readonly transactionId?: string;
    };
    const committedStructure = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });

    expect(commit).toMatchObject({
      ok: true,
      mode: "commit",
      deletedFeatureIds: ["feat_delete"],
      deletedBodyIds: ["body_delete"],
      transactionId: "txn_2",
      actor: {
        type: "agent",
        id: "feature-delete-agent",
        name: "Feature Delete Agent"
      },
      audit: {
        source: "agent-adapter",
        requestId: "agent_req_delete_commit",
        intent: "commit",
        operationCount: 1
      }
    });
    expect(committedStructure).toMatchObject({
      ok: true,
      features: [],
      bodies: []
    });
  });

  it("returns project summary queries through the adapter", () => {
    const engine = new CadEngine();

    engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "scene.createBox",
          id: "summary_box",
          dimensions: { width: 1, height: 2, depth: 3 },
          transform: { translation: [3, 2, 1] }
        },
        {
          op: "scene.createCylinder",
          id: "summary_cylinder",
          dimensions: { radius: 2, height: 8 }
        }
      ]
    });

    const response = executeCadOpsAgentQueryRequest(engine, {
      requestId: "agent_query_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "project.summary" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_query_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "project.summary",
      units: "mm",
      objectCount: 2,
      objects: [
        {
          id: "summary_box",
          kind: "box",
          dimensions: { width: 1, height: 2, depth: 3 },
          transform: {
            translation: [3, 2, 1],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        },
        {
          id: "summary_cylinder",
          kind: "cylinder",
          dimensions: { radius: 2, height: 8 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      ],
      structure: {
        partCount: 1,
        featureCount: 2,
        bodyCount: 2,
        primitiveCompatibilityBodyCount: 2,
        authoredBodyFeatureCount: 0
      },
      references: {
        semanticBodySelectionCount: 2,
        generatedReferenceCount: 0,
        semanticBodySelectionStatusCounts: {
          resolved: 2,
          unsupported: 0
        }
      },
      exportReadiness: {
        status: "deferred",
        canExportFiles: false,
        formatCount: 2,
        bodyCount: 2,
        unavailableBodyCount: 0
      },
      workflowHints: [
        expect.objectContaining({ code: "NO_AUTHORED_BODY_FEATURES" }),
        expect.objectContaining({ code: "NO_COMMANDABLE_REFERENCES" }),
        expect.objectContaining({ code: "EXPORT_DEFERRED" })
      ]
    });
  });

  it("passes V17 profile and path queries through unchanged", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      {
        op: "sketch.create",
        id: "agent_profile_path_sketch",
        name: "Agent profile and path sketch",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "agent_profile_path_sketch",
        id: "profile_rectangle",
        center: [0, 0],
        width: 4,
        height: 2
      },
      {
        op: "sketch.addLine",
        sketchId: "agent_profile_path_sketch",
        id: "path_line",
        start: [10, 0],
        end: [12, 0]
      }
    ]);
    const executeQuery = vi.spyOn(engine, "executeQuery");
    const requests = [
      {
        requestId: "agent_profile_candidates",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: {
            query: "sketch.profileCandidates",
            sketchId: "agent_profile_path_sketch"
          }
        }
      },
      {
        requestId: "agent_profile_readiness",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: {
            query: "sketch.profileReadiness",
            profile: {
              kind: "entity",
              sketchId: "agent_profile_path_sketch",
              entityId: "profile_rectangle"
            },
            consumer: {
              featureKind: "extrude",
              operationMode: "newBody"
            }
          }
        }
      },
      {
        requestId: "agent_path_candidates",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: {
            query: "sketch.pathCandidates",
            sketchId: "agent_profile_path_sketch"
          }
        }
      },
      {
        requestId: "agent_path_readiness",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: {
            query: "sketch.pathReadiness",
            path: {
              kind: "entity",
              sketchId: "agent_profile_path_sketch",
              entityId: "path_line",
              orientation: "forward"
            }
          }
        }
      }
    ] as const satisfies readonly CadOpsAgentQueryRequest[];

    for (const request of requests) {
      const direct = engine.executeQuery(request.query);
      const response: CadOpsAgentQueryResponse = executeCadOpsAgentQueryRequest(
        engine,
        request
      );

      expect(executeQuery).toHaveBeenLastCalledWith(request.query);
      expect(response).toEqual({
        ...direct,
        requestId: request.requestId,
        adapterVersion: request.adapterVersion
      });
    }

    expect(() =>
      parseCadOpsAgentQueryRequestJson(
        JSON.stringify({
          requestId: "invalid_profile_candidates",
          adapterVersion: "web-cad.agent-adapter.v1",
          query: {
            version: "cadops.v1",
            query: { query: "sketch.profileCandidates" }
          }
        })
      )
    ).toThrow("Invalid CADOps agent adapter query request.");
  });

  it("passes V11 sketch solver status queries through the adapter", () => {
    const engine = new CadEngine();

    executeCadOpsAgentRequest(engine, {
      requestId: "agent_req_solver_seed",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "sketch.create",
            id: "agent_solver_sketch",
            name: "Agent solver sketch",
            plane: "XY"
          },
          {
            op: "sketch.addCircle",
            sketchId: "agent_solver_sketch",
            id: "agent_solver_circle",
            center: [0, 0],
            radius: 2
          },
          {
            op: "sketch.dimension.create",
            id: "agent_solver_radius",
            name: "Radius",
            sketchId: "agent_solver_sketch",
            entityId: "agent_solver_circle",
            target: { entityKind: "circle", role: "radius" },
            value: 2
          }
        ]
      }
    });

    const response = executeCadOpsAgentQueryRequest(engine, {
      requestId: "agent_req_solver_status",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "sketch.solverStatus",
          sketchId: "agent_solver_sketch"
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_req_solver_status",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: "sketch.solverStatus",
      sketchId: "agent_solver_sketch",
      status: "under-defined",
      readiness: "ready",
      solver: {
        engine: "current-direct-evaluator",
        numericalSolverStatus: "under-defined",
        numericalSolverEngine: "@web-cad/sketch-solver",
        numericalSolverModelVersion: "partbench.sketch-solver.v2",
        modelBuilt: true,
        solverRan: true,
        canSolveNumerically: true
      },
      entityCount: 1,
      dimensionCount: 1,
      deferredConstraintCount: 1,
      profileValidity: {
        status: "valid",
        validProfileCount: 1
      },
      sourceContract: {
        emittedProjectSchemaVersion: "web-cad.project.v16",
        requiresProjectSchemaMigration: false,
        nextProjectSchemaVersion: "web-cad.project.v17"
      },
      requiresProjectSchemaMigration: false
    });

    if (!response.ok || response.query !== "sketch.solverStatus") {
      throw new Error("Expected sketch.solverStatus agent response.");
    }

    expect(
      JSON.stringify({
        entities: response.entities,
        dimensions: response.dimensions,
        constraints: response.constraints,
        sourceContract: response.sourceContract
      })
    ).not.toMatch(/mesh|occt|opfs|fileHandle|selectionBuffer|viewport|gpu/i);

    expect(
      executeCadOpsAgentRequest(engine, {
        requestId: "agent_req_solver_dry_run",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch: {
          version: "cadops.v1",
          mode: "dryRun",
          ops: [
            {
              op: "sketch.dimension.update",
              id: "agent_solver_radius",
              value: 3
            },
            {
              op: "sketch.constraint.create",
              id: "agent_solver_fixed_center",
              name: "Fixed circle center",
              sketchId: "agent_solver_sketch",
              kind: "fixed",
              target: { entityId: "agent_solver_circle", role: "center" }
            }
          ]
        }
      })
    ).toMatchObject({
      ok: true,
      requestId: "agent_req_solver_dry_run",
      mode: "dryRun",
      createdSketchConstraintIds: ["agent_solver_fixed_center"],
      modifiedSketchDimensionIds: ["agent_solver_radius"],
      modifiedSketchEntityIds: ["agent_solver_circle"],
      review: {
        requestedMode: "dryRun",
        effectiveIntent: "dryRun",
        commitGate: {
          blocked: false,
          permissionProvided: false
        }
      }
    });

    expect(
      executeCadOpsAgentQueryRequest(engine, {
        requestId: "agent_req_solver_dimension_after_dry_run",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: {
            query: "sketch.dimension.get",
            id: "agent_solver_radius"
          }
        }
      })
    ).toMatchObject({
      ok: true,
      query: "sketch.dimension.get",
      dimension: {
        id: "agent_solver_radius",
        effectiveValue: 2
      }
    });

    expect(
      executeCadOpsAgentQueryRequest(engine, {
        requestId: "agent_req_solver_status_after_dry_run",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: {
            query: "sketch.solverStatus",
            sketchId: "agent_solver_sketch"
          }
        }
      })
    ).toMatchObject({
      ok: true,
      query: "sketch.solverStatus",
      solver: {
        numericalSolverStatus: "under-defined"
      },
      dimensionCount: 1,
      constraintCount: 0,
      dimensions: [
        expect.objectContaining({
          dimensionId: "agent_solver_radius",
          effectiveValue: 2
        })
      ],
      constraints: []
    });

    expect(
      executeCadOpsAgentRequest(engine, {
        requestId: "agent_req_solver_commit",
        adapterVersion: "web-cad.agent-adapter.v1",
        permissions: { allowCommit: true },
        batch: {
          version: "cadops.v1",
          mode: "commit",
          ops: [
            {
              op: "sketch.dimension.update",
              id: "agent_solver_radius",
              value: 3
            },
            {
              op: "sketch.constraint.create",
              id: "agent_solver_fixed_center",
              name: "Fixed circle center",
              sketchId: "agent_solver_sketch",
              kind: "fixed",
              target: { entityId: "agent_solver_circle", role: "center" }
            }
          ]
        }
      })
    ).toMatchObject({
      ok: true,
      requestId: "agent_req_solver_commit",
      createdSketchConstraintIds: ["agent_solver_fixed_center"],
      modifiedSketchDimensionIds: ["agent_solver_radius"],
      modifiedSketchEntityIds: ["agent_solver_circle"]
    });

    const committedStatus = executeCadOpsAgentQueryRequest(engine, {
      requestId: "agent_req_solver_status_committed",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "sketch.solverStatus",
          sketchId: "agent_solver_sketch"
        }
      }
    });

    expect(committedStatus).toMatchObject({
      ok: true,
      requestId: "agent_req_solver_status_committed",
      query: "sketch.solverStatus",
      solver: {
        numericalSolverStatus: "converged",
        numericalSolverEngine: "@web-cad/sketch-solver",
        modelBuilt: true,
        solverRan: true,
        canSolveNumerically: true,
        variableCount: 3,
        residualCount: 3
      },
      dimensions: expect.arrayContaining([
        expect.objectContaining({
          dimensionId: "agent_solver_radius",
          effectiveValue: 3,
          status: "healthy"
        })
      ]),
      constraints: expect.arrayContaining([
        expect.objectContaining({
          constraintId: "agent_solver_fixed_center",
          kind: "fixed",
          supportedByCurrentEvaluator: true
        })
      ])
    });
  });

  it("returns one object through adapter query JSON", () => {
    const adapter = new CadOpsAgentAdapter();

    adapter.execute({
      requestId: "agent_req_create",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createBox",
            id: "query_box",
            name: "Query box",
            dimensions: { width: 4, height: 5, depth: 6 }
          }
        ]
      }
    });

    const request = parseCadOpsAgentQueryRequestJson(
      JSON.stringify({
        requestId: "agent_query_json",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "object.get", id: "query_box" }
        }
      })
    );
    const response = JSON.parse(adapter.queryJson(JSON.stringify(request))) as {
      readonly ok: boolean;
      readonly requestId: string;
      readonly query: string;
      readonly object: { readonly id: string; readonly kind: string };
    };

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_query_json",
      query: "object.get",
      object: {
        id: "query_box",
        kind: "box"
      }
    });
  });

  it("returns object measurements through adapter queries", () => {
    const engine = new CadEngine();

    engine.apply({
      op: "scene.createBox",
      id: "measured_box",
      dimensions: { width: 2, height: 4, depth: 6 }
    });

    const response = executeCadOpsAgentQueryRequest(engine, {
      requestId: "agent_measure_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "object.measurements", id: "measured_box" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_measure_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "object.measurements",
      measurements: {
        id: "measured_box",
        kind: "box",
        approximateVolume: 48,
        localBounds: {
          min: [-1, -2, -3],
          max: [1, 2, 3]
        }
      }
    });
  });

  it("returns authored body measurements through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_body_measure",
      entityId: "rect_body_measure",
      featureId: "feat_body_measure",
      bodyId: "body_measure"
    });

    const response = adapter.query({
      requestId: "agent_body_measure",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "body.measurements", bodyId: "body_measure" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_body_measure",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "body.measurements",
      measurements: {
        bodyId: "body_measure",
        sourceFeatureId: "feat_body_measure",
        sourceSketchId: "sketch_body_measure",
        sourceSketchEntityId: "rect_body_measure",
        profileKind: "rectangle",
        depth: 4,
        volume: 24,
        surfaceArea: 52,
        localBounds: {
          min: [-1, -1.5, 0],
          max: [1, 1.5, 4],
          size: [2, 3, 4]
        }
      }
    });
  });

  it("returns body measurement errors through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.query({
      requestId: "agent_missing_body_measure",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "body.measurements", bodyId: "missing_body" }
      }
    });

    expect(response).toMatchObject({
      ok: false,
      requestId: "agent_missing_body_measure",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "body.measurements",
      error: {
        code: "BODY_NOT_FOUND",
        bodyId: "missing_body"
      }
    });
  });

  it("returns project export readiness through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_export_readiness",
      entityId: "rect_export_readiness",
      featureId: "feat_export_readiness",
      bodyId: "body_export_readiness"
    });

    const response = adapter.query({
      requestId: "agent_export_readiness",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "project.exportReadiness" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_export_readiness",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "project.exportReadiness",
      status: "deferred",
      canExportFiles: false,
      units: "mm",
      formatCount: 2,
      bodyCount: 1,
      sourceSupportedBodyCount: 1,
      formats: expect.arrayContaining([
        expect.objectContaining({
          format: "step",
          status: "deferred",
          available: false,
          writerStatus: "available",
          diagnostics: []
        })
      ]),
      bodies: [
        expect.objectContaining({
          bodyId: "body_export_readiness",
          sourceKind: "authoredExtrude",
          sourceStatus: "supported",
          status: "deferred"
        })
      ],
      plan: { orderedBodyIds: ["body_export_readiness"] },
      currentExactResults: [
        { bodyId: "body_export_readiness", status: "pending" }
      ]
    });
  });

  it("passes exact STEP export source requests through CADOps", () => {
    const adapter = new CadOpsAgentAdapter();

    adapter.execute({
      requestId: "agent_create_export_body",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "sketch.create",
            id: "sketch_exact_export",
            name: "Profile",
            plane: "XY"
          },
          {
            op: "sketch.addRectangle",
            sketchId: "sketch_exact_export",
            id: "rect_exact_export",
            center: [0, 0],
            width: 4,
            height: 2
          },
          {
            op: "feature.extrude",
            id: "feat_exact_export",
            bodyId: "body_exact_export",
            sketchId: "sketch_exact_export",
            entityId: "rect_exact_export",
            depth: 3
          }
        ]
      }
    });

    const response = adapter.query({
      requestId: "agent_exact_export",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "project.exportExact",
          format: "step",
          bodyIds: ["body_exact_export"]
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_exact_export",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "project.exportExact",
      format: "step",
      status: "deferred",
      available: false,
      canExportFile: false,
      writerStatus: "available",
      requestedBodyIds: ["body_exact_export"],
      sourceSupportedBodyCount: 1,
      exportableBodyCount: 0,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: "EXPORT_BODY_SOURCE_SUPPORTED",
          status: "supported",
          bodyId: "body_exact_export"
        })
      ]),
      plan: { orderedBodyIds: ["body_exact_export"] },
      currentExactResults: [{ bodyId: "body_exact_export", status: "pending" }],
      exportSources: [
        expect.objectContaining({
          bodyId: "body_exact_export",
          sourceKind: "authoredExtrude",
          featureId: "feat_exact_export",
          sourceSketchId: "sketch_exact_export",
          sourceSketchEntityId: "rect_exact_export",
          profile: expect.objectContaining({
            kind: "rectangle",
            width: 4,
            height: 2
          }),
          depth: 3
        })
      ]
    });
    expect(response.ok && "artifact" in response).toBe(false);
  });

  it("injects connected current exact evidence without exposing file authority", () => {
    const engine = new CadEngine();
    let evidence: CadOpsAgentCurrentExactEvidence = {
      derivedExactMetadata: [],
      currentExactResults: []
    };
    const adapter = new CadOpsAgentAdapter(engine, () => evidence);
    seedExtrudeFeature(adapter, {
      sketchId: "sketch_connected_exact",
      entityId: "rect_connected_exact",
      featureId: "feat_connected_exact",
      bodyId: "body_connected_exact"
    });
    const topology = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.topology", bodyId: "body_connected_exact" }
    });
    if (!topology.ok || topology.query !== "body.topology") {
      throw new Error("Expected connected exact body topology.");
    }
    const sourceIdentitySignature = topology.topology.sourceIdentity.signature;
    evidence = {
      derivedExactMetadata: [
        {
          bodyId: "body_connected_exact",
          sourceIdentitySignature,
          status: "ready",
          metadata: {
            source: "kernel-derived",
            confidence: "kernel-derived",
            bounds: {
              min: [0, 0, 0],
              max: [4, 2, 3],
              size: [4, 2, 3],
              center: [2, 1, 1.5]
            },
            volume: 24,
            surfaceArea: 52,
            centroid: [2, 1, 1.5],
            diagnostics: []
          }
        }
      ],
      currentExactResults: [
        {
          status: "ready",
          bodyId: "body_connected_exact",
          sourceType: "sketchExtrudeFeature",
          sourceIdentitySignature,
          diagnostics: []
        }
      ]
    };

    const response = adapter.query({
      requestId: "agent_connected_exact",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "project.exportExact",
          format: "step",
          bodyIds: ["body_connected_exact"]
        }
      }
    });
    const surface = adapter.inspectV8ProjectSurface({
      requestId: "agent_connected_surface",
      adapterVersion: "web-cad.agent-adapter.v1",
      exactExport: {
        format: "step",
        bodyIds: ["body_connected_exact"]
      }
    });
    const massProperties = adapter.query({
      requestId: "agent_connected_exact_mass",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "body.massProperties",
          bodyId: "body_connected_exact"
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      query: "project.exportExact",
      status: "supported",
      available: true,
      requestedBodyIds: ["body_connected_exact"],
      plan: {
        schema: "AP242DIS",
        orderedBodyIds: ["body_connected_exact"],
        allOrNothing: true
      },
      currentExactResults: [
        { bodyId: "body_connected_exact", status: "ready" }
      ],
      artifactPolicy: {
        artifactBytesReturned: false,
        fileWritesPerformed: false
      }
    });
    expect(surface).toMatchObject({
      exportReadiness: {
        status: "supported",
        plan: { orderedBodyIds: ["body_connected_exact"] }
      },
      exactExport: {
        status: "supported",
        available: true,
        plan: { orderedBodyIds: ["body_connected_exact"] }
      },
      fileWriting: {
        defaultBehavior: "readiness-only",
        adapterWritesUserVisibleFiles: false,
        mcpWritesUserVisibleFiles: false,
        artifactBytesReturned: false,
        localLocationsAccepted: false,
        browserHandlesAccepted: false,
        opfsLocationsAccepted: false
      }
    });
    expect(massProperties).toMatchObject({
      ok: true,
      query: "body.massProperties",
      massProperties: {
        bodyId: "body_connected_exact",
        volume: 24
      }
    });
    expect(JSON.stringify({ response, surface })).not.toMatch(
      /"bytes"\s*:|"fileHandle"\s*:|"localPath"\s*:|"opfsPath"\s*:|"occtShape"\s*:|"rendererId"\s*:|"meshId"\s*:|"jobId"\s*:|"cacheKey"\s*:/i
    );
  });

  it("returns V8 package readiness through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_package_readiness",
      entityId: "rect_package_readiness",
      featureId: "feat_package_readiness",
      bodyId: "body_package_readiness"
    });

    const response = adapter.query({
      requestId: "agent_package_readiness",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "project.packageReadiness" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_package_readiness",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "project.packageReadiness",
      status: "supported",
      packageVersion: "partbench.wcad.v1",
      fileExtension: ".wcad",
      sourceIdentityAlgorithm: "partbench-source-v1",
      documentSchemaVersion: "web-cad.project.v16",
      canRepresentCurrentSource: true,
      requiresProjectSchemaMigration: false,
      requiredEntries: [
        { role: "manifest", path: "manifest.json", source: true },
        { role: "document", path: "document.cbor", source: true },
        { role: "commands", path: "commands.cbor", source: true }
      ],
      capabilities: expect.arrayContaining([
        expect.objectContaining({
          capability: "packageContract",
          status: "supported"
        }),
        expect.objectContaining({
          capability: "packageReadWrite",
          status: "supported"
        }),
        expect.objectContaining({
          capability: "fileSystemAccess",
          status: "supported"
        }),
        expect.objectContaining({
          capability: "opfsCache",
          status: "supported",
          available: true
        }),
        expect.objectContaining({
          capability: "stepExport",
          status: "supported",
          available: true
        })
      ])
    });
    expect(JSON.stringify(response)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|opfsPath|fileHandle|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex/i
    );
  });

  it("returns V15 STEP import readiness through adapter queries and batch reviews", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_import_readiness",
      entityId: "rect_import_readiness",
      featureId: "feat_import_readiness",
      bodyId: "body_import_readiness"
    });

    const readiness = adapter.query({
      requestId: "agent_import_readiness",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "project.importReadiness" }
      }
    });
    const ordinaryBody = adapter.query({
      requestId: "agent_imported_body_status",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "body.importedBodyStatus",
          bodyId: "body_import_readiness"
        }
      }
    });
    const importAttempt = adapter.execute({
      requestId: "agent_import_step",
      adapterVersion: "web-cad.agent-adapter.v1",
      batch: {
        version: "cadops.v1",
        mode: "dryRun",
        ops: [
          {
            op: "project.importStep",
            sourceFileName: "bracket.step",
            sourceFormat: "step",
            payloadRef: {
              kind: "transient",
              payloadId: "step_payload_agent_1",
              byteLength: 128,
              sha256:
                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            },
            maxBodyCount: 1
          }
        ]
      }
    });

    expect(readiness).toMatchObject({
      ok: true,
      requestId: "agent_import_readiness",
      query: "project.importReadiness",
      sourceFormat: "step",
      status: "unavailable",
      importedBodyCount: 0,
      mutatesSource: false,
      diagnostics: [
        expect.objectContaining({
          code: "STEP_READER_UNAVAILABLE",
          severity: "blocking"
        })
      ]
    });
    expect(ordinaryBody).toMatchObject({
      ok: true,
      requestId: "agent_imported_body_status",
      query: "body.importedBodyStatus",
      bodyId: "body_import_readiness",
      imported: false,
      status: "not-imported",
      availableDownstreamOperations: []
    });
    expect(importAttempt).toMatchObject({
      ok: false,
      requestId: "agent_import_step",
      mode: "dryRun",
      error: {
        code: "STEP_READER_UNAVAILABLE",
        op: "project.importStep",
        sourceFileName: "bracket.step",
        payloadId: "step_payload_agent_1"
      },
      review: {
        operations: [
          {
            index: 0,
            op: "project.importStep",
            intent: "create",
            label: "Import STEP bracket.step"
          }
        ]
      }
    });
  });

  it("returns V13 topology identity readiness through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_topology_identity",
      entityId: "rect_topology_identity",
      featureId: "feat_topology_identity",
      bodyId: "body_topology_identity"
    });

    const response = adapter.query({
      requestId: "agent_topology_identity_readiness",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "project.topologyIdentityReadiness" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_topology_identity_readiness",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "project.topologyIdentityReadiness",
      contractVersion: "partbench.topology-identity.v1",
      status: "supported",
      currentDocumentSchemaVersion: "web-cad.project.v16",
      plannedProjectSchemaVersion: "web-cad.project.v18",
      currentPackageVersion: "partbench.wcad.v1",
      plannedPackageVersion: "partbench.wcad.v2",
      requiresProjectSchemaMigration: false,
      requiresPackageVersionMigration: false,
      currentFeatureCount: 1,
      currentBodyCount: 1,
      snapshotDescriptorCount: 0,
      anchorCount: 0,
      checkpointCount: 0,
      matchResultCount: 0,
      repairCandidateCount: 0,
      capabilities: expect.arrayContaining([
        expect.objectContaining({
          capability: "protocolVocabulary",
          status: "supported"
        }),
        expect.objectContaining({
          capability: "matchingEngine",
          status: "supported"
        }),
        expect.objectContaining({
          capability: "commandEligibility",
          status: "supported"
        })
      ]),
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: "TOPOLOGY_PUBLIC_ID_BOUNDARY_ENFORCED",
          status: "supported"
        }),
        expect.objectContaining({
          code: "TOPOLOGY_COMMAND_ELIGIBILITY_READY",
          status: "supported"
        })
      ])
    });
    expect(JSON.stringify(response)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|gpuBuffer|opfsPath|fileHandle|localPath|exportArtifactId|selectionBufferId|pixelId|triangleIndex|faceIndex|edgeIndex|vertexIndex|checkpointEntityId/i
    );
  });

  it("passes topology snapshot matching queries through the adapter", () => {
    const adapter = new CadOpsAgentAdapter();
    const topologySnapshot = {
      source: "kernel-derived" as const,
      status: "ready" as const,
      entityCounts: {
        bodyCount: 0,
        solidCount: 0,
        faceCount: 1,
        wireCount: 0,
        edgeCount: 0,
        vertexCount: 0,
        loopCount: 0,
        coedgeCount: 0,
        axisCount: 0
      },
      entityCount: 1,
      entities: [
        {
          localId: "face_old",
          kind: "face" as const,
          source: "kernel-derived" as const,
          signature: "face-signature"
        }
      ],
      unsupportedEntityKinds: [],
      adjacencyAvailable: true,
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1" as const,
      signature: "snapshot-signature",
      diagnostics: []
    };
    const response = adapter.query({
      requestId: "agent_topology_match",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "topology.matchSnapshots",
          previous: {
            checkpointId: "checkpoint_old",
            bodyId: "body_1",
            topologySnapshot
          },
          candidates: [
            {
              checkpointId: "checkpoint_new",
              bodyId: "body_1",
              topologySnapshot: {
                ...topologySnapshot,
                entities: [
                  {
                    localId: "face_new",
                    kind: "face" as const,
                    source: "kernel-derived" as const,
                    signature: "face-signature"
                  }
                ]
              }
            }
          ]
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_topology_match",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: "topology.matchSnapshots",
      status: "active",
      resultCount: 1,
      mutatesSource: false,
      matchResults: [
        expect.objectContaining({
          state: "active",
          confidence: "exact",
          previousCheckpointEntityId: "face_old",
          candidateCheckpointEntityId: "face_new"
        })
      ]
    });
  });

  it("passes topology anchor repair candidate grouping through the adapter", () => {
    const adapter = new CadOpsAgentAdapter(createTopologyAnchorEngine());
    const topologySnapshot = {
      source: "kernel-derived" as const,
      status: "ready" as const,
      entityCounts: {
        bodyCount: 0,
        solidCount: 0,
        faceCount: 1,
        wireCount: 0,
        edgeCount: 0,
        vertexCount: 0,
        loopCount: 0,
        coedgeCount: 0,
        axisCount: 0
      },
      entityCount: 1,
      entities: [
        {
          localId: "checkpoint-local-face-1",
          kind: "face" as const,
          source: "kernel-derived" as const,
          signature: "face_signature_1"
        }
      ],
      unsupportedEntityKinds: [],
      adjacencyAvailable: true,
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1" as const,
      signature: "snapshot-signature",
      diagnostics: []
    };
    const response = adapter.query({
      requestId: "agent_topology_anchor_repair_candidates",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "topology.anchorRepairCandidates",
          previous: {
            checkpointId: "checkpoint_1",
            bodyId: "body_rect_1",
            topologySnapshot
          },
          candidates: [
            {
              checkpointId: "checkpoint_2",
              bodyId: "body_rect_1",
              topologySnapshot: {
                ...topologySnapshot,
                entityCounts: {
                  ...topologySnapshot.entityCounts,
                  faceCount: 2
                },
                entityCount: 2,
                entities: [
                  {
                    localId: "snapshot-local:face:a",
                    kind: "face" as const,
                    source: "kernel-derived" as const,
                    signature: "face_signature_1"
                  },
                  {
                    localId: "snapshot-local:face:b",
                    kind: "face" as const,
                    source: "kernel-derived" as const,
                    signature: "face_signature_1"
                  }
                ]
              }
            }
          ],
          anchorIds: ["anchor_face_1"]
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_topology_anchor_repair_candidates",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: "topology.anchorRepairCandidates",
      status: "split",
      anchorGroupCount: 1,
      anchorGroups: [
        expect.objectContaining({
          anchorId: "anchor_face_1",
          target: { type: "topologyAnchor", anchorId: "anchor_face_1" },
          state: "split",
          candidateIdScope: "topology-match-preview",
          repairCandidateCount: 2
        })
      ],
      mutatesSource: false
    });
  });

  it("passes topology anchor command readiness through the adapter", () => {
    const adapter = new CadOpsAgentAdapter(createTopologyAnchorEngine());
    const response = adapter.query({
      requestId: "agent_topology_anchor_command_readiness",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "topology.anchorCommandReadiness",
          anchorId: "anchor_face_1",
          requiredOperation: "feature.attachSketchPlane",
          snapshot: {
            checkpointId: "checkpoint_1",
            bodyId: "body_rect_1",
            sourceFeatureId: "feat_rect_1",
            topologySnapshot: {
              source: "kernel-derived",
              status: "ready",
              entityCounts: {
                bodyCount: 0,
                solidCount: 0,
                faceCount: 1,
                wireCount: 0,
                edgeCount: 0,
                vertexCount: 0,
                loopCount: 0,
                coedgeCount: 0,
                axisCount: 0
              },
              entityCount: 1,
              entities: [
                {
                  localId: "checkpoint-local-face-1",
                  kind: "face",
                  source: "kernel-derived",
                  signature: "face_signature_1",
                  bounds: { min: [0, 0, 1], max: [1, 1, 1] }
                }
              ],
              unsupportedEntityKinds: [],
              adjacencyAvailable: true,
              signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
              signature: "snapshot-signature",
              diagnostics: []
            }
          }
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_topology_anchor_command_readiness",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: "topology.anchorCommandReadiness",
      status: "ready",
      selectionStatus: "resolved",
      commandable: true,
      commandOperations: [
        "feature.attachSketchPlane",
        "feature.measureReference",
        "feature.selectReference",
        "feature.shell"
      ],
      candidateCount: 1,
      proof: {
        kind: "axisAlignedPlanarFace",
        evidenceSource: "checkpointSnapshot",
        exposesCheckpointLocalIds: false
      },
      mutatesSource: false,
      exposesCheckpointLocalIds: false
    });
    expect(JSON.stringify(response)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|gpuBuffer|opfsPath|fileHandle|localPath|exportArtifactId|selectionBufferId|pixelId|triangleIndex|faceIndex|edgeIndex|vertexIndex|checkpointEntityId|checkpoint-local/i
    );

    const targetReadiness = adapter.query({
      requestId: "agent_topology_command_target_readiness",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "topology.commandTargetReadiness",
          target: { type: "topologyAnchor", anchorId: "anchor_face_1" },
          desiredOperation: "feature.attachSketchPlane",
          snapshot: {
            checkpointId: "checkpoint_1",
            bodyId: "body_rect_1",
            sourceFeatureId: "feat_rect_1",
            topologySnapshot: {
              source: "kernel-derived",
              status: "ready",
              entityCounts: {
                bodyCount: 0,
                solidCount: 0,
                faceCount: 1,
                wireCount: 0,
                edgeCount: 0,
                vertexCount: 0,
                loopCount: 0,
                coedgeCount: 0,
                axisCount: 0
              },
              entityCount: 1,
              entities: [
                {
                  localId: "checkpoint-local-face-1",
                  kind: "face",
                  source: "kernel-derived",
                  signature: "face_signature_1",
                  bounds: { min: [0, 0, 1], max: [1, 1, 1] }
                }
              ],
              unsupportedEntityKinds: [],
              adjacencyAvailable: true,
              signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
              signature: "snapshot-signature",
              diagnostics: []
            }
          }
        }
      }
    });

    expect(targetReadiness).toMatchObject({
      ok: true,
      requestId: "agent_topology_command_target_readiness",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: "topology.commandTargetReadiness",
      status: "ready",
      commandable: true,
      supportedOperations: [
        "feature.attachSketchPlane",
        "feature.measureReference",
        "feature.selectReference",
        "feature.shell"
      ],
      anchorReadiness: expect.objectContaining({
        query: "topology.anchorCommandReadiness",
        status: "ready"
      }),
      mutatesSource: false,
      exposesPrivateIds: false
    });
    expect(JSON.stringify(targetReadiness)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|gpuBuffer|opfsPath|fileHandle|localPath|exportArtifactId|selectionBufferId|pixelId|triangleIndex|faceIndex|edgeIndex|vertexIndex|checkpointEntityId|checkpoint-local/i
    );
  });

  it("passes topology anchor creation planning through the adapter", () => {
    const adapter = new CadOpsAgentAdapter(createTopologyAnchorEngine());
    const response = adapter.query({
      requestId: "agent_topology_anchor_plan",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "topology.anchorCreationPlan",
          bodyId: "body_rect_1",
          stableId: "generated:face:body_rect_1:endCap"
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_topology_anchor_plan",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: "topology.anchorCreationPlan",
      status: "alreadyExists",
      bodyId: "body_rect_1",
      stableId: "generated:face:body_rect_1:endCap",
      createsCheckpoint: false,
      createsAnchor: false,
      opCount: 0,
      ops: [],
      mutatesSource: false
    });
  });

  it("passes topology anchor repair planning through the adapter", () => {
    const adapter = new CadOpsAgentAdapter(createTopologyAnchorRepairEngine());
    const response = adapter.query({
      requestId: "agent_topology_anchor_repair_plan",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "topology.anchorRepairPlan",
          anchorId: "anchor_face_1",
          replacementCheckpointId: "checkpoint_2",
          selectedRepairCandidateId: "topology_repair_candidate_passthrough",
          repairId: "repair_agent_1",
          derivedExactMetadata: createRepairPlanExactMetadata()
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_topology_anchor_repair_plan",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: "topology.anchorRepairPlan",
      status: "ready",
      anchorId: "anchor_face_1",
      bodyId: "body_rect_1",
      replacementCheckpointId: "checkpoint_2",
      replacementCheckpointEntityId: "snapshot-local:face:repaired",
      repairId: "repair_agent_1",
      createsRepair: true,
      opCount: 1,
      mutatesSource: false
    });
  });

  it("passes topology match context through reference health adapter queries", () => {
    const adapter = new CadOpsAgentAdapter(createTopologyAnchorEngine());
    const response = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_topology_reference_health",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "reference.health",
          target: { type: "topologyAnchor", anchorId: "anchor_face_1" },
          topologyMatchResults: [createTopologyAnchorMatchResult()]
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_topology_reference_health",
      query: "reference.health",
      status: "replaced",
      referenceHealth: [
        expect.objectContaining({
          source: "topologyAnchor",
          topologyAnchorId: "anchor_face_1",
          matchConfidence: "high",
          matchState: "replaced",
          commandable: false
        })
      ]
    });
  });

  it("returns a compact V8 Agent/MCP package and export surface", () => {
    const adapter = new CadOpsAgentAdapter();

    adapter.execute({
      requestId: "agent_surface_primitive",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createBox",
            id: "surface_box",
            dimensions: { width: 1, height: 1, depth: 1 }
          }
        ]
      }
    });
    seedExtrudeFeature(adapter, {
      sketchId: "sketch_surface_export",
      entityId: "rect_surface_export",
      featureId: "feat_surface_export",
      bodyId: "body_surface_export"
    });

    const response = adapter.inspectV8ProjectSurface({
      requestId: "agent_v8_surface",
      adapterVersion: "web-cad.agent-adapter.v1",
      exactExport: {
        format: "step",
        bodyIds: ["body_surface_export"]
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_v8_surface",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      surface: "v8.agent_mcp_package_export",
      project: {
        units: "mm",
        objectCount: 1,
        bodyCount: 2,
        authoredBodyFeatureCount: 1,
        primitiveCompatibilityBodyCount: 1
      },
      package: {
        packageVersion: "partbench.wcad.v1",
        fileExtension: ".wcad",
        documentSchemaVersion: "web-cad.project.v16",
        sourceIdentityAlgorithm: "partbench-source-v1",
        canRepresentCurrentSource: true,
        capabilities: expect.arrayContaining([
          expect.objectContaining({
            capability: "packageReadWrite",
            status: "supported"
          }),
          expect.objectContaining({
            capability: "opfsCache"
          })
        ])
      },
      cache: {
        cachePolicy: "optional-rebuildable",
        opfsLocationsExposed: false,
        clearMutatesSource: false,
        sourceIdentityIncludesCache: false
      },
      exportReadiness: {
        status: "deferred",
        canExportFiles: false,
        bodyCount: 2,
        sourceSupportedBodyCount: 2,
        unsupportedBodyCount: 0,
        unsupportedBodies: []
      },
      exactExport: {
        format: "step",
        status: "deferred",
        available: false,
        canExportFile: false,
        requestedBodyIds: ["body_surface_export"],
        exportableBodyCount: 0,
        exportSourceCount: 1,
        diagnosticCount: expect.any(Number),
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: "EXPORT_BODY_SOURCE_SUPPORTED",
            bodyId: "body_surface_export"
          })
        ]),
        artifactPolicy: {
          artifactBytesReturned: false,
          fileWritesPerformed: false,
          localLocationsAccepted: false,
          browserHandlesAccepted: false,
          requiresExplicitArtifactCapability: true,
          delivery: "caller-or-browser-ui"
        }
      },
      fileWriting: {
        defaultBehavior: "readiness-only",
        adapterWritesUserVisibleFiles: false,
        mcpWritesUserVisibleFiles: false,
        artifactBytesReturned: false,
        localLocationsAccepted: false,
        browserHandlesAccepted: false,
        opfsLocationsAccepted: false,
        futureFileWritesRequireExplicitCapability: true
      },
      boundaries: {
        browserHandlesExposed: false,
        localLocationsExposed: false,
        opfsLocationsExposed: false,
        rendererInternalsExposed: false,
        meshInternalsExposed: false,
        occtInternalsExposed: false,
        viewportStateExposed: false,
        selectionBufferInternalsExposed: false,
        packageBinaryReturned: false,
        stepBytesReturned: false,
        jsonImportExportPreserved: true
      }
    });
    expect(JSON.stringify(response)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|opfsPath|fileHandle|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|bytesBase64|localPath/i
    );
  });

  it("returns derived body topology status through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_body_topology",
      entityId: "rect_body_topology",
      featureId: "feat_body_topology",
      bodyId: "body_topology"
    });

    const response = adapter.query({
      requestId: "agent_body_topology",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "body.topology", bodyId: "body_topology" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_body_topology",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "body.topology",
      topology: {
        bodyId: "body_topology",
        status: "healthy",
        sourceIdentity: {
          featureId: "feat_body_topology",
          sourceSketchId: "sketch_body_topology",
          sourceSketchEntityId: "rect_body_topology",
          operationMode: "newBody"
        },
        topologyModel: "semantic-source",
        topologyAvailable: true,
        exactGeometryAvailable: false,
        exactMeasurementsAvailable: true,
        measurementConfidence: "source-analytic",
        faceCount: 6,
        edgeCount: 12,
        vertexCount: 8,
        issues: []
      }
    });

    if (!response.ok || response.query !== "body.topology") {
      throw new Error("Expected body topology response.");
    }

    const withExactMetadata = adapter.query({
      requestId: "agent_body_topology_exact",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "body.topology",
          bodyId: "body_topology",
          derivedExactMetadata: {
            bodyId: "body_topology",
            sourceIdentitySignature: response.topology.sourceIdentity.signature,
            status: "ready",
            metadata: {
              source: "kernel-derived",
              confidence: "kernel-derived",
              bounds: {
                min: [0, 0, 0],
                max: [4, 2, 3],
                size: [4, 2, 3],
                center: [2, 1, 1.5]
              },
              volume: 24,
              surfaceArea: 52,
              centroid: [2, 1, 1.5],
              topologyCounts: {
                solidCount: 1,
                wireCount: 6,
                faceCount: 6,
                edgeCount: 12,
                vertexCount: 8
              },
              topologySnapshot: {
                source: "kernel-derived",
                status: "partial",
                entityCounts: {
                  bodyCount: 1,
                  solidCount: 1,
                  faceCount: 6,
                  wireCount: 6,
                  edgeCount: 12,
                  vertexCount: 8,
                  loopCount: 0,
                  coedgeCount: 0,
                  axisCount: 0
                },
                entityCount: 34,
                entities: [
                  {
                    localId: "snapshot-local:body:0",
                    kind: "body",
                    source: "kernel-derived",
                    signature: "topology-body-test"
                  },
                  {
                    localId: "snapshot-local:solid:0",
                    kind: "solid" as const,
                    source: "kernel-derived" as const,
                    signature: "topology-solid-test"
                  },
                  ...Array.from({ length: 6 }, (_, index) => ({
                    localId: `snapshot-local:face:${index}`,
                    kind: "face" as const,
                    source: "kernel-derived" as const,
                    signature: `topology-face-test-${index}`
                  })),
                  ...Array.from({ length: 6 }, (_, index) => ({
                    localId: `snapshot-local:wire:${index}`,
                    kind: "wire" as const,
                    source: "kernel-derived" as const,
                    signature: `topology-wire-test-${index}`
                  })),
                  ...Array.from({ length: 12 }, (_, index) => ({
                    localId: `snapshot-local:edge:${index}`,
                    kind: "edge" as const,
                    source: "kernel-derived" as const,
                    signature: `topology-edge-test-${index}`
                  })),
                  ...Array.from({ length: 8 }, (_, index) => ({
                    localId: `snapshot-local:vertex:${index}`,
                    kind: "vertex" as const,
                    source: "kernel-derived" as const,
                    signature: `topology-vertex-test-${index}`
                  }))
                ],
                unsupportedEntityKinds: ["loop", "coedge", "axis"],
                adjacencyAvailable: false,
                signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
                signature: "topology-snapshot-test",
                diagnostics: [
                  {
                    code: "GEOMETRY_TOPOLOGY_SNAPSHOT_EXTRACTED",
                    message: "Derived topology snapshot extracted."
                  }
                ]
              },
              diagnostics: []
            }
          }
        }
      }
    });

    expect(withExactMetadata).toMatchObject({
      ok: true,
      requestId: "agent_body_topology_exact",
      query: "body.topology",
      topology: {
        bodyId: "body_topology",
        exactGeometryAvailable: true,
        exactMeasurementsAvailable: true,
        measurementConfidence: "kernel-derived",
        exactMetadata: {
          status: "healthy",
          volume: 24,
          topologySnapshot: {
            status: "partial",
            adjacencyAvailable: false
          }
        }
      }
    });
    expect(JSON.stringify(withExactMetadata)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex/i
    );

    const massProperties = adapter.query({
      requestId: "agent_mass_properties",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "body.massProperties",
          bodyId: "body_topology",
          density: 2,
          derivedExactMetadata: {
            bodyId: "body_topology",
            sourceIdentitySignature: response.topology.sourceIdentity.signature,
            status: "ready",
            metadata: {
              source: "kernel-derived",
              confidence: "kernel-derived",
              volume: 24,
              surfaceArea: 52,
              centroid: [2, 1, 1.5],
              diagnostics: []
            }
          }
        }
      }
    });
    expect(massProperties).toMatchObject({
      ok: true,
      query: "body.massProperties",
      massProperties: { bodyId: "body_topology", density: 2, mass: 48 }
    });
  });

  it("passes body topology identity candidate queries through the adapter", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_body_identity",
      entityId: "rect_body_identity",
      featureId: "feat_body_identity",
      bodyId: "body_identity"
    });

    const response = adapter.query({
      requestId: "agent_body_topology_identity",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "body.topologyIdentity", bodyId: "body_identity" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_body_topology_identity",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "body.topologyIdentity",
      bodyId: "body_identity",
      status: "missing",
      mutatesSource: false,
      candidates: expect.arrayContaining([
        expect.objectContaining({
          stableId: "generated:body:body_identity",
          kind: "body",
          status: "candidate"
        }),
        expect.objectContaining({
          stableId: "generated:face:body_identity:endCap",
          kind: "face",
          status: "candidate"
        })
      ])
    });
    expect(JSON.stringify(response)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|opfsPath|fileHandle/i
    );
  });

  it("accepts sphere commands and exposes sphere measurements through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    adapter.execute({
      requestId: "agent_sphere_commit",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createSphere",
            id: "agent_sphere",
            dimensions: { radius: 2 }
          }
        ]
      }
    });

    const response = adapter.query({
      requestId: "agent_sphere_measure",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "object.measurements", id: "agent_sphere" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_sphere_measure",
      query: "object.measurements",
      measurements: {
        id: "agent_sphere",
        kind: "sphere",
        dimensions: { radius: 2 },
        localBounds: {
          min: [-2, -2, -2],
          max: [2, 2, 2]
        }
      }
    });
  });

  it("accepts cone and torus commands and exposes their measurements through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    const commit = adapter.execute({
      requestId: "agent_cone_torus_commit",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createCone",
            id: "agent_cone",
            dimensions: { radius: 1.5, height: 4 }
          },
          {
            op: "scene.createTorus",
            id: "agent_torus",
            dimensions: { majorRadius: 3, minorRadius: 1 }
          }
        ]
      }
    });
    const cone = adapter.query({
      requestId: "agent_cone_measure",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "object.measurements", id: "agent_cone" }
      }
    });
    const torus = adapter.query({
      requestId: "agent_torus_measure",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "object.measurements", id: "agent_torus" }
      }
    });

    expect(commit).toMatchObject({
      ok: true,
      createdIds: ["agent_cone", "agent_torus"],
      transactionId: "txn_1"
    });
    expect(cone).toMatchObject({
      ok: true,
      requestId: "agent_cone_measure",
      query: "object.measurements",
      measurements: {
        id: "agent_cone",
        kind: "cone",
        dimensions: { radius: 1.5, height: 4 },
        localBounds: {
          min: [-1.5, -1.5, -2],
          max: [1.5, 1.5, 2]
        }
      }
    });
    expect(torus).toMatchObject({
      ok: true,
      requestId: "agent_torus_measure",
      query: "object.measurements",
      measurements: {
        id: "agent_torus",
        kind: "torus",
        dimensions: { majorRadius: 3, minorRadius: 1 },
        localBounds: {
          min: [-4, -4, -1],
          max: [4, 4, 1]
        }
      }
    });
  });

  it("returns project extents through adapter query JSON", () => {
    const adapter = new CadOpsAgentAdapter();

    adapter.execute({
      requestId: "agent_req_extents_create",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createCylinder",
            id: "extent_cylinder",
            dimensions: { radius: 1, height: 4 }
          }
        ]
      }
    });

    const request = parseCadOpsAgentQueryRequestJson(
      JSON.stringify({
        requestId: "agent_extents_json",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "project.extents" }
        }
      })
    );
    const response = JSON.parse(adapter.queryJson(JSON.stringify(request))) as {
      readonly ok: boolean;
      readonly query: string;
      readonly objectCount: number;
      readonly objects: readonly { readonly id: string }[];
      readonly approximateVolume: number;
    };

    expect(response).toMatchObject({
      ok: true,
      query: "project.extents",
      objectCount: 1,
      objects: [{ id: "extent_cylinder" }]
    });
    expect(response.approximateVolume).toBeCloseTo(4 * Math.PI);
  });

  it("passes derived exact metadata snapshots through project extents adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    adapter.execute({
      requestId: "agent_req_revolve_extents_create",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "sketch.create",
            id: "sketch_revolve",
            name: "Revolve",
            plane: "XY"
          },
          {
            op: "sketch.addRectangle",
            sketchId: "sketch_revolve",
            id: "rect_revolve",
            center: [2, 0],
            width: 1,
            height: 3
          },
          {
            op: "sketch.addLine",
            sketchId: "sketch_revolve",
            id: "axis_revolve",
            start: [0, -2],
            end: [0, 2]
          },
          {
            op: "feature.revolve",
            id: "feat_revolve",
            bodyId: "body_revolve",
            sketchId: "sketch_revolve",
            entityId: "rect_revolve",
            axis: {
              type: "sketchLine",
              sketchId: "sketch_revolve",
              entityId: "axis_revolve"
            },
            angleDegrees: 360
          }
        ]
      }
    });

    const topology = adapter.query({
      requestId: "agent_revolve_topology",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "body.topology", bodyId: "body_revolve" }
      }
    });

    if (!topology.ok || topology.query !== "body.topology") {
      throw new Error("Expected body topology response.");
    }

    const request = parseCadOpsAgentQueryRequestJson(
      JSON.stringify({
        requestId: "agent_extents_exact_json",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: {
            query: "project.extents",
            derivedExactMetadata: [
              {
                bodyId: "body_revolve",
                sourceIdentitySignature:
                  topology.topology.sourceIdentity.signature,
                status: "ready",
                metadata: {
                  source: "kernel-derived",
                  confidence: "kernel-derived",
                  bounds: {
                    min: [0, 0, 0],
                    max: [4, 2, 3],
                    size: [4, 2, 3],
                    center: [2, 1, 1.5]
                  },
                  volume: 24,
                  diagnostics: []
                }
              }
            ]
          }
        }
      })
    );
    const response = JSON.parse(adapter.queryJson(JSON.stringify(request))) as {
      readonly ok: boolean;
      readonly query: string;
      readonly bodyCount: number;
      readonly bodies: readonly {
        readonly bodyId: string;
        readonly extentSource: string;
        readonly volume: number;
      }[];
      readonly warnings: readonly unknown[];
    };

    expect(response).toMatchObject({
      ok: true,
      query: "project.extents",
      bodyCount: 1,
      bodies: [
        {
          bodyId: "body_revolve",
          extentSource: "kernel-derived",
          volume: 24
        }
      ],
      warnings: []
    });
  });

  it("returns primitive feature summaries through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    adapter.execute({
      requestId: "agent_req_features_create",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createBox",
            id: "feature_box",
            name: "Feature box",
            dimensions: { width: 2, height: 3, depth: 4 }
          }
        ]
      }
    });

    const response = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_features_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "project.features" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_features_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "project.features",
      featureCount: 1,
      features: [
        {
          id: "feature:feature_box",
          kind: "primitive",
          primitive: "box",
          objectId: "feature_box",
          name: "Feature box",
          source: {
            createdByTransactionId: "txn_1",
            createOp: "scene.createBox"
          }
        }
      ]
    });
  });

  it("returns derived part, feature, body, and object source mappings through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    adapter.execute({
      requestId: "agent_req_structure_create",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createCylinder",
            id: "structure_cylinder",
            name: "Structure cylinder",
            dimensions: { radius: 2, height: 8 }
          }
        ]
      }
    });

    const response = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_structure_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "project.structure" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_structure_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "project.structure",
      partCount: 1,
      featureCount: 1,
      bodyCount: 1,
      parts: [
        {
          id: "part:default",
          featureIds: ["feature:structure_cylinder"],
          bodyIds: ["body:structure_cylinder"],
          objectIds: ["structure_cylinder"]
        }
      ],
      features: [
        {
          id: "feature:structure_cylinder",
          partId: "part:default",
          primitive: "cylinder",
          objectId: "structure_cylinder",
          bodyId: "body:structure_cylinder"
        }
      ],
      bodies: [
        {
          id: "body:structure_cylinder",
          kind: "solid",
          partId: "part:default",
          featureId: "feature:structure_cylinder",
          objectId: "structure_cylinder",
          primitive: "cylinder"
        }
      ],
      objectSources: [
        {
          objectId: "structure_cylinder",
          partId: "part:default",
          featureId: "feature:structure_cylinder",
          bodyId: "body:structure_cylinder"
        }
      ]
    });
  });

  it("returns sketch queries and sketch batch IDs through the adapter", () => {
    const adapter = new CadOpsAgentAdapter();

    const commit = adapter.execute({
      requestId: "agent_req_sketch_create",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          { op: "sketch.create", name: "Adapter sketch", plane: "XY" },
          {
            op: "sketch.addCircle",
            sketchId: "sketch_1",
            center: [0, 0],
            radius: 2
          }
        ]
      }
    });

    const sketches = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_sketches_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "project.sketches" }
      }
    });
    const sketch = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_sketch_1",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "sketch.get", id: "sketch_1" }
      }
    });

    expect(commit).toMatchObject({
      ok: true,
      createdSketchIds: ["sketch_1"],
      createdSketchEntityIds: ["skent_1"]
    });
    expect(sketches).toMatchObject({
      ok: true,
      query: "project.sketches",
      sketchCount: 1,
      sketches: [
        {
          id: "sketch_1",
          name: "Adapter sketch",
          entities: [{ id: "skent_1", kind: "circle" }]
        }
      ]
    });
    expect(sketch).toMatchObject({
      ok: true,
      query: "sketch.get",
      sketch: {
        id: "sketch_1",
        plane: "XY"
      }
    });
  });

  it("passes sketch.createOnFace through JSON batch dry-run and commit", () => {
    const adapter = new CadOpsAgentAdapter();
    seedExtrudeFeature(adapter, {
      sketchId: "sketch_profile",
      entityId: "rect_profile",
      featureId: "feat_profile",
      bodyId: "body_profile"
    });

    const batch = {
      version: "cadops.v1" as const,
      mode: "dryRun" as const,
      ops: [
        {
          op: "sketch.createOnFace" as const,
          id: "sketch_face",
          name: "Face sketch",
          bodyId: "body_profile",
          faceStableId: "generated:face:body_profile:endCap"
        }
      ]
    };

    expect(
      adapter.execute({
        requestId: "agent_req_create_on_face_dry",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch
      })
    ).toMatchObject({
      ok: true,
      mode: "dryRun",
      createdSketchIds: ["sketch_face"]
    });

    expect(
      adapter.execute({
        requestId: "agent_req_create_on_face_commit",
        adapterVersion: "web-cad.agent-adapter.v1",
        permissions: { allowCommit: true },
        batch: { ...batch, mode: "commit" }
      })
    ).toMatchObject({
      ok: true,
      mode: "commit",
      createdSketchIds: ["sketch_face"]
    });

    const sketch = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_req_face_sketch_get",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "sketch.get", id: "sketch_face" }
      }
    });

    expect(sketch).toMatchObject({
      ok: true,
      sketch: {
        id: "sketch_face",
        attachment: {
          kind: "generatedFace",
          bodyId: "body_profile",
          faceRole: "endCap"
        }
      }
    });
  });

  it("passes sketch.createOnFace with a named face reference through JSON batch dry-run and commit", () => {
    const adapter = new CadOpsAgentAdapter();
    seedExtrudeFeature(adapter, {
      sketchId: "sketch_named_profile",
      entityId: "rect_named_profile",
      featureId: "feat_named_profile",
      bodyId: "body_named_profile"
    });

    const batch = {
      version: "cadops.v1" as const,
      mode: "dryRun" as const,
      ops: [
        {
          op: "reference.nameGenerated" as const,
          name: "Named end face",
          bodyId: "body_named_profile",
          stableId: "generated:face:body_named_profile:endCap"
        },
        {
          op: "sketch.createOnFace" as const,
          id: "sketch_named_face",
          name: "Named face sketch",
          referenceName: "Named end face"
        }
      ]
    };

    expect(
      adapter.execute({
        requestId: "agent_req_create_on_named_face_dry",
        adapterVersion: "web-cad.agent-adapter.v1",
        batch
      })
    ).toMatchObject({
      ok: true,
      mode: "dryRun",
      createdSketchIds: ["sketch_named_face"]
    });

    expect(
      adapter.execute({
        requestId: "agent_req_create_on_named_face_commit",
        adapterVersion: "web-cad.agent-adapter.v1",
        permissions: { allowCommit: true },
        batch: { ...batch, mode: "commit" }
      })
    ).toMatchObject({
      ok: true,
      mode: "commit",
      createdSketchIds: ["sketch_named_face"]
    });
  });

  it("passes sketch.createOnFace with a topology anchor through JSON batch dry-run and commit", () => {
    const engine = createTopologyAnchorEngine();
    const op = {
      op: "sketch.createOnFace" as const,
      id: "sketch_anchor_face",
      name: "Anchor face sketch",
      topologyAnchorId: "anchor_face_1"
    };
    const dryRun = executeCadOpsAgentRequest(engine, {
      requestId: "agent_req_create_on_anchor_face_dry",
      adapterVersion: "web-cad.agent-adapter.v1",
      batch: {
        version: "cadops.v1",
        mode: "dryRun",
        ops: [op]
      }
    });

    expect(dryRun).toMatchObject({
      ok: true,
      mode: "dryRun",
      createdSketchIds: ["sketch_anchor_face"],
      review: {
        operations: [
          expect.objectContaining({
            op: "sketch.createOnFace",
            topologyAnchorId: "anchor_face_1",
            label:
              "Create sketch sketch_anchor_face on topology anchor anchor_face_1"
          })
        ]
      }
    });

    const commit = executeCadOpsAgentRequest(engine, {
      requestId: "agent_req_create_on_anchor_face_commit",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [op]
      }
    });

    expect(commit).toMatchObject({
      ok: true,
      mode: "commit",
      createdSketchIds: ["sketch_anchor_face"]
    });
    expect(
      engine.getDocument().sketches.get("sketch_anchor_face")
    ).toMatchObject({
      attachment: {
        kind: "generatedFace",
        bodyId: "body_rect_1",
        faceStableId: "generated:face:body_rect_1:endCap"
      }
    });
  });

  it("passes reference.repairName with a topology anchor through JSON batch commit", () => {
    const engine = createTopologyAnchorEngine();
    const response = executeCadOpsAgentRequest(engine, {
      requestId: "agent_req_repair_name_to_anchor",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "reference.nameGenerated",
            name: "Top face",
            bodyId: "body_rect_1",
            stableId: "generated:face:body_rect_1:startCap"
          },
          {
            op: "reference.repairName",
            name: "Top face",
            topologyAnchorId: "anchor_face_1"
          }
        ]
      }
    });

    expect(response).toMatchObject({
      ok: true,
      mode: "commit",
      review: {
        operations: [
          expect.objectContaining({
            op: "reference.nameGenerated",
            referenceName: "Top face"
          }),
          expect.objectContaining({
            op: "reference.repairName",
            referenceName: "Top face",
            topologyAnchorId: "anchor_face_1",
            label:
              "Repair named reference Top face to topology anchor anchor_face_1"
          })
        ]
      }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "reference.resolveNamed", name: "Top face" }
      })
    ).toMatchObject({
      ok: true,
      target: {
        stableId: "generated:face:body_rect_1:endCap",
        topologyAnchorId: "anchor_face_1"
      }
    });
  });

  it("passes edge-finish features with topology anchors through JSON batch commit", () => {
    const adapter = new CadOpsAgentAdapter();
    const response = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_json_anchor_edge_finish",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [
              {
                op: "sketch.create",
                id: "anchor_edge_sketch",
                name: "Anchor edge profile",
                plane: "XY"
              },
              {
                op: "sketch.addRectangle",
                sketchId: "anchor_edge_sketch",
                id: "anchor_edge_rect",
                center: [0, 0],
                width: 4,
                height: 2
              },
              {
                op: "feature.extrude",
                id: "feat_anchor_edge",
                bodyId: "body_anchor_edge",
                sketchId: "anchor_edge_sketch",
                entityId: "anchor_edge_rect",
                depth: 3
              },
              {
                op: "topology.checkpoint.create",
                checkpointId: "checkpoint_anchor_edge",
                bodyId: "body_anchor_edge",
                sourceFeatureId: "feat_anchor_edge",
                sourceIdentity: {
                  algorithm: "partbench-source-v1",
                  sha256:
                    "8888888888888888888888888888888888888888888888888888888888888888"
                },
                status: "active"
              },
              {
                op: "topology.anchor.create",
                anchorId: "anchor_start_edge",
                entityKind: "edge",
                bodyId: "body_anchor_edge",
                checkpointId: "checkpoint_anchor_edge",
                checkpointEntityId: "checkpoint-local-start-edge",
                sourceFeatureId: "feat_anchor_edge",
                stableId: "generated:edge:body_anchor_edge:start:uMin"
              },
              {
                op: "feature.chamfer",
                id: "feat_anchor_chamfer",
                bodyId: "body_anchor_chamfer",
                targetBodyId: "body_anchor_edge",
                topologyAnchorId: "anchor_start_edge",
                distance: 0.2
              }
            ]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly createdFeatureIds?: readonly string[];
      readonly createdBodyIds?: readonly string[];
      readonly review?: { readonly operations?: readonly unknown[] };
    };

    expect(response).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_anchor_edge", "feat_anchor_chamfer"],
      createdBodyIds: ["body_anchor_edge", "body_anchor_chamfer"],
      review: {
        operations: expect.arrayContaining([
          expect.objectContaining({
            op: "feature.chamfer",
            topologyAnchorId: "anchor_start_edge",
            label:
              "Create chamfer feature feat_anchor_chamfer on topology anchor anchor_start_edge of body_anchor_edge"
          })
        ])
      }
    });

    const filletAdapter = new CadOpsAgentAdapter();
    const filletResponse = JSON.parse(
      filletAdapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_json_anchor_edge_fillet",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [
              {
                op: "sketch.create",
                id: "anchor_fillet_sketch",
                name: "Anchor fillet profile",
                plane: "XY"
              },
              {
                op: "sketch.addRectangle",
                sketchId: "anchor_fillet_sketch",
                id: "anchor_fillet_rect",
                center: [0, 0],
                width: 4,
                height: 2
              },
              {
                op: "feature.extrude",
                id: "feat_anchor_fillet_source",
                bodyId: "body_anchor_fillet_source",
                sketchId: "anchor_fillet_sketch",
                entityId: "anchor_fillet_rect",
                depth: 3
              },
              {
                op: "topology.checkpoint.create",
                checkpointId: "checkpoint_anchor_fillet",
                bodyId: "body_anchor_fillet_source",
                sourceFeatureId: "feat_anchor_fillet_source",
                sourceIdentity: {
                  algorithm: "partbench-source-v1",
                  sha256:
                    "9999999999999999999999999999999999999999999999999999999999999999"
                },
                status: "active"
              },
              {
                op: "topology.anchor.create",
                anchorId: "anchor_fillet_edge",
                entityKind: "edge",
                bodyId: "body_anchor_fillet_source",
                checkpointId: "checkpoint_anchor_fillet",
                checkpointEntityId: "checkpoint-local-fillet-edge",
                sourceFeatureId: "feat_anchor_fillet_source",
                stableId: "generated:edge:body_anchor_fillet_source:start:uMin"
              },
              {
                op: "feature.fillet",
                id: "feat_anchor_fillet",
                bodyId: "body_anchor_fillet",
                targetBodyId: "body_anchor_fillet_source",
                topologyAnchorId: "anchor_fillet_edge",
                radius: 0.15
              }
            ]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly createdFeatureIds?: readonly string[];
      readonly createdBodyIds?: readonly string[];
      readonly review?: { readonly operations?: readonly unknown[] };
    };

    expect(filletResponse).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_anchor_fillet_source", "feat_anchor_fillet"],
      createdBodyIds: ["body_anchor_fillet_source", "body_anchor_fillet"],
      review: {
        operations: expect.arrayContaining([
          expect.objectContaining({
            op: "feature.fillet",
            topologyAnchorId: "anchor_fillet_edge",
            label:
              "Create fillet feature feat_anchor_fillet on topology anchor anchor_fillet_edge of body_anchor_fillet_source"
          })
        ])
      }
    });
  });

  it("passes topology body anchors through extrude cut targets", () => {
    const adapter = new CadOpsAgentAdapter();
    const response = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_json_anchor_body_cut",
          adapterVersion: "web-cad.agent-adapter.v1",
          permissions: { allowCommit: true },
          batch: {
            version: "cadops.v1",
            mode: "commit",
            ops: [
              {
                op: "sketch.create",
                id: "anchor_body_sketch",
                name: "Anchor body profile",
                plane: "XY"
              },
              {
                op: "sketch.addRectangle",
                sketchId: "anchor_body_sketch",
                id: "anchor_body_rect",
                center: [0, 0],
                width: 4,
                height: 2
              },
              {
                op: "feature.extrude",
                id: "feat_anchor_body_source",
                bodyId: "body_anchor_body_source",
                sketchId: "anchor_body_sketch",
                entityId: "anchor_body_rect",
                depth: 3
              },
              {
                op: "topology.checkpoint.create",
                checkpointId: "checkpoint_anchor_body",
                bodyId: "body_anchor_body_source",
                sourceFeatureId: "feat_anchor_body_source",
                sourceIdentity: {
                  algorithm: "partbench-source-v1",
                  sha256:
                    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                },
                status: "active"
              },
              {
                op: "topology.anchor.create",
                anchorId: "anchor_body_target",
                entityKind: "body",
                bodyId: "body_anchor_body_source",
                checkpointId: "checkpoint_anchor_body",
                checkpointEntityId: "checkpoint-local-body",
                sourceFeatureId: "feat_anchor_body_source",
                stableId: "generated:body:body_anchor_body_source"
              },
              {
                op: "sketch.create",
                id: "anchor_body_cut_sketch",
                name: "Anchor body cut",
                plane: "XY"
              },
              {
                op: "sketch.addRectangle",
                sketchId: "anchor_body_cut_sketch",
                id: "anchor_body_cut_rect",
                center: [0, 0],
                width: 1,
                height: 1
              },
              {
                op: "feature.extrude",
                id: "feat_anchor_body_cut",
                bodyId: "body_anchor_body_cut",
                sketchId: "anchor_body_cut_sketch",
                entityId: "anchor_body_cut_rect",
                depth: 1,
                operationMode: "cut",
                targetTopologyAnchorId: "anchor_body_target"
              }
            ]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly createdFeatureIds?: readonly string[];
      readonly createdBodyIds?: readonly string[];
      readonly review?: { readonly operations?: readonly unknown[] };
    };

    expect(response).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_anchor_body_source", "feat_anchor_body_cut"],
      createdBodyIds: ["body_anchor_body_source", "body_anchor_body_cut"],
      review: {
        operations: expect.arrayContaining([
          expect.objectContaining({
            op: "feature.extrude",
            targetTopologyAnchorId: "anchor_body_target",
            label:
              "Create cut extrude feature feat_anchor_body_cut from anchor_body_cut_sketch/anchor_body_cut_rect"
          })
        ])
      }
    });
  });

  it("dry-runs topology body anchors through extrude add and hole targets", () => {
    const adapter = new CadOpsAgentAdapter();
    const response = JSON.parse(
      adapter.executeJson(
        JSON.stringify({
          requestId: "agent_req_json_anchor_body_add_hole",
          adapterVersion: "web-cad.agent-adapter.v1",
          batch: {
            version: "cadops.v1",
            mode: "dryRun",
            ops: [
              {
                op: "sketch.create",
                id: "anchor_body_add_source_sketch",
                name: "Anchor body add source",
                plane: "XY"
              },
              {
                op: "sketch.addRectangle",
                sketchId: "anchor_body_add_source_sketch",
                id: "anchor_body_add_source_rect",
                center: [0, 0],
                width: 4,
                height: 2
              },
              {
                op: "feature.extrude",
                id: "feat_anchor_body_add_source",
                bodyId: "body_anchor_body_add_source",
                sketchId: "anchor_body_add_source_sketch",
                entityId: "anchor_body_add_source_rect",
                depth: 3
              },
              {
                op: "topology.checkpoint.create",
                checkpointId: "checkpoint_anchor_body_add",
                bodyId: "body_anchor_body_add_source",
                sourceFeatureId: "feat_anchor_body_add_source",
                sourceIdentity: {
                  algorithm: "partbench-source-v1",
                  sha256:
                    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
                },
                status: "active"
              },
              {
                op: "topology.anchor.create",
                anchorId: "anchor_body_add_target",
                entityKind: "body",
                bodyId: "body_anchor_body_add_source",
                checkpointId: "checkpoint_anchor_body_add",
                checkpointEntityId: "checkpoint-local-add-body",
                sourceFeatureId: "feat_anchor_body_add_source",
                stableId: "generated:body:body_anchor_body_add_source"
              },
              {
                op: "sketch.create",
                id: "anchor_body_add_tool_sketch",
                name: "Anchor body add tool",
                plane: "XY"
              },
              {
                op: "sketch.addRectangle",
                sketchId: "anchor_body_add_tool_sketch",
                id: "anchor_body_add_tool_rect",
                center: [2, 0],
                width: 1,
                height: 1
              },
              {
                op: "feature.extrude",
                id: "feat_anchor_body_add",
                bodyId: "body_anchor_body_add",
                sketchId: "anchor_body_add_tool_sketch",
                entityId: "anchor_body_add_tool_rect",
                depth: 1,
                operationMode: "add",
                targetTopologyAnchorId: "anchor_body_add_target"
              },
              {
                op: "sketch.create",
                id: "anchor_body_hole_sketch",
                name: "Anchor body hole",
                plane: "XY"
              },
              {
                op: "sketch.addCircle",
                sketchId: "anchor_body_hole_sketch",
                id: "anchor_body_hole_circle",
                center: [0, 0],
                radius: 0.35
              },
              {
                op: "feature.hole",
                id: "feat_anchor_body_hole",
                bodyId: "body_anchor_body_hole",
                sketchId: "anchor_body_hole_sketch",
                circleEntityId: "anchor_body_hole_circle",
                depthMode: "throughAll",
                direction: "positive",
                targetTopologyAnchorId: "anchor_body_add_target"
              }
            ]
          }
        })
      )
    ) as {
      readonly ok: boolean;
      readonly createdFeatureIds?: readonly string[];
      readonly createdBodyIds?: readonly string[];
      readonly review?: { readonly operations?: readonly unknown[] };
    };
    expect(response).toMatchObject({
      ok: true,
      createdFeatureIds: [
        "feat_anchor_body_add_source",
        "feat_anchor_body_add",
        "feat_anchor_body_hole"
      ],
      createdBodyIds: [
        "body_anchor_body_add_source",
        "body_anchor_body_add",
        "body_anchor_body_hole"
      ],
      review: {
        operations: expect.arrayContaining([
          expect.objectContaining({
            op: "feature.extrude",
            targetTopologyAnchorId: "anchor_body_add_target",
            operationMode: "add"
          }),
          expect.objectContaining({
            op: "feature.hole",
            targetTopologyAnchorId: "anchor_body_add_target"
          })
        ])
      }
    });
    expect(adapter.getEngine().getDocument().features.size).toBe(0);
  });

  it("returns generated body references through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_refs",
      entityId: "rect_refs",
      featureId: "feat_refs",
      bodyId: "body_refs"
    });

    const response = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_body_refs",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "body.generatedReferences", bodyId: "body_refs" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_body_refs",
      query: "body.generatedReferences",
      body: {
        stableId: "generated:body:body_refs",
        label: "Rectangle extrude body",
        eligibleOperations: [
          "feature.measureReference",
          "feature.selectReference"
        ],
        bodyId: "body_refs",
        sourceFeatureId: "feat_refs",
        sourceSketchId: "sketch_refs",
        sourceSketchEntityId: "rect_refs",
        profileKind: "rectangle"
      },
      faceCount: 6,
      edgeCount: 12,
      vertexCount: 8,
      faces: [
        {
          role: "startCap",
          label: "Start cap",
          eligibleOperations: [
            "feature.attachSketchPlane",
            "feature.shell",
            "feature.offset",
            "feature.align",
            "feature.draft",
            "feature.mirrorPlane",
            "feature.measureReference",
            "feature.selectReference"
          ]
        },
        { role: "endCap" },
        { role: "side:uMin", label: "uMin side face" },
        { role: "side:uMax" },
        { role: "side:vMin" },
        { role: "side:vMax" }
      ],
      edges: [
        { role: "start:uMin" },
        { role: "start:uMax" },
        { role: "start:vMin" },
        { role: "start:vMax" },
        { role: "end:uMin" },
        { role: "end:uMax" },
        { role: "end:vMin" },
        { role: "end:vMax" },
        {
          role: "longitudinal:uMin:vMin",
          label: "uMin/vMin longitudinal edge",
          eligibleOperations: [
            "feature.chamfer",
            "feature.fillet",
            "feature.linearPatternDirection",
            "feature.circularPatternAxis",
            "feature.measureReference",
            "feature.selectReference"
          ],
          adjacentFaceRoles: ["side:uMin", "side:vMin"]
        },
        { role: "longitudinal:uMin:vMax" },
        { role: "longitudinal:uMax:vMin" },
        { role: "longitudinal:uMax:vMax" }
      ],
      vertices: [
        {
          role: "start:uMin:vMin",
          label: "Start uMin/vMin corner",
          eligibleOperations: [
            "feature.measureReference",
            "feature.selectReference"
          ],
          adjacentFaceRoles: ["startCap", "side:uMin", "side:vMin"],
          adjacentEdgeRoles: [
            "start:uMin",
            "start:vMin",
            "longitudinal:uMin:vMin"
          ]
        },
        { role: "start:uMin:vMax" },
        { role: "start:uMax:vMin" },
        { role: "start:uMax:vMax" },
        { role: "end:uMin:vMin" },
        { role: "end:uMin:vMax" },
        { role: "end:uMax:vMin" },
        { role: "end:uMax:vMax" }
      ]
    });
  });

  it("returns project dependency health through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_health",
      entityId: "rect_health",
      featureId: "feat_health",
      bodyId: "body_health"
    });
    adapter.execute({
      requestId: "agent_req_seed_health_constraint",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "sketch.constraint.create",
            id: "fix_health_center",
            name: "Fixed health center",
            sketchId: "sketch_health",
            kind: "fixed",
            target: { entityId: "rect_health", role: "center" },
            coordinate: [1, 2]
          }
        ]
      }
    });

    const response = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_project_health",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "project.health" }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_project_health",
      query: "project.health",
      status: "healthy",
      issueCount: 0,
      authoredExtrudeCount: 1,
      sketchEvaluationCount: 1,
      sketchDimensionCount: 0,
      sketchConstraintCount: 1,
      authoredExtrudes: [
        {
          featureId: "feat_health",
          bodyId: "body_health",
          sketchId: "sketch_health",
          entityId: "rect_health",
          status: "healthy"
        }
      ],
      sketchEvaluations: [
        expect.objectContaining({
          sketchId: "sketch_health",
          status: "healthy",
          affectedFeatureIds: ["feat_health"],
          affectedBodyIds: ["body_health"],
          issues: []
        })
      ],
      sketchDimensions: [],
      sketchConstraints: [
        {
          constraintId: "fix_health_center",
          affectedFeatureIds: ["feat_health"],
          affectedBodyIds: ["body_health"],
          status: "healthy"
        }
      ]
    });
  });

  it("passes derived exact metadata snapshots through project health adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();
    const commit = adapter.execute({
      requestId: "agent_req_seed_health_revolve",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "sketch.create",
            id: "sketch_health_revolve",
            name: "Revolve",
            plane: "XY"
          },
          {
            op: "sketch.addRectangle",
            sketchId: "sketch_health_revolve",
            id: "rect_health_revolve",
            center: [2, 0],
            width: 1,
            height: 2
          },
          {
            op: "sketch.addLine",
            sketchId: "sketch_health_revolve",
            id: "axis_health_revolve",
            start: [0, -2],
            end: [0, 2]
          },
          {
            op: "feature.revolve",
            id: "feat_health_revolve",
            bodyId: "body_health_revolve",
            sketchId: "sketch_health_revolve",
            entityId: "rect_health_revolve",
            axis: {
              type: "sketchLine",
              sketchId: "sketch_health_revolve",
              entityId: "axis_health_revolve"
            },
            angleDegrees: 180,
            operationMode: "newBody"
          }
        ]
      }
    });
    expect(commit.ok).toBe(true);

    const topology = adapter.getEngine().executeQuery({
      version: "cadops.v1",
      query: {
        query: "body.topology",
        bodyId: "body_health_revolve"
      }
    });
    if (!topology.ok || topology.query !== "body.topology") {
      throw new Error("Expected body topology for project health snapshot.");
    }

    const response = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_project_health_exact",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "project.health",
          derivedExactMetadata: [
            {
              bodyId: "body_health_revolve",
              sourceIdentitySignature:
                topology.topology.sourceIdentity.signature,
              status: "ready",
              metadata: {
                source: "kernel-derived",
                confidence: "kernel-derived",
                bounds: {
                  min: [0, 0, 0],
                  max: [4, 2, 3],
                  size: [4, 2, 3],
                  center: [2, 1, 1.5]
                },
                volume: 24,
                surfaceArea: 52,
                centroid: [2, 1, 1.5],
                topologyCounts: {
                  solidCount: 1,
                  faceCount: 6,
                  edgeCount: 12,
                  vertexCount: 8
                },
                diagnostics: []
              }
            }
          ]
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_project_health_exact",
      query: "project.health",
      authoredRevolves: [
        {
          featureId: "feat_health_revolve",
          bodyId: "body_health_revolve",
          exactMeasurementsAvailable: true,
          measurementConfidence: "kernel-derived"
        }
      ]
    });
  });

  it("resolves generated references through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_resolve_refs",
      entityId: "rect_resolve_refs",
      featureId: "feat_resolve_refs",
      bodyId: "body_resolve_refs"
    });

    const response = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_resolve_refs",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "body.resolveGeneratedReference",
          bodyId: "body_resolve_refs",
          stableId: "generated:vertex:body_resolve_refs:start:uMin:vMin"
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_resolve_refs",
      query: "body.resolveGeneratedReference",
      bodyId: "body_resolve_refs",
      stableId: "generated:vertex:body_resolve_refs:start:uMin:vMin",
      kind: "vertex",
      reference: {
        kind: "vertex",
        label: "Start uMin/vMin corner",
        eligibleOperations: [
          "feature.measureReference",
          "feature.selectReference"
        ],
        role: "start:uMin:vMin",
        adjacentFaceRoles: ["startCap", "side:uMin", "side:vMin"],
        adjacentEdgeRoles: [
          "start:uMin",
          "start:vMin",
          "longitudinal:uMin:vMin"
        ]
      }
    });
  });

  it("passes named generated references through adapter batch and queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_named_refs",
      entityId: "rect_named_refs",
      featureId: "feat_named_refs",
      bodyId: "body_named_refs"
    });

    const commit = adapter.execute({
      requestId: "agent_name_ref",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "reference.nameGenerated",
            name: "Mounting face",
            bodyId: "body_named_refs",
            stableId: "generated:face:body_named_refs:startCap"
          }
        ]
      }
    });

    expect(commit).toMatchObject({
      ok: true,
      mode: "commit"
    });

    expect(
      executeCadOpsAgentQueryRequest(adapter.getEngine(), {
        requestId: "agent_named_refs",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "reference.listNamed" }
        }
      })
    ).toMatchObject({
      ok: true,
      query: "reference.listNamed",
      referenceCount: 1,
      references: [
        {
          name: "Mounting face",
          status: "resolved",
          reference: { kind: "face", role: "startCap" }
        }
      ]
    });

    expect(
      executeCadOpsAgentQueryRequest(adapter.getEngine(), {
        requestId: "agent_resolve_named_ref",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "reference.resolveNamed", name: "Mounting face" }
        }
      })
    ).toMatchObject({
      ok: true,
      query: "reference.resolveNamed",
      name: "Mounting face",
      reference: { kind: "face", role: "startCap" }
    });
  });

  it("returns V7 selection reference candidates through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_selection_refs",
      entityId: "rect_selection_refs",
      featureId: "feat_selection_refs",
      bodyId: "body_selection_refs"
    });

    const response = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_selection_refs",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "selection.referenceCandidates",
          selection: {
            type: "generatedReference",
            bodyId: "body_selection_refs",
            stableId: "generated:face:body_selection_refs:endCap",
            expectedKind: "face"
          },
          requiredOperation: "feature.attachSketchPlane"
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_selection_refs",
      query: "selection.referenceCandidates",
      selection: {
        type: "generatedReference",
        bodyId: "body_selection_refs",
        stableId: "generated:face:body_selection_refs:endCap",
        expectedKind: "face"
      },
      requiredOperation: "feature.attachSketchPlane",
      status: "resolved",
      candidateCount: 1,
      issueCount: 0,
      candidates: [
        {
          source: "generatedReferenceSelection",
          commandable: true,
          commandOperations: expect.arrayContaining([
            "reference.nameGenerated",
            "feature.attachSketchPlane"
          ]),
          target: {
            type: "generatedReference",
            bodyId: "body_selection_refs",
            stableId: "generated:face:body_selection_refs:endCap",
            kind: "face"
          },
          reference: {
            kind: "face",
            role: "endCap",
            sourceFeatureId: "feat_selection_refs"
          },
          issues: []
        }
      ],
      issues: []
    });
  });

  it("returns V10 feature editability through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_feature_editability",
      entityId: "rect_feature_editability",
      featureId: "feat_feature_editability",
      bodyId: "body_feature_editability"
    });

    const response = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_feature_editability",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "feature.editability",
          featureId: "feat_feature_editability",
          proposedEdit: {
            kind: "extrude",
            depth: 9,
            side: "symmetric"
          }
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_feature_editability",
      query: "feature.editability",
      featureId: "feat_feature_editability",
      status: "editable",
      fieldCount: 2,
      rebuildReadiness: {
        status: "ready",
        commitDeferred: false
      },
      dryRun: {
        status: "valid",
        commitOperation: "feature.updateExtrude",
        willMutateDocument: false
      },
      affected: {
        sketchIds: ["sketch_feature_editability"],
        featureIds: ["feat_feature_editability"],
        bodyIds: ["body_feature_editability"]
      },
      requiresProjectSchemaMigration: false
    });

    if (!response.ok || response.query !== "feature.editability") {
      throw new Error("Expected feature.editability agent response.");
    }

    expect(
      response.referenceChanges.every(
        (change) =>
          change.stableId === undefined ||
          !/mesh|occt|opfs|fileHandle|selectionBuffer|viewport/i.test(
            change.stableId
          )
      )
    ).toBe(true);
  });

  it("returns V10 F1 sketch edit readiness through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_edit_readiness",
      entityId: "rect_edit_readiness",
      featureId: "feat_edit_readiness",
      bodyId: "body_edit_readiness"
    });

    const response = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_sketch_edit_readiness",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "sketch.editReadiness",
          edit: {
            editKind: "entity.dimension.update",
            sketchId: "sketch_edit_readiness",
            entityId: "rect_edit_readiness",
            target: { entityKind: "rectangle", role: "width" },
            value: 7
          }
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_sketch_edit_readiness",
      query: "sketch.editReadiness",
      status: "ready",
      dryRun: {
        status: "valid",
        commitOperation: "sketch.updateEntity",
        willMutateDocument: false
      },
      affected: {
        sketchIds: expect.arrayContaining(["sketch_edit_readiness"]),
        sketchEntityIds: expect.arrayContaining(["rect_edit_readiness"]),
        featureIds: expect.arrayContaining(["feat_edit_readiness"]),
        bodyIds: expect.arrayContaining(["body_edit_readiness"])
      },
      featureImpacts: [
        expect.objectContaining({
          featureId: "feat_edit_readiness",
          impact: "source-profile"
        })
      ],
      requiresProjectSchemaMigration: false
    });

    if (!response.ok || response.query !== "sketch.editReadiness") {
      throw new Error("Expected sketch.editReadiness agent response.");
    }

    expect(
      JSON.stringify({
        affected: response.affected,
        featureImpacts: response.featureImpacts,
        bodyLifecycles: response.bodyLifecycles,
        referenceEffects: response.referenceEffects,
        referenceHealth: response.referenceHealth,
        diagnostics: response.diagnostics
      })
    ).not.toMatch(/mesh|occt|opfs|fileHandle|selectionBuffer|viewport/i);
  });

  it("returns V10 dependency graph and reference health through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_dependency_graph",
      entityId: "rect_dependency_graph",
      featureId: "feat_dependency_graph",
      bodyId: "body_dependency_graph"
    });
    adapter.execute({
      requestId: "agent_req_name_dependency_graph_ref",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "reference.nameGenerated",
            name: "Graph face",
            bodyId: "body_dependency_graph",
            stableId: "generated:face:body_dependency_graph:endCap"
          }
        ]
      }
    });

    const graph = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_dependency_graph",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "project.dependencyGraph" }
      }
    });
    const health = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_reference_health",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "reference.health",
          target: { type: "namedReference", name: "Graph face" }
        }
      }
    });
    const rebuildPlan = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_rebuild_plan",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "project.rebuildPlan" }
      }
    });

    expect(graph).toMatchObject({
      ok: true,
      requestId: "agent_dependency_graph",
      query: "project.dependencyGraph",
      nodes: expect.arrayContaining([
        expect.objectContaining({
          id: "feature:feat_dependency_graph",
          kind: "feature"
        }),
        expect.objectContaining({
          id: "named-reference:Graph face",
          kind: "namedReference",
          status: "active"
        })
      ]),
      requiresProjectSchemaMigration: false
    });
    expect(health).toMatchObject({
      ok: true,
      requestId: "agent_reference_health",
      query: "reference.health",
      target: { type: "namedReference", name: "Graph face" },
      status: "active",
      referenceHealth: [
        expect.objectContaining({
          source: "namedReference",
          commandable: true,
          referenceName: "Graph face",
          stableId: "generated:face:body_dependency_graph:endCap"
        })
      ]
    });
    expect(rebuildPlan).toMatchObject({
      ok: true,
      requestId: "agent_rebuild_plan",
      query: "project.rebuildPlan",
      status: "ready",
      bodyLifecycles: [
        expect.objectContaining({
          bodyId: "body_dependency_graph",
          primaryState: "active",
          states: ["active", "source"],
          referenceHealthStatus: "active",
          commandReady: true
        })
      ],
      requiresProjectSchemaMigration: false
    });

    if (!graph.ok || graph.query !== "project.dependencyGraph") {
      throw new Error("Expected project.dependencyGraph agent response.");
    }

    if (!rebuildPlan.ok || rebuildPlan.query !== "project.rebuildPlan") {
      throw new Error("Expected project.rebuildPlan agent response.");
    }

    expect(
      /mesh|occt|opfs|fileHandle|selectionBuffer|viewport/i.test(
        JSON.stringify({
          nodes: graph.nodes,
          edges: graph.edges,
          referenceHealth: graph.referenceHealth,
          bodyLifecycles: rebuildPlan.bodyLifecycles,
          lifecycleEffects: rebuildPlan.lifecycleEffects
        })
      )
    ).toBe(false);
  });

  it("returns generated reference measurements through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_measure_refs",
      entityId: "rect_measure_refs",
      featureId: "feat_measure_refs",
      bodyId: "body_measure_refs"
    });

    const response = executeCadOpsAgentQueryRequest(adapter.getEngine(), {
      requestId: "agent_measure_refs",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "body.generatedReferenceMeasurements",
          bodyId: "body_measure_refs",
          stableId: "generated:face:body_measure_refs:endCap"
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "agent_measure_refs",
      query: "body.generatedReferenceMeasurements",
      bodyId: "body_measure_refs",
      stableId: "generated:face:body_measure_refs:endCap",
      kind: "face",
      reference: {
        kind: "face",
        role: "endCap",
        label: "End cap"
      },
      measurements: {
        kind: "face",
        role: "endCap",
        area: 6,
        center: [0, 0, 4],
        bounds: {
          min: [-1, -1.5, 4],
          max: [1, 1.5, 4]
        }
      }
    });
  });

  it("passes through generated reference measurement errors through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    seedExtrudeFeature(adapter, {
      sketchId: "sketch_measure_error_refs",
      entityId: "rect_measure_error_refs",
      featureId: "feat_measure_error_refs",
      bodyId: "body_measure_error_refs"
    });

    const response = adapter.query({
      requestId: "agent_measure_missing_ref",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: {
          query: "body.generatedReferenceMeasurements",
          bodyId: "body_measure_error_refs",
          stableId: "generated:face:body_measure_error_refs:missing"
        }
      }
    });

    expect(response).toMatchObject({
      ok: false,
      requestId: "agent_measure_missing_ref",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "body.generatedReferenceMeasurements",
      error: {
        code: "GENERATED_REFERENCE_NOT_FOUND",
        bodyId: "body_measure_error_refs",
        stableId: "generated:face:body_measure_error_refs:missing"
      }
    });
  });

  it("returns transaction history through adapter queries", () => {
    const adapter = new CadOpsAgentAdapter();

    adapter.execute({
      requestId: "agent_req_history_create",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      actor: {
        type: "agent",
        id: "history-agent",
        name: "History Agent"
      },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "scene.createBox",
            id: "history_box",
            dimensions: { width: 1, height: 2, depth: 3 }
          }
        ]
      }
    });
    adapter.getEngine().undo();

    const request = parseCadOpsAgentQueryRequestJson(
      JSON.stringify({
        requestId: "agent_history_json",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "transaction.history" }
        }
      })
    );
    const response = JSON.parse(adapter.queryJson(JSON.stringify(request))) as {
      readonly ok: boolean;
      readonly query: string;
      readonly transactionCount: number;
      readonly transactions: readonly {
        readonly id: string;
        readonly status: string;
        readonly actor?: { readonly id?: string };
        readonly ops: readonly {
          readonly op: string;
          readonly objectId?: string;
        }[];
      }[];
    };

    expect(response).toMatchObject({
      ok: true,
      query: "transaction.history",
      transactionCount: 1,
      transactions: [
        {
          id: "txn_1",
          status: "undone",
          actor: {
            id: "history-agent"
          },
          audit: {
            source: "agent-adapter",
            requestId: "agent_req_history_create",
            intent: "commit",
            operationCount: 1
          },
          ops: [
            {
              op: "scene.createBox",
              objectId: "history_box"
            }
          ],
          diff: {
            createdCount: 1,
            modifiedCount: 0,
            deletedCount: 0
          }
        }
      ]
    });
  });

  it("returns structured adapter query errors", () => {
    const adapter = new CadOpsAgentAdapter();

    const response = adapter.query({
      requestId: "agent_query_3",
      adapterVersion: "web-cad.agent-adapter.v1",
      query: {
        version: "cadops.v1",
        query: { query: "object.get", id: "missing_object" }
      }
    });

    expect(response).toEqual({
      ok: false,
      requestId: "agent_query_3",
      adapterVersion: "web-cad.agent-adapter.v1",
      cadOpsVersion: "cadops.v1",
      query: "object.get",
      error: {
        code: "OBJECT_NOT_FOUND",
        message: "Object does not exist: missing_object",
        objectId: "missing_object"
      }
    });
  });

  it("rejects non-CADOps adapter payloads", () => {
    expect(() =>
      parseCadOpsAgentRequestJson(
        JSON.stringify({
          requestId: "bad_request",
          adapterVersion: "web-cad.agent-adapter.v1",
          prompt: "make me a box"
        })
      )
    ).toThrow("Invalid CADOps agent adapter request.");
  });

  it("rejects non-CADOps adapter query payloads", () => {
    expect(() =>
      parseCadOpsAgentQueryRequestJson(
        JSON.stringify({
          requestId: "bad_query_request",
          adapterVersion: "web-cad.agent-adapter.v1",
          prompt: "what objects are in this model?"
        })
      )
    ).toThrow("Invalid CADOps agent adapter query request.");
  });

  it("rejects topology identity readiness query payloads with extra fields", () => {
    expect(() =>
      parseCadOpsAgentQueryRequestJson(
        JSON.stringify({
          requestId: "bad_topology_identity_query",
          adapterVersion: "web-cad.agent-adapter.v1",
          query: {
            version: "cadops.v1",
            query: {
              query: "project.topologyIdentityReadiness",
              fileHandle: "not-source"
            }
          }
        })
      )
    ).toThrow("Invalid CADOps agent adapter query request.");
  });

  it("rejects import readiness query payloads with extra fields", () => {
    expect(() =>
      parseCadOpsAgentQueryRequestJson(
        JSON.stringify({
          requestId: "bad_import_readiness_query",
          adapterVersion: "web-cad.agent-adapter.v1",
          query: {
            version: "cadops.v1",
            query: {
              query: "project.importReadiness",
              fileHandle: "not-source"
            }
          }
        })
      )
    ).toThrow("Invalid CADOps agent adapter query request.");
  });

  it("rejects imported body status queries without a body ID", () => {
    expect(() =>
      parseCadOpsAgentQueryRequestJson(
        JSON.stringify({
          requestId: "bad_imported_body_status_query",
          adapterVersion: "web-cad.agent-adapter.v1",
          query: {
            version: "cadops.v1",
            query: {
              query: "body.importedBodyStatus"
            }
          }
        })
      )
    ).toThrow("Invalid CADOps agent adapter query request.");
  });
});

describe("V21.1 agent exact export contracts", () => {
  const sourceIdentity = {
    algorithm: "partbench-source-v1" as const,
    sha256: "a".repeat(64)
  };

  it("accepts bounded selections and rejects duplicates, excess, and authority", () => {
    const sparseBodyIds = new Array(1);
    const inheritedIdentity = Object.assign(
      Object.create({ path: "/tmp/model.step" }) as object,
      sourceIdentity
    );
    const inheritedRequest = Object.assign(
      Object.create({ path: "/tmp/model.step" }) as object,
      { requestId: "agent_export_inherited", selection: { mode: "all" } }
    );
    expect(
      parseCadAgentExactExportRequest({
        requestId: "agent_export_1",
        selection: { mode: "bodyIds", bodyIds: ["body_a", "body_b"] },
        expectedSourceIdentity: sourceIdentity
      }).selection
    ).toEqual({ mode: "bodyIds", bodyIds: ["body_a", "body_b"] });

    for (const value of [
      {
        requestId: "agent_export_duplicate",
        selection: { mode: "bodyIds", bodyIds: ["body_a", "body_a"] }
      },
      {
        requestId: "agent_export_excess",
        selection: {
          mode: "bodyIds",
          bodyIds: Array.from({ length: 257 }, (_, index) => `body_${index}`)
        }
      },
      {
        requestId: "agent_export_empty",
        selection: { mode: "bodyIds", bodyIds: [] }
      },
      {
        requestId: "agent_export_sparse",
        selection: { mode: "bodyIds", bodyIds: sparseBodyIds }
      },
      {
        requestId: "agent_export_long_body_id",
        selection: { mode: "bodyIds", bodyIds: ["x".repeat(1_025)] }
      },
      {
        requestId: "agent_export_bad_identity",
        selection: { mode: "all" },
        expectedSourceIdentity: { ...sourceIdentity, sha256: "A".repeat(64) }
      },
      {
        requestId: "agent_export_inherited_identity",
        selection: { mode: "all" },
        expectedSourceIdentity: inheritedIdentity
      },
      {
        requestId: "agent_export_path",
        selection: { mode: "all" },
        path: "/tmp/model.step"
      },
      inheritedRequest,
      { requestId: "x".repeat(129), selection: { mode: "all" } }
    ]) {
      expect(() => parseCadAgentExactExportRequest(value)).toThrow(
        "Invalid CAD agent exact export request."
      );
    }
  });

  it("validates byte-free proposal and truthful download-requested result", () => {
    const plan = {
      format: "step" as const,
      schema: "AP242DIS" as const,
      units: "mm" as const,
      sourceIdentity,
      orderedBodyIds: ["body_a"],
      allOrNothing: true as const,
      planIdentity: "b".repeat(64),
      bodies: [
        {
          bodyId: "body_a",
          bodyName: "Body A",
          partId: "part_a",
          featureId: "feature_a",
          sourceType: "primitiveFeature" as const,
          sourceIdentitySignature: "source_a",
          status: "ready" as const,
          diagnostics: []
        }
      ]
    };

    expect(
      parseCadAgentExactExportProposal({
        requestId: "agent_export_1",
        sourceIdentity,
        plan,
        warnings: []
      }).plan
    ).toEqual(plan);

    for (const proposal of [
      {
        requestId: "agent_export_1",
        sourceIdentity: { ...sourceIdentity, sha256: "d".repeat(64) },
        plan,
        warnings: []
      },
      {
        requestId: "agent_export_1",
        sourceIdentity,
        plan: { ...plan, orderedBodyIds: [], bodies: [] },
        warnings: []
      },
      {
        requestId: "agent_export_1",
        sourceIdentity,
        plan: {
          ...plan,
          bodies: [{ ...plan.bodies[0], status: "blocked" as const }]
        },
        warnings: []
      },
      {
        requestId: "agent_export_1",
        sourceIdentity,
        plan: {
          ...plan,
          bodies: [
            {
              ...plan.bodies[0],
              diagnostics: [
                {
                  code: "EXPORT_EXACT_SOURCE_STALE" as const,
                  status: "deferred" as const,
                  message: "The exact source is stale."
                }
              ]
            }
          ]
        },
        warnings: []
      },
      {
        requestId: "agent_export_1",
        sourceIdentity,
        plan,
        warnings: new Array(1)
      },
      {
        requestId: "agent_export_1",
        sourceIdentity,
        plan,
        warnings: ["x".repeat(4_097)]
      }
    ]) {
      expect(() => parseCadAgentExactExportProposal(proposal)).toThrow(
        "Invalid CAD agent exact export proposal."
      );
    }

    const result = {
      requestId: "agent_export_1",
      status: "downloadRequested",
      selectedBodyIds: ["body_a"],
      selectedBodyCount: 1,
      schema: "AP242DIS",
      units: "mm",
      planIdentity: "b".repeat(64),
      artifactByteLength: 123,
      artifactSha256: "c".repeat(64),
      diagnostics: []
    };
    expect(parseCadAgentExactExportResult(result)).toEqual(result);

    const sparseSelectedBodyIds = new Array(1);
    const sparseDiagnostics = new Array(1);

    for (const value of [
      { ...result, status: "downloaded" },
      { ...result, selectedBodyCount: 2 },
      { ...result, artifactByteLength: undefined },
      { ...result, artifactSha256: undefined },
      {
        ...result,
        selectedBodyIds: sparseSelectedBodyIds,
        selectedBodyCount: 1
      },
      { ...result, selectedBodyIds: ["x".repeat(1_025)] },
      { ...result, diagnostics: sparseDiagnostics },
      { ...result, stepBytes: [1, 2, 3] },
      {
        ...result,
        diagnostics: [{ code: "UNKNOWN", message: "Unknown diagnostic." }]
      },
      {
        ...result,
        diagnostics: [
          {
            code: "EXPORT_CANCELLED",
            message: "x".repeat(4_097)
          }
        ]
      }
    ]) {
      expect(() => parseCadAgentExactExportResult(value)).toThrow(
        "Invalid CAD agent exact export result."
      );
    }

    for (const field of [
      "filename",
      "mimeType",
      "blob",
      "objectUrl",
      "fileHandle",
      "opfsPath",
      "directory"
    ]) {
      expect(() =>
        parseCadAgentExactExportRequest({
          requestId: "agent_export_private",
          selection: { mode: "all" },
          [field]: "private"
        })
      ).toThrow("Invalid CAD agent exact export request.");
      expect(() =>
        parseCadAgentExactExportProposal({
          requestId: "agent_export_private",
          sourceIdentity,
          plan,
          warnings: [],
          [field]: "private"
        })
      ).toThrow("Invalid CAD agent exact export proposal.");
      expect(() =>
        parseCadAgentExactExportResult({ ...result, [field]: "private" })
      ).toThrow("Invalid CAD agent exact export result.");
    }
    expect(() =>
      parseCadAgentExactExportProposal({
        requestId: "agent_export_private_nested",
        sourceIdentity,
        plan: {
          ...plan,
          bodies: [{ ...plan.bodies[0], fileHandle: "private" }]
        },
        warnings: []
      })
    ).toThrow("Invalid CAD agent exact export proposal.");
  });
});

function seedExtrudeFeature(
  adapter: CadOpsAgentAdapter,
  ids: {
    readonly sketchId: string;
    readonly entityId: string;
    readonly featureId: string;
    readonly bodyId: string;
  }
): void {
  const response = adapter.execute({
    requestId: `agent_req_seed_${ids.featureId}`,
    adapterVersion: "web-cad.agent-adapter.v1",
    permissions: { allowCommit: true },
    batch: {
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "sketch.create",
          id: ids.sketchId,
          name: "Profile",
          plane: "XY"
        },
        {
          op: "sketch.addRectangle",
          sketchId: ids.sketchId,
          id: ids.entityId,
          center: [0, 0],
          width: 2,
          height: 3
        },
        {
          op: "feature.extrude",
          id: ids.featureId,
          bodyId: ids.bodyId,
          sketchId: ids.sketchId,
          entityId: ids.entityId,
          depth: 4
        }
      ]
    }
  });

  expect(response).toMatchObject({
    ok: true,
    createdFeatureIds: [ids.featureId],
    createdBodyIds: [ids.bodyId]
  });
}

describe("agent-adapter V3 parameter and dimension pass-through", () => {
  it("passes parameter and sketch dimension commands and queries through", () => {
    const adapter = new CadOpsAgentAdapter();

    const commit = adapter.execute({
      requestId: "agent_req_v3_commit",
      adapterVersion: "web-cad.agent-adapter.v1",
      permissions: { allowCommit: true },
      batch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
          {
            op: "sketch.addRectangle",
            sketchId: "sketch_1",
            id: "rect_1",
            center: [0, 0],
            width: 2,
            height: 1
          },
          {
            op: "sketch.addLine",
            sketchId: "sketch_1",
            id: "line_1",
            start: [0, 0],
            end: [0, 2]
          },
          {
            op: "sketch.addLine",
            sketchId: "sketch_1",
            id: "line_2",
            start: [10, 0],
            end: [10, 2]
          },
          {
            op: "sketch.addLine",
            sketchId: "sketch_1",
            id: "line_3",
            start: [20, 0],
            end: [20, 2]
          },
          {
            op: "sketch.addPoint",
            sketchId: "sketch_1",
            id: "point_1",
            point: [10, 10]
          },
          {
            op: "sketch.addPoint",
            sketchId: "sketch_1",
            id: "point_mid",
            point: [0, 0]
          },
          { op: "parameter.create", id: "param_w", name: "Width", value: 5 },
          {
            op: "parameter.create",
            id: "param_length",
            name: "Length",
            value: 6
          },
          {
            op: "sketch.dimension.create",
            id: "dim_w",
            name: "Width dimension",
            sketchId: "sketch_1",
            entityId: "rect_1",
            target: { entityKind: "rectangle", role: "width" },
            parameterId: "param_w"
          },
          {
            op: "sketch.dimension.create",
            id: "dim_line_length",
            name: "Line length",
            sketchId: "sketch_1",
            entityId: "line_1",
            target: { entityKind: "line", role: "length" },
            parameterId: "param_length"
          },
          {
            op: "sketch.constraint.create",
            id: "con_horizontal",
            name: "Horizontal line",
            sketchId: "sketch_1",
            entityId: "line_1",
            kind: "horizontal"
          },
          {
            op: "sketch.constraint.create",
            id: "con_fixed_start",
            name: "Fixed line start",
            sketchId: "sketch_1",
            kind: "fixed",
            target: { entityId: "line_1", role: "start" }
          },
          {
            op: "sketch.constraint.create",
            id: "con_coincident_end",
            name: "Line end point",
            sketchId: "sketch_1",
            kind: "coincident",
            primaryTarget: { entityId: "line_1", role: "end" },
            secondaryTarget: { entityId: "point_1", role: "position" }
          },
          {
            op: "sketch.constraint.create",
            id: "con_midpoint",
            name: "Line midpoint",
            sketchId: "sketch_1",
            kind: "midpoint",
            lineEntityId: "line_1",
            target: { entityId: "point_mid", role: "position" }
          },
          {
            op: "sketch.constraint.create",
            id: "con_parallel",
            name: "Parallel lines",
            sketchId: "sketch_1",
            kind: "parallel",
            primaryLineEntityId: "line_1",
            secondaryLineEntityId: "line_2"
          },
          {
            op: "sketch.constraint.create",
            id: "con_perpendicular",
            name: "Perpendicular lines",
            sketchId: "sketch_1",
            kind: "perpendicular",
            primaryLineEntityId: "line_1",
            secondaryLineEntityId: "line_3"
          }
        ]
      }
    });

    expect(commit).toMatchObject({
      ok: true,
      createdParameterIds: ["param_w", "param_length"],
      createdSketchDimensionIds: ["dim_w", "dim_line_length"],
      createdSketchConstraintIds: [
        "con_horizontal",
        "con_fixed_start",
        "con_coincident_end",
        "con_midpoint",
        "con_parallel",
        "con_perpendicular"
      ],
      modifiedSketchEntityIds: [
        "rect_1",
        "line_1",
        "point_1",
        "point_mid",
        "line_2",
        "line_3"
      ]
    });

    expect(
      adapter.query({
        requestId: "agent_req_parameter_list",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "parameter.list" }
        }
      })
    ).toMatchObject({
      ok: true,
      query: "parameter.list",
      parameterCount: 2,
      parameters: [
        { id: "param_w", name: "Width", value: 5 },
        { id: "param_length", name: "Length", value: 6 }
      ]
    });

    expect(
      adapter.query({
        requestId: "agent_req_dimensions",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "sketch.dimensions", sketchId: "sketch_1" }
        }
      })
    ).toMatchObject({
      ok: true,
      query: "sketch.dimensions",
      sketchId: "sketch_1",
      dimensionCount: 2,
      dimensions: [
        expect.objectContaining({
          id: "dim_w",
          status: "healthy",
          effectiveValue: 5
        }),
        expect.objectContaining({
          id: "dim_line_length",
          target: { entityKind: "line", role: "length" },
          status: "healthy",
          effectiveValue: 6
        })
      ]
    });

    expect(
      adapter.query({
        requestId: "agent_req_sketch_evaluation",
        adapterVersion: "web-cad.agent-adapter.v1",
        query: {
          version: "cadops.v1",
          query: { query: "sketch.evaluation", sketchId: "sketch_1" }
        }
      })
    ).toMatchObject({
      ok: true,
      query: "sketch.evaluation",
      sketchId: "sketch_1",
      sketchName: "Profile",
      plane: "XY",
      status: "under-defined",
      drivenEntityIds: [
        "rect_1",
        "line_1",
        "point_1",
        "point_mid",
        "line_2",
        "line_3"
      ],
      dimensionCount: 2,
      constraintCount: 6,
      issueCount: 1,
      issues: [expect.objectContaining({ code: "UNDER_DEFINED_SKETCH" })],
      constraints: [
        expect.objectContaining({
          id: "con_horizontal",
          kind: "horizontal",
          status: "healthy"
        }),
        expect.objectContaining({
          id: "con_fixed_start",
          kind: "fixed",
          target: { entityId: "line_1", role: "start" },
          status: "healthy"
        }),
        expect.objectContaining({
          id: "con_coincident_end",
          kind: "coincident",
          primaryTarget: { entityId: "line_1", role: "end" },
          secondaryTarget: { entityId: "point_1", role: "position" },
          status: "healthy"
        }),
        expect.objectContaining({
          id: "con_midpoint",
          kind: "midpoint",
          lineEntityId: "line_1",
          target: { entityId: "point_mid", role: "position" },
          status: "healthy"
        }),
        expect.objectContaining({
          id: "con_parallel",
          kind: "parallel",
          primaryLineEntityId: "line_1",
          secondaryLineEntityId: "line_2",
          status: "healthy"
        }),
        expect.objectContaining({
          id: "con_perpendicular",
          kind: "perpendicular",
          primaryLineEntityId: "line_1",
          secondaryLineEntityId: "line_3",
          status: "healthy"
        })
      ],
      dimensions: [
        expect.objectContaining({
          id: "dim_w",
          effectiveValue: 5
        }),
        expect.objectContaining({
          id: "dim_line_length",
          effectiveValue: 6
        })
      ]
    });
  });
});

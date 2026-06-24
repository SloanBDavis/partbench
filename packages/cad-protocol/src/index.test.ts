import { describe, expect, it } from "vitest";
import type {
  CadAxisAlignedBounds,
  CadBatch,
  CadBatchValidationError,
  CadBodyExactTopologySnapshot,
  CadBodySnapshot,
  CadExtrudeFeatureSummary,
  CadGeneratedEdgeReference,
  CadGeneratedFaceReference,
  CadGeneratedVertexReference,
  CadHoleFeatureSummary,
  CadObjectModelSource,
  CadPartSnapshot,
  CadExportDiagnostic,
  CadExportFormatReadiness,
  CadPrimitiveFeatureSummary,
  CadOp,
  CadRevolveFeatureSummary,
  CadQueryRequest,
  CadQueryResponse,
  SemanticDiff,
  CadViewportCommandTargetSummary,
  CadViewportHitCandidate,
  CadViewportHoverState,
  CadViewportMeasurementTarget,
  CadViewportPointerInputIntent,
  CadViewportSelectionIntent,
  CadViewportSelectionState,
  CadViewportSingleTargetMeasureInspectTarget,
  CadViewportTwoTargetMeasurementResult,
  CadViewportTwoTargetMeasurementState,
  CadViewportTwoTargetMeasurementTarget,
  CadTopologyAnchorDescriptor,
  CadTopologyCheckpointMetadata,
  CadTopologyIdentityState,
  CadTopologyIdentitySourceSnapshot,
  CadTopologyMatchResult,
  CadTopologyRepairCandidate,
  FeatureEditabilityQueryResponse,
  HoleFeatureSnapshot,
  ProjectPackageReadinessQueryResponse,
  ProjectRebuildPlanQueryResponse,
  ProjectTopologyIdentityReadinessQueryResponse,
  ReferenceHealthQueryResponse,
  RevolveFeatureSnapshot,
  ProjectHealthQueryResponse,
  ProjectSummaryQueryResponse,
  SketchEditReadinessQueryResponse,
  SketchEvaluationQueryResponse,
  SketchSolverStatusQueryResponse,
  TopologyAnchorRepairCandidatesQueryResponse,
  TopologyAnchorRepairPlanQueryResponse,
  TopologyMatchSnapshotsQueryResponse,
  WcadManifestV1,
  WcadManifestV2,
  WcadTopologyCheckpointSignaturePayload,
  WcadPackageValidationIssue,
  NamedGeneratedReferenceEntry,
  SketchSnapshot
} from "./index";
import {
  WCAD_COMMANDS_ENTRY_PATH,
  WCAD_DOCUMENT_ENTRY_PATH,
  WCAD_MANIFEST_ENTRY_PATH,
  WCAD_PACKAGE_EXTENSION,
  WCAD_PACKAGE_VERSION,
  WCAD_SOURCE_IDENTITY_ALGORITHM,
  CAD_TOPOLOGY_IDENTITY_CONTRACT_VERSION,
  CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION,
  CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION,
  protocolPackage
} from "./index";

describe("cad-protocol", () => {
  it("exports package status", () => {
    expect(protocolPackage).toEqual({
      name: "@web-cad/cad-protocol",
      status: "ready"
    });
  });

  it("types the project export readiness query contract", () => {
    const request: CadQueryRequest = {
      version: "cadops.v1",
      query: { query: "project.exportReadiness" }
    };
    const glbDiagnostic: CadExportDiagnostic = {
      code: "EXPORT_WRITER_NOT_IMPLEMENTED",
      status: "deferred",
      format: "glb",
      message: "Mesh/GLB visualization file export is not implemented yet."
    };
    const sourceDiagnostic: CadExportDiagnostic = {
      code: "EXPORT_BODY_SOURCE_SUPPORTED",
      status: "supported",
      format: "step",
      message:
        "Authored rectangle newBody extrude body has supported source semantics."
    };
    const format: CadExportFormatReadiness = {
      format: "step",
      label: "STEP",
      exportKind: "exact",
      status: "supported",
      available: true,
      writerStatus: "available",
      fileExtensions: [".step", ".stp"],
      units: "mm",
      sourceBoundaryNote: "Authoritative document state.",
      derivedBoundaryNote: "No derived display state.",
      candidateBodyCount: 1,
      sourceSupportedBodyCount: 1,
      deferredBodyCount: 0,
      unavailableBodyCount: 0,
      diagnostics: []
    };
    const response: CadQueryResponse = {
      ok: true,
      query: "project.exportReadiness",
      cadOpsVersion: "cadops.v1",
      status: "supported",
      canExportFiles: true,
      units: "mm",
      sourceBoundaryNote: "Authoritative document state.",
      derivedBoundaryNote: "No derived display state.",
      formatCount: 1,
      formats: [format],
      bodyCount: 1,
      sourceSupportedBodyCount: 1,
      deferredBodyCount: 0,
      unavailableBodyCount: 0,
      bodies: [
        {
          bodyId: "body_1",
          bodyKind: "solid",
          featureId: "feat_1",
          partId: "part_default",
          sourceKind: "authoredExtrude",
          sourceStatus: "supported",
          status: "supported",
          sourceBoundaryNote: "Authoritative document state.",
          derivedBoundaryNote: "No derived display state.",
          formats: [
            {
              format: "step",
              label: "STEP",
              exportKind: "exact",
              status: "supported",
              writerStatus: "available",
              diagnostics: []
            }
          ],
          diagnostics: [sourceDiagnostic]
        }
      ],
      diagnosticCount: 1,
      diagnostics: [sourceDiagnostic]
    };

    expect(request.query.query).toBe("project.exportReadiness");
    expect(response).toMatchObject({
      ok: true,
      query: "project.exportReadiness",
      status: "supported",
      canExportFiles: true,
      formats: [{ format: "step", available: true }],
      bodies: [{ sourceStatus: "supported", status: "supported" }]
    });
    expect(glbDiagnostic.code).toBe("EXPORT_WRITER_NOT_IMPLEMENTED");
  });

  it("types the exact STEP export query contract", () => {
    const request: CadQueryRequest = {
      version: "cadops.v1",
      query: {
        query: "project.exportExact",
        format: "step",
        bodyIds: ["body_1"],
        sourceIdentity: {
          algorithm: WCAD_SOURCE_IDENTITY_ALGORITHM,
          sha256:
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        }
      }
    };
    const response: CadQueryResponse = {
      ok: true,
      query: "project.exportExact",
      cadOpsVersion: "cadops.v1",
      format: "step",
      label: "STEP",
      exportKind: "exact",
      status: "supported",
      available: true,
      canExportFile: true,
      writerStatus: "available",
      units: "mm",
      fileExtensions: [".step", ".stp"],
      documentSchemaVersion: "web-cad.project.v16",
      sourceIdentityAlgorithm: WCAD_SOURCE_IDENTITY_ALGORITHM,
      requestedSourceIdentity: {
        algorithm: WCAD_SOURCE_IDENTITY_ALGORITHM,
        sha256:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
      },
      sourceIdentityStatus: "matchedCurrent",
      requestedBodyIds: ["body_1"],
      bodyCount: 1,
      sourceSupportedBodyCount: 1,
      deferredBodyCount: 0,
      unavailableBodyCount: 0,
      exportableBodyCount: 1,
      exportSources: [
        {
          bodyId: "body_1",
          sourceKind: "authoredExtrude",
          featureId: "feat_1",
          sourceSketchId: "sketch_1",
          sourceSketchEntityId: "rect_1",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 1
          },
          depth: 3,
          side: "positive"
        }
      ],
      bodies: [
        {
          bodyId: "body_1",
          bodyKind: "solid",
          featureId: "feat_1",
          partId: "part_default",
          sourceKind: "authoredExtrude",
          sourceStatus: "supported",
          status: "supported",
          sourceBoundaryNote: "Authoritative document state.",
          derivedBoundaryNote: "No derived display state.",
          formats: [
            {
              format: "step",
              label: "STEP",
              exportKind: "exact",
              status: "supported",
              writerStatus: "available",
              diagnostics: []
            }
          ],
          diagnostics: []
        }
      ],
      diagnosticCount: 0,
      diagnostics: []
    };

    expect(request.query.query).toBe("project.exportExact");
    expect(response).toMatchObject({
      ok: true,
      query: "project.exportExact",
      format: "step",
      writerStatus: "available",
      canExportFile: true
    });
    expect("artifact" in response).toBe(false);
  });

  it("types the V8 package readiness and manifest contracts", () => {
    const request: CadQueryRequest = {
      version: "cadops.v1",
      query: { query: "project.packageReadiness" }
    };
    const response: ProjectPackageReadinessQueryResponse = {
      ok: true,
      query: "project.packageReadiness",
      cadOpsVersion: "cadops.v1",
      status: "supported",
      packageVersion: WCAD_PACKAGE_VERSION,
      fileExtension: WCAD_PACKAGE_EXTENSION,
      sourceIdentityAlgorithm: WCAD_SOURCE_IDENTITY_ALGORITHM,
      documentSchemaVersion: "web-cad.project.v16",
      canRepresentCurrentSource: true,
      requiresProjectSchemaMigration: false,
      sourceBoundaryNote: "Authoritative source entries only.",
      derivedBoundaryNote: "Cache and browser state are excluded.",
      requiredEntryCount: 3,
      requiredEntries: [
        { role: "manifest", path: WCAD_MANIFEST_ENTRY_PATH, source: true },
        { role: "document", path: WCAD_DOCUMENT_ENTRY_PATH, source: true },
        { role: "commands", path: WCAD_COMMANDS_ENTRY_PATH, source: true }
      ],
      optionalCacheEntryCount: 1,
      optionalCacheEntries: [
        {
          role: "metadata",
          path: "metadata/cache-index.json",
          source: false
        }
      ],
      capabilityCount: 2,
      capabilities: [
        {
          capability: "packageContract",
          label: "Package contract",
          status: "supported",
          available: true,
          sourceBoundaryNote: "Authoritative source entries only.",
          derivedBoundaryNote: "Cache and browser state are excluded.",
          diagnostics: [
            {
              code: "WCAD_PACKAGE_CONTRACT_READY",
              status: "supported",
              message: "Package contract is typed."
            }
          ]
        },
        {
          capability: "packageReadWrite",
          label: "Package writer",
          status: "supported",
          available: true,
          sourceBoundaryNote: "Authoritative source entries only.",
          derivedBoundaryNote: "Cache and browser state are excluded.",
          diagnostics: [
            {
              code: "WCAD_PACKAGE_READ_WRITE_READY",
              status: "supported",
              message: "ZIP read/write helpers are available."
            }
          ]
        }
      ],
      diagnosticCount: 2,
      diagnostics: [
        {
          code: "WCAD_PACKAGE_CONTRACT_READY",
          status: "supported",
          message: "Package contract is typed."
        },
        {
          code: "WCAD_PACKAGE_READ_WRITE_READY",
          status: "supported",
          message: "ZIP read/write helpers are available."
        }
      ]
    };
    const manifest: WcadManifestV1 = {
      packageVersion: WCAD_PACKAGE_VERSION,
      product: "Partbench",
      createdBy: { app: "partbench" },
      createdAt: "2026-06-11T00:00:00.000Z",
      modifiedAt: "2026-06-11T00:00:00.000Z",
      units: "mm",
      document: {
        path: WCAD_DOCUMENT_ENTRY_PATH,
        schemaVersion: "web-cad.project.v16",
        byteLength: 12,
        sha256:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
      },
      commands: {
        path: WCAD_COMMANDS_ENTRY_PATH,
        byteLength: 8,
        sha256:
          "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
      },
      sourceIdentity: {
        algorithm: WCAD_SOURCE_IDENTITY_ALGORITHM,
        sha256:
          "1111111111111111111111111111111111111111111111111111111111111111"
      },
      cache: {
        entriesPath: "metadata/cache-index.json",
        policy: "optional-rebuildable"
      }
    };
    const issue: WcadPackageValidationIssue = {
      code: "WCAD_STALE_CACHE_ENTRY",
      severity: "warning",
      message: "Cache entry is stale.",
      entryPath: "meshes/body.bin",
      entryRole: "cache",
      expected: "current-source",
      received: "old-source"
    };

    expect(request.query.query).toBe("project.packageReadiness");
    expect(response.requiredEntries.map((entry) => entry.path)).toEqual([
      WCAD_MANIFEST_ENTRY_PATH,
      WCAD_DOCUMENT_ENTRY_PATH,
      WCAD_COMMANDS_ENTRY_PATH
    ]);
    expect(
      response.capabilities.map((capability) => capability.status)
    ).toEqual(["supported", "supported"]);
    expect(manifest.packageVersion).toBe(WCAD_PACKAGE_VERSION);
    expect(manifest.cache?.policy).toBe("optional-rebuildable");
    expect(issue.code).toBe("WCAD_STALE_CACHE_ENTRY");
  });

  it("types the V13 topology identity readiness and vocabulary contracts", () => {
    const request: CadQueryRequest = {
      version: "cadops.v1",
      query: { query: "project.topologyIdentityReadiness" }
    };
    const repairPlanRequest: CadQueryRequest = {
      version: "cadops.v1",
      query: {
        query: "topology.anchorRepairPlan",
        anchorId: "anchor_1",
        replacementCheckpointId: "checkpoint_2",
        derivedExactMetadata: {
          bodyId: "body_1",
          sourceIdentitySignature: "source-signature",
          status: "ready"
        }
      }
    };
    const states: readonly CadTopologyIdentityState[] = [
      "active",
      "replaced",
      "split",
      "merged",
      "consumed",
      "deleted",
      "ambiguous",
      "stale",
      "missing",
      "repair-needed",
      "unsupported",
      "failed",
      "deferred"
    ];
    const anchor: CadTopologyAnchorDescriptor = {
      anchorId: "anchor_1",
      entityKind: "face",
      bodyId: "body_1",
      sourceFeatureId: "feature_1",
      stableId: "face:endCap",
      sourceSemanticRole: "endCap",
      signatureHash: "signature_hash",
      state: "deferred",
      diagnostics: []
    };
    const checkpoint: CadTopologyCheckpointMetadata = {
      checkpointId: "checkpoint_1",
      bodyId: "body_1",
      sourceIdentity: {
        algorithm: WCAD_SOURCE_IDENTITY_ALGORITHM,
        sha256:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
      },
      projectSchemaVersion: CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION,
      packageVersion: CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION,
      brepEntryId: "checkpoint_brep_1",
      topologyEntryId: "checkpoint_topology_1",
      signatureEntryId: "checkpoint_signature_1",
      status: "deferred",
      diagnostics: []
    };
    const match: CadTopologyMatchResult = {
      entityKind: "face",
      state: "repair-needed",
      confidence: "medium",
      confidenceScore: 0.55,
      evidenceCount: 1,
      evidence: [
        {
          kind: "sourceSemanticRole",
          confidence: "high",
          message: "Semantic role matches."
        }
      ],
      diagnosticCount: 0,
      diagnostics: []
    };
    const repair: CadTopologyRepairCandidate = {
      candidateId: "topology_repair_candidate_1",
      anchorId: "anchor_1",
      target: {
        type: "generatedReference",
        bodyId: "body_1",
        stableId: "face:endCap",
        kind: "face"
      },
      candidateCheckpointEvidence: {
        checkpointId: "checkpoint_2",
        checkpointEntityId: "checkpoint-local:face:2",
        idScope: "checkpoint-local",
        publicStableId: false
      },
      entityKind: "face",
      state: "repair-needed",
      confidence: "medium",
      canAutoRetarget: false,
      recommendedAction: "manual-repair-plan",
      evidence: match.evidence,
      diagnostics: []
    };
    const response: ProjectTopologyIdentityReadinessQueryResponse = {
      ok: true,
      query: "project.topologyIdentityReadiness",
      cadOpsVersion: "cadops.v1",
      contractVersion: CAD_TOPOLOGY_IDENTITY_CONTRACT_VERSION,
      status: "deferred",
      currentDocumentSchemaVersion: "web-cad.project.v17",
      plannedProjectSchemaVersion: CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION,
      currentPackageVersion: WCAD_PACKAGE_VERSION,
      plannedPackageVersion: CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION,
      requiresProjectSchemaMigration: false,
      requiresPackageVersionMigration: false,
      sourceBoundaryNote: "Authoritative document source only.",
      derivedBoundaryNote: "Private renderer/kernel/browser IDs excluded.",
      supportedEntityKinds: [
        "body",
        "face",
        "loop",
        "wire",
        "coedge",
        "edge",
        "vertex",
        "axis"
      ],
      currentFeatureCount: 1,
      currentBodyCount: 1,
      currentNamedReferenceCount: 0,
      snapshotDescriptorCount: 1,
      snapshots: [
        {
          bodyId: "body_1",
          sourceFeatureId: "feature_1",
          entityKinds: ["face", "edge", "vertex"],
          status: "deferred",
          diagnostics: []
        }
      ],
      anchorCount: 1,
      anchors: [anchor],
      checkpointCount: 1,
      checkpoints: [checkpoint],
      matchResultCount: 1,
      matchResults: [match],
      repairCandidateCount: 1,
      repairCandidates: [repair],
      capabilityCount: 1,
      capabilities: [
        {
          capability: "protocolVocabulary",
          label: "Topology identity protocol vocabulary",
          status: "supported",
          available: true,
          sourceBoundaryNote: "Authoritative document source only.",
          derivedBoundaryNote: "Private renderer/kernel/browser IDs excluded.",
          diagnostics: [
            {
              code: "TOPOLOGY_IDENTITY_CONTRACT_READY",
              status: "supported",
              severity: "info",
              message: "Topology identity contract is typed."
            }
          ]
        }
      ],
      diagnosticCount: 1,
      diagnostics: [
        {
          code: "TOPOLOGY_IDENTITY_CONTRACT_READY",
          status: "supported",
          severity: "info",
          message: "Topology identity contract is typed."
        }
      ]
    };
    const repairPlan: TopologyAnchorRepairPlanQueryResponse = {
      ok: true,
      query: "topology.anchorRepairPlan",
      cadOpsVersion: "cadops.v1",
      status: "ready",
      anchorId: "anchor_1",
      bodyId: "body_1",
      entityKind: "face",
      previousCheckpointId: "checkpoint_1",
      previousCheckpointEntityId: "checkpoint-local:face:1",
      replacementCheckpointId: "checkpoint_2",
      replacementCheckpointEntityId: "checkpoint-local:face:2",
      repairId: "repair_1",
      confidence: "high",
      evidence: [
        {
          kind: "sourceSemanticRole",
          confidence: "high",
          message: "Semantic role matches."
        }
      ],
      repairCandidateCount: 1,
      repairCandidates: [repair],
      createsCheckpoint: false,
      createsRepair: true,
      opCount: 1,
      ops: [
        {
          op: "topology.anchor.repair",
          repairId: "repair_1",
          anchorId: "anchor_1",
          replacementCheckpointId: "checkpoint_2",
          replacementCheckpointEntityId: "checkpoint-local:face:2",
          confidence: "high"
        }
      ],
      proposedBatch: {
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "topology.anchor.repair",
            repairId: "repair_1",
            anchorId: "anchor_1",
            replacementCheckpointId: "checkpoint_2",
            replacementCheckpointEntityId: "checkpoint-local:face:2",
            confidence: "high"
          }
        ]
      },
      diagnosticCount: 0,
      diagnostics: [],
      sourceBoundaryNote: "Authoritative document source only.",
      derivedBoundaryNote: "Private renderer/kernel/browser IDs excluded.",
      mutatesSource: false
    };

    expect(request.query.query).toBe("project.topologyIdentityReadiness");
    expect(repairPlanRequest.query.query).toBe("topology.anchorRepairPlan");
    expect(states).toContain("consumed");
    expect(states).toContain("failed");
    expect(response.contractVersion).toBe(
      CAD_TOPOLOGY_IDENTITY_CONTRACT_VERSION
    );
    expect(response.plannedProjectSchemaVersion).toBe("web-cad.project.v18");
    expect(response.plannedPackageVersion).toBe("partbench.wcad.v2");
    expect(response.anchors[0]?.entityKind).toBe("face");
    expect(response.checkpoints[0]).not.toHaveProperty("brepEntryPath");
    expect(repairPlan.createsRepair).toBe(true);
    expect(repairPlan.proposedBatch.ops[0]?.op).toBe("topology.anchor.repair");
  });

  it("types V18 topology source and WCAD v2 checkpoint package contracts", () => {
    const sourceIdentity = {
      algorithm: WCAD_SOURCE_IDENTITY_ALGORITHM,
      sha256: "2222222222222222222222222222222222222222222222222222222222222222"
    };
    const source: CadTopologyIdentitySourceSnapshot = {
      schemaVersion: CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION,
      settings: {
        contractVersion: CAD_TOPOLOGY_IDENTITY_CONTRACT_VERSION,
        matchingPolicy: "evidence-scored-explicit-repair",
        checkpointPolicy: "required-for-topology-anchors",
        minimumAutomaticConfidence: "high",
        allowSilentRetargeting: false
      },
      checkpoints: [
        {
          checkpointId: "checkpoint_1",
          bodyId: "body_1",
          sourceIdentity,
          packageVersion: CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION,
          projectSchemaVersion: CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION,
          brepEntryPath: "checkpoints/checkpoint_1.brep",
          topologyEntryPath: "checkpoints/checkpoint_1.topology.cbor",
          signatureEntryPath: "checkpoints/checkpoint_1.signature.cbor",
          status: "active",
          diagnostics: []
        }
      ],
      anchors: [
        {
          anchorId: "anchor_1",
          entityKind: "face",
          bodyId: "body_1",
          checkpointId: "checkpoint_1",
          checkpointEntityId: "checkpoint-local:face:7",
          state: "active",
          diagnostics: []
        }
      ],
      repairs: []
    };
    const checkpointEntry = {
      checkpointId: "checkpoint_1",
      bodyId: "body_1",
      sourceIdentity,
      units: "mm" as const,
      kernel: {
        boundary: "geometry-kernel" as const,
        packageName: "opencascade.js",
        packageVersion: "2.0.0-test",
        snapshotAlgorithm: "partbench-derived-topology-snapshot-v1" as const
      },
      tolerance: {
        linearTolerance: 0.001
      },
      brep: {
        checkpointId: "checkpoint_1",
        path: "checkpoints/checkpoint_1.brep",
        byteLength: 64,
        sha256:
          "3333333333333333333333333333333333333333333333333333333333333333",
        source: true as const,
        sourceIdentity
      },
      topology: {
        checkpointId: "checkpoint_1",
        path: "checkpoints/checkpoint_1.topology.cbor",
        byteLength: 32,
        sha256:
          "4444444444444444444444444444444444444444444444444444444444444444",
        source: true as const,
        sourceIdentity
      },
      signature: {
        checkpointId: "checkpoint_1",
        path: "checkpoints/checkpoint_1.signature.cbor",
        byteLength: 16,
        sha256:
          "5555555555555555555555555555555555555555555555555555555555555555",
        source: true as const,
        sourceIdentity
      }
    };
    const signaturePayload: WcadTopologyCheckpointSignaturePayload = {
      checkpointId: "checkpoint_1",
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
      signature: "checkpoint_signature",
      entityCount: 1,
      entities: [
        {
          localId: "checkpoint-local:face:7",
          kind: "face",
          signature: "face_signature"
        }
      ]
    };
    const manifest: WcadManifestV2 = {
      packageVersion: CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION,
      product: "Partbench",
      createdBy: { app: "partbench" },
      createdAt: "2026-06-21T00:00:00.000Z",
      modifiedAt: "2026-06-21T00:00:00.000Z",
      units: "mm",
      document: {
        path: WCAD_DOCUMENT_ENTRY_PATH,
        schemaVersion: CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION,
        byteLength: 12,
        sha256:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      commands: {
        path: WCAD_COMMANDS_ENTRY_PATH,
        byteLength: 8,
        sha256:
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      },
      sourceIdentity,
      topologyIdentity: {
        contractVersion: CAD_TOPOLOGY_IDENTITY_CONTRACT_VERSION,
        projectSchemaVersion: CAD_TOPOLOGY_IDENTITY_PROJECT_SCHEMA_VERSION,
        checkpointCount: 1,
        checkpoints: [checkpointEntry],
        jsonFallback: "checkpoint-metadata-only"
      }
    };

    expect(source.schemaVersion).toBe("web-cad.project.v18");
    expect(source.settings.allowSilentRetargeting).toBe(false);
    expect(signaturePayload.entities?.[0]?.kind).toBe("face");
    expect(manifest.packageVersion).toBe("partbench.wcad.v2");
    expect(manifest.topologyIdentity.checkpoints[0]?.brep.source).toBe(true);
    expect(JSON.stringify(manifest)).not.toMatch(
      /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex|opfsPath|fileHandle/i
    );
  });

  it("types non-mutating topology snapshot matching requests and responses", () => {
    const topologySnapshot: CadBodyExactTopologySnapshot = {
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
          localId: "checkpoint-local:face:1",
          kind: "face",
          source: "kernel-derived",
          signature: "face-signature",
          bounds: {
            min: [0, 0, 0],
            max: [1, 1, 0]
          }
        }
      ],
      unsupportedEntityKinds: [],
      adjacencyAvailable: true,
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
      signature: "snapshot-signature",
      diagnostics: []
    };
    const request: CadQueryRequest = {
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
            topologySnapshot
          }
        ]
      }
    };
    const response: TopologyMatchSnapshotsQueryResponse = {
      ok: true,
      query: "topology.matchSnapshots",
      cadOpsVersion: "cadops.v1",
      status: "active",
      previousSnapshot: {
        checkpointId: "checkpoint_old",
        bodyId: "body_1",
        entityKinds: ["face"],
        entityCount: 1,
        status: "active",
        diagnostics: []
      },
      candidateSnapshotCount: 1,
      candidateSnapshots: [
        {
          checkpointId: "checkpoint_new",
          bodyId: "body_1",
          entityKinds: ["face"],
          entityCount: 1,
          status: "active",
          diagnostics: []
        }
      ],
      resultCount: 1,
      matchResults: [
        {
          previousCheckpointId: "checkpoint_old",
          candidateCheckpointId: "checkpoint_new",
          previousCheckpointEntityId: "checkpoint-local:face:1",
          candidateCheckpointEntityId: "checkpoint-local:face:1",
          entityKind: "face",
          state: "active",
          confidence: "exact",
          confidenceScore: 1,
          evidenceCount: 1,
          evidence: [
            {
              kind: "geometrySignature",
              confidence: "exact",
              message: "Exact signature match.",
              previousValue: "face-signature",
              candidateValue: "face-signature"
            }
          ],
          diagnosticCount: 1,
          diagnostics: [
            {
              code: "TOPOLOGY_MATCH_EXACT",
              status: "supported",
              severity: "info",
              message: "Matched."
            }
          ]
        }
      ],
      repairCandidateCount: 0,
      repairCandidates: [],
      diagnosticCount: 1,
      diagnostics: [
        {
          code: "TOPOLOGY_MATCH_EXACT",
          status: "supported",
          severity: "info",
          message: "Matched."
        }
      ],
      sourceBoundaryNote: "Authoritative snapshot input only.",
      derivedBoundaryNote: "Private renderer IDs excluded.",
      mutatesSource: false
    };

    expect(request.query.query).toBe("topology.matchSnapshots");
    expect(response.matchResults[0]?.previousCheckpointEntityId).toBe(
      "checkpoint-local:face:1"
    );
    expect(response.mutatesSource).toBe(false);
  });

  it("types anchor-scoped topology repair candidate query responses", () => {
    const topologySnapshot: CadBodyExactTopologySnapshot = {
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
          localId: "checkpoint-local:face:1",
          kind: "face",
          source: "kernel-derived",
          signature: "face-signature"
        }
      ],
      unsupportedEntityKinds: [],
      adjacencyAvailable: true,
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
      signature: "snapshot-signature",
      diagnostics: []
    };
    const request: CadQueryRequest = {
      version: "cadops.v1",
      query: {
        query: "topology.anchorRepairCandidates",
        anchorIds: ["anchor_1"],
        previous: {
          checkpointId: "checkpoint_old",
          bodyId: "body_1",
          topologySnapshot
        },
        candidates: [
          {
            checkpointId: "checkpoint_new",
            bodyId: "body_1",
            topologySnapshot
          }
        ]
      }
    };
    const repairCandidate: CadTopologyRepairCandidate = {
      candidateId: "topology_repair_candidate_preview",
      target: {
        type: "topologyMatch",
        previousCheckpointId: "checkpoint_old",
        entityKind: "face"
      },
      previousCheckpointEvidence: {
        checkpointId: "checkpoint_old",
        checkpointEntityId: "checkpoint-local:face:1",
        idScope: "checkpoint-local",
        publicStableId: false
      },
      candidateCheckpointEvidence: {
        checkpointId: "checkpoint_new",
        checkpointEntityId: "checkpoint-local:face:2",
        idScope: "checkpoint-local",
        publicStableId: false
      },
      entityKind: "face",
      state: "split",
      confidence: "high",
      confidenceScore: 0.92,
      canAutoRetarget: false,
      recommendedAction: "manual-repair-plan",
      evidence: [],
      diagnostics: []
    };
    const response: TopologyAnchorRepairCandidatesQueryResponse = {
      ok: true,
      query: "topology.anchorRepairCandidates",
      cadOpsVersion: "cadops.v1",
      status: "split",
      anchorFilterCount: 1,
      anchorIds: ["anchor_1"],
      previousSnapshot: {
        checkpointId: "checkpoint_old",
        bodyId: "body_1",
        entityKinds: ["face"],
        entityCount: 1,
        status: "active",
        diagnostics: []
      },
      candidateSnapshotCount: 1,
      candidateSnapshots: [
        {
          checkpointId: "checkpoint_new",
          bodyId: "body_1",
          entityKinds: ["face"],
          entityCount: 1,
          status: "active",
          diagnostics: []
        }
      ],
      matchResultCount: 1,
      matchResults: [
        {
          previousCheckpointId: "checkpoint_old",
          candidateCheckpointId: "checkpoint_new",
          previousCheckpointEntityId: "checkpoint-local:face:1",
          candidateCheckpointEntityId: "checkpoint-local:face:2",
          entityKind: "face",
          state: "split",
          confidence: "high",
          confidenceScore: 0.92,
          evidenceCount: 0,
          evidence: [],
          diagnosticCount: 0,
          diagnostics: []
        }
      ],
      anchorGroupCount: 1,
      anchorGroups: [
        {
          anchorId: "anchor_1",
          target: { type: "topologyAnchor", anchorId: "anchor_1" },
          bodyId: "body_1",
          entityKind: "face",
          state: "split",
          confidence: "high",
          confidenceScore: 0.92,
          previousCheckpointId: "checkpoint_old",
          previousCheckpointEntityId: "checkpoint-local:face:1",
          candidateCheckpointId: "checkpoint_new",
          candidateCheckpointEntityId: "checkpoint-local:face:2",
          repairPlanQuery: "topology.anchorRepairPlan",
          candidateIdScope: "topology-match-preview",
          repairCandidateCount: 1,
          repairCandidates: [repairCandidate],
          diagnosticCount: 0,
          diagnostics: []
        }
      ],
      unscopedRepairCandidateCount: 0,
      unscopedRepairCandidates: [],
      diagnosticCount: 0,
      diagnostics: [],
      sourceBoundaryNote: "Authoritative anchors plus snapshot input only.",
      derivedBoundaryNote: "Private renderer IDs excluded.",
      mutatesSource: false
    };

    expect(request.query.query).toBe("topology.anchorRepairCandidates");
    expect(response.anchorGroups[0]?.candidateIdScope).toBe(
      "topology-match-preview"
    );
    expect(response.anchorGroups[0]?.repairPlanQuery).toBe(
      "topology.anchorRepairPlan"
    );
    expect(response.mutatesSource).toBe(false);
  });

  it("types topology match consumption across reference health, rebuild, and editability surfaces", () => {
    const match: CadTopologyMatchResult = {
      anchorId: "anchor_1",
      previousStableId: "generated:face:body_1:endCap",
      candidateStableId: "generated:face:body_2:endCap",
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
    const referenceHealth: ReferenceHealthQueryResponse = {
      ok: true,
      query: "reference.health",
      cadOpsVersion: "cadops.v1",
      target: { type: "topologyAnchor", anchorId: "anchor_1" },
      status: "replaced",
      referenceHealthCount: 1,
      referenceHealth: [
        {
          source: "topologyAnchor",
          status: "replaced",
          commandable: false,
          commandOperations: [],
          label: "End cap",
          bodyId: "body_1",
          stableId: "generated:face:body_1:endCap",
          kind: "face",
          topologyAnchorId: "anchor_1",
          topologyEntityKind: "face",
          checkpointId: "checkpoint_1",
          matchConfidence: "high",
          matchState: "replaced",
          sourceFeatureId: "feature_1",
          dependencies: {
            sketchIds: [],
            sketchEntityIds: [],
            featureIds: ["feature_1"],
            bodyIds: ["body_1"],
            generatedReferenceStableIds: ["generated:face:body_1:endCap"],
            namedReferenceNames: [],
            topologyAnchorIds: ["anchor_1"],
            checkpointIds: ["checkpoint_1"]
          },
          diagnosticCount: 1,
          diagnostics: [
            {
              code: "REFERENCE_TOPOLOGY_MATCH_REPLACED",
              severity: "warning",
              status: "replaced",
              message: "Explicit repair required.",
              bodyId: "body_1",
              stableId: "generated:face:body_1:endCap",
              topologyAnchorId: "anchor_1",
              checkpointId: "checkpoint_1",
              featureId: "feature_1"
            }
          ]
        }
      ],
      diagnosticCount: 1,
      diagnostics: [
        {
          code: "REFERENCE_TOPOLOGY_MATCH_REPLACED",
          severity: "warning",
          status: "replaced",
          message: "Explicit repair required.",
          topologyAnchorId: "anchor_1",
          checkpointId: "checkpoint_1"
        }
      ],
      sourceBoundaryNote: "source only",
      derivedBoundaryNote: "derived private ids excluded",
      requiresProjectSchemaMigration: false
    };
    const rebuild: ProjectRebuildPlanQueryResponse = {
      ok: true,
      query: "project.rebuildPlan",
      cadOpsVersion: "cadops.v1",
      status: "repair-needed",
      bodyLifecycleCount: 1,
      bodyLifecycles: [
        {
          bodyId: "body_1",
          featureId: "feature_1",
          role: "source",
          sourceType: "sketchExtrudeFeature",
          primaryState: "replaced",
          states: ["active", "source", "replaced"],
          referenceHealthStatus: "replaced",
          topologyAnchorCount: 1,
          topologyMatchCount: 1,
          topologyMatchStates: ["replaced"],
          rebuildRequired: true,
          derivedRebuildPending: false,
          commandReady: false,
          diagnosticCount: 0,
          diagnostics: []
        }
      ],
      lifecycleEffectCount: 0,
      lifecycleEffects: [],
      affected: {
        sketchIds: [],
        sketchEntityIds: [],
        featureIds: ["feature_1"],
        bodyIds: ["body_1"],
        generatedReferenceCount: 0,
        namedReferenceCount: 0,
        derivedArtifactKinds: ["derivedGeometry"]
      },
      diagnosticCount: 0,
      diagnostics: [],
      sourceBoundaryNote: "source only",
      derivedBoundaryNote: "derived private ids excluded",
      requiresProjectSchemaMigration: false
    };
    const editability: FeatureEditabilityQueryResponse = {
      ok: true,
      query: "feature.editability",
      cadOpsVersion: "cadops.v1",
      featureId: "feature_1",
      status: "editable",
      fieldCount: 0,
      fields: [],
      rebuildReadiness: {
        status: "ready",
        commitDeferred: false,
        diagnosticCount: 0,
        diagnostics: []
      },
      dryRun: {
        status: "not-requested",
        willMutateDocument: false,
        diagnosticCount: 0,
        diagnostics: []
      },
      affected: {
        sketchIds: [],
        featureIds: ["feature_1"],
        bodyIds: ["body_1"],
        generatedReferenceCount: 0,
        namedReferenceCount: 0
      },
      referenceChangeCount: 1,
      referenceChanges: [
        {
          category: "replaced",
          bodyId: "body_1",
          stableId: "generated:face:body_1:endCap",
          kind: "face",
          topologyAnchorId: "anchor_1",
          checkpointId: "checkpoint_1",
          matchConfidence: "high",
          sourceFeatureId: "feature_1",
          message: "Topology anchor is replaced."
        }
      ],
      diagnosticCount: 0,
      diagnostics: [],
      sourceBoundaryNote: "source only",
      derivedBoundaryNote: "derived private ids excluded",
      requiresProjectSchemaMigration: false
    };
    const request: CadQueryRequest = {
      version: "cadops.v1",
      query: {
        query: "reference.health",
        target: { type: "topologyAnchor", anchorId: "anchor_1" },
        topologyMatchResults: [match]
      }
    };

    expect(request.query.query).toBe("reference.health");
    expect(referenceHealth.referenceHealth[0]?.topologyAnchorId).toBe(
      "anchor_1"
    );
    expect(rebuild.bodyLifecycles[0]?.topologyMatchStates).toEqual([
      "replaced"
    ]);
    expect(editability.referenceChanges[0]?.matchConfidence).toBe("high");
  });

  it("types supported scene commands", () => {
    const ops: CadOp[] = [
      {
        op: "document.updateUnits",
        units: "in",
        mode: "preservePhysicalSize"
      },
      {
        op: "scene.createBox",
        id: "box_1",
        dimensions: { width: 1, height: 2, depth: 3 }
      },
      {
        op: "scene.createCylinder",
        id: "cylinder_1",
        dimensions: { radius: 1, height: 4 }
      },
      {
        op: "scene.createSphere",
        id: "sphere_1",
        dimensions: { radius: 2 }
      },
      {
        op: "scene.createCone",
        id: "cone_1",
        dimensions: { radius: 2, height: 5 }
      },
      {
        op: "scene.createTorus",
        id: "torus_1",
        dimensions: { majorRadius: 3, minorRadius: 0.5 }
      },
      {
        op: "scene.updateTransform",
        id: "box_1",
        transform: { translation: [1, 2, 3] }
      },
      {
        op: "scene.updateBoxDimensions",
        id: "box_1",
        dimensions: { width: 4, height: 5, depth: 6 }
      },
      {
        op: "scene.updateCylinderDimensions",
        id: "cylinder_1",
        dimensions: { radius: 2, height: 8 }
      },
      {
        op: "scene.updateSphereDimensions",
        id: "sphere_1",
        dimensions: { radius: 3 }
      },
      {
        op: "scene.updateConeDimensions",
        id: "cone_1",
        dimensions: { radius: 3, height: 8 }
      },
      {
        op: "scene.updateTorusDimensions",
        id: "torus_1",
        dimensions: { majorRadius: 4, minorRadius: 0.75 }
      },
      {
        op: "scene.renameObject",
        id: "box_1",
        name: "Base plate"
      },
      {
        op: "scene.deleteObject",
        id: "cylinder_1"
      },
      {
        op: "sketch.create",
        id: "sketch_1",
        name: "Base sketch",
        plane: "XY"
      },
      {
        op: "sketch.createOnFace",
        id: "sketch_face_1",
        name: "Face sketch",
        bodyId: "body_1",
        faceStableId: "generated:face:body_1:endCap"
      },
      {
        op: "sketch.addPoint",
        sketchId: "sketch_1",
        id: "skent_1",
        point: [0, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        start: [0, 0],
        end: [1, 1]
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        center: [0, 0],
        width: 2,
        height: 3
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        center: [1, 1],
        radius: 2
      },
      {
        op: "sketch.updateEntity",
        sketchId: "sketch_1",
        entity: {
          id: "skent_1",
          kind: "point",
          point: [2, 3]
        }
      },
      {
        op: "sketch.deleteEntity",
        sketchId: "sketch_1",
        entityId: "skent_1"
      },
      {
        op: "sketch.rename",
        id: "sketch_1",
        name: "Renamed sketch"
      },
      {
        op: "sketch.delete",
        id: "sketch_1"
      },
      {
        op: "feature.extrude",
        id: "feat_1",
        bodyId: "body_1",
        name: "Pad",
        sketchId: "sketch_1",
        entityId: "rect_1",
        depth: 5,
        side: "negative",
        operationMode: "cut",
        targetBodyId: "body_target"
      },
      {
        op: "feature.revolve",
        id: "feat_revolve_1",
        bodyId: "body_revolve_1",
        name: "Turn",
        sketchId: "sketch_1",
        entityId: "rect_1",
        axis: {
          type: "sketchLine",
          sketchId: "sketch_1",
          entityId: "axis_1"
        },
        angleDegrees: 180,
        operationMode: "newBody"
      },
      {
        op: "feature.hole",
        id: "feat_hole_1",
        bodyId: "body_hole_1",
        targetBodyId: "body_target",
        name: "Mounting hole",
        sketchId: "sketch_1",
        circleEntityId: "circle_1",
        depthMode: "blind",
        depth: 4,
        direction: "negative"
      },
      {
        op: "feature.chamfer",
        id: "feat_chamfer_1",
        bodyId: "body_chamfer_1",
        targetBodyId: "body_target",
        edgeStableId: "generated:edge:body_target:start:uMin",
        distance: 0.5,
        name: "Break edge"
      },
      {
        op: "feature.fillet",
        id: "feat_fillet_1",
        bodyId: "body_fillet_1",
        targetBodyId: "body_chamfer_1",
        namedReference: "Round edge",
        radius: 1,
        name: "Round edge"
      },
      {
        op: "feature.updateExtrude",
        id: "feat_1",
        depth: 7,
        side: "symmetric"
      },
      {
        op: "feature.updateRevolve",
        id: "feat_revolve_1",
        angleDegrees: 180
      },
      {
        op: "feature.updateHole",
        id: "feat_hole_1",
        depthMode: "throughAll",
        direction: "positive"
      },
      {
        op: "feature.updateChamfer",
        id: "feat_chamfer_1",
        distance: 0.75
      },
      {
        op: "feature.updateFillet",
        id: "feat_fillet_1",
        radius: 1.25
      },
      {
        op: "feature.delete",
        id: "feat_1"
      },
      {
        op: "reference.nameGenerated",
        name: "Mounting face",
        bodyId: "body_1",
        stableId: "generated:face:body_1:startCap"
      },
      {
        op: "reference.repairName",
        name: "Mounting face",
        bodyId: "body_1",
        stableId: "generated:face:body_1:endCap"
      },
      {
        op: "reference.deleteName",
        name: "Mounting face"
      },
      {
        op: "topology.checkpoint.create",
        checkpointId: "checkpoint_1",
        bodyId: "body_1",
        sourceIdentity: {
          algorithm: "partbench-source-v1",
          sha256:
            "1111111111111111111111111111111111111111111111111111111111111111"
        },
        status: "active"
      },
      {
        op: "topology.anchor.create",
        anchorId: "anchor_face_1",
        entityKind: "face",
        bodyId: "body_1",
        checkpointId: "checkpoint_1",
        checkpointEntityId: "face_1",
        stableId: "generated:face:body_1:endCap"
      },
      {
        op: "topology.anchor.repair",
        repairId: "repair_1",
        anchorId: "anchor_face_1",
        replacementCheckpointId: "checkpoint_2",
        replacementCheckpointEntityId: "face_2",
        confidence: "high"
      }
    ];

    expect(ops.map((op) => op.op)).toEqual([
      "document.updateUnits",
      "scene.createBox",
      "scene.createCylinder",
      "scene.createSphere",
      "scene.createCone",
      "scene.createTorus",
      "scene.updateTransform",
      "scene.updateBoxDimensions",
      "scene.updateCylinderDimensions",
      "scene.updateSphereDimensions",
      "scene.updateConeDimensions",
      "scene.updateTorusDimensions",
      "scene.renameObject",
      "scene.deleteObject",
      "sketch.create",
      "sketch.createOnFace",
      "sketch.addPoint",
      "sketch.addLine",
      "sketch.addRectangle",
      "sketch.addCircle",
      "sketch.updateEntity",
      "sketch.deleteEntity",
      "sketch.rename",
      "sketch.delete",
      "feature.extrude",
      "feature.revolve",
      "feature.hole",
      "feature.chamfer",
      "feature.fillet",
      "feature.updateExtrude",
      "feature.updateRevolve",
      "feature.updateHole",
      "feature.updateChamfer",
      "feature.updateFillet",
      "feature.delete",
      "reference.nameGenerated",
      "reference.repairName",
      "reference.deleteName",
      "topology.checkpoint.create",
      "topology.anchor.create",
      "topology.anchor.repair"
    ]);
    expect(ops[0]).toMatchObject({
      op: "document.updateUnits",
      mode: "preservePhysicalSize"
    });
    const namedFaceOp: CadOp = {
      op: "sketch.createOnFace",
      id: "sketch_named_face_1",
      name: "Named face sketch",
      referenceName: "Mounting face"
    };
    const topologyAnchorFaceOp: CadOp = {
      op: "sketch.createOnFace",
      id: "sketch_anchor_face_1",
      name: "Anchor face sketch",
      topologyAnchorId: "anchor_face_1"
    };
    const topologyAnchorChamferOp: CadOp = {
      op: "feature.chamfer",
      id: "feat_anchor_chamfer_1",
      bodyId: "body_anchor_chamfer_1",
      targetBodyId: "body_target",
      topologyAnchorId: "anchor_edge_1",
      distance: 0.25
    };
    const topologyAnchorFilletOp: CadOp = {
      op: "feature.fillet",
      id: "feat_anchor_fillet_1",
      bodyId: "body_anchor_fillet_1",
      targetBodyId: "body_target",
      topologyAnchorId: "anchor_edge_1",
      radius: 0.25
    };
    const addExtrudeOp: CadOp = {
      op: "feature.extrude",
      id: "feat_add",
      bodyId: "body_add",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 2,
      operationMode: "add",
      targetBodyId: "body_target"
    };
    expect(namedFaceOp).toMatchObject({
      op: "sketch.createOnFace",
      referenceName: "Mounting face"
    });
    expect(topologyAnchorFaceOp).toMatchObject({
      op: "sketch.createOnFace",
      topologyAnchorId: "anchor_face_1"
    });
    expect(topologyAnchorChamferOp).toMatchObject({
      op: "feature.chamfer",
      topologyAnchorId: "anchor_edge_1"
    });
    expect(topologyAnchorFilletOp).toMatchObject({
      op: "feature.fillet",
      topologyAnchorId: "anchor_edge_1"
    });
    expect(addExtrudeOp).toMatchObject({
      op: "feature.extrude",
      operationMode: "add",
      targetBodyId: "body_target"
    });
    const repairNamedReferenceOp: CadOp = {
      op: "reference.repairName",
      name: "Mounting face",
      bodyId: "body_2",
      stableId: "generated:face:body_2:endCap"
    };
    expect(repairNamedReferenceOp).toMatchObject({
      op: "reference.repairName",
      name: "Mounting face"
    });
    const repairNamedReferenceToAnchorOp: CadOp = {
      op: "reference.repairName",
      name: "Mounting face",
      topologyAnchorId: "anchor_face_1"
    };
    expect(repairNamedReferenceToAnchorOp).toMatchObject({
      op: "reference.repairName",
      topologyAnchorId: "anchor_face_1"
    });
    const topologyCheckpointCreateOp: CadOp = {
      op: "topology.checkpoint.create",
      checkpointId: "checkpoint_1",
      bodyId: "body_1",
      sourceIdentity: {
        algorithm: "partbench-source-v1",
        sha256:
          "2222222222222222222222222222222222222222222222222222222222222222"
      },
      status: "missing"
    };
    expect(topologyCheckpointCreateOp).toMatchObject({
      op: "topology.checkpoint.create",
      checkpointId: "checkpoint_1",
      status: "missing"
    });
    const topologyAnchorCreateOp: CadOp = {
      op: "topology.anchor.create",
      anchorId: "anchor_face_1",
      entityKind: "face",
      bodyId: "body_1",
      checkpointId: "checkpoint_1",
      checkpointEntityId: "face_1"
    };
    const topologyAnchorRepairOp: CadOp = {
      op: "topology.anchor.repair",
      repairId: "repair_1",
      anchorId: "anchor_face_1",
      replacementCheckpointId: "checkpoint_2",
      replacementCheckpointEntityId: "face_2",
      confidence: "high"
    };
    expect(topologyAnchorCreateOp).toMatchObject({
      op: "topology.anchor.create",
      anchorId: "anchor_face_1"
    });
    expect(topologyAnchorRepairOp).toMatchObject({
      op: "topology.anchor.repair",
      repairId: "repair_1"
    });

    const topologyAnchorDiff: SemanticDiff = {
      created: [],
      modified: [],
      deleted: [],
      references: {
        topologyCheckpointsCreated: [
          {
            checkpointId: "checkpoint_1",
            bodyId: "body_1",
            sourceIdentity: {
              algorithm: "partbench-source-v1",
              sha256:
                "3333333333333333333333333333333333333333333333333333333333333333"
            },
            status: "active"
          }
        ],
        topologyAnchorsCreated: [
          {
            anchorId: "anchor_face_1",
            entityKind: "face",
            bodyId: "body_1",
            checkpointId: "checkpoint_1",
            checkpointEntityId: "face_1",
            stableId: "generated:face:body_1:endCap"
          }
        ],
        topologyAnchorsRepaired: [
          {
            repairId: "repair_1",
            confidence: "high",
            before: {
              anchorId: "anchor_face_1",
              entityKind: "face",
              bodyId: "body_1",
              checkpointId: "checkpoint_1",
              checkpointEntityId: "face_1"
            },
            after: {
              anchorId: "anchor_face_1",
              entityKind: "face",
              bodyId: "body_2",
              checkpointId: "checkpoint_2",
              checkpointEntityId: "face_2"
            }
          }
        ]
      }
    };
    expect(
      topologyAnchorDiff.references?.topologyAnchorsRepaired?.[0]
    ).toMatchObject({
      repairId: "repair_1",
      confidence: "high"
    });
  });

  it("types CADOps batches", () => {
    const batch: CadBatch = {
      version: "cadops.v1",
      mode: "dryRun",
      actor: {
        type: "script",
        id: "test-script",
        name: "Test Script"
      },
      audit: {
        source: "script",
        requestId: "script_req_1",
        toolName: "local-script",
        intent: "dryRun",
        operationCount: 1
      },
      ops: [
        {
          op: "scene.createBox",
          dimensions: { width: 4, height: 5, depth: 6 }
        }
      ]
    };

    expect(batch.version).toBe("cadops.v1");
    expect(batch.mode).toBe("dryRun");
    expect(batch.actor?.type).toBe("script");
    expect(batch.audit?.operationCount).toBe(1);
    expect(batch.ops).toHaveLength(1);
  });

  it("types named reference repair semantic diffs", () => {
    const diff: SemanticDiff = {
      created: [],
      modified: [],
      deleted: [],
      references: {
        namedRepaired: [
          {
            before: {
              name: "Mounting face",
              bodyId: "body_1",
              stableId: "generated:face:body_1:startCap",
              kind: "face"
            },
            after: {
              name: "Mounting face",
              bodyId: "body_1",
              stableId: "generated:face:body_1:endCap",
              kind: "face"
            }
          }
        ]
      }
    };

    expect(diff.references?.namedRepaired?.[0]).toMatchObject({
      before: { stableId: "generated:face:body_1:startCap" },
      after: { stableId: "generated:face:body_1:endCap" }
    });
  });

  it("types V3 parameter and sketch dimension commands", () => {
    const ops: CadOp[] = [
      {
        op: "parameter.create",
        id: "param_line",
        name: "Line length",
        value: 5
      },
      {
        op: "sketch.dimension.create",
        id: "dim_line_length",
        name: "Line length dimension",
        sketchId: "sketch_1",
        entityId: "line_1",
        target: { entityKind: "line", role: "length" },
        parameterId: "param_line"
      },
      {
        op: "sketch.dimension.update",
        id: "dim_line_length",
        value: 8
      },
      {
        op: "sketch.dimension.rename",
        id: "dim_line_length",
        name: "Overall line length"
      },
      { op: "sketch.dimension.delete", id: "dim_line_length" },
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
        id: "con_fixed",
        name: "Fix line start",
        sketchId: "sketch_1",
        kind: "fixed",
        target: { entityId: "line_1", role: "start" },
        coordinate: [0, 0]
      },
      {
        op: "sketch.constraint.create",
        id: "con_coincident",
        name: "Coincident points",
        sketchId: "sketch_1",
        kind: "coincident",
        primaryTarget: { entityId: "point_1", role: "position" },
        secondaryTarget: { entityId: "line_1", role: "end" }
      },
      {
        op: "sketch.constraint.create",
        id: "con_midpoint",
        name: "Point at midpoint",
        sketchId: "sketch_1",
        kind: "midpoint",
        lineEntityId: "line_1",
        target: { entityId: "point_1", role: "position" }
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
        secondaryLineEntityId: "line_2"
      },
      {
        op: "sketch.constraint.rename",
        id: "con_horizontal",
        name: "Main horizontal"
      },
      { op: "sketch.constraint.delete", id: "con_horizontal" },
      { op: "parameter.delete", id: "param_line" }
    ];

    expect(ops.map((op) => op.op)).toEqual([
      "parameter.create",
      "sketch.dimension.create",
      "sketch.dimension.update",
      "sketch.dimension.rename",
      "sketch.dimension.delete",
      "sketch.constraint.create",
      "sketch.constraint.create",
      "sketch.constraint.create",
      "sketch.constraint.create",
      "sketch.constraint.create",
      "sketch.constraint.create",
      "sketch.constraint.rename",
      "sketch.constraint.delete",
      "parameter.delete"
    ]);
    expect(ops[1]).toMatchObject({
      op: "sketch.dimension.create",
      target: { entityKind: "line", role: "length" }
    });
    expect(ops[5]).toMatchObject({
      op: "sketch.constraint.create",
      kind: "horizontal"
    });
    expect(ops[6]).toMatchObject({
      op: "sketch.constraint.create",
      kind: "fixed",
      target: { entityId: "line_1", role: "start" }
    });
    expect(ops[7]).toMatchObject({
      op: "sketch.constraint.create",
      kind: "coincident",
      primaryTarget: { entityId: "point_1", role: "position" },
      secondaryTarget: { entityId: "line_1", role: "end" }
    });
    expect(ops[8]).toMatchObject({
      op: "sketch.constraint.create",
      kind: "midpoint",
      lineEntityId: "line_1",
      target: { entityId: "point_1", role: "position" }
    });
    expect(ops[9]).toMatchObject({
      op: "sketch.constraint.create",
      kind: "parallel",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2"
    });
    expect(ops[10]).toMatchObject({
      op: "sketch.constraint.create",
      kind: "perpendicular",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2"
    });
  });

  it("types rectangle-tool boolean commands with authored target body ids", () => {
    const cutOp: CadOp = {
      op: "feature.extrude",
      id: "feat_circle_cut",
      bodyId: "body_circle_cut",
      targetBodyId: "body_circle_target",
      sketchId: "sketch_1",
      entityId: "rect_tool",
      depth: 1,
      operationMode: "cut"
    };
    const addOp: CadOp = {
      op: "feature.extrude",
      id: "feat_rect_add",
      bodyId: "body_rect_add",
      targetBodyId: "body_rect_target",
      sketchId: "sketch_1",
      entityId: "rect_tool",
      depth: 1,
      operationMode: "add"
    };
    const batch: CadBatch = {
      version: "cadops.v1",
      mode: "dryRun",
      ops: [cutOp, addOp]
    };

    expect(batch.ops[0]).toMatchObject({
      op: "feature.extrude",
      operationMode: "cut",
      targetBodyId: "body_circle_target"
    });
    expect(batch.ops[1]).toMatchObject({
      op: "feature.extrude",
      operationMode: "add",
      targetBodyId: "body_rect_target"
    });
  });

  it("types structured validation errors", () => {
    const error: CadBatchValidationError = {
      code: "INVALID_DIMENSIONS",
      message: "Box dimensions must be positive finite numbers.",
      opIndex: 0,
      op: "scene.createBox",
      path: "$.ops[0].dimensions",
      expected: "positive finite width, height, and depth",
      received: '{"width":0,"height":1,"depth":1}'
    };

    expect(error).toMatchObject({
      code: "INVALID_DIMENSIONS",
      op: "scene.createBox",
      path: "$.ops[0].dimensions"
    });
  });

  it("types CADOps read queries", () => {
    const queries: CadQueryRequest[] = [
      {
        version: "cadops.v1",
        query: { query: "project.summary" }
      },
      {
        version: "cadops.v1",
        query: { query: "project.features" }
      },
      {
        version: "cadops.v1",
        query: { query: "project.structure" }
      },
      {
        version: "cadops.v1",
        query: { query: "project.health" }
      },
      {
        version: "cadops.v1",
        query: { query: "project.packageReadiness" }
      },
      {
        version: "cadops.v1",
        query: { query: "project.topologyIdentityReadiness" }
      },
      {
        version: "cadops.v1",
        query: {
          query: "project.health",
          derivedExactMetadata: [
            {
              bodyId: "body_hole_1",
              sourceIdentitySignature:
                "body-topology-source:v1:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
              status: "unsupported",
              error: {
                code: "UNSUPPORTED_EXACT_METADATA_SOURCE",
                message: "Unsupported exact metadata source."
              }
            }
          ]
        }
      },
      {
        version: "cadops.v1",
        query: { query: "project.sketches" }
      },
      {
        version: "cadops.v1",
        query: { query: "object.get", id: "box_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "object.measurements", id: "box_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "project.extents" }
      },
      {
        version: "cadops.v1",
        query: {
          query: "project.extents",
          derivedExactMetadata: [
            {
              bodyId: "body_revolve_1",
              sourceIdentitySignature:
                "body-topology-source:v1:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              status: "ready",
              metadata: {
                source: "kernel-derived",
                confidence: "kernel-derived",
                bounds: {
                  min: [0, 0, 0],
                  max: [1, 2, 3],
                  size: [1, 2, 3],
                  center: [0.5, 1, 1.5]
                },
                volume: 6,
                diagnostics: []
              }
            }
          ]
        }
      },
      {
        version: "cadops.v1",
        query: { query: "sketch.get", id: "sketch_1" }
      },
      {
        version: "cadops.v1",
        query: {
          query: "sketch.editReadiness",
          edit: {
            editKind: "entity.dimension.update",
            sketchId: "sketch_1",
            entityId: "rect_1",
            target: { entityKind: "rectangle", role: "width" },
            value: 12
          }
        }
      },
      {
        version: "cadops.v1",
        query: { query: "sketch.solverStatus", sketchId: "sketch_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "parameter.list" }
      },
      {
        version: "cadops.v1",
        query: { query: "parameter.get", id: "param_width" }
      },
      {
        version: "cadops.v1",
        query: { query: "sketch.dimensions", sketchId: "sketch_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "sketch.dimension.get", id: "dim_width" }
      },
      {
        version: "cadops.v1",
        query: { query: "sketch.evaluation", sketchId: "sketch_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "body.generatedReferences", bodyId: "body_1" }
      },
      {
        version: "cadops.v1",
        query: {
          query: "body.resolveGeneratedReference",
          bodyId: "body_1",
          stableId: "generated:face:body_1:startCap"
        }
      },
      {
        version: "cadops.v1",
        query: { query: "body.topology", bodyId: "body_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "body.topologyIdentity", bodyId: "body_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "body.measurements", bodyId: "body_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "reference.listNamed" }
      },
      {
        version: "cadops.v1",
        query: { query: "reference.resolveNamed", name: "Mounting face" }
      },
      {
        version: "cadops.v1",
        query: {
          query: "selection.referenceCandidates",
          selection: {
            type: "generatedReference",
            bodyId: "body_1",
            stableId: "generated:face:body_1:endCap",
            expectedKind: "face"
          },
          requiredOperation: "feature.attachSketchPlane"
        }
      },
      {
        version: "cadops.v1",
        query: {
          query: "topology.commandTargetReadiness",
          target: { type: "topologyAnchor", anchorId: "anchor_face_1" },
          desiredOperation: "feature.attachSketchPlane"
        }
      },
      {
        version: "cadops.v1",
        query: { query: "transaction.history" }
      }
    ];

    expect(queries.map((request) => request.query.query)).toEqual([
      "project.summary",
      "project.features",
      "project.structure",
      "project.health",
      "project.packageReadiness",
      "project.topologyIdentityReadiness",
      "project.health",
      "project.sketches",
      "object.get",
      "object.measurements",
      "project.extents",
      "project.extents",
      "sketch.get",
      "sketch.editReadiness",
      "sketch.solverStatus",
      "parameter.list",
      "parameter.get",
      "sketch.dimensions",
      "sketch.dimension.get",
      "sketch.evaluation",
      "body.generatedReferences",
      "body.resolveGeneratedReference",
      "body.topology",
      "body.topologyIdentity",
      "body.measurements",
      "reference.listNamed",
      "reference.resolveNamed",
      "selection.referenceCandidates",
      "topology.commandTargetReadiness",
      "transaction.history"
    ]);
  });

  it("types body topology identity query responses", () => {
    const request: CadQueryRequest = {
      version: "cadops.v1",
      query: {
        query: "body.topologyIdentity",
        bodyId: "body_1",
        checkpointId: "checkpoint_1"
      }
    };
    const response: CadQueryResponse = {
      ok: true,
      query: "body.topologyIdentity",
      cadOpsVersion: "cadops.v1",
      bodyId: "body_1",
      status: "active",
      checkpointId: "checkpoint_1",
      sourceFeatureId: "feat_1",
      descriptor: {
        snapshotId: "snapshot_1",
        checkpointId: "checkpoint_1",
        bodyId: "body_1",
        sourceFeatureId: "feat_1",
        entityKinds: ["face", "edge"],
        entityCount: 2,
        status: "active",
        diagnostics: []
      },
      candidateCount: 1,
      candidates: [
        {
          stableId: "generated:face:body_1:endCap",
          kind: "face",
          bodyId: "body_1",
          sourceFeatureId: "feat_1",
          checkpointId: "checkpoint_1",
          checkpointEntityId: "snapshot-local:face:0",
          status: "bound",
          confidence: "exact",
          sourceSemanticRole: "endCap",
          geometrySignature: "generated-reference:v13:test",
          diagnosticCount: 0,
          diagnostics: []
        }
      ],
      diagnosticCount: 0,
      diagnostics: [],
      sourceBoundaryNote: "Derived from document source.",
      derivedBoundaryNote: "Renderer ids are excluded.",
      mutatesSource: false
    };

    expect(request.query.query).toBe("body.topologyIdentity");
    expect(response).toMatchObject({
      ok: true,
      query: "body.topologyIdentity",
      candidateCount: 1,
      candidates: [{ status: "bound", confidence: "exact" }],
      mutatesSource: false
    });
  });

  it("types V4 sketch completeness status responses", () => {
    const evaluation: SketchEvaluationQueryResponse = {
      ok: true,
      query: "sketch.evaluation",
      cadOpsVersion: "cadops.v1",
      sketchId: "sketch_1",
      sketchName: "Profile",
      plane: "XY",
      status: "under-defined",
      drivenEntityCount: 1,
      drivenEntityIds: ["rect_1"],
      dimensionCount: 0,
      dimensions: [],
      constraintCount: 0,
      constraints: [],
      issueCount: 1,
      issues: [
        {
          code: "UNDER_DEFINED_SKETCH",
          message: "Sketch sketch_1 is under-defined.",
          sketchId: "sketch_1"
        }
      ]
    };
    const health: ProjectHealthQueryResponse = {
      ok: true,
      query: "project.health",
      cadOpsVersion: "cadops.v1",
      status: "under-defined",
      issueCount: 1,
      authoredExtrudeCount: 0,
      authoredRevolveCount: 1,
      authoredHoleCount: 0,
      authoredChamferCount: 0,
      authoredFilletCount: 0,
      attachedSketchCount: 0,
      sketchEvaluationCount: 1,
      sketchDimensionCount: 0,
      sketchConstraintCount: 0,
      namedReferenceCount: 0,
      authoredExtrudes: [],
      authoredRevolves: [
        {
          featureId: "feat_revolve_1",
          bodyId: "body_revolve_1",
          sketchId: "sketch_1",
          entityId: "rect_1",
          profileKind: "rectangle",
          axis: {
            type: "sketchLine",
            sketchId: "sketch_1",
            entityId: "axis_1"
          },
          angleDegrees: 360,
          operationMode: "newBody",
          topologyStatus: "unsupported",
          topologyModel: "none",
          topologyAvailable: false,
          exactMeasurementsAvailable: true,
          measurementConfidence: "kernel-derived",
          topologyIssueCount: 1,
          status: "healthy",
          issues: []
        }
      ],
      authoredHoles: [],
      authoredChamfers: [],
      authoredFillets: [],
      attachedSketches: [],
      sketchEvaluations: [
        {
          sketchId: "sketch_1",
          sketchName: "Profile",
          plane: "XY",
          status: "under-defined",
          drivenEntityIds: ["rect_1"],
          affectedFeatureIds: [],
          affectedBodyIds: [],
          issues: [
            {
              code: "UNDER_DEFINED_SKETCH",
              message: "Sketch sketch_1 is under-defined.",
              sketchId: "sketch_1"
            }
          ]
        }
      ],
      sketchDimensions: [],
      sketchConstraints: [],
      namedReferences: []
    };

    expect(evaluation.status).toBe("under-defined");
    expect(health.sketchEvaluations[0]?.status).toBe("under-defined");
  });

  it("types V10 F1 sketch edit readiness responses", () => {
    const response: SketchEditReadinessQueryResponse = {
      ok: true,
      query: "sketch.editReadiness",
      cadOpsVersion: "cadops.v1",
      status: "ready",
      edit: {
        editKind: "entity.dimension.update",
        sketchId: "sketch_1",
        entityId: "rect_1",
        target: { entityKind: "rectangle", role: "width" },
        value: 16
      },
      dryRun: {
        status: "valid",
        edit: {
          editKind: "entity.dimension.update",
          sketchId: "sketch_1",
          entityId: "rect_1",
          target: { entityKind: "rectangle", role: "width" },
          value: 16
        },
        commitOperation: "sketch.updateEntity",
        willMutateDocument: false,
        diagnosticCount: 0,
        diagnostics: []
      },
      affected: {
        sketchIds: ["sketch_1"],
        sketchEntityIds: ["rect_1"],
        dimensionIds: [],
        constraintIds: [],
        featureIds: ["feat_rect"],
        bodyIds: ["body_rect"],
        generatedReferenceCount: 1,
        namedReferenceCount: 0
      },
      featureImpactCount: 1,
      featureImpacts: [
        {
          featureId: "feat_rect",
          featureKind: "extrude",
          bodyId: "body_rect",
          impact: "source-profile",
          sketchId: "sketch_1",
          sketchEntityId: "rect_1",
          bodyLifecycle: "active",
          referenceHealthStatus: "active",
          diagnosticCount: 0,
          diagnostics: []
        }
      ],
      bodyLifecycleCount: 0,
      bodyLifecycles: [],
      referenceEffectCount: 0,
      referenceEffects: [],
      referenceHealthCount: 0,
      referenceHealth: [],
      diagnosticCount: 0,
      diagnostics: [],
      sourceBoundaryNote:
        "Sketch edit readiness is derived from authoritative sketch source.",
      derivedBoundaryNote:
        "Renderer meshes and file handles are excluded from sketch edit readiness.",
      requiresProjectSchemaMigration: false
    };

    expect(response.dryRun.willMutateDocument).toBe(false);
    expect(response.requiresProjectSchemaMigration).toBe(false);
  });

  it("types V11 sketch solver status responses", () => {
    const response: SketchSolverStatusQueryResponse = {
      ok: true,
      query: "sketch.solverStatus",
      cadOpsVersion: "cadops.v1",
      sketchId: "sketch_1",
      sketchName: "Profile",
      plane: "XY",
      status: "under-defined",
      readiness: "ready",
      solver: {
        engine: "current-direct-evaluator",
        numericalSolverStatus: "deferred",
        modelBuilt: false,
        solverRan: false,
        canSolveNumerically: false,
        deterministic: true,
        workerReady: false,
        diagnostic: {
          code: "SKETCH_SOLVER_NUMERICAL_SOLVER_DEFERRED",
          severity: "warning",
          message: "Numerical solve is deferred.",
          sketchId: "sketch_1"
        }
      },
      entityCount: 1,
      entities: [
        {
          sketchId: "sketch_1",
          entityId: "rect_1",
          entityKind: "rectangle",
          supported: true,
          variableCount: 4,
          degreesOfFreedom: 4,
          targetCount: 2,
          targets: [
            {
              type: "entity",
              sketchId: "sketch_1",
              entityId: "rect_1",
              entityKind: "rectangle"
            },
            {
              type: "point",
              sketchId: "sketch_1",
              entityId: "rect_1",
              role: "center"
            }
          ],
          diagnosticCount: 0,
          diagnostics: []
        }
      ],
      dimensionCount: 1,
      dimensions: [
        {
          dimensionId: "dim_w",
          sketchId: "sketch_1",
          entityId: "rect_1",
          target: { entityKind: "rectangle", role: "width" },
          valueSource: { type: "literal", value: 4 },
          effectiveValue: 4,
          status: "healthy",
          supported: true,
          targetRef: {
            type: "dimension",
            sketchId: "sketch_1",
            dimensionId: "dim_w",
            entityId: "rect_1",
            dimensionTarget: { entityKind: "rectangle", role: "width" }
          },
          diagnosticCount: 0,
          diagnostics: []
        }
      ],
      constraintCount: 0,
      constraints: [],
      deferredConstraintCount: 1,
      deferredConstraints: [
        {
          kind: "distance",
          status: "deferred",
          requiresProjectSchemaMigration: true,
          nextProjectSchemaVersion: "web-cad.project.v17",
          diagnostic: {
            code: "SKETCH_SOLVER_UNSUPPORTED_CONSTRAINT",
            severity: "info",
            message: "Distance is deferred.",
            sketchId: "sketch_1",
            constraintKind: "distance"
          }
        }
      ],
      profileValidity: {
        status: "valid",
        profileCount: 1,
        validProfileCount: 1,
        profiles: [
          {
            sketchId: "sketch_1",
            entityId: "rect_1",
            entityKind: "rectangle",
            profileKind: "rectangle",
            closed: true,
            featureReady: true,
            diagnosticCount: 0,
            diagnostics: []
          }
        ],
        diagnosticCount: 0,
        diagnostics: []
      },
      preview: {
        status: "deferred",
        willMutateDocument: false,
        supportedPreviewKinds: [],
        deferredPreviewKinds: ["entity.drag"],
        diagnosticCount: 1,
        diagnostics: [
          {
            code: "SKETCH_SOLVER_PREVIEW_DEFERRED",
            severity: "info",
            message: "Preview is deferred.",
            sketchId: "sketch_1"
          }
        ]
      },
      sourceContract: {
        currentProjectSchemaVersion: "web-cad.project.v16",
        emittedProjectSchemaVersion: "web-cad.project.v16",
        packageVersion: "partbench.wcad.v1",
        queryOnly: true,
        requiresProjectSchemaMigration: false,
        nextProjectSchemaVersion: "web-cad.project.v17",
        sourceRecordRequirements: [
          {
            recordKind: "advancedConstraint",
            status: "v17-required",
            requiresProjectSchemaMigration: true,
            nextProjectSchemaVersion: "web-cad.project.v17",
            reason: "Advanced constraints need source records."
          }
        ]
      },
      diagnosticCount: 0,
      diagnostics: [],
      sourceBoundaryNote: "Derived from sketch source.",
      derivedBoundaryNote: "No renderer ids.",
      requiresProjectSchemaMigration: false
    };

    expect(response.query).toBe("sketch.solverStatus");
    expect(response.preview.willMutateDocument).toBe(false);
    expect(response.sourceContract.emittedProjectSchemaVersion).toBe(
      "web-cad.project.v16"
    );
  });

  it("types V7 project summary fields while preserving legacy object fields", () => {
    const summary: ProjectSummaryQueryResponse = {
      ok: true,
      query: "project.summary",
      cadOpsVersion: "cadops.v1",
      units: "mm",
      objectCount: 1,
      objects: [
        {
          id: "legacy_box",
          kind: "box",
          dimensions: { width: 1, height: 2, depth: 3 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      ],
      structure: {
        partCount: 1,
        sketchCount: 1,
        sketchEntityCount: 1,
        featureCount: 1,
        bodyCount: 1,
        activeBodyCount: 1,
        consumedBodyCount: 0,
        primitiveCompatibilityBodyCount: 0,
        authoredBodyFeatureCount: 1
      },
      health: {
        status: "healthy",
        issueCount: 0
      },
      references: {
        namedReferenceCount: 0,
        namedReferenceStatusCounts: {
          resolved: 0,
          stale: 0
        },
        semanticBodySelectionCount: 1,
        semanticBodySelectionStatusCounts: {
          resolved: 1,
          missing: 0,
          stale: 0,
          unsupported: 0,
          ambiguous: 0,
          consumed: 0,
          "non-commandable": 0
        },
        generatedReferenceBodyCount: 1,
        generatedReferenceCount: 1,
        commandableReferenceCount: 1,
        referenceKindCounts: {
          body: 1,
          face: 0,
          edge: 0,
          vertex: 0,
          axis: 0
        },
        operationCounts: {
          "reference.nameGenerated": 1,
          "feature.extrudeCutTarget": 0,
          "feature.extrudeAddTarget": 0,
          "feature.attachSketchPlane": 0,
          "feature.chamfer": 0,
          "feature.fillet": 0,
          "feature.measureReference": 1,
          "feature.selectReference": 1
        }
      },
      exportReadiness: {
        status: "deferred",
        canExportFiles: false,
        sourceBoundaryNote:
          "Classified from authoritative project bodies, features, sketches, and document units.",
        derivedBoundaryNote:
          "No derived display output, visualization cache, or export job state is read or persisted.",
        formatCount: 2,
        formats: [
          {
            format: "step",
            status: "deferred",
            available: false,
            candidateBodyCount: 1,
            sourceSupportedBodyCount: 1,
            deferredBodyCount: 1,
            unavailableBodyCount: 0
          },
          {
            format: "glb",
            status: "deferred",
            available: false,
            candidateBodyCount: 1,
            sourceSupportedBodyCount: 1,
            deferredBodyCount: 1,
            unavailableBodyCount: 0
          }
        ],
        bodyCount: 1,
        sourceSupportedBodyCount: 1,
        deferredBodyCount: 1,
        unavailableBodyCount: 0,
        diagnosticCount: 2
      },
      workflowHints: [
        {
          code: "EXPORT_DEFERRED",
          level: "warning",
          message:
            "Source bodies are present, but file writers are still deferred by the shared export-readiness contract."
        }
      ]
    };

    expect(summary.objectCount).toBe(1);
    expect(summary.structure.authoredBodyFeatureCount).toBe(1);
    expect(summary.references.operationCounts["reference.nameGenerated"]).toBe(
      1
    );
    expect(
      summary.exportReadiness.formats.map((format) => format.format)
    ).toEqual(["step", "glb"]);
  });

  it("types generated body face and edge references", () => {
    const face: CadGeneratedFaceReference = {
      kind: "face",
      stableId: "generated:face:body_1:side:uMin",
      label: "uMin side face",
      description: "Side face generated from the rectangle uMin profile edge.",
      eligibleOperations: [
        "feature.attachSketchPlane",
        "feature.measureReference",
        "feature.selectReference"
      ],
      eligibilityNotes: [
        "Generated references are semantic first-slice references, not exact B-rep topology."
      ],
      bodyId: "body_1",
      ownerPartId: "part:default",
      sourceFeatureId: "feat_1",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1",
      role: "side:uMin",
      geometricSignature: {
        profileKind: "rectangle",
        sketchPlane: "XY",
        extrudeSide: "positive",
        depth: 5,
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 4,
          height: 2
        },
        surfaceType: "plane",
        normal: [-1, 0, 0],
        normalRole: "side:uMin"
      }
    };

    expect(face).toMatchObject({
      kind: "face",
      label: "uMin side face",
      role: "side:uMin",
      geometricSignature: {
        profileKind: "rectangle",
        surfaceType: "plane"
      }
    });

    const edge: CadGeneratedEdgeReference = {
      kind: "edge",
      stableId: "generated:edge:body_1:longitudinal:uMin:vMin",
      label: "uMin/vMin longitudinal edge",
      description: "Longitudinal edge joining the uMin/vMin rectangle corners.",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      eligibilityNotes: [
        "Generated references are semantic first-slice references, not exact B-rep topology."
      ],
      bodyId: "body_1",
      ownerPartId: "part:default",
      sourceFeatureId: "feat_1",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1",
      role: "longitudinal:uMin:vMin",
      adjacentFaceRoles: ["side:uMin", "side:vMin"],
      geometricSignature: {
        profileKind: "rectangle",
        sketchPlane: "XY",
        extrudeSide: "positive",
        depth: 5,
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 4,
          height: 2
        },
        curveType: "line",
        axis: [0, 0, 1],
        axisRole: "sketchPlaneNormal"
      }
    };

    expect(edge).toMatchObject({
      kind: "edge",
      label: "uMin/vMin longitudinal edge",
      role: "longitudinal:uMin:vMin",
      adjacentFaceRoles: ["side:uMin", "side:vMin"],
      geometricSignature: {
        profileKind: "rectangle",
        curveType: "line"
      }
    });

    const vertex: CadGeneratedVertexReference = {
      kind: "vertex",
      stableId: "generated:vertex:body_1:start:uMin:vMin",
      label: "Start uMin/vMin corner",
      description:
        "Corner vertex where the start cap, uMin side face, and vMin side face meet.",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      eligibilityNotes: [
        "Generated references are semantic first-slice references, not exact B-rep topology."
      ],
      bodyId: "body_1",
      ownerPartId: "part:default",
      sourceFeatureId: "feat_1",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1",
      role: "start:uMin:vMin",
      adjacentFaceRoles: ["startCap", "side:uMin", "side:vMin"],
      adjacentEdgeRoles: ["start:uMin", "start:vMin", "longitudinal:uMin:vMin"],
      geometricSignature: {
        profileKind: "rectangle",
        sketchPlane: "XY",
        extrudeSide: "positive",
        depth: 5,
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 4,
          height: 2
        },
        axis: [0, 0, 1],
        axisRole: "sketchPlaneNormal",
        profilePoint: [-2, -1],
        positionRole: "start"
      }
    };

    expect(vertex).toMatchObject({
      kind: "vertex",
      label: "Start uMin/vMin corner",
      role: "start:uMin:vMin",
      adjacentFaceRoles: ["startCap", "side:uMin", "side:vMin"],
      adjacentEdgeRoles: ["start:uMin", "start:vMin", "longitudinal:uMin:vMin"],
      geometricSignature: {
        profileKind: "rectangle",
        profilePoint: [-2, -1],
        positionRole: "start"
      }
    });

    const resolverResponse: CadQueryResponse = {
      ok: true,
      query: "body.resolveGeneratedReference",
      cadOpsVersion: "cadops.v1",
      bodyId: "body_1",
      stableId: "generated:vertex:body_1:start:uMin:vMin",
      kind: "vertex",
      reference: vertex
    };

    expect(resolverResponse).toMatchObject({
      ok: true,
      query: "body.resolveGeneratedReference",
      kind: "vertex",
      reference: {
        stableId: "generated:vertex:body_1:start:uMin:vMin",
        label: "Start uMin/vMin corner"
      }
    });

    const namedReference: NamedGeneratedReferenceEntry = {
      name: "Mounting face",
      bodyId: "body_1",
      stableId: "generated:face:body_1:side:uMin",
      kind: "face",
      status: "resolved",
      reference: face
    };

    const namedReferencesResponse: CadQueryResponse = {
      ok: true,
      query: "reference.listNamed",
      cadOpsVersion: "cadops.v1",
      referenceCount: 1,
      references: [namedReference]
    };

    expect(namedReferencesResponse).toMatchObject({
      ok: true,
      query: "reference.listNamed",
      references: [
        {
          name: "Mounting face",
          status: "resolved",
          reference: { label: "uMin side face" }
        }
      ]
    });
  });

  it("types measurement bounds", () => {
    const bounds: CadAxisAlignedBounds = {
      min: [-1, -2, -3],
      max: [1, 2, 3],
      size: [2, 4, 6],
      center: [0, 0, 0]
    };

    expect(bounds.size).toEqual([2, 4, 6]);
  });

  it("types authored body measurements", () => {
    const response: CadQueryResponse = {
      ok: true,
      query: "body.measurements",
      cadOpsVersion: "cadops.v1",
      measurements: {
        bodyId: "body_1",
        sourceFeatureId: "feat_1",
        sourceSketchId: "sketch_1",
        sourceSketchEntityId: "rect_1",
        profileKind: "rectangle",
        units: "mm",
        sketchPlane: "XY",
        side: "positive",
        depth: 3,
        measurementModel: "sourceAnalytic",
        localBounds: {
          min: [-2, -1, 0],
          max: [2, 1, 3],
          size: [4, 2, 3],
          center: [0, 0, 1.5]
        },
        localExtents: [4, 2, 3],
        centroid: [0, 0, 1.5],
        volume: 24,
        surfaceArea: 52
      }
    };

    expect(response).toMatchObject({
      ok: true,
      query: "body.measurements",
      measurements: {
        profileKind: "rectangle",
        measurementModel: "sourceAnalytic",
        localExtents: [4, 2, 3],
        volume: 24
      }
    });
  });

  it("types derived body topology status", () => {
    const response: CadQueryResponse = {
      ok: true,
      query: "body.topology",
      cadOpsVersion: "cadops.v1",
      topology: {
        bodyId: "body_1",
        units: "mm",
        status: "healthy",
        sourceKind: "authoredExtrude",
        sourceIdentity: {
          bodyId: "body_1",
          sourceKind: "authoredExtrude",
          signature:
            "body-topology-source:v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          units: "mm",
          featureId: "feat_1",
          operationMode: "newBody",
          sourceSketchId: "sketch_1",
          sourceSketchEntityId: "rect_1",
          profileKind: "rectangle",
          profileSignature: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 2
          },
          side: "positive",
          depth: 3
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
    };

    expect(response).toMatchObject({
      ok: true,
      query: "body.topology",
      topology: {
        status: "healthy",
        topologyAvailable: true,
        exactMeasurementsAvailable: true,
        faceCount: 6
      }
    });
  });

  it("types derived exact body metadata snapshots on body topology queries", () => {
    const request: CadQueryRequest = {
      version: "cadops.v1",
      query: {
        query: "body.topology",
        bodyId: "body_1",
        derivedExactMetadata: {
          bodyId: "body_1",
          sourceIdentitySignature:
            "body-topology-source:v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
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
                ...Array.from({ length: 33 }, (_, index) => ({
                  localId: `snapshot-local:face:${index}`,
                  kind: "face" as const,
                  source: "kernel-derived" as const,
                  signature: `topology-face-test-${index}`
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
    };

    const response: CadQueryResponse = {
      ok: true,
      query: "body.topology",
      cadOpsVersion: request.version,
      topology: {
        bodyId: "body_1",
        units: "mm",
        status: "healthy",
        sourceKind: "authoredExtrude",
        sourceIdentity: {
          bodyId: "body_1",
          sourceKind: "authoredExtrude",
          signature:
            "body-topology-source:v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          units: "mm"
        },
        topologyModel: "semantic-source",
        topologyAvailable: true,
        exactGeometryAvailable: true,
        exactMeasurementsAvailable: true,
        measurementConfidence: "kernel-derived",
        exactMetadata: {
          status: "healthy",
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
              ...Array.from({ length: 33 }, (_, index) => ({
                localId: `snapshot-local:face:${index}`,
                kind: "face" as const,
                source: "kernel-derived" as const,
                signature: `topology-face-test-${index}`
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
        },
        faceCount: 6,
        edgeCount: 12,
        vertexCount: 8,
        issues: []
      }
    };

    expect(request.query).toMatchObject({
      query: "body.topology",
      derivedExactMetadata: { status: "ready" }
    });
    expect(response).toMatchObject({
      topology: {
        exactGeometryAvailable: true,
        measurementConfidence: "kernel-derived",
        exactMetadata: {
          status: "healthy",
          volume: 24,
          topologyCounts: { faceCount: 6 },
          topologySnapshot: {
            status: "partial",
            adjacencyAvailable: false
          }
        }
      }
    });
  });

  it("types V12 boolean result topology readiness on body topology responses", () => {
    const response: CadQueryResponse = {
      ok: true,
      query: "body.topology",
      cadOpsVersion: "cadops.v1",
      topology: {
        bodyId: "body_cut",
        units: "mm",
        status: "ambiguous",
        sourceKind: "authoredExtrude",
        sourceIdentity: {
          bodyId: "body_cut",
          sourceKind: "authoredExtrude",
          signature:
            "body-topology-source:v1:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          units: "mm",
          featureId: "feat_cut",
          operationMode: "cut",
          targetBodyId: "body_target",
          sourceSketchId: "sketch_tool",
          sourceSketchEntityId: "rect_tool",
          profileKind: "rectangle"
        },
        topologyModel: "none",
        topologyAvailable: false,
        exactGeometryAvailable: false,
        exactMeasurementsAvailable: false,
        measurementConfidence: "none",
        booleanTopology: {
          contractVersion: "partbench.boolean-topology.v1",
          status: "partial",
          commandReady: false,
          sourceSemanticsAvailable: true,
          derivedExactValidationStatus: "notProvided",
          sourceInputs: {
            featureId: "feat_cut",
            resultBodyId: "body_cut",
            operationMode: "cut",
            targetBodyId: "body_target",
            toolSketchId: "sketch_tool",
            toolSketchEntityId: "rect_tool",
            toolProfileKind: "rectangle"
          },
          roleReadiness: [
            {
              role: "booleanResultBody",
              entityKind: "body",
              status: "proven",
              commandReady: false,
              roleStableId: "boolean-role:body:body_cut:result",
              label: "Boolean result body",
              message:
                "Boolean result body identity is source-backed, but generated topology roles are not command-ready yet."
            },
            {
              role: "cutWallFace",
              entityKind: "face",
              status: "command-ready",
              commandReady: true,
              roleStableId: "generated:face:body_cut:side:uMin",
              label: "Cut wall face uMin",
              sourceRole: "side:uMin",
              message:
                "This boolean result face role is command-ready through the V12 generated-reference path."
            },
            {
              role: "cutWallProfileEdge",
              entityKind: "edge",
              status: "command-ready",
              commandReady: true,
              roleStableId: "generated:edge:body_cut:longitudinal:uMin:vMin",
              label: "Cut wall profile edge uMin/vMin",
              sourceRole: "longitudinal:uMin:vMin",
              message:
                "This boolean result edge role is command-ready for selection, naming, and measurement through the V12 generated-reference path."
            }
          ],
          diagnostics: [
            {
              code: "BOOLEAN_TOPOLOGY_MATCHING_DEFERRED",
              severity: "blocking",
              message:
                "General boolean result topology matching remains deferred for unproven carried, split, terminal, and rim roles."
            },
            {
              code: "BOOLEAN_SOURCE_ROLE_DERIVATION_PARTIAL",
              severity: "warning",
              message:
                "Some boolean result roles are source-semantic, but unproven roles remain ambiguous until explicit topology support proves them."
            },
            {
              code: "BOOLEAN_RESULT_REFERENCES_PARTIAL_COMMAND_READY",
              severity: "warning",
              message:
                "Some boolean result face and edge roles are command-ready, while unproven boolean topology remains diagnostic-only."
            }
          ]
        },
        issues: [
          {
            code: "AMBIGUOUS_BODY_TOPOLOGY",
            message:
              "Stable generated topology references are ambiguous for authored boolean result bodies until boolean topology matching is implemented.",
            bodyId: "body_cut",
            featureId: "feat_cut"
          }
        ]
      }
    };

    expect(response).toMatchObject({
      ok: true,
      query: "body.topology",
      topology: {
        topologyAvailable: false,
        booleanTopology: {
          contractVersion: "partbench.boolean-topology.v1",
          status: "partial",
          commandReady: false,
          sourceInputs: {
            operationMode: "cut"
          },
          roleReadiness: [
            {
              role: "booleanResultBody",
              status: "proven",
              commandReady: false
            },
            {
              role: "cutWallFace",
              status: "command-ready",
              commandReady: true,
              sourceRole: "side:uMin"
            },
            {
              role: "cutWallProfileEdge",
              status: "command-ready",
              commandReady: true,
              sourceRole: "longitudinal:uMin:vMin"
            }
          ]
        }
      }
    });
  });

  it("types primitive feature summaries", () => {
    const feature: CadPrimitiveFeatureSummary = {
      id: "feature:torus_1",
      kind: "primitive",
      partId: "part:default",
      primitive: "torus",
      objectId: "torus_1",
      bodyId: "body:torus_1",
      dimensions: { majorRadius: 3, minorRadius: 0.5 },
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      },
      source: {
        type: "sceneObject",
        createdByTransactionId: "txn_1",
        createOp: "scene.createTorus"
      }
    };

    expect(feature).toMatchObject({
      id: "feature:torus_1",
      kind: "primitive",
      objectId: "torus_1"
    });
  });

  it("types sketch extrude feature summaries", () => {
    const feature: CadExtrudeFeatureSummary = {
      id: "feat_1",
      kind: "extrude",
      partId: "part:default",
      bodyId: "body_1",
      sketchId: "sketch_1",
      entityId: "rect_1",
      profileKind: "rectangle",
      depth: 5,
      side: "positive",
      operationMode: "newBody",
      source: {
        type: "sketchEntity",
        sketchId: "sketch_1",
        entityId: "rect_1"
      }
    };

    expect(feature).toMatchObject({
      id: "feat_1",
      kind: "extrude",
      bodyId: "body_1",
      profileKind: "rectangle"
    });
  });

  it("types topology-anchor extrude target provenance", () => {
    const op: CadOp = {
      op: "feature.extrude",
      id: "feat_anchor_cut",
      bodyId: "body_anchor_cut",
      name: "Anchor cut",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 2,
      side: "positive",
      operationMode: "cut",
      targetTopologyAnchorId: "anchor_body_target"
    };
    const feature: CadExtrudeFeatureSummary = {
      id: "feat_anchor_cut",
      kind: "extrude",
      partId: "part:default",
      bodyId: "body_anchor_cut",
      sketchId: "sketch_1",
      entityId: "rect_1",
      profileKind: "rectangle",
      depth: 2,
      side: "positive",
      operationMode: "cut",
      targetBodyId: "body_target",
      targetTopologyAnchorId: "anchor_body_target",
      source: {
        type: "sketchEntity",
        sketchId: "sketch_1",
        entityId: "rect_1",
        targetTopologyAnchorId: "anchor_body_target"
      }
    };

    expect(feature).toMatchObject({
      kind: "extrude",
      targetBodyId: "body_target",
      targetTopologyAnchorId: "anchor_body_target",
      source: {
        targetTopologyAnchorId: "anchor_body_target"
      }
    });
    expect(op).toMatchObject({
      op: "feature.extrude",
      targetTopologyAnchorId: "anchor_body_target"
    });
  });

  it("types sketch revolve feature snapshots and summaries", () => {
    const snapshot: RevolveFeatureSnapshot = {
      id: "feat_revolve_1",
      kind: "revolve",
      sketchId: "sketch_1",
      entityId: "rect_1",
      profileKind: "rectangle",
      axis: {
        type: "sketchLine",
        sketchId: "sketch_1",
        entityId: "axis_1"
      },
      angleDegrees: 270,
      operationMode: "newBody",
      bodyId: "body_revolve_1"
    };
    const feature: CadRevolveFeatureSummary = {
      id: snapshot.id,
      kind: "revolve",
      partId: "part:default",
      bodyId: snapshot.bodyId,
      sketchId: snapshot.sketchId,
      entityId: snapshot.entityId,
      profileKind: snapshot.profileKind,
      axis: snapshot.axis,
      angleDegrees: snapshot.angleDegrees,
      operationMode: "newBody",
      source: {
        type: "sketchEntityWithAxis",
        sketchId: snapshot.sketchId,
        entityId: snapshot.entityId,
        axis: snapshot.axis
      }
    };

    expect(feature).toMatchObject({
      id: "feat_revolve_1",
      kind: "revolve",
      bodyId: "body_revolve_1",
      angleDegrees: 270
    });
  });

  it("types sketch hole feature snapshots and summaries", () => {
    const snapshot: HoleFeatureSnapshot = {
      id: "feat_hole_1",
      kind: "hole",
      targetBodyId: "body_target",
      sketchId: "sketch_1",
      circleEntityId: "circle_1",
      depthMode: "blind",
      depth: 4,
      direction: "negative",
      bodyId: "body_hole_1"
    };
    const feature: CadHoleFeatureSummary = {
      id: snapshot.id,
      kind: "hole",
      partId: "part:default",
      bodyId: snapshot.bodyId,
      targetBodyId: snapshot.targetBodyId,
      sketchId: snapshot.sketchId,
      circleEntityId: snapshot.circleEntityId,
      depthMode: snapshot.depthMode,
      depth: snapshot.depth,
      direction: snapshot.direction,
      source: {
        type: "sketchCircleHole",
        sketchId: snapshot.sketchId,
        circleEntityId: snapshot.circleEntityId,
        targetBodyId: snapshot.targetBodyId
      }
    };

    expect(feature).toMatchObject({
      id: "feat_hole_1",
      kind: "hole",
      bodyId: "body_hole_1",
      targetBodyId: "body_target",
      depthMode: "blind"
    });
  });

  it("types the V2 structural model bridge", () => {
    const part: CadPartSnapshot = {
      id: "part:default",
      kind: "part",
      name: "Default Part",
      source: { type: "defaultScenePart" },
      objectIds: ["box_1"],
      featureIds: ["feature:box_1"],
      bodyIds: ["body:box_1"],
      sketchIds: ["sketch_1"]
    };
    const body: CadBodySnapshot = {
      id: "body:box_1",
      kind: "solid",
      partId: "part:default",
      featureId: "feature:box_1",
      objectId: "box_1",
      primitive: "box",
      source: {
        type: "primitiveFeature",
        featureId: "feature:box_1",
        objectId: "box_1"
      }
    };
    const objectSource: CadObjectModelSource = {
      objectId: "box_1",
      partId: part.id,
      featureId: body.featureId,
      bodyId: body.id
    };

    expect(part.featureIds).toEqual(["feature:box_1"]);
    expect(body.partId).toBe(part.id);
    expect(objectSource).toEqual({
      objectId: "box_1",
      partId: "part:default",
      featureId: "feature:box_1",
      bodyId: "body:box_1"
    });
  });

  it("types attached sketch metadata", () => {
    const sketch: SketchSnapshot = {
      id: "sketch_face_1",
      name: "Face sketch",
      plane: "XY",
      attachment: {
        kind: "generatedFace",
        bodyId: "body_1",
        faceStableId: "generated:face:body_1:endCap",
        sourceFeatureId: "feat_1",
        sourceSketchId: "sketch_1",
        sourceSketchEntityId: "rect_1",
        faceRole: "endCap"
      },
      entities: []
    };

    expect(sketch.attachment).toMatchObject({
      kind: "generatedFace",
      faceStableId: "generated:face:body_1:endCap",
      faceRole: "endCap"
    });
  });

  it("types viewport two-target measurement session output", () => {
    const firstTarget: CadViewportTwoTargetMeasurementTarget = {
      targetKind: "generatedPlanarFace",
      bodyId: "body_1",
      stableId: "generated:face:body_1:startCap",
      label: "Start cap",
      selection: {
        type: "generatedReference",
        bodyId: "body_1",
        stableId: "generated:face:body_1:startCap",
        expectedKind: "face"
      },
      authority: "sourceAnalytic",
      status: "resolved",
      diagnostics: [],
      pointRole: "generatedFaceCenter",
      vectorRole: "generatedFaceNormal"
    };
    const secondTarget: CadViewportTwoTargetMeasurementTarget = {
      targetKind: "generatedEdge",
      bodyId: "body_1",
      stableId: "generated:edge:body_1:start:uMin",
      label: "Start uMin",
      selection: {
        type: "generatedReference",
        bodyId: "body_1",
        stableId: "generated:edge:body_1:start:uMin",
        expectedKind: "edge"
      },
      authority: "sourceAnalytic",
      status: "resolved",
      diagnostics: [],
      pointRole: "generatedEdgeCenter",
      vectorRole: "generatedLinearEdgeDirection"
    };
    const result: CadViewportTwoTargetMeasurementResult = {
      kind: "angle",
      authority: "sourceAnalytic",
      value: 90,
      units: "deg",
      diagnostics: []
    };
    const state: CadViewportTwoTargetMeasurementState = {
      firstTarget,
      secondTarget,
      pendingTarget: secondTarget,
      results: [result],
      diagnostics: []
    };

    expect(state.results[0]).toMatchObject({
      kind: "angle",
      authority: "sourceAnalytic",
      value: 90,
      units: "deg"
    });
    expect(state.firstTarget?.selection?.type).toBe("generatedReference");
    expect(JSON.stringify(state)).not.toContain("renderer-hit");
  });

  it("types project extents with authored bodies and warnings", () => {
    const response: CadQueryResponse = {
      ok: true,
      query: "project.extents",
      cadOpsVersion: "cadops.v1",
      units: "mm",
      objectCount: 0,
      bodyCount: 2,
      bounds: {
        min: [-2, -1, 0],
        max: [2, 1, 3],
        size: [4, 2, 3],
        center: [0, 0, 1.5]
      },
      approximateVolume: 24,
      objects: [],
      bodies: [
        {
          bodyId: "body_1",
          sourceFeatureId: "feat_1",
          sourceKind: "authoredExtrude",
          extentSource: "source-analytic",
          measurementConfidence: "source-analytic",
          sourceSketchId: "sketch_1",
          sourceSketchEntityId: "rect_1",
          profileKind: "rectangle",
          worldBounds: {
            min: [-2, -1, 0],
            max: [2, 1, 3],
            size: [4, 2, 3],
            center: [0, 0, 1.5]
          },
          volume: 24
        },
        {
          bodyId: "body_revolve",
          sourceFeatureId: "feat_revolve",
          sourceKind: "authoredRevolve",
          extentSource: "kernel-derived",
          measurementConfidence: "kernel-derived",
          sourceIdentitySignature:
            "body-topology-source:v1:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          worldBounds: {
            min: [-1, -1, 0],
            max: [1, 1, 2],
            size: [2, 2, 2],
            center: [0, 0, 1]
          },
          volume: 8,
          surfaceArea: 24,
          centroid: [0, 0, 1],
          topologyCounts: {
            solidCount: 1,
            faceCount: 3,
            edgeCount: 6,
            vertexCount: 4
          }
        }
      ],
      warnings: [
        {
          code: "BODY_EXTENTS_UNAVAILABLE",
          message: "Skipped stale body.",
          bodyId: "body_stale",
          featureId: "feat_stale"
        },
        {
          code: "DERIVED_EXACT_METADATA_STALE",
          message: "Skipped stale exact metadata.",
          bodyId: "body_revolve",
          featureId: "feat_revolve",
          status: "stale",
          expected:
            "body-topology-source:v1:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          received:
            "body-topology-source:v1:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        }
      ]
    };

    expect(response).toMatchObject({
      ok: true,
      query: "project.extents",
      bodyCount: 2
    });
    if (response.ok && response.query === "project.extents") {
      expect(response.bodies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ bodyId: "body_1", volume: 24 })
        ])
      );
      expect(response.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "BODY_EXTENTS_UNAVAILABLE" }),
          expect.objectContaining({ code: "DERIVED_EXACT_METADATA_STALE" })
        ])
      );
    }
  });

  it("types generated reference measurements", () => {
    const response: CadQueryResponse = {
      ok: true,
      query: "body.generatedReferenceMeasurements",
      cadOpsVersion: "cadops.v1",
      bodyId: "body_1",
      stableId: "generated:face:body_1:endCap",
      kind: "face",
      reference: {
        kind: "face",
        stableId: "generated:face:body_1:endCap",
        label: "End cap",
        eligibleOperations: ["feature.measureReference"],
        bodyId: "body_1",
        ownerPartId: "part:default",
        sourceFeatureId: "feat_1",
        sourceSketchId: "sketch_1",
        sourceSketchEntityId: "rect_1",
        role: "endCap",
        geometricSignature: {
          profileKind: "rectangle",
          sketchPlane: "XY",
          extrudeSide: "positive",
          depth: 3
        }
      },
      measurements: {
        kind: "face",
        stableId: "generated:face:body_1:endCap",
        bodyId: "body_1",
        sourceFeatureId: "feat_1",
        sourceSketchId: "sketch_1",
        sourceSketchEntityId: "rect_1",
        profileKind: "rectangle",
        units: "mm",
        measurementModel: "sourceAnalytic",
        role: "endCap",
        area: 8,
        bounds: {
          min: [-2, -1, 3],
          max: [2, 1, 3],
          size: [4, 2, 0],
          center: [0, 0, 3]
        },
        center: [0, 0, 3],
        surfaceType: "plane",
        normal: [0, 0, 1],
        normalRole: "endCapOutward"
      }
    };

    expect(response).toMatchObject({
      ok: true,
      query: "body.generatedReferenceMeasurements",
      kind: "face",
      measurements: {
        kind: "face",
        role: "endCap",
        area: 8
      }
    });
  });

  it("types selection reference candidate responses", () => {
    const response: CadQueryResponse = {
      ok: true,
      query: "selection.referenceCandidates",
      cadOpsVersion: "cadops.v1",
      selection: {
        type: "generatedReference",
        bodyId: "body_1",
        stableId: "generated:face:body_1:endCap",
        expectedKind: "face"
      },
      requiredOperation: "feature.attachSketchPlane",
      status: "resolved",
      candidateCount: 1,
      candidates: [
        {
          source: "generatedReferenceSelection",
          target: {
            type: "generatedReference",
            bodyId: "body_1",
            stableId: "generated:face:body_1:endCap",
            kind: "face"
          },
          reference: {
            kind: "face",
            stableId: "generated:face:body_1:endCap",
            label: "End cap",
            eligibleOperations: [
              "feature.attachSketchPlane",
              "feature.measureReference",
              "feature.selectReference"
            ],
            bodyId: "body_1",
            ownerPartId: "part:default",
            sourceFeatureId: "feat_1",
            sourceSketchId: "sketch_1",
            sourceSketchEntityId: "rect_1",
            role: "endCap",
            geometricSignature: {
              profileKind: "rectangle",
              sketchPlane: "XY",
              extrudeSide: "positive",
              depth: 3
            }
          },
          commandable: true,
          commandOperations: [
            "reference.nameGenerated",
            "feature.attachSketchPlane",
            "feature.measureReference",
            "feature.selectReference"
          ],
          label: "End cap",
          issues: []
        }
      ],
      issueCount: 0,
      issues: []
    };
    const blocked: CadQueryResponse = {
      ok: true,
      query: "selection.referenceCandidates",
      cadOpsVersion: "cadops.v1",
      selection: { type: "body", bodyId: "body_cut" },
      status: "ambiguous",
      candidateCount: 0,
      candidates: [],
      issueCount: 1,
      issues: [
        {
          code: "AMBIGUOUS_SELECTION_TOPOLOGY",
          status: "ambiguous",
          message:
            "Boolean result body body_cut is visible, but body-level modeling commands are not available. Select a command-ready result face or edge for sketching, naming, measuring, or inspecting.",
          bodyId: "body_cut",
          featureId: "feat_cut",
          expected: "authored rectangle/circle newBody extrude",
          received: "cut extrude result"
        }
      ]
    };

    expect(response).toMatchObject({
      ok: true,
      query: "selection.referenceCandidates",
      status: "resolved",
      candidates: [
        {
          commandable: true,
          commandOperations: expect.arrayContaining([
            "reference.nameGenerated",
            "feature.attachSketchPlane"
          ])
        }
      ]
    });
    expect(blocked).toMatchObject({
      ok: true,
      query: "selection.referenceCandidates",
      status: "ambiguous",
      issues: [{ code: "AMBIGUOUS_SELECTION_TOPOLOGY" }]
    });

    const topologyAnchor: CadQueryResponse = {
      ok: true,
      query: "selection.referenceCandidates",
      cadOpsVersion: "cadops.v1",
      selection: { type: "topologyAnchor", anchorId: "anchor_face_1" },
      requiredOperation: "feature.attachSketchPlane",
      status: "resolved",
      candidateCount: 1,
      candidates: [
        {
          source: "topologyAnchorSelection",
          target: {
            type: "generatedReference",
            bodyId: "body_1",
            stableId: "generated:face:body_1:endCap",
            kind: "face",
            topologyAnchorId: "anchor_face_1",
            checkpointId: "checkpoint_1"
          },
          reference: {
            kind: "face",
            stableId: "generated:face:body_1:endCap",
            label: "End cap",
            eligibleOperations: [
              "feature.attachSketchPlane",
              "feature.measureReference",
              "feature.selectReference"
            ],
            bodyId: "body_1",
            ownerPartId: "part:default",
            sourceFeatureId: "feat_1",
            sourceSketchId: "sketch_1",
            sourceSketchEntityId: "rect_1",
            role: "endCap",
            geometricSignature: {
              profileKind: "rectangle",
              sketchPlane: "XY",
              extrudeSide: "positive",
              depth: 3
            }
          },
          commandable: true,
          commandOperations: [
            "feature.attachSketchPlane",
            "feature.measureReference",
            "feature.selectReference"
          ],
          label: "End cap",
          issues: []
        }
      ],
      issueCount: 0,
      issues: []
    };

    expect(topologyAnchor).toMatchObject({
      ok: true,
      query: "selection.referenceCandidates",
      status: "resolved",
      candidates: [
        {
          source: "topologyAnchorSelection",
          target: expect.objectContaining({
            topologyAnchorId: "anchor_face_1",
            checkpointId: "checkpoint_1"
          })
        }
      ]
    });
  });

  it("types V14 topology command target readiness responses", () => {
    const response: CadQueryResponse = {
      ok: true,
      query: "topology.commandTargetReadiness",
      cadOpsVersion: "cadops.v1",
      target: { type: "topologyAnchor", anchorId: "anchor_face_1" },
      desiredOperation: "feature.attachSketchPlane",
      status: "needs-checkpoint-evidence",
      selectionStatus: "unsupported",
      commandable: false,
      promotionRequired: false,
      checkpointEvidenceRequired: true,
      repairRequired: false,
      supportedOperationCount: 0,
      supportedOperations: [],
      operationSummaryCount: 1,
      operationSummaries: [
        {
          operation: "feature.attachSketchPlane",
          status: "needs-checkpoint-evidence",
          commandable: false,
          source: "selection.referenceCandidates",
          requiresPromotion: false,
          requiresCheckpointEvidence: true,
          requiresRepair: false
        }
      ],
      candidateCount: 0,
      candidates: [],
      issueCount: 1,
      issues: [
        {
          code: "UNSUPPORTED_SELECTION_TARGET",
          status: "unsupported",
          message:
            "Topology anchor needs checkpoint evidence before it can drive the requested command.",
          topologyAnchorId: "anchor_face_1",
          expected: "checkpoint snapshot proof",
          received: "missing snapshot"
        }
      ],
      diagnosticCount: 1,
      diagnostics: [
        {
          code: "TOPOLOGY_COMMAND_ELIGIBILITY_DEFERRED",
          status: "deferred",
          severity: "warning",
          message: "Topology-backed command target needs checkpoint evidence.",
          anchorId: "anchor_face_1",
          expected: "feature.attachSketchPlane",
          received: "missing snapshot"
        }
      ],
      sourceBoundaryNote:
        "Topology-backed command target readiness is derived from authoritative cad-core state.",
      derivedBoundaryNote:
        "Private renderer, mesh, OCCT, checkpoint-local, and file-system ids are not public command targets.",
      mutatesSource: false,
      exposesCheckpointLocalIds: false,
      exposesPrivateIds: false,
      requiresProjectSchemaMigration: false,
      requiresPackageVersionMigration: false
    };

    expect(response).toMatchObject({
      ok: true,
      query: "topology.commandTargetReadiness",
      status: "needs-checkpoint-evidence",
      commandable: false,
      checkpointEvidenceRequired: true,
      operationSummaries: [
        expect.objectContaining({
          operation: "feature.attachSketchPlane",
          commandable: false
        })
      ],
      mutatesSource: false,
      exposesPrivateIds: false,
      requiresProjectSchemaMigration: false
    });
  });

  it("types the V9 viewport interaction contract without making private hit IDs public references", () => {
    const pointer: CadViewportPointerInputIntent = {
      kind: "click",
      point: { x: 240, y: 128, viewportWidth: 1024, viewportHeight: 768 },
      device: "mouse",
      button: "primary",
      modifiers: ["shift"],
      timestampMs: 10
    };
    const semanticHint = {
      type: "generatedReference",
      bodyId: "body_1",
      stableId: "generated:face:body_1:endCap",
      expectedKind: "face"
    } as const;
    const hitCandidate: CadViewportHitCandidate = {
      displayEntityKind: "face",
      rendererHitId: "renderer-hit:face:17",
      selectionBufferHitId: "selection-buffer:color:001122",
      precision: "displayApproximation",
      depth: 0.25,
      semanticHint
    };
    const selectionIntent: CadViewportSelectionIntent = {
      source: "viewport",
      pointer,
      hitCandidate,
      selection: semanticHint,
      requiredOperation: "feature.attachSketchPlane",
      additive: false
    };
    const commandTarget: CadViewportCommandTargetSummary = {
      selection: semanticHint,
      status: "resolved",
      commandable: true,
      target: {
        type: "generatedReference",
        bodyId: "body_1",
        stableId: "generated:face:body_1:endCap",
        kind: "face"
      },
      label: "End cap",
      commandOperations: [
        "feature.attachSketchPlane",
        "feature.measureReference",
        "feature.selectReference"
      ],
      diagnostics: []
    };
    const hover: CadViewportHoverState = {
      status: "resolved",
      hitCandidate,
      selection: semanticHint,
      commandTarget,
      diagnostics: []
    };
    const selectionState: CadViewportSelectionState = {
      status: "resolved",
      selection: semanticHint,
      commandTarget,
      diagnostics: []
    };
    const measurementTarget: CadViewportMeasurementTarget = {
      selection: semanticHint,
      authority: "semanticDocument",
      status: "resolved",
      diagnostics: []
    };
    const inspectTarget: CadViewportSingleTargetMeasureInspectTarget = {
      targetKind: "generatedPlanarFace",
      selection: semanticHint,
      authority: "sourceAnalytic",
      status: "resolved",
      label: "End cap",
      bodyId: "body_1",
      stableId: "generated:face:body_1:endCap",
      diagnostics: []
    };
    const unsupportedInspectTarget: CadViewportSingleTargetMeasureInspectTarget =
      {
        targetKind: "unsupportedGeneratedReference",
        authority: "unsupported",
        status: "unsupported",
        diagnostics: []
      };

    expect(selectionIntent.hitCandidate?.rendererHitId).toBe(
      "renderer-hit:face:17"
    );
    expect(hover.status).toBe("resolved");
    expect(selectionState.commandTarget?.commandable).toBe(true);
    expect(measurementTarget.authority).toBe("semanticDocument");
    expect(inspectTarget.targetKind).toBe("generatedPlanarFace");
    expect(unsupportedInspectTarget.targetKind).toBe(
      "unsupportedGeneratedReference"
    );

    const publicCommandTargetJson = JSON.stringify([
      commandTarget,
      inspectTarget,
      unsupportedInspectTarget
    ]);

    expect(publicCommandTargetJson).toContain("generated:face:body_1:endCap");
    expect(publicCommandTargetJson).not.toContain("renderer-hit");
    expect(publicCommandTargetJson).not.toContain("selection-buffer");
    expect(publicCommandTargetJson).not.toContain("mesh");
    expect(publicCommandTargetJson).not.toContain("occt");
    expect(publicCommandTargetJson).not.toContain("gpu");
    expect(publicCommandTargetJson).not.toContain("pixel");
    expect(publicCommandTargetJson).not.toContain("opfs");
    expect(publicCommandTargetJson).not.toContain("fileHandle");
  });

  it("reserves future assembly context as private viewport candidate context", () => {
    const hitCandidate: CadViewportHitCandidate = {
      displayEntityKind: "body",
      rendererHitId: "renderer-hit:body:1",
      instancePath: ["assembly-root", "instance-1"],
      assemblyPath: ["assembly-root"],
      semanticHint: { type: "body", bodyId: "body_1" }
    };

    expect(hitCandidate.instancePath).toEqual(["assembly-root", "instance-1"]);
    expect(hitCandidate.semanticHint).toEqual({
      type: "body",
      bodyId: "body_1"
    });
  });
});

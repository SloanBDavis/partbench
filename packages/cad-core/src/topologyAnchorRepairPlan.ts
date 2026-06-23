import type {
  CadBatch,
  CadBodyDerivedExactMetadataSnapshot,
  CadBodyExactTopologyEntityDescriptor,
  CadOpsVersion,
  CadOp,
  CadQueryError,
  CadTopologyIdentityDiagnostic,
  CadTopologyIdentitySourceSnapshot,
  CadTopologyMatchConfidence,
  CadTopologyMatchEvidence,
  CadTopologyRepairCandidate,
  DocumentUnits,
  TopologyAnchorRepairOp,
  TopologyAnchorRepairPlanQueryResponse,
  TopologyCheckpointCreateOp
} from "@web-cad/cad-protocol";
import { WCAD_SOURCE_IDENTITY_ALGORITHM } from "@web-cad/cad-protocol";

import { sha256Hex } from "./sha256";

export interface CreateTopologyAnchorRepairPlanOptions {
  readonly cadOpsVersion: CadOpsVersion;
  readonly document: {
    readonly units: DocumentUnits;
    readonly topologyIdentity?: CadTopologyIdentitySourceSnapshot;
  };
  readonly anchorId: string;
  readonly replacementCheckpointId?: string;
  readonly createReplacementCheckpoint?: boolean;
  readonly derivedExactMetadata: CadBodyDerivedExactMetadataSnapshot;
  readonly repairId?: string;
}

export type TopologyAnchorRepairPlanResult =
  | {
      readonly ok: true;
      readonly response: TopologyAnchorRepairPlanQueryResponse;
    }
  | {
      readonly ok: false;
      readonly error: CadQueryError;
    };

const SOURCE_BOUNDARY_NOTE =
  "Topology anchor repair plans are derived from authoritative topology source records and caller-supplied exact topology checkpoint evidence; callers must commit the proposed CADOps through the command layer.";
const DERIVED_BOUNDARY_NOTE =
  "Derived exact topology snapshot local ids are only checkpoint evidence used inside proposed source commands; renderer, mesh, OCCT, GPU, selection-buffer, OPFS, file-handle, viewport, and export artifact identifiers are excluded from public topology anchor repair planning.";

export function createTopologyAnchorRepairPlan(
  options: CreateTopologyAnchorRepairPlanOptions
): TopologyAnchorRepairPlanResult {
  const topologyIdentity = options.document.topologyIdentity;
  const anchor = topologyIdentity?.anchors.find(
    (candidate) => candidate.anchorId === options.anchorId
  );
  const diagnostics: CadTopologyIdentityDiagnostic[] = [];

  if (!topologyIdentity || !anchor) {
    diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "warning",
        `Topology anchor ${options.anchorId} does not exist.`,
        {
          anchorId: options.anchorId,
          expected: "existing topology anchor source record",
          received: options.anchorId
        }
      )
    );
    return createResponse(options, {
      status: "missing",
      diagnostics
    });
  }

  diagnostics.push(...anchor.diagnostics);

  if (anchor.state !== "active") {
    diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_REPAIR_COMMANDS_DEFERRED",
        "warning",
        `Topology anchor ${anchor.anchorId} is ${anchor.state}; repair planning currently requires an active anchor.`,
        {
          bodyId: anchor.bodyId,
          anchorId: anchor.anchorId,
          expected: "active topology anchor",
          received: anchor.state
        }
      )
    );
    return createResponse(options, {
      status: "unsupported",
      anchor,
      diagnostics
    });
  }

  const replacementCheckpointId =
    options.replacementCheckpointId ??
    createPlannedReplacementCheckpointId({
      anchorId: anchor.anchorId,
      bodyId: anchor.bodyId,
      sourceIdentitySignature:
        options.derivedExactMetadata.sourceIdentitySignature
    });
  const replacementCheckpoint = topologyIdentity.checkpoints.find(
    (checkpoint) => checkpoint.checkpointId === replacementCheckpointId
  );
  const createsReplacementCheckpoint =
    !replacementCheckpoint && options.createReplacementCheckpoint === true;

  if (!replacementCheckpoint && !createsReplacementCheckpoint) {
    diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "warning",
        `Replacement topology checkpoint ${replacementCheckpointId} does not exist.`,
        {
          bodyId: anchor.bodyId,
          anchorId: anchor.anchorId,
          checkpointId: replacementCheckpointId,
          expected: "existing replacement checkpoint",
          received: replacementCheckpointId
        }
      )
    );
    return createResponse(options, {
      status: "missing",
      anchor,
      diagnostics
    });
  }

  if (replacementCheckpoint) {
    diagnostics.push(...replacementCheckpoint.diagnostics);
  }

  if (replacementCheckpoint && replacementCheckpoint.status !== "active") {
    diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_REPAIR_COMMANDS_DEFERRED",
        "warning",
        `Replacement topology checkpoint ${replacementCheckpoint.checkpointId} is ${replacementCheckpoint.status}.`,
        {
          bodyId: anchor.bodyId,
          anchorId: anchor.anchorId,
          checkpointId: replacementCheckpoint.checkpointId,
          expected: "active replacement checkpoint",
          received: replacementCheckpoint.status
        }
      )
    );
    return createResponse(options, {
      status: "unsupported",
      anchor,
      diagnostics
    });
  }

  if (replacementCheckpoint && replacementCheckpoint.bodyId !== anchor.bodyId) {
    diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        `Replacement topology checkpoint ${replacementCheckpoint.checkpointId} belongs to ${replacementCheckpoint.bodyId}, not ${anchor.bodyId}.`,
        {
          bodyId: anchor.bodyId,
          anchorId: anchor.anchorId,
          checkpointId: replacementCheckpoint.checkpointId,
          expected: anchor.bodyId,
          received: replacementCheckpoint.bodyId
        }
      )
    );
    return createResponse(options, {
      status: "unsupported",
      anchor,
      diagnostics
    });
  }

  const topologySnapshot =
    options.derivedExactMetadata.metadata?.topologySnapshot;

  if (
    options.derivedExactMetadata.bodyId !== anchor.bodyId ||
    options.derivedExactMetadata.status !== "ready" ||
    !topologySnapshot ||
    (topologySnapshot.status !== "ready" &&
      topologySnapshot.status !== "partial")
  ) {
    diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_SNAPSHOT_EXTRACTION_DEFERRED",
        "warning",
        `Replacement topology checkpoint ${replacementCheckpointId} does not have ready exact topology snapshot evidence.`,
        {
          bodyId: anchor.bodyId,
          anchorId: anchor.anchorId,
          checkpointId: replacementCheckpointId,
          expected: "ready or partial exact topology snapshot for anchor body",
          received:
            topologySnapshot?.status ?? options.derivedExactMetadata.status
        }
      )
    );
    return createResponse(options, {
      status: "missing",
      anchor,
      diagnostics
    });
  }

  const replacementEntity = findReplacementEntity({
    anchor,
    replacementCheckpointId,
    entities: topologySnapshot.entities,
    diagnostics
  });

  if (replacementEntity.status !== "ready") {
    return createResponse(options, {
      status: replacementEntity.status,
      anchor,
      replacementCheckpointId,
      candidates: replacementEntity.candidates,
      diagnostics
    });
  }

  if (
    anchor.checkpointId === replacementCheckpointId &&
    anchor.checkpointEntityId === replacementEntity.entity.localId
  ) {
    diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_REPAIR_COMMANDS_READY",
        "info",
        `Topology anchor ${anchor.anchorId} already points at ${replacementCheckpointId}.`,
        {
          bodyId: anchor.bodyId,
          anchorId: anchor.anchorId,
          checkpointId: replacementCheckpointId,
          received: replacementEntity.entity.localId
        }
      )
    );
    return createResponse(options, {
      status: "alreadyCurrent",
      anchor,
      replacementCheckpointId,
      replacementCheckpointEntityId: replacementEntity.entity.localId,
      confidence: "exact",
      evidence: replacementEntity.evidence,
      candidates: replacementEntity.candidates,
      diagnostics
    });
  }

  const repairId =
    options.repairId ??
    createPlannedRepairId({
      anchorId: anchor.anchorId,
      replacementCheckpointId,
      replacementCheckpointEntityId: replacementEntity.entity.localId
    });
  const checkpointOp: TopologyCheckpointCreateOp | undefined =
    createsReplacementCheckpoint
      ? {
          op: "topology.checkpoint.create",
          checkpointId: replacementCheckpointId,
          bodyId: anchor.bodyId,
          ...(anchor.sourceFeatureId
            ? { sourceFeatureId: anchor.sourceFeatureId }
            : {}),
          sourceIdentity: createPlannedReplacementCheckpointSourceIdentity({
            anchorId: anchor.anchorId,
            bodyId: anchor.bodyId,
            replacementCheckpointId,
            sourceIdentitySignature:
              options.derivedExactMetadata.sourceIdentitySignature,
            topologySnapshotSignature: topologySnapshot.signature
          }),
          status: "active",
          diagnostics: [
            createDiagnostic(
              "TOPOLOGY_CHECKPOINT_PERSISTENCE_READY",
              "info",
              `Replacement topology checkpoint source record can be created for ${anchor.bodyId}.`,
              {
                bodyId: anchor.bodyId,
                anchorId: anchor.anchorId,
                checkpointId: replacementCheckpointId
              }
            )
          ]
        }
      : undefined;
  const repairOp: TopologyAnchorRepairOp = {
    op: "topology.anchor.repair",
    repairId,
    anchorId: anchor.anchorId,
    replacementCheckpointId,
    replacementCheckpointEntityId: replacementEntity.entity.localId,
    confidence: replacementEntity.confidence,
    evidence: replacementEntity.evidence
  };

  diagnostics.push(
    createDiagnostic(
      "TOPOLOGY_REPAIR_COMMANDS_READY",
      "info",
      `Topology anchor ${anchor.anchorId} can be repaired to ${replacementCheckpointId}.`,
      {
        bodyId: anchor.bodyId,
        anchorId: anchor.anchorId,
        checkpointId: replacementCheckpointId,
        received: replacementEntity.entity.localId
      }
    )
  );

  return createResponse(options, {
    status: "ready",
    anchor,
    replacementCheckpointEntityId: replacementEntity.entity.localId,
    repairId,
    confidence: replacementEntity.confidence,
    evidence: replacementEntity.evidence,
    candidates: replacementEntity.candidates,
    replacementCheckpointId,
    ops: checkpointOp ? [checkpointOp, repairOp] : [repairOp],
    diagnostics
  });
}

function findReplacementEntity(input: {
  readonly anchor: CadTopologyIdentitySourceSnapshot["anchors"][number];
  readonly replacementCheckpointId: string;
  readonly entities: readonly CadBodyExactTopologyEntityDescriptor[];
  readonly diagnostics: CadTopologyIdentityDiagnostic[];
}):
  | {
      readonly status: "ready";
      readonly entity: CadBodyExactTopologyEntityDescriptor;
      readonly confidence: "exact" | "high";
      readonly evidence: readonly CadTopologyMatchEvidence[];
      readonly candidates: readonly CadTopologyRepairCandidate[];
    }
  | {
      readonly status: "missing" | "unsupported" | "ambiguous";
      readonly candidates: readonly CadTopologyRepairCandidate[];
    } {
  const sameKind = input.entities.filter(
    (entity) => entity.kind === input.anchor.entityKind
  );

  if (sameKind.length === 0) {
    input.diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_MATCH_UNSUPPORTED",
        "warning",
        `No ${input.anchor.entityKind} replacement entity exists for topology anchor ${input.anchor.anchorId}.`,
        {
          bodyId: input.anchor.bodyId,
          anchorId: input.anchor.anchorId,
          entityKind: input.anchor.entityKind,
          expected: input.anchor.entityKind,
          received: "missing"
        }
      )
    );
    return { status: "missing", candidates: [] };
  }

  const signatureMatches = input.anchor.signatureHash
    ? sameKind.filter(
        (entity) => entity.signature === input.anchor.signatureHash
      )
    : [];

  if (signatureMatches.length === 1) {
    return {
      status: "ready",
      entity: signatureMatches[0]!,
      confidence: "exact",
      evidence: [
        {
          kind: "geometrySignature",
          confidence: "exact",
          message:
            "Replacement checkpoint entity matches the existing topology anchor signature.",
          previousValue: input.anchor.signatureHash,
          candidateValue: signatureMatches[0]!.signature
        }
      ],
      candidates: [
        createRepairCandidate({
          anchor: input.anchor,
          replacementCheckpointId: input.replacementCheckpointId,
          entity: signatureMatches[0]!,
          state: "replaced",
          confidence: "exact",
          evidence: [
            {
              kind: "geometrySignature",
              confidence: "exact",
              message:
                "Replacement checkpoint entity matches the existing topology anchor signature.",
              previousValue: input.anchor.signatureHash,
              candidateValue: signatureMatches[0]!.signature
            }
          ]
        })
      ]
    };
  }

  if (signatureMatches.length > 1) {
    input.diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_MATCH_AMBIGUOUS",
        "warning",
        `Multiple ${input.anchor.entityKind} replacement entities match topology anchor ${input.anchor.anchorId}.`,
        {
          bodyId: input.anchor.bodyId,
          anchorId: input.anchor.anchorId,
          entityKind: input.anchor.entityKind,
          expected: "one replacement entity",
          received: String(signatureMatches.length)
        }
      )
    );
    return {
      status: "ambiguous",
      candidates: signatureMatches.map((entity) =>
        createRepairCandidate({
          anchor: input.anchor,
          replacementCheckpointId: input.replacementCheckpointId,
          entity,
          state: "ambiguous",
          confidence: "exact",
          evidence: [
            {
              kind: "geometrySignature",
              confidence: "exact",
              message:
                "Replacement checkpoint entity matches the existing topology anchor signature, but the match is not unique.",
              previousValue: input.anchor.signatureHash,
              candidateValue: entity.signature
            }
          ],
          diagnostics: [
            createDiagnostic(
              "TOPOLOGY_MATCH_AMBIGUOUS",
              "warning",
              "Multiple exact replacement candidates require explicit user choice.",
              {
                bodyId: input.anchor.bodyId,
                anchorId: input.anchor.anchorId,
                checkpointId: input.anchor.checkpointId,
                entityKind: input.anchor.entityKind
              }
            )
          ]
        })
      )
    };
  }

  const semanticMatches =
    input.anchor.stableId || input.anchor.sourceSemanticRole
      ? sameKind.filter(
          (entity) =>
            (input.anchor.stableId &&
              entity.signature.includes(input.anchor.stableId)) ||
            (input.anchor.sourceSemanticRole &&
              entity.signature.includes(input.anchor.sourceSemanticRole))
        )
      : [];

  if (semanticMatches.length === 1) {
    const evidence: CadTopologyMatchEvidence[] = [];

    if (input.anchor.stableId) {
      evidence.push({
        kind: "sourceLineage",
        confidence: "high",
        message:
          "Replacement checkpoint entity signature carries the existing generated reference stable id.",
        previousValue: input.anchor.stableId,
        candidateValue: semanticMatches[0]!.signature
      });
    }

    if (input.anchor.sourceSemanticRole) {
      evidence.push({
        kind: "sourceSemanticRole",
        confidence: "high",
        message:
          "Replacement checkpoint entity signature carries the existing source semantic role.",
        previousValue: input.anchor.sourceSemanticRole,
        candidateValue: semanticMatches[0]!.signature
      });
    }

    return {
      status: "ready",
      entity: semanticMatches[0]!,
      confidence: "high",
      evidence,
      candidates: [
        createRepairCandidate({
          anchor: input.anchor,
          replacementCheckpointId: input.replacementCheckpointId,
          entity: semanticMatches[0]!,
          state: "replaced",
          confidence: "high",
          evidence
        })
      ]
    };
  }

  if (semanticMatches.length > 1) {
    input.diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_MATCH_AMBIGUOUS",
        "warning",
        `Multiple semantic replacement entities match topology anchor ${input.anchor.anchorId}.`,
        {
          bodyId: input.anchor.bodyId,
          anchorId: input.anchor.anchorId,
          entityKind: input.anchor.entityKind,
          expected: "one semantic replacement entity",
          received: String(semanticMatches.length)
        }
      )
    );
    return {
      status: "ambiguous",
      candidates: semanticMatches.map((entity) =>
        createRepairCandidate({
          anchor: input.anchor,
          replacementCheckpointId: input.replacementCheckpointId,
          entity,
          state: "ambiguous",
          confidence: "high",
          evidence: createSemanticRepairEvidence(input.anchor, entity),
          diagnostics: [
            createDiagnostic(
              "TOPOLOGY_MATCH_AMBIGUOUS",
              "warning",
              "Multiple semantic replacement candidates require explicit user choice.",
              {
                bodyId: input.anchor.bodyId,
                anchorId: input.anchor.anchorId,
                checkpointId: input.anchor.checkpointId,
                entityKind: input.anchor.entityKind
              }
            )
          ]
        })
      )
    };
  }

  input.diagnostics.push(
    createDiagnostic(
      "TOPOLOGY_MATCH_LOW_CONFIDENCE",
      "warning",
      `No high-confidence replacement entity matches topology anchor ${input.anchor.anchorId}.`,
      {
        bodyId: input.anchor.bodyId,
        anchorId: input.anchor.anchorId,
        entityKind: input.anchor.entityKind,
        expected: "matching signature or source semantic evidence",
        received: "none"
      }
    )
  );

  return {
    status: "missing",
    candidates: sameKind.map((entity) =>
      createRepairCandidate({
        anchor: input.anchor,
        replacementCheckpointId: input.replacementCheckpointId,
        entity,
        state: "repair-needed",
        confidence: "low",
        evidence: [
          {
            kind: "entityKind",
            confidence: "medium",
            message:
              "Replacement checkpoint entity has the same topology kind but no high-confidence signature or semantic match.",
            previousValue: input.anchor.entityKind,
            candidateValue: entity.kind
          }
        ],
        diagnostics: [
          createDiagnostic(
            "TOPOLOGY_MATCH_LOW_CONFIDENCE",
            "warning",
            "Low-confidence repair candidate requires explicit review before retargeting.",
            {
              bodyId: input.anchor.bodyId,
              anchorId: input.anchor.anchorId,
              checkpointId: input.anchor.checkpointId,
              entityKind: input.anchor.entityKind
            }
          )
        ]
      })
    )
  };
}

function createRepairCandidate({
  anchor,
  replacementCheckpointId,
  entity,
  state,
  confidence,
  evidence,
  diagnostics = []
}: {
  readonly anchor: CadTopologyIdentitySourceSnapshot["anchors"][number];
  readonly replacementCheckpointId: string;
  readonly entity: CadBodyExactTopologyEntityDescriptor;
  readonly state: CadTopologyRepairCandidate["state"];
  readonly confidence: CadTopologyMatchConfidence;
  readonly evidence: readonly CadTopologyMatchEvidence[];
  readonly diagnostics?: readonly CadTopologyIdentityDiagnostic[];
}): CadTopologyRepairCandidate {
  return {
    candidateId: createRepairCandidateId({
      anchorId: anchor.anchorId,
      replacementCheckpointId,
      replacementCheckpointEntityId: entity.localId,
      state
    }),
    anchorId: anchor.anchorId,
    target: {
      type: "topologyAnchor",
      anchorId: anchor.anchorId
    },
    ...(anchor.checkpointEntityId
      ? {
          previousCheckpointEvidence: {
            checkpointId: anchor.checkpointId,
            checkpointEntityId: anchor.checkpointEntityId,
            idScope: "checkpoint-local",
            publicStableId: false
          } as const
        }
      : {}),
    candidateCheckpointEvidence: {
      checkpointId: replacementCheckpointId,
      checkpointEntityId: entity.localId,
      idScope: "checkpoint-local",
      publicStableId: false
    },
    entityKind: anchor.entityKind,
    state,
    confidence,
    canAutoRetarget: false,
    recommendedAction: "manual-repair-plan",
    evidence,
    diagnostics
  };
}

function createRepairCandidateId(input: {
  readonly anchorId: string;
  readonly replacementCheckpointId: string;
  readonly replacementCheckpointEntityId: string;
  readonly state: CadTopologyRepairCandidate["state"];
}): string {
  const hashSegment = sha256Hex(
    new TextEncoder().encode(
      [
        "topology-repair-candidate",
        input.anchorId,
        input.replacementCheckpointId,
        input.replacementCheckpointEntityId,
        input.state
      ].join(":")
    )
  ).slice(0, 16);

  return `topology_repair_candidate_${hashSegment}`;
}

function createSemanticRepairEvidence(
  anchor: CadTopologyIdentitySourceSnapshot["anchors"][number],
  entity: CadBodyExactTopologyEntityDescriptor
): readonly CadTopologyMatchEvidence[] {
  const evidence: CadTopologyMatchEvidence[] = [];

  if (anchor.stableId && entity.signature.includes(anchor.stableId)) {
    evidence.push({
      kind: "sourceLineage",
      confidence: "high",
      message:
        "Replacement checkpoint entity signature carries the existing generated reference stable id.",
      previousValue: anchor.stableId,
      candidateValue: entity.signature
    });
  }

  if (
    anchor.sourceSemanticRole &&
    entity.signature.includes(anchor.sourceSemanticRole)
  ) {
    evidence.push({
      kind: "sourceSemanticRole",
      confidence: "high",
      message:
        "Replacement checkpoint entity signature carries the existing source semantic role.",
      previousValue: anchor.sourceSemanticRole,
      candidateValue: entity.signature
    });
  }

  return evidence;
}

function createResponse(
  options: CreateTopologyAnchorRepairPlanOptions,
  input: {
    readonly status: TopologyAnchorRepairPlanQueryResponse["status"];
    readonly anchor?: CadTopologyIdentitySourceSnapshot["anchors"][number];
    readonly replacementCheckpointId?: string;
    readonly replacementCheckpointEntityId?: string;
    readonly repairId?: string;
    readonly confidence?: TopologyAnchorRepairPlanQueryResponse["confidence"];
    readonly evidence?: readonly CadTopologyMatchEvidence[];
    readonly candidates?: readonly CadTopologyRepairCandidate[];
    readonly ops?: readonly CadOp[];
    readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
  }
): TopologyAnchorRepairPlanResult {
  const ops = input.ops ?? [];
  const proposedBatch: CadBatch = {
    version: options.cadOpsVersion,
    mode: "commit",
    ops
  };

  return {
    ok: true,
    response: {
      ok: true,
      query: "topology.anchorRepairPlan",
      cadOpsVersion: options.cadOpsVersion,
      status: input.status,
      anchorId: options.anchorId,
      ...(input.anchor?.bodyId ? { bodyId: input.anchor.bodyId } : {}),
      ...(input.anchor?.entityKind
        ? { entityKind: input.anchor.entityKind }
        : {}),
      ...(input.anchor?.checkpointId
        ? { previousCheckpointId: input.anchor.checkpointId }
        : {}),
      ...(input.anchor?.checkpointEntityId
        ? { previousCheckpointEntityId: input.anchor.checkpointEntityId }
        : {}),
      ...((input.replacementCheckpointId ?? options.replacementCheckpointId)
        ? {
            replacementCheckpointId:
              input.replacementCheckpointId ?? options.replacementCheckpointId
          }
        : {}),
      ...(input.replacementCheckpointEntityId
        ? { replacementCheckpointEntityId: input.replacementCheckpointEntityId }
        : {}),
      ...(input.repairId ? { repairId: input.repairId } : {}),
      confidence: input.confidence ?? "none",
      evidence: input.evidence ?? [],
      repairCandidateCount: input.candidates?.length ?? 0,
      repairCandidates: input.candidates ?? [],
      createsCheckpoint: ops.some(
        (op) => op.op === "topology.checkpoint.create"
      ),
      createsRepair: ops.some((op) => op.op === "topology.anchor.repair"),
      opCount: ops.length,
      ops,
      proposedBatch,
      diagnosticCount: input.diagnostics.length,
      diagnostics: input.diagnostics,
      sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
      derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
      mutatesSource: false
    }
  };
}

function createPlannedReplacementCheckpointId(input: {
  readonly anchorId: string;
  readonly bodyId: string;
  readonly sourceIdentitySignature: string;
}): string {
  const bodySegment = sanitizeIdSegment(input.bodyId);
  const anchorSegment = sanitizeIdSegment(input.anchorId);
  const hashSegment = sha256Hex(
    new TextEncoder().encode(
      `repair-checkpoint:${input.bodyId}:${input.anchorId}:${input.sourceIdentitySignature}`
    )
  ).slice(0, 16);

  return `topology_checkpoint_repair_${bodySegment}_${anchorSegment}_${hashSegment}`;
}

function createPlannedReplacementCheckpointSourceIdentity(input: {
  readonly anchorId: string;
  readonly bodyId: string;
  readonly replacementCheckpointId: string;
  readonly sourceIdentitySignature: string;
  readonly topologySnapshotSignature: string;
}) {
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      contract: "partbench.v13.topology-anchor-repair-plan",
      anchorId: input.anchorId,
      bodyId: input.bodyId,
      replacementCheckpointId: input.replacementCheckpointId,
      sourceIdentitySignature: input.sourceIdentitySignature,
      topologySnapshotSignature: input.topologySnapshotSignature
    })
  );

  return {
    algorithm: WCAD_SOURCE_IDENTITY_ALGORITHM,
    sha256: sha256Hex(bytes)
  };
}

function createPlannedRepairId(input: {
  readonly anchorId: string;
  readonly replacementCheckpointId: string;
  readonly replacementCheckpointEntityId: string;
}): string {
  const anchorSegment = sanitizeIdSegment(input.anchorId);
  const hashSegment = sha256Hex(
    new TextEncoder().encode(
      `repair:${input.anchorId}:${input.replacementCheckpointId}:${input.replacementCheckpointEntityId}`
    )
  ).slice(0, 16);

  return `topology_repair_${anchorSegment}_${hashSegment}`;
}

function sanitizeIdSegment(value: string): string {
  const sanitized = value
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return sanitized.length > 0 ? sanitized : "anchor";
}

function createDiagnostic(
  code: CadTopologyIdentityDiagnostic["code"],
  severity: CadTopologyIdentityDiagnostic["severity"],
  message: string,
  details: Pick<
    CadTopologyIdentityDiagnostic,
    | "bodyId"
    | "entityKind"
    | "checkpointId"
    | "anchorId"
    | "expected"
    | "received"
  > = {}
): CadTopologyIdentityDiagnostic {
  return {
    code,
    status: severity === "error" ? "unavailable" : "supported",
    severity,
    message,
    ...details
  };
}

import {
  WCAD_SOURCE_IDENTITY_ALGORITHM,
  type BodyId,
  type CadBatch,
  type CadBodyDerivedExactMetadataSnapshot,
  type CadOpsVersion,
  type CadOp,
  type CadQueryError,
  type CadTopologyAnchorEntityKind,
  type CadTopologyGeneratedReferenceCandidate,
  type CadTopologyIdentityDiagnostic,
  type CadTopologyIdentitySourceSnapshot,
  type DocumentUnits,
  type FeatureId,
  type PartId,
  type TopologyAnchorCreateOp,
  type TopologyAnchorCreationPlanQueryResponse,
  type TopologyCheckpointCreateOp
} from "@web-cad/cad-protocol";

import { createBodyTopologyIdentity } from "./bodyTopologyIdentity";
import type { GeneratedReferencesDocument } from "./generatedReferences";
import { sha256Hex } from "./sha256";

export interface CreateTopologyAnchorCreationPlanOptions {
  readonly cadOpsVersion: CadOpsVersion;
  readonly document: GeneratedReferencesDocument & {
    readonly topologyIdentity?: CadTopologyIdentitySourceSnapshot;
  };
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly units: DocumentUnits;
  readonly ownerPartId: PartId;
  readonly bodyExists: (bodyId: BodyId) => boolean;
  readonly checkpointId?: string;
  readonly anchorId?: string;
  readonly derivedExactMetadata?: CadBodyDerivedExactMetadataSnapshot;
}

export type TopologyAnchorCreationPlanResult =
  | {
      readonly ok: true;
      readonly response: TopologyAnchorCreationPlanQueryResponse;
    }
  | {
      readonly ok: false;
      readonly error: CadQueryError;
    };

const SOURCE_BOUNDARY_NOTE =
  "Topology anchor creation plans are derived from authoritative document source, generated-reference semantics, and existing topology identity source records; callers must commit the proposed CADOps through the command layer.";
const DERIVED_BOUNDARY_NOTE =
  "Derived exact topology snapshot local ids are only checkpoint evidence used inside proposed source commands; renderer, mesh, OCCT, GPU, selection-buffer, OPFS, file-handle, viewport, and export artifact identifiers are excluded from public topology anchor planning.";

export function createTopologyAnchorCreationPlan(
  options: CreateTopologyAnchorCreationPlanOptions
): TopologyAnchorCreationPlanResult {
  const requestedCheckpoint =
    options.checkpointId && options.document.topologyIdentity
      ? options.document.topologyIdentity.checkpoints.find(
          (checkpoint) => checkpoint.checkpointId === options.checkpointId
        )
      : undefined;
  const topologyIdentity = createBodyTopologyIdentity({
    cadOpsVersion: options.cadOpsVersion,
    document: options.document,
    bodyId: options.bodyId,
    units: options.units,
    ownerPartId: options.ownerPartId,
    bodyExists: options.bodyExists,
    ...(requestedCheckpoint
      ? { checkpointId: requestedCheckpoint.checkpointId }
      : {}),
    derivedExactMetadata: options.derivedExactMetadata
  });

  if (!topologyIdentity.ok) {
    return topologyIdentity;
  }

  const candidate = topologyIdentity.response.candidates.find(
    (entry) => entry.stableId === options.stableId
  );
  const diagnostics: CadTopologyIdentityDiagnostic[] = [
    ...topologyIdentity.response.diagnostics
  ];

  if (!candidate) {
    diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_MATCH_LOW_CONFIDENCE",
        "warning",
        `No generated reference candidate exists for ${options.stableId}.`,
        {
          bodyId: options.bodyId,
          expected: "known generated reference stable id",
          received: options.stableId
        }
      )
    );
    return createResponse(options, {
      status: "missing",
      diagnostics
    });
  }

  diagnostics.push(...candidate.diagnostics);

  if (!isSupportedAnchorKind(candidate.kind)) {
    diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_MATCH_UNSUPPORTED",
        "warning",
        `Generated reference ${candidate.stableId} is a ${candidate.kind}; V13 anchor creation planning currently supports body, face, and edge references.`,
        {
          bodyId: options.bodyId,
          entityKind: candidate.kind,
          expected: "body, face, or edge generated reference",
          received: candidate.kind
        }
      )
    );
    return createResponse(options, {
      status: "unsupported",
      candidate,
      diagnostics
    });
  }

  const existingAnchor = findExistingAnchor({
    topologyIdentity: options.document.topologyIdentity,
    bodyId: options.bodyId,
    stableId: options.stableId,
    anchorId: options.anchorId
  });

  if (existingAnchor) {
    diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_ANCHOR_PERSISTENCE_READY",
        "info",
        `Topology anchor source record already exists for ${options.stableId}.`,
        {
          bodyId: options.bodyId,
          anchorId: existingAnchor.anchorId,
          checkpointId: existingAnchor.checkpointId,
          received: options.stableId
        }
      )
    );
    return createResponse(options, {
      status: "alreadyExists",
      candidate,
      checkpointId: existingAnchor.checkpointId,
      anchorId: existingAnchor.anchorId,
      diagnostics
    });
  }

  if (candidate.status !== "bound" || !candidate.checkpointEntityId) {
    return createResponse(options, {
      status: mapCandidateStatus(candidate),
      candidate,
      diagnostics
    });
  }

  const checkpoint = findReusableCheckpoint({
    topologyIdentity: options.document.topologyIdentity,
    checkpointId: options.checkpointId,
    bodyId: options.bodyId,
    sourceFeatureId: candidate.sourceFeatureId
  });

  if (checkpoint && checkpoint.bodyId !== options.bodyId) {
    diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        `Topology checkpoint ${checkpoint.checkpointId} belongs to ${checkpoint.bodyId}, not ${options.bodyId}.`,
        {
          bodyId: options.bodyId,
          checkpointId: checkpoint.checkpointId,
          expected: options.bodyId,
          received: checkpoint.bodyId
        }
      )
    );
    return createResponse(options, {
      status: "unsupported",
      candidate,
      diagnostics
    });
  }

  const checkpointId =
    checkpoint?.checkpointId ??
    options.checkpointId ??
    createPlannedId("checkpoint", options.bodyId, options.stableId);
  const anchorId =
    options.anchorId ??
    createPlannedId("anchor", options.bodyId, options.stableId);
  const checkpointConflict =
    !checkpoint &&
    options.document.topologyIdentity?.checkpoints.find(
      (entry) => entry.checkpointId === checkpointId
    );

  if (checkpointConflict) {
    diagnostics.push(
      createDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        `Planned topology checkpoint id ${checkpointId} already exists for ${checkpointConflict.bodyId}.`,
        {
          bodyId: options.bodyId,
          checkpointId,
          expected: "available checkpoint id",
          received: checkpointId
        }
      )
    );
    return createResponse(options, {
      status: "unsupported",
      candidate,
      diagnostics
    });
  }

  const ops: CadOp[] = [];

  if (!checkpoint) {
    const checkpointOp: TopologyCheckpointCreateOp = {
      op: "topology.checkpoint.create",
      checkpointId,
      bodyId: options.bodyId,
      ...(candidate.sourceFeatureId
        ? { sourceFeatureId: candidate.sourceFeatureId }
        : {}),
      sourceIdentity: createPlannedCheckpointSourceIdentity({
        bodyId: options.bodyId,
        stableId: options.stableId,
        units: options.units,
        candidate
      }),
      status: "active",
      diagnostics: [
        createDiagnostic(
          "TOPOLOGY_CHECKPOINT_PERSISTENCE_READY",
          "info",
          `Topology checkpoint source record can be created for ${options.bodyId}.`,
          {
            bodyId: options.bodyId,
            checkpointId
          }
        )
      ]
    };
    ops.push(checkpointOp);
  }

  const anchorOp: TopologyAnchorCreateOp = {
    op: "topology.anchor.create",
    anchorId,
    entityKind: candidate.kind,
    bodyId: options.bodyId,
    checkpointId,
    checkpointEntityId: candidate.checkpointEntityId,
    ...(candidate.sourceFeatureId
      ? { sourceFeatureId: candidate.sourceFeatureId }
      : {}),
    stableId: options.stableId,
    ...(candidate.sourceSemanticRole
      ? { sourceSemanticRole: candidate.sourceSemanticRole }
      : {}),
    ...(candidate.geometrySignature
      ? { signatureHash: candidate.geometrySignature }
      : {})
  };
  ops.push(anchorOp);

  diagnostics.push(
    createDiagnostic(
      "TOPOLOGY_ANCHOR_PERSISTENCE_READY",
      "info",
      `Topology anchor source record can be created for ${options.stableId}.`,
      {
        bodyId: options.bodyId,
        anchorId,
        checkpointId,
        received: options.stableId
      }
    )
  );

  return createResponse(options, {
    status: "ready",
    candidate,
    checkpointId,
    anchorId,
    ops,
    diagnostics
  });
}

function createResponse(
  options: CreateTopologyAnchorCreationPlanOptions,
  input: {
    readonly status: TopologyAnchorCreationPlanQueryResponse["status"];
    readonly candidate?: CadTopologyGeneratedReferenceCandidate;
    readonly checkpointId?: string;
    readonly anchorId?: string;
    readonly ops?: readonly CadOp[];
    readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
  }
): TopologyAnchorCreationPlanResult {
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
      query: "topology.anchorCreationPlan",
      cadOpsVersion: options.cadOpsVersion,
      status: input.status,
      bodyId: options.bodyId,
      stableId: options.stableId,
      ...(input.checkpointId ? { checkpointId: input.checkpointId } : {}),
      ...(input.anchorId ? { anchorId: input.anchorId } : {}),
      ...(input.candidate?.sourceFeatureId
        ? { sourceFeatureId: input.candidate.sourceFeatureId }
        : {}),
      ...(input.candidate ? { candidate: input.candidate } : {}),
      createsCheckpoint: ops.some(
        (op) => op.op === "topology.checkpoint.create"
      ),
      createsAnchor: ops.some((op) => op.op === "topology.anchor.create"),
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

function findExistingAnchor(input: {
  readonly topologyIdentity?: CadTopologyIdentitySourceSnapshot;
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly anchorId?: string;
}): CadTopologyIdentitySourceSnapshot["anchors"][number] | undefined {
  return input.topologyIdentity?.anchors.find(
    (anchor) =>
      anchor.state === "active" &&
      anchor.bodyId === input.bodyId &&
      (anchor.stableId === input.stableId ||
        (input.anchorId !== undefined && anchor.anchorId === input.anchorId))
  );
}

function findReusableCheckpoint(input: {
  readonly topologyIdentity?: CadTopologyIdentitySourceSnapshot;
  readonly checkpointId?: string;
  readonly bodyId: BodyId;
  readonly sourceFeatureId?: FeatureId;
}): CadTopologyIdentitySourceSnapshot["checkpoints"][number] | undefined {
  if (!input.topologyIdentity) {
    return undefined;
  }

  if (input.checkpointId) {
    return input.topologyIdentity.checkpoints.find(
      (checkpoint) => checkpoint.checkpointId === input.checkpointId
    );
  }

  return input.topologyIdentity.checkpoints.find(
    (checkpoint) =>
      checkpoint.status === "active" &&
      checkpoint.bodyId === input.bodyId &&
      (input.sourceFeatureId === undefined ||
        checkpoint.sourceFeatureId === input.sourceFeatureId)
  );
}

function mapCandidateStatus(
  candidate: CadTopologyGeneratedReferenceCandidate
): TopologyAnchorCreationPlanQueryResponse["status"] {
  if (candidate.status === "ambiguous") {
    return "ambiguous";
  }

  if (candidate.status === "unsupported") {
    return "unsupported";
  }

  return "missing";
}

function isSupportedAnchorKind(
  kind: CadTopologyGeneratedReferenceCandidate["kind"]
): kind is Extract<CadTopologyAnchorEntityKind, "body" | "face" | "edge"> {
  return kind === "body" || kind === "face" || kind === "edge";
}

function createPlannedId(
  prefix: "checkpoint" | "anchor",
  bodyId: BodyId,
  stableId: string
): string {
  const bodySegment = sanitizeIdSegment(bodyId);
  const hashSegment = sha256Hex(
    new TextEncoder().encode(`${prefix}:${bodyId}:${stableId}`)
  ).slice(0, 16);

  return `topology_${prefix}_${bodySegment}_${hashSegment}`;
}

function sanitizeIdSegment(value: string): string {
  const sanitized = value
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return sanitized.length > 0 ? sanitized : "entity";
}

function createPlannedCheckpointSourceIdentity(input: {
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly units: DocumentUnits;
  readonly candidate: CadTopologyGeneratedReferenceCandidate;
}) {
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      contract: "partbench.v13.topology-anchor-creation-plan",
      bodyId: input.bodyId,
      stableId: input.stableId,
      units: input.units,
      kind: input.candidate.kind,
      sourceFeatureId: input.candidate.sourceFeatureId,
      checkpointEntityId: input.candidate.checkpointEntityId,
      sourceSemanticRole: input.candidate.sourceSemanticRole,
      geometrySignature: input.candidate.geometrySignature
    })
  );

  return {
    algorithm: WCAD_SOURCE_IDENTITY_ALGORITHM,
    sha256: sha256Hex(bytes)
  };
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

import type {
  CadBodyExactTopologyEntityDescriptor,
  CadOpsVersion,
  CadTopologyEntityKind,
  CadTopologyIdentityDiagnostic,
  CadTopologyIdentityDiagnosticCode,
  CadTopologyIdentityState,
  CadTopologyMatchConfidence,
  CadTopologyMatchEvidence,
  CadTopologyMatchSnapshotInput,
  CadTopologySnapshotDescriptor,
  TopologyMatchSnapshotsQuery,
  TopologyMatchSnapshotsQueryResponse
} from "@web-cad/cad-protocol";

interface TopologyMatchInput {
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: TopologyMatchSnapshotsQuery;
}

type MatchableTopologyEntity = CadBodyExactTopologyEntityDescriptor & {
  readonly kind: CadTopologyEntityKind;
};

interface MatchEntity {
  readonly snapshot: CadTopologyMatchSnapshotInput;
  readonly entity: MatchableTopologyEntity;
}

interface ScoredCandidate {
  readonly candidate: MatchEntity;
  readonly score: number;
  readonly confidence: CadTopologyMatchConfidence;
  readonly evidence: readonly CadTopologyMatchEvidence[];
}

const SOURCE_BOUNDARY_NOTE =
  "Topology matching uses caller-provided exact topology snapshots, checkpoint ids, source identity, body ids, and source feature ids only.";
const DERIVED_BOUNDARY_NOTE =
  "Renderer, mesh, OCCT, GPU, selection-buffer, OPFS, file-handle, path, viewport, and export artifact identifiers are not public topology match references.";

export function createTopologyMatchSnapshotsResponse({
  cadOpsVersion,
  query
}: TopologyMatchInput): TopologyMatchSnapshotsQueryResponse {
  const previousEntities =
    query.previous.topologySnapshot.entities.filter(isMatchableEntity);
  const candidateEntities = query.candidates.flatMap((snapshot) =>
    snapshot.topologySnapshot.entities
      .filter(isMatchableEntity)
      .map((entity) => ({ snapshot, entity }))
  );
  const previousSignatureCounts = createSignatureCounts(
    previousEntities.map((entity) => ({ snapshot: query.previous, entity }))
  );
  const candidateSignatureCounts = createSignatureCounts(candidateEntities);
  const matchResults = previousEntities.map((entity) =>
    matchEntity({
      previous: { snapshot: query.previous, entity },
      candidates: candidateEntities,
      previousSignatureCount:
        previousSignatureCounts.get(signatureKey(entity)) ?? 0,
      candidateSignatureCount:
        candidateSignatureCounts.get(signatureKey(entity)) ?? 0
    })
  );
  const diagnostics = matchResults.flatMap((result) => result.diagnostics);

  return {
    ok: true,
    query: "topology.matchSnapshots",
    cadOpsVersion,
    status: chooseOverallState(matchResults.map((result) => result.state)),
    previousSnapshot: createSnapshotDescriptor(query.previous),
    candidateSnapshotCount: query.candidates.length,
    candidateSnapshots: query.candidates.map(createSnapshotDescriptor),
    resultCount: matchResults.length,
    matchResults,
    diagnosticCount: diagnostics.length,
    diagnostics,
    sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
    derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
    mutatesSource: false
  };
}

function matchEntity({
  previous,
  candidates,
  previousSignatureCount,
  candidateSignatureCount
}: {
  readonly previous: MatchEntity;
  readonly candidates: readonly MatchEntity[];
  readonly previousSignatureCount: number;
  readonly candidateSignatureCount: number;
}) {
  const exactCandidates = candidates.filter(
    (candidate) =>
      candidate.entity.kind === previous.entity.kind &&
      candidate.entity.signature === previous.entity.signature
  );
  const kindMismatchCandidates = candidates.filter(
    (candidate) =>
      candidate.entity.kind !== previous.entity.kind &&
      candidate.entity.signature === previous.entity.signature
  );

  if (exactCandidates.length === 1) {
    const candidate = exactCandidates[0];
    const evidence = createEvidence(previous, candidate, true);
    const state =
      previousSignatureCount > 1 && candidateSignatureCount === 1
        ? "merged"
        : "active";

    return createMatchResult({
      previous,
      candidate,
      state,
      confidence: "exact",
      confidenceScore: 1,
      evidence,
      diagnostics:
        state === "merged"
          ? [
              createDiagnostic(
                "TOPOLOGY_MATCH_MERGED",
                "warning",
                "Multiple previous topology entities share this exact signature and now map to one candidate.",
                previous.entity.kind
              )
            ]
          : [
              createDiagnostic(
                "TOPOLOGY_MATCH_EXACT",
                "info",
                "Topology entity matched by exact kind and geometry signature.",
                previous.entity.kind
              )
            ]
    });
  }

  if (exactCandidates.length > 1) {
    const state = previousSignatureCount === 1 ? "split" : "ambiguous";
    const candidate = exactCandidates[0];

    return createMatchResult({
      previous,
      candidate,
      state,
      confidence: "high",
      confidenceScore: 0.92,
      evidence: createEvidence(previous, candidate, true),
      diagnostics: [
        createDiagnostic(
          state === "split"
            ? "TOPOLOGY_MATCH_SPLIT"
            : "TOPOLOGY_MATCH_AMBIGUOUS",
          "warning",
          state === "split"
            ? "One previous topology entity has multiple exact-signature candidates."
            : "Multiple exact-signature candidates are indistinguishable.",
          previous.entity.kind
        )
      ]
    });
  }

  if (kindMismatchCandidates.length > 0) {
    const candidate = kindMismatchCandidates[0];

    return createMatchResult({
      previous,
      candidate,
      state: "repair-needed",
      confidence: "low",
      confidenceScore: 0.2,
      evidence: [
        {
          kind: "geometrySignature",
          confidence: "high",
          weight: 0.2,
          message:
            "Geometry signature matched a candidate with a different topology kind.",
          previousValue: previous.entity.signature,
          candidateValue: candidate.entity.signature
        }
      ],
      diagnostics: [
        createDiagnostic(
          "TOPOLOGY_MATCH_KIND_MISMATCH",
          "warning",
          "Topology entity signature matched a different entity kind; explicit repair is required.",
          previous.entity.kind,
          String(previous.entity.kind),
          String(candidate.entity.kind)
        )
      ]
    });
  }

  const scored = candidates
    .filter((candidate) => candidate.entity.kind === previous.entity.kind)
    .map((candidate) => scoreCandidate(previous, candidate))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.candidate.entity.localId.localeCompare(
        right.candidate.entity.localId
      );
    });

  if (scored.length > 0) {
    const best = scored[0];
    const ties = scored.filter((candidate) => candidate.score === best.score);

    if (ties.length > 1) {
      return createMatchResult({
        previous,
        candidate: best.candidate,
        state: "ambiguous",
        confidence: best.confidence,
        confidenceScore: best.score,
        evidence: best.evidence,
        diagnostics: [
          createDiagnostic(
            "TOPOLOGY_MATCH_AMBIGUOUS",
            "warning",
            "Multiple same-kind topology candidates have identical match confidence.",
            previous.entity.kind
          )
        ]
      });
    }

    const state: CadTopologyIdentityState =
      best.score >= 0.7 ? "replaced" : "repair-needed";

    return createMatchResult({
      previous,
      candidate: best.candidate,
      state,
      confidence: best.confidence,
      confidenceScore: best.score,
      evidence: best.evidence,
      diagnostics: [
        createDiagnostic(
          best.score >= 0.7
            ? "TOPOLOGY_MATCH_REPLACED"
            : "TOPOLOGY_MATCH_LOW_CONFIDENCE",
          best.score >= 0.7 ? "info" : "warning",
          best.score >= 0.7
            ? "Topology entity has a high-confidence replacement candidate."
            : "Topology entity has only a low-confidence repair candidate.",
          previous.entity.kind
        )
      ]
    });
  }

  return createMatchResult({
    previous,
    state: "deleted",
    confidence: "none",
    confidenceScore: 0,
    evidence: [],
    diagnostics: [
      createDiagnostic(
        "TOPOLOGY_MATCH_DELETED",
        "warning",
        "Topology entity has no viable candidate in the provided snapshots.",
        previous.entity.kind
      )
    ]
  });
}

function scoreCandidate(
  previous: MatchEntity,
  candidate: MatchEntity
): ScoredCandidate {
  const evidence = createEvidence(previous, candidate, false);
  const score = Math.min(
    1,
    evidence.reduce((sum, item) => sum + (item.weight ?? 0), 0)
  );

  return {
    candidate,
    score,
    confidence: confidenceFromScore(score),
    evidence
  };
}

function createEvidence(
  previous: MatchEntity,
  candidate: MatchEntity,
  exactSignature: boolean
): readonly CadTopologyMatchEvidence[] {
  const evidence: CadTopologyMatchEvidence[] = [];

  if (previous.entity.kind === candidate.entity.kind) {
    evidence.push({
      kind: "entityKind",
      confidence: "high",
      weight: exactSignature ? 0.05 : 0.2,
      message: "Topology entity kind matches.",
      previousValue: String(previous.entity.kind),
      candidateValue: String(candidate.entity.kind)
    });
  }

  if (previous.entity.signature === candidate.entity.signature) {
    evidence.push({
      kind: "geometrySignature",
      confidence: "exact",
      weight: 0.8,
      message: "Topology entity geometry signature matches exactly.",
      previousValue: previous.entity.signature,
      candidateValue: candidate.entity.signature
    });
  }

  if (
    previous.entity.bounds &&
    candidate.entity.bounds &&
    boundsKey(previous.entity.bounds) === boundsKey(candidate.entity.bounds)
  ) {
    evidence.push({
      kind: "bounds",
      confidence: "high",
      weight: exactSignature ? 0.05 : 0.15,
      message: "Topology entity bounds match.",
      previousValue: boundsKey(previous.entity.bounds),
      candidateValue: boundsKey(candidate.entity.bounds)
    });
  }

  if (
    previous.snapshot.sourceIdentity &&
    candidate.snapshot.sourceIdentity &&
    previous.snapshot.sourceIdentity.sha256 ===
      candidate.snapshot.sourceIdentity.sha256
  ) {
    evidence.push({
      kind: "checkpointSourceIdentity",
      confidence: "high",
      weight: exactSignature ? 0.05 : 0.15,
      message: "Checkpoint source identity matches.",
      previousValue: previous.snapshot.sourceIdentity.sha256,
      candidateValue: candidate.snapshot.sourceIdentity.sha256
    });
  }

  if (
    previous.snapshot.bodyId === candidate.snapshot.bodyId ||
    (previous.snapshot.sourceFeatureId &&
      previous.snapshot.sourceFeatureId === candidate.snapshot.sourceFeatureId)
  ) {
    evidence.push({
      kind: "sourceLineage",
      confidence: "medium",
      weight: exactSignature ? 0.1 : 0.15,
      message: "Body or source feature lineage matches.",
      previousValue:
        previous.snapshot.sourceFeatureId ?? previous.snapshot.bodyId,
      candidateValue:
        candidate.snapshot.sourceFeatureId ?? candidate.snapshot.bodyId
    });
  }

  return evidence;
}

function boundsKey(
  bounds: NonNullable<MatchEntity["entity"]["bounds"]>
): string {
  return JSON.stringify({
    min: bounds.min.map(roundEvidenceNumber),
    max: bounds.max.map(roundEvidenceNumber)
  });
}

function roundEvidenceNumber(value: number): number {
  return Number(value.toFixed(9));
}

function createMatchResult({
  previous,
  candidate,
  state,
  confidence,
  confidenceScore,
  evidence,
  diagnostics
}: {
  readonly previous: MatchEntity;
  readonly candidate?: MatchEntity;
  readonly state: CadTopologyIdentityState;
  readonly confidence: CadTopologyMatchConfidence;
  readonly confidenceScore: number;
  readonly evidence: readonly CadTopologyMatchEvidence[];
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
}) {
  return {
    ...(previous.snapshot.checkpointId
      ? { previousCheckpointId: previous.snapshot.checkpointId }
      : {}),
    ...(candidate?.snapshot.checkpointId
      ? { candidateCheckpointId: candidate.snapshot.checkpointId }
      : {}),
    previousCheckpointEntityId: previous.entity.localId,
    ...(candidate
      ? { candidateCheckpointEntityId: candidate.entity.localId }
      : {}),
    entityKind: previous.entity.kind,
    state,
    confidence,
    confidenceScore,
    evidenceCount: evidence.length,
    evidence,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createSnapshotDescriptor(
  snapshot: CadTopologyMatchSnapshotInput
): CadTopologySnapshotDescriptor {
  return {
    ...(snapshot.snapshotId ? { snapshotId: snapshot.snapshotId } : {}),
    ...(snapshot.checkpointId ? { checkpointId: snapshot.checkpointId } : {}),
    bodyId: snapshot.bodyId,
    ...(snapshot.sourceFeatureId
      ? { sourceFeatureId: snapshot.sourceFeatureId }
      : {}),
    ...(snapshot.sourceIdentity
      ? { sourceIdentity: snapshot.sourceIdentity }
      : {}),
    entityKinds: snapshot.topologySnapshot.entities
      .filter(isMatchableEntity)
      .map((entity) => entity.kind),
    entityCount: snapshot.topologySnapshot.entityCount,
    status:
      snapshot.topologySnapshot.status === "ready" ? "active" : "unsupported",
    diagnostics: []
  };
}

function createSignatureCounts(
  entities: readonly MatchEntity[]
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();

  for (const { entity } of entities) {
    const key = signatureKey(entity);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function signatureKey(entity: CadBodyExactTopologyEntityDescriptor): string {
  return `${entity.kind}:${entity.signature}`;
}

function isMatchableEntity(
  entity: CadBodyExactTopologyEntityDescriptor
): entity is MatchableTopologyEntity {
  return entity.kind !== "solid";
}

function confidenceFromScore(score: number): CadTopologyMatchConfidence {
  if (score >= 0.95) {
    return "exact";
  }

  if (score >= 0.7) {
    return "high";
  }

  if (score >= 0.45) {
    return "medium";
  }

  if (score > 0) {
    return "low";
  }

  return "none";
}

function chooseOverallState(
  states: readonly CadTopologyIdentityState[]
): CadTopologyIdentityState {
  if (states.length === 0) {
    return "missing";
  }

  if (states.some((state) => state === "ambiguous")) {
    return "ambiguous";
  }

  if (states.some((state) => state === "repair-needed")) {
    return "repair-needed";
  }

  if (states.some((state) => state === "deleted")) {
    return "deleted";
  }

  if (states.some((state) => state === "split")) {
    return "split";
  }

  if (states.some((state) => state === "merged")) {
    return "merged";
  }

  if (states.some((state) => state === "replaced")) {
    return "replaced";
  }

  return "active";
}

function createDiagnostic(
  code: CadTopologyIdentityDiagnosticCode,
  severity: CadTopologyIdentityDiagnostic["severity"],
  message: string,
  entityKind: CadTopologyEntityKind,
  expected?: string,
  received?: string
): CadTopologyIdentityDiagnostic {
  return {
    code,
    status: severity === "error" ? "unavailable" : "supported",
    severity,
    message,
    entityKind,
    ...(expected ? { expected } : {}),
    ...(received ? { received } : {})
  };
}

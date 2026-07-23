import type {
  CadBodyExactTopologyEntityDescriptor,
  CadOpsVersion,
  CadTopologyAnchorEntityKind,
  CadTopologyEntityKind,
  CadTopologyIdentityDiagnostic,
  CadTopologyIdentityDiagnosticCode,
  CadTopologyIdentityState,
  CadTopologyMatchConfidence,
  CadTopologyMatchEvidence,
  CadTopologyMatchResult,
  CadTopologyRepairCandidate,
  CadTopologyMatchSnapshotInput,
  CadTopologySnapshotDescriptor,
  TopologyMatchSnapshotsQuery,
  TopologyMatchSnapshotsQueryResponse
} from "@web-cad/cad-protocol";

import { sha256Hex } from "./sha256";

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

interface ContextualExactCandidate extends ScoredCandidate {
  readonly contextScore: number;
}

type MatchResultWithCandidates = CadTopologyMatchResult & {
  readonly repairCandidates: readonly CadTopologyRepairCandidate[];
};

const SOURCE_BOUNDARY_NOTE =
  "Topology matching uses caller-provided exact topology snapshots, checkpoint ids, source identity, body ids, and source feature ids only.";
const DERIVED_BOUNDARY_NOTE =
  "Renderer, mesh, OCCT, GPU, selection-buffer, OPFS, file-handle, path, viewport, and export artifact identifiers are not public topology match references.";
const EXACT_DISAMBIGUATION_EVIDENCE = new Set<CadTopologyMatchEvidence["kind"]>(
  [
    "surfaceType",
    "curveType",
    "orientation",
    "loopRole",
    "point",
    "midpoint",
    "normal",
    "axis",
    "length",
    "area",
    "radius",
    "adjacency",
    "relationship"
  ]
);

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
  const matches = previousEntities.map((entity) =>
    matchEntity({
      previous: { snapshot: query.previous, entity },
      candidates: candidateEntities,
      previousSignatureCount:
        previousSignatureCounts.get(signatureKey(entity)) ?? 0,
      candidateSignatureCount:
        candidateSignatureCounts.get(signatureKey(entity)) ?? 0
    })
  );
  const matchResults = matches.map((match) => {
    const { repairCandidates: _repairCandidates, ...result } = match;
    void _repairCandidates;

    return result;
  });
  const repairCandidates = matches.flatMap((result) => result.repairCandidates);
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
    repairCandidateCount: repairCandidates.length,
    repairCandidates,
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
  const exactCandidate = exactCandidates[0];

  if (exactCandidates.length === 1 && exactCandidate) {
    const evidence = createEvidence(previous, exactCandidate, true);
    const state =
      previousSignatureCount > 1 && candidateSignatureCount === 1
        ? "merged"
        : "active";

    return createMatchResult({
      previous,
      candidate: exactCandidate,
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
            ],
      repairCandidates:
        state === "merged"
          ? compactRepairCandidates([
              createMatchRepairCandidate({
                previous,
                candidate: exactCandidate,
                state,
                confidence: "exact",
                confidenceScore: 1,
                evidence,
                diagnostics: [
                  createDiagnostic(
                    "TOPOLOGY_MATCH_MERGED",
                    "warning",
                    "Multiple previous topology entities share this exact signature and now map to one candidate.",
                    previous.entity.kind
                  )
                ],
                recommendedAction: "manual-repair-plan"
              })
            ])
          : []
    });
  }

  if (exactCandidates.length > 1 && exactCandidate) {
    const scoredExactCandidates = exactCandidates
      .map((candidate) => scoreExactDuplicate(previous, candidate))
      .sort((left, right) => {
        if (right.contextScore !== left.contextScore) {
          return right.contextScore - left.contextScore;
        }

        return left.candidate.entity.localId.localeCompare(
          right.candidate.entity.localId
        );
      });
    const best = scoredExactCandidates[0];
    const runnerUp = scoredExactCandidates[1];

    if (
      best &&
      best.contextScore > 0 &&
      (!runnerUp || best.contextScore > runnerUp.contextScore)
    ) {
      const diagnostics = [
        createDiagnostic(
          "TOPOLOGY_MATCH_REPLACED",
          "info",
          "Multiple exact-signature candidates were disambiguated by topology relationship evidence.",
          previous.entity.kind
        )
      ];

      return createMatchResult({
        previous,
        candidate: best.candidate,
        state: "replaced",
        confidence: best.confidence,
        confidenceScore: best.score,
        evidence: best.evidence,
        diagnostics,
        repairCandidates: compactRepairCandidates([
          createMatchRepairCandidate({
            previous,
            candidate: best.candidate,
            state: "replaced",
            confidence: best.confidence,
            confidenceScore: best.score,
            evidence: best.evidence,
            diagnostics,
            recommendedAction: "manual-repair-plan"
          })
        ])
      });
    }

    const state = previousSignatureCount === 1 ? "split" : "ambiguous";
    const candidate = best?.candidate ?? exactCandidate;
    const diagnostics = [
      createDiagnostic(
        state === "split" ? "TOPOLOGY_MATCH_SPLIT" : "TOPOLOGY_MATCH_AMBIGUOUS",
        "warning",
        state === "split"
          ? "One previous topology entity has multiple exact-signature candidates."
          : "Multiple exact-signature candidates are indistinguishable.",
        previous.entity.kind
      )
    ];

    return createMatchResult({
      previous,
      candidate,
      state,
      confidence: "high",
      confidenceScore: 0.92,
      evidence:
        best && best.candidate.entity.localId === candidate.entity.localId
          ? best.evidence
          : createEvidence(previous, candidate, true),
      diagnostics,
      repairCandidates: compactRepairCandidates(
        scoredExactCandidates.map((scoredCandidate) =>
          createMatchRepairCandidate({
            previous,
            candidate: scoredCandidate.candidate,
            state,
            confidence: scoredCandidate.confidence,
            confidenceScore: scoredCandidate.score,
            evidence: scoredCandidate.evidence,
            diagnostics,
            recommendedAction: "manual-repair-plan"
          })
        )
      )
    });
  }

  const kindMismatchCandidate = kindMismatchCandidates[0];
  if (kindMismatchCandidate) {
    return createMatchResult({
      previous,
      candidate: kindMismatchCandidate,
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
          candidateValue: kindMismatchCandidate.entity.signature
        }
      ],
      diagnostics: [
        createDiagnostic(
          "TOPOLOGY_MATCH_KIND_MISMATCH",
          "warning",
          "Topology entity signature matched a different entity kind; explicit repair is required.",
          previous.entity.kind,
          String(previous.entity.kind),
          String(kindMismatchCandidate.entity.kind)
        )
      ],
      repairCandidates: compactRepairCandidates([
        createMatchRepairCandidate({
          previous,
          candidate: kindMismatchCandidate,
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
              candidateValue: kindMismatchCandidate.entity.signature
            }
          ],
          diagnostics: [
            createDiagnostic(
              "TOPOLOGY_MATCH_KIND_MISMATCH",
              "warning",
              "Topology entity signature matched a different entity kind; explicit repair is required.",
              previous.entity.kind,
              String(previous.entity.kind),
              String(kindMismatchCandidate.entity.kind)
            )
          ],
          recommendedAction: "inspect"
        })
      ])
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

  const best = scored[0];
  if (best) {
    const ties = scored.filter((candidate) => candidate.score === best.score);

    if (ties.length > 1) {
      const diagnostics = [
        createDiagnostic(
          "TOPOLOGY_MATCH_AMBIGUOUS",
          "warning",
          "Multiple same-kind topology candidates have identical match confidence.",
          previous.entity.kind
        )
      ];
      return createMatchResult({
        previous,
        candidate: best.candidate,
        state: "ambiguous",
        confidence: best.confidence,
        confidenceScore: best.score,
        evidence: best.evidence,
        diagnostics,
        repairCandidates: compactRepairCandidates(
          ties.map((tie) =>
            createMatchRepairCandidate({
              previous,
              candidate: tie.candidate,
              state: "ambiguous",
              confidence: tie.confidence,
              confidenceScore: tie.score,
              evidence: tie.evidence,
              diagnostics,
              recommendedAction: "manual-repair-plan"
            })
          )
        )
      });
    }

    const state: CadTopologyIdentityState =
      best.score >= 0.7 ? "replaced" : "repair-needed";
    const diagnostics = [
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
    ];

    return createMatchResult({
      previous,
      candidate: best.candidate,
      state,
      confidence: best.confidence,
      confidenceScore: best.score,
      evidence: best.evidence,
      diagnostics,
      repairCandidates: compactRepairCandidates([
        createMatchRepairCandidate({
          previous,
          candidate: best.candidate,
          state,
          confidence: best.confidence,
          confidenceScore: best.score,
          evidence: best.evidence,
          diagnostics,
          recommendedAction:
            state === "replaced" ? "manual-repair-plan" : "inspect"
        })
      ])
    });
  }

  const diagnostics = [
    createDiagnostic(
      "TOPOLOGY_MATCH_DELETED",
      "warning",
      "Topology entity has no viable candidate in the provided snapshots.",
      previous.entity.kind
    )
  ];
  return createMatchResult({
    previous,
    state: "deleted",
    confidence: "none",
    confidenceScore: 0,
    evidence: [],
    diagnostics,
    repairCandidates: compactRepairCandidates([
      createMatchRepairCandidate({
        previous,
        state: "deleted",
        confidence: "none",
        confidenceScore: 0,
        evidence: [],
        diagnostics,
        recommendedAction: "not-repairable"
      })
    ])
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

function scoreExactDuplicate(
  previous: MatchEntity,
  candidate: MatchEntity
): ContextualExactCandidate {
  const evidence = createEvidence(previous, candidate, true);
  const contextScore = contextualEvidenceScore(evidence);
  const score = Math.min(0.99, 0.92 + contextScore);

  return {
    candidate,
    score,
    contextScore,
    confidence: "high",
    evidence
  };
}

function contextualEvidenceScore(
  evidence: readonly CadTopologyMatchEvidence[]
): number {
  return evidence.reduce(
    (score, item) =>
      EXACT_DISAMBIGUATION_EVIDENCE.has(item.kind)
        ? score + (item.weight ?? 0)
        : score,
    0
  );
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
    previous.entity.kind === "face" &&
    candidate.entity.kind === "face" &&
    previous.entity.surfaceClass &&
    previous.entity.surfaceClass !== "unknown" &&
    previous.entity.surfaceClass === candidate.entity.surfaceClass
  ) {
    evidence.push({
      kind: "surfaceType",
      confidence: "high",
      weight: exactSignature ? 0.03 : 0.1,
      message: "Topology face surface class matches.",
      previousValue: previous.entity.surfaceClass,
      candidateValue: candidate.entity.surfaceClass
    });
  }

  if (
    previous.entity.kind === "edge" &&
    candidate.entity.kind === "edge" &&
    previous.entity.curveClass &&
    previous.entity.curveClass !== "unknown" &&
    previous.entity.curveClass === candidate.entity.curveClass
  ) {
    evidence.push({
      kind: "curveType",
      confidence: "high",
      weight: exactSignature ? 0.03 : 0.1,
      message: "Topology edge curve class matches.",
      previousValue: previous.entity.curveClass,
      candidateValue: candidate.entity.curveClass
    });
  }

  if (
    previous.entity.orientation &&
    previous.entity.orientation !== "unknown" &&
    previous.entity.orientation === candidate.entity.orientation
  ) {
    evidence.push({
      kind: "orientation",
      confidence: "medium",
      weight: exactSignature ? 0.01 : 0.04,
      message: "Topology entity orientation evidence matches.",
      previousValue: previous.entity.orientation,
      candidateValue: candidate.entity.orientation
    });
  }

  if (
    previous.entity.kind === "loop" &&
    candidate.entity.kind === "loop" &&
    previous.entity.loopRole &&
    previous.entity.loopRole !== "unknown" &&
    previous.entity.loopRole === candidate.entity.loopRole
  ) {
    evidence.push({
      kind: "loopRole",
      confidence: "medium",
      weight: exactSignature ? 0.02 : 0.08,
      message: "Topology loop role evidence matches.",
      previousValue: previous.entity.loopRole,
      candidateValue: candidate.entity.loopRole
    });
  }

  addRelationshipEvidence(evidence, previous, candidate, exactSignature);

  addVectorEvidence(evidence, {
    kind: "point",
    entityKind: "vertex",
    previousEntityKind: previous.entity.kind,
    candidateEntityKind: candidate.entity.kind,
    previous: previous.entity.point,
    candidate: candidate.entity.point,
    exactWeight: 0.02,
    scoredWeight: 0.1,
    message: "Topology vertex point matches.",
    exactSignature
  });
  addVectorEvidence(evidence, {
    kind: "midpoint",
    entityKind: "edge",
    previousEntityKind: previous.entity.kind,
    candidateEntityKind: candidate.entity.kind,
    previous: previous.entity.midpoint,
    candidate: candidate.entity.midpoint,
    exactWeight: 0.02,
    scoredWeight: 0.1,
    message: "Topology edge midpoint matches.",
    exactSignature
  });
  addVectorEvidence(evidence, {
    kind: "normal",
    entityKind: "face",
    previousEntityKind: previous.entity.kind,
    candidateEntityKind: candidate.entity.kind,
    previous: previous.entity.normal,
    candidate: candidate.entity.normal,
    exactWeight: 0.02,
    scoredWeight: 0.08,
    message: "Topology face normal evidence matches.",
    exactSignature
  });
  addVectorEvidence(evidence, {
    kind: "axis",
    entityKinds: ["face", "edge", "axis"],
    previousEntityKind: previous.entity.kind,
    candidateEntityKind: candidate.entity.kind,
    previous: previous.entity.axis,
    candidate: candidate.entity.axis,
    exactWeight: 0.02,
    scoredWeight: 0.08,
    message: "Topology axis evidence matches.",
    exactSignature
  });
  addNumberEvidence(evidence, {
    kind: "length",
    entityKind: "edge",
    previousEntityKind: previous.entity.kind,
    candidateEntityKind: candidate.entity.kind,
    previous: previous.entity.length,
    candidate: candidate.entity.length,
    exactWeight: 0.02,
    scoredWeight: 0.08,
    message: "Topology entity length evidence matches.",
    exactSignature
  });
  addNumberEvidence(evidence, {
    kind: "area",
    entityKind: "face",
    previousEntityKind: previous.entity.kind,
    candidateEntityKind: candidate.entity.kind,
    previous: previous.entity.area,
    candidate: candidate.entity.area,
    exactWeight: 0.02,
    scoredWeight: 0.08,
    message: "Topology entity area evidence matches.",
    exactSignature
  });
  addNumberEvidence(evidence, {
    kind: "radius",
    entityKinds: ["face", "edge"],
    previousEntityKind: previous.entity.kind,
    candidateEntityKind: candidate.entity.kind,
    previous: previous.entity.radius,
    candidate: candidate.entity.radius,
    exactWeight: 0.02,
    scoredWeight: 0.08,
    message: "Topology entity radius evidence matches.",
    exactSignature
  });

  if (
    previous.entity.adjacency?.available === true &&
    candidate.entity.adjacency?.available === true
  ) {
    const previousNeighbors = sortedAdjacency(
      previous.entity.adjacency.neighborSignatureHashes
    );
    const candidateNeighbors = sortedAdjacency(
      candidate.entity.adjacency.neighborSignatureHashes
    );

    if (adjacencyKey(previousNeighbors) === adjacencyKey(candidateNeighbors)) {
      evidence.push({
        kind: "adjacency",
        confidence: "high",
        weight: exactSignature ? 0.03 : 0.12,
        message: "Topology adjacency signature evidence matches.",
        previousValue: previousNeighbors,
        candidateValue: candidateNeighbors
      });
    }
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

function addRelationshipEvidence(
  evidence: CadTopologyMatchEvidence[],
  previous: MatchEntity,
  candidate: MatchEntity,
  exactSignature: boolean
): void {
  const previousValue = relationshipEvidenceKey(previous);
  const candidateValue = relationshipEvidenceKey(candidate);

  if (!previousValue || !candidateValue) {
    return;
  }

  if (JSON.stringify(previousValue) !== JSON.stringify(candidateValue)) {
    return;
  }

  evidence.push({
    kind: "relationship",
    confidence: "high",
    weight: exactSignature ? 0.04 : 0.14,
    message:
      "Topology relationship evidence matches by referenced entity signatures.",
    previousValue,
    candidateValue
  });
}

function relationshipEvidenceKey(
  match: MatchEntity
): readonly string[] | undefined {
  const relationships = match.entity.relationships;

  if (!relationships) {
    return undefined;
  }

  const entitiesByLocalId = new Map(
    match.snapshot.topologySnapshot.entities.map((entity) => [
      entity.localId,
      entity
    ])
  );
  const parts: string[] = [];
  const addSingle = (label: string, localId: string | undefined) => {
    const token = relationshipEntityToken(entitiesByLocalId, localId);

    if (token) {
      parts.push(`${label}:${token}`);
    }
  };
  const addList = (
    label: string,
    localIds: readonly string[] | undefined,
    order: "preserve" | "sort"
  ) => {
    const tokens = (localIds ?? [])
      .map((localId) => relationshipEntityToken(entitiesByLocalId, localId))
      .filter((token): token is string => Boolean(token));

    if (tokens.length > 0) {
      parts.push(
        `${label}:${(order === "sort" ? [...tokens].sort() : tokens).join(">")}`
      );
    }
  };

  addSingle("parentFace", relationships.parentFaceLocalId);
  addSingle("parentWire", relationships.parentWireLocalId);
  addSingle("parentLoop", relationships.parentLoopLocalId);
  addSingle("underlyingWire", relationships.underlyingWireLocalId);
  addSingle("underlyingEdge", relationships.underlyingEdgeLocalId);
  addSingle("startVertex", relationships.startVertexLocalId);
  addSingle("endVertex", relationships.endVertexLocalId);
  addList("childWire", relationships.childWireLocalIds, "preserve");
  addList("childLoop", relationships.childLoopLocalIds, "preserve");
  addList("childCoedge", relationships.childCoedgeLocalIds, "preserve");
  addList("childEdge", relationships.childEdgeLocalIds, "preserve");
  addList("adjacentFace", relationships.adjacentFaceLocalIds, "sort");

  return parts.length > 0 ? parts : undefined;
}

function relationshipEntityToken(
  entitiesByLocalId: ReadonlyMap<string, CadBodyExactTopologyEntityDescriptor>,
  localId: string | undefined
): string | undefined {
  if (!localId) {
    return undefined;
  }

  const entity = entitiesByLocalId.get(localId);

  if (!entity) {
    return undefined;
  }

  return [
    entity.kind,
    entity.signature,
    entity.kind === "loop" && entity.loopRole ? entity.loopRole : undefined
  ]
    .filter((part): part is string => Boolean(part))
    .join(":");
}

function boundsKey(
  bounds: NonNullable<MatchEntity["entity"]["bounds"]>
): string {
  return JSON.stringify({
    min: bounds.min.map(roundEvidenceNumber),
    max: bounds.max.map(roundEvidenceNumber)
  });
}

function addVectorEvidence(
  evidence: CadTopologyMatchEvidence[],
  input: {
    readonly kind: Extract<
      CadTopologyMatchEvidence["kind"],
      "point" | "midpoint" | "normal" | "axis"
    >;
    readonly entityKind?: MatchableTopologyEntity["kind"];
    readonly entityKinds?: readonly MatchableTopologyEntity["kind"][];
    readonly previousEntityKind: MatchableTopologyEntity["kind"];
    readonly candidateEntityKind: MatchableTopologyEntity["kind"];
    readonly previous?: readonly [number, number, number];
    readonly candidate?: readonly [number, number, number];
    readonly exactWeight: number;
    readonly scoredWeight: number;
    readonly message: string;
    readonly exactSignature: boolean;
  }
): void {
  if (
    !isAllowedEvidenceEntityKind({
      entityKind: input.entityKind,
      entityKinds: input.entityKinds,
      previousEntityKind: input.previousEntityKind,
      candidateEntityKind: input.candidateEntityKind
    })
  ) {
    return;
  }

  if (!input.previous || !input.candidate) {
    return;
  }

  const previousValue = roundVec3(input.previous);
  const candidateValue = roundVec3(input.candidate);

  if (vectorKey(previousValue) !== vectorKey(candidateValue)) {
    return;
  }

  evidence.push({
    kind: input.kind,
    confidence: "high",
    weight: input.exactSignature ? input.exactWeight : input.scoredWeight,
    message: input.message,
    previousValue,
    candidateValue
  });
}

function addNumberEvidence(
  evidence: CadTopologyMatchEvidence[],
  input: {
    readonly kind: Extract<
      CadTopologyMatchEvidence["kind"],
      "length" | "area" | "radius"
    >;
    readonly entityKind?: MatchableTopologyEntity["kind"];
    readonly entityKinds?: readonly MatchableTopologyEntity["kind"][];
    readonly previousEntityKind: MatchableTopologyEntity["kind"];
    readonly candidateEntityKind: MatchableTopologyEntity["kind"];
    readonly previous?: number;
    readonly candidate?: number;
    readonly exactWeight: number;
    readonly scoredWeight: number;
    readonly message: string;
    readonly exactSignature: boolean;
  }
): void {
  if (
    !isAllowedEvidenceEntityKind({
      entityKind: input.entityKind,
      entityKinds: input.entityKinds,
      previousEntityKind: input.previousEntityKind,
      candidateEntityKind: input.candidateEntityKind
    })
  ) {
    return;
  }

  if (input.previous === undefined || input.candidate === undefined) {
    return;
  }

  const previousValue = roundEvidenceNumber(input.previous);
  const candidateValue = roundEvidenceNumber(input.candidate);

  if (previousValue !== candidateValue) {
    return;
  }

  evidence.push({
    kind: input.kind,
    confidence: "high",
    weight: input.exactSignature ? input.exactWeight : input.scoredWeight,
    message: input.message,
    previousValue,
    candidateValue
  });
}

function isAllowedEvidenceEntityKind(input: {
  readonly entityKind?: MatchableTopologyEntity["kind"];
  readonly entityKinds?: readonly MatchableTopologyEntity["kind"][];
  readonly previousEntityKind: MatchableTopologyEntity["kind"];
  readonly candidateEntityKind: MatchableTopologyEntity["kind"];
}): boolean {
  const allowed =
    input.entityKinds ?? (input.entityKind ? [input.entityKind] : []);

  return (
    allowed.includes(input.previousEntityKind) &&
    allowed.includes(input.candidateEntityKind)
  );
}

function vectorKey(vector: readonly number[]): string {
  return JSON.stringify(vector);
}

function roundVec3(
  vector: readonly [number, number, number]
): readonly [number, number, number] {
  return [
    roundEvidenceNumber(vector[0]),
    roundEvidenceNumber(vector[1]),
    roundEvidenceNumber(vector[2])
  ];
}

function sortedAdjacency(values: readonly string[]): readonly string[] {
  return [...values].sort();
}

function adjacencyKey(values: readonly string[]): string {
  return JSON.stringify(values);
}

function roundEvidenceNumber(value: number): number {
  return Number(value.toFixed(9));
}

function createMatchRepairCandidate({
  previous,
  candidate,
  state,
  confidence,
  confidenceScore,
  evidence,
  diagnostics,
  recommendedAction
}: {
  readonly previous: MatchEntity;
  readonly candidate?: MatchEntity;
  readonly state: CadTopologyRepairCandidate["state"];
  readonly confidence: CadTopologyMatchConfidence;
  readonly confidenceScore: number;
  readonly evidence: readonly CadTopologyMatchEvidence[];
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
  readonly recommendedAction: CadTopologyRepairCandidate["recommendedAction"];
}): CadTopologyRepairCandidate | undefined {
  if (!isRepairCandidateEntityKind(previous.entity.kind)) {
    return undefined;
  }

  return {
    candidateId: createRepairCandidateId({
      previous,
      candidate,
      state
    }),
    target: {
      type: "topologyMatch",
      ...(previous.snapshot.checkpointId
        ? { previousCheckpointId: previous.snapshot.checkpointId }
        : {}),
      ...(previous.snapshot.snapshotId
        ? { previousSnapshotId: previous.snapshot.snapshotId }
        : {}),
      entityKind: previous.entity.kind
    },
    previousCheckpointEvidence: {
      ...(previous.snapshot.checkpointId
        ? { checkpointId: previous.snapshot.checkpointId }
        : {}),
      checkpointEntityId: previous.entity.localId,
      idScope: "checkpoint-local",
      publicStableId: false
    },
    ...(candidate
      ? {
          candidateCheckpointEvidence: {
            ...(candidate.snapshot.checkpointId
              ? { checkpointId: candidate.snapshot.checkpointId }
              : {}),
            checkpointEntityId: candidate.entity.localId,
            idScope: "checkpoint-local",
            publicStableId: false
          } as const
        }
      : {}),
    entityKind: previous.entity.kind,
    state,
    confidence,
    confidenceScore,
    canAutoRetarget: false,
    recommendedAction,
    evidence,
    diagnostics
  };
}

function compactRepairCandidates(
  candidates: readonly (CadTopologyRepairCandidate | undefined)[]
): readonly CadTopologyRepairCandidate[] {
  return candidates.filter(
    (candidate): candidate is CadTopologyRepairCandidate => Boolean(candidate)
  );
}

function createRepairCandidateId({
  previous,
  candidate,
  state
}: {
  readonly previous: MatchEntity;
  readonly candidate?: MatchEntity;
  readonly state: CadTopologyRepairCandidate["state"];
}): string {
  const hashSegment = sha256Hex(
    new TextEncoder().encode(
      [
        "topology-match-repair-candidate",
        previous.snapshot.checkpointId ?? previous.snapshot.snapshotId ?? "",
        previous.entity.localId,
        candidate?.snapshot.checkpointId ??
          candidate?.snapshot.snapshotId ??
          "",
        candidate?.entity.localId ?? "",
        state
      ].join(":")
    )
  ).slice(0, 16);

  return `topology_repair_candidate_${hashSegment}`;
}

function createMatchResult({
  previous,
  candidate,
  state,
  confidence,
  confidenceScore,
  evidence,
  diagnostics,
  repairCandidates = []
}: {
  readonly previous: MatchEntity;
  readonly candidate?: MatchEntity;
  readonly state: CadTopologyIdentityState;
  readonly confidence: CadTopologyMatchConfidence;
  readonly confidenceScore: number;
  readonly evidence: readonly CadTopologyMatchEvidence[];
  readonly diagnostics: readonly CadTopologyIdentityDiagnostic[];
  readonly repairCandidates?: readonly CadTopologyRepairCandidate[];
}): MatchResultWithCandidates {
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
    diagnostics,
    repairCandidates
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

function isRepairCandidateEntityKind(
  kind: CadTopologyEntityKind
): kind is CadTopologyAnchorEntityKind {
  return (
    kind === "body" ||
    kind === "face" ||
    kind === "edge" ||
    kind === "vertex" ||
    kind === "axis"
  );
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

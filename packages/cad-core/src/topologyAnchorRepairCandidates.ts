import type {
  CadOpsVersion,
  CadTopologyAnchorRepairCandidateGroup,
  CadTopologyAnchorSourceRecord,
  CadTopologyIdentityDiagnostic,
  CadTopologyIdentityDiagnosticCode,
  CadTopologyIdentitySourceSnapshot,
  CadTopologyIdentityState,
  CadTopologyMatchResult,
  CadTopologyRepairCandidate,
  TopologyAnchorRepairCandidatesQuery,
  TopologyAnchorRepairCandidatesQueryResponse
} from "@web-cad/cad-protocol";

import { createTopologyMatchSnapshotsResponse } from "./topologyMatching";

interface TopologyAnchorRepairCandidatesInput {
  readonly cadOpsVersion: CadOpsVersion;
  readonly query: TopologyAnchorRepairCandidatesQuery;
  readonly topologyIdentity?: CadTopologyIdentitySourceSnapshot;
}

const SOURCE_BOUNDARY_NOTE =
  "Topology anchor repair candidate groups are derived from authoritative topology anchor source records plus caller-provided exact topology match snapshots; committing a repair still goes through topology.anchorRepairPlan/topology.anchor.repair.";
const DERIVED_BOUNDARY_NOTE =
  "Snapshot checkpoint-local ids are repair evidence only; renderer, mesh, OCCT, GPU, selection-buffer, OPFS, file-handle, path, viewport, and export artifact identifiers are not public topology anchor references.";

export function createTopologyAnchorRepairCandidatesResponse({
  cadOpsVersion,
  query,
  topologyIdentity
}: TopologyAnchorRepairCandidatesInput): TopologyAnchorRepairCandidatesQueryResponse {
  const matchResponse = createTopologyMatchSnapshotsResponse({
    cadOpsVersion,
    query: {
      query: "topology.matchSnapshots",
      previous: query.previous,
      candidates: query.candidates
    }
  });
  const requestedAnchorIds = new Set(query.anchorIds ?? []);
  const candidateByPreviousEntity = new Map<
    string,
    CadTopologyRepairCandidate[]
  >();

  for (const candidate of matchResponse.repairCandidates) {
    const key = createCheckpointEntityKey(
      candidate.previousCheckpointEvidence?.checkpointId,
      candidate.previousCheckpointEvidence?.checkpointEntityId
    );

    if (!key) {
      continue;
    }

    const existing = candidateByPreviousEntity.get(key) ?? [];
    candidateByPreviousEntity.set(key, [...existing, candidate]);
  }

  const anchors =
    topologyIdentity?.anchors.filter(
      (anchor) =>
        (requestedAnchorIds.size === 0 ||
          requestedAnchorIds.has(anchor.anchorId)) &&
        anchor.state !== "deleted"
    ) ?? [];
  const matchByPreviousEntity = new Map(
    matchResponse.matchResults.flatMap((result) => {
      const key = createCheckpointEntityKey(
        result.previousCheckpointId,
        result.previousCheckpointEntityId
      );
      return key ? [[key, result] as const] : [];
    })
  );
  const anchorGroups = anchors.flatMap((anchor) => {
    const key = createCheckpointEntityKey(
      anchor.checkpointId,
      anchor.checkpointEntityId
    );

    if (!key) {
      return [];
    }

    const match = matchByPreviousEntity.get(key);

    if (!match) {
      return [];
    }

    return [
      createAnchorGroup({
        anchor,
        match,
        repairCandidates: candidateByPreviousEntity.get(key) ?? []
      })
    ];
  });
  const scopedCandidateIds = new Set(
    anchorGroups.flatMap((group) =>
      group.repairCandidates.map((candidate) => candidate.candidateId)
    )
  );
  const unscopedRepairCandidates = matchResponse.repairCandidates.filter(
    (candidate) => !scopedCandidateIds.has(candidate.candidateId)
  );
  const missingAnchorDiagnostics = [...requestedAnchorIds]
    .filter(
      (anchorId) =>
        !topologyIdentity?.anchors.some(
          (anchor) => anchor.anchorId === anchorId
        )
    )
    .map((anchorId) =>
      createDiagnostic(
        "TOPOLOGY_SOURCE_CONTRACT_INVALID",
        "error",
        `Topology anchor ${anchorId} does not exist for repair candidate grouping.`,
        { anchorId, expected: "existing topology anchor source record" }
      )
    );
  const unscopedDiagnostics =
    unscopedRepairCandidates.length > 0
      ? [
          createDiagnostic(
            "TOPOLOGY_REPAIR_COMMANDS_DEFERRED",
            "warning",
            "Some topology repair candidates do not map to current topology anchors and remain snapshot-level evidence.",
            {
              expected:
                "previous checkpoint/entity pair backed by a current topology anchor",
              received: `${unscopedRepairCandidates.length} unscoped repair candidate(s)`
            }
          )
        ]
      : [];
  const noIdentityDiagnostics = topologyIdentity
    ? []
    : [
        createDiagnostic(
          "TOPOLOGY_SOURCE_CONTRACT_INVALID",
          "error",
          "Topology anchor repair candidate grouping requires topology identity source records.",
          { expected: "document topologyIdentity anchors" }
        )
      ];
  const noGroupDiagnostics =
    topologyIdentity && anchorGroups.length === 0 && requestedAnchorIds.size > 0
      ? [
          createDiagnostic(
            "TOPOLOGY_REPAIR_COMMANDS_DEFERRED",
            "warning",
            "No requested topology anchors matched the provided previous snapshot evidence.",
            {
              expected:
                "requested anchor checkpoint/entity evidence in previous snapshot",
              received: "no anchor repair candidate groups"
            }
          )
        ]
      : [];
  const diagnostics = [
    ...anchorGroups.flatMap((group) => group.diagnostics),
    ...matchResponse.diagnostics,
    ...unscopedDiagnostics,
    ...missingAnchorDiagnostics,
    ...noIdentityDiagnostics,
    ...noGroupDiagnostics
  ];

  return {
    ok: true,
    query: "topology.anchorRepairCandidates",
    cadOpsVersion,
    status:
      anchorGroups.length > 0
        ? chooseOverallState(anchorGroups.map((group) => group.state))
        : topologyIdentity
          ? matchResponse.status
          : "missing",
    anchorFilterCount: requestedAnchorIds.size,
    anchorIds: [...requestedAnchorIds],
    previousSnapshot: matchResponse.previousSnapshot,
    candidateSnapshotCount: matchResponse.candidateSnapshotCount,
    candidateSnapshots: matchResponse.candidateSnapshots,
    matchResultCount: matchResponse.resultCount,
    matchResults: matchResponse.matchResults,
    anchorGroupCount: anchorGroups.length,
    anchorGroups,
    unscopedRepairCandidateCount: unscopedRepairCandidates.length,
    unscopedRepairCandidates,
    diagnosticCount: diagnostics.length,
    diagnostics,
    sourceBoundaryNote: SOURCE_BOUNDARY_NOTE,
    derivedBoundaryNote: DERIVED_BOUNDARY_NOTE,
    mutatesSource: false
  };
}

function createAnchorGroup({
  anchor,
  match,
  repairCandidates
}: {
  readonly anchor: CadTopologyAnchorSourceRecord;
  readonly match: CadTopologyMatchResult;
  readonly repairCandidates: readonly CadTopologyRepairCandidate[];
}): CadTopologyAnchorRepairCandidateGroup {
  const diagnostics: readonly CadTopologyIdentityDiagnostic[] =
    repairCandidates.length > 0
      ? [
          createDiagnostic(
            "TOPOLOGY_REPAIR_COMMANDS_READY",
            "info",
            `Topology anchor ${anchor.anchorId} has scoped repair candidate evidence.`,
            {
              anchorId: anchor.anchorId,
              bodyId: anchor.bodyId,
              checkpointId: anchor.checkpointId,
              entityKind: anchor.entityKind
            }
          ),
          ...match.diagnostics
        ]
      : match.state === "active"
        ? [
            createDiagnostic(
              "TOPOLOGY_MATCH_EXACT",
              "info",
              `Topology anchor ${anchor.anchorId} is still active in the provided match evidence.`,
              {
                anchorId: anchor.anchorId,
                bodyId: anchor.bodyId,
                checkpointId: anchor.checkpointId,
                entityKind: anchor.entityKind
              }
            ),
            ...match.diagnostics
          ]
        : [
            createDiagnostic(
              "TOPOLOGY_REPAIR_COMMANDS_DEFERRED",
              "warning",
              `Topology anchor ${anchor.anchorId} has match state ${match.state} but no repair candidate evidence.`,
              {
                anchorId: anchor.anchorId,
                bodyId: anchor.bodyId,
                checkpointId: anchor.checkpointId,
                entityKind: anchor.entityKind,
                expected: "repair candidate evidence"
              }
            ),
            ...match.diagnostics
          ];

  return {
    anchorId: anchor.anchorId,
    target: { type: "topologyAnchor", anchorId: anchor.anchorId },
    bodyId: anchor.bodyId,
    entityKind: anchor.entityKind,
    state: match.state,
    confidence: match.confidence,
    ...(match.confidenceScore !== undefined
      ? { confidenceScore: match.confidenceScore }
      : {}),
    ...(match.previousCheckpointId
      ? { previousCheckpointId: match.previousCheckpointId }
      : {}),
    ...(match.previousCheckpointEntityId
      ? { previousCheckpointEntityId: match.previousCheckpointEntityId }
      : {}),
    ...(match.candidateCheckpointId
      ? { candidateCheckpointId: match.candidateCheckpointId }
      : {}),
    ...(match.candidateCheckpointEntityId
      ? { candidateCheckpointEntityId: match.candidateCheckpointEntityId }
      : {}),
    repairPlanQuery: "topology.anchorRepairPlan",
    candidateIdScope: "topology-match-preview",
    repairCandidateCount: repairCandidates.length,
    repairCandidates,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createCheckpointEntityKey(
  checkpointId: string | undefined,
  checkpointEntityId: string | undefined
): string | undefined {
  if (!checkpointId || !checkpointEntityId) {
    return undefined;
  }

  return `${checkpointId}:${checkpointEntityId}`;
}

function createDiagnostic(
  code: CadTopologyIdentityDiagnosticCode,
  severity: CadTopologyIdentityDiagnostic["severity"],
  message: string,
  details: Omit<
    CadTopologyIdentityDiagnostic,
    "code" | "status" | "severity" | "message"
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

function chooseOverallState(
  states: readonly CadTopologyIdentityState[]
): CadTopologyIdentityState {
  const priority: readonly CadTopologyIdentityState[] = [
    "failed",
    "unsupported",
    "ambiguous",
    "repair-needed",
    "split",
    "merged",
    "deleted",
    "stale",
    "missing",
    "replaced",
    "consumed",
    "deferred",
    "active"
  ];

  return (
    priority.find((state) => states.includes(state)) ??
    ("active" satisfies CadTopologyIdentityState)
  );
}

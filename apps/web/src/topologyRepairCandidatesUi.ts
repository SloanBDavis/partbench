import type {
  CadTopologyAnchorRepairPlanStatus,
  CadTopologyAnchorEntityKind,
  CadTopologyMatchConfidence,
  CadTopologyRepairCandidate,
  CadTopologyIdentityState
} from "@web-cad/cad-protocol";

export interface TopologyRepairCandidatePreviewInput {
  readonly status: CadTopologyAnchorRepairPlanStatus;
  readonly repairCandidates: readonly CadTopologyRepairCandidate[];
}

export interface TopologyRepairCandidatePreview {
  readonly summary: string;
  readonly candidateCount: number;
  readonly rows: readonly TopologyRepairCandidatePreviewRow[];
}

export interface TopologyRepairCandidatePreviewRow {
  readonly candidateId: string;
  readonly entityKind: string;
  readonly state: string;
  readonly confidence: string;
  readonly action: string;
  readonly repairable: boolean;
}

export interface TopologyRepairCandidatePreviewState {
  readonly key: string;
  readonly pending: boolean;
  readonly preview?: TopologyRepairCandidatePreview;
  readonly error?: string;
}

export function createTopologyRepairCandidatePreview({
  status,
  repairCandidates
}: TopologyRepairCandidatePreviewInput): TopologyRepairCandidatePreview {
  const rows = repairCandidates.map(createTopologyRepairCandidatePreviewRow);
  const candidateCount = repairCandidates.length;
  const action = getPreviewActionLabel(repairCandidates);
  const summary =
    candidateCount === 0
      ? `${formatRepairPlanStatus(status)} · no repair candidates`
      : `${candidateCount} ${pluralize("candidate", candidateCount)} · ${formatRepairPlanStatus(status)} · ${action}`;

  return {
    summary,
    candidateCount,
    rows
  };
}

export function createTopologyRepairPreviewKey({
  bodyId,
  stableId,
  kind,
  topologyAnchorId
}: {
  readonly bodyId: string;
  readonly stableId: string;
  readonly kind: CadTopologyAnchorEntityKind;
  readonly topologyAnchorId?: string;
}): string {
  return [bodyId, stableId, kind, topologyAnchorId ?? ""].join("\u0000");
}

function createTopologyRepairCandidatePreviewRow(
  candidate: CadTopologyRepairCandidate
): TopologyRepairCandidatePreviewRow {
  return {
    candidateId: candidate.candidateId,
    entityKind: formatEntityKind(candidate.entityKind),
    state: formatCandidateState(candidate.state),
    confidence: `${formatConfidence(candidate.confidence)} confidence`,
    action: formatRecommendedAction(candidate.recommendedAction),
    repairable: candidate.recommendedAction === "manual-repair-plan"
  };
}

function getPreviewActionLabel(
  candidates: readonly CadTopologyRepairCandidate[]
): string {
  if (
    candidates.some(
      (candidate) => candidate.recommendedAction === "manual-repair-plan"
    )
  ) {
    return "manual choice required";
  }

  if (
    candidates.some((candidate) => candidate.recommendedAction === "inspect")
  ) {
    return "inspect before repair";
  }

  if (candidates.length > 0) {
    return "not repairable";
  }

  return "no action";
}

function formatRepairPlanStatus(status: CadTopologyAnchorRepairPlanStatus) {
  switch (status) {
    case "ready":
      return "Ready";
    case "alreadyCurrent":
      return "Already current";
    case "missing":
      return "Missing";
    case "unsupported":
      return "Unsupported";
    case "ambiguous":
      return "Ambiguous";
  }
}

function formatEntityKind(kind: CadTopologyAnchorEntityKind): string {
  switch (kind) {
    case "body":
      return "Body";
    case "face":
      return "Face";
    case "edge":
      return "Edge";
    case "vertex":
      return "Vertex";
    default:
      return "Topology entity";
  }
}

function formatCandidateState(
  state: Extract<
    CadTopologyIdentityState,
    "replaced" | "split" | "merged" | "ambiguous" | "repair-needed" | "deleted"
  >
): string {
  switch (state) {
    case "replaced":
      return "Replaced";
    case "split":
      return "Split";
    case "merged":
      return "Merged";
    case "ambiguous":
      return "Ambiguous";
    case "repair-needed":
      return "Repair needed";
    case "deleted":
      return "Deleted";
  }
}

function formatConfidence(confidence: CadTopologyMatchConfidence): string {
  switch (confidence) {
    case "exact":
      return "Exact";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    case "none":
      return "No";
  }
}

function formatRecommendedAction(
  action: CadTopologyRepairCandidate["recommendedAction"]
): string {
  switch (action) {
    case "inspect":
      return "Inspect";
    case "manual-repair-plan":
      return "Manual repair plan";
    case "not-repairable":
      return "Not repairable";
  }
}

function pluralize(noun: string, count: number): string {
  return count === 1 ? noun : `${noun}s`;
}

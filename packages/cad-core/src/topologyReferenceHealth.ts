import type {
  BodyId,
  CadFeatureEditDiagnosticCode,
  CadFeatureReferenceChangeCategory,
  CadFeatureReferenceChangeSummary,
  CadGeneratedReference,
  CadGeneratedEntityKind,
  CadReferenceHealthDiagnostic,
  CadReferenceHealthDiagnosticCode,
  CadReferenceHealthEntry,
  CadReferenceHealthStatus,
  CadSelectionReferenceOperation,
  CadTopologyAnchorEntityKind,
  CadTopologyAnchorSourceRecord,
  CadTopologyCheckpointSourceRecord,
  CadTopologyIdentityDiagnostic,
  CadTopologyIdentitySourceSnapshot,
  CadTopologyIdentityState,
  CadTopologyMatchResult,
  FeatureId,
  PartId
} from "@web-cad/cad-protocol";

import type { GeneratedReferencesDocument } from "./generatedReferences";
import { resolveTopologyAnchorGeneratedReferenceFromSourceRole } from "./topologyAnchorGeneratedReferenceResolution";

export interface TopologyReferenceHealthInput {
  readonly document?: GeneratedReferencesDocument;
  readonly ownerPartId?: PartId;
  readonly topologyIdentity?: CadTopologyIdentitySourceSnapshot;
  readonly topologyMatchResults?: readonly CadTopologyMatchResult[];
}

export function createTopologyAnchorReferenceHealthEntries({
  document,
  ownerPartId,
  topologyIdentity,
  topologyMatchResults = []
}: TopologyReferenceHealthInput): readonly CadReferenceHealthEntry[] {
  if (!topologyIdentity) {
    return [];
  }

  const checkpointsById = new Map(
    topologyIdentity.checkpoints.map((checkpoint) => [
      checkpoint.checkpointId,
      checkpoint
    ])
  );
  const matchesByAnchorId = createMatchesByAnchorId(topologyMatchResults);

  return topologyIdentity.anchors.map((anchor) =>
    createTopologyAnchorReferenceHealth({
      anchor,
      checkpoint: checkpointsById.get(anchor.checkpointId),
      match: matchesByAnchorId.get(anchor.anchorId),
      generatedReference:
        !anchor.stableId && document && ownerPartId
          ? resolveTopologyAnchorGeneratedReferenceFromSourceRole({
              document,
              ownerPartId,
              bodyId: anchor.bodyId,
              entityKind: anchor.entityKind,
              sourceSemanticRole: anchor.sourceSemanticRole
            })
          : undefined
    })
  );
}

export function createTopologyAnchorReferenceChangesForBody({
  topologyIdentity,
  topologyMatchResults = [],
  bodyId,
  sourceFeatureId,
  targetFeatureId,
  fallbackCategory,
  diagnosticCode,
  fallbackMessage
}: TopologyReferenceHealthInput & {
  readonly bodyId: BodyId;
  readonly sourceFeatureId: FeatureId;
  readonly targetFeatureId?: FeatureId;
  readonly fallbackCategory: CadFeatureReferenceChangeCategory;
  readonly diagnosticCode?: CadFeatureEditDiagnosticCode;
  readonly fallbackMessage: string;
}): readonly CadFeatureReferenceChangeSummary[] {
  if (!topologyIdentity) {
    return [];
  }

  const matchesByAnchorId = createMatchesByAnchorId(topologyMatchResults);

  return topologyIdentity.anchors
    .filter((anchor) => anchor.bodyId === bodyId)
    .map((anchor) => {
      const match = matchesByAnchorId.get(anchor.anchorId);
      const category = match
        ? referenceCategoryFromTopologyState(match.state)
        : fallbackCategory;

      return {
        category,
        bodyId: anchor.bodyId,
        ...(anchor.stableId ? { stableId: anchor.stableId } : {}),
        kind: anchor.entityKind,
        topologyAnchorId: anchor.anchorId,
        checkpointId: anchor.checkpointId,
        ...(match ? { matchConfidence: match.confidence } : {}),
        sourceFeatureId,
        ...(targetFeatureId ? { targetFeatureId } : {}),
        ...(diagnosticCode ? { diagnosticCode } : {}),
        message: match
          ? `Topology anchor ${anchor.anchorId} is ${category} after topology matching.`
          : fallbackMessage
      };
    });
}

function createTopologyAnchorReferenceHealth({
  anchor,
  checkpoint,
  match,
  generatedReference
}: {
  readonly anchor: CadTopologyAnchorSourceRecord;
  readonly checkpoint?: CadTopologyCheckpointSourceRecord;
  readonly match?: CadTopologyMatchResult;
  readonly generatedReference?: ReturnType<
    typeof resolveTopologyAnchorGeneratedReferenceFromSourceRole
  >;
}): CadReferenceHealthEntry {
  const status = createTopologyAnchorStatus(anchor, checkpoint, match);
  const resolvedReference =
    generatedReference?.status === "resolved"
      ? generatedReference.reference
      : undefined;
  const stableId = anchor.stableId ?? resolvedReference?.stableId;
  const diagnostics = createTopologyAnchorDiagnostics(
    anchor,
    checkpoint,
    match
  );
  const commandOperations = createTopologyAnchorCommandOperations(
    anchor,
    status,
    resolvedReference
  );

  return {
    source: "topologyAnchor",
    status,
    commandable: commandOperations.length > 0,
    commandOperations,
    label: anchor.sourceSemanticRole ?? anchor.stableId ?? anchor.anchorId,
    bodyId: anchor.bodyId,
    ...(stableId ? { stableId } : {}),
    kind: generatedKindFromAnchorKind(anchor.entityKind),
    topologyAnchorId: anchor.anchorId,
    topologyEntityKind: anchor.entityKind,
    checkpointId: anchor.checkpointId,
    ...(match
      ? { matchConfidence: match.confidence, matchState: match.state }
      : {}),
    sourceFeatureId: anchor.sourceFeatureId,
    dependencies: {
      sketchIds: [],
      sketchEntityIds: [],
      featureIds: anchor.sourceFeatureId ? [anchor.sourceFeatureId] : [],
      bodyIds: [anchor.bodyId],
      generatedReferenceStableIds: stableId ? [stableId] : [],
      namedReferenceNames: [],
      topologyAnchorIds: [anchor.anchorId],
      checkpointIds: [anchor.checkpointId]
    },
    diagnosticCount: diagnostics.length,
    diagnostics
  };
}

function createTopologyAnchorCommandOperations(
  anchor: CadTopologyAnchorSourceRecord,
  status: CadReferenceHealthStatus,
  generatedReference?: CadGeneratedReference
): readonly CadSelectionReferenceOperation[] {
  if (status !== "active") {
    return [];
  }

  if (generatedReference) {
    return generatedReference.eligibleOperations.filter(
      (operation) =>
        operation === "feature.measureReference" ||
        operation === "feature.selectReference"
    ) as readonly CadSelectionReferenceOperation[];
  }

  if (!anchor.stableId) {
    return [];
  }

  return canMeasureTopologyAnchor(anchor)
    ? ["feature.measureReference", "feature.selectReference"]
    : ["feature.selectReference"];
}

function canMeasureTopologyAnchor(
  anchor: CadTopologyAnchorSourceRecord
): boolean {
  return (
    Boolean(anchor.stableId) &&
    (anchor.entityKind === "face" ||
      anchor.entityKind === "edge" ||
      anchor.entityKind === "vertex")
  );
}

function createTopologyAnchorStatus(
  anchor: CadTopologyAnchorSourceRecord,
  checkpoint: CadTopologyCheckpointSourceRecord | undefined,
  match: CadTopologyMatchResult | undefined
): CadReferenceHealthStatus {
  if (!checkpoint) {
    return "missing";
  }

  const checkpointStatus = referenceStatusFromTopologyState(checkpoint.status);
  if (checkpointStatus !== "active") {
    return checkpointStatus;
  }

  if (match) {
    return referenceStatusFromTopologyState(match.state);
  }

  return referenceStatusFromTopologyState(anchor.state);
}

export function createTopologyAnchorReferenceStatusForSelection(args: {
  readonly anchor: CadTopologyAnchorSourceRecord;
  readonly checkpoint?: CadTopologyCheckpointSourceRecord;
  readonly match?: CadTopologyMatchResult;
}): CadReferenceHealthStatus {
  return createTopologyAnchorStatus(args.anchor, args.checkpoint, args.match);
}

export function createTopologyAnchorCommandOperationsForSelection(
  anchor: CadTopologyAnchorSourceRecord,
  status: CadReferenceHealthStatus
): readonly CadSelectionReferenceOperation[] {
  return createTopologyAnchorCommandOperations(anchor, status);
}

function createTopologyAnchorDiagnostics(
  anchor: CadTopologyAnchorSourceRecord,
  checkpoint: CadTopologyCheckpointSourceRecord | undefined,
  match: CadTopologyMatchResult | undefined
): readonly CadReferenceHealthDiagnostic[] {
  const diagnostics: CadReferenceHealthDiagnostic[] = [
    ...anchor.diagnostics.map((diagnostic) =>
      diagnosticFromTopologyDiagnostic(anchor, diagnostic)
    )
  ];

  if (!checkpoint) {
    diagnostics.push(
      createDiagnostic({
        code: "REFERENCE_TOPOLOGY_CHECKPOINT_MISSING",
        severity: "blocker",
        status: "missing",
        message: `Topology anchor ${anchor.anchorId} targets missing checkpoint ${anchor.checkpointId}.`,
        anchor,
        expected: "topology checkpoint source record",
        received: anchor.checkpointId
      })
    );
  } else if (checkpoint.status !== "active") {
    diagnostics.push(
      createDiagnostic({
        code:
          checkpoint.status === "missing"
            ? "REFERENCE_TOPOLOGY_CHECKPOINT_MISSING"
            : checkpoint.status === "unsupported"
              ? "REFERENCE_UNSUPPORTED"
              : checkpoint.status === "failed"
                ? "REFERENCE_UNSUPPORTED"
                : "REFERENCE_STALE",
        severity: checkpoint.status === "missing" ? "blocker" : "warning",
        status: referenceStatusFromTopologyState(checkpoint.status),
        message: `Topology anchor ${anchor.anchorId} checkpoint ${checkpoint.checkpointId} is ${checkpoint.status}.`,
        anchor,
        expected: "active topology checkpoint",
        received: checkpoint.status
      })
    );
  }

  if (match) {
    diagnostics.push(...diagnosticsFromTopologyMatch(anchor, match));
  }

  if (diagnostics.length === 0) {
    diagnostics.push(
      createDiagnostic({
        code: "REFERENCE_ACTIVE",
        severity: "info",
        status: "active",
        message: `Topology anchor ${anchor.anchorId} is active.`,
        anchor
      })
    );
  }

  return diagnostics;
}

function diagnosticsFromTopologyMatch(
  anchor: CadTopologyAnchorSourceRecord,
  match: CadTopologyMatchResult
): readonly CadReferenceHealthDiagnostic[] {
  const status = referenceStatusFromTopologyState(match.state);

  if (status === "active") {
    return [
      createDiagnostic({
        code: "REFERENCE_ACTIVE",
        severity: "info",
        status: "active",
        message: `Topology anchor ${anchor.anchorId} matched with ${match.confidence} confidence.`,
        anchor,
        expected: "active topology match",
        received: match.confidence
      })
    ];
  }

  if (status === "replaced") {
    return [
      createDiagnostic({
        code: "REFERENCE_TOPOLOGY_MATCH_REPLACED",
        severity: "warning",
        status: "replaced",
        message: `Topology anchor ${anchor.anchorId} matched a replacement candidate with ${match.confidence} confidence and requires explicit repair before retargeting.`,
        anchor,
        expected: "explicit topology repair",
        received: match.state
      })
    ];
  }

  if (status === "ambiguous") {
    return [
      createDiagnostic({
        code: "REFERENCE_TOPOLOGY_AMBIGUOUS",
        severity: "warning",
        status: "ambiguous",
        message: `Topology anchor ${anchor.anchorId} has ambiguous topology match state ${match.state}.`,
        anchor,
        expected: "single high-confidence topology match",
        received: match.state
      })
    ];
  }

  if (status === "deleted") {
    return [
      createDiagnostic({
        code: "REFERENCE_DELETED",
        severity: "warning",
        status: "deleted",
        message: `Topology anchor ${anchor.anchorId} no longer matches a surviving topology entity.`,
        anchor,
        expected: "surviving topology entity",
        received: match.state
      })
    ];
  }

  if (status === "repair-needed") {
    return [
      createDiagnostic({
        code: "REFERENCE_TOPOLOGY_MATCH_REPAIR_NEEDED",
        severity: "warning",
        status: "repair-needed",
        message: `Topology anchor ${anchor.anchorId} needs explicit repair before it can be command-ready.`,
        anchor,
        expected: "explicit topology repair",
        received: match.state
      })
    ];
  }

  return [
    createDiagnostic({
      code:
        status === "unsupported" ? "REFERENCE_UNSUPPORTED" : "REFERENCE_STALE",
      severity: status === "missing" ? "blocker" : "warning",
      status,
      message: `Topology anchor ${anchor.anchorId} match state is ${match.state}.`,
      anchor,
      expected: "active topology match",
      received: match.state
    })
  ];
}

function diagnosticFromTopologyDiagnostic(
  anchor: CadTopologyAnchorSourceRecord,
  diagnostic: CadTopologyIdentityDiagnostic
): CadReferenceHealthDiagnostic {
  return createDiagnostic({
    code: referenceDiagnosticCodeFromTopologyState(
      referenceStatusFromTopologyReadiness(diagnostic.status)
    ),
    severity: diagnostic.severity === "error" ? "blocker" : diagnostic.severity,
    status: referenceStatusFromTopologyReadiness(diagnostic.status),
    message: diagnostic.message,
    anchor,
    expected: diagnostic.expected,
    received: diagnostic.received
  });
}

function createDiagnostic(args: {
  readonly code: CadReferenceHealthDiagnosticCode;
  readonly severity: CadReferenceHealthDiagnostic["severity"];
  readonly status: CadReferenceHealthStatus;
  readonly message: string;
  readonly anchor: CadTopologyAnchorSourceRecord;
  readonly expected?: string;
  readonly received?: string;
}): CadReferenceHealthDiagnostic {
  return {
    code: args.code,
    severity: args.severity,
    status: args.status,
    message: args.message,
    bodyId: args.anchor.bodyId,
    stableId: args.anchor.stableId,
    topologyAnchorId: args.anchor.anchorId,
    checkpointId: args.anchor.checkpointId,
    featureId: args.anchor.sourceFeatureId,
    expected: args.expected,
    received: args.received
  };
}

function generatedKindFromAnchorKind(
  kind: CadTopologyAnchorEntityKind
): CadGeneratedEntityKind {
  return kind;
}

function createMatchesByAnchorId(
  matches: readonly CadTopologyMatchResult[]
): ReadonlyMap<string, CadTopologyMatchResult> {
  const result = new Map<string, CadTopologyMatchResult>();

  for (const match of matches) {
    if (match.anchorId && !result.has(match.anchorId)) {
      result.set(match.anchorId, match);
    }
  }

  return result;
}

function referenceStatusFromTopologyState(
  state: CadTopologyIdentityState
): CadReferenceHealthStatus {
  if (state === "split" || state === "merged") {
    return "ambiguous";
  }

  if (state === "failed" || state === "deferred") {
    return "unsupported";
  }

  return state;
}

function referenceStatusFromTopologyReadiness(
  status: CadTopologyIdentityDiagnostic["status"]
): CadReferenceHealthStatus {
  if (status === "supported") {
    return "active";
  }

  if (status === "deferred") {
    return "repair-needed";
  }

  return "unsupported";
}

function referenceCategoryFromTopologyState(
  state: CadTopologyIdentityState
): CadFeatureReferenceChangeCategory {
  return referenceStatusFromTopologyState(state);
}

function referenceDiagnosticCodeFromTopologyState(
  status: CadReferenceHealthStatus
): CadReferenceHealthDiagnosticCode {
  if (status === "active") {
    return "REFERENCE_ACTIVE";
  }

  if (status === "deleted") {
    return "REFERENCE_DELETED";
  }

  if (status === "ambiguous") {
    return "REFERENCE_TOPOLOGY_AMBIGUOUS";
  }

  if (status === "unsupported") {
    return "REFERENCE_UNSUPPORTED";
  }

  if (status === "repair-needed") {
    return "REFERENCE_REPAIR_NEEDED";
  }

  if (status === "replaced") {
    return "REFERENCE_TOPOLOGY_MATCH_REPLACED";
  }

  if (status === "missing") {
    return "REFERENCE_TARGET_MISSING";
  }

  return "REFERENCE_STALE";
}

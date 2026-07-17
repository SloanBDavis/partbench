import type {
  BodyId,
  CadTopologyAnchorEntityKind,
  CadTopologyIdentitySourceSnapshot,
  FeatureId
} from "@web-cad/cad-protocol";

export interface TopologyAnchorTargetFeature {
  readonly id: FeatureId;
  readonly kind: string;
  readonly bodyId: BodyId;
  readonly operationMode?: string;
  readonly targetBodyId?: BodyId;
  readonly targetTopologyAnchorId?: string;
}

export interface ActiveTopologyAnchorTarget {
  readonly bodyId: BodyId;
  readonly stableId?: string;
  readonly sourceSemanticRole?: string;
  readonly topologyAnchorId: string;
  readonly checkpointId: string;
}

export type TopologyAnchorTargetResolutionIssue =
  | {
      readonly code: "invalid-id" | "anchor-not-found";
      readonly topologyAnchorId: string;
    }
  | {
      readonly code: "checkpoint-not-found";
      readonly topologyAnchorId: string;
      readonly bodyId: BodyId;
      readonly checkpointId: string;
    }
  | {
      readonly code: "inactive";
      readonly topologyAnchorId: string;
      readonly bodyId: BodyId;
      readonly checkpointId: string;
      readonly anchorState: string;
      readonly checkpointStatus: string;
    }
  | {
      readonly code: "kind-mismatch";
      readonly topologyAnchorId: string;
      readonly bodyId: BodyId;
      readonly checkpointId: string;
      readonly expectedKind: CadTopologyAnchorEntityKind;
      readonly actualKind: CadTopologyAnchorEntityKind;
    };

export type TopologyAnchorTargetResolution =
  | { readonly ok: true; readonly target: ActiveTopologyAnchorTarget }
  | { readonly ok: false; readonly issue: TopologyAnchorTargetResolutionIssue };

export function resolveActiveTopologyAnchorTargetSource(
  topologyIdentity: CadTopologyIdentitySourceSnapshot | undefined,
  topologyAnchorId: string,
  expectedKind: CadTopologyAnchorEntityKind
): TopologyAnchorTargetResolution {
  const anchorId = topologyAnchorId.trim();
  if (anchorId.length === 0) {
    return {
      ok: false,
      issue: { code: "invalid-id", topologyAnchorId }
    };
  }

  const anchor = topologyIdentity?.anchors.find(
    (candidate) => candidate.anchorId === anchorId
  );
  if (!topologyIdentity || !anchor) {
    return {
      ok: false,
      issue: { code: "anchor-not-found", topologyAnchorId: anchorId }
    };
  }

  const checkpoint = topologyIdentity.checkpoints.find(
    (candidate) => candidate.checkpointId === anchor.checkpointId
  );
  if (!checkpoint) {
    return {
      ok: false,
      issue: {
        code: "checkpoint-not-found",
        topologyAnchorId: anchor.anchorId,
        bodyId: anchor.bodyId,
        checkpointId: anchor.checkpointId
      }
    };
  }

  if (checkpoint.status !== "active" || anchor.state !== "active") {
    return {
      ok: false,
      issue: {
        code: "inactive",
        topologyAnchorId: anchor.anchorId,
        bodyId: anchor.bodyId,
        checkpointId: anchor.checkpointId,
        anchorState: anchor.state,
        checkpointStatus: checkpoint.status
      }
    };
  }

  if (anchor.entityKind !== expectedKind) {
    return {
      ok: false,
      issue: {
        code: "kind-mismatch",
        topologyAnchorId: anchor.anchorId,
        bodyId: anchor.bodyId,
        checkpointId: anchor.checkpointId,
        expectedKind,
        actualKind: anchor.entityKind
      }
    };
  }

  return {
    ok: true,
    target: {
      bodyId: anchor.bodyId,
      ...(anchor.stableId ? { stableId: anchor.stableId } : {}),
      ...(anchor.sourceSemanticRole
        ? { sourceSemanticRole: anchor.sourceSemanticRole }
        : {}),
      topologyAnchorId: anchor.anchorId,
      checkpointId: anchor.checkpointId
    }
  };
}

export function resolveActiveTopologyAnchorBodyTargetId(
  features: ReadonlyMap<FeatureId, TopologyAnchorTargetFeature>,
  target: Pick<ActiveTopologyAnchorTarget, "bodyId" | "topologyAnchorId">
): BodyId {
  let activeBodyId = target.bodyId;
  const visitedBodyIds = new Set<BodyId>();

  while (!visitedBodyIds.has(activeBodyId)) {
    visitedBodyIds.add(activeBodyId);
    const consumingFeature = [...features.values()].find(
      (feature) => feature.targetBodyId === activeBodyId
    );
    if (
      consumingFeature?.kind !== "extrude" ||
      (consumingFeature.operationMode !== "add" &&
        consumingFeature.operationMode !== "cut") ||
      consumingFeature.targetTopologyAnchorId !== target.topologyAnchorId
    ) {
      return activeBodyId;
    }
    activeBodyId = consumingFeature.bodyId;
  }

  return activeBodyId;
}

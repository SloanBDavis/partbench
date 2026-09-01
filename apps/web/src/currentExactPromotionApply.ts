import { sha256Hex, type CadEngine } from "@web-cad/cad-core";
import type {
  CadBodyExactTopologyEntityDescriptor,
  CadCurrentTopologySelectionEvidence,
  CadOp,
  CadSelectionReferenceOperation,
  CadTopologyAnchorCommandProof
} from "@web-cad/cad-protocol";
import type { SolidCollectorRequest } from "./modes/solid/solidEditorTypes";

const AXES = ["x", "y", "z"] as const;

export type CurrentExactPromotionCollector =
  SolidCollectorRequest["collector"];

export interface CurrentExactPromotionApplyInput {
  readonly engine: CadEngine;
  readonly evidence: CadCurrentTopologySelectionEvidence;
  readonly requiredOperation: CadSelectionReferenceOperation;
  readonly entity: CadBodyExactTopologyEntityDescriptor;
  readonly consumingOps: readonly CadOp[];
}

export type CurrentExactPromotionApplyResult =
  | {
      readonly ok: true;
      readonly topologyAnchorId: string;
      readonly checkpointId: string;
      readonly proof: CadTopologyAnchorCommandProof;
      readonly ops: readonly CadOp[];
    }
  | { readonly ok: false };

export function mapCollectorToRequiredOperation(
  collector: CurrentExactPromotionCollector | undefined
): CadSelectionReferenceOperation | undefined {
  switch (collector) {
    case "edge":
      return "feature.chamfer";
    case "openFaces":
      return "feature.shell";
    case "direction":
      return "feature.linearPatternDirection";
    case "rotationAxis":
      return "feature.circularPatternAxis";
    case "mirrorPlane":
      return "feature.mirrorPlane";
    default:
      return undefined;
  }
}

export function queryCurrentExactPromotionCandidate(
  engine: CadEngine,
  evidence: CadCurrentTopologySelectionEvidence,
  requiredOperation?: CadSelectionReferenceOperation
) {
  return engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "selection.referenceCandidates",
      currentTopologyEvidence: evidence,
      ...(requiredOperation ? { requiredOperation } : {})
    }
  });
}

export function prependCurrentExactPromotionOps(
  input: CurrentExactPromotionApplyInput
): CurrentExactPromotionApplyResult {
  const response = queryCurrentExactPromotionCandidate(
    input.engine,
    input.evidence,
    input.requiredOperation
  );
  if (
    !response.ok ||
    response.query !== "selection.referenceCandidates" ||
    response.currentTopology?.outcome !== "promotableGeneratedMatch"
  ) {
    return { ok: false };
  }

  const candidate = response.candidates.find(
    (entry) =>
      entry.commandable &&
      entry.target.type === "topologyAnchor" &&
      entry.target.bodyId === input.evidence.bodyId &&
      entry.target.kind === input.evidence.entityKind
  );
  if (!candidate || candidate.target.type !== "topologyAnchor") {
    return { ok: false };
  }

  const proof = createCurrentExactTopologyAnchorCommandProof(
    input.evidence.entityKind,
    input.entity
  );
  if (!proof) {
    return { ok: false };
  }

  const sourceFeatureId = candidate.reference.sourceFeatureId;
  const publicHash = sha256Hex(
    new TextEncoder().encode(
      JSON.stringify({
        bodyId: input.evidence.bodyId,
        entityKind: input.evidence.entityKind,
        entitySignature: input.evidence.entitySignature,
        sourceFeatureId
      })
    )
  );
  const topologyAnchorId = `topology_anchor_current_${publicHash.slice(0, 24)}`;
  const activeCheckpoint = input.engine
    .getDocument()
    .topologyIdentity?.checkpoints.find(
      (checkpoint) =>
        checkpoint.bodyId === input.evidence.bodyId &&
        checkpoint.status === "active"
    );
  const checkpointId =
    activeCheckpoint?.checkpointId ??
    `topology_checkpoint_current_${publicHash.slice(0, 24)}`;
  const prefix: CadOp[] = [];
  if (!activeCheckpoint) {
    prefix.push({
      op: "topology.checkpoint.create",
      checkpointId,
      bodyId: input.evidence.bodyId,
      sourceFeatureId,
      sourceIdentity: {
        algorithm: "partbench-source-v1",
        sha256: publicHash
      },
      status: "active"
    });
  }
  prefix.push({
    op: "topology.anchor.create",
    anchorId: topologyAnchorId,
    entityKind: candidate.target.kind,
    bodyId: input.evidence.bodyId,
    checkpointId,
    checkpointEntityId: input.evidence.localId,
    sourceFeatureId,
    signatureHash: input.evidence.entitySignature
  });

  return {
    ok: true,
    topologyAnchorId,
    checkpointId,
    proof,
    ops: [
      ...prefix,
      ...rewriteConsumingOps(
        input.consumingOps,
        input.evidence.bodyId,
        topologyAnchorId,
        proof
      )
    ]
  };
}

export function createCurrentExactTopologyAnchorCommandProof(
  kind: CadCurrentTopologySelectionEvidence["entityKind"] | string,
  entity: Pick<CadBodyExactTopologyEntityDescriptor, "bounds" | "length">
): CadTopologyAnchorCommandProof | undefined {
  const bounds = entity.bounds;
  if (!bounds) {
    return undefined;
  }

  const spans = AXES.map((axis, index) => {
    const min = bounds.min[index] ?? 0;
    const max = bounds.max[index] ?? 0;
    return {
      axis,
      span: Math.abs(max - min),
      coordinate: min
    };
  });
  const zeroSpans = spans.filter((entry) => entry.span === 0);
  const nonzeroSpans = spans.filter((entry) => entry.span !== 0);

  if (kind === "face" && zeroSpans.length === 1 && zeroSpans[0]) {
    return {
      kind: "axisAlignedPlanarFace",
      entityKind: "face",
      evidenceSource: "checkpointSnapshot",
      exposesCheckpointLocalIds: false,
      planarAxis: zeroSpans[0].axis,
      planarCoordinate: zeroSpans[0].coordinate
    };
  }

  if (kind === "edge" && nonzeroSpans.length === 1 && nonzeroSpans[0]) {
    return {
      kind: "axisAlignedLinearEdge",
      entityKind: "edge",
      evidenceSource: "checkpointSnapshot",
      exposesCheckpointLocalIds: false,
      bounds,
      linearAxis: nonzeroSpans[0].axis,
      length: entity.length ?? nonzeroSpans[0].span
    };
  }

  return undefined;
}

function omitFields<T extends object>(
  value: T,
  ...keys: readonly (keyof T)[]
): T {
  const next = { ...value };
  for (const key of keys) {
    delete next[key];
  }
  return next;
}

function rewriteConsumingOps(
  ops: readonly CadOp[],
  bodyId: string,
  topologyAnchorId: string,
  proof: CadTopologyAnchorCommandProof
): readonly CadOp[] {
  const topologyAnchor = {
    kind: "topologyAnchor" as const,
    bodyId,
    anchorId: topologyAnchorId
  };

  return ops.map((op) => {
    switch (op.op) {
      case "sketch.createOnFace":
        return {
          ...omitFields(op, "faceStableId", "referenceName"),
          topologyAnchorId,
          topologyAnchorProof: proof
        };
      case "feature.chamfer":
      case "feature.fillet":
        return {
          ...omitFields(op, "edgeStableId", "namedReference"),
          topologyAnchorId,
          topologyAnchorProof: proof
        };
      case "feature.shell":
      case "feature.updateShell":
        return {
          ...op,
          openFaceRefs: [topologyAnchor]
        };
      case "feature.linearPattern":
      case "feature.updateLinearPattern":
        return {
          ...omitFields(op, "axis"),
          direction: topologyAnchor,
          topologyAnchorProof: proof
        };
      case "feature.circularPattern":
      case "feature.updateCircularPattern":
        return {
          ...op,
          rotationAxis: topologyAnchor,
          topologyAnchorProof: proof
        };
      case "feature.mirror":
      case "feature.updateMirror":
        return {
          ...omitFields(op, "mirrorPlane"),
          plane: topologyAnchor,
          topologyAnchorProof: proof
        };
      default:
        return op;
    }
  });
}

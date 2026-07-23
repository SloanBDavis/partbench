import type {
  CadBodySnapshot,
  CadFeatureSummary,
  CadGeneratedEdgeReference,
  CadGeneratedReference,
  CadTopologyAnchorCommandProof,
  NamedGeneratedReferenceEntry,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import type { FeatureEdgeFinishForm } from "./cadCommands";
import type { GeneratedReferenceSelectionState } from "./generatedReferenceSelection";

export type EdgeFinishOperation = "chamfer" | "fillet";

export const SELECTED_EDGE_FINISH_REFERENCE_VALUE =
  "__selected_generated_edge__";

export interface EdgeFinishDraft {
  readonly id: string;
  readonly bodyId: string;
  readonly name: string;
  readonly distance: number;
  readonly radius: number;
}

export interface EdgeFinishReferenceOption {
  readonly value: string;
  readonly kind: "generated" | "named";
  readonly label: string;
  readonly edgeStableId?: string;
  readonly namedReference?: string;
  readonly topologyAnchorId?: string;
  readonly topologyAnchorProof?: CadTopologyAnchorCommandProof;
  readonly reference?: CadGeneratedEdgeReference;
  readonly status: "resolved" | "stale";
}

export interface EdgeFinishOperationStatus {
  readonly available: boolean;
  readonly message: string;
}

export function createNamedEdgeFinishReferenceValue(name: string): string {
  return `named:${name}`;
}

export function createEdgeFinishReferenceOptions(
  state: GeneratedReferenceSelectionState,
  namedReferences: readonly NamedGeneratedReferenceEntry[],
  selectionReferenceCandidates?: SelectionReferenceCandidatesQueryResponse,
  topologyAnchorProof?: CadTopologyAnchorCommandProof
): readonly EdgeFinishReferenceOption[] {
  if (state.status !== "selected" || state.reference.kind !== "edge") {
    return [];
  }

  const selectedReference = state.reference;
  const topologyAnchorId =
    state.selection.topologyAnchorId ??
    findSelectedTopologyAnchorId(
      selectedReference,
      selectionReferenceCandidates
    );
  const selectedOption: EdgeFinishReferenceOption = {
    value: SELECTED_EDGE_FINISH_REFERENCE_VALUE,
    kind: "generated",
    label: `Selected edge (${selectedReference.label})`,
    edgeStableId: selectedReference.stableId,
    ...(topologyAnchorId ? { topologyAnchorId } : {}),
    ...(topologyAnchorId && topologyAnchorProof ? { topologyAnchorProof } : {}),
    reference: selectedReference,
    status: "resolved"
  };

  const namedOptions = namedReferences
    .filter(
      (entry) =>
        entry.bodyId === selectedReference.bodyId &&
        entry.stableId === selectedReference.stableId &&
        entry.kind === "edge"
    )
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry): EdgeFinishReferenceOption => {
      const reference =
        entry.status === "resolved" &&
        entry.reference?.kind === "edge" &&
        entry.reference.stableId === selectedReference.stableId
          ? entry.reference
          : undefined;

      return {
        value: createNamedEdgeFinishReferenceValue(entry.name),
        kind: "named",
        label: entry.name,
        namedReference: entry.name,
        reference,
        status: entry.status
      };
    });

  return [selectedOption, ...namedOptions];
}

export function selectEdgeFinishReferenceOption(
  options: readonly EdgeFinishReferenceOption[],
  value: string
): EdgeFinishReferenceOption | undefined {
  return (
    options.find((option) => option.value === value) ??
    options.find((option) => option.status === "resolved")
  );
}

export function getEdgeFinishOperationStatus(input: {
  readonly body?: CadBodySnapshot;
  readonly feature?: CadFeatureSummary;
  readonly operation: EdgeFinishOperation;
  readonly referenceOption?: EdgeFinishReferenceOption;
  readonly scalar: number;
  readonly selectionState: GeneratedReferenceSelectionState;
}): EdgeFinishOperationStatus {
  const operationLabel = formatEdgeFinishOperationLabel(input.operation);

  if (input.selectionState.status === "none") {
    return {
      available: false,
      message: `Select an edge that can be ${formatEdgeFinishPastTense(input.operation)}.`
    };
  }

  if (input.selectionState.status === "stale") {
    return {
      available: false,
      message: `Selected edge is stale. ${input.selectionState.message}`
    };
  }

  const targetMessage = getEdgeFinishTargetUnsupportedMessage(
    input.body,
    input.feature
  );
  if (targetMessage) {
    return { available: false, message: targetMessage };
  }

  if (input.selectionState.reference.kind !== "edge") {
    return {
      available: false,
      message: "Select an edge that can be chamfered or filleted."
    };
  }

  if (!input.referenceOption) {
    return {
      available: false,
      message: "Selected reference is not an eligible edge."
    };
  }

  if (
    input.referenceOption.kind === "named" &&
    input.referenceOption.status !== "resolved"
  ) {
    return {
      available: false,
      message: `Named reference ${input.referenceOption.label} is stale or missing.`
    };
  }

  if (!input.referenceOption.reference) {
    return {
      available: false,
      message:
        input.referenceOption.kind === "named"
          ? `Named reference ${input.referenceOption.label} is stale or missing.`
          : "Selected edge reference is stale or missing."
    };
  }

  const referenceMessage = getEdgeFinishReferenceUnsupportedMessage(
    input.referenceOption.reference,
    input.body?.id,
    input.operation
  );
  if (referenceMessage) {
    return { available: false, message: referenceMessage };
  }

  if (!Number.isFinite(input.scalar) || input.scalar <= 0) {
    return {
      available: false,
      message: `${operationLabel} ${formatEdgeFinishScalarName(input.operation)} must be a positive finite value.`
    };
  }

  return {
    available: true,
    message: `${operationLabel} will create a new result body from the selected edge.`
  };
}

export function buildEdgeFinishForm(input: {
  readonly draft: EdgeFinishDraft;
  readonly operation: EdgeFinishOperation;
  readonly referenceOption?: EdgeFinishReferenceOption;
  readonly targetBodyId: string;
}): FeatureEdgeFinishForm | undefined {
  if (!input.referenceOption || input.referenceOption.status !== "resolved") {
    return undefined;
  }

  const scalar =
    input.operation === "chamfer" ? input.draft.distance : input.draft.radius;
  if (!Number.isFinite(scalar) || scalar <= 0) {
    return undefined;
  }

  if (
    input.referenceOption.kind === "generated" &&
    !input.referenceOption.edgeStableId &&
    !input.referenceOption.topologyAnchorId
  ) {
    return undefined;
  }

  if (
    input.referenceOption.kind === "named" &&
    !input.referenceOption.namedReference
  ) {
    return undefined;
  }

  return {
    id: input.draft.id,
    bodyId: input.draft.bodyId,
    targetBodyId: input.targetBodyId,
    name: input.draft.name,
    ...(input.referenceOption.kind === "generated"
      ? input.referenceOption.topologyAnchorId
        ? {
            topologyAnchorId: input.referenceOption.topologyAnchorId,
            ...(input.referenceOption.topologyAnchorProof
              ? {
                  topologyAnchorProof: input.referenceOption.topologyAnchorProof
                }
              : {})
          }
        : { edgeStableId: input.referenceOption.edgeStableId }
      : { namedReference: input.referenceOption.namedReference }),
    distance: input.draft.distance,
    radius: input.draft.radius
  };
}

function findSelectedTopologyAnchorId(
  reference: CadGeneratedEdgeReference,
  selectionReferenceCandidates:
    | SelectionReferenceCandidatesQueryResponse
    | undefined
): string | undefined {
  const candidate = selectionReferenceCandidates?.candidates.find(
    (entry) =>
      entry.source === "topologyAnchorSelection" &&
      entry.target.bodyId === reference.bodyId &&
      entry.target.stableId === reference.stableId &&
      entry.target.kind === "edge" &&
      entry.commandable
  );

  return candidate?.target.topologyAnchorId;
}

export function isSupportedRectangleEdgeFinishReference(
  reference: CadGeneratedReference,
  targetBodyId: string,
  operation: EdgeFinishOperation
): reference is CadGeneratedEdgeReference {
  return (
    reference.kind === "edge" &&
    getEdgeFinishReferenceUnsupportedMessage(
      reference,
      targetBodyId,
      operation
    ) === undefined
  );
}

export function parseGeneratedRectangleEdgeStableId(
  stableId: string
): { readonly bodyId: string } | undefined {
  return parseGeneratedEdgeFinishStableId(stableId);
}

export function parseGeneratedEdgeFinishStableId(
  stableId: string
): { readonly bodyId: string } | undefined {
  const capEdge = stableId.match(
    /^generated:edge:([^:]+):(start|end):(uMin|uMax|vMin|vMax)$/
  );
  const capEdgeBodyId = capEdge?.[1];

  if (capEdgeBodyId) {
    return { bodyId: capEdgeBodyId };
  }

  const longitudinalEdge = stableId.match(
    /^generated:edge:([^:]+):longitudinal:(uMin|uMax):(vMin|vMax)$/
  );
  const longitudinalEdgeBodyId = longitudinalEdge?.[1];

  if (longitudinalEdgeBodyId) {
    return { bodyId: longitudinalEdgeBodyId };
  }

  const circularEdge = stableId.match(
    /^generated:edge:([^:]+):(start|end):circular$/
  );
  const circularEdgeBodyId = circularEdge?.[1];

  if (circularEdgeBodyId) {
    return { bodyId: circularEdgeBodyId };
  }

  return undefined;
}

export function formatEdgeFinishOperationLabel(
  operation: EdgeFinishOperation
): string {
  return operation === "chamfer" ? "Chamfer" : "Fillet";
}

export function formatEdgeFinishScalarName(
  operation: EdgeFinishOperation
): string {
  return operation === "chamfer" ? "distance" : "radius";
}

function formatEdgeFinishPastTense(operation: EdgeFinishOperation): string {
  return operation === "chamfer" ? "chamfered" : "filleted";
}

function getEdgeFinishTargetUnsupportedMessage(
  body: CadBodySnapshot | undefined,
  feature: CadFeatureSummary | undefined
): string | undefined {
  if (!body || !feature) {
    return "Select an active edge on a supported extrude body.";
  }

  if (body.source.type !== "sketchExtrudeFeature") {
    return "Edge finish is available for sketch-extrude bodies.";
  }

  if (body.consumedByFeatureId) {
    return "This target already has a downstream result. Select the active result body or edit the downstream feature first.";
  }

  if (feature.kind !== "extrude") {
    return "Edge finish is available for extrude result bodies.";
  }

  if (feature.operationMode !== "newBody") {
    if (
      feature.operationMode !== "cut" ||
      feature.profileKind !== "rectangle"
    ) {
      return "Edge finish is available for active rectangle/circle extrudes and supported rectangle cut results.";
    }
  }

  if (
    feature.operationMode === "newBody" &&
    feature.profileKind !== "rectangle" &&
    feature.profileKind !== "circle"
  ) {
    return "Edge finish is available for rectangle or circle target bodies.";
  }

  return undefined;
}

function getEdgeFinishReferenceUnsupportedMessage(
  reference: CadGeneratedEdgeReference,
  targetBodyId: string | undefined,
  operation: EdgeFinishOperation
): string | undefined {
  const requiredOperation =
    operation === "chamfer" ? "feature.chamfer" : "feature.fillet";

  if (!reference.eligibleOperations.includes(requiredOperation)) {
    return `${formatEdgeFinishOperationLabel(operation)} is not available for this edge.`;
  }

  const parsed = parseGeneratedEdgeFinishStableId(reference.stableId);
  if (!parsed) {
    return "This edge cannot be used for edge finish.";
  }

  if (!targetBodyId || reference.bodyId !== targetBodyId) {
    return "Selected edge does not belong to the target body.";
  }

  if (parsed.bodyId !== targetBodyId) {
    return "Selected edge does not belong to the target body.";
  }

  return undefined;
}

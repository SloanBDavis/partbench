import type {
  BodyGeneratedReferencesQueryResponse,
  CadGeneratedReference,
  CadSelectionReferenceIssue,
  CadSelectionReferenceOperation,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import { getGeneratedReferenceItems } from "./generatedReferenceUi";
import {
  formatSelectionReferenceOperationLabel,
  getPrimarySelectionReferenceCandidate,
  isSelectedGeneratedReference,
  type SelectedGeneratedReference
} from "./generatedReferenceSelection";

export interface ViewportReferenceAction {
  readonly id: string;
  readonly reference: CadGeneratedReference;
  readonly label: string;
  readonly kindLabel: string;
  readonly commandable: boolean;
  readonly selected: boolean;
  readonly commandOperations: readonly CadSelectionReferenceOperation[];
  readonly commandOperationLabels: readonly string[];
  readonly diagnostic?: CadSelectionReferenceIssue;
}

export function createViewportReferenceActions({
  candidatesByStableId,
  references,
  selectedGeneratedReference
}: {
  readonly references?: BodyGeneratedReferencesQueryResponse;
  readonly candidatesByStableId?: ReadonlyMap<
    string,
    SelectionReferenceCandidatesQueryResponse
  >;
  readonly selectedGeneratedReference?: SelectedGeneratedReference;
}): readonly ViewportReferenceAction[] {
  if (!references || !candidatesByStableId) {
    return [];
  }

  return getGeneratedReferenceItems(references).flatMap((reference, index) => {
    const response = candidatesByStableId.get(reference.stableId);

    if (!response) {
      return [];
    }

    const candidate = getPrimarySelectionReferenceCandidate(response);
    const actionReference = candidate?.reference ?? reference;
    const commandOperations = candidate?.commandOperations ?? [];

    return [
      {
        id: `viewport-reference:${index}:${actionReference.kind}`,
        reference: actionReference,
        label: actionReference.label,
        kindLabel: formatActionKind(actionReference.kind),
        commandable: candidate?.commandable ?? false,
        selected: isSelectedGeneratedReference(
          selectedGeneratedReference,
          actionReference
        ),
        commandOperations,
        commandOperationLabels: commandOperations.map(
          formatSelectionReferenceOperationLabel
        ),
        diagnostic: candidate?.issues[0] ?? response.issues[0]
      }
    ];
  });
}

function formatActionKind(kind: CadGeneratedReference["kind"]): string {
  switch (kind) {
    case "body":
      return "Body";
    case "face":
      return "Face";
    case "edge":
      return "Edge";
    case "vertex":
      return "Vertex";
    case "axis":
      return "Axis";
  }
}

import type { SceneObject } from "@web-cad/cad-core";
import type {
  CadBodySnapshot,
  CadSelectionReferenceInput,
  CadSelectionReferenceIssue,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";

export type ViewportPickIntentKind =
  | "empty"
  | "body"
  | "object"
  | "unsupported"
  | "missing";

export type ViewportPickIntent =
  | {
      readonly kind: "empty";
      readonly selectedId?: undefined;
      readonly semanticSelection?: undefined;
      readonly referenceCandidates?: undefined;
      readonly issues: readonly [];
    }
  | {
      readonly kind: "body";
      readonly selectedId: string;
      readonly bodyId: string;
      readonly renderTargetId: string;
      readonly semanticSelection: CadSelectionReferenceInput;
      readonly referenceCandidates?: SelectionReferenceCandidatesQueryResponse;
      readonly issues: readonly CadSelectionReferenceIssue[];
    }
  | {
      readonly kind: "object";
      readonly selectedId: string;
      readonly objectId: string;
      readonly bodyId?: string;
      readonly renderTargetId: string;
      readonly semanticSelection?: CadSelectionReferenceInput;
      readonly referenceCandidates?: SelectionReferenceCandidatesQueryResponse;
      readonly issues: readonly CadSelectionReferenceIssue[];
    }
  | {
      readonly kind: "unsupported" | "missing";
      readonly selectedId?: undefined;
      readonly semanticSelection?: undefined;
      readonly referenceCandidates?: undefined;
      readonly issues: readonly CadSelectionReferenceIssue[];
    };

export interface ResolveViewportPickIntentInput {
  readonly pickedRenderId: string | undefined;
  readonly bodies: readonly CadBodySnapshot[];
  readonly objects: readonly SceneObject[];
  readonly readReferenceCandidates?: (
    selection: CadSelectionReferenceInput
  ) => SelectionReferenceCandidatesQueryResponse | undefined;
}

export function resolveViewportPickIntent({
  pickedRenderId,
  bodies,
  objects,
  readReferenceCandidates
}: ResolveViewportPickIntentInput): ViewportPickIntent {
  if (!pickedRenderId) {
    return { kind: "empty", issues: [] };
  }

  const body = bodies.find((candidate) => candidate.id === pickedRenderId);

  if (body) {
    const semanticSelection: CadSelectionReferenceInput = {
      type: "body",
      bodyId: body.id
    };
    const referenceCandidates = readReferenceCandidates?.(semanticSelection);

    return {
      kind: "body",
      selectedId: body.id,
      bodyId: body.id,
      renderTargetId: body.id,
      semanticSelection,
      referenceCandidates,
      issues: referenceCandidates?.issues ?? []
    };
  }

  const object = objects.find((candidate) => candidate.id === pickedRenderId);

  if (object) {
    const objectBody = bodies.find(
      (candidate) => candidate.objectId === object.id
    );
    const semanticSelection: CadSelectionReferenceInput | undefined = objectBody
      ? { type: "body", bodyId: objectBody.id }
      : undefined;
    const referenceCandidates = semanticSelection
      ? readReferenceCandidates?.(semanticSelection)
      : undefined;

    return {
      kind: "object",
      selectedId: object.id,
      objectId: object.id,
      ...(objectBody ? { bodyId: objectBody.id } : {}),
      renderTargetId: object.id,
      ...(semanticSelection ? { semanticSelection } : {}),
      referenceCandidates,
      issues: referenceCandidates?.issues ?? []
    };
  }

  if (pickedRenderId.startsWith("sketch:")) {
    return {
      kind: "unsupported",
      issues: [
        createViewportPickIssue(
          "UNSUPPORTED_SELECTION_TARGET",
          "unsupported",
          "Sketch display geometry is not selectable as a command-ready CAD body from the viewport.",
          {
            expected: "body or object-backed body",
            received: "sketch display geometry"
          }
        )
      ]
    };
  }

  return {
    kind: "missing",
    issues: [
      createViewportPickIssue(
        "MISSING_SELECTION_TARGET",
        "missing",
        "Viewport pick did not resolve to a current CAD body or object.",
        {
          expected: "current body or object-backed body"
        }
      )
    ]
  };
}

function createViewportPickIssue(
  code: CadSelectionReferenceIssue["code"],
  status: CadSelectionReferenceIssue["status"],
  message: string,
  details: {
    readonly expected?: string;
    readonly received?: string;
  } = {}
): CadSelectionReferenceIssue {
  return {
    code,
    status,
    message,
    ...(details.expected ? { expected: details.expected } : {}),
    ...(details.received ? { received: details.received } : {})
  };
}

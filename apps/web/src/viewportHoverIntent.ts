import type { SceneObject } from "@web-cad/cad-core";
import type {
  CadBodySnapshot,
  CadSelectionReferenceInput,
  CadSelectionReferenceIssue,
  CadSelectionReferenceOperation,
  CadSelectionReferenceStatus,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import {
  createSelectionReferenceCandidateSummaries,
  formatSelectionReferenceOperationLabel,
  formatSelectionReferenceStatus,
  getPrimarySelectionReferenceCandidate
} from "./generatedReferenceSelection";
import { formatObjectKind, getObjectDisplayName } from "./sceneObjectDisplay";
import { redactInternalViewportIds } from "./viewportVisibleText";

export type ViewportHoverKind =
  | "empty"
  | "body"
  | "object"
  | "unsupported"
  | "missing";

export type ViewportHoverTone = "idle" | "ready" | "warning" | "blocked";

export interface ViewportHoverDiagnostic {
  readonly code: CadSelectionReferenceIssue["code"];
  readonly status: CadSelectionReferenceIssue["status"];
  readonly message: string;
}

export type ViewportHoverState =
  | {
      readonly kind: "empty";
      readonly title?: undefined;
      readonly detail?: undefined;
      readonly tone: "idle";
      readonly renderTargetId?: undefined;
      readonly semanticSelection?: undefined;
      readonly referenceStatus?: undefined;
      readonly commandOperations: readonly [];
      readonly commandOperationLabels: readonly [];
      readonly diagnostics: readonly [];
    }
  | {
      readonly kind: "body";
      readonly title: string;
      readonly detail: string;
      readonly tone: ViewportHoverTone;
      readonly bodyId: string;
      readonly renderTargetId: string;
      readonly semanticSelection: CadSelectionReferenceInput;
      readonly referenceStatus?: CadSelectionReferenceStatus;
      readonly commandOperations: readonly CadSelectionReferenceOperation[];
      readonly commandOperationLabels: readonly string[];
      readonly diagnostics: readonly ViewportHoverDiagnostic[];
    }
  | {
      readonly kind: "object";
      readonly title: string;
      readonly detail: string;
      readonly tone: ViewportHoverTone;
      readonly objectId: string;
      readonly bodyId?: string;
      readonly renderTargetId: string;
      readonly semanticSelection?: CadSelectionReferenceInput;
      readonly referenceStatus?: CadSelectionReferenceStatus;
      readonly commandOperations: readonly CadSelectionReferenceOperation[];
      readonly commandOperationLabels: readonly string[];
      readonly diagnostics: readonly ViewportHoverDiagnostic[];
    }
  | {
      readonly kind: "unsupported" | "missing";
      readonly title: string;
      readonly detail: string;
      readonly tone: "blocked";
      readonly renderTargetId?: undefined;
      readonly semanticSelection?: undefined;
      readonly referenceStatus?: undefined;
      readonly commandOperations: readonly [];
      readonly commandOperationLabels: readonly [];
      readonly diagnostics: readonly ViewportHoverDiagnostic[];
    };

export interface ResolveViewportHoverIntentInput {
  readonly hoveredRenderId: string | undefined;
  readonly bodies: readonly CadBodySnapshot[];
  readonly objects: readonly SceneObject[];
  readonly readReferenceCandidates?: (
    selection: CadSelectionReferenceInput
  ) => SelectionReferenceCandidatesQueryResponse | undefined;
}

interface ReferenceHoverSummary {
  readonly detail: string;
  readonly tone: ViewportHoverTone;
  readonly referenceStatus: CadSelectionReferenceStatus;
  readonly commandOperations: readonly CadSelectionReferenceOperation[];
  readonly commandOperationLabels: readonly string[];
  readonly diagnostics: readonly ViewportHoverDiagnostic[];
}

export function resolveViewportHoverIntent({
  hoveredRenderId,
  bodies,
  objects,
  readReferenceCandidates
}: ResolveViewportHoverIntentInput): ViewportHoverState {
  if (!hoveredRenderId) {
    return createEmptyHoverState();
  }

  const body = bodies.find((candidate) => candidate.id === hoveredRenderId);

  if (body) {
    const semanticSelection: CadSelectionReferenceInput = {
      type: "body",
      bodyId: body.id
    };
    const referenceCandidates = readReferenceCandidates?.(semanticSelection);
    const summary = referenceCandidates
      ? createReferenceHoverSummary(referenceCandidates)
      : undefined;

    return {
      kind: "body",
      title: `${body.name ?? body.id} (Body)`,
      detail: summary?.detail ?? "Body hover target",
      tone: summary?.tone ?? "idle",
      bodyId: body.id,
      renderTargetId: body.id,
      semanticSelection,
      referenceStatus: summary?.referenceStatus,
      commandOperations: summary?.commandOperations ?? [],
      commandOperationLabels: summary?.commandOperationLabels ?? [],
      diagnostics: summary?.diagnostics ?? []
    };
  }

  const object = objects.find((candidate) => candidate.id === hoveredRenderId);

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
    const summary = referenceCandidates
      ? createReferenceHoverSummary(referenceCandidates)
      : undefined;

    return {
      kind: "object",
      title: `${getObjectDisplayName(object)} (${formatObjectKind(object.kind)})`,
      detail: summary?.detail ?? "Object hover target",
      tone: summary?.tone ?? "idle",
      objectId: object.id,
      ...(objectBody ? { bodyId: objectBody.id } : {}),
      renderTargetId: object.id,
      ...(semanticSelection ? { semanticSelection } : {}),
      referenceStatus: summary?.referenceStatus,
      commandOperations: summary?.commandOperations ?? [],
      commandOperationLabels: summary?.commandOperationLabels ?? [],
      diagnostics: summary?.diagnostics ?? []
    };
  }

  if (hoveredRenderId.startsWith("sketch:")) {
    return createBlockedHoverState(
      "unsupported",
      "Viewport hover unsupported",
      "Selection target unsupported",
      [
        createViewportHoverIssue(
          "UNSUPPORTED_SELECTION_TARGET",
          "unsupported",
          "Sketch display geometry is not available as a CAD body from the viewport.",
          {
            expected: "body or object-backed body",
            received: "sketch display geometry"
          }
        )
      ]
    );
  }

  return createBlockedHoverState(
    "missing",
    "Viewport hover unavailable",
    "Selection target missing",
    [
      createViewportHoverIssue(
        "MISSING_SELECTION_TARGET",
        "missing",
        "Viewport hover target did not resolve to a current CAD body or object.",
        {
          expected: "current body or object-backed body"
        }
      )
    ]
  );
}

function createEmptyHoverState(): ViewportHoverState {
  return {
    kind: "empty",
    tone: "idle",
    commandOperations: [],
    commandOperationLabels: [],
    diagnostics: []
  };
}

function createBlockedHoverState(
  kind: "unsupported" | "missing",
  title: string,
  detail: string,
  diagnostics: readonly CadSelectionReferenceIssue[]
): ViewportHoverState {
  return {
    kind,
    title,
    detail,
    tone: "blocked",
    commandOperations: [],
    commandOperationLabels: [],
    diagnostics: dedupeDiagnostics(diagnostics)
  };
}

function createReferenceHoverSummary(
  response: SelectionReferenceCandidatesQueryResponse
): ReferenceHoverSummary {
  const primary = createSelectionReferenceCandidateSummaries(response)[0];
  const primaryCandidate = getPrimarySelectionReferenceCandidate(response);
  const commandOperations = primary?.commandOperations ?? [];

  return {
    detail: primary?.detail ?? formatSelectionReferenceStatus(response.status),
    tone: primary?.tone ?? toneFromReferenceStatus(response.status),
    referenceStatus: response.status,
    commandOperations,
    commandOperationLabels: commandOperations.map(
      formatSelectionReferenceOperationLabel
    ),
    diagnostics: dedupeDiagnostics([
      ...(primaryCandidate?.issues ?? []),
      ...response.issues
    ])
  };
}

function createViewportHoverIssue(
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

function toneFromReferenceStatus(
  status: CadSelectionReferenceStatus
): ViewportHoverTone {
  if (status === "resolved") {
    return "ready";
  }

  if (status === "consumed") {
    return "warning";
  }

  return "blocked";
}

function dedupeDiagnostics(
  issues: readonly CadSelectionReferenceIssue[]
): readonly ViewportHoverDiagnostic[] {
  const diagnostics: ViewportHoverDiagnostic[] = [];
  const seen = new Set<string>();

  for (const issue of issues) {
    const diagnostic = {
      code: issue.code,
      status: issue.status,
      message: redactInternalViewportIds(issue.message)
    };
    const key = `${diagnostic.code}:${diagnostic.status}:${diagnostic.message}`;

    if (!seen.has(key)) {
      diagnostics.push(diagnostic);
      seen.add(key);
    }
  }

  return diagnostics;
}

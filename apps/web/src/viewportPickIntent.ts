import type { SceneObject } from "@web-cad/cad-core";
import type { RenderExactPickCandidate } from "@web-cad/renderer";
import type {
  CadBodySnapshot,
  CadSelectionReferenceInput,
  CadSelectionReferenceIssue,
  CadSelectionReferenceStatus,
  CadViewportInteractionDiagnostic,
  CadViewportInteractionDiagnosticCode,
  CadViewportInteractionStatus,
  SketchSnapshot,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import { parseSketchRenderId } from "./sketchRenderIds";

export type ViewportPickIntentKind =
  | "empty"
  | "body"
  | "currentTopology"
  | "object"
  | "sketchEntity"
  | "unsupported"
  | "missing"
  | "renderer-only"
  | "ambiguous";

export type ViewportPickIntent =
  | {
      readonly kind: "empty";
      readonly selectedId?: undefined;
      readonly semanticSelection?: undefined;
      readonly referenceCandidates?: undefined;
      readonly issues: readonly [];
      readonly interactionDiagnostics: readonly [];
    }
  | {
      readonly kind: "body";
      readonly selectedId: string;
      readonly bodyId: string;
      readonly renderTargetId: string;
      readonly semanticSelection: CadSelectionReferenceInput;
      readonly referenceCandidates?: SelectionReferenceCandidatesQueryResponse;
      readonly issues: readonly CadSelectionReferenceIssue[];
      readonly interactionDiagnostics: readonly CadViewportInteractionDiagnostic[];
    }
  | {
      readonly kind: "currentTopology";
      readonly selectedId: string;
      readonly bodyId: string;
      readonly bodySourceIdentitySignature: string;
      readonly topologySignature: string;
      readonly entityKind: "face" | "edge" | "vertex";
      readonly localId: string;
      readonly entitySignature: string;
      readonly renderTargetId: string;
      readonly semanticSelection?: undefined;
      readonly referenceCandidates?: undefined;
      readonly issues: readonly [];
      readonly interactionDiagnostics: readonly [];
    }
  | {
      readonly kind: "object";
      readonly selectedId: string;
      readonly objectId: string;
      readonly bodyId: string;
      readonly renderTargetId: string;
      readonly semanticSelection: CadSelectionReferenceInput;
      readonly referenceCandidates?: SelectionReferenceCandidatesQueryResponse;
      readonly issues: readonly CadSelectionReferenceIssue[];
      readonly interactionDiagnostics: readonly CadViewportInteractionDiagnostic[];
    }
  | {
      readonly kind: "sketchEntity";
      readonly selectedId: string;
      readonly sketchId: string;
      readonly entityId: string;
      readonly renderTargetId: string;
      readonly semanticSelection?: undefined;
      readonly referenceCandidates?: undefined;
      readonly issues: readonly [];
      readonly interactionDiagnostics: readonly [];
    }
  | {
      readonly kind: "unsupported" | "missing" | "renderer-only" | "ambiguous";
      readonly selectedId?: undefined;
      readonly semanticSelection?: undefined;
      readonly referenceCandidates?: undefined;
      readonly issues: readonly CadSelectionReferenceIssue[];
      readonly interactionDiagnostics: readonly CadViewportInteractionDiagnostic[];
    };

export interface ResolveViewportPickIntentInput {
  readonly pickedRenderId: string | undefined;
  readonly bodies: readonly CadBodySnapshot[];
  readonly objects: readonly SceneObject[];
  readonly sketches?: readonly SketchSnapshot[];
  readonly readReferenceCandidates?: (
    selection: CadSelectionReferenceInput
  ) => SelectionReferenceCandidatesQueryResponse | undefined;
}

export type ViewportBodyHitTarget =
  | {
      readonly kind: "empty";
      readonly bodyId?: undefined;
      readonly objectId?: undefined;
      readonly renderTargetId?: undefined;
    }
  | {
      readonly kind: "body";
      readonly bodyId: string;
      readonly renderTargetId: string;
      readonly objectId?: undefined;
    }
  | {
      readonly kind: "object";
      readonly bodyId: string;
      readonly objectId: string;
      readonly renderTargetId: string;
    }
  | {
      readonly kind: "unsupported" | "renderer-only" | "ambiguous";
      readonly bodyId?: undefined;
      readonly objectId?: undefined;
      readonly renderTargetId?: undefined;
      readonly interactionDiagnostics?: readonly CadViewportInteractionDiagnostic[];
    };

export interface CreateViewportBodyHitTargetInput {
  readonly pickedRenderId: string | undefined;
  readonly bodies: readonly CadBodySnapshot[];
  readonly objects: readonly SceneObject[];
}

interface ViewportExactSelectionBase {
  readonly bodyId: string;
  readonly bodySourceIdentitySignature: string;
  readonly topologySignature: string;
}

export type ViewportExactSelection =
  | (ViewportExactSelectionBase & {
      readonly entityKind: "body";
      readonly localId?: undefined;
      readonly entitySignature?: undefined;
    })
  | (ViewportExactSelectionBase & {
      readonly entityKind: "face" | "edge" | "vertex";
      readonly localId: string;
      readonly entitySignature: string;
    });

export function createViewportExactSelection(
  candidate: Extract<
    RenderExactPickCandidate,
    { readonly entityKind: "face" | "edge" | "vertex" }
  >
): Extract<
  ViewportExactSelection,
  { readonly entityKind: "face" | "edge" | "vertex" }
>;
export function createViewportExactSelection(
  candidate: RenderExactPickCandidate
): ViewportExactSelection;
export function createViewportExactSelection(
  candidate: RenderExactPickCandidate
): ViewportExactSelection {
  const identity = {
    bodyId: candidate.bodyId,
    bodySourceIdentitySignature: candidate.bodySourceIdentitySignature,
    topologySignature: candidate.topologySignature
  };
  return candidate.entityKind === "body"
    ? { ...identity, entityKind: "body" }
    : {
        ...identity,
        entityKind: candidate.entityKind,
        localId: candidate.localId,
        entitySignature: candidate.entitySignature
      };
}

export function isSameViewportExactSelection(
  left: ViewportExactSelection,
  right: ViewportExactSelection
): boolean {
  return (
    left.bodyId === right.bodyId &&
    left.bodySourceIdentitySignature === right.bodySourceIdentitySignature &&
    left.topologySignature === right.topologySignature &&
    left.entityKind === right.entityKind &&
    left.localId === right.localId &&
    left.entitySignature === right.entitySignature
  );
}

export function createViewportCurrentTopologyPickIntent(
  candidate: Extract<
    RenderExactPickCandidate,
    { readonly entityKind: "face" | "edge" | "vertex" }
  >
): ViewportPickIntent {
  const selection = createViewportExactSelection(candidate);
  return {
    kind: "currentTopology",
    ...selection,
    selectedId: selection.bodyId,
    renderTargetId: selection.bodyId,
    issues: [],
    interactionDiagnostics: []
  };
}

export function createViewportBodyHitTarget({
  bodies,
  objects,
  pickedRenderId
}: CreateViewportBodyHitTargetInput): ViewportBodyHitTarget {
  if (!pickedRenderId) {
    return { kind: "empty" };
  }

  const body = bodies.find((candidate) => candidate.id === pickedRenderId);

  if (body) {
    return {
      kind: "body",
      bodyId: body.id,
      renderTargetId: body.id
    };
  }

  const object = objects.find((candidate) => candidate.id === pickedRenderId);

  if (object) {
    const objectBodies = bodies.filter(
      (candidate) => candidate.objectId === object.id
    );
    const [objectBody] = objectBodies;

    if (objectBodies.length === 1 && objectBody) {
      return {
        kind: "object",
        bodyId: objectBody.id,
        objectId: object.id,
        renderTargetId: object.id
      };
    }

    if (objectBodies.length > 1) {
      return {
        kind: "ambiguous",
        interactionDiagnostics: [
          createViewportPickDiagnostic(
            "VIEWPORT_AMBIGUOUS_HIT_CANDIDATE",
            "ambiguous",
            "Viewport hit maps to multiple bodies.",
            {
              expected: "one object-backed body",
              received: `${objectBodies.length} object-backed bodies`
            }
          )
        ]
      };
    }

    return {
      kind: "renderer-only",
      interactionDiagnostics: [
        createViewportPickDiagnostic(
          "VIEWPORT_RENDERER_ONLY_TARGET",
          "renderer-only",
          "Viewport object has no CAD body."
        )
      ]
    };
  }

  if (parseSketchRenderId(pickedRenderId)) {
    return {
      kind: "unsupported",
      interactionDiagnostics: [
        createViewportPickDiagnostic(
          "VIEWPORT_UNSUPPORTED_DISPLAY_ENTITY",
          "unsupported",
          "Sketch geometry is not a solid target."
        )
      ]
    };
  }

  return {
    kind: "renderer-only",
    interactionDiagnostics: [
      createViewportPickDiagnostic(
        "VIEWPORT_RENDERER_ONLY_TARGET",
        "renderer-only",
        "Viewport hit has no CAD target."
      )
    ]
  };
}

export function resolveViewportPickIntent({
  pickedRenderId,
  bodies,
  objects,
  sketches = [],
  readReferenceCandidates
}: ResolveViewportPickIntentInput): ViewportPickIntent {
  if (pickedRenderId) {
    const sketchRenderTarget = parseSketchRenderId(pickedRenderId);

    if (sketchRenderTarget?.kind === "sketchEntity") {
      const sketch = sketches.find(
        (candidate) => candidate.id === sketchRenderTarget.sketchId
      );
      const entity = sketch?.entities.find(
        (candidate) => candidate.id === sketchRenderTarget.entityId
      );

      if (sketch && entity) {
        return {
          kind: "sketchEntity",
          selectedId: pickedRenderId,
          sketchId: sketch.id,
          entityId: entity.id,
          renderTargetId: pickedRenderId,
          issues: [],
          interactionDiagnostics: []
        };
      }
    }
  }

  const hitTarget = createViewportBodyHitTarget({
    pickedRenderId,
    bodies,
    objects
  });

  if (hitTarget.kind === "empty") {
    return { kind: "empty", issues: [], interactionDiagnostics: [] };
  }

  if (hitTarget.kind !== "body" && hitTarget.kind !== "object") {
    return createBlockedViewportPickIntent(
      hitTarget.kind,
      hitTarget.interactionDiagnostics ?? []
    );
  }

  const selection = { type: "body", bodyId: hitTarget.bodyId } as const;
  const referenceCandidates = readReferenceCandidates?.(selection);
  const interactionDiagnostics = referenceCandidates
    ? createReferenceCandidateDiagnostics(referenceCandidates)
    : [];
  const issues =
    referenceCandidates?.issues ??
    interactionDiagnostics.map(createSelectionIssueFromViewportDiagnostic);

  if (hitTarget.kind === "object") {
    return {
      kind: "object",
      selectedId: hitTarget.bodyId,
      objectId: hitTarget.objectId,
      bodyId: hitTarget.bodyId,
      renderTargetId: hitTarget.renderTargetId,
      semanticSelection: selection,
      referenceCandidates,
      issues,
      interactionDiagnostics
    };
  }

  return {
    kind: "body",
    selectedId: hitTarget.bodyId,
    bodyId: hitTarget.bodyId,
    renderTargetId: hitTarget.renderTargetId,
    semanticSelection: selection,
    referenceCandidates,
    issues,
    interactionDiagnostics
  };
}

function createBlockedViewportPickIntent(
  kind: Extract<
    ViewportPickIntentKind,
    "unsupported" | "missing" | "renderer-only" | "ambiguous"
  >,
  interactionDiagnostics: readonly CadViewportInteractionDiagnostic[]
): ViewportPickIntent {
  const diagnostics =
    interactionDiagnostics.length > 0
      ? interactionDiagnostics
      : [
          createViewportPickDiagnostic(
            "VIEWPORT_MISSING_HIT_TARGET",
            "missing",
            "Viewport pick has no current CAD body."
          )
        ];

  return {
    kind,
    issues: diagnostics.map(createSelectionIssueFromViewportDiagnostic),
    interactionDiagnostics: diagnostics
  };
}

function createReferenceCandidateDiagnostics(
  response: SelectionReferenceCandidatesQueryResponse
): readonly CadViewportInteractionDiagnostic[] {
  if (response.issues.length > 0) {
    return response.issues.map((issue) =>
      createViewportPickDiagnostic(
        viewportCodeFromSelectionStatus(issue.status),
        issue.status,
        issue.message,
        {
          ...(issue.expected ? { expected: issue.expected } : {}),
          ...(issue.received ? { received: issue.received } : {})
        }
      )
    );
  }
  return response.status === "resolved"
    ? []
    : [
        createViewportPickDiagnostic(
          viewportCodeFromSelectionStatus(response.status),
          response.status,
          `Viewport target is ${response.status}.`
        )
      ];
}

function viewportCodeFromSelectionStatus(
  status: Exclude<CadSelectionReferenceStatus, "resolved">
): CadViewportInteractionDiagnosticCode {
  switch (status) {
    case "missing":
      return "VIEWPORT_MISSING_HIT_TARGET";
    case "stale":
      return "VIEWPORT_STALE_SEMANTIC_HINT";
    case "ambiguous":
      return "VIEWPORT_AMBIGUOUS_HIT_CANDIDATE";
    case "consumed":
      return "VIEWPORT_CONSUMED_TARGET";
    case "non-commandable":
      return "VIEWPORT_NON_COMMANDABLE_TARGET";
    case "unsupported":
      return "VIEWPORT_UNSUPPORTED_DISPLAY_ENTITY";
  }
}

function createSelectionIssueFromViewportDiagnostic(
  diagnostic: CadViewportInteractionDiagnostic
): CadSelectionReferenceIssue {
  return createViewportPickIssue(
    selectionIssueCodeFromViewportDiagnostic(diagnostic.code),
    selectionStatusFromViewportStatus(diagnostic.status),
    diagnostic.message,
    {
      ...(diagnostic.expected ? { expected: diagnostic.expected } : {}),
      ...(diagnostic.received ? { received: diagnostic.received } : {})
    }
  );
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

function createViewportPickDiagnostic(
  code: CadViewportInteractionDiagnosticCode,
  status: Exclude<CadViewportInteractionStatus, "resolved" | "empty">,
  message: string,
  details: {
    readonly expected?: string;
    readonly received?: string;
  } = {}
): CadViewportInteractionDiagnostic {
  return {
    code,
    status,
    message,
    ...(details.expected ? { expected: details.expected } : {}),
    ...(details.received ? { received: details.received } : {})
  };
}

function selectionIssueCodeFromViewportDiagnostic(
  code: CadViewportInteractionDiagnosticCode
): CadSelectionReferenceIssue["code"] {
  switch (code) {
    case "VIEWPORT_MISSING_HIT_TARGET":
      return "MISSING_SELECTION_TARGET";
    case "VIEWPORT_STALE_SEMANTIC_HINT":
      return "STALE_SELECTION_REFERENCE";
    case "VIEWPORT_AMBIGUOUS_HIT_CANDIDATE":
      return "AMBIGUOUS_SELECTION_TOPOLOGY";
    case "VIEWPORT_CONSUMED_TARGET":
      return "CONSUMED_SELECTION_BODY";
    case "VIEWPORT_NON_COMMANDABLE_TARGET":
      return "NON_COMMANDABLE_SELECTION_TARGET";
    case "VIEWPORT_ASSEMBLY_INSTANCE_UNSUPPORTED":
    case "VIEWPORT_RENDERER_ONLY_TARGET":
    case "VIEWPORT_UNSUPPORTED_DISPLAY_ENTITY":
      return "UNSUPPORTED_SELECTION_TARGET";
  }
}

function selectionStatusFromViewportStatus(
  status: CadViewportInteractionDiagnostic["status"]
): CadSelectionReferenceIssue["status"] {
  switch (status) {
    case "missing":
      return "missing";
    case "stale":
      return "stale";
    case "ambiguous":
      return "ambiguous";
    case "consumed":
      return "consumed";
    case "non-commandable":
      return "non-commandable";
    case "renderer-only":
    case "assembly-unsupported":
    case "unsupported":
      return "unsupported";
  }
}

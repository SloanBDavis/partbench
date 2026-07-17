import type { SceneObject } from "@web-cad/cad-core";
import type {
  CadBodySnapshot,
  CadGeneratedEntityKind,
  CadSelectionReferenceInput,
  CadSelectionReferenceIssue,
  CadViewportHitCandidate,
  CadViewportInteractionDiagnostic,
  CadViewportInteractionDiagnosticCode,
  CadViewportInteractionStatus,
  SketchSnapshot,
  SelectionReferenceCandidatesQueryResponse
} from "@web-cad/cad-protocol";
import {
  createViewportInteractionDiagnosticsFromCandidates,
  resolveViewportHitCandidateSelection
} from "./viewportInteractionContract";
import { parseSketchRenderId } from "./sketchRenderIds";

export type ViewportPickIntentKind =
  | "empty"
  | "body"
  | "generatedReference"
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
      readonly kind: "generatedReference";
      readonly selectedId: string;
      readonly bodyId: string;
      readonly stableId: string;
      readonly expectedKind: CadGeneratedEntityKind;
      readonly renderTargetId: string;
      readonly semanticSelection: CadSelectionReferenceInput;
      readonly referenceCandidates?: SelectionReferenceCandidatesQueryResponse;
      readonly issues: readonly CadSelectionReferenceIssue[];
      readonly interactionDiagnostics: readonly CadViewportInteractionDiagnostic[];
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
  readonly hitCandidate?: CadViewportHitCandidate;
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
      readonly hitCandidate?: undefined;
      readonly bodyId?: undefined;
      readonly objectId?: undefined;
      readonly renderTargetId?: undefined;
    }
  | {
      readonly kind: "body";
      readonly hitCandidate: CadViewportHitCandidate;
      readonly bodyId: string;
      readonly renderTargetId: string;
      readonly objectId?: undefined;
    }
  | {
      readonly kind: "object";
      readonly hitCandidate: CadViewportHitCandidate;
      readonly bodyId: string;
      readonly objectId: string;
      readonly renderTargetId: string;
    }
  | {
      readonly kind: "generatedReference";
      readonly hitCandidate: CadViewportHitCandidate;
      readonly bodyId: string;
      readonly stableId: string;
      readonly expectedKind: CadGeneratedEntityKind;
      readonly renderTargetId: string;
      readonly objectId?: undefined;
    }
  | {
      readonly kind: "unsupported" | "renderer-only" | "ambiguous";
      readonly hitCandidate: CadViewportHitCandidate;
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

export interface ChooseViewportGeneratedReferencePickBodyIdInput {
  readonly activeSelectionPanel: boolean;
  readonly generatedReferenceSelected?: boolean;
  readonly pickedBodyId?: string;
  readonly selectedBodyId?: string;
}

export function chooseViewportGeneratedReferencePickBodyId({
  activeSelectionPanel,
  generatedReferenceSelected = false,
  pickedBodyId,
  selectedBodyId
}: ChooseViewportGeneratedReferencePickBodyIdInput): string | undefined {
  if (!pickedBodyId) {
    return undefined;
  }

  return pickedBodyId === selectedBodyId ||
    (activeSelectionPanel && !generatedReferenceSelected)
    ? pickedBodyId
    : undefined;
}

export function resolveViewportPickedBodyId(
  input: CreateViewportBodyHitTargetInput
): string | undefined {
  const target = createViewportBodyHitTarget(input);

  return target.kind === "body" || target.kind === "object"
    ? target.bodyId
    : undefined;
}

export function createViewportBodyHitTarget({
  bodies,
  objects,
  pickedRenderId
}: CreateViewportBodyHitTargetInput): ViewportBodyHitTarget {
  if (!pickedRenderId) {
    return { kind: "empty" };
  }

  const rendererHitId = createRendererHitId(pickedRenderId);
  const body = bodies.find((candidate) => candidate.id === pickedRenderId);

  if (body) {
    return {
      kind: "body",
      bodyId: body.id,
      renderTargetId: body.id,
      hitCandidate: {
        displayEntityKind: "body",
        rendererHitId,
        precision: "bounds",
        semanticHint: {
          type: "body",
          bodyId: body.id
        }
      }
    };
  }

  const object = objects.find((candidate) => candidate.id === pickedRenderId);

  if (object) {
    const objectBodies = bodies.filter(
      (candidate) => candidate.objectId === object.id
    );

    if (objectBodies.length === 1) {
      const objectBody = objectBodies[0];

      return {
        kind: "object",
        bodyId: objectBody.id,
        objectId: object.id,
        renderTargetId: object.id,
        hitCandidate: {
          displayEntityKind: "body",
          rendererHitId,
          precision: "bounds",
          semanticHint: {
            type: "body",
            bodyId: objectBody.id
          }
        }
      };
    }

    if (objectBodies.length > 1) {
      return {
        kind: "ambiguous",
        hitCandidate: {
          displayEntityKind: "body",
          rendererHitId,
          precision: "bounds"
        },
        interactionDiagnostics: [
          createViewportPickDiagnostic(
            "VIEWPORT_AMBIGUOUS_HIT_CANDIDATE",
            "ambiguous",
            "Viewport object hit maps to multiple CAD bodies.",
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
      hitCandidate: {
        displayEntityKind: "body",
        rendererHitId,
        precision: "bounds"
      }
    };
  }

  if (parseSketchRenderId(pickedRenderId)) {
    return {
      kind: "unsupported",
      hitCandidate: {
        displayEntityKind: "sketchEntity",
        rendererHitId,
        precision: "displayApproximation"
      }
    };
  }

  return {
    kind: "renderer-only",
    hitCandidate: {
      displayEntityKind: "body",
      rendererHitId,
      precision: "bounds"
    }
  };
}

export function resolveViewportPickIntent({
  hitCandidate,
  pickedRenderId,
  bodies,
  objects,
  sketches = [],
  readReferenceCandidates
}: ResolveViewportPickIntentInput): ViewportPickIntent {
  if (!hitCandidate && pickedRenderId) {
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

  const hitTarget =
    hitCandidate !== undefined
      ? createViewportBodyHitTargetFromCandidate(hitCandidate)
      : createViewportBodyHitTarget({ pickedRenderId, bodies, objects });

  if (hitTarget.kind === "empty") {
    return { kind: "empty", issues: [], interactionDiagnostics: [] };
  }

  if (hitTarget.kind === "ambiguous") {
    return createBlockedViewportPickIntent(
      "ambiguous",
      hitTarget.interactionDiagnostics ?? []
    );
  }

  const resolution = resolveViewportHitCandidateSelection({
    hitCandidate: hitTarget.hitCandidate
  });

  if (!resolution.selection) {
    return createBlockedViewportPickIntent(
      blockedKindFromInteractionStatus(resolution.status),
      resolution.diagnostics
    );
  }

  const referenceCandidates = readReferenceCandidates?.(resolution.selection);
  const interactionDiagnostics = referenceCandidates
    ? createViewportInteractionDiagnosticsFromCandidates(referenceCandidates)
    : resolution.diagnostics;
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
      semanticSelection: resolution.selection,
      referenceCandidates,
      issues,
      interactionDiagnostics
    };
  }

  if (hitTarget.kind === "generatedReference") {
    return {
      kind: "generatedReference",
      selectedId: hitTarget.bodyId,
      bodyId: hitTarget.bodyId,
      stableId: hitTarget.stableId,
      expectedKind: hitTarget.expectedKind,
      renderTargetId: hitTarget.renderTargetId,
      semanticSelection: resolution.selection,
      referenceCandidates,
      issues,
      interactionDiagnostics
    };
  }

  if (hitTarget.kind === "body") {
    return {
      kind: "body",
      selectedId: hitTarget.bodyId,
      bodyId: hitTarget.bodyId,
      renderTargetId: hitTarget.renderTargetId,
      semanticSelection: resolution.selection,
      referenceCandidates,
      issues,
      interactionDiagnostics
    };
  }

  return createBlockedViewportPickIntent(
    hitTarget.kind,
    interactionDiagnostics
  );
}

function createViewportBodyHitTargetFromCandidate(
  hitCandidate: CadViewportHitCandidate
): ViewportBodyHitTarget {
  if (
    hitCandidate.semanticHint?.type === "generatedReference" &&
    hitCandidate.displayEntityKind === hitCandidate.semanticHint.expectedKind
  ) {
    return {
      kind: "generatedReference",
      hitCandidate,
      bodyId: hitCandidate.semanticHint.bodyId,
      stableId: hitCandidate.semanticHint.stableId,
      expectedKind: hitCandidate.semanticHint.expectedKind,
      renderTargetId: hitCandidate.semanticHint.bodyId
    };
  }

  if (
    hitCandidate.displayEntityKind === "body" &&
    hitCandidate.semanticHint?.type === "body"
  ) {
    return {
      kind: "body",
      hitCandidate,
      bodyId: hitCandidate.semanticHint.bodyId,
      renderTargetId: hitCandidate.semanticHint.bodyId
    };
  }

  if (hitCandidate.displayEntityKind === "sketchEntity") {
    return {
      kind: "unsupported",
      hitCandidate
    };
  }

  return {
    kind: "renderer-only",
    hitCandidate
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
            "Viewport pick did not resolve to a current CAD body."
          )
        ];

  return {
    kind,
    issues: diagnostics.map(createSelectionIssueFromViewportDiagnostic),
    interactionDiagnostics: diagnostics
  };
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

function blockedKindFromInteractionStatus(
  status: CadViewportInteractionStatus
): Extract<
  ViewportPickIntentKind,
  "unsupported" | "missing" | "renderer-only" | "ambiguous"
> {
  switch (status) {
    case "missing":
    case "empty":
      return "missing";
    case "renderer-only":
      return "renderer-only";
    case "ambiguous":
      return "ambiguous";
    default:
      return "unsupported";
  }
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

function createRendererHitId(pickedRenderId: string): string {
  return `renderer-hit:${pickedRenderId}`;
}

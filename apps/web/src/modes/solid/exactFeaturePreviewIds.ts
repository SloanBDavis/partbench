import type { CadDocumentSnapshot } from "@web-cad/cad-core";

import type {
  SolidDraftByKind,
  SolidEditorKind,
  SolidEditorRequest
} from "./solidEditorTypes";

/**
 * The counters needed to materialize the IDs used by a solid feature preview.
 * Keeping this as a Pick makes the helper usable with a document snapshot or
 * with the same two counters supplied by a snapshot-producing caller.
 */
export type SolidFeaturePreviewIdCounters = Pick<
  CadDocumentSnapshot,
  "nextFeatureNumber" | "nextBodyNumber"
>;

type SolidFeaturePreviewCreateKind =
  | "extrude"
  | "compositeExtrude"
  | "revolve"
  | "compositeRevolve"
  | "hole"
  | "chamfer"
  | "fillet"
  | "linearPattern"
  | "circularPattern"
  | "mirror"
  | "shell"
  | "sweep"
  | "compositeSweep"
  | "loft";

type SolidFeaturePreviewCreateDraft =
  SolidDraftByKind[SolidFeaturePreviewCreateKind];

const SOLID_FEATURE_PREVIEW_CREATE_KINDS: ReadonlySet<SolidEditorKind> =
  new Set<SolidEditorKind>([
    "extrude",
    "compositeExtrude",
    "revolve",
    "compositeRevolve",
    "hole",
    "chamfer",
    "fillet",
    "linearPattern",
    "circularPattern",
    "mirror",
    "shell",
    "sweep",
    "compositeSweep",
    "loft"
  ]);

function isBlankId(value: string | undefined): boolean {
  return value === undefined || value.trim().length === 0;
}

/**
 * Materialize the feature and result-body IDs for a create-form before the
 * first exact preview. The counters are deliberately read-only: this helper
 * does not reserve IDs or mutate the document. The returned request can then
 * be reused unchanged for Apply.
 */
export function materializeSolidEditorRequestIds<
  Kind extends SolidEditorKind
>(
  request: SolidEditorRequest<Kind>,
  counters: SolidFeaturePreviewIdCounters
): SolidEditorRequest<Kind> {
  if (
    request.mode === "edit" ||
    !SOLID_FEATURE_PREVIEW_CREATE_KINDS.has(request.kind)
  ) {
    return request;
  }

  const draft = request.initialDraft as SolidFeaturePreviewCreateDraft;
  const id = isBlankId(draft.id)
    ? `feat_${counters.nextFeatureNumber}`
    : draft.id;
  const bodyId = isBlankId(draft.bodyId)
    ? `body_${counters.nextBodyNumber}`
    : draft.bodyId;

  if (id === draft.id && bodyId === draft.bodyId) {
    return request;
  }

  return {
    ...request,
    initialDraft: {
      ...draft,
      id,
      bodyId
    }
  } as SolidEditorRequest<Kind>;
}

import type { SelectionReferenceCandidatesQueryResponse } from "@web-cad/cad-protocol";
import type { RenderExactPickCandidate } from "@web-cad/renderer";
import { redactInternalViewportIds } from "./viewportVisibleText";

export type ViewportExactCandidateCommandabilityStatus =
  | "commandable"
  | "inspect-only";

export interface ViewportExactCandidateCommandability {
  readonly status: ViewportExactCandidateCommandabilityStatus;
  readonly text: string;
}

export interface ViewportExactCandidateAnnouncementInput {
  readonly index: number;
  readonly count: number;
  readonly kindLabel: string;
  readonly label: string;
  readonly occluded: boolean;
  readonly commandability: ViewportExactCandidateCommandability;
}

export function createViewportExactCandidateCommandability(
  candidate: RenderExactPickCandidate,
  readReferenceCandidates: (
    bodyId: string
  ) => SelectionReferenceCandidatesQueryResponse | undefined
): ViewportExactCandidateCommandability {
  if (candidate.entityKind !== "body") {
    return createInspectOnlyCommandability(candidate.entityKind);
  }
  return commandabilityFromReferenceCandidates(
    readReferenceCandidates(candidate.bodyId)
  );
}

function commandabilityFromReferenceCandidates(
  response: SelectionReferenceCandidatesQueryResponse | undefined
): ViewportExactCandidateCommandability {
  if (!response) {
    return {
      status: "inspect-only",
      text: "Inspect only: no readiness projection is available for this selection."
    };
  }
  const commandable =
    response.status === "resolved" &&
    response.candidates.some((candidate) => candidate.commandable);
  if (commandable) {
    const label = response.candidates.find(
      (candidate) => candidate.commandable
    )?.label;
    return {
      status: "commandable",
      text: label ? `Ready: ${label}` : "Ready for modeling"
    };
  }
  const issue = response.issues[0];
  if (issue) {
    return {
      status: "inspect-only",
      text: `Inspect only: ${issue.message}`
    };
  }
  return {
    status: "inspect-only",
    text: `Inspect only: this selection is not ready for the active modeling tool.`
  };
}

function createInspectOnlyCommandability(
  entityKind: "face" | "edge" | "vertex"
): ViewportExactCandidateCommandability {
  const reason =
    entityKind === "vertex"
      ? "Vertices are not saved modeling targets."
      : `No saved ${entityKind} matches this result. Use a saved reference in the model tree to start a modeling action.`;
  return { status: "inspect-only", text: `Inspect only: ${reason}` };
}

export function formatViewportExactCandidateRow(
  input: ViewportExactCandidateAnnouncementInput
): string {
  const visibility = input.occluded ? "Occluded" : "Visible";
  return redactInternalViewportIds(
    `${input.index + 1} of ${input.count} · ${input.kindLabel} · ${input.label} · ${visibility} · ${input.commandability.text}`
  );
}

export function formatViewportExactCandidateAnnouncement(
  input: ViewportExactCandidateAnnouncementInput
): string {
  const visibility = input.occluded ? "occluded" : "visible";
  return redactInternalViewportIds(
    `${input.kindLabel} ${input.index + 1} of ${input.count}, ${input.label}, ${visibility}. ${input.commandability.text}`
  );
}

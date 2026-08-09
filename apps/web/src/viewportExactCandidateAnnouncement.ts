import type { SelectionReferenceCandidatesQueryResponse } from "@web-cad/cad-protocol";
import { formatVisibleDiagnosticMessage } from "./viewportVisibleText";

export interface ViewportExactCandidateAnnouncementInput {
  readonly index: number;
  readonly count: number;
  readonly kindLabel: string;
  readonly label: string;
  readonly occluded: boolean;
  readonly commandability: string;
}

export function createViewportExactCandidateCommandability(
  response: SelectionReferenceCandidatesQueryResponse | undefined
): string {
  const candidate =
    response?.status === "resolved"
      ? response.candidates.find((candidate) => candidate.commandable)
      : undefined;
  if (candidate) {
    return `Ready: ${candidate.label}`;
  }
  const message =
    response?.issues[0]?.message ??
    response?.currentTopology?.diagnostics[0]?.message ??
    "readiness is unavailable.";
  return `Inspect only: ${message}`;
}

export function formatViewportExactCandidateRow(
  input: ViewportExactCandidateAnnouncementInput
): string {
  const visibility = input.occluded ? "Occluded" : "Visible";
  return formatVisibleDiagnosticMessage(
    `${input.index + 1} of ${input.count} · ${input.kindLabel} · ${input.label} · ${visibility} · ${input.commandability}`
  );
}

export function formatViewportExactCandidateAnnouncement(
  input: ViewportExactCandidateAnnouncementInput
): string {
  const visibility = input.occluded ? "occluded" : "visible";
  return formatVisibleDiagnosticMessage(
    `${input.kindLabel} ${input.index + 1} of ${input.count}, ${input.label}, ${visibility}. ${input.commandability}`
  );
}

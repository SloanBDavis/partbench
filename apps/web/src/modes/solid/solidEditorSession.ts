import type { FeatureEditorValidation } from "../../editors/featureEditorState";
import type { SolidEditorSubmission } from "./solidEditorTypes";

export interface SolidApplyGate {
  pending: boolean;
}

/**
 * Synchronous gate around an asynchronous mutation callback. This prevents
 * double activation before React has rendered the pending state.
 */
export async function applySolidDraftOnce(
  gate: SolidApplyGate,
  submission: SolidEditorSubmission,
  validation: FeatureEditorValidation,
  dirty: boolean,
  onApply?: (submission: SolidEditorSubmission) => void | Promise<void>
): Promise<boolean> {
  if (gate.pending || !dirty || validation.status !== "ready" || !onApply) {
    return false;
  }

  gate.pending = true;
  try {
    await onApply(submission);
    return true;
  } finally {
    gate.pending = false;
  }
}

export function cancelSolidDraft<Draft>(
  initialDraft: Draft,
  onCancel?: () => void
): Draft {
  onCancel?.();
  return initialDraft;
}

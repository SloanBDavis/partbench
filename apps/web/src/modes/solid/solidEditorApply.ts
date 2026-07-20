export interface ApplyCommittedSolidEditorSubmissionInput {
  readonly readSuccessfulCommitCount: () => number;
  readonly submit: () => Promise<void>;
  readonly close: () => void;
}

/**
 * Closes a one-shot create editor only when its submission produced a real
 * command commit. Structured command failures can otherwise resolve without
 * throwing, so promise completion alone is not success.
 */
export async function applyCommittedSolidEditorSubmission({
  readSuccessfulCommitCount,
  submit,
  close
}: ApplyCommittedSolidEditorSubmissionInput): Promise<void> {
  const commitCountBeforeApply = readSuccessfulCommitCount();
  await submit();
  if (readSuccessfulCommitCount() === commitCountBeforeApply) {
    throw new Error(
      "The operation was not committed. Review the model message and try again."
    );
  }
  close();
}

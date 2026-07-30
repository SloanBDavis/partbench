export interface ApplyCommittedSolidEditorSubmissionInput {
  readonly readSuccessfulCommitCount: () => number;
  readonly submit: () => Promise<void>;
  readonly close: () => void;
}

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

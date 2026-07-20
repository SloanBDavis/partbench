import { describe, expect, it, vi } from "vitest";
import { applyCommittedSolidEditorSubmission } from "./solidEditorApply";

describe("committed solid editor apply", () => {
  it("closes after a successful command commit", async () => {
    let commitCount = 0;
    const close = vi.fn();

    await applyCommittedSolidEditorSubmission({
      readSuccessfulCommitCount: () => commitCount,
      submit: async () => {
        commitCount += 1;
      },
      close
    });

    expect(close).toHaveBeenCalledOnce();
  });

  it("keeps the editor open when a structured command failure does not commit", async () => {
    const close = vi.fn();

    await expect(
      applyCommittedSolidEditorSubmission({
        readSuccessfulCommitCount: () => 0,
        submit: async () => undefined,
        close
      })
    ).rejects.toThrow("The operation was not committed");
    expect(close).not.toHaveBeenCalled();
  });

  it("keeps the editor open when submission throws", async () => {
    const close = vi.fn();

    await expect(
      applyCommittedSolidEditorSubmission({
        readSuccessfulCommitCount: () => 0,
        submit: async () => {
          throw new Error("Command failed");
        },
        close
      })
    ).rejects.toThrow("Command failed");
    expect(close).not.toHaveBeenCalled();
  });
});

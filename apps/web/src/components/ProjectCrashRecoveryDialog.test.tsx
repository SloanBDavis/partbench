import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectReplacementGuard } from "./ProjectReplacementGuard";
import { ProjectCrashRecoveryDialog } from "./ProjectCrashRecoveryDialog";

describe("V22 recovery and replacement dialogs", () => {
  it("renders Save/Discard/Cancel without private storage names", () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectReplacementGuard, {
        replacement: "new",
        onSave: () => undefined,
        onDiscard: () => undefined,
        onCancel: () => undefined
      })
    );
    expect(markup).toContain("role=\"dialog\"");
    expect(markup).toContain("Save");
    expect(markup).toContain("Discard");
    expect(markup).toContain("Cancel");
    expect(markup.toLowerCase()).not.toMatch(/opfs|filehandle|g-[0-9a-f]/);
  });

  it("renders Restore/Discard facts without OPFS names or raw hashes", () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectCrashRecoveryDialog, {
        offer: {
          projectName: "bracket.wcad",
          committedAt: "2026-08-31T06:00:00.000Z",
          sourceIdentitySummary: "Source ab12cd34",
          units: "mm",
          bodyCount: 2,
          portabilityLabel: "Portable",
          capturedRevisionSummary: "bracket.wcad · Source ab12cd34"
        },
        onRestore: () => undefined,
        onRequestDiscard: () => undefined,
        onConfirmDiscard: () => undefined,
        onCancelDiscard: () => undefined
      })
    );
    expect(markup).toContain("Restore");
    expect(markup).toContain("Discard");
    expect(markup).toContain("bracket.wcad");
    expect(markup).toContain("Source ab12cd34");
    expect(markup).toContain("mm");
    expect(markup).toContain(">2<");
    expect(markup).not.toContain("partbench-crash-recovery-v1");
    expect(markup.toLowerCase()).not.toMatch(/opfs|filehandle/);
  });

  it("requires a second confirmation before Discard recovery data", () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectCrashRecoveryDialog, {
        offer: {
          projectName: "bracket.wcad",
          committedAt: "2026-08-31T06:00:00.000Z",
          sourceIdentitySummary: "Source ab12cd34",
          units: "mm",
          bodyCount: 1,
          portabilityLabel: "Portable",
          capturedRevisionSummary: "bracket.wcad · Source ab12cd34"
        },
        confirmDiscard: true,
        onRestore: () => undefined,
        onRequestDiscard: () => undefined,
        onConfirmDiscard: () => undefined,
        onCancelDiscard: () => undefined
      })
    );
    expect(markup).toContain("Discard recovery data");
    expect(markup).toContain("Cancel");
    expect(markup).not.toContain(">Restore<");
  });
});

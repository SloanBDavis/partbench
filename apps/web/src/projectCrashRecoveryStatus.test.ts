import { describe, expect, it } from "vitest";
import {
  crashRecoveryVisibleText,
  createCrashRecoveryOffer,
  formatSourceIdentitySummary
} from "./projectCrashRecoveryStatus";

const HASH = `ab12cd34${"e".repeat(56)}`;

describe("V22 recovery visible status copy", () => {
  it("summarizes source identity without the raw hash or OPFS names", () => {
    const identity = {
      algorithm: "partbench-source-v1" as const,
      sha256: HASH
    };
    const offer = createCrashRecoveryOffer({
      projectName: "bracket.wcad",
      committedAt: "2026-08-31T06:00:00.000Z",
      sourceIdentity: identity,
      units: "mm",
      bodyCount: 2,
      portability: "wcad-required"
    });
    expect(formatSourceIdentitySummary(identity)).toBe("Source ab12cd34");
    expect(offer.sourceIdentitySummary).toBe("Source ab12cd34");
    expect(offer.portabilityLabel).toBe("Checkpoint payloads included");
    const visible = crashRecoveryVisibleText({
      state: "current",
      available: true,
      lastResult: `Last captured revision: ${offer.capturedRevisionSummary}.`,
      offer
    });
    expect(visible).toContain("Source ab12cd34");
    expect(visible).not.toContain(HASH);
    expect(visible.toLowerCase()).not.toMatch(
      /opfs|filehandle|partbench-crash-recovery-v1|g-[0-9a-f-]{8}/
    );
  });
});

import { describe, expect, it } from "vitest";
import { formatVisibleDiagnosticMessage } from "./viewportVisibleText";

describe("viewport visible text", () => {
  it("formats internal readiness diagnostic copy for product surfaces", () => {
    const message = formatVisibleDiagnosticMessage(
      "cad-core command-ready checkpoint-payload package-contract OCCT-mesh deferred tranche milestone debug renderer-hit:abc"
    );

    expect(message).toContain("modeling engine");
    expect(message).toContain("ready");
    expect(message).toContain("saved topology data");
    expect(message).toContain("project file format");
    expect(message).toContain("display geometry");
    expect(message).toContain("not ready yet");
    expect(message).toContain("release step");
    expect(message).toContain("diagnostic");
    expect(message).toContain("internal render target");
    expect(message).not.toMatch(
      /\b(command-ready|cad-core|checkpoint-payload|package-contract|OCCT-mesh|deferred|tranche|milestone|debug|renderer-hit)\b/i
    );
  });
});

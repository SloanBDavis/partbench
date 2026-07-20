import { describe, expect, it } from "vitest";
import { formatVisibleDiagnosticMessage } from "./viewportVisibleText";

describe("viewport visible text", () => {
  it("formats internal readiness diagnostic copy for product surfaces", () => {
    const message = formatVisibleDiagnosticMessage(
      "cad-core command-ready checkpoint-payload package-contract OCCT-mesh deferred tranche milestone debug renderer-hit:abc Geometry worker OCCT/WASM checkpoint-local:face-1 checkpointEntityId:face-2"
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
    expect(message).not.toContain(
      "internal render target internal render target"
    );
    expect(message).toContain("Display geometry engine");
    expect(message).toContain("exact geometry runtime");
    expect(message).not.toMatch(
      /\b(command-ready|cad-core|checkpoint-payload|package-contract|OCCT-mesh|deferred|tranche|milestone|debug|renderer-hit|Geometry worker|OCCT\/WASM|checkpoint-local|checkpointEntityId)\b/i
    );
  });

  it("formats downstream edit blockers without raw source ids", () => {
    const message = formatVisibleDiagnosticMessage(
      "Feature feat_circle_1 cannot be edited safely because downstream result body body_circle_cut is consumed by feature feat_circle_hole. Edit or repair that downstream feature before changing the original source."
    );

    expect(message).toBe(
      "This source feature cannot be edited because a downstream result depends on it. Edit or repair that downstream feature before changing the original source."
    );
    expect(message).not.toMatch(/\b(feat_[a-z0-9_]+|body_[a-z0-9_]+)\b/i);
  });

  it("formats consumed body diagnostics without raw source ids", () => {
    expect(
      formatVisibleDiagnosticMessage(
        "Selected body body_rect is consumed by feature feat_cut."
      )
    ).toBe("Selected body already has a downstream result.");
    expect(
      formatVisibleDiagnosticMessage("Body body_rect was consumed by feat_cut.")
    ).toBe("Selected body already has a downstream result.");
  });

  it("separates a complete solid from unavailable downstream references", () => {
    expect(
      formatVisibleDiagnosticMessage(
        "Body body_revolve does not expose stable command-ready generated references yet."
      )
    ).toBe(
      "This solid is complete, but its faces and edges are not available to downstream modeling tools."
    );
  });
});

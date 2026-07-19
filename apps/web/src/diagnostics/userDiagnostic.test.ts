import { describe, expect, it, vi } from "vitest";
import {
  containsInternalText,
  formatUserDiagnostic,
  translateUserDiagnostic
} from "./userDiagnostic";
import {
  copyTechnicalDetails,
  createTechnicalDetails
} from "./technicalDetails";

describe("userDiagnostic", () => {
  it.each([
    ["SKETCH_PROFILE_OPEN", "Profile is open.", "Connect the highlighted"],
    [
      "SKETCH_PATH_JOIN_NOT_TANGENT",
      "Sweep path has a sharp corner.",
      "tangent line and arc"
    ],
    [
      "TARGET_BODY_CONSUMED",
      "Target body is no longer available.",
      "current result body"
    ],
    ["NAMED_REFERENCE_STALE", "Reference needs repair.", "compatible targets"],
    [
      "GEOMETRY_WORKER_UNAVAILABLE",
      "Geometry display is unavailable.",
      "Retry display generation"
    ]
  ])("translates %s into human copy", (code, title, recovery) => {
    const result = translateUserDiagnostic({
      code,
      severity: "error",
      message: `Internal ${code} featureId=private`
    });
    const visible = formatUserDiagnostic(result);

    expect(result.title).toBe(title);
    expect(result.recovery).toContain(recovery);
    expect(containsInternalText(visible)).toBe(false);
    expect(visible).not.toContain(code);
    expect(visible).not.toContain("featureId");
  });

  it("uses a safe fallback instead of exposing an unknown diagnostic", () => {
    const result = translateUserDiagnostic({
      code: "OCCT_SHAPE_CACHE_FAILURE",
      message: "mesh triangle worker generated:secret"
    });
    const visible = formatUserDiagnostic(result);

    expect(result.title).toBe("Operation could not be completed.");
    expect(containsInternalText(visible)).toBe(false);
    expect(visible).not.toContain("OCCT");
    expect(visible).not.toContain("generated:secret");
  });

  it("keeps structured evidence in explicit technical details", async () => {
    const model = createTechnicalDetails({
      code: "INTERNAL_CODE",
      severity: "error",
      message: "Internal evidence",
      context: { stableId: "generated:face:one" }
    });
    const writeText = vi.fn(async () => undefined);

    expect(model.label).toBe("Technical Details");
    expect(model.copyText).toContain("INTERNAL_CODE");
    expect(model.copyText).toContain("generated:face:one");
    await expect(copyTechnicalDetails(model, { writeText })).resolves.toBe(
      true
    );
    expect(writeText).toHaveBeenCalledWith(model.copyText);
  });

  it("normalizes circular details without throwing", () => {
    const detail: { self?: unknown } = {};
    detail.self = detail;
    expect(createTechnicalDetails({ detail }).copyText).toContain("[Circular]");
  });
});

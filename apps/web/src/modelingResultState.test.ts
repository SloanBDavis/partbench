import { describe, expect, it } from "vitest";
import { createModelingResultState } from "./modelingResultState";

describe("modeling result state", () => {
  const readyGeometry = {
    entries: [{ status: "ready" as const }],
    errorCount: 0,
    pendingCount: 0
  };
  const readyExactMetadata = {
    entries: [{ status: "ready" as const }],
    errorCount: 0,
    pendingCount: 0
  };

  it("does not call a compiled-out derived result ready", () => {
    expect(
      createModelingResultState({
        commandPending: false,
        commandFailed: false,
        derivedGeometryEnabled: false,
        derivedSourceIds: ["body"],
        derivedGeometry: { entries: [], errorCount: 0, pendingCount: 0 },
        projectHealthStatus: "healthy"
      })
    ).toBe("Fallback display only");
  });

  it("reports missing, pending, unsupported, and failed results", () => {
    const base = {
      commandPending: false,
      commandFailed: false,
      derivedGeometryEnabled: true,
      derivedSourceIds: ["body"],
      projectHealthStatus: "healthy" as const
    };

    expect(
      createModelingResultState({
        ...base,
        derivedGeometry: { entries: [], errorCount: 0, pendingCount: 0 }
      })
    ).toBe("Building results");
    expect(
      createModelingResultState({
        ...base,
        derivedGeometry: {
          entries: [{ status: "pending" }],
          errorCount: 0,
          pendingCount: 1
        }
      })
    ).toBe("Building results");
    expect(
      createModelingResultState({
        ...base,
        derivedGeometry: {
          entries: [{ status: "unsupported" }],
          errorCount: 0,
          pendingCount: 0
        }
      })
    ).toBe("1 result unavailable");
    expect(
      createModelingResultState({
        ...base,
        derivedGeometry: {
          entries: [{ status: "error" }],
          errorCount: 1,
          pendingCount: 0
        }
      })
    ).toBe("1 result failed");
  });

  it("distinguishes normal sketch freedom from blocking dependency health", () => {
    expect(
      createModelingResultState({
        commandPending: false,
        commandFailed: false,
        derivedGeometryEnabled: true,
        derivedSourceIds: ["body"],
        derivedGeometry: readyGeometry,
        projectHealthStatus: "under-defined"
      })
    ).toBe("Ready with design notes");
    expect(
      createModelingResultState({
        commandPending: false,
        commandFailed: false,
        derivedGeometryEnabled: true,
        derivedSourceIds: ["body"],
        derivedGeometry: readyGeometry,
        projectHealthStatus: "missing-source"
      })
    ).toBe("Needs attention");
  });

  it("does not report ready while an exact result is missing or pending", () => {
    const base = {
      commandPending: false,
      commandFailed: false,
      derivedGeometryEnabled: true,
      derivedSourceIds: ["body"],
      derivedGeometry: readyGeometry,
      derivedExactSourceIds: ["body"],
      projectHealthStatus: "healthy" as const
    };

    expect(createModelingResultState(base)).toBe(
      "Display ready · Building exact results"
    );
    expect(
      createModelingResultState({
        ...base,
        derivedExactMetadata: {
          entries: [{ status: "pending" }],
          errorCount: 0,
          pendingCount: 1
        }
      })
    ).toBe("Display ready · Building exact results");
  });

  it("reports failed, cancelled, and unavailable exact results", () => {
    const base = {
      commandPending: false,
      commandFailed: false,
      derivedGeometryEnabled: true,
      derivedSourceIds: ["body"],
      derivedGeometry: readyGeometry,
      derivedExactSourceIds: ["body"],
      projectHealthStatus: "healthy" as const
    };

    expect(
      createModelingResultState({
        ...base,
        derivedExactMetadata: {
          entries: [{ status: "error" }],
          errorCount: 1,
          pendingCount: 0
        }
      })
    ).toBe("1 exact result failed");
    expect(
      createModelingResultState({
        ...base,
        derivedExactMetadata: {
          entries: [{ status: "cancelled" }],
          errorCount: 0,
          pendingCount: 0,
          cancelledCount: 1
        }
      })
    ).toBe("1 exact result cancelled");
    expect(
      createModelingResultState({
        ...base,
        derivedExactMetadata: {
          entries: [{ status: "unsupported" }],
          errorCount: 0,
          pendingCount: 0
        }
      })
    ).toBe("1 exact result unavailable");
  });

  it("reports ready only after current display and exact results settle", () => {
    expect(
      createModelingResultState({
        commandPending: false,
        commandFailed: false,
        derivedGeometryEnabled: true,
        derivedSourceIds: ["body"],
        derivedGeometry: readyGeometry,
        derivedExactSourceIds: ["body"],
        derivedExactMetadata: readyExactMetadata,
        projectHealthStatus: "healthy"
      })
    ).toBe("Ready");
    expect(
      createModelingResultState({
        commandPending: false,
        commandFailed: false,
        derivedGeometryEnabled: true,
        derivedSourceIds: ["body"],
        derivedGeometry: readyGeometry,
        derivedExactSourceIds: ["body"],
        derivedExactMetadata: readyExactMetadata,
        projectHealthStatus: "under-defined"
      })
    ).toBe("Ready with design notes");
  });

  it("uses the shared exact-result projection when consumers disagree", () => {
    const base = {
      commandPending: false,
      commandFailed: false,
      derivedGeometryEnabled: true,
      derivedSourceIds: ["body"],
      derivedGeometry: readyGeometry,
      derivedExactSourceIds: ["body"],
      derivedExactMetadata: readyExactMetadata,
      projectHealthStatus: "healthy" as const
    };

    expect(
      createModelingResultState({
        ...base,
        currentExactResults: [{ status: "failed" }]
      })
    ).toBe("1 exact result failed");
    expect(
      createModelingResultState({
        ...base,
        currentExactResults: [{ status: "stale" }]
      })
    ).toBe("1 exact result needs attention");
    expect(
      createModelingResultState({
        ...base,
        currentExactResults: [{ status: "pending" }]
      })
    ).toBe("Building exact results");
  });

  it("ignores legitimately consumed intermediates while preserving active result blockers", () => {
    const base = {
      commandPending: false,
      commandFailed: false,
      derivedGeometryEnabled: true,
      derivedSourceIds: ["body"],
      derivedGeometry: readyGeometry,
      derivedExactSourceIds: ["body"],
      derivedExactMetadata: readyExactMetadata,
      projectHealthStatus: "healthy" as const
    };
    const consumed = {
      status: "blocked" as const,
      diagnostics: [
        {
          code: "EXPORT_BODY_NOT_ACTIVE" as const,
          status: "blocked" as const,
          message: "Consumed by a downstream feature."
        }
      ]
    };
    expect(
      createModelingResultState({
        ...base,
        currentExactResults: [consumed, consumed, consumed, { status: "ready" }]
      })
    ).toBe("Ready");
    expect(
      createModelingResultState({
        ...base,
        currentExactResults: [consumed, { status: "blocked" }]
      })
    ).toBe("1 exact result needs attention");
    expect(
      createModelingResultState({
        ...base,
        currentExactResults: [consumed, { status: "pending" }]
      })
    ).toBe("Building exact results");
  });

  it("counts each active body once when exact artifacts replace runtime results", () => {
    const activeBodyIds = Array.from(
      { length: 11 },
      (_, index) => `body-${index}`
    );
    const sourcesWithArtifactEvidence = [...activeBodyIds, ...activeBodyIds];
    const settled = {
      entries: activeBodyIds.map(() => ({ status: "ready" as const })),
      errorCount: 0,
      pendingCount: 0
    };
    const base = {
      commandPending: false,
      commandFailed: false,
      derivedGeometryEnabled: true,
      derivedSourceIds: sourcesWithArtifactEvidence,
      derivedExactSourceIds: sourcesWithArtifactEvidence,
      derivedGeometry: settled,
      derivedExactMetadata: settled,
      currentExactResults: activeBodyIds.map(() => ({
        status: "ready" as const
      })),
      projectHealthStatus: "healthy" as const
    };
    expect(createModelingResultState(base)).toBe("Ready");
    expect(
      createModelingResultState({
        ...base,
        derivedSourceIds: [...sourcesWithArtifactEvidence, "new-body"]
      })
    ).toBe("Building results");
    expect(
      createModelingResultState({
        ...base,
        derivedExactSourceIds: [...sourcesWithArtifactEvidence, "new-body"]
      })
    ).toBe("Display ready · Building exact results");
  });

  it("prioritizes live command state and command failure", () => {
    expect(
      createModelingResultState({
        commandPending: true,
        commandFailed: true,
        derivedGeometryEnabled: true,
        derivedSourceIds: ["body"],
        derivedGeometry: readyGeometry,
        projectHealthStatus: "healthy"
      })
    ).toBe("Updating");
    expect(
      createModelingResultState({
        commandPending: false,
        commandFailed: true,
        derivedGeometryEnabled: true,
        derivedSourceIds: ["body"],
        derivedGeometry: readyGeometry,
        projectHealthStatus: "healthy"
      })
    ).toBe("Update failed");
  });
});

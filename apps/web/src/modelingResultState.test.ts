import { describe, expect, it } from "vitest";
import { createModelingResultState } from "./modelingResultState";

describe("modeling result state", () => {
  const readyGeometry = {
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
        derivedSourceCount: 1,
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
      derivedSourceCount: 1,
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
        derivedSourceCount: 1,
        derivedGeometry: readyGeometry,
        projectHealthStatus: "under-defined"
      })
    ).toBe("Ready with design notes");
    expect(
      createModelingResultState({
        commandPending: false,
        commandFailed: false,
        derivedGeometryEnabled: true,
        derivedSourceCount: 1,
        derivedGeometry: readyGeometry,
        projectHealthStatus: "missing-source"
      })
    ).toBe("Needs attention");
  });

  it("prioritizes live command state and command failure", () => {
    expect(
      createModelingResultState({
        commandPending: true,
        commandFailed: true,
        derivedGeometryEnabled: true,
        derivedSourceCount: 1,
        derivedGeometry: readyGeometry,
        projectHealthStatus: "healthy"
      })
    ).toBe("Updating");
    expect(
      createModelingResultState({
        commandPending: false,
        commandFailed: true,
        derivedGeometryEnabled: true,
        derivedSourceCount: 1,
        derivedGeometry: readyGeometry,
        projectHealthStatus: "healthy"
      })
    ).toBe("Update failed");
  });
});

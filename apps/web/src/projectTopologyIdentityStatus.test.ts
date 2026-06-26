import type { ProjectTopologyIdentityReadinessQueryResponse } from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import { createProjectTopologyIdentityDisplay } from "./projectTopologyIdentityStatus";

describe("projectTopologyIdentityStatus", () => {
  it("summarizes empty topology identity readiness without JSON lossiness warnings", () => {
    const display = createProjectTopologyIdentityDisplay(createReadiness());

    expect(display).toMatchObject({
      statusLabel: "Partial",
      checkpointSummary: "0 checkpoints",
      anchorSummary: "0 anchors",
      packageSummary: "Ready for .wcad",
      detail: "No saved topology evidence has been written for this project.",
      jsonWarning: undefined
    });
  });

  it("warns that JSON import/export can omit exact evidence without internal payload copy", () => {
    const display = createProjectTopologyIdentityDisplay(
      createReadiness({ checkpointCount: 1, anchorCount: 2 })
    );

    expect(display.checkpointSummary).toBe("1 checkpoint");
    expect(display.anchorSummary).toBe("2 anchors");
    expect(display.packageSummary).toBe("Saved with .wcad");
    expect(display.detail).toBe(
      "Saved topology identity is tracked in the project source."
    );
    expect(display.jsonWarning).toContain("Use .wcad");
    expect(display.jsonWarning).toContain("JSON import/export");
    expect(display.jsonWarning).toContain("exact shape evidence");
    expect(display.jsonWarning).not.toMatch(/checkpoint payload|debug/i);
    expect(display.capabilityRows).toEqual([
      expect.objectContaining({
        label: "B-rep checkpoint persistence",
        value: "Supported"
      })
    ]);
  });
});

function createReadiness(
  overrides: Partial<ProjectTopologyIdentityReadinessQueryResponse> = {}
): ProjectTopologyIdentityReadinessQueryResponse {
  return {
    ok: true,
    query: "project.topologyIdentityReadiness",
    cadOpsVersion: "cadops.v1",
    contractVersion: "partbench.topology-identity.v1",
    status: "deferred",
    currentDocumentSchemaVersion: "web-cad.project.v16",
    plannedProjectSchemaVersion: "web-cad.project.v18",
    currentPackageVersion: "partbench.wcad.v1",
    plannedPackageVersion: "partbench.wcad.v2",
    requiresProjectSchemaMigration: false,
    requiresPackageVersionMigration: false,
    sourceBoundaryNote: "Document source only.",
    derivedBoundaryNote: "No renderer identifiers.",
    supportedEntityKinds: ["body", "face", "edge", "vertex"],
    currentFeatureCount: 1,
    currentBodyCount: 1,
    currentNamedReferenceCount: 0,
    snapshotDescriptorCount: 0,
    snapshots: [],
    anchorCount: 0,
    anchors: [],
    checkpointCount: 0,
    checkpoints: [],
    matchResultCount: 0,
    matchResults: [],
    repairCandidateCount: 0,
    repairCandidates: [],
    capabilityCount: 1,
    capabilities: [
      {
        capability: "checkpointPersistence",
        label: "B-rep checkpoint persistence",
        status: "supported",
        available: true,
        sourceBoundaryNote: "Document source only.",
        derivedBoundaryNote: "No renderer identifiers.",
        diagnostics: [
          {
            code: "TOPOLOGY_CHECKPOINT_PERSISTENCE_READY",
            status: "supported",
            severity: "info",
            message: "Checkpoint payload preservation is available."
          }
        ]
      }
    ],
    diagnosticCount: 0,
    diagnostics: [],
    ...overrides
  };
}

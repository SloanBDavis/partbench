import { describe, expect, it } from "vitest";
import type { ProjectExportReadinessQueryResponse } from "@web-cad/cad-protocol";
import { createProjectExportReadinessDisplay } from "./projectExportReadiness";

describe("projectExportReadiness", () => {
  it("formats available STEP and deferred visualization state", () => {
    const display = createProjectExportReadinessDisplay(
      createExportReadinessResponse()
    );

    expect(display.statusLabel).toBe("Supported");
    expect(display.detail).toContain("STEP export is available");
    expect(display.bodySummary).toBe(
      "1 source supported, 1 deferred, 0 unavailable"
    );
    expect(display.formatRows).toMatchObject([
      {
        id: "step",
        label: "STEP",
        status: "supported",
        detail: "STEP export is available for current source bodies."
      },
      {
        id: "glb",
        label: "Mesh/GLB visualization",
        status: "deferred",
        detail: "Mesh/GLB visualization export files are not available yet."
      }
    ]);
    expect(display.bodyRows).toMatchObject([
      {
        id: "body_rect",
        status: "supported",
        detail: "Source body is supported for exact STEP export."
      },
      {
        id: "body_hole",
        status: "deferred",
        detail: "Hole result-body export readiness is deferred."
      }
    ]);
  });

  it("overlays derived Mesh/GLB visualization availability without changing STEP", () => {
    const display = createProjectExportReadinessDisplay(
      createExportReadinessResponse(),
      {
        status: "supported",
        available: true,
        detail:
          "GLB visualization export is available for ready derived display meshes.",
        limitation:
          "Ready derived visualization meshes can be written as a transient GLB artifact.",
        nextStep:
          "Download the GLB visualization artifact from the Project panel.",
        exportableBodyCount: 1,
        skippedBodyCount: 1,
        vertexCount: 24,
        triangleCount: 12
      }
    );

    expect(display.statusLabel).toBe("Supported");
    expect(display.detail).toContain("STEP and Visualization GLB export");
    expect(display.formatRows).toMatchObject([
      {
        id: "step",
        label: "STEP",
        status: "supported",
        detail: "STEP export is available for current source bodies."
      },
      {
        id: "glb",
        label: "Mesh/GLB visualization",
        status: "supported",
        detail:
          "Mesh/GLB visualization export is available for 1 ready visualization body.",
        limitation:
          "24 vertices and 12 triangles will be written as display output. 1 body skipped: Ready derived visualization meshes can be written as a transient GLB artifact."
      }
    ]);
  });

  it("pluralizes visualization body export counts", () => {
    const display = createProjectExportReadinessDisplay(
      createExportReadinessResponse(),
      {
        status: "supported",
        available: true,
        detail:
          "GLB visualization export is available for ready derived display meshes.",
        limitation:
          "Ready derived visualization meshes can be written as a transient GLB artifact.",
        nextStep:
          "Download the GLB visualization artifact from the Project panel.",
        exportableBodyCount: 2,
        skippedBodyCount: 2,
        vertexCount: 48,
        triangleCount: 24
      }
    );

    const glbRow = display.formatRows.find((row) => row.id === "glb");

    expect(glbRow?.detail).toBe(
      "Mesh/GLB visualization export is available for 2 ready visualization bodies."
    );
    expect(glbRow?.limitation).toBe(
      "48 vertices and 24 triangles will be written as display output. 2 bodies skipped: Ready derived visualization meshes can be written as a transient GLB artifact."
    );
    expect(glbRow?.limitation).not.toContain("bodyies");
  });

  it("keeps public source and derived boundary wording implementation-neutral", () => {
    const display = createProjectExportReadinessDisplay(
      createExportReadinessResponse()
    );
    const publicText = JSON.stringify(display);

    expect(display.sourceDetail).toContain("current project contents");
    expect(display.derivedDetail).toContain("not used for STEP export");
    expect(publicText).not.toMatch(/OCCT|renderer|cache|selection-buffer/i);
  });
});

function createExportReadinessResponse(): ProjectExportReadinessQueryResponse {
  return {
    ok: true,
    query: "project.exportReadiness",
    cadOpsVersion: "cadops.v1",
    status: "supported",
    canExportFiles: true,
    units: "mm",
    sourceBoundaryNote:
      "Classified from authoritative project bodies, features, sketches, and document units.",
    derivedBoundaryNote:
      "No derived display output, visualization cache, or export job state is read or persisted.",
    formatCount: 2,
    formats: [
      {
        format: "step",
        label: "STEP",
        exportKind: "exact",
        status: "supported",
        available: true,
        writerStatus: "available",
        fileExtensions: [".step", ".stp"],
        units: "mm",
        sourceBoundaryNote:
          "STEP uses exact body sources derived from authoritative CAD document state.",
        derivedBoundaryNote:
          "STEP readiness does not use derived visualization output.",
        candidateBodyCount: 2,
        sourceSupportedBodyCount: 1,
        deferredBodyCount: 1,
        unavailableBodyCount: 0,
        diagnostics: []
      },
      {
        format: "glb",
        label: "Mesh/GLB visualization",
        exportKind: "visualization",
        status: "deferred",
        available: false,
        writerStatus: "unavailable",
        fileExtensions: [".glb"],
        units: "mm",
        sourceBoundaryNote:
          "GLB would be visualization output derived from authoritative bodies.",
        derivedBoundaryNote: "Visualization file writing is not implemented.",
        candidateBodyCount: 2,
        sourceSupportedBodyCount: 1,
        deferredBodyCount: 2,
        unavailableBodyCount: 0,
        diagnostics: [
          {
            code: "EXPORT_WRITER_NOT_IMPLEMENTED",
            status: "deferred",
            format: "glb",
            message:
              "Mesh/GLB visualization file export is not implemented yet; this query reports readiness and blockers only."
          }
        ]
      }
    ],
    bodyCount: 2,
    sourceSupportedBodyCount: 1,
    deferredBodyCount: 1,
    unavailableBodyCount: 0,
    bodies: [
      {
        bodyId: "body_rect",
        bodyKind: "solid",
        featureId: "feat_rect",
        partId: "part:default",
        sourceKind: "authoredExtrude",
        sourceStatus: "supported",
        status: "supported",
        sourceBoundaryNote: "Authoritative project source.",
        derivedBoundaryNote: "No display output.",
        formats: [],
        diagnostics: [
          {
            code: "EXPORT_BODY_SOURCE_SUPPORTED",
            status: "supported",
            bodyId: "body_rect",
            bodyKind: "solid",
            sourceKind: "authoredExtrude",
            featureId: "feat_rect",
            message:
              "Authored rectangle newBody extrude body body_rect has supported source semantics for future file export."
          }
        ]
      },
      {
        bodyId: "body_hole",
        bodyKind: "solid",
        featureId: "feat_hole",
        partId: "part:default",
        sourceKind: "authoredHole",
        sourceStatus: "deferred",
        status: "deferred",
        sourceBoundaryNote: "Authoritative project source.",
        derivedBoundaryNote: "No display output.",
        formats: [],
        diagnostics: [
          {
            code: "EXPORT_RESULT_BODY_DEFERRED",
            status: "deferred",
            bodyId: "body_hole",
            bodyKind: "solid",
            sourceKind: "authoredHole",
            featureId: "feat_hole",
            message:
              "Result body body_hole is source-modeled, but export readiness is deferred."
          }
        ]
      }
    ],
    diagnosticCount: 4,
    diagnostics: []
  };
}

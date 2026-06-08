import { describe, expect, it } from "vitest";
import type { ProjectExportReadinessQueryResponse } from "@web-cad/cad-protocol";
import { createProjectExportReadinessDisplay } from "./projectExportReadiness";

describe("projectExportReadiness", () => {
  it("formats deferred format writers and source-supported body state", () => {
    const display = createProjectExportReadinessDisplay(
      createExportReadinessResponse()
    );

    expect(display.statusLabel).toBe("Deferred");
    expect(display.detail).toContain("STEP file export is not implemented yet");
    expect(display.bodySummary).toBe(
      "1 source supported, 2 deferred, 0 unavailable"
    );
    expect(display.formatRows).toMatchObject([
      {
        id: "step",
        label: "STEP",
        status: "deferred",
        detail: "STEP export files are not available yet."
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
        status: "deferred",
        detail:
          "Source body is supported; file availability depends on the format boundary."
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
    expect(display.detail).toContain("Mesh/GLB visualization export");
    expect(display.detail).toContain("STEP remains unavailable");
    expect(display.formatRows).toMatchObject([
      {
        id: "step",
        label: "STEP",
        status: "deferred",
        detail: "STEP export files are not available yet."
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

  it("keeps public source and derived boundary wording implementation-neutral", () => {
    const display = createProjectExportReadinessDisplay(
      createExportReadinessResponse()
    );
    const publicText = JSON.stringify(display);

    expect(display.sourceDetail).toContain("authoritative project source");
    expect(display.derivedDetail).toContain("not used as export authority");
    expect(publicText).not.toMatch(/OCCT|renderer|cache|selection-buffer/i);
  });
});

function createExportReadinessResponse(): ProjectExportReadinessQueryResponse {
  return {
    ok: true,
    query: "project.exportReadiness",
    cadOpsVersion: "cadops.v1",
    status: "deferred",
    canExportFiles: false,
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
        status: "deferred",
        available: false,
        fileExtensions: [".step", ".stp"],
        units: "mm",
        sourceBoundaryNote:
          "STEP requires an exact body writer from authoritative CAD source.",
        derivedBoundaryNote:
          "STEP readiness does not use derived visualization output.",
        candidateBodyCount: 2,
        sourceSupportedBodyCount: 1,
        deferredBodyCount: 2,
        unavailableBodyCount: 0,
        diagnostics: [
          {
            code: "EXPORT_WRITER_NOT_IMPLEMENTED",
            status: "deferred",
            format: "step",
            message:
              "STEP file export is not implemented yet; this query reports readiness and blockers only."
          }
        ]
      },
      {
        format: "glb",
        label: "Mesh/GLB visualization",
        status: "deferred",
        available: false,
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
    deferredBodyCount: 2,
    unavailableBodyCount: 0,
    bodies: [
      {
        bodyId: "body_rect",
        bodyKind: "solid",
        featureId: "feat_rect",
        partId: "part:default",
        sourceKind: "authoredExtrude",
        sourceStatus: "supported",
        status: "deferred",
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

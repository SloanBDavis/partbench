import { describe, expect, it } from "vitest";
import type { ProjectExactExportQueryResponse } from "@web-cad/cad-protocol";
import type { GeometryWorker } from "@web-cad/geometry-worker";
import { executeProjectExactStepExport } from "./projectExactStepExport";

describe("projectExactStepExport", () => {
  it("resolves a cad-core exact export source payload through the geometry worker", async () => {
    const bytes = new TextEncoder().encode("ISO-10303-21;\nEND-ISO-10303-21;");
    const result = await executeProjectExactStepExport({
      exactExport: createExactExportResponse(),
      worker: createWorker({
        ok: true,
        id: "project-export-step:payload",
        op: "geometry.exportStep",
        artifact: {
          format: "step",
          schema: "AP242DIS",
          units: "mm",
          bodyCount: 1,
          byteLength: bytes.byteLength,
          bytes
        },
        warnings: []
      })
    });

    expect(result.artifact).toMatchObject({
      format: "step",
      fileName: "partbench-export.step",
      mimeType: "model/step",
      byteLength: bytes.byteLength,
      bytesBase64: "SVNPLTEwMzAzLTIxOwpFTkQtSVNPLTEwMzAzLTIxOw=="
    });
    expect(result.artifact?.sha256).toHaveLength(64);
  });

  it("returns a structured diagnostic when the geometry worker fails", async () => {
    const result = await executeProjectExactStepExport({
      exactExport: createExactExportResponse(),
      worker: createWorker({
        ok: false,
        id: "project-export-step:payload",
        op: "geometry.exportStep",
        error: {
          code: "KERNEL_FAILURE",
          message: "writer failed"
        },
        warnings: []
      })
    });

    expect(result).toMatchObject({
      status: "unavailable",
      available: false,
      canExportFile: false,
      exportableBodyCount: 0,
      diagnostics: [
        expect.objectContaining({
          code: "EXPORT_EXACT_WRITER_FAILED",
          status: "unavailable",
          format: "step",
          message:
            "STEP exact export failed in the geometry boundary: writer failed"
        })
      ]
    });
    expect(result.artifact).toBeUndefined();
  });
});

function createExactExportResponse(): ProjectExactExportQueryResponse {
  return {
    ok: true,
    query: "project.exportExact",
    cadOpsVersion: "cadops.v1",
    format: "step",
    label: "STEP",
    exportKind: "exact",
    status: "supported",
    available: true,
    canExportFile: true,
    writerStatus: "available",
    units: "mm",
    fileExtensions: [".step", ".stp"],
    documentSchemaVersion: "web-cad.project.v16",
    sourceIdentityAlgorithm: "partbench-source-v1",
    sourceIdentityStatus: "notProvided",
    requestedBodyIds: ["body_step_rect"],
    bodyCount: 1,
    sourceSupportedBodyCount: 1,
    deferredBodyCount: 0,
    unavailableBodyCount: 0,
    exportableBodyCount: 1,
    exportSources: [
      {
        bodyId: "body_step_rect",
        sourceKind: "authoredExtrude",
        featureId: "feat_step_rect",
        sourceSketchId: "sketch_step_rect",
        sourceSketchEntityId: "rect_step",
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 2,
          height: 1
        },
        depth: 3,
        side: "positive"
      }
    ],
    bodies: [],
    diagnosticCount: 0,
    diagnostics: []
  };
}

function createWorker(response: unknown): GeometryWorker {
  return {
    async execute(request) {
      return {
        id: request.id,
        version: request.version,
        kind: request.kind,
        payloadId: request.payload.id,
        response,
        transferables: []
      } as Awaited<ReturnType<GeometryWorker["execute"]>>;
    }
  };
}

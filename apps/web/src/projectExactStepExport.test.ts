import { describe, expect, it } from "vitest";
import type {
  CadExactExportBodySource,
  ProjectExactExportQueryResponse
} from "@web-cad/cad-protocol";
import type {
  GeometryWorker,
  GeometryWorkerRequest
} from "@web-cad/geometry-worker";
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

  it("passes the canonical wire recipe to STEP without a second placement", async () => {
    const wireSource: CadExactExportBodySource = {
      bodyId: "body_step_wire",
      bodyName: "Wire body",
      sourceKind: "authoredExtrude",
      featureId: "feat_step_wire",
      sourceSketchId: "sketch_step_wire",
      sourceSketchEntityIds: ["line_1", "arc_1"],
      sketchPlane: "XY",
      profile: {
        kind: "wire",
        frame: {
          origin: [10, 20, 30],
          uAxis: [1, 0, 0],
          vAxis: [0, 1, 0]
        },
        closed: true,
        segments: [
          {
            kind: "line",
            sourceEntityId: "line_1",
            start: [0, 0],
            end: [2, 0]
          },
          {
            kind: "arc",
            sourceEntityId: "arc_1",
            center: [1, 0],
            radius: 1,
            startAngleDegrees: 0,
            sweepAngleDegrees: 180
          }
        ],
        sourceIdentity: "partbench-wire-extrude-v1:exact-recipe",
        geometryPolicy: {
          linearTolerance: 1e-7,
          angularToleranceDegrees: 0.1,
          minimumProfileArea: 1e-12
        }
      },
      depth: 3,
      side: "positive"
    };
    let request: GeometryWorkerRequest | undefined;
    const bytes = new TextEncoder().encode("ISO-10303-21;");

    await executeProjectExactStepExport({
      exactExport: createExactExportResponse(wireSource),
      worker: createWorker(
        {
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
        },
        (candidate) => {
          request = candidate;
        }
      )
    });

    expect(request).toBeDefined();
    if (!request || request.payload.op !== "geometry.exportStep") return;
    expect(request.payload.bodies[0]).toMatchObject({
      bodyId: "body_step_wire",
      bodyName: "Wire body",
      sketchPlane: "XY",
      profile: wireSource.profile,
      depth: 3,
      side: "positive"
    });
    expect(request.payload.bodies[0]).not.toHaveProperty("placementFrame");
  });

  it("maps an authored wire revolve source to the geometry STEP discriminant", async () => {
    const profile = createStepWireProfile("add");
    const revolveSource: CadExactExportBodySource = {
      bodyId: "body_step_revolve",
      bodyName: "Composite revolve",
      sourceKind: "authoredRevolve",
      featureId: "feature_step_revolve",
      sourceSketchId: "sketch_step_revolve",
      sourceSketchEntityIds: ["add_line", "add_arc"],
      sketchPlane: "XY",
      profile,
      axis: {
        sourceEntityId: "axis",
        start: [0, -2],
        end: [0, 2]
      },
      angleDegrees: 270,
      solidPolicy: "exactlyOne"
    };
    let request: GeometryWorkerRequest | undefined;
    const bytes = new TextEncoder().encode("ISO-10303-21;");

    await executeProjectExactStepExport({
      exactExport: createExactExportResponse(revolveSource),
      worker: createWorker(
        {
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
        },
        (candidate) => {
          request = candidate;
        }
      )
    });

    expect(request).toBeDefined();
    if (!request || request.payload.op !== "geometry.exportStep") return;
    expect(request.payload.bodies[0]).toEqual({
      bodyId: "body_step_revolve",
      bodyName: "Composite revolve",
      kind: "revolve",
      sketchPlane: "XY",
      profile,
      axis: { start: [0, -2], end: [0, 2] },
      angleDegrees: 270
    });
    expect(request.payload.bodies[0]).not.toHaveProperty("placementFrame");
  });

  it("passes one recursive composite add body to STEP without replacing its world frame", async () => {
    const wireProfile = {
      kind: "wire" as const,
      frame: {
        origin: [5, 0, 0] as const,
        uAxis: [0, 1, 0] as const,
        vAxis: [0, 0, 1] as const
      },
      closed: true as const,
      segments: [
        {
          kind: "line" as const,
          sourceEntityId: "add_line",
          start: [0, -1] as const,
          end: [0, 1] as const
        },
        {
          kind: "arc" as const,
          sourceEntityId: "add_arc",
          center: [0, 0] as const,
          radius: 1,
          startAngleDegrees: 90,
          sweepAngleDegrees: 180
        }
      ],
      sourceIdentity: "partbench-wire-extrude-v1:add-step-recipe",
      geometryPolicy: {
        linearTolerance: 1e-7,
        angularToleranceDegrees: 0.1,
        minimumProfileArea: 1e-12
      }
    };
    const addSource: CadExactExportBodySource = {
      bodyId: "body_step_add",
      bodyName: "Composite add",
      sourceKind: "authoredExtrude",
      featureId: "feat_step_add",
      sourceSketchId: "sketch_step_add",
      sourceSketchEntityIds: ["add_line", "add_arc"],
      sketchPlane: "XY",
      depth: 3,
      side: "positive",
      targetBodyId: "body_step_target",
      exactResultSourceIdentitySignature: "current-add-result-signature",
      kind: "booleanExtrudes",
      operation: "add",
      target: {
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 4,
          height: 4
        },
        depth: 3,
        side: "positive"
      },
      tool: {
        sketchPlane: "XY",
        profile: wireProfile,
        depth: 3,
        side: "positive"
      }
    };
    let request: GeometryWorkerRequest | undefined;
    const bytes = new TextEncoder().encode("ISO-10303-21;");

    const result = await executeProjectExactStepExport({
      exactExport: createExactExportResponse(addSource),
      worker: createWorker(
        {
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
        },
        (candidate) => {
          request = candidate;
        }
      )
    });

    expect(result.artifact).toMatchObject({ byteLength: bytes.byteLength });
    expect(request).toBeDefined();
    if (!request || request.payload.op !== "geometry.exportStep") return;
    expect(request.payload.bodies).toHaveLength(1);
    expect(request.payload.bodies[0]).toEqual({
      bodyId: "body_step_add",
      bodyName: "Composite add",
      kind: "booleanExtrudes",
      operation: "add",
      target: addSource.target,
      tool: {
        sketchPlane: "XY",
        profile: wireProfile,
        depth: 3,
        side: "positive"
      }
    });
    expect(request.payload.bodies[0]).not.toHaveProperty("placementFrame");
    expect(request.payload.bodies[0]).not.toHaveProperty(
      "exactResultSourceIdentitySignature"
    );
  });

  it("passes a recursive add-to-wire-cut body to STEP with the canonical cut tool", async () => {
    const addWire = createStepWireProfile("add");
    const cutWire = createStepWireProfile("cut");
    const addResult = {
      kind: "booleanExtrudes" as const,
      operation: "add" as const,
      target: {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 4,
          height: 4
        },
        depth: 3,
        side: "positive" as const
      },
      tool: {
        sketchPlane: "XY" as const,
        profile: addWire,
        depth: 3,
        side: "positive" as const
      }
    };
    const source: CadExactExportBodySource = {
      bodyId: "body_step_cut",
      bodyName: "Composite cut",
      sourceKind: "authoredExtrude",
      featureId: "feat_step_cut",
      sourceSketchId: "sketch_step_cut",
      sourceSketchEntityIds: ["cut_line", "cut_arc"],
      sketchPlane: "XY",
      depth: 2,
      side: "negative",
      targetBodyId: "body_step_add",
      exactResultSourceIdentitySignature: "current-cut-result-signature",
      kind: "booleanExtrudes",
      operation: "cut",
      target: addResult,
      tool: {
        sketchPlane: "XY",
        profile: cutWire,
        depth: 2,
        side: "negative"
      }
    };
    let request: GeometryWorkerRequest | undefined;
    const bytes = new TextEncoder().encode("ISO-10303-21;");

    await executeProjectExactStepExport({
      exactExport: createExactExportResponse(source),
      worker: createWorker(
        {
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
        },
        (candidate) => {
          request = candidate;
        }
      )
    });

    expect(request).toBeDefined();
    if (!request || request.payload.op !== "geometry.exportStep") return;
    expect(request.payload.bodies[0]).toEqual({
      bodyId: "body_step_cut",
      bodyName: "Composite cut",
      kind: "booleanExtrudes",
      operation: "cut",
      target: addResult,
      tool: {
        sketchPlane: "XY",
        profile: cutWire,
        depth: 2,
        side: "negative"
      }
    });
    expect(request.payload.bodies[0]).not.toHaveProperty("placementFrame");
  });
});

function createStepWireProfile(prefix: "add" | "cut") {
  return {
    kind: "wire" as const,
    frame: {
      origin: [0, 0, 0] as const,
      uAxis: [1, 0, 0] as const,
      vAxis: [0, 1, 0] as const
    },
    closed: true as const,
    segments: [
      {
        kind: "line" as const,
        sourceEntityId: `${prefix}_line`,
        start: [0, -1] as const,
        end: [0, 1] as const
      },
      {
        kind: "arc" as const,
        sourceEntityId: `${prefix}_arc`,
        center: [0, 0] as const,
        radius: 1,
        startAngleDegrees: 90,
        sweepAngleDegrees: 180
      }
    ],
    sourceIdentity: `partbench-wire-extrude-v1:${prefix}-step-recipe`,
    geometryPolicy: {
      linearTolerance: 1e-7,
      angularToleranceDegrees: 0.1,
      minimumProfileArea: 1e-12
    }
  };
}

function createExactExportResponse(
  source: CadExactExportBodySource = {
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
): ProjectExactExportQueryResponse {
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
    requestedBodyIds: [source.bodyId],
    bodyCount: 1,
    sourceSupportedBodyCount: 1,
    deferredBodyCount: 0,
    unavailableBodyCount: 0,
    exportableBodyCount: 1,
    exportSources: [source],
    bodies: [],
    diagnosticCount: 0,
    diagnostics: []
  };
}

function createWorker(
  response: unknown,
  onRequest?: (request: GeometryWorkerRequest) => void
): GeometryWorker {
  return {
    async execute(request) {
      onRequest?.(request);
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

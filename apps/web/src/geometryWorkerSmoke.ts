import {
  createBoxTessellationWorkerRequest,
  createConeTessellationWorkerRequest,
  createCylinderTessellationWorkerRequest,
  createExtrudeBooleanWorkerRequest,
  createNamedStepProbeWorkerRequest,
  createSphereTessellationWorkerRequest,
  createTorusTessellationWorkerRequest,
  type GeometryWorkerRequest
} from "@web-cad/geometry-worker/browser";
import { createRenderMeshFromGeometryWorkerResponse } from "@web-cad/renderer-mesh-bridge";
import { BrowserGeometryWorker } from "./browserGeometryWorker";
import {
  createDerivedGeometryErrorDetails,
  createDerivedGeometryErrorFromWorkerResponse
} from "./derivedGeometryRuntime";
import { runV21ExactReleaseBrowserWorkflow } from "./v21ExactReleaseBrowserWorkflow";

const output = document.getElementById("geometry-worker-smoke");

void runGeometryWorkerSmoke();

async function runGeometryWorkerSmoke(): Promise<void> {
  const worker = new BrowserGeometryWorker();

  try {
    const meshResults = [];
    const requests: Array<{
      readonly scenario: string;
      readonly request: GeometryWorkerRequest;
    }> = [
      {
        scenario: "box-2x3x4",
        request: createBoxTessellationWorkerRequest({
          id: "browser_occt_smoke_box",
          payloadId: "browser_occt_smoke_box_payload",
          width: 2,
          height: 3,
          depth: 4
        })
      },
      {
        scenario: "cylinder-r1-h4",
        request: createCylinderTessellationWorkerRequest({
          id: "browser_occt_smoke_cylinder",
          payloadId: "browser_occt_smoke_cylinder_payload",
          radius: 1,
          height: 4
        })
      },
      {
        scenario: "sphere-r1",
        request: createSphereTessellationWorkerRequest({
          id: "browser_occt_smoke_sphere",
          payloadId: "browser_occt_smoke_sphere_payload",
          radius: 1
        })
      },
      {
        scenario: "cone-r1-h2",
        request: createConeTessellationWorkerRequest({
          id: "browser_occt_smoke_cone",
          payloadId: "browser_occt_smoke_cone_payload",
          radius: 1,
          height: 2
        })
      },
      {
        scenario: "torus-R1.5-r0.35",
        request: createTorusTessellationWorkerRequest({
          id: "browser_occt_smoke_torus",
          payloadId: "browser_occt_smoke_torus_payload",
          majorRadius: 1.5,
          minorRadius: 0.35
        })
      },
      {
        scenario: "boolean-rectangle-cut",
        request: createExtrudeBooleanWorkerRequest({
          id: "browser_occt_smoke_boolean_rectangle_cut",
          payloadId: "browser_occt_smoke_boolean_rectangle_cut_payload",
          operation: "cut",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 4,
              height: 4
            },
            depth: 4,
            side: "positive"
          },
          tool: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 1,
              height: 5
            },
            depth: 4,
            side: "positive"
          }
        })
      },
      {
        scenario: "boolean-circle-target-rectangle-cut",
        request: createExtrudeBooleanWorkerRequest({
          id: "browser_occt_smoke_boolean_circle_cut",
          payloadId: "browser_occt_smoke_boolean_circle_cut_payload",
          operation: "cut",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "circle",
              center: [0, 0],
              radius: 2
            },
            depth: 4,
            side: "positive"
          },
          tool: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 1,
              height: 5
            },
            depth: 4,
            side: "positive"
          }
        })
      }
    ];

    for (const item of requests) {
      const roundTripStart = performance.now();
      const response = await worker.execute(item.request);
      const roundTripMs = performance.now() - roundTripStart;

      if (!response.response.ok) {
        throw createDerivedGeometryErrorFromWorkerResponse(response);
      }

      if (!("mesh" in response.response)) {
        throw new Error("Geometry worker smoke expected mesh response data.");
      }

      const renderMesh = createRenderMeshFromGeometryWorkerResponse(response, {
        id: `${item.request.id}_mesh`,
        alignment:
          item.request.payload.op === "geometry.booleanExtrudes"
            ? "source"
            : "boundsCenter"
      });

      meshResults.push({
        scenario: item.scenario,
        primitive: response.response.mesh.primitive,
        vertexCount: renderMesh.vertexCount,
        triangleCount: renderMesh.triangleCount,
        bounds: renderMesh.bounds,
        diagnostics: response.diagnostics,
        timings: {
          occtLoadMs: response.timings?.occtLoadMs,
          tessellationMs: response.timings?.tessellationMs,
          geometryKernelMs: response.timings?.geometryKernelMs,
          workerExecutionMs: response.timings?.workerExecutionMs,
          roundTripMs
        }
      });
    }

    const primary = meshResults[0];
    if (!primary) {
      throw new Error("Geometry worker smoke produced no mesh results.");
    }
    const probeResponse = await worker.execute(
      createNamedStepProbeWorkerRequest({
        id: "browser_occt_named_step_probe"
      })
    );
    if (!probeResponse.response.ok || !("probe" in probeResponse.response)) {
      throw createDerivedGeometryErrorFromWorkerResponse(probeResponse);
    }
    const namedStepProbe = probeResponse.response.probe;
    const smokeParams = new URLSearchParams(location.search);
    const requireV21_1 = smokeParams.has("v21_1");
    const v21ExactInterchange =
      smokeParams.has("v21") || requireV21_1
        ? await runV21ExactReleaseBrowserWorkflow(worker, {
            nearLimitBodyCount: requireV21_1 ? 256 : 16,
            requireCancelRetry: requireV21_1
          })
        : undefined;
    const result = {
      ok: true,
      vertexCount: primary.vertexCount,
      triangleCount: primary.triangleCount,
      bounds: primary.bounds,
      diagnostics: primary.diagnostics,
      timings: primary.timings,
      meshes: meshResults,
      namedStepProbe,
      ...(v21ExactInterchange ? { v21ExactInterchange } : {})
    };

    document.body.dataset.geometryWorkerSmoke = "ok";
    writeOutput(JSON.stringify(result, null, 2));
  } catch (error) {
    const details = createDerivedGeometryErrorDetails(error);

    document.body.dataset.geometryWorkerSmoke = "error";
    writeOutput(
      JSON.stringify(
        {
          ok: false,
          error: details
        },
        null,
        2
      )
    );
  } finally {
    worker.dispose();
  }
}

function writeOutput(message: string): void {
  if (output) {
    output.textContent = message;
  }
}

import {
  createBoxTessellationWorkerRequest,
  createConeTessellationWorkerRequest,
  createCylinderTessellationWorkerRequest,
  createSphereTessellationWorkerRequest,
  createTorusTessellationWorkerRequest
} from "@web-cad/geometry-worker/browser";
import { createRenderMeshFromGeometryWorkerResponse } from "@web-cad/renderer-mesh-bridge";
import { BrowserGeometryWorker } from "./browserGeometryWorker";
import {
  createDerivedGeometryErrorDetails,
  createDerivedGeometryErrorFromWorkerResponse
} from "./derivedGeometryRuntime";

const output = document.getElementById("geometry-worker-smoke");

void runGeometryWorkerSmoke();

async function runGeometryWorkerSmoke(): Promise<void> {
  const worker = new BrowserGeometryWorker();

  try {
    const meshResults = [];
    const requests = [
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
      }
    ];

    for (const item of requests) {
      const roundTripStart = performance.now();
      const response = await worker.execute(item.request);
      const roundTripMs = performance.now() - roundTripStart;

      if (!response.response.ok) {
        throw createDerivedGeometryErrorFromWorkerResponse(response);
      }

      const renderMesh = createRenderMeshFromGeometryWorkerResponse(response, {
        id: `${item.request.id}_mesh`,
        alignment: "boundsCenter"
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
    const result = {
      ok: true,
      vertexCount: primary.vertexCount,
      triangleCount: primary.triangleCount,
      bounds: primary.bounds,
      diagnostics: primary.diagnostics,
      timings: primary.timings,
      meshes: meshResults
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

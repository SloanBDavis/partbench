import { createBoxTessellationWorkerRequest } from "@web-cad/geometry-worker-spike/browser";
import { createRenderMeshFromGeometryWorkerResponse } from "@web-cad/renderer-mesh-bridge";
import { BrowserGeometryWorker } from "./browserGeometryWorker";
import {
  createOcctMeshDevErrorDetails,
  createOcctMeshDevErrorFromWorkerResponse
} from "./occtMeshDev";

const output = document.getElementById("geometry-worker-smoke");

void runGeometryWorkerSmoke();

async function runGeometryWorkerSmoke(): Promise<void> {
  const worker = new BrowserGeometryWorker();

  try {
    const roundTripStart = performance.now();
    const response = await worker.execute(
      createBoxTessellationWorkerRequest({
        id: "browser_occt_smoke",
        payloadId: "browser_occt_smoke_payload",
        width: 2,
        height: 3,
        depth: 4
      })
    );
    const roundTripMs = performance.now() - roundTripStart;

    if (!response.response.ok) {
      throw createOcctMeshDevErrorFromWorkerResponse(response);
    }

    const renderMesh = createRenderMeshFromGeometryWorkerResponse(response, {
      id: "browser_occt_smoke_mesh",
      alignment: "boundsCenter"
    });
    const result = {
      ok: response.response.ok,
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
    };

    document.body.dataset.geometryWorkerSmoke = "ok";
    writeOutput(JSON.stringify(result, null, 2));
  } catch (error) {
    const details = createOcctMeshDevErrorDetails(error);

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

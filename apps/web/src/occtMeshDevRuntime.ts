import type {
  GeometryWorkerSpike,
  GeometryWorkerSpikeRequest
} from "@web-cad/geometry-worker-spike";
import {
  createOcctMeshDevErrorFromWorkerResponse,
  createOcctMeshDevMetrics,
  type OcctMeshDevBoxInput,
  type OcctMeshDevCylinderInput,
  type OcctMeshDevResult,
  type OcctMeshDevRuntime
} from "./occtMeshDev";

type DisposableGeometryWorker = GeometryWorkerSpike & {
  dispose(): void;
};

export function createOcctMeshDevRuntime(): OcctMeshDevRuntime {
  let geometryWorker: DisposableGeometryWorker | undefined;

  async function getGeometryWorker(): Promise<DisposableGeometryWorker> {
    if (!geometryWorker) {
      const { BrowserGeometryWorker } = await import("./browserGeometryWorker");
      geometryWorker = new BrowserGeometryWorker();
    }

    return geometryWorker;
  }

  async function executeTessellationRequest(
    input: OcctMeshDevBoxInput | OcctMeshDevCylinderInput,
    request: GeometryWorkerSpikeRequest
  ): Promise<OcctMeshDevResult> {
    const { createRenderMeshFromGeometryWorkerResponse } =
      await import("@web-cad/renderer-mesh-bridge");
    const worker = await getGeometryWorker();
    const roundTripStart = performance.now();
    const response = await worker.execute(request);
    const roundTripMs = performance.now() - roundTripStart;

    if (!response.response.ok) {
      throw createOcctMeshDevErrorFromWorkerResponse(response);
    }

    const bridgeResult = createRenderMeshFromGeometryWorkerResponse(response, {
      id: input.id,
      alignment: "boundsCenter",
      transform: input.transform,
      label: `${input.id} OCCT mesh`
    });

    return {
      mesh: bridgeResult.mesh,
      metrics: createOcctMeshDevMetrics({
        objectId: input.id,
        response,
        bridgeResult,
        roundTripMs
      }),
      message: `Displayed derived OCCT mesh for ${input.id}.`
    };
  }

  return {
    async tessellateBox(input: OcctMeshDevBoxInput) {
      const { createBoxTessellationWorkerRequest } =
        await import("@web-cad/geometry-worker-spike/browser");
      const requestId = `occt_mesh_${input.id}_${Date.now()}`;

      return executeTessellationRequest(
        input,
        createBoxTessellationWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          width: input.dimensions.width,
          height: input.dimensions.height,
          depth: input.dimensions.depth,
          linearDeflection: 0.25,
          angularDeflection: 0.5
        })
      );
    },
    async tessellateCylinder(input: OcctMeshDevCylinderInput) {
      const { createCylinderTessellationWorkerRequest } =
        await import("@web-cad/geometry-worker-spike/browser");
      const requestId = `occt_mesh_${input.id}_${Date.now()}`;

      return executeTessellationRequest(
        input,
        createCylinderTessellationWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          radius: input.dimensions.radius,
          height: input.dimensions.height,
          linearDeflection: 0.25,
          angularDeflection: 0.5
        })
      );
    },
    dispose() {
      geometryWorker?.dispose();
      geometryWorker = undefined;
    }
  };
}

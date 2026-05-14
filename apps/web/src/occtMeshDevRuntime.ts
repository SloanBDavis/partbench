import type { GeometryWorkerSpike } from "@web-cad/geometry-worker-spike";
import {
  createOcctMeshDevErrorFromWorkerResponse,
  createOcctMeshDevMetrics,
  type OcctMeshDevBoxInput,
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

  return {
    async tessellateBox(input: OcctMeshDevBoxInput) {
      const [
        { createBoxTessellationWorkerRequest },
        { createRenderMeshFromGeometryWorkerResponse }
      ] = await Promise.all([
        import("@web-cad/geometry-worker-spike/browser"),
        import("@web-cad/renderer-mesh-bridge")
      ]);
      const worker = await getGeometryWorker();
      const requestId = `occt_mesh_${input.id}_${Date.now()}`;
      const roundTripStart = performance.now();
      const response = await worker.execute(
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
      const roundTripMs = performance.now() - roundTripStart;

      if (!response.response.ok) {
        throw createOcctMeshDevErrorFromWorkerResponse(response);
      }

      const bridgeResult = createRenderMeshFromGeometryWorkerResponse(
        response,
        {
          id: input.id,
          alignment: "boundsCenter",
          transform: input.transform,
          label: `${input.id} OCCT mesh`
        }
      );

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
    },
    dispose() {
      geometryWorker?.dispose();
      geometryWorker = undefined;
    }
  };
}

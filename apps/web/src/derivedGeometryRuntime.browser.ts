import type {
  GeometryWorker,
  GeometryWorkerRequest
} from "@web-cad/geometry-worker";
import {
  createDerivedGeometryErrorFromWorkerResponse,
  createDerivedGeometryMetrics,
  type DerivedGeometryBoxInput,
  type DerivedGeometryCylinderInput,
  type DerivedGeometrySphereInput,
  type DerivedGeometryResult,
  type DerivedGeometryRuntime
} from "./derivedGeometryRuntime";

type DisposableGeometryWorker = GeometryWorker & {
  dispose(): void;
};

export function createDerivedGeometryRuntime(): DerivedGeometryRuntime {
  let geometryWorker: DisposableGeometryWorker | undefined;

  async function getGeometryWorker(): Promise<DisposableGeometryWorker> {
    if (!geometryWorker) {
      const { BrowserGeometryWorker } = await import("./browserGeometryWorker");
      geometryWorker = new BrowserGeometryWorker();
    }

    return geometryWorker;
  }

  async function executeTessellationRequest(
    input:
      | DerivedGeometryBoxInput
      | DerivedGeometryCylinderInput
      | DerivedGeometrySphereInput,
    request: GeometryWorkerRequest
  ): Promise<DerivedGeometryResult> {
    const { createRenderMeshFromGeometryWorkerResponse } =
      await import("@web-cad/renderer-mesh-bridge");
    const worker = await getGeometryWorker();
    const roundTripStart = performance.now();
    const response = await worker.execute(request);
    const roundTripMs = performance.now() - roundTripStart;

    if (!response.response.ok) {
      throw createDerivedGeometryErrorFromWorkerResponse(response);
    }

    const bridgeResult = createRenderMeshFromGeometryWorkerResponse(response, {
      id: input.id,
      alignment: "boundsCenter",
      transform: input.transform,
      label: `${input.id} OCCT mesh`
    });

    return {
      mesh: bridgeResult.mesh,
      metrics: createDerivedGeometryMetrics({
        objectId: input.id,
        response,
        bridgeResult,
        roundTripMs
      }),
      message: `Displayed derived OCCT mesh for ${input.id}.`
    };
  }

  return {
    async tessellateBox(input: DerivedGeometryBoxInput) {
      const { createBoxTessellationWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
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
    async tessellateCylinder(input: DerivedGeometryCylinderInput) {
      const { createCylinderTessellationWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
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
    async tessellateSphere(input: DerivedGeometrySphereInput) {
      const { createSphereTessellationWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = `occt_mesh_${input.id}_${Date.now()}`;

      return executeTessellationRequest(
        input,
        createSphereTessellationWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          radius: input.dimensions.radius,
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

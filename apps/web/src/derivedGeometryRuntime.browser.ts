import type {
  GeometryWorker,
  GeometryWorkerRequest
} from "@web-cad/geometry-worker";
import {
  createDerivedGeometryErrorFromWorkerResponse,
  createDerivedGeometryMetrics,
  type DerivedGeometryBoxInput,
  type DerivedGeometryConeInput,
  type DerivedGeometryCylinderInput,
  type DerivedGeometryExtrudeInput,
  type DerivedGeometrySphereInput,
  type DerivedGeometryTorusInput,
  type DerivedGeometryResult,
  type DerivedGeometryRuntime
} from "./derivedGeometryRuntime";

type DisposableGeometryWorker = GeometryWorker & {
  dispose(): void;
};

export function createDerivedGeometryRuntime(): DerivedGeometryRuntime {
  let geometryWorker: DisposableGeometryWorker | undefined;
  let nextRequestNumber = 1;

  function createRequestId(inputId: string): string {
    const requestId = `occt_mesh_${inputId}_${nextRequestNumber}`;
    nextRequestNumber += 1;
    return requestId;
  }

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
      | DerivedGeometrySphereInput
      | DerivedGeometryConeInput
      | DerivedGeometryTorusInput
      | DerivedGeometryExtrudeInput,
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
      alignment:
        request.payload.op === "geometry.tessellateExtrude"
          ? "source"
          : "boundsCenter",
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
      const requestId = createRequestId(input.id);

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
      const requestId = createRequestId(input.id);

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
      const requestId = createRequestId(input.id);

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
    async tessellateCone(input: DerivedGeometryConeInput) {
      const { createConeTessellationWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = createRequestId(input.id);

      return executeTessellationRequest(
        input,
        createConeTessellationWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          radius: input.dimensions.radius,
          height: input.dimensions.height,
          linearDeflection: 0.25,
          angularDeflection: 0.5
        })
      );
    },
    async tessellateTorus(input: DerivedGeometryTorusInput) {
      const { createTorusTessellationWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = createRequestId(input.id);

      return executeTessellationRequest(
        input,
        createTorusTessellationWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          majorRadius: input.dimensions.majorRadius,
          minorRadius: input.dimensions.minorRadius,
          linearDeflection: 0.25,
          angularDeflection: 0.5
        })
      );
    },
    async tessellateExtrude(input: DerivedGeometryExtrudeInput) {
      const { createExtrudeTessellationWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = createRequestId(input.id);

      return executeTessellationRequest(
        input,
        createExtrudeTessellationWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          sketchPlane: input.sketchPlane,
          profile: input.profile,
          depth: input.depth,
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

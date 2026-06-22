import type {
  GeometryWorker,
  GeometryWorkerRequest
} from "@web-cad/geometry-worker";
import {
  createDerivedGeometryErrorFromWorkerResponse,
  createDerivedExactMetadataMetrics,
  createDerivedGeometryMetrics,
  type DerivedGeometryBoxInput,
  type DerivedGeometryBooleanExtrudeInput,
  type DerivedGeometryConeInput,
  type DerivedGeometryCylinderInput,
  type DerivedGeometryEdgeFinishInput,
  type DerivedGeometryExtrudeInput,
  type DerivedGeometryHoleInput,
  type DerivedGeometryRevolveInput,
  type DerivedGeometrySphereInput,
  type DerivedGeometryTorusInput,
  type DerivedGeometryResult,
  type DerivedGeometryRuntime,
  type DerivedExactMetadataInput,
  type DerivedExactMetadataResult,
  type DerivedExactTopologyCheckpointPayloadInput,
  type DerivedExactTopologyCheckpointPayloadResult
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
      | DerivedGeometryExtrudeInput
      | DerivedGeometryRevolveInput
      | DerivedGeometryHoleInput
      | DerivedGeometryEdgeFinishInput
      | DerivedGeometryBooleanExtrudeInput,
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
        request.payload.op === "geometry.tessellateExtrude" ||
        request.payload.op === "geometry.revolveProfile" ||
        request.payload.op === "geometry.booleanExtrudes" ||
        request.payload.op === "geometry.hole" ||
        request.payload.op === "geometry.edgeFinish"
          ? "source"
          : "boundsCenter",
      transform:
        "transform" in input
          ? input.transform
          : {
              translation: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1]
            },
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

  async function executeExactMetadataRequest(
    input: DerivedExactMetadataInput,
    request: GeometryWorkerRequest
  ): Promise<DerivedExactMetadataResult> {
    const worker = await getGeometryWorker();
    const roundTripStart = performance.now();
    const response = await worker.execute(request);
    const roundTripMs = performance.now() - roundTripStart;

    if (!response.response.ok) {
      throw createDerivedGeometryErrorFromWorkerResponse(response);
    }

    if (!("metadata" in response.response)) {
      throw new Error(
        "Geometry worker response does not contain exact metadata."
      );
    }

    return {
      metadata: response.response.metadata,
      metrics: createDerivedExactMetadataMetrics({
        objectId: input.id,
        response,
        roundTripMs
      }),
      message: `Derived exact metadata for ${input.id}.`
    };
  }

  async function executeExactTopologyCheckpointPayloadRequest(
    input: DerivedExactTopologyCheckpointPayloadInput,
    request: GeometryWorkerRequest
  ): Promise<DerivedExactTopologyCheckpointPayloadResult> {
    const worker = await getGeometryWorker();
    const roundTripStart = performance.now();
    const response = await worker.execute(request);
    const roundTripMs = performance.now() - roundTripStart;

    if (!response.response.ok) {
      throw createDerivedGeometryErrorFromWorkerResponse(response);
    }

    if (!("checkpointPayload" in response.response)) {
      throw new Error(
        "Geometry worker response does not contain an exact topology checkpoint payload."
      );
    }

    return {
      checkpointPayload: response.response.checkpointPayload,
      metrics: createDerivedExactMetadataMetrics({
        objectId: input.id,
        response,
        roundTripMs
      }),
      message: `Derived exact topology checkpoint payload for ${input.bodyId}.`
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
          side: input.side,
          linearDeflection: 0.25,
          angularDeflection: 0.5
        })
      );
    },
    async revolveProfile(input: DerivedGeometryRevolveInput) {
      const { createRevolveProfileWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = createRequestId(input.id);

      return executeTessellationRequest(
        input,
        createRevolveProfileWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          sketchPlane: input.sketchPlane,
          profile: input.profile,
          axis: input.axis,
          angleDegrees: input.angleDegrees,
          linearDeflection: 0.25,
          angularDeflection: 0.5
        })
      );
    },
    async booleanExtrudes(input: DerivedGeometryBooleanExtrudeInput) {
      const { createExtrudeBooleanWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = createRequestId(input.id);

      return executeTessellationRequest(
        input,
        createExtrudeBooleanWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          operation: input.operation,
          target: input.target,
          tool: input.tool,
          linearDeflection: 0.25,
          angularDeflection: 0.5
        })
      );
    },
    async hole(input: DerivedGeometryHoleInput) {
      const { createHoleWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = createRequestId(input.id);

      return executeTessellationRequest(
        input,
        createHoleWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          target: input.target,
          tool: input.tool,
          linearDeflection: 0.25,
          angularDeflection: 0.5
        })
      );
    },
    async edgeFinish(input: DerivedGeometryEdgeFinishInput) {
      const { createEdgeFinishWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = createRequestId(input.id);

      return executeTessellationRequest(
        input,
        createEdgeFinishWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          target: input.target,
          edgeStableId: input.edgeStableId,
          operation: input.operation,
          ...(input.operation === "chamfer"
            ? { distance: input.distance }
            : { radius: input.radius }),
          linearDeflection: 0.25,
          angularDeflection: 0.5
        })
      );
    },
    async exactBodyMetadata(input: DerivedExactMetadataInput) {
      const { createExactBodyMetadataWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = createRequestId(input.id);

      return executeExactMetadataRequest(
        input,
        createExactBodyMetadataWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          source: input.source
        })
      );
    },
    async exactTopologyCheckpointPayload(
      input: DerivedExactTopologyCheckpointPayloadInput
    ) {
      const { createExactTopologyCheckpointPayloadWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = createRequestId(input.id);

      return executeExactTopologyCheckpointPayloadRequest(
        input,
        createExactTopologyCheckpointPayloadWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          checkpointId: input.checkpointId,
          bodyId: input.bodyId,
          source: input.source
        })
      );
    },
    dispose() {
      geometryWorker?.dispose();
      geometryWorker = undefined;
    }
  };
}

import type { GeometryWorkerRequest } from "@web-cad/geometry-worker";
import { GeometryJobScheduler } from "./geometryJobScheduler";
import { emitGeometryDiagnosticEvent } from "./geometryDiagnosticEvents";
import {
  createDerivedGeometryErrorFromWorkerResponse,
  createDerivedExactMetadataMetrics,
  createDerivedGeometryMetrics,
  type DerivedGeometryBoxInput,
  type DerivedGeometryBooleanExtrudeInput,
  type DerivedGeometryConeInput,
  type DerivedGeometryCylinderInput,
  type DerivedGeometryEdgeFinishInput,
  type DerivedGeometryLinearPatternInput,
  type DerivedGeometryCircularPatternInput,
  type DerivedGeometryMirrorInput,
  type DerivedGeometryShellInput,
  type DerivedGeometrySweepInput,
  type DerivedGeometryLoftInput,
  type DerivedGeometryExtrudeInput,
  type DerivedGeometryHoleInput,
  type DerivedGeometryRevolveInput,
  type DerivedGeometrySphereInput,
  type DerivedGeometryTorusInput,
  type DerivedGeometryResult,
  type DerivedGeometryExecutionContext,
  type DerivedGeometryRequestContext,
  type DerivedGeometryRuntime,
  type DerivedExactMetadataInput,
  type DerivedExactMetadataResult,
  type DerivedExactTopologyCheckpointPayloadInput,
  type DerivedExactTopologyCheckpointPayloadResult,
  type DerivedStepImportInput,
  type DerivedStepImportResult
} from "./derivedGeometryRuntime";

export function createDerivedGeometryRuntime(): DerivedGeometryRuntime {
  let nextRequestNumber = 1;
  const scheduler = new GeometryJobScheduler({
    onEvent: (job) =>
      emitGeometryDiagnosticEvent({
        phase: "worker-job",
        timestamp: performance.now(),
        job
      })
  });

  function createRequestId(inputId: string): string {
    const requestId = `occt_mesh_${inputId}_${nextRequestNumber}`;
    nextRequestNumber += 1;
    return requestId;
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
      | DerivedGeometryBooleanExtrudeInput
      | DerivedGeometryLinearPatternInput
      | DerivedGeometryCircularPatternInput
      | DerivedGeometryMirrorInput
      | DerivedGeometryShellInput
      | DerivedGeometrySweepInput
      | DerivedGeometryLoftInput,
    request: GeometryWorkerRequest,
    context?: DerivedGeometryExecutionContext
  ): Promise<DerivedGeometryResult> {
    const { createRenderMeshFromGeometryWorkerResponse } =
      await import("@web-cad/renderer-mesh-bridge");
    const roundTripStart = performance.now();
    const response = await scheduler.execute(
      context && "intent" in context
        ? { intent: "user", userKind: "preflight" }
        : {
            intent: "display",
            sourceId: context?.sourceId ?? input.id,
            documentRevision: context?.documentRevision ?? 0,
            cacheKey: context?.cacheKey ?? request.payload.id
          },
      request
    );
    const roundTripMs = performance.now() - roundTripStart;

    if (!response.response.ok) {
      throw createDerivedGeometryErrorFromWorkerResponse(response);
    }

    const bridgeResult = createRenderMeshFromGeometryWorkerResponse(response, {
      id: input.id,
      alignment:
        request.payload.op === "geometry.tessellateExtrude" ||
        request.payload.op === "geometry.revolveProfile" ||
        request.payload.op === "geometry.sweep" ||
        request.payload.op === "geometry.loft" ||
        request.payload.op === "geometry.booleanExtrudes" ||
        request.payload.op === "geometry.hole" ||
        request.payload.op === "geometry.edgeFinish" ||
        request.payload.op === "geometry.linearPattern" ||
        request.payload.op === "geometry.circularPattern" ||
        request.payload.op === "geometry.mirror" ||
        request.payload.op === "geometry.shell"
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
      message: `Displayed derived OCCT mesh for ${input.id}.`,
      ...(response.response.warnings.length
        ? { warnings: [...response.response.warnings] }
        : {}),
      ...(bridgeResult.generatedReferences
        ? { generatedReferences: bridgeResult.generatedReferences }
        : {})
    };
  }

  async function executeExactMetadataRequest(
    input: DerivedExactMetadataInput,
    request: GeometryWorkerRequest,
    context?: DerivedGeometryRequestContext
  ): Promise<DerivedExactMetadataResult> {
    const roundTripStart = performance.now();
    const response = await scheduler.execute(
      {
        intent: "exact",
        sourceId: context?.sourceId ?? input.id,
        documentRevision: context?.documentRevision ?? 0,
        cacheKey: context?.cacheKey ?? request.payload.id
      },
      request
    );
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
    const roundTripStart = performance.now();
    const response = await scheduler.execute(
      { intent: "user", userKind: "checkpoint" },
      request
    );
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

  async function executeStepImportRequest(
    input: DerivedStepImportInput,
    request: GeometryWorkerRequest
  ): Promise<DerivedStepImportResult> {
    const roundTripStart = performance.now();
    const response = await scheduler.execute(
      { intent: "user", userKind: "import" },
      request
    );
    const roundTripMs = performance.now() - roundTripStart;

    if (!response.response.ok) {
      throw createDerivedGeometryErrorFromWorkerResponse(response);
    }

    if (!("bodies" in response.response)) {
      throw new Error("Geometry worker response does not contain STEP bodies.");
    }

    return {
      sourceFormat: response.response.sourceFormat,
      sourceFileName: response.response.sourceFileName,
      bodyCount: response.response.bodyCount,
      bodies: response.response.bodies,
      diagnostics: response.response.diagnostics,
      metrics: createDerivedExactMetadataMetrics({
        objectId: input.id,
        response,
        roundTripMs
      }),
      message: `Imported STEP geometry for ${input.sourceFileName}.`
    };
  }

  return {
    async executeExactStepExport(request) {
      return scheduler.execute({ intent: "user", userKind: "export" }, request);
    },
    async tessellateBox(input: DerivedGeometryBoxInput, context) {
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
        }),
        context
      );
    },
    async tessellateCylinder(input: DerivedGeometryCylinderInput, context) {
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
        }),
        context
      );
    },
    async tessellateSphere(input: DerivedGeometrySphereInput, context) {
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
        }),
        context
      );
    },
    async tessellateCone(input: DerivedGeometryConeInput, context) {
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
        }),
        context
      );
    },
    async tessellateTorus(input: DerivedGeometryTorusInput, context) {
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
        }),
        context
      );
    },
    async tessellateExtrude(input: DerivedGeometryExtrudeInput, context) {
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
        }),
        context
      );
    },
    async revolveProfile(input: DerivedGeometryRevolveInput, context) {
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
        }),
        context
      );
    },
    async booleanExtrudes(input: DerivedGeometryBooleanExtrudeInput, context) {
      const { createExtrudeBooleanWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = createRequestId(input.id);

      const request =
        input.operation === "cut"
          ? createExtrudeBooleanWorkerRequest({
              id: requestId,
              payloadId: `${requestId}:kernel`,
              operation: "cut",
              target: input.target,
              tool: input.tool,
              linearDeflection: 0.25,
              angularDeflection: 0.5
            })
          : createExtrudeBooleanWorkerRequest({
              id: requestId,
              payloadId: `${requestId}:kernel`,
              operation: "add",
              target: input.target,
              tool: input.tool,
              linearDeflection: 0.25,
              angularDeflection: 0.5
            });

      return executeTessellationRequest(input, request, context);
    },
    async hole(
      input: DerivedGeometryHoleInput,
      context?: DerivedGeometryExecutionContext
    ) {
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
        }),
        context
      );
    },
    async edgeFinish(input: DerivedGeometryEdgeFinishInput, context) {
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
        }),
        context
      );
    },
    async linearPattern(input: DerivedGeometryLinearPatternInput, context) {
      const { createLinearPatternWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = createRequestId(input.id);

      return executeTessellationRequest(
        input,
        createLinearPatternWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          seed: input.seed,
          direction: input.direction,
          spacing: input.spacing,
          instanceCount: input.instanceCount,
          linearDeflection: 0.25,
          angularDeflection: 0.5
        }),
        context
      );
    },
    async circularPattern(input: DerivedGeometryCircularPatternInput, context) {
      const { createCircularPatternWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = createRequestId(input.id);

      return executeTessellationRequest(
        input,
        createCircularPatternWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          seed: input.seed,
          axis: input.axis,
          totalAngleDegrees: input.totalAngleDegrees,
          instanceCount: input.instanceCount,
          linearDeflection: 0.25,
          angularDeflection: 0.5
        }),
        context
      );
    },
    async mirror(input: DerivedGeometryMirrorInput, context) {
      const { createMirrorWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = createRequestId(input.id);

      return executeTessellationRequest(
        input,
        createMirrorWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          seed: input.seed,
          plane: input.plane,
          includeOriginal: input.includeOriginal,
          linearDeflection: 0.25,
          angularDeflection: 0.5
        }),
        context
      );
    },
    async shell(input: DerivedGeometryShellInput, context) {
      const { createShellWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = createRequestId(input.id);

      return executeTessellationRequest(
        input,
        createShellWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          target: input.target,
          wallThickness: input.wallThickness,
          openFaceStableIds: input.openFaceStableIds,
          linearDeflection: 0.25,
          angularDeflection: 0.5
        }),
        context
      );
    },
    async sweep(input: DerivedGeometrySweepInput, context) {
      const { createSweepWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = createRequestId(input.id);

      return executeTessellationRequest(
        input,
        createSweepWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          profile: input.profile,
          pathSegments: input.pathSegments,
          linearDeflection: 0.25,
          angularDeflection: 0.5
        }),
        context
      );
    },
    async loft(input: DerivedGeometryLoftInput, context) {
      const { createLoftWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = createRequestId(input.id);

      return executeTessellationRequest(
        input,
        createLoftWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          sections: input.sections,
          linearDeflection: 0.25,
          angularDeflection: 0.5
        }),
        context
      );
    },
    async exactBodyMetadata(input: DerivedExactMetadataInput, context) {
      const { createExactBodyMetadataWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = createRequestId(input.id);

      return executeExactMetadataRequest(
        input,
        createExactBodyMetadataWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          source: input.source
        }),
        context
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
    async importStep(input: DerivedStepImportInput) {
      const { createStepImportWorkerRequest } =
        await import("@web-cad/geometry-worker/browser");
      const requestId = createRequestId(input.id);

      return executeStepImportRequest(
        input,
        createStepImportWorkerRequest({
          id: requestId,
          payloadId: `${requestId}:kernel`,
          sourceFileName: input.sourceFileName,
          bytes: input.bytes,
          maxBodyCount: input.maxBodyCount,
          bodyId: input.bodyId,
          checkpointId: input.checkpointId
        })
      );
    },
    dispose() {
      scheduler.dispose();
    },
    cancelModelWork(message) {
      return scheduler.cancelGeneration(message);
    },
    resumeModelWork() {
      return scheduler.resumeGeneration();
    },
    getModelWorkSnapshot() {
      const snapshot = scheduler.getSnapshot();
      const queuedCount =
        snapshot.queuedUserCount +
        snapshot.queuedDisplayCount +
        snapshot.queuedExactCount;
      return {
        generation: snapshot.generation,
        stopped: snapshot.stopped,
        active: snapshot.inFlightRunId !== undefined || queuedCount > 0,
        queuedCount,
        cancelledUserKinds: snapshot.cancelledUserKinds
      };
    },
    subscribeModelWork(listener) {
      return scheduler.subscribe(listener);
    },
    invalidateDerivedWork(intent, sourceId, documentRevision) {
      scheduler.invalidateDerived(intent, sourceId, documentRevision);
    }
  };
}

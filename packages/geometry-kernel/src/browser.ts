import {
  createOcctBoxMeshWithInstance,
  createOcctConeMeshWithInstance,
  createOcctCylinderMeshWithInstance,
  createOcctSphereMeshWithInstance,
  createOcctTorusMeshWithInstance,
  loadBrowserOcct,
  createOcctBooleanExtrudeMeshWithInstance,
  createOcctEdgeFinishMeshWithInstance,
  createOcctHoleMeshWithInstance,
  createOcctRevolveProfileMeshWithInstance,
  createOcctExactBodyMetadataWithInstance,
  createOcctExactTopologySnapshotWithInstance,
  createOcctExactTopologyCheckpointPayloadWithInstance,
  createOcctStepExportWithInstance
} from "@web-cad/occt-wasm/browser";
import {
  executeGeometryKernelRequestWithMeshFactory,
  getGeometryResponseTransferables,
  type BooleanExtrudePrimitiveSource,
  type BooleanExtrudeResultSource,
  type BooleanExtrudesRequest,
  type BooleanExtrudeSource,
  type BoxGeometryDimensions,
  type ChamferEdgeFinishRequest,
  type ConeGeometryDimensions,
  type CylinderGeometryDimensions,
  type ExactBodyMetadataRequest,
  type ExactBodyMetadataSource,
  type ExactBooleanExtrudesMetadataSource,
  type ExactEdgeFinishMetadataSource,
  type ExactExtrudeMetadataSource,
  type ExactHoleMetadataSource,
  type ExactTopologyCheckpointPayloadRequest,
  type ExactTopologySnapshotRequest,
  type ExactStepExportBodySource,
  type ExactStepExportRequest,
  type GeometryKernelBounds,
  type GeometryKernelBooleanOperation,
  type GeometryKernelDocumentUnit,
  type GeometryKernelError,
  type GeometryKernelErrorCode,
  type GeometryKernelEdgeFinishEdgeRole,
  type GeometryKernelEdgeFinishMeshFactory,
  type GeometryKernelEdgeFinishMeshFactoryInput,
  type GeometryKernelEdgeFinishOperation,
  type GeometryKernelExactBodyMetadata,
  type GeometryKernelExactBodyMetadataSuccessResponse,
  type GeometryKernelExactTopologySnapshot,
  type GeometryKernelExactTopologySnapshotFactory,
  type GeometryKernelExactTopologySnapshotSuccessResponse,
  type GeometryKernelExactStepExportArtifact,
  type GeometryKernelExactStepExportFactory,
  type GeometryKernelExactStepExportSuccessResponse,
  type GeometryKernelExactMetadataDiagnostic,
  type GeometryKernelHoleDepthMode,
  type GeometryKernelHoleDirection,
  type GeometryKernelHoleMeshFactory,
  type GeometryKernelOp,
  type GeometryKernelPrimitive,
  type GeometryKernelResponseForRequest,
  type GeometryKernelRequest,
  type GeometryKernelResponse,
  type GeometryKernelSuccessResponse,
  type GeometryKernelVersion,
  type GeometryKernelErrorResponse,
  type GeometryKernelExtrudeProfileKind,
  type GeometryKernelMeasurementConfidence,
  type GeometryKernelMeasurementSource,
  type GeometryKernelMeshRequest,
  type GeometryKernelMeshSuccessResponse,
  type GeometryKernelRevolveProfileMeshFactory,
  type GeometryKernelTopologyCounts,
  type GeometryKernelTopologyDiagnostic,
  type GeometryKernelTopologyEntityCounts,
  type GeometryKernelTopologyEntityDescriptor,
  type GeometryKernelTopologyEntityKind,
  type EdgeFinishRequest,
  type HoleRequest,
  type HoleToolSource,
  type RevolveGeometryAxis,
  type RevolveGeometryProfile,
  type RevolveProfileRequest,
  type FilletEdgeFinishRequest,
  type SerializableMeshData,
  type SphereGeometryDimensions,
  type TessellateExtrudeRequest,
  type TessellateBoxRequest,
  type TessellateConeRequest,
  type TessellateCylinderRequest,
  type TessellateSphereRequest,
  type TessellateTorusRequest,
  type TorusGeometryDimensions,
  type TessellationOptions
} from "./kernel";

type BrowserOcctPrimitive = Exclude<
  GeometryKernelPrimitive,
  "extrude" | "revolve" | "boolean" | "hole" | "edgeFinish"
>;

export type {
  BooleanExtrudePrimitiveSource,
  BooleanExtrudeResultSource,
  BooleanExtrudesRequest,
  BooleanExtrudeSource,
  BoxGeometryDimensions,
  ChamferEdgeFinishRequest,
  ConeGeometryDimensions,
  CylinderGeometryDimensions,
  ExactBodyMetadataRequest,
  ExactBodyMetadataSource,
  ExactBooleanExtrudesMetadataSource,
  ExactEdgeFinishMetadataSource,
  ExactExtrudeMetadataSource,
  ExactHoleMetadataSource,
  ExactTopologySnapshotRequest,
  ExactStepExportBodySource,
  ExactStepExportRequest,
  GeometryKernelBounds,
  GeometryKernelBooleanOperation,
  GeometryKernelDocumentUnit,
  GeometryKernelError,
  GeometryKernelErrorCode,
  GeometryKernelEdgeFinishEdgeRole,
  GeometryKernelEdgeFinishMeshFactory,
  GeometryKernelEdgeFinishMeshFactoryInput,
  GeometryKernelEdgeFinishOperation,
  GeometryKernelExactBodyMetadata,
  GeometryKernelExactBodyMetadataSuccessResponse,
  GeometryKernelExactTopologySnapshot,
  GeometryKernelExactTopologySnapshotFactory,
  GeometryKernelExactTopologySnapshotSuccessResponse,
  GeometryKernelExactStepExportArtifact,
  GeometryKernelExactStepExportFactory,
  GeometryKernelExactStepExportSuccessResponse,
  GeometryKernelExactMetadataDiagnostic,
  GeometryKernelExtrudeProfileKind,
  GeometryKernelHoleDepthMode,
  GeometryKernelHoleDirection,
  GeometryKernelHoleMeshFactory,
  GeometryKernelMeasurementConfidence,
  GeometryKernelMeasurementSource,
  GeometryKernelMeshRequest,
  GeometryKernelMeshSuccessResponse,
  GeometryKernelRevolveProfileMeshFactory,
  GeometryKernelOp,
  GeometryKernelPrimitive,
  GeometryKernelResponseForRequest,
  GeometryKernelRequest,
  GeometryKernelResponse,
  GeometryKernelSuccessResponse,
  GeometryKernelTopologyCounts,
  GeometryKernelTopologyDiagnostic,
  GeometryKernelTopologyEntityCounts,
  GeometryKernelTopologyEntityDescriptor,
  GeometryKernelTopologyEntityKind,
  EdgeFinishRequest,
  HoleRequest,
  HoleToolSource,
  RevolveGeometryAxis,
  RevolveGeometryProfile,
  RevolveProfileRequest,
  FilletEdgeFinishRequest,
  GeometryKernelVersion,
  GeometryKernelErrorResponse,
  SerializableMeshData,
  SphereGeometryDimensions,
  TessellateBoxRequest,
  TessellateConeRequest,
  TessellateCylinderRequest,
  TessellateExtrudeRequest,
  TessellateSphereRequest,
  TessellateTorusRequest,
  TorusGeometryDimensions,
  TessellationOptions
};
export { getGeometryResponseTransferables };

export interface BrowserGeometryKernelTimings {
  readonly occtLoadMs: number;
  readonly tessellationMs: number;
  readonly geometryKernelMs: number;
  readonly failureStage?: BrowserGeometryKernelFailureStage;
}

export type BrowserGeometryKernelFailureStage = "wasmLoad" | "tessellation";

export interface TimedBrowserGeometryKernelResponse {
  readonly response: GeometryKernelResponse;
  readonly timings: BrowserGeometryKernelTimings;
}

export async function executeGeometryKernelRequest<
  T extends GeometryKernelRequest
>(request: T): Promise<GeometryKernelResponseForRequest<T>> {
  return (await executeTimedBrowserGeometryKernelRequest(request)).response;
}

export async function executeTimedBrowserGeometryKernelRequest<
  T extends GeometryKernelRequest
>(
  request: T
): Promise<{
  readonly response: GeometryKernelResponseForRequest<T>;
  readonly timings: BrowserGeometryKernelTimings;
}> {
  let occtLoadMs = 0;
  let tessellationMs = 0;
  let failureStage: BrowserGeometryKernelFailureStage | undefined;
  const geometryKernelStart = performance.now();
  const response = await executeGeometryKernelRequestWithMeshFactory(
    {
      createBoxMesh: (input) => createMeshWithBrowserOcct(input, "box"),
      createCylinderMesh: (input) =>
        createMeshWithBrowserOcct(input, "cylinder"),
      createSphereMesh: (input) => createMeshWithBrowserOcct(input, "sphere"),
      createConeMesh: (input) => createMeshWithBrowserOcct(input, "cone"),
      createTorusMesh: (input) => createMeshWithBrowserOcct(input, "torus"),
      createBooleanExtrudeMesh: createBooleanExtrudeMeshWithBrowserOcct,
      createEdgeFinishMesh: createEdgeFinishMeshWithBrowserOcct,
      createHoleMesh: createHoleMeshWithBrowserOcct,
      createRevolveProfileMesh: createRevolveProfileMeshWithBrowserOcct,
      createExactBodyMetadata: createExactBodyMetadataWithBrowserOcct,
      createExactTopologySnapshot: createExactTopologySnapshotWithBrowserOcct,
      createExactTopologyCheckpointPayload:
        createExactTopologyCheckpointPayloadWithBrowserOcct,
      createExactStepExport: createExactStepExportWithBrowserOcct
    },
    request
  );

  return {
    response,
    timings: {
      occtLoadMs,
      tessellationMs,
      geometryKernelMs: performance.now() - geometryKernelStart,
      ...(failureStage ? { failureStage } : {})
    }
  };

  async function createMeshWithBrowserOcct(
    input:
      | (BoxGeometryDimensions & TessellationOptions)
      | (CylinderGeometryDimensions & TessellationOptions)
      | (SphereGeometryDimensions & TessellationOptions)
      | (ConeGeometryDimensions & TessellationOptions)
      | (TorusGeometryDimensions & TessellationOptions),
    primitive: BrowserOcctPrimitive
  ) {
    const occtLoadStart = performance.now();
    let oc: Awaited<ReturnType<typeof loadBrowserOcct>>;

    try {
      oc = await loadBrowserOcct();
    } catch (error) {
      occtLoadMs = performance.now() - occtLoadStart;
      failureStage = "wasmLoad";
      throw error;
    }

    occtLoadMs = performance.now() - occtLoadStart;

    const tessellationStart = performance.now();

    try {
      switch (primitive) {
        case "box":
          return createOcctBoxMeshWithInstance(
            oc,
            input as BoxGeometryDimensions & TessellationOptions
          );
        case "cylinder":
          return createOcctCylinderMeshWithInstance(
            oc,
            input as CylinderGeometryDimensions & TessellationOptions
          );
        case "sphere":
          return createOcctSphereMeshWithInstance(
            oc,
            input as SphereGeometryDimensions & TessellationOptions
          );
        case "cone":
          return createOcctConeMeshWithInstance(
            oc,
            input as ConeGeometryDimensions & TessellationOptions
          );
        case "torus":
          return createOcctTorusMeshWithInstance(
            oc,
            input as TorusGeometryDimensions & TessellationOptions
          );
      }
    } catch (error) {
      failureStage = "tessellation";
      throw error;
    } finally {
      tessellationMs = performance.now() - tessellationStart;
    }
  }

  async function createBooleanExtrudeMeshWithBrowserOcct(
    input: Omit<BooleanExtrudesRequest, "id" | "version" | "op"> &
      TessellationOptions
  ) {
    const occtLoadStart = performance.now();
    let oc: Awaited<ReturnType<typeof loadBrowserOcct>>;

    try {
      oc = await loadBrowserOcct();
    } catch (error) {
      occtLoadMs = performance.now() - occtLoadStart;
      failureStage = "wasmLoad";
      throw error;
    }

    occtLoadMs = performance.now() - occtLoadStart;

    const tessellationStart = performance.now();

    try {
      return createOcctBooleanExtrudeMeshWithInstance(oc, input);
    } catch (error) {
      failureStage = "tessellation";
      throw error;
    } finally {
      tessellationMs = performance.now() - tessellationStart;
    }
  }

  async function createHoleMeshWithBrowserOcct(
    input: Omit<HoleRequest, "id" | "version" | "op"> & TessellationOptions
  ) {
    const occtLoadStart = performance.now();
    let oc: Awaited<ReturnType<typeof loadBrowserOcct>>;

    try {
      oc = await loadBrowserOcct();
    } catch (error) {
      occtLoadMs = performance.now() - occtLoadStart;
      failureStage = "wasmLoad";
      throw error;
    }

    occtLoadMs = performance.now() - occtLoadStart;

    const tessellationStart = performance.now();

    try {
      return createOcctHoleMeshWithInstance(oc, input);
    } catch (error) {
      failureStage = "tessellation";
      throw error;
    } finally {
      tessellationMs = performance.now() - tessellationStart;
    }
  }

  async function createEdgeFinishMeshWithBrowserOcct(
    input: GeometryKernelEdgeFinishMeshFactoryInput
  ) {
    const occtLoadStart = performance.now();
    let oc: Awaited<ReturnType<typeof loadBrowserOcct>>;

    try {
      oc = await loadBrowserOcct();
    } catch (error) {
      occtLoadMs = performance.now() - occtLoadStart;
      failureStage = "wasmLoad";
      throw error;
    }

    occtLoadMs = performance.now() - occtLoadStart;

    const tessellationStart = performance.now();

    try {
      return createOcctEdgeFinishMeshWithInstance(oc, input);
    } catch (error) {
      failureStage = "tessellation";
      throw error;
    } finally {
      tessellationMs = performance.now() - tessellationStart;
    }
  }

  async function createExactBodyMetadataWithBrowserOcct(
    input: Omit<ExactBodyMetadataRequest, "id" | "version" | "op">
  ) {
    const occtLoadStart = performance.now();
    let oc: Awaited<ReturnType<typeof loadBrowserOcct>>;

    try {
      oc = await loadBrowserOcct();
    } catch (error) {
      occtLoadMs = performance.now() - occtLoadStart;
      failureStage = "wasmLoad";
      throw error;
    }

    occtLoadMs = performance.now() - occtLoadStart;

    const tessellationStart = performance.now();

    try {
      return createOcctExactBodyMetadataWithInstance(oc, input);
    } catch (error) {
      failureStage = "tessellation";
      throw error;
    } finally {
      tessellationMs = performance.now() - tessellationStart;
    }
  }

  async function createExactTopologySnapshotWithBrowserOcct(
    input: Omit<ExactTopologySnapshotRequest, "id" | "version" | "op">
  ) {
    const occtLoadStart = performance.now();
    let oc: Awaited<ReturnType<typeof loadBrowserOcct>>;

    try {
      oc = await loadBrowserOcct();
    } catch (error) {
      occtLoadMs = performance.now() - occtLoadStart;
      failureStage = "wasmLoad";
      throw error;
    }

    occtLoadMs = performance.now() - occtLoadStart;

    const tessellationStart = performance.now();

    try {
      return createOcctExactTopologySnapshotWithInstance(oc, input);
    } catch (error) {
      failureStage = "tessellation";
      throw error;
    } finally {
      tessellationMs = performance.now() - tessellationStart;
    }
  }

  async function createExactTopologyCheckpointPayloadWithBrowserOcct(
    input: Omit<ExactTopologyCheckpointPayloadRequest, "id" | "version" | "op">
  ) {
    const occtLoadStart = performance.now();
    let oc: Awaited<ReturnType<typeof loadBrowserOcct>>;

    try {
      oc = await loadBrowserOcct();
    } catch (error) {
      occtLoadMs = performance.now() - occtLoadStart;
      failureStage = "wasmLoad";
      throw error;
    }

    occtLoadMs = performance.now() - occtLoadStart;

    const tessellationStart = performance.now();

    try {
      return createOcctExactTopologyCheckpointPayloadWithInstance(oc, input);
    } catch (error) {
      failureStage = "tessellation";
      throw error;
    } finally {
      tessellationMs = performance.now() - tessellationStart;
    }
  }

  async function createExactStepExportWithBrowserOcct(
    input: Omit<ExactStepExportRequest, "id" | "version" | "op">
  ) {
    const occtLoadStart = performance.now();
    let oc: Awaited<ReturnType<typeof loadBrowserOcct>>;

    try {
      oc = await loadBrowserOcct();
    } catch (error) {
      occtLoadMs = performance.now() - occtLoadStart;
      failureStage = "wasmLoad";
      throw error;
    }

    occtLoadMs = performance.now() - occtLoadStart;

    const tessellationStart = performance.now();

    try {
      return createOcctStepExportWithInstance(oc, input);
    } catch (error) {
      failureStage = "tessellation";
      throw error;
    } finally {
      tessellationMs = performance.now() - tessellationStart;
    }
  }

  async function createRevolveProfileMeshWithBrowserOcct(
    input: Omit<RevolveProfileRequest, "id" | "version" | "op"> &
      TessellationOptions
  ) {
    const occtLoadStart = performance.now();
    let oc: Awaited<ReturnType<typeof loadBrowserOcct>>;

    try {
      oc = await loadBrowserOcct();
    } catch (error) {
      occtLoadMs = performance.now() - occtLoadStart;
      failureStage = "wasmLoad";
      throw error;
    }

    occtLoadMs = performance.now() - occtLoadStart;

    const tessellationStart = performance.now();

    try {
      return createOcctRevolveProfileMeshWithInstance(oc, input);
    } catch (error) {
      failureStage = "tessellation";
      throw error;
    } finally {
      tessellationMs = performance.now() - tessellationStart;
    }
  }
}

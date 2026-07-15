import initOpenCascade from "opencascade.js/dist/node.js";
import type { OpenCascadeInstance } from "opencascade.js";
import {
  createOcctBoxMeshWithInstance,
  createOcctBoxMeshWithLoader,
  type OcctBoxInput
} from "./tessellateBox";
import type { OcctMeshData } from "./readTriangulatedShape";
import {
  createOcctCylinderMeshWithInstance,
  createOcctCylinderMeshWithLoader,
  type OcctCylinderInput
} from "./tessellateCylinder";
import {
  createOcctSphereMeshWithInstance,
  createOcctSphereMeshWithLoader,
  type OcctSphereInput
} from "./tessellateSphere";
import {
  createOcctConeMeshWithInstance,
  createOcctConeMeshWithLoader,
  type OcctConeInput
} from "./tessellateCone";
import {
  createOcctTorusMeshWithInstance,
  createOcctTorusMeshWithLoader,
  type OcctTorusInput
} from "./tessellateTorus";
import {
  createOcctBooleanExtrudeMeshWithInstance,
  createOcctBooleanExtrudeMeshWithLoader,
  type OcctBooleanExtrudeInput
} from "./booleanExtrudes";
import {
  createOcctEdgeFinishMeshWithInstance,
  createOcctEdgeFinishMeshWithLoader,
  type OcctEdgeFinishInput
} from "./edgeFinish";
import {
  createOcctHoleMeshWithInstance,
  createOcctHoleMeshWithLoader,
  type OcctHoleInput
} from "./hole";
import {
  createOcctExactBodyMetadataWithInstance,
  createOcctExactBodyMetadataWithLoader,
  createOcctExactTopologySnapshotWithInstance,
  createOcctExactTopologySnapshotWithLoader,
  type OcctExactBodyMetadata,
  type OcctExactBodyMetadataInput,
  type OcctExactTopologySnapshot,
  type OcctExactEdgeFinishMetadataSource,
  type OcctExactHoleMetadataSource,
  type OcctExactSweepMetadataSource
} from "./exactMetadata";
import {
  createOcctRevolveProfileMeshWithInstance,
  createOcctRevolveProfileMeshWithLoader,
  type OcctRevolveProfileInput
} from "./revolveProfile";
import {
  createOcctStepExportWithInstance,
  createOcctStepExportWithLoader,
  getOcctStepWriterCapabilityWithInstance,
  getOcctStepWriterCapabilityWithLoader,
  type OcctStepExportArtifact,
  type OcctStepExportBodySource,
  type OcctStepExportInput,
  type OcctStepExportSchema,
  type OcctStepExportUnit,
  type OcctStepWriterCapability
} from "./exactStepExport";
import {
  createOcctExactTopologyCheckpointPayloadWithInstance,
  createOcctExactTopologyCheckpointPayloadWithLoader,
  getOcctBrepCheckpointWriterCapabilityWithInstance,
  getOcctBrepCheckpointWriterCapabilityWithLoader,
  type OcctBrepCheckpointWriterCapability,
  type OcctExactTopologyCheckpointPayload,
  type OcctExactTopologyCheckpointPayloadInput,
  type OcctTopologyCheckpointSignaturePayload
} from "./exactCheckpointPayload";
import {
  createOcctStepImportWithInstance,
  createOcctStepImportWithLoader,
  getOcctStepReaderCapabilityWithInstance,
  getOcctStepReaderCapabilityWithLoader,
  type OcctImportedBodyPayload,
  type OcctStepImportDiagnostic,
  type OcctStepImportInput,
  type OcctStepImportResult,
  type OcctStepReaderCapability
} from "./stepImport";
import {
  createOcctLinearPatternMeshWithInstance,
  createOcctLinearPatternMeshWithLoader,
  createOcctCircularPatternMeshWithInstance,
  createOcctCircularPatternMeshWithLoader,
  type OcctLinearPatternInput,
  type OcctCircularPatternInput,
  type OcctDirection,
  type OcctAxisFrame,
  type OcctPatternSeedSource
} from "./pattern";
import {
  createOcctMirrorMeshWithInstance,
  createOcctMirrorMeshWithLoader,
  type OcctMirrorInput,
  type OcctMirrorPlaneFrame,
  type OcctMirrorSeedSource
} from "./mirror";
import {
  createOcctShellMeshWithInstance,
  createOcctShellMeshWithLoader,
  type OcctShellInput,
  type OcctShellTargetSource
} from "./shell";
import {
  createOcctSweepMeshWithInstance,
  createOcctSweepMeshWithLoader,
  type OcctSweepInput,
  type OcctSweepPathSegment,
  type OcctSweepProfileSource
} from "./sweep";

export type {
  OcctBooleanExtrudeInput,
  OcctEdgeFinishInput,
  OcctHoleInput,
  OcctBoxInput,
  OcctCylinderInput,
  OcctSphereInput,
  OcctConeInput,
  OcctTorusInput,
  OcctExactBodyMetadata,
  OcctExactBodyMetadataInput,
  OcctExactTopologySnapshot,
  OcctExactEdgeFinishMetadataSource,
  OcctExactHoleMetadataSource,
  OcctExactSweepMetadataSource,
  OcctRevolveProfileInput,
  OcctStepExportArtifact,
  OcctStepExportBodySource,
  OcctStepExportInput,
  OcctStepExportSchema,
  OcctStepExportUnit,
  OcctStepWriterCapability,
  OcctBrepCheckpointWriterCapability,
  OcctExactTopologyCheckpointPayload,
  OcctExactTopologyCheckpointPayloadInput,
  OcctTopologyCheckpointSignaturePayload,
  OcctImportedBodyPayload,
  OcctStepImportDiagnostic,
  OcctStepImportInput,
  OcctStepImportResult,
  OcctStepReaderCapability,
  OcctMeshData,
  OcctLinearPatternInput,
  OcctCircularPatternInput,
  OcctDirection,
  OcctAxisFrame,
  OcctPatternSeedSource,
  OcctMirrorInput,
  OcctMirrorPlaneFrame,
  OcctMirrorSeedSource,
  OcctShellInput,
  OcctShellTargetSource,
  OcctSweepInput,
  OcctSweepPathSegment,
  OcctSweepProfileSource
};
export {
  createOcctBoxMeshWithInstance,
  createOcctBoxMeshWithLoader,
  createOcctCylinderMeshWithInstance,
  createOcctCylinderMeshWithLoader,
  createOcctSphereMeshWithInstance,
  createOcctSphereMeshWithLoader,
  createOcctConeMeshWithInstance,
  createOcctConeMeshWithLoader,
  createOcctTorusMeshWithInstance,
  createOcctTorusMeshWithLoader,
  createOcctBooleanExtrudeMeshWithInstance,
  createOcctBooleanExtrudeMeshWithLoader,
  createOcctEdgeFinishMeshWithInstance,
  createOcctEdgeFinishMeshWithLoader,
  createOcctHoleMeshWithInstance,
  createOcctHoleMeshWithLoader,
  createOcctRevolveProfileMeshWithInstance,
  createOcctRevolveProfileMeshWithLoader,
  createOcctExactBodyMetadataWithInstance,
  createOcctExactBodyMetadataWithLoader,
  createOcctExactTopologySnapshotWithInstance,
  createOcctExactTopologySnapshotWithLoader,
  createOcctStepExportWithInstance,
  createOcctStepExportWithLoader,
  getOcctStepWriterCapabilityWithInstance,
  getOcctStepWriterCapabilityWithLoader,
  createOcctExactTopologyCheckpointPayloadWithInstance,
  createOcctExactTopologyCheckpointPayloadWithLoader,
  getOcctBrepCheckpointWriterCapabilityWithInstance,
  getOcctBrepCheckpointWriterCapabilityWithLoader,
  createOcctStepImportWithInstance,
  createOcctStepImportWithLoader,
  getOcctStepReaderCapabilityWithInstance,
  getOcctStepReaderCapabilityWithLoader,
  createOcctLinearPatternMeshWithInstance,
  createOcctLinearPatternMeshWithLoader,
  createOcctCircularPatternMeshWithInstance,
  createOcctCircularPatternMeshWithLoader,
  createOcctMirrorMeshWithInstance,
  createOcctMirrorMeshWithLoader,
  createOcctShellMeshWithInstance,
  createOcctShellMeshWithLoader,
  createOcctSweepMeshWithInstance,
  createOcctSweepMeshWithLoader
};

let occtPromise: Promise<OpenCascadeInstance> | undefined;

export async function loadOcct(): Promise<OpenCascadeInstance> {
  occtPromise ??= initOpenCascade();
  return occtPromise;
}

export async function createOcctBoxMesh(
  input: OcctBoxInput
): Promise<OcctMeshData> {
  return createOcctBoxMeshWithLoader(loadOcct, input);
}

export async function createOcctCylinderMesh(
  input: OcctCylinderInput
): Promise<OcctMeshData> {
  return createOcctCylinderMeshWithLoader(loadOcct, input);
}

export async function createOcctSphereMesh(
  input: OcctSphereInput
): Promise<OcctMeshData> {
  return createOcctSphereMeshWithLoader(loadOcct, input);
}

export async function createOcctConeMesh(
  input: OcctConeInput
): Promise<OcctMeshData> {
  return createOcctConeMeshWithLoader(loadOcct, input);
}

export async function createOcctTorusMesh(
  input: OcctTorusInput
): Promise<OcctMeshData> {
  return createOcctTorusMeshWithLoader(loadOcct, input);
}

export async function createOcctBooleanExtrudeMesh(
  input: OcctBooleanExtrudeInput
): Promise<OcctMeshData> {
  return createOcctBooleanExtrudeMeshWithLoader(loadOcct, input);
}

export async function createOcctEdgeFinishMesh(
  input: OcctEdgeFinishInput
): Promise<OcctMeshData> {
  return createOcctEdgeFinishMeshWithLoader(loadOcct, input);
}

export async function createOcctHoleMesh(
  input: OcctHoleInput
): Promise<OcctMeshData> {
  return createOcctHoleMeshWithLoader(loadOcct, input);
}

export async function createOcctRevolveProfileMesh(
  input: OcctRevolveProfileInput
): Promise<OcctMeshData> {
  return createOcctRevolveProfileMeshWithLoader(loadOcct, input);
}

export async function createOcctExactBodyMetadata(
  input: OcctExactBodyMetadataInput
): Promise<OcctExactBodyMetadata> {
  return createOcctExactBodyMetadataWithLoader(loadOcct, input);
}

export async function createOcctExactTopologySnapshot(
  input: OcctExactBodyMetadataInput
): Promise<OcctExactTopologySnapshot> {
  return createOcctExactTopologySnapshotWithLoader(loadOcct, input);
}

export async function createOcctStepExport(
  input: OcctStepExportInput
): Promise<OcctStepExportArtifact> {
  return createOcctStepExportWithLoader(loadOcct, input);
}

export async function getOcctStepWriterCapability(): Promise<OcctStepWriterCapability> {
  return getOcctStepWriterCapabilityWithLoader(loadOcct);
}

export async function createOcctExactTopologyCheckpointPayload(
  input: OcctExactTopologyCheckpointPayloadInput
): Promise<OcctExactTopologyCheckpointPayload> {
  return createOcctExactTopologyCheckpointPayloadWithLoader(loadOcct, input);
}

export async function getOcctBrepCheckpointWriterCapability(): Promise<OcctBrepCheckpointWriterCapability> {
  return getOcctBrepCheckpointWriterCapabilityWithLoader(loadOcct);
}

export async function createOcctStepImport(
  input: OcctStepImportInput
): Promise<OcctStepImportResult> {
  return createOcctStepImportWithLoader(loadOcct, input);
}

export async function getOcctStepReaderCapability(): Promise<OcctStepReaderCapability> {
  return getOcctStepReaderCapabilityWithLoader(loadOcct);
}

export async function createOcctLinearPatternMesh(
  input: OcctLinearPatternInput
): Promise<OcctMeshData> {
  return createOcctLinearPatternMeshWithLoader(loadOcct, input);
}

export async function createOcctCircularPatternMesh(
  input: OcctCircularPatternInput
): Promise<OcctMeshData> {
  return createOcctCircularPatternMeshWithLoader(loadOcct, input);
}

export async function createOcctMirrorMesh(
  input: OcctMirrorInput
): Promise<OcctMeshData> {
  return createOcctMirrorMeshWithLoader(loadOcct, input);
}

export async function createOcctShellMesh(
  input: OcctShellInput
): Promise<OcctMeshData> {
  return createOcctShellMeshWithLoader(loadOcct, input);
}

export async function createOcctSweepMesh(
  input: OcctSweepInput
): Promise<OcctMeshData> {
  return createOcctSweepMeshWithLoader(loadOcct, input);
}

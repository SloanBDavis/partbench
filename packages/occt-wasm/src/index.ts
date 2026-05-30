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
  type OcctExactBodyMetadata,
  type OcctExactBodyMetadataInput,
  type OcctExactEdgeFinishMetadataSource,
  type OcctExactHoleMetadataSource
} from "./exactMetadata";
import {
  createOcctRevolveProfileMeshWithInstance,
  createOcctRevolveProfileMeshWithLoader,
  type OcctRevolveProfileInput
} from "./revolveProfile";

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
  OcctExactEdgeFinishMetadataSource,
  OcctExactHoleMetadataSource,
  OcctRevolveProfileInput,
  OcctMeshData
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
  createOcctExactBodyMetadataWithLoader
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

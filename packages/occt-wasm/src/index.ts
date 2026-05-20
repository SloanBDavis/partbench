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

export type {
  OcctBooleanExtrudeInput,
  OcctBoxInput,
  OcctCylinderInput,
  OcctSphereInput,
  OcctConeInput,
  OcctTorusInput,
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
  createOcctBooleanExtrudeMeshWithLoader
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

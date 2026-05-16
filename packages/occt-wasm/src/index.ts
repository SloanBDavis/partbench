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

export type { OcctBoxInput, OcctCylinderInput, OcctSphereInput, OcctMeshData };
export {
  createOcctBoxMeshWithInstance,
  createOcctBoxMeshWithLoader,
  createOcctCylinderMeshWithInstance,
  createOcctCylinderMeshWithLoader,
  createOcctSphereMeshWithInstance,
  createOcctSphereMeshWithLoader
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

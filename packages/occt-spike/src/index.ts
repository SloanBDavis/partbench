import initOpenCascade from "opencascade.js/dist/node.js";
import type { OpenCascadeInstance } from "opencascade.js";
import {
  createOcctBoxMeshWithInstance,
  createOcctBoxMeshWithLoader,
  type OcctBoxInput
} from "./tessellateBox";
import type { OcctSpikeMesh } from "./readTriangulatedShape";
import {
  createOcctCylinderMeshWithInstance,
  createOcctCylinderMeshWithLoader,
  type OcctCylinderInput
} from "./tessellateCylinder";

export type { OcctBoxInput, OcctCylinderInput, OcctSpikeMesh };
export {
  createOcctBoxMeshWithInstance,
  createOcctBoxMeshWithLoader,
  createOcctCylinderMeshWithInstance,
  createOcctCylinderMeshWithLoader
};

let occtPromise: Promise<OpenCascadeInstance> | undefined;

export async function loadOcct(): Promise<OpenCascadeInstance> {
  occtPromise ??= initOpenCascade();
  return occtPromise;
}

export async function createOcctBoxMeshSpike(
  input: OcctBoxInput
): Promise<OcctSpikeMesh> {
  return createOcctBoxMeshWithLoader(loadOcct, input);
}

export async function createOcctCylinderMeshSpike(
  input: OcctCylinderInput
): Promise<OcctSpikeMesh> {
  return createOcctCylinderMeshWithLoader(loadOcct, input);
}

import initOpenCascade from "opencascade.js/dist/node.js";
import type { OpenCascadeInstance } from "opencascade.js";
import {
  createOcctBoxMeshWithInstance,
  createOcctBoxMeshWithLoader,
  type OcctBoxInput,
  type OcctSpikeMesh
} from "./tessellateBox";

export type { OcctBoxInput, OcctSpikeMesh };
export { createOcctBoxMeshWithInstance, createOcctBoxMeshWithLoader };

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

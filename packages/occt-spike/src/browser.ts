/// <reference path="./vite-assets.d.ts" />

import ocFullJS from "opencascade.js/dist/opencascade.full.js";
import ocFullWasmUrl from "opencascade.js/dist/opencascade.full.wasm?url";
import type { OpenCascadeInstance } from "opencascade.js";
import {
  createOcctBoxMeshWithInstance,
  createOcctBoxMeshWithLoader,
  type OcctBoxInput,
  type OcctSpikeMesh
} from "./tessellateBox";

export type { OcctBoxInput, OcctSpikeMesh };
export { createOcctBoxMeshWithInstance, createOcctBoxMeshWithLoader };

type OpenCascadeModuleObject = Record<string, unknown>;
type LoadDynamicLibrary = (
  lib: string,
  options: {
    readonly loadAsync: true;
    readonly global: true;
    readonly nodelete: true;
    readonly allowUndefined: false;
  }
) => Promise<void>;

interface BrowserOpenCascadeSettings {
  readonly mainJS?: OpenCascadeModuleConstructor;
  readonly mainWasm?: string;
  readonly worker?: string;
  readonly libs?: readonly string[];
  readonly module?: OpenCascadeModuleObject;
}

interface OpenCascadeModuleConstructor {
  new (settings: OpenCascadeModuleObject): Promise<OpenCascadeInstance>;
}

let occtPromise: Promise<OpenCascadeInstance> | undefined;

export async function loadBrowserOcct(): Promise<OpenCascadeInstance> {
  occtPromise ??= initBrowserOpenCascade();
  return occtPromise;
}

export async function initBrowserOpenCascade(
  settings: BrowserOpenCascadeSettings = {}
): Promise<OpenCascadeInstance> {
  const mainJS =
    settings.mainJS ?? (ocFullJS as unknown as OpenCascadeModuleConstructor);
  const mainWasm = settings.mainWasm ?? ocFullWasmUrl;
  const libs = settings.libs ?? [];
  const module = settings.module ?? {};
  const oc = await new mainJS({
    locateFile(path: string) {
      if (path.endsWith(".wasm")) {
        return mainWasm;
      }

      if (path.endsWith(".worker.js") && settings.worker) {
        return settings.worker;
      }

      return path;
    },
    ...module
  });

  for (const lib of libs) {
    const dynamicOc = oc as OpenCascadeInstance & {
      readonly loadDynamicLibrary?: LoadDynamicLibrary;
    };

    if (!dynamicOc.loadDynamicLibrary) {
      throw new Error("Open CASCADE dynamic library loading is unavailable.");
    }

    await dynamicOc.loadDynamicLibrary(lib, {
      loadAsync: true,
      global: true,
      nodelete: true,
      allowUndefined: false
    });
  }

  return oc;
}

export async function createOcctBoxMeshSpike(
  input: OcctBoxInput
): Promise<OcctSpikeMesh> {
  return createOcctBoxMeshWithLoader(loadBrowserOcct, input);
}

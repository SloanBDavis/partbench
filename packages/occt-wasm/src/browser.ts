/// <reference path="./vite-assets.d.ts" />

import ocFullJS from "opencascade.js/dist/opencascade.full.js";
import ocFullWasmUrl from "opencascade.js/dist/opencascade.full.wasm?url";
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
  type OcctExactSweepMetadataSource,
  type OcctExactLoftMetadataSource
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
  createOcctCircularPatternMeshWithInstance,
  createOcctCircularPatternMeshWithLoader,
  createOcctLinearPatternMeshWithInstance,
  createOcctLinearPatternMeshWithLoader,
  type OcctCircularPatternInput,
  type OcctLinearPatternInput
} from "./pattern";
import {
  createOcctMirrorMeshWithInstance,
  createOcctMirrorMeshWithLoader,
  type OcctMirrorInput
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
import {
  createOcctLoftMeshWithInstance,
  createOcctLoftMeshWithLoader,
  type OcctLoftInput,
  type OcctLoftSection
} from "./loft";
import {
  createOcctWireExtrudeMeshWithInstance,
  createOcctWireExtrudeMeshWithLoader,
  makeWireExtrudeShape,
  makeWireExtrudeShapeWithReferences,
  type OcctGeneratedReferences,
  type OcctResolvedPlanarWireProfile,
  type OcctWireExtrudeInput,
  type OcctWireExtrudeSource,
  type OcctWireExtrudeShapeBuild
} from "./wireExtrude";

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
  OcctExactLoftMetadataSource,
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
  OcctLinearPatternInput,
  OcctCircularPatternInput,
  OcctMirrorInput,
  OcctShellInput,
  OcctShellTargetSource,
  OcctSweepInput,
  OcctSweepPathSegment,
  OcctSweepProfileSource,
  OcctLoftInput,
  OcctLoftSection,
  OcctMeshData,
  OcctGeneratedReferences,
  OcctResolvedPlanarWireProfile,
  OcctWireExtrudeInput,
  OcctWireExtrudeSource,
  OcctWireExtrudeShapeBuild
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
  createOcctWireExtrudeMeshWithInstance,
  createOcctWireExtrudeMeshWithLoader,
  makeWireExtrudeShape,
  makeWireExtrudeShapeWithReferences,
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
  createOcctSweepMeshWithLoader,
  createOcctLoftMeshWithInstance,
  createOcctLoftMeshWithLoader
};

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

export async function createOcctBoxMesh(
  input: OcctBoxInput
): Promise<OcctMeshData> {
  return createOcctBoxMeshWithLoader(loadBrowserOcct, input);
}

export async function createOcctCylinderMesh(
  input: OcctCylinderInput
): Promise<OcctMeshData> {
  return createOcctCylinderMeshWithLoader(loadBrowserOcct, input);
}

export async function createOcctSphereMesh(
  input: OcctSphereInput
): Promise<OcctMeshData> {
  return createOcctSphereMeshWithLoader(loadBrowserOcct, input);
}

export async function createOcctConeMesh(
  input: OcctConeInput
): Promise<OcctMeshData> {
  return createOcctConeMeshWithLoader(loadBrowserOcct, input);
}

export async function createOcctTorusMesh(
  input: OcctTorusInput
): Promise<OcctMeshData> {
  return createOcctTorusMeshWithLoader(loadBrowserOcct, input);
}

export async function createOcctBooleanExtrudeMesh(
  input: OcctBooleanExtrudeInput
): Promise<OcctMeshData> {
  return createOcctBooleanExtrudeMeshWithLoader(loadBrowserOcct, input);
}

export async function createOcctWireExtrudeMesh(
  input: OcctWireExtrudeInput
): Promise<
  OcctMeshData & { readonly generatedReferences: OcctGeneratedReferences }
> {
  return createOcctWireExtrudeMeshWithLoader(loadBrowserOcct, input);
}

export async function createOcctEdgeFinishMesh(
  input: OcctEdgeFinishInput
): Promise<OcctMeshData> {
  return createOcctEdgeFinishMeshWithLoader(loadBrowserOcct, input);
}

export async function createOcctHoleMesh(
  input: OcctHoleInput
): Promise<OcctMeshData> {
  return createOcctHoleMeshWithLoader(loadBrowserOcct, input);
}

export async function createOcctRevolveProfileMesh(
  input: OcctRevolveProfileInput
): Promise<OcctMeshData> {
  return createOcctRevolveProfileMeshWithLoader(loadBrowserOcct, input);
}

export async function createOcctExactBodyMetadata(
  input: OcctExactBodyMetadataInput
): Promise<OcctExactBodyMetadata> {
  return createOcctExactBodyMetadataWithLoader(loadBrowserOcct, input);
}

export async function createOcctExactTopologySnapshot(
  input: OcctExactBodyMetadataInput
): Promise<OcctExactTopologySnapshot> {
  return createOcctExactTopologySnapshotWithLoader(loadBrowserOcct, input);
}

export async function createOcctStepExport(
  input: OcctStepExportInput
): Promise<OcctStepExportArtifact> {
  return createOcctStepExportWithLoader(loadBrowserOcct, input);
}

export async function getOcctStepWriterCapability(): Promise<OcctStepWriterCapability> {
  return getOcctStepWriterCapabilityWithLoader(loadBrowserOcct);
}

export async function createOcctExactTopologyCheckpointPayload(
  input: OcctExactTopologyCheckpointPayloadInput
): Promise<OcctExactTopologyCheckpointPayload> {
  return createOcctExactTopologyCheckpointPayloadWithLoader(
    loadBrowserOcct,
    input
  );
}

export async function getOcctBrepCheckpointWriterCapability(): Promise<OcctBrepCheckpointWriterCapability> {
  return getOcctBrepCheckpointWriterCapabilityWithLoader(loadBrowserOcct);
}

export async function createOcctStepImport(
  input: OcctStepImportInput
): Promise<OcctStepImportResult> {
  return createOcctStepImportWithLoader(loadBrowserOcct, input);
}

export async function getOcctStepReaderCapability(): Promise<OcctStepReaderCapability> {
  return getOcctStepReaderCapabilityWithLoader(loadBrowserOcct);
}

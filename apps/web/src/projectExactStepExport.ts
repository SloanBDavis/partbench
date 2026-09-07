// Shared document-to-exact evaluation; browser imports remain compatible.
export * from "@web-cad/cad-runtime/shared/projectExactStepExport";
import {
  runProjectExactStepExport as runSharedProjectExactStepExport,
  runProjectAgentExactExport as runSharedProjectAgentExactExport,
  buildCurrentExactBodyArtifacts as buildSharedCurrentExactBodyArtifacts,
  type CurrentExactBodyArtifactBuildInput as SharedArtifactBuildInput,
  type ProjectExactStepExportResult
} from "@web-cad/cad-runtime/shared/projectExactStepExport";
export function runProjectExactStepExport(
  input: Omit<Parameters<typeof runSharedProjectExactStepExport>[0], "download">
) {
  return runSharedProjectExactStepExport({
    ...input,
    download: downloadProjectExactStepArtifact
  });
}
export function runProjectAgentExactExport(
  input: Omit<
    Parameters<typeof runSharedProjectAgentExactExport>[0],
    "download"
  >
) {
  return runSharedProjectAgentExactExport({
    ...input,
    download: downloadProjectExactStepArtifact
  });
}
export function downloadProjectExactStepArtifact(
  result: Pick<ProjectExactStepExportResult, "bytes" | "fileName" | "mimeType">
): void {
  const blob = new Blob([result.bytes as Uint8Array<ArrayBuffer>], {
    type: result.mimeType
  });
  const url = URL.createObjectURL(blob);
  let link: HTMLAnchorElement | undefined;
  try {
    link = document.createElement("a");
    link.href = url;
    link.download = result.fileName;
    document.body.append(link);
    link.click();
  } finally {
    link?.remove();
    URL.revokeObjectURL(url);
  }
}

import type { GeometryKernelExactBodyArtifact } from "@web-cad/geometry-worker";
import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";
export type CurrentExactBodyArtifactBuildInput = Omit<
  SharedArtifactBuildInput,
  "runtime"
> & {
  readonly runtime: Pick<
    DerivedGeometryRuntime,
    "exactBodyArtifact" | "getModelWorkSnapshot"
  >;
};
export async function buildCurrentExactBodyArtifacts(
  input: CurrentExactBodyArtifactBuildInput
): Promise<GeometryKernelExactBodyArtifact[]> {
  const artifacts = await buildSharedCurrentExactBodyArtifacts(input);
  if (
    !artifacts.every(
      (artifact): artifact is GeometryKernelExactBodyArtifact =>
        "displayMesh" in artifact
    )
  ) {
    throw new Error("Browser exact artifacts require display geometry.");
  }
  return artifacts;
}

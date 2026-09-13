import { createCadSession, type CadSession } from "@web-cad/cad-runtime";
import { basename } from "node:path";
import type { CadAgentSessionErrorResponse } from "@web-cad/agent-adapter";
import {
  createCadMcpServer,
  type CadMcpExecutionPort,
  type CadMcpProjectFilesPort,
  type CadProjectToolResult
} from "@web-cad/mcp-adapter";
import {
  WorkspaceFiles,
  ProjectFileError,
  WORKSPACE_FILE_LIMITS,
  hasCode
} from "./workspaceFiles.ts";

export interface HeadlessAgentHost {
  readonly server: ReturnType<typeof createCadMcpServer>;
  readonly workspace: string;
  close(): Promise<void>;
}

export async function createHeadlessAgentHost(options: {
  workspace: string;
  session?: CadSession;
}): Promise<HeadlessAgentHost> {
  const files = await WorkspaceFiles.create(options.workspace);
  const cad = options.session ?? (await createCadSession());
  // Serialize reads, mutations, and files together, including pipelined stdio calls.
  // A save issued after a batch must observe that batch, even if exact evaluation awaits.
  let tail: Promise<unknown> = Promise.resolve();
  function enqueue<T>(task: () => Promise<T> | T): Promise<T> {
    const result = tail.then(task);
    tail = result.catch(() => undefined);
    return result;
  }
  function projectTask(
    task: () => Promise<Record<string, unknown>> | Record<string, unknown>
  ): Promise<CadProjectToolResult> {
    return enqueue(async () => {
      try {
        return { ok: true as const, result: await task() };
      } catch (error) {
        return projectFailure(error);
      }
    });
  }
  const executionPort: CadMcpExecutionPort = {
    execute: (request) => enqueue(() => cad.execute(request)),
    query: (request) => enqueue(() => cad.query(request)),
    inspectV8ProjectSurface: (request) =>
      enqueue(() => cad.inspectV8ProjectSurface(request)),
    getCurrentSelection: (request) =>
      enqueue(() => cad.getCurrentSelection(request)),
    requestExactExport: async (
      request
    ): Promise<CadAgentSessionErrorResponse> => ({
      ok: false,
      requestId: request.requestId,
      error: {
        code: "AGENT_SESSION_DISCONNECTED",
        message:
          "This headless session writes STEP with cad.project_export_file; browser downloads are unavailable."
      }
    })
  };
  const projectFiles: CadMcpProjectFilesPort = {
    sessionInfo: () =>
      projectTask(async () => ({
        ...(await cad.getSessionInfo()),
        mode: "headless",
        workspace: files.root,
        fileAccess: "workspace-only",
        fileTools: [
          "cad.project_open",
          "cad.project_save",
          "cad.project_import_file",
          "cad.project_export_file"
        ],
        assemblyTools: ["cad.assembly_make_independent"],
        fileFormats: {
          native: {
            formats: ["wcad"],
            behavior:
              "Complete editable source and history; open replaces the current project."
          },
          import: {
            formats: ["step", "dxf", "svg"],
            behavior:
              "Creates ordinary editable parts/assemblies or sketch curves in the current document. STEP does not recreate foreign feature history."
          },
          export: {
            formats: ["step", "dxf", "svg"],
            selectors: {
              step: "bodyIds or assemblyIds",
              dxf: "sketchIds",
              svg: "sketchIds"
            }
          },
          maxInputBytes: WORKSPACE_FILE_LIMITS
        },
        workflow: [
          "Use cad.operation_schema to discover commands, then cad.batch with responseDetail summary, version cadops.v1, mode commit, allowCommit true, and caller-supplied IDs to create or revise related operations in one transaction.",
          "Inspect cad.project_structure for body/feature IDs; use projection poses with filters for compact motion checks. Use cad.body_mass_properties for exact volume, area and center of mass, and reference/readiness queries before topology-dependent edits.",
          "Use mode dryRun to validate a proposed batch without committing. A rejected batch preserves the project.",
          "Import STEP/DXF/SVG with cad.project_import_file; inspect created IDs and warnings. dryRun true validates without committing. Unitless DXF requires unit; sketch scale is an explicit positive multiplier. Imported content uses the same cad.batch editing commands as authored content.",
          "Before editing just one repeated part, use cad.assembly_make_independent with its rootAssemblyId and instancePath; continue ordinary feature/sketch edits against the returned bodyId. Other occurrences retain their shared definitions.",
          "Save full source/history as .wcad with cad.project_save and reopen with cad.project_open. Use cad.project_export_file for STEP bodies/assemblies or local DXF/SVG sketch curves; read metadata omission notices. All file paths stay within this workspace."
        ]
      })),
    makeOccurrenceIndependent: ({ rootAssemblyId, instancePath }) =>
      projectTask(async () => ({
        ...(await cad.makeOccurrenceIndependent({
          rootAssemblyId,
          instancePath: [...instancePath]
        }))
      })),
    openProject: ({ path }) =>
      projectTask(async () => {
        const artifact = await files.readNative(path);
        const opened = await cad.openWcad(artifact.bytes);
        return {
          ...opened,
          path: artifact.path,
          byteLength: artifact.bytes.byteLength,
          format: "wcad"
        };
      }),
    importProjectFile: ({ path, format, dryRun, unit, scale }) =>
      projectTask(async () => {
        const artifact = await files.readExchange(path, format);
        if (
          artifact.format === "step" &&
          (unit !== undefined || scale !== undefined)
        )
          throw new ProjectFileError(
            "INVALID_ARGUMENTS",
            "STEP uses its declared units; explicit unit/scale options apply to sketch imports only."
          );
        const imported = await cad.importFile({
          bytes: artifact.bytes,
          fileName: basename(artifact.path),
          format: artifact.format,
          mode: dryRun ? "dryRun" : "commit",
          ...(unit !== undefined ? { unit } : {}),
          ...(scale !== undefined ? { scale } : {})
        });
        return {
          ...imported,
          path: artifact.path,
          byteLength: artifact.bytes.byteLength,
          format: artifact.format
        };
      }),
    saveProject: ({ path, overwrite }) =>
      projectTask(async () => {
        const output = await files.outputPath(path, "wcad", overwrite);
        const bytes = await cad.exportWcad();
        await files.write(output, bytes, overwrite);
        const info = await cad.getSessionInfo();
        return {
          path: output,
          byteLength: bytes.byteLength,
          format: "wcad",
          sourceIdentity: info.sourceIdentity
        };
      }),
    exportProjectFile: ({
      path,
      format,
      overwrite,
      bodyIds,
      assemblyIds,
      sketchIds
    }) =>
      projectTask(async () => {
        const output = await files.outputPath(path, format, overwrite);
        const { bytes, ...metadata } =
          format === "step"
            ? await cad.exportStep({ bodyIds, assemblyIds })
            : await cad.exportSketches({ format, sketchIds });
        await files.write(output, bytes, overwrite);
        const info = await cad.getSessionInfo();
        return {
          ...metadata,
          fileName: basename(output),
          path: output,
          byteLength: bytes.byteLength,
          format,
          sourceIdentity: info.sourceIdentity
        };
      })
  };
  return {
    server: createCadMcpServer({ executionPort, projectFiles }),
    workspace: files.root,
    close: () => enqueue(() => cad.dispose())
  };
}

function projectFailure(error: unknown): CadProjectToolResult {
  if (error instanceof ProjectFileError)
    return { ok: false, error: { code: error.code, message: error.message } };
  if (hasCode(error, "ENOENT"))
    return {
      ok: false,
      error: {
        code: "PATH_NOT_FOUND",
        message:
          "The file or parent directory does not exist. Use an existing path inside the session workspace."
      }
    };
  if (hasCode(error, "EACCES") || hasCode(error, "EPERM"))
    return {
      ok: false,
      error: {
        code: "FILE_ACCESS_DENIED",
        message:
          "The workspace file cannot be accessed. Choose a writable file inside the workspace."
      }
    };
  return {
    ok: false,
    error: {
      code: "PROJECT_OPERATION_FAILED",
      message:
        error instanceof Error
          ? error.message
          : "The project operation failed. Inspect cad.project_health and correct the input before retrying."
    }
  };
}

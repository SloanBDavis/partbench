import { createCadSession, type CadSession } from "@web-cad/cad-runtime";
import { basename } from "node:path";
import type { CadAgentSessionErrorResponse } from "@web-cad/agent-adapter";
import {
  createCadMcpServer,
  type CadMcpExecutionPort,
  type CadMcpProjectFilesPort,
  type CadProjectToolResult
} from "@web-cad/mcp-adapter";
import { WorkspaceFiles, ProjectFileError, hasCode } from "./workspaceFiles.ts";

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
          "cad.project_export_file"
        ],
        workflow: [
          "Use cad.batch with version cadops.v1, mode commit, allowCommit true, and caller-supplied IDs to create or revise several related operations in one transaction.",
          "Inspect cad.project_structure for body/feature IDs and cad.body_mass_properties for exact measurements. Use reference/readiness queries before topology-dependent edits.",
          "Use mode dryRun to validate a proposed batch without committing. A rejected batch preserves the project.",
          "Save .wcad with cad.project_save, reopen with cad.project_open, and export real STEP with cad.project_export_file. All file paths stay within this workspace."
        ]
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
    exportProjectFile: ({ path, overwrite, bodyIds }) =>
      projectTask(async () => {
        const output = await files.outputPath(path, "step", overwrite);
        const { bytes, ...metadata } = await cad.exportStep({ bodyIds });
        await files.write(output, bytes, overwrite);
        const info = await cad.getSessionInfo();
        return {
          ...metadata,
          fileName: basename(output),
          path: output,
          byteLength: bytes.byteLength,
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

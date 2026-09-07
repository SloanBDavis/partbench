import type { McpToolDefinition } from "./index";

export type CadProjectToolName =
  | "cad.session_info"
  | "cad.project_open"
  | "cad.project_save"
  | "cad.project_export_file";

export interface CadProjectFileRequest {
  readonly path: string;
  readonly overwrite?: boolean;
}

export interface CadProjectExportFileRequest extends CadProjectFileRequest {
  readonly format: "step";
  readonly bodyIds?: readonly string[];
}

export type CadProjectToolResult =
  | { readonly ok: true; readonly result: Record<string, unknown> }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly message: string;
      };
    };

/** Host capabilities, separate from the existing CADOps modeling authority. */
export interface CadMcpProjectFilesPort {
  sessionInfo?(): Promise<CadProjectToolResult>;
  openProject?(request: {
    readonly path: string;
  }): Promise<CadProjectToolResult>;
  saveProject?(request: CadProjectFileRequest): Promise<CadProjectToolResult>;
  exportProjectFile?(
    request: CadProjectExportFileRequest
  ): Promise<CadProjectToolResult>;
}

const pathProperty = {
  type: "string",
  minLength: 1,
  description:
    "File path within the workspace selected when starting this session."
};
const writeProperties = {
  path: pathProperty,
  overwrite: {
    type: "boolean",
    default: false,
    description: "Set true to replace an existing file."
  }
};

const TOOLS: readonly [keyof CadMcpProjectFilesPort, McpToolDefinition][] = [
  [
    "sessionInfo",
    {
      name: "cad.session_info",
      description:
        "Start here: returns this session's execution mode, workspace, exact geometry capabilities, source identity, and a short build/inspect/revise/save/export workflow.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {}
      }
    }
  ],
  [
    "openProject",
    {
      name: "cad.project_open",
      description:
        "Open a native .wcad file from this session's workspace, replacing the current project after validation. Save the current project first if you want to retain it. Invalid files leave it unchanged.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["path"],
        properties: { path: pathProperty }
      }
    }
  ],
  [
    "saveProject",
    {
      name: "cad.project_save",
      description:
        "Save the authoritative project as a browser-compatible .wcad file in this session's workspace. Returns the artifact path, size, and source identity. Existing files require overwrite: true.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["path"],
        properties: writeProperties
      }
    }
  ],
  [
    "exportProjectFile",
    {
      name: "cad.project_export_file",
      description:
        "Evaluate and write real exact AP242 STEP geometry in this session's workspace. Optionally select body IDs from cad.project_structure. Returns artifact metadata, never mesh substitutes or browser downloads. Existing files require overwrite: true.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["path", "format"],
        properties: {
          ...writeProperties,
          format: { const: "step" },
          bodyIds: {
            type: "array",
            minItems: 1,
            uniqueItems: true,
            items: { type: "string", minLength: 1 }
          }
        }
      }
    }
  ]
];

export function listProjectFileTools(
  port?: CadMcpProjectFilesPort
): readonly McpToolDefinition[] {
  return TOOLS.filter(([method]) => typeof port?.[method] === "function").map(
    ([, definition]) => definition
  );
}

export function isProjectFileTool(name: string): name is CadProjectToolName {
  return TOOLS.some(([, tool]) => tool.name === name);
}

export async function callProjectFileTool(
  port: CadMcpProjectFilesPort | undefined,
  name: CadProjectToolName,
  args: unknown
): Promise<CadProjectToolResult> {
  const method = TOOLS.find(([, tool]) => tool.name === name)![0];
  if (!port?.[method]) {
    return failure(
      "UNKNOWN_TOOL",
      `${name} is not available in this host. Use tools/list to discover supported tools.`
    );
  }
  const value = args === undefined ? {} : args;
  if (!isRecord(value))
    return failure("INVALID_ARGUMENTS", `${name} expects an object.`);
  if (name === "cad.session_info") {
    if (Object.keys(value).length !== 0)
      return failure("INVALID_ARGUMENTS", `${name} does not accept arguments.`);
    return port.sessionInfo!();
  }
  const allowed =
    name === "cad.project_open"
      ? ["path"]
      : name === "cad.project_save"
        ? ["path", "overwrite"]
        : ["path", "overwrite", "format", "bodyIds"];
  if (
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    typeof value.path !== "string" ||
    value.path.trim() === "" ||
    value.path.includes("\0") ||
    (value.overwrite !== undefined && typeof value.overwrite !== "boolean")
  ) {
    return failure(
      "INVALID_ARGUMENTS",
      `${name} requires a nonempty path within the workspace${name === "cad.project_open" ? "." : " and optional boolean overwrite."}`
    );
  }
  if (name === "cad.project_open")
    return port.openProject!({ path: value.path });
  const request = {
    path: value.path,
    ...(typeof value.overwrite === "boolean"
      ? { overwrite: value.overwrite }
      : {})
  };
  if (name === "cad.project_save") return port.saveProject!(request);
  if (
    value.format !== "step" ||
    (value.bodyIds !== undefined &&
      (!Array.isArray(value.bodyIds) ||
        value.bodyIds.length === 0 ||
        !value.bodyIds.every((id) => typeof id === "string" && id.length > 0) ||
        new Set(value.bodyIds).size !== value.bodyIds.length))
  ) {
    return failure(
      "INVALID_ARGUMENTS",
      `${name} requires format: 'step' and optional nonempty, unique bodyIds.`
    );
  }
  return port.exportProjectFile!({
    ...request,
    format: "step",
    ...(value.bodyIds ? { bodyIds: value.bodyIds as string[] } : {})
  });
}

function failure(code: string, message: string): CadProjectToolResult {
  return { ok: false, error: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

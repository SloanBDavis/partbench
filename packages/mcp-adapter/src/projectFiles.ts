import type { McpToolDefinition } from "./index";

export type CadProjectToolName =
  | "cad.session_info"
  | "cad.project_open"
  | "cad.project_save"
  | "cad.project_import_file"
  | "cad.assembly_make_independent"
  | "cad.project_export_file";

export interface CadProjectFileRequest {
  readonly path: string;
  readonly overwrite?: boolean;
}

export interface CadProjectExportFileRequest extends CadProjectFileRequest {
  readonly format: "step" | "dxf" | "svg";
  readonly bodyIds?: readonly string[];
  readonly assemblyIds?: readonly string[];
  readonly sketchIds?: readonly string[];
}

export interface CadProjectImportFileRequest {
  readonly path: string;
  readonly format?: "step" | "dxf" | "svg";
  readonly dryRun?: boolean;
  readonly unit?: "mm" | "cm" | "m" | "in" | "ft" | "px";
  readonly scale?: number;
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
  makeOccurrenceIndependent?(request: {
    readonly rootAssemblyId: string;
    readonly instancePath: readonly string[];
  }): Promise<CadProjectToolResult>;
  openProject?(request: {
    readonly path: string;
  }): Promise<CadProjectToolResult>;
  saveProject?(request: CadProjectFileRequest): Promise<CadProjectToolResult>;
  importProjectFile?(
    request: CadProjectImportFileRequest
  ): Promise<CadProjectToolResult>;
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
const idsProperty = {
  type: "array",
  minItems: 1,
  uniqueItems: true,
  items: { type: "string", minLength: 1 }
};

const TOOLS: readonly [keyof CadMcpProjectFilesPort, McpToolDefinition][] = [
  [
    "makeOccurrenceIndependent",
    {
      name: "cad.assembly_make_independent",
      description:
        "Make one placed body occurrence independently editable, copying shared assembly ancestors only along its occurrence path. Use cad.project_structure to find the root assembly and follow its nested instance IDs to the selected body; pass that ordered sequence as instancePath. Uses an ordinary undoable exact-body copy transaction and returns copied body/feature IDs plus the new occurrence path. Sibling occurrences keep their original definitions.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["rootAssemblyId", "instancePath"],
        properties: {
          rootAssemblyId: { type: "string", minLength: 1 },
          instancePath: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 }
          }
        }
      }
    }
  ],
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
    "importProjectFile",
    {
      name: "cad.project_import_file",
      description:
        "Import STEP parts/assemblies or supported DXF/SVG sketch curves into the current document through ordinary editable CADOps. Infer format from .step/.stp/.dxf/.svg, or specify it explicitly. dryRun validates without committing; failures leave the document intact. For sketch files only, unit overrides source units and scale applies an additional positive scale. Unitless DXF requires unit. Native .wcad uses cad.project_open. Returns compact created IDs, source identity, and warnings, never BRep bytes.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["path"],
        properties: {
          path: pathProperty,
          format: { enum: ["step", "dxf", "svg"] },
          dryRun: { type: "boolean", default: false },
          unit: { enum: ["mm", "cm", "m", "in", "ft", "px"] },
          scale: { type: "number", exclusiveMinimum: 0 }
        },
        allOf: [
          {
            if: {
              properties: { format: { const: "step" } },
              required: ["format"]
            },
            then: {
              not: { anyOf: [{ required: ["unit"] }, { required: ["scale"] }] }
            }
          }
        ]
      }
    }
  ],
  [
    "exportProjectFile",
    {
      name: "cad.project_export_file",
      description:
        "Write exact AP242 STEP geometry with bodyIds or assemblyIds, or supported local 2D DXF/SVG geometry with sketchIds. Selectors must match the format and cannot be mixed. Omitted selectors export the applicable document geometry. Reports sketch metadata omissions; native .wcad retains full source/history. Returns artifact metadata, never mesh substitutes or browser downloads. Existing files require overwrite: true.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["path", "format"],
        properties: {
          ...writeProperties,
          format: { enum: ["step", "dxf", "svg"] },
          bodyIds: idsProperty,
          assemblyIds: idsProperty,
          sketchIds: idsProperty
        },
        oneOf: [
          {
            properties: { format: { const: "step" } },
            not: {
              anyOf: [
                { required: ["sketchIds"] },
                { required: ["bodyIds", "assemblyIds"] }
              ]
            }
          },
          {
            properties: { format: { enum: ["dxf", "svg"] } },
            not: {
              anyOf: [{ required: ["bodyIds"] }, { required: ["assemblyIds"] }]
            }
          }
        ]
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
  if (name === "cad.assembly_make_independent") {
    if (
      Object.keys(value).some(
        (key) => !["rootAssemblyId", "instancePath"].includes(key)
      ) ||
      typeof value.rootAssemblyId !== "string" ||
      value.rootAssemblyId.trim() === "" ||
      !Array.isArray(value.instancePath) ||
      value.instancePath.length === 0 ||
      value.instancePath.some(
        (id) => typeof id !== "string" || id.trim() === ""
      )
    )
      return failure(
        "INVALID_ARGUMENTS",
        "Provide an existing rootAssemblyId and a nonempty instancePath of source instance IDs."
      );
    return port.makeOccurrenceIndependent!({
      rootAssemblyId: value.rootAssemblyId,
      instancePath: value.instancePath as string[]
    });
  }
  const allowed =
    name === "cad.project_open"
      ? ["path"]
      : name === "cad.project_save"
        ? ["path", "overwrite"]
        : name === "cad.project_import_file"
          ? ["path", "format", "dryRun", "unit", "scale"]
          : [
              "path",
              "overwrite",
              "format",
              "bodyIds",
              "assemblyIds",
              "sketchIds"
            ];
  if (
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    typeof value.path !== "string" ||
    value.path.trim() === "" ||
    value.path.includes("\0") ||
    (value.overwrite !== undefined && typeof value.overwrite !== "boolean")
  ) {
    return failure(
      "INVALID_ARGUMENTS",
      `${name} requires a nonempty workspace path and only the arguments advertised in tools/list.`
    );
  }
  if (name === "cad.project_open")
    return port.openProject!({ path: value.path });
  if (name === "cad.project_import_file") {
    const inferred = /\.([^./\\]+)$/.exec(value.path)?.[1]?.toLowerCase();
    const format = value.format ?? (inferred === "stp" ? "step" : inferred);
    if (
      (value.format !== undefined &&
        (typeof value.format !== "string" ||
          !["step", "dxf", "svg"].includes(value.format))) ||
      (value.dryRun !== undefined && typeof value.dryRun !== "boolean") ||
      (value.unit !== undefined &&
        (typeof value.unit !== "string" ||
          !["mm", "cm", "m", "in", "ft", "px"].includes(value.unit))) ||
      (value.scale !== undefined &&
        (typeof value.scale !== "number" ||
          !Number.isFinite(value.scale) ||
          value.scale <= 0)) ||
      (format === "step" &&
        (value.unit !== undefined || value.scale !== undefined))
    )
      return failure(
        "INVALID_ARGUMENTS",
        "Import accepts format step/dxf/svg, boolean dryRun, and optional sketch-only unit and positive finite scale."
      );
    return port.importProjectFile!({
      path: value.path,
      ...(value.format !== undefined
        ? { format: value.format as "step" | "dxf" | "svg" }
        : {}),
      ...(value.dryRun !== undefined
        ? { dryRun: value.dryRun as boolean }
        : {}),
      ...(value.unit !== undefined
        ? { unit: value.unit as CadProjectImportFileRequest["unit"] }
        : {}),
      ...(value.scale !== undefined ? { scale: value.scale as number } : {})
    });
  }
  const request = {
    path: value.path,
    ...(typeof value.overwrite === "boolean"
      ? { overwrite: value.overwrite }
      : {})
  };
  if (name === "cad.project_save") return port.saveProject!(request);
  if (
    typeof value.format !== "string" ||
    !["step", "dxf", "svg"].includes(value.format) ||
    [value.bodyIds, value.assemblyIds, value.sketchIds].some(
      (ids) => ids !== undefined && !validIds(ids)
    ) ||
    (value.format === "step" &&
      (value.sketchIds !== undefined ||
        (value.bodyIds !== undefined && value.assemblyIds !== undefined))) ||
    (value.format !== "step" &&
      (value.bodyIds !== undefined || value.assemblyIds !== undefined))
  ) {
    return failure(
      "INVALID_ARGUMENTS",
      `${name} requires format step/dxf/svg and optional nonempty, unique matching selectors: bodyIds or assemblyIds for STEP; sketchIds for DXF/SVG.`
    );
  }
  return port.exportProjectFile!({
    ...request,
    format: value.format as "step" | "dxf" | "svg",
    ...(value.bodyIds ? { bodyIds: value.bodyIds as string[] } : {}),
    ...(value.assemblyIds
      ? { assemblyIds: value.assemblyIds as string[] }
      : {}),
    ...(value.sketchIds ? { sketchIds: value.sketchIds as string[] } : {})
  });
}

function validIds(ids: unknown): ids is string[] {
  return (
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.every((id) => typeof id === "string" && id.trim().length > 0) &&
    new Set(ids).size === ids.length
  );
}

function failure(code: string, message: string): CadProjectToolResult {
  return { ok: false, error: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

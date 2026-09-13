import type { CadOp } from "@web-cad/cad-protocol";
import {
  CAD_PARAMETER_EXPRESSION_HELP,
  CAD_EXPRESSION_PARAMETER_ID_HELP
} from "./operationSchemaHelp";
import { batchSchema, operationSchemas } from "./operationSchemas.generated";

/** Structural discovery only. Canonical command validation owns acceptance. */
export type OperationSchema =
  | boolean
  | {
      readonly type?: string;
      readonly const?: string | number | boolean | null;
      readonly enum?: readonly (string | number | boolean | null)[];
      readonly anyOf?: readonly OperationSchema[];
      readonly properties?: Readonly<Record<string, OperationSchema>>;
      readonly required?: readonly string[];
      readonly additionalProperties?: OperationSchema;
      readonly items?: OperationSchema | readonly OperationSchema[];
      readonly additionalItems?: OperationSchema;
      readonly minItems?: number;
      readonly maxItems?: number;
      readonly description?: string;
    };
export interface CadRequestDiagnostic {
  readonly path: string;
  readonly code:
    | "INVALID_TYPE"
    | "MISSING_FIELD"
    | "UNKNOWN_FIELD"
    | "INVALID_VALUE"
    | "UNKNOWN_OPERATION"
    | "INVALID_OPERATION";
  readonly message: string;
  readonly operation?: string;
}

export const CAD_OPERATION_NAMES = Object.keys(
  operationSchemas
) as CadOp["op"][];
export function getCadOperationSchema(
  operation: string
): OperationSchema | undefined {
  const schema = Object.hasOwn(operationSchemas, operation)
    ? operationSchemas[operation as CadOp["op"]]
    : undefined;
  if (
    operation === "parameter.setExpression" &&
    schema &&
    typeof schema !== "boolean"
  ) {
    const expression = schema.properties?.expression;
    const id = schema.properties?.id;
    if (
      expression &&
      typeof expression !== "boolean" &&
      id &&
      typeof id !== "boolean"
    ) {
      return {
        ...schema,
        properties: {
          ...schema.properties,
          id: { ...id, description: CAD_EXPRESSION_PARAMETER_ID_HELP },
          expression: {
            ...expression,
            description: CAD_PARAMETER_EXPRESSION_HELP
          }
        }
      };
    }
  }
  return schema;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Explains a rejection, never grants permission or replaces a protocol validator. */
export function diagnoseSchema(
  value: unknown,
  schema: OperationSchema,
  path = "$"
): CadRequestDiagnostic[] {
  const issue = (
    code: CadRequestDiagnostic["code"],
    message: string
  ): CadRequestDiagnostic[] => [{ path, code, message }];
  if (schema === true) return [];
  if (schema === false)
    return issue(
      "INVALID_VALUE",
      "This field is not allowed for this command variant."
    );
  if ("const" in schema && value !== schema.const)
    return issue("INVALID_VALUE", `Expected ${JSON.stringify(schema.const)}.`);
  if (schema.enum && !schema.enum.some((item) => item === value))
    return issue(
      "INVALID_VALUE",
      `Expected one of ${schema.enum.map((item) => JSON.stringify(item)).join(", ")}.`
    );
  if (schema.anyOf) {
    // First select compatible discriminators to avoid irrelevant errors from other variants.
    const compatible = schema.anyOf.filter((variant) => {
      if (typeof variant === "boolean") return true;
      if (variant.type === "object" && !record(value)) return false;
      if (variant.type === "array" && !Array.isArray(value)) return false;
      if (
        ["number", "string", "boolean"].includes(variant.type ?? "") &&
        typeof value !== variant.type
      )
        return false;
      if (!record(value) || !variant.properties) return true;
      return Object.entries(variant.properties).every(
        ([key, property]) =>
          !(key in value) ||
          typeof property === "boolean" ||
          !("const" in property) ||
          property.const === value[key]
      );
    });
    const candidates = (compatible.length ? compatible : schema.anyOf).map(
      (variant) => diagnoseSchema(value, variant, path)
    );
    return candidates.sort((a, b) => a.length - b.length)[0] ?? [];
  }
  if (schema.type === "null" && value !== null)
    return issue("INVALID_TYPE", "Expected null.");
  if (schema.type === "string" && typeof value !== "string")
    return issue("INVALID_TYPE", "Expected a string.");
  if (schema.type === "boolean" && typeof value !== "boolean")
    return issue("INVALID_TYPE", "Expected a boolean.");
  if (
    schema.type === "number" &&
    (typeof value !== "number" || !Number.isFinite(value))
  )
    return issue("INVALID_TYPE", "Expected a finite number.");
  if (schema.type === "object") {
    if (!record(value)) return issue("INVALID_TYPE", "Expected an object.");
    const issues: CadRequestDiagnostic[] = [];
    for (const key of schema.required ?? []) {
      if (!(key in value) || value[key] === undefined)
        issues.push({
          path: `${path}.${key}`,
          code: "MISSING_FIELD",
          message: "Required field is missing."
        });
    }
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined) continue;
      const childSchema =
        schema.properties && Object.hasOwn(schema.properties, key)
          ? schema.properties[key]
          : undefined;
      if (childSchema !== undefined)
        issues.push(...diagnoseSchema(child, childSchema, `${path}.${key}`));
      else if (schema.additionalProperties === false)
        issues.push({
          path: `${path}.${key}`,
          code: "UNKNOWN_FIELD",
          message:
            "Unknown field. Query cad.operation_schema for the accepted fields."
        });
      else if (schema.additionalProperties)
        issues.push(
          ...diagnoseSchema(
            child,
            schema.additionalProperties,
            `${path}.${key}`
          )
        );
      if (issues.length >= 20) break;
    }
    return issues.slice(0, 20);
  }
  if (schema.type === "array") {
    if (!Array.isArray(value))
      return issue("INVALID_TYPE", "Expected an array.");
    if (schema.minItems !== undefined && value.length < schema.minItems)
      return issue(
        "INVALID_VALUE",
        `Expected at least ${schema.minItems} items.`
      );
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      return issue(
        "INVALID_VALUE",
        `Expected at most ${schema.maxItems} items.`
      );
    const issues: CadRequestDiagnostic[] = [];
    for (let index = 0; index < value.length && issues.length < 20; index++) {
      const itemSchema = Array.isArray(schema.items)
        ? (schema.items[index] ?? schema.additionalItems)
        : schema.items;
      if (itemSchema !== undefined)
        issues.push(
          ...diagnoseSchema(
            value[index],
            itemSchema as OperationSchema,
            `${path}[${index}]`
          )
        );
    }
    return issues.slice(0, 20);
  }
  return [];
}

export function diagnoseCadBatch(
  value: unknown,
  path = "$.batch"
): CadRequestDiagnostic[] {
  const issues = diagnoseSchema(value, batchSchema, path);
  if (record(value) && Array.isArray(value.ops)) {
    for (
      let index = 0;
      index < value.ops.length && issues.length < 20;
      index++
    ) {
      const operation = value.ops[index];
      if (!record(operation) || typeof operation.op !== "string") {
        issues.push({
          path: `${path}.ops[${index}].op`,
          code: "MISSING_FIELD",
          message: "Expected a supported operation name."
        });
        continue;
      }
      const schema = getCadOperationSchema(operation.op);
      if (!schema)
        issues.push({
          path: `${path}.ops[${index}].op`,
          code: "UNKNOWN_OPERATION",
          message:
            "Unknown operation. Call cad.operation_schema with no arguments to list supported names.",
          operation: operation.op
        });
      else
        issues.push(
          ...diagnoseSchema(operation, schema, `${path}.ops[${index}]`).map(
            (issue) => ({ ...issue, operation: operation.op as string })
          )
        );
    }
  }
  return issues.slice(0, 20);
}

export class CadAgentRequestValidationError extends Error {
  constructor(readonly diagnostics: readonly CadRequestDiagnostic[]) {
    super(
      `Invalid CADOps agent adapter request.${diagnostics[0] ? ` ${diagnostics[0].path}: ${diagnostics[0].message}` : ""}`
    );
    this.name = "CadAgentRequestValidationError";
  }
}

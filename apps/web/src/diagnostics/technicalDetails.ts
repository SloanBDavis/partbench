import type { StructuredDiagnosticInput } from "./userDiagnostic";

export interface TechnicalDetailsModel {
  readonly label: "Technical Details";
  readonly value: Readonly<Record<string, unknown>>;
  readonly copyText: string;
}

/**
 * Keeps debugging evidence behind an explicit disclosure. The allowlist avoids
 * accidentally copying unrelated objects such as document source or handles.
 */
export function createTechnicalDetails(
  diagnostic: StructuredDiagnosticInput
): TechnicalDetailsModel {
  const value: Record<string, unknown> = {};
  if (diagnostic.code) value.code = diagnostic.code;
  if (diagnostic.severity) value.severity = diagnostic.severity;
  if (diagnostic.message) value.message = diagnostic.message;
  if (diagnostic.detail !== undefined) value.detail = diagnostic.detail;
  if (diagnostic.context !== undefined) value.context = diagnostic.context;

  const normalized = normalizeForDisplay(value) as Readonly<
    Record<string, unknown>
  >;
  return {
    label: "Technical Details",
    value: normalized,
    copyText: JSON.stringify(normalized, null, 2)
  };
}

export async function copyTechnicalDetails(
  details: TechnicalDetailsModel,
  clipboard: Pick<Clipboard, "writeText"> | undefined = typeof navigator ===
  "undefined"
    ? undefined
    : navigator.clipboard
): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(details.copyText);
    return true;
  } catch {
    return false;
  }
}

function normalizeForDisplay(
  value: unknown,
  seen: WeakSet<object> = new WeakSet()
): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined") return "undefined";
  if (typeof value === "function" || typeof value === "symbol") {
    return String(value);
  }
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForDisplay(entry, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      normalizeForDisplay(entry, seen)
    ])
  );
}

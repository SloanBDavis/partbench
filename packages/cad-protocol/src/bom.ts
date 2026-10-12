import type { AssemblyDefinitionRef } from "./index";

export interface BomItemMetadata {
  readonly partNumber: string;
  readonly description: string;
  readonly material: string;
}
export interface BomCatalogEntry extends BomItemMetadata {
  readonly definition: AssemblyDefinitionRef;
  /** Document-owned numbering, retained when counts/order change. */
  readonly itemNumber: number;
}
export interface BomCatalog {
  readonly nextItemNumber: number;
  readonly entries: readonly BomCatalogEntry[];
}
export interface BomItemUpdateOp {
  readonly op: "assembly.bom.updateItem";
  readonly definition: AssemblyDefinitionRef;
  readonly metadata: BomItemMetadata;
}
export type BomMode = "hierarchical" | "flattened";
export interface BomRow extends BomCatalogEntry {
  readonly rowId: string;
  readonly parentRowId?: string;
  readonly depth: number;
  readonly name: string;
  /** Quantity within its immediate parent (or overall quantity in flattened mode). */
  readonly quantity: number;
  readonly totalQuantity: number;
}
export interface AssemblyBom {
  readonly assemblyId: string;
  readonly assemblyName: string;
  readonly mode: BomMode;
  readonly rows: readonly BomRow[];
}
export const bomDefinitionKey = (ref: AssemblyDefinitionRef): string =>
  ref.kind === "body" ? `body:${ref.bodyId}` : `assembly:${ref.assemblyId}`;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export function isBomDefinition(
  value: unknown
): value is AssemblyDefinitionRef {
  return (
    record(value) &&
    (value.kind === "body" || value.kind === "assembly") &&
    Object.keys(value).every((key) =>
      ["kind", value.kind === "body" ? "bodyId" : "assemblyId"].includes(key)
    ) &&
    typeof value[value.kind === "body" ? "bodyId" : "assemblyId"] ===
      "string" &&
    (value[value.kind === "body" ? "bodyId" : "assemblyId"] as string).trim()
      .length > 0
  );
}
export function isBomMetadata(value: unknown): value is BomItemMetadata {
  return (
    record(value) &&
    Object.keys(value).every((key) =>
      ["partNumber", "description", "material"].includes(key)
    ) &&
    ["partNumber", "description", "material"].every(
      (key) =>
        typeof value[key] === "string" &&
        (value[key] as string).length <= 500 &&
        [...(value[key] as string)].every(
          (character) =>
            character.charCodeAt(0) >= 32 ||
            [9, 10, 13].includes(character.charCodeAt(0))
        )
    )
  );
}
export function isBomItemUpdateOp(value: unknown): value is BomItemUpdateOp {
  return (
    record(value) &&
    value.op === "assembly.bom.updateItem" &&
    Object.keys(value).every((key) =>
      ["op", "definition", "metadata"].includes(key)
    ) &&
    isBomDefinition(value.definition) &&
    isBomMetadata(value.metadata)
  );
}
export function isBomCatalog(value: unknown): value is BomCatalog {
  if (
    !record(value) ||
    !Number.isSafeInteger(value.nextItemNumber) ||
    (value.nextItemNumber as number) < 1 ||
    !Array.isArray(value.entries)
  )
    return false;
  const keys = new Set<string>(),
    numbers = new Set<number>();
  for (const entry of value.entries) {
    if (
      !record(entry) ||
      !isBomDefinition(entry.definition) ||
      !Number.isSafeInteger(entry.itemNumber) ||
      (entry.itemNumber as number) < 1 ||
      (entry.itemNumber as number) >= (value.nextItemNumber as number) ||
      !isBomMetadata({
        partNumber: entry.partNumber,
        description: entry.description,
        material: entry.material
      })
    )
      return false;
    const key = bomDefinitionKey(entry.definition);
    if (keys.has(key) || numbers.has(entry.itemNumber as number)) return false;
    keys.add(key);
    numbers.add(entry.itemNumber as number);
  }
  return true;
}

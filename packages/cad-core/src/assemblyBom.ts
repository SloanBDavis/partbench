import {
  bomDefinitionKey,
  type AssemblyDefinitionRef,
  type AssemblySnapshot,
  type CadBodySnapshot,
  type BomCatalog,
  type BomMode,
  type BomRow,
  type AssemblyBom
} from "@web-cad/cad-protocol";

/** Number definitions once. Retain unused entries so deletion never renumbers survivors
 * or recycles a number; undo/native reopen preserve the same catalog. */
export function synchronizeBomCatalog(
  catalog: BomCatalog | undefined,
  assemblies: readonly AssemblySnapshot[]
): BomCatalog | undefined {
  const entries = [...(catalog?.entries ?? [])];
  let nextItemNumber = catalog?.nextItemNumber ?? 1;
  const known = new Set(
    entries.map((entry) => bomDefinitionKey(entry.definition))
  );
  const add = (definition: AssemblyDefinitionRef) => {
    const key = bomDefinitionKey(definition);
    if (known.has(key)) return;
    if (!Number.isSafeInteger(nextItemNumber + 1))
      throw new Error("BOM item number limit reached.");
    entries.push({
      definition: { ...definition },
      itemNumber: nextItemNumber++,
      partNumber: "",
      description: "",
      material: ""
    });
    known.add(key);
  };
  for (const assembly of assemblies) {
    add({ kind: "assembly", assemblyId: assembly.id });
    for (const instance of assembly.instances) add(instance.definition);
  }
  return entries.length ? { nextItemNumber, entries } : undefined;
}

export function createAssemblyBom(input: {
  assemblyId: string;
  mode: BomMode;
  assemblies: readonly AssemblySnapshot[];
  bodies: readonly CadBodySnapshot[];
  catalog?: BomCatalog;
}): AssemblyBom {
  const assemblies = new Map(input.assemblies.map((a) => [a.id, a]));
  const bodies = new Map(input.bodies.map((b) => [b.id, b]));
  const root = assemblies.get(input.assemblyId);
  if (!root) throw new Error("Select an existing assembly.");
  const catalog = synchronizeBomCatalog(input.catalog, input.assemblies);
  const entries = new Map(
    catalog?.entries.map((e) => [bomDefinitionKey(e.definition), e])
  );
  const rows: BomRow[] = [];
  const flattened = new Map<string, BomRow>();
  const active = new Set<string>();
  let visited = 0;
  const visit = (
    assembly: AssemblySnapshot,
    parentRowId: string | undefined,
    depth: number,
    multiplier: number
  ) => {
    if (active.has(assembly.id) || depth > 128)
      throw new Error("Assembly hierarchy is cyclic or too deep for a BOM.");
    active.add(assembly.id);
    const groups = new Map<
      string,
      { definition: AssemblyDefinitionRef; quantity: number }
    >();
    for (const instance of assembly.instances) {
      const key = bomDefinitionKey(instance.definition);
      const group = groups.get(key);
      if (group) group.quantity++;
      else groups.set(key, { definition: instance.definition, quantity: 1 });
    }
    for (const [key, group] of groups) {
      if (++visited > 100000)
        throw new Error("Assembly BOM exceeds 100,000 rows.");
      const entry = entries.get(key)!;
      const definition = group.definition;
      const child =
        definition.kind === "assembly"
          ? assemblies.get(definition.assemblyId)
          : undefined;
      const body =
        definition.kind === "body" ? bodies.get(definition.bodyId) : undefined;
      if (!entry || (!child && !body))
        throw new Error(`BOM definition is unavailable: ${key}`);
      const totalQuantity = group.quantity * multiplier;
      if (!Number.isSafeInteger(totalQuantity))
        throw new Error("Assembly quantity exceeds the safe integer limit.");
      const rowId = `${parentRowId ? parentRowId + "/" : ""}${encodeURIComponent(key)}`;
      const row: BomRow = {
        ...entry,
        definition: { ...definition },
        rowId,
        ...(parentRowId ? { parentRowId } : {}),
        depth,
        name:
          child?.name ??
          body?.name ??
          (definition.kind === "body"
            ? definition.bodyId
            : definition.assemblyId),
        quantity: group.quantity,
        totalQuantity
      };
      if (input.mode === "hierarchical") rows.push(row);
      if (child) visit(child, rowId, depth + 1, totalQuantity);
      else if (input.mode === "flattened") {
        const previous = flattened.get(key);
        const quantity = (previous?.quantity ?? 0) + totalQuantity;
        if (!Number.isSafeInteger(quantity))
          throw new Error("Assembly quantity exceeds the safe integer limit.");
        flattened.set(key, {
          ...row,
          rowId: key,
          parentRowId: undefined,
          depth: 0,
          quantity,
          totalQuantity: quantity
        });
      }
    }
    active.delete(assembly.id);
  };
  visit(root, undefined, 0, 1);
  return {
    assemblyId: root.id,
    assemblyName: root.name,
    mode: input.mode,
    rows:
      input.mode === "flattened"
        ? [...flattened.values()].sort((a, b) => a.itemNumber - b.itemNumber)
        : rows
  };
}

/** RFC 4180 plus spreadsheet formula neutralization for user-authored metadata. */
export function exportAssemblyBomCsv(bom: AssemblyBom): string {
  const cell = (value: string | number) => {
    let text = String(value);
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const parents = new Map(bom.rows.map((row) => [row.rowId, row.itemNumber]));
  return (
    [
      [
        "Item",
        "Level",
        "Parent item",
        "Type",
        "Name",
        "Part number",
        "Description",
        "Material",
        "Quantity",
        "Total quantity"
      ],
      ...bom.rows.map((row) => [
        row.itemNumber,
        row.depth + 1,
        (row.parentRowId ? parents.get(row.parentRowId) : undefined) ?? "",
        row.definition.kind,
        row.name,
        row.partNumber,
        row.description,
        row.material,
        row.quantity,
        row.totalQuantity
      ])
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n") + "\r\n"
  );
}

# Bill of materials

Open **Bill of materials** from the assembly controls. Choose an assembly and
switch between **Hierarchical** and **Flattened parts**. Hierarchical quantity
is local to the parent; total quantity includes repeated subassemblies.
Flattened reports group body definitions across the entire assembly tree.
A multi-solid body counts as one part occurrence.

Select a row to edit its part number, description and material, then save.
Details belong to the definition, so every occurrence shares them. Undo/Redo
and native WCAD save/reopen preserve the edits. Export CSV saves the current
report with quoted fields and spreadsheet formula neutralization.

Item numbers are document-owned and stable through insertion, deletion,
reordering and occurrence movement. Deleted entries retain their numbers;
new definitions receive new numbers. Making an occurrence independent creates
a separate definition and item. A consuming feature that replaces a definition
carries its item number and metadata to the resulting body.

## Public command contract

`assembly.bom.updateItem` accepts an existing assembly-member definition and
`metadata: { partNumber, description, material }`. Each string allows up to
500 characters. Operations use normal atomic batches, dry runs and history.

The existing `cad.project_structure` tool accepts:

```json
{
  "projection": "bom",
  "assemblyIds": ["assembly_id"],
  "bomMode": "flattened"
}
```

Exactly one assembly is required; `bomMode` defaults to `hierarchical`.
`billOfMaterials.rows` exposes stable item numbers, definition references,
metadata, row/parent identity, depth, local quantity and total quantity.
This extends the existing query and additive native document metadata; it
introduces no tool, dependency or native format version.

## Verification

The consolidated editable-interchange browser journey exercises actual BOM
controls on an imported nested assembly, metadata editing, blocked unchanged
save, Undo/Redo, both report views, CSV export, an independent occurrence and
native reopen. The existing public MCP journeys cover multiplied nested
quantities, metadata schemas, dry run, atomic rejection, invalid metadata,
assembly deletion/reinsertion, numbering stability and native reopen.

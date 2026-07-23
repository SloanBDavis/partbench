import type {
  DocumentTreeGroup,
  DocumentTreeRow
} from "./documentTreeProjection";

export function toggleTreeExpansion(
  current: ReadonlySet<string>,
  id: string,
  next = !current.has(id)
): ReadonlySet<string> {
  const updated = new Set(current);
  if (next) updated.add(id);
  else updated.delete(id);
  return updated;
}

export function collectVisibleRowIds(
  groups: readonly DocumentTreeGroup[],
  expandedIds: ReadonlySet<string>
): readonly string[] {
  const visible: string[] = [];
  for (const group of groups) {
    if (!expandedIds.has(`group:${group.id}`)) continue;
    for (const row of group.rows) collectVisibleRow(row, expandedIds, visible);
  }
  return visible;
}

function collectVisibleRow(
  row: DocumentTreeRow,
  expandedIds: ReadonlySet<string>,
  target: string[]
) {
  target.push(row.id);
  if (!expandedIds.has(row.id)) return;
  for (const child of row.children)
    collectVisibleRow(child, expandedIds, target);
}

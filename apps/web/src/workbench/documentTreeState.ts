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

/**
 * Resolves which tree rows should appear selected. Prefer explicit
 * `selectedKeys` from App. When App remaps a feature click to its body, keep
 * highlighting the row the user actually clicked if it owns that body.
 */
export function resolveDocumentTreeSelectedKeys(input: {
  readonly selectedKey?: string;
  readonly selectedKeys?: readonly string[];
  readonly clickedRowId?: string;
  readonly rowsById: ReadonlyMap<string, DocumentTreeRow>;
}): ReadonlySet<string> {
  const keys = new Set<string>();
  if (input.selectedKey) keys.add(input.selectedKey);
  for (const key of input.selectedKeys ?? []) keys.add(key);

  const clicked = input.clickedRowId;
  if (clicked && input.rowsById.has(clicked)) {
    const selectedKey = input.selectedKey;
    if (
      !selectedKey ||
      selectedKey === clicked ||
      rowOwnsKey(input.rowsById.get(clicked), selectedKey)
    ) {
      keys.add(clicked);
      // Prefer the clicked owner over a remapped child body highlight.
      if (
        selectedKey &&
        selectedKey !== clicked &&
        rowOwnsKey(input.rowsById.get(clicked), selectedKey)
      ) {
        keys.delete(selectedKey);
      }
    }
  }

  return keys;
}

/**
 * Resolves editing badge keys. Tolerates App passing `feature:${sketchId}`
 * when the active editor source is actually a sketch.
 */
export function resolveDocumentTreeEditingKeys(input: {
  readonly editingKey?: string;
  readonly editingKeys?: readonly string[];
  readonly rowsById: ReadonlyMap<string, DocumentTreeRow>;
}): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const key of input.editingKeys ?? []) {
    if (input.rowsById.has(key)) keys.add(key);
  }
  if (input.editingKey) {
    for (const candidate of editingKeyCandidates(input.editingKey)) {
      if (input.rowsById.has(candidate)) keys.add(candidate);
    }
  }
  return keys;
}

function editingKeyCandidates(editingKey: string): readonly string[] {
  const candidates = [editingKey];
  const featureMatch = /^feature:(.+)$/.exec(editingKey);
  if (featureMatch?.[1]) {
    candidates.push(`sketch:${featureMatch[1]}`);
  }
  const sketchMatch = /^sketch:(.+)$/.exec(editingKey);
  if (sketchMatch?.[1]) {
    candidates.push(`feature:${sketchMatch[1]}`);
  }
  return candidates;
}

function rowOwnsKey(row: DocumentTreeRow | undefined, key: string): boolean {
  if (!row) return false;
  if (row.id === key) return true;
  return row.children.some((child) => rowOwnsKey(child, key));
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

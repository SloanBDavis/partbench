/** Split supported solid STEP graphs before native transfer. Each file retains
 * the complete product/placement/presentation graph. Unassigned solid items
 * become distinct point placeholders; only original solid geometry is accepted
 * from a worker. OCCT still resolves every placement, unit, name and color.
 * Unsupported layouts use the unchanged whole-file reader.
 */
export function partitionStepImport(
  bytes: Uint8Array,
  count: number,
  previewFirst = false
):
  | {
      partitions: Uint8Array[];
      definitionCount: number;
    }
  | undefined {
  if (
    !Number.isInteger(count) ||
    count < 2 ||
    bytes.byteLength < 2 * 1024 * 1024
  )
    return;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return;
  }
  const masked = text.replace(/'(?:[^']|'')*'|\/\*[\s\S]*?\*\//g, (s) =>
    " ".repeat(s.length)
  );
  const data = /\bDATA\s*;/i.exec(masked);
  if (!data || [...masked.matchAll(/\bDATA\s*;/gi)].length !== 1) return;
  const dataStart = data.index + data[0].length;
  const ending = /\bENDSEC\s*;\s*END-ISO-10303-21\s*;\s*$/i.exec(masked);
  if (!ending || ending.index < dataStart) return;
  const body = masked.slice(dataStart, ending.index);
  let cursor = 0;
  const records = new Map<
    number,
    { text: string; masked: string; refs: number[] }
  >();
  for (const m of body.matchAll(/#(\d+)\s*=([^;]*);/g)) {
    // Never repair malformed input by dropping text around recognized records.
    if (body.slice(cursor, m.index).trim()) return;
    cursor = m.index + m[0].length;
    const id = Number(m[1]);
    if (!Number.isSafeInteger(id) || id < 1 || records.has(id)) return;
    records.set(id, {
      text: text.slice(dataStart + m.index, dataStart + cursor),
      masked: m[2]!,
      refs: [...m[2]!.matchAll(/#(\d+)/g)].map((r) => Number(r[1]))
    });
  }
  if (body.slice(cursor).trim()) return;
  const leaves: {
    id: number;
    solids: number[];
    weight: number;
  }[] = [];
  for (const [id, record] of records) {
    const type = /^\s*(\w+)\s*\(/.exec(record.masked)?.[1];
    if (!type && /\b\w*SHAPE_REPRESENTATION\s*\(/.test(record.masked)) return;
    if (!type?.endsWith("SHAPE_REPRESENTATION")) continue;
    if (type === "CONTEXT_DEPENDENT_SHAPE_REPRESENTATION") continue;
    if (
      type !== "ADVANCED_BREP_SHAPE_REPRESENTATION" &&
      type !== "SHAPE_REPRESENTATION"
    )
      return;
    const items = /^\s*\w+\s*\([^,]*,\s*\(([^()]*)\)\s*,\s*#\d+\s*\)\s*$/.exec(
      record.masked
    )?.[1];
    if (items === undefined) return;
    const solids: number[] = [];
    for (const ref of items.matchAll(/#(\d+)/g)) {
      const item = Number(ref[1]);
      const value = records.get(item)?.masked ?? "";
      if (/^\s*AXIS2_PLACEMENT_3D\s*\(/.test(value)) continue;
      if (
        type !== "ADVANCED_BREP_SHAPE_REPRESENTATION" ||
        !/^\s*MANIFOLD_SOLID_BREP\s*\(/.test(value)
      )
        return;
      solids.push(item);
    }
    if (type === "ADVANCED_BREP_SHAPE_REPRESENTATION") {
      if (!solids.length) return;
      const seen = new Set<number>(),
        pending = [...solids];
      let weight = 0;
      while (pending.length) {
        const ref = pending.pop()!;
        if (seen.has(ref)) continue;
        const value = records.get(ref);
        if (!value) return;
        seen.add(ref);
        // Transfer, validation and meshing have a substantial per-face cost
        // independent of text size. Balance that work as well as spline data.
        weight +=
          value.text.length +
          (/^\s*ADVANCED_FACE\s*\(/.test(value.masked) ? 8192 : 0) +
          (/^\s*TOROIDAL_SURFACE\s*\(/.test(value.masked) ? 128 * 1024 : 0);
        pending.push(...value.refs);
      }
      leaves.push({ id, solids, weight });
    }
  }
  if (leaves.length < 8) return;
  count = Math.min(count, leaves.length - (previewFirst ? 1 : 0));
  const ownership = new Set<number>();
  const sizes = Array.from({ length: count }, () => 0);
  const groups = new Map<number, number>();
  const ordered = [...leaves].sort((a, b) => a.weight - b.weight);
  if (previewFirst) {
    // The first definition provides immediate feedback without delaying any
    // of the main transfer batches. Complex curved surfaces are weighted above.
    groups.set(ordered[0]!.id, 0);
  }
  const offset = previewFirst ? 1 : 0;
  for (const leaf of ordered.reverse()) {
    if (!groups.has(leaf.id)) {
      const group = sizes.indexOf(Math.min(...sizes));
      sizes[group]! += leaf.weight;
      groups.set(leaf.id, offset + group);
    }
    for (const solid of leaf.solids) {
      // Shared representation geometry can change XDE's definition deduplication.
      if (ownership.has(solid)) return;
      ownership.add(solid);
    }
  }
  // Keep all non-geometric roots, including inverse presentation/metadata.
  // Reachability then drops only the disconnected geometry behind placeholders.
  const referenced = new Set([...records.values()].flatMap((r) => r.refs));
  const roots = [...records.keys()].filter((id) => !referenced.has(id));
  const encoder = new TextEncoder();
  const partitions: Uint8Array[] = [];
  for (let group = 0; group < count + offset; group++) {
    const replacements = new Map<number, { text: string; refs: number[] }>();
    for (const leaf of leaves) {
      if (groups.get(leaf.id) === group) continue;
      const record = records.get(leaf.id)!;
      replacements.set(leaf.id, {
        ...record,
        text: record.text.replace(
          /ADVANCED_BREP_SHAPE_REPRESENTATION/i,
          "SHAPE_REPRESENTATION"
        )
      });
      for (const solid of leaf.solids)
        replacements.set(solid, {
          text: `#${solid}=CARTESIAN_POINT('',(${solid}.,0.,0.));`,
          refs: []
        });
    }
    const seen = new Set<number>(),
      pending = [...roots];
    while (pending.length) {
      const id = pending.pop()!;
      if (seen.has(id)) continue;
      const record = replacements.get(id) ?? records.get(id);
      if (!record) return;
      seen.add(id);
      pending.push(...record.refs);
    }
    // Every representation must remain connected to the preserved structure.
    if (leaves.some((leaf) => !seen.has(leaf.id))) return;
    const lines = [text.slice(0, data.index + data[0].length)];
    for (const [id, record] of records)
      if (seen.has(id)) lines.push((replacements.get(id) ?? record).text);
    lines.push("ENDSEC;", "END-ISO-10303-21;");
    partitions.push(encoder.encode(lines.join("\n")));
  }
  return { partitions, definitionCount: leaves.length };
}

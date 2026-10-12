/** Partition only the derived display import. The original bytes always go to
 * the authoritative STEP reader unchanged. OCCT resolves assembly placements in
 * each partition; this code never interprets geometry or transformation values.
 */
export function partitionStepPreview(
  bytes: Uint8Array,
  count: number
): Uint8Array[] {
  if (count < 2 || bytes.byteLength < 2 * 1024 * 1024) return [bytes];
  const text = new TextDecoder().decode(bytes);
  // Strings (including doubled apostrophes) and comments can contain # or ;.
  // Mask them without changing offsets before scanning Part 21 records.
  const masked = text.replace(/'(?:[^']|'')*'|\/\*[\s\S]*?\*\//g, (value) =>
    " ".repeat(value.length)
  );
  const data = /\bDATA\s*;/i.exec(masked);
  if (!data) return [bytes];
  const header = text.slice(0, data.index + data[0].length);
  const records = new Map<
    number,
    { text: string; refs: number[]; masked: string }
  >();
  for (const match of masked.matchAll(/#(\d+)\s*=([^;]*);/g)) {
    const id = Number(match[1]);
    if (records.has(id)) return [bytes];
    records.set(id, {
      text: text.slice(match.index, match.index + match[0].length),
      masked: match[2]!,
      refs: Array.from(match[2]!.matchAll(/#(\d+)/g), (ref) => Number(ref[1]))
    });
  }
  const leaves = [...records].filter(([, record]) =>
    /^\s*(ADVANCED_BREP_SHAPE_REPRESENTATION|FACETED_BREP_SHAPE_REPRESENTATION|MANIFOLD_SURFACE_SHAPE_REPRESENTATION)\s*\(/.test(
      record.masked
    )
  );
  if (leaves.length < 8) return [bytes];
  for (const record of records.values()) {
    const type = /^\s*(\w+)\s*\(/.exec(record.masked)?.[1];
    // Complex representation entities can carry geometry through inherited
    // components. Do not duplicate that geometry across partitions.
    if (!type && /\b\w*SHAPE_REPRESENTATION\s*\(/.test(record.masked))
      return [bytes];
    if (
      type?.endsWith("SHAPE_REPRESENTATION") &&
      ![
        "SHAPE_REPRESENTATION",
        "ADVANCED_BREP_SHAPE_REPRESENTATION",
        "FACETED_BREP_SHAPE_REPRESENTATION",
        "MANIFOLD_SURFACE_SHAPE_REPRESENTATION",
        "CONTEXT_DEPENDENT_SHAPE_REPRESENTATION"
      ].includes(type)
    )
      return [bytes];
    if (type !== "SHAPE_REPRESENTATION") continue;
    const items = /^\s*\w+\s*\([^,]*,\s*\(([^()]*)\)/.exec(record.masked)?.[1];
    if (items === undefined) return [bytes];
    if (
      [...items.matchAll(/#(\d+)/g)].some(
        (ref) =>
          !/^\s*AXIS2_PLACEMENT_3D\s*\(/.test(
            records.get(Number(ref[1]))?.masked ?? ""
          )
      )
    )
      return [bytes];
  }
  const replacements = new Map<
    number,
    { text: string; refs: number[]; group: number }
  >();
  for (const [index, [id, record]] of leaves.entries()) {
    // These representation subtypes have (name, items, context). Retain their
    // coordinate systems but omit geometry assigned to another worker.
    const match =
      /^\s*\w+\s*\([^,]*,\s*\(([^()]*)\)\s*,\s*(#\d+)\s*\)\s*$/.exec(
        record.masked
      );
    if (!match) return [bytes];
    const items = Array.from(match[1]!.matchAll(/#(\d+)/g), (ref) =>
      Number(ref[1])
    );
    const retained = items.filter((ref) =>
      /^\s*AXIS2_PLACEMENT_3D\s*\(/.test(records.get(ref)?.masked ?? "")
    );
    const context = Number(match[2]!.slice(1));
    replacements.set(id, {
      text: `#${id}=SHAPE_REPRESENTATION('',(${retained.map((ref) => `#${ref}`).join(",")}),#${context});`,
      refs: [...retained, context],
      group: index % count
    });
  }
  const roots = [...records]
    .filter(([, record]) =>
      /\b(SHAPE_DEFINITION_REPRESENTATION|CONTEXT_DEPENDENT_SHAPE_REPRESENTATION|REPRESENTATION_RELATIONSHIP|SHAPE_REPRESENTATION_RELATIONSHIP)\s*\(/.test(
        record.masked
      )
    )
    .map(([id]) => id);
  if (roots.length === 0) return [bytes];
  const encoder = new TextEncoder();
  const result: Uint8Array[] = [];
  for (let group = 0; group < count; group++) {
    const seen = new Set<number>();
    const pending = [...roots];
    while (pending.length) {
      const id = pending.pop()!;
      if (seen.has(id)) continue;
      const record = records.get(id);
      if (!record) return [bytes];
      seen.add(id);
      const replacement = replacements.get(id);
      pending.push(
        ...(replacement && replacement.group !== group
          ? replacement.refs
          : record.refs)
      );
    }
    // Presentation is intentionally deferred to the exact import. Inverse
    // style references would otherwise pull excluded geometry back in.
    const lines = [header];
    for (const [id, record] of records) {
      if (!seen.has(id)) continue;
      const replacement = replacements.get(id);
      lines.push(
        replacement && replacement.group !== group
          ? replacement.text
          : record.text
      );
    }
    lines.push("ENDSEC;", "END-ISO-10303-21;");
    result.push(encoder.encode(lines.join("\n")));
  }
  return result;
}

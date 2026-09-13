import type {
  AssemblyInstanceSnapshot,
  AssemblySnapshot,
  Transform,
  Vec3
} from "@web-cad/cad-protocol";

export type AssemblyAffineMatrix = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];
export const IDENTITY_ASSEMBLY_TRANSFORM: Transform = {
  translation: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1]
};

export function assemblyTransformToMatrix(t: Transform): AssemblyAffineMatrix {
  const [x, y, z] = t.rotation,
    [sx, sy, sz] = t.scale;
  const cx = Math.cos(x),
    cy = Math.cos(y),
    cz = Math.cos(z),
    ax = Math.sin(x),
    ay = Math.sin(y),
    az = Math.sin(z);
  return [
    cz * cy * sx,
    (cz * ay * ax - az * cx) * sy,
    (cz * ay * cx + az * ax) * sz,
    t.translation[0],
    az * cy * sx,
    (az * ay * ax + cz * cx) * sy,
    (az * ay * cx - cz * ax) * sz,
    t.translation[1],
    -ay * sx,
    cy * ax * sy,
    cy * cx * sz,
    t.translation[2]
  ];
}

export function multiplyAssemblyMatrices(
  a: AssemblyAffineMatrix,
  b: AssemblyAffineMatrix
): AssemblyAffineMatrix {
  return Array.from({ length: 12 }, (_, i) => {
    const row = Math.floor(i / 4) * 4,
      col = i % 4;
    return (
      a[row]! * b[col]! +
      a[row + 1]! * b[4 + col]! +
      a[row + 2]! * b[8 + col]! +
      (col === 3 ? a[row + 3]! : 0)
    );
  }) as unknown as AssemblyAffineMatrix;
}

/** Match the document's Rz * Ry * Rx transform convention; reject shear. */
export function assemblyTransformFromMatrix(
  m: AssemblyAffineMatrix
): Transform {
  if (m.length !== 12 || !m.every(Number.isFinite))
    throw new Error(
      "Assembly transform must contain 12 finite affine coordinates."
    );
  let sx = Math.hypot(m[0], m[4], m[8]);
  const sy = Math.hypot(m[1], m[5], m[9]),
    sz = Math.hypot(m[2], m[6], m[10]);
  if (Math.min(sx, sy, sz) < 1e-12)
    throw new Error("Assembly transform cannot have a zero scale.");
  const det =
    m[0] * (m[5] * m[10] - m[6] * m[9]) -
    m[1] * (m[4] * m[10] - m[6] * m[8]) +
    m[2] * (m[4] * m[9] - m[5] * m[8]);
  if (det < 0) sx = -sx;
  const r = [
    m[0] / sx,
    m[1] / sy,
    m[2] / sz,
    m[4] / sx,
    m[5] / sy,
    m[6] / sz,
    m[8] / sx,
    m[9] / sy,
    m[10] / sz
  ];
  const ay = Math.max(-1, Math.min(1, -r[6]!));
  const rotation: Vec3 =
    Math.abs(ay) < 1 - 1e-12
      ? [Math.atan2(r[7]!, r[8]!), Math.asin(ay), Math.atan2(r[3]!, r[0]!)]
      : [Math.atan2(-r[5]!, r[4]!), Math.asin(ay), 0];
  const result: Transform = {
    translation: [m[3], m[7], m[11]],
    rotation,
    scale: [sx, sy, sz]
  };
  const rebuilt = assemblyTransformToMatrix(result);
  if (
    m.some(
      (v, i) => Math.abs(v - rebuilt[i]!) > 1e-7 * Math.max(1, Math.abs(v))
    )
  )
    throw new Error(
      "Assembly transform includes shear, which is not representable as a document transform."
    );
  return result;
}

export interface AssemblyOccurrence {
  readonly rootAssemblyId: string;
  readonly assemblyId: string;
  readonly instanceId: string;
  readonly path: readonly string[];
  readonly name: string;
  readonly bodyId: string;
  readonly transform: Transform;
  readonly color?: Vec3;
}

export function validateAssemblyHierarchy(
  assemblies: readonly AssemblySnapshot[]
): void {
  const byId = new Map(assemblies.map((a) => [a.id, a]));
  const done = new Set<string>(),
    visiting = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id))
      throw new Error(`Assembly hierarchy contains a cycle at ${id}.`);
    if (done.has(id)) return;
    const assembly = byId.get(id);
    if (!assembly) throw new Error(`Assembly definition does not exist: ${id}`);
    visiting.add(id);
    for (const i of assembly.instances)
      if (i.definition.kind === "assembly") visit(i.definition.assemblyId);
    visiting.delete(id);
    done.add(id);
  }
  for (const a of assemblies) visit(a.id);
}

export function getRootAssemblies(
  assemblies: readonly AssemblySnapshot[]
): readonly AssemblySnapshot[] {
  const nested = new Set(
    assemblies.flatMap((a) =>
      a.instances.flatMap((i) =>
        i.definition.kind === "assembly" ? [i.definition.assemblyId] : []
      )
    )
  );
  return assemblies.filter((a) => !nested.has(a.id));
}

export function flattenAssemblyOccurrences(
  assemblies: readonly AssemblySnapshot[],
  rootIds?: readonly string[]
): readonly AssemblyOccurrence[] {
  validateAssemblyHierarchy(assemblies);
  const byId = new Map(assemblies.map((a) => [a.id, a]));
  const roots = rootIds ?? getRootAssemblies(assemblies).map((a) => a.id);
  const result: AssemblyOccurrence[] = [];
  function visit(
    rootId: string,
    assemblyId: string,
    parent: AssemblyAffineMatrix,
    path: readonly string[],
    color?: Vec3
  ) {
    const assembly = byId.get(assemblyId);
    if (!assembly)
      throw new Error(`Assembly definition does not exist: ${assemblyId}`);
    for (const instance of assembly.instances) {
      const matrix = multiplyAssemblyMatrices(
        parent,
        assemblyTransformToMatrix(instance.transform)
      );
      const nextPath = [...path, instance.id],
        nextColor = instance.color ?? color;
      if (instance.definition.kind === "assembly")
        visit(
          rootId,
          instance.definition.assemblyId,
          matrix,
          nextPath,
          nextColor
        );
      else {
        if (result.length >= 1_000_000)
          throw new Error(
            "Assembly occurrence expansion exceeds the one-million-instance work budget."
          );
        result.push({
          rootAssemblyId: rootId,
          assemblyId,
          instanceId: instance.id,
          path: nextPath,
          name: instance.name,
          bodyId: instance.definition.bodyId,
          transform: assemblyTransformFromMatrix(matrix),
          ...(nextColor ? { color: nextColor } : {})
        });
      }
    }
  }
  for (const id of roots)
    visit(id, id, assemblyTransformToMatrix(IDENTITY_ASSEMBLY_TRANSFORM), []);
  return result;
}

/** Resolve a rendered occurrence path back to its authoritative instance. */
export function resolveAssemblyOccurrence(
  assemblies: readonly AssemblySnapshot[],
  rootAssemblyId: string,
  path: readonly string[]
):
  | { assembly: AssemblySnapshot; instance: AssemblyInstanceSnapshot }
  | undefined {
  const byId = new Map(assemblies.map((a) => [a.id, a]));
  let assembly = byId.get(rootAssemblyId);
  for (const [index, id] of path.entries()) {
    const instance = assembly?.instances.find((i) => i.id === id);
    if (!assembly || !instance) return undefined;
    if (index === path.length - 1) return { assembly, instance };
    if (instance.definition.kind !== "assembly") return undefined;
    assembly = byId.get(instance.definition.assemblyId);
  }
  return undefined;
}

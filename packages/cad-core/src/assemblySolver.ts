import type {
  AssemblyInstanceSnapshot,
  AssemblyMateAxisRef,
  AssemblyMateFrameRef,
  AssemblyMatePlaneRef,
  AssemblyMateSnapshot,
  AssemblySnapshot,
  CadBatchValidationError,
  Transform,
  Vec3
} from "@web-cad/cad-protocol";
import type { CadDocument } from "./engine";
import {
  computeConcentricAxisPose,
  computeDistancePlanePose
} from "./alignTransform";

type Source = Pick<CadDocument, "sketches" | "features" | "parameters">;
type Basis = readonly [Vec3, Vec3, Vec3];
type Frame = { origin: Vec3; basis: Basis };
type RelationalMate = Exclude<AssemblyMateSnapshot, { kind: "fixed" }>;
const EPS = 1e-7;
const UNIT: Basis = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1]
];

export class AssemblySolveError extends Error {
  constructor(
    readonly code: CadBatchValidationError["code"],
    message: string,
    readonly mateId?: string
  ) {
    super(message);
  }
}

function fail(message: string, mateId?: string): never {
  throw new AssemblySolveError("ASSEMBLY_MATE_CONFLICTING", message, mateId);
}
function withMate<T>(mateId: string, evaluate: () => T): T {
  try {
    return evaluate();
  } catch (error) {
    if (error instanceof AssemblySolveError && !error.mateId)
      throw new AssemblySolveError(error.code, error.message, mateId);
    throw error;
  }
}
const add = (a: Vec3, b: Vec3): Vec3 =>
  a.map((v, i) => v + b[i]!) as unknown as Vec3;
const sub = (a: Vec3, b: Vec3): Vec3 =>
  a.map((v, i) => v - b[i]!) as unknown as Vec3;
const mul = (a: Vec3, n: number): Vec3 =>
  a.map((v) => v * n) as unknown as Vec3;
const dot = (a: Vec3, b: Vec3): number =>
  a.reduce((s, v, i) => s + v * b[i]!, 0);
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
const length = (v: Vec3): number => Math.hypot(...v);
const unit = (v: Vec3): Vec3 => {
  if (length(v) < 1e-12) fail("Assembly frame directions must be nonzero.");
  return mul(v, 1 / length(v));
};
const applyBasis = (basis: Basis, v: Vec3): Vec3 =>
  add(add(mul(basis[0], v[0]), mul(basis[1], v[1])), mul(basis[2], v[2]));
const inverseBasis = (basis: Basis): Basis => [
  [basis[0][0], basis[1][0], basis[2][0]],
  [basis[0][1], basis[1][1], basis[2][1]],
  [basis[0][2], basis[1][2], basis[2][2]]
];
const compose = (a: Basis, b: Basis): Basis =>
  b.map((v) => applyBasis(a, v)) as unknown as Basis;
function rotation([rx, ry, rz]: Vec3): Basis {
  const c = Math.cos,
    s = Math.sin;
  return [
    [c(rz) * c(ry), s(rz) * c(ry), -s(ry)],
    [
      c(rz) * s(ry) * s(rx) - s(rz) * c(rx),
      s(rz) * s(ry) * s(rx) + c(rz) * c(rx),
      c(ry) * s(rx)
    ],
    [
      c(rz) * s(ry) * c(rx) + s(rz) * s(rx),
      s(rz) * s(ry) * c(rx) - c(rz) * s(rx),
      c(ry) * c(rx)
    ]
  ];
}
function euler(b: Basis): Vec3 {
  const sy = Math.max(-1, Math.min(1, -b[0][2]));
  const result: Vec3 =
    Math.abs(sy) < 1 - 1e-12
      ? [
          Math.atan2(b[1][2], b[2][2]),
          Math.asin(sy),
          Math.atan2(b[0][1], b[0][0])
        ]
      : [Math.atan2(-b[2][1], b[1][1]), Math.asin(sy), 0];
  return result.map((v) => (v === 0 ? 0 : v)) as unknown as Vec3;
}
const scaledPoint = (p: Vec3, t: Transform): Vec3 =>
  p.map((v, i) => v * t.scale[i]!) as unknown as Vec3;
const point = (p: Vec3, t: Transform): Vec3 =>
  add(t.translation, applyBasis(rotation(t.rotation), scaledPoint(p, t)));
const direction = (v: Vec3, t: Transform): Vec3 =>
  applyBasis(rotation(t.rotation), v);

export function assemblyTransformsEqual(a: Transform, b: Transform): boolean {
  return (
    length(sub(a.translation, b.translation)) < 1e-10 &&
    length(sub(a.scale, b.scale)) < 1e-12 &&
    rotation(a.rotation).every(
      (v, i) => length(sub(v, rotation(b.rotation)[i]!)) < 1e-10
    )
  );
}

export function isAssemblyMateFrameRef(
  value: unknown
): value is AssemblyMateFrameRef {
  if (!record(value) || !id(value.instanceId) || !record(value.frame))
    return false;
  const f = value.frame;
  if (f.kind === "local")
    return (
      vec(f.origin) &&
      vec(f.xDirection) &&
      vec(f.zDirection) &&
      only(f, ["kind", "origin", "xDirection", "zDirection"]) &&
      only(value, ["instanceId", "frame"])
    );
  return (
    f.kind === "sketch" &&
    id(f.sketchId) &&
    id(f.entityId) &&
    (f.offset === undefined || finite(f.offset)) &&
    (f.flip === undefined || typeof f.flip === "boolean") &&
    only(f, ["kind", "sketchId", "entityId", "offset", "flip"]) &&
    only(value, ["instanceId", "frame"])
  );
}
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const id = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const vec = (v: unknown): v is Vec3 =>
  Array.isArray(v) && v.length === 3 && v.every(finite);
const only = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).every((k) => keys.includes(k));
export function isAssemblyScalarSource(
  v: Record<string, unknown>,
  literal: string,
  parameter: string,
  optional = false
): boolean {
  return v[parameter] === undefined
    ? (optional && v[literal] === undefined) || finite(v[literal])
    : id(v[parameter]) && v[literal] === undefined;
}

export function assemblyScalar(
  source: Source,
  literal: number | undefined,
  parameterId: string | undefined,
  defaultValue?: number
): number {
  if (parameterId !== undefined) {
    const parameter = source.parameters.get(parameterId);
    if (!parameter || !Number.isFinite(parameter.value))
      throw new AssemblySolveError(
        "INVALID_OPERATION",
        `Assembly mate parameter does not exist or is not finite: ${parameterId}`
      );
    return parameter.value;
  }
  const value = literal ?? defaultValue;
  if (value === undefined || !Number.isFinite(value))
    throw new AssemblySolveError(
      "INVALID_OPERATION",
      "Assembly mate requires a finite scalar or an existing parameter binding."
    );
  return value;
}

function definitionUsesSketch(
  source: Source,
  bodyId: string,
  sketchId: string
): boolean {
  // Traverse public authored feature references, not derived/exact topology.
  const visited = new Set<string>();
  const visit = (body: string): boolean => {
    if (visited.has(body)) return false;
    visited.add(body);
    const feature = [...source.features.values()].find(
      (f) => f.bodyId === body
    );
    if (!feature) return false;
    const bodies = new Set<string>();
    let found = false;
    const refs = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(refs);
        return;
      }
      if (!record(value)) return;
      for (const [key, item] of Object.entries(value)) {
        if (key === "sketchId" && item === sketchId) found = true;
        if (key === "seedFeatureId" && typeof item === "string") {
          const seed = source.features.get(item);
          if (seed) bodies.add(seed.bodyId);
        }
        if (
          key !== "bodyId" &&
          key.endsWith("BodyId") &&
          typeof item === "string"
        )
          bodies.add(item);
        if (key.endsWith("BodyIds") && Array.isArray(item))
          item.forEach((v) => {
            if (typeof v === "string") bodies.add(v);
          });
        refs(item);
      }
    };
    refs(feature);
    return found || [...bodies].some(visit);
  };
  return visit(bodyId);
}

function localFrame(
  source: Source,
  instance: AssemblyInstanceSnapshot,
  ref: AssemblyMateFrameRef
): Frame {
  const frame = ref.frame;
  if (frame.kind === "local") {
    const x = unit(frame.xDirection),
      z = unit(frame.zDirection);
    if (Math.abs(dot(x, z)) > 1e-9)
      fail("Assembly frame X and Z directions must be orthogonal.");
    return { origin: frame.origin, basis: [x, cross(z, x), z] };
  }
  const sketch = source.sketches.get(frame.sketchId);
  if (!sketch)
    throw new AssemblySolveError(
      "INVALID_OPERATION",
      `Assembly frame sketch does not exist: ${frame.sketchId}`
    );
  if (sketch.datumId || sketch.attachment)
    throw new AssemblySolveError(
      "INVALID_OPERATION",
      "Assembly sketch frames currently require an unattached standard-plane sketch."
    );
  if (!definitionUsesSketch(source, instance.definition.bodyId, sketch.id))
    throw new AssemblySolveError(
      "INVALID_OPERATION",
      `Assembly frame sketch ${sketch.id} is not in body ${instance.definition.bodyId}'s authored feature ancestry.`
    );
  const entity = sketch.entities.get(frame.entityId);
  if (!entity || (entity.kind !== "circle" && entity.kind !== "point"))
    throw new AssemblySolveError(
      "INVALID_OPERATION",
      `Assembly frame requires an authored circle or point: ${frame.entityId}`
    );
  const p = entity.kind === "circle" ? entity.center : entity.point;
  const basis: Basis =
    sketch.plane === "XY"
      ? UNIT
      : sketch.plane === "XZ"
        ? [
            [1, 0, 0],
            [0, 0, 1],
            [0, -1, 0]
          ]
        : [
            [0, 1, 0],
            [0, 0, 1],
            [1, 0, 0]
          ];
  return {
    origin: add(
      applyBasis(basis, [p[0], p[1], 0]),
      mul(basis[2], frame.offset ?? 0)
    ),
    basis: frame.flip ? [basis[0], mul(basis[1], -1), mul(basis[2], -1)] : basis
  };
}
function worldFrame(
  source: Source,
  instance: AssemblyInstanceSnapshot,
  ref: AssemblyMateFrameRef
): Frame {
  if (instance.transform.scale.some((x) => Math.abs(x - 1) > 1e-12))
    throw new AssemblySolveError(
      "INVALID_OPERATION",
      "Revolute joint instances require unit scale; edit the part dimensions instead."
    );
  const local = localFrame(source, instance, ref);
  return {
    origin: point(local.origin, instance.transform),
    basis: compose(rotation(instance.transform.rotation), local.basis)
  };
}
function plane(instance: AssemblyInstanceSnapshot, ref: AssemblyMatePlaneRef) {
  const n: Vec3 =
    ref.plane === "XY" ? [0, 0, 1] : ref.plane === "XZ" ? [0, 1, 0] : [1, 0, 0];
  return {
    point: point(mul(n, ref.offset ?? 0), instance.transform),
    normal: direction(mul(n, ref.flip ? -1 : 1), instance.transform)
  };
}
function axis(instance: AssemblyInstanceSnapshot, ref: AssemblyMateAxisRef) {
  const n: Vec3 =
    ref.axis === "X" ? [1, 0, 0] : ref.axis === "Y" ? [0, 1, 0] : [0, 0, 1];
  return {
    origin: point(ref.origin ?? [0, 0, 0], instance.transform),
    direction: direction(n, instance.transform)
  };
}
function applyAlignment(
  t: Transform,
  pivot: Vec3,
  alignment: { translation: Vec3; rotationAxis: Vec3; rotationDegrees: number }
): Transform {
  const a = (alignment.rotationDegrees * Math.PI) / 180;
  if (Math.abs(a) < 1e-12)
    return { ...t, translation: add(t.translation, alignment.translation) };
  const u = unit(alignment.rotationAxis),
    c = Math.cos(a),
    s = Math.sin(a);
  const turn = (v: Vec3): Vec3 =>
    add(add(mul(v, c), mul(cross(u, v), s)), mul(u, dot(u, v) * (1 - c)));
  const r = rotation(t.rotation).map(turn) as unknown as Basis;
  return {
    ...t,
    translation: add(
      add(pivot, turn(sub(t.translation, pivot))),
      alignment.translation
    ),
    rotation: euler(r)
  };
}

function solveMate(
  source: Source,
  mate: RelationalMate,
  parent: AssemblyInstanceSnapshot,
  child: AssemblyInstanceSnapshot
): AssemblyInstanceSnapshot {
  const forward = mate.primary.instanceId === parent.id;
  if (mate.kind === "revolute") {
    const parentRef = forward ? mate.primary : mate.secondary,
      childRef = forward ? mate.secondary : mate.primary;
    const p = worldFrame(source, parent, parentRef);
    worldFrame(source, child, childRef);
    const local = localFrame(source, child, childRef),
      angle = ((mate.angleDegrees * Math.PI) / 180) * (forward ? 1 : -1);
    const desiredBasis = compose(p.basis, rotation([0, 0, angle]));
    const desiredOrigin = add(
      p.origin,
      mul(p.basis[2], mate.offset * (forward ? 1 : -1))
    );
    const r = compose(desiredBasis, inverseBasis(local.basis));
    return {
      ...child,
      transform: {
        ...child.transform,
        rotation: euler(r),
        translation: sub(desiredOrigin, applyBasis(r, local.origin))
      }
    };
  }
  if (mate.kind === "concentric") {
    const p = axis(parent, forward ? mate.primary : mate.secondary),
      c = axis(child, forward ? mate.secondary : mate.primary);
    return {
      ...child,
      transform: applyAlignment(
        child.transform,
        c.origin,
        computeConcentricAxisPose(c, p).transform
      )
    };
  }
  const p = plane(parent, forward ? mate.primary : mate.secondary),
    c = plane(child, forward ? mate.secondary : mate.primary);
  const distance =
    mate.kind === "distance" ? mate.distance * (forward ? 1 : -1) : 0;
  return {
    ...child,
    transform: applyAlignment(
      child.transform,
      c.point,
      computeDistancePlanePose(c, p, distance).transform
    )
  };
}

function satisfied(
  source: Source,
  mate: RelationalMate,
  instances: Map<string, AssemblyInstanceSnapshot>
): boolean {
  const a = instances.get(mate.primary.instanceId)!,
    b = instances.get(mate.secondary.instanceId)!;
  if (mate.kind === "revolute") {
    const expected = solveMate(source, mate, a, b).transform;
    return (
      length(sub(expected.translation, b.transform.translation)) < EPS &&
      rotation(expected.rotation).every(
        (v, i) => length(sub(v, rotation(b.transform.rotation)[i]!)) < EPS
      )
    );
  }
  if (mate.kind === "concentric") {
    const pa = axis(a, mate.primary),
      pb = axis(b, mate.secondary),
      d = sub(pb.origin, pa.origin);
    return (
      length(cross(pa.direction, pb.direction)) < EPS &&
      length(sub(d, mul(pa.direction, dot(d, pa.direction)))) < EPS
    );
  }
  const pa = plane(a, mate.primary),
    pb = plane(b, mate.secondary);
  return (
    length(sub(pa.normal, pb.normal)) < EPS &&
    Math.abs(
      dot(sub(pb.point, pa.point), pa.normal) -
        (mate.kind === "distance" ? mate.distance : 0)
    ) < EPS
  );
}

function transported(
  child: AssemblyInstanceSnapshot,
  parent: AssemblyInstanceSnapshot,
  oldParent: AssemblyInstanceSnapshot
): AssemblyInstanceSnapshot {
  const delta = compose(
    rotation(parent.transform.rotation),
    inverseBasis(rotation(oldParent.transform.rotation))
  );
  return {
    ...child,
    transform: {
      ...child.transform,
      translation: add(
        parent.transform.translation,
        applyBasis(
          delta,
          sub(child.transform.translation, oldParent.transform.translation)
        )
      ),
      rotation: euler(compose(delta, rotation(child.transform.rotation)))
    }
  };
}

/** Deterministic rooted forest. Parallel constraints share one edge and must all hold. */
export function solveAssembly(
  source: Source,
  assembly: AssemblySnapshot,
  previous?: AssemblySnapshot
): AssemblySnapshot {
  const instances = new Map(assembly.instances.map((i) => [i.id, i]));
  const previousInstances = new Map(previous?.instances.map((i) => [i.id, i]));
  const mates = (assembly.mates ?? []).map((m) =>
    m.kind === "distance"
      ? {
          ...m,
          distance: assemblyScalar(source, m.distance, m.distanceParameterId)
        }
      : m.kind === "revolute"
        ? {
            ...m,
            angleDegrees: assemblyScalar(
              source,
              m.angleDegrees,
              m.angleParameterId
            ),
            offset: assemblyScalar(source, m.offset, m.offsetParameterId, 0)
          }
        : m
  );
  const fixed = new Set<string>();
  const edges = new Map<
    string,
    { a: string; b: string; mates: RelationalMate[] }
  >();
  for (const mate of mates) {
    if (mate.kind === "fixed") {
      if (!instances.has(mate.instanceId))
        fail(
          `Assembly fixed mate ${mate.id} references a missing instance.`,
          mate.id
        );
      if (fixed.has(mate.instanceId))
        throw new AssemblySolveError(
          "INVALID_OPERATION",
          `Assembly instance already has a fixed mate: ${mate.instanceId}`,
          mate.id
        );
      fixed.add(mate.instanceId);
      continue;
    }
    const a = mate.primary.instanceId,
      b = mate.secondary.instanceId;
    if (a === b || !instances.has(a) || !instances.has(b))
      fail(
        `Assembly mate ${mate.id} requires two distinct existing instances.`,
        mate.id
      );
    if (mate.kind === "revolute") {
      withMate(mate.id, () => {
        worldFrame(source, instances.get(a)!, mate.primary);
        worldFrame(source, instances.get(b)!, mate.secondary);
      });
    }
    const key = JSON.stringify([a, b].sort());
    const edge = edges.get(key) ?? { a, b, mates: [] };
    edge.mates.push(mate);
    edges.set(key, edge);
  }
  const adjacency = new Map<
    string,
    typeof edges extends Map<string, infer E> ? E[] : never
  >();
  for (const edge of edges.values())
    for (const id of [edge.a, edge.b])
      adjacency.set(id, [...(adjacency.get(id) ?? []), edge]);
  const visited = new Set<string>();
  for (const start of instances.keys()) {
    if (visited.has(start) || !adjacency.has(start)) continue;
    const component = new Set<string>(),
      componentEdges = new Set<
        typeof edges extends Map<string, infer E> ? E : never
      >();
    const queue = [start];
    for (let q = 0; q < queue.length; q++) {
      const id = queue[q]!;
      if (component.has(id)) continue;
      component.add(id);
      for (const edge of adjacency.get(id) ?? []) {
        componentEdges.add(edge);
        queue.push(edge.a === id ? edge.b : edge.a);
      }
    }
    const roots = [...component].filter((id) => fixed.has(id));
    if (!roots.length)
      throw new AssemblySolveError(
        "ASSEMBLY_MATE_UNDERCONSTRAINED",
        "Assembly mate component is underconstrained: ground one instance with a fixed mate before solving pose."
      );
    if (componentEdges.size !== component.size - 1) {
      if (
        [...component].every((id) => fixed.has(id)) &&
        [...componentEdges].every((e) =>
          e.mates.every((m) => satisfied(source, m, instances))
        )
      ) {
        component.forEach((id) => visited.add(id));
        continue;
      }
      fail(
        "Assembly mate cycles are not supported; use a rooted tree (parallel constraints between the same pair are allowed)."
      );
    }
    const root = roots[0]!,
      walk = [root];
    visited.add(root);
    for (let q = 0; q < walk.length; q++) {
      const parentId = walk[q]!,
        parent = instances.get(parentId)!;
      for (const edge of adjacency.get(parentId) ?? []) {
        const childId = edge.a === parentId ? edge.b : edge.a;
        if (visited.has(childId)) continue;
        visited.add(childId);
        walk.push(childId);
        let child = instances.get(childId)!;
        if (!fixed.has(childId)) {
          const oldParent = previousInstances.get(parentId),
            oldChild = previousInstances.get(childId);
          const previousEdge = previous?.mates?.some(
            (m) =>
              m.kind !== "fixed" &&
              edge.mates.some((current) => current.id === m.id) &&
              ((m.primary.instanceId === parentId &&
                m.secondary.instanceId === childId) ||
                (m.secondary.instanceId === parentId &&
                  m.primary.instanceId === childId))
          );
          if (
            oldParent &&
            oldChild &&
            previousEdge &&
            !assemblyTransformsEqual(oldParent.transform, parent.transform)
          )
            child = transported(child, parent, oldParent);
          for (let iteration = 0; iteration < 8; iteration++) {
            for (const mate of edge.mates)
              child = withMate(mate.id, () =>
                solveMate(source, mate, parent, child)
              );
            instances.set(childId, child);
            if (edge.mates.every((m) => satisfied(source, m, instances))) break;
          }
        }
        if (!edge.mates.every((m) => satisfied(source, m, instances)))
          fail(
            `Assembly mate conflicts between ${parentId} and ${childId}; all constraints must remain satisfied.`,
            edge.mates[0]?.id
          );
      }
    }
  }
  return {
    ...assembly,
    instances: assembly.instances.map((i) => {
      const solved = instances.get(i.id)!;
      return assemblyTransformsEqual(i.transform, solved.transform)
        ? i
        : solved;
    }),
    ...(assembly.mates ? { mates } : {})
  };
}

/** Root/free pose changes are explicit; moving a constrained child edits its mate. */
export function assertAssemblyTransformEditable(
  assembly: AssemblySnapshot,
  instanceId: string
): void {
  const mates = assembly.mates ?? [];
  if (mates.some((m) => m.kind === "fixed" && m.instanceId === instanceId))
    return;
  if (
    mates.some(
      (m) =>
        m.kind !== "fixed" &&
        (m.primary.instanceId === instanceId ||
          m.secondary.instanceId === instanceId)
    )
  )
    fail(
      "A constrained instance pose is controlled by its mates; edit its joint or move the grounded root."
    );
}

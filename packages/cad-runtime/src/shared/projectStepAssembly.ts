import {
  assemblyTransformToMatrix,
  flattenAssemblyOccurrences,
  getRootAssemblies,
  IDENTITY_ASSEMBLY_TRANSFORM,
  type CadEngine
} from "@web-cad/cad-core";
import type { GeometryKernelStepAssembly } from "@web-cad/geometry-kernel/protocol";

/** Exchange projection of ordinary document definitions, with no expanded BReps. */
export function createProjectStepExportScope(
  engine: CadEngine,
  options: {
    readonly bodyIds?: readonly string[];
    readonly assemblyIds?: readonly string[];
  } = {}
): {
  readonly bodyIds?: readonly string[];
  readonly assembly?: GeometryKernelStepAssembly;
} {
  if (options.bodyIds && options.assemblyIds)
    throw new Error("Select bodies or assemblies for STEP export, not both.");
  if (options.bodyIds) {
    if (
      !Array.isArray(options.bodyIds) ||
      options.bodyIds.length === 0 ||
      new Set(options.bodyIds).size !== options.bodyIds.length
    )
      throw new Error("Select distinct existing bodies.");
    return { bodyIds: options.bodyIds };
  }
  const snapshot = engine.createSnapshot();
  const assemblies = snapshot.assemblies ?? [];
  const rootIds =
    options.assemblyIds ?? getRootAssemblies(assemblies).map((a) => a.id);
  if (
    options.assemblyIds &&
    (rootIds.length === 0 || new Set(rootIds).size !== rootIds.length)
  )
    throw new Error("Select distinct existing assemblies.");
  if (!rootIds.length) return {};
  const occurrences = flattenAssemblyOccurrences(assemblies, rootIds);
  const used = new Set(occurrences.map((o) => o.bodyId));
  if (options.assemblyIds && used.size === 0)
    throw new Error("Selected assemblies contain no bodies to export.");
  const structure = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  if (!structure.ok || structure.query !== "project.structure")
    throw new Error("Document structure is unavailable.");
  const activeBodies = structure.bodies.filter((b) => !b.consumedByFeatureId);
  if ([...used].some((id) => !activeBodies.some((b) => b.id === id)))
    throw new Error("Assembly contains an unavailable body definition.");
  const byId = new Map(assemblies.map((a) => [a.id, a]));
  const reachable = new Set<string>();
  const visit = (id: string) => {
    if (reachable.has(id)) return;
    const a = byId.get(id);
    if (!a) throw new Error(`Assembly does not exist: ${id}`);
    reachable.add(id);
    for (const i of a.instances)
      if (i.definition.kind === "assembly") visit(i.definition.assemblyId);
  };
  rootIds.forEach(visit);
  // Body and assembly IDs are separate source namespaces. Exchange definitions
  // share one namespace, so allocate assembly IDs against all selected body IDs.
  const definitionIds = new Set(activeBodies.map((body) => body.id));
  const assemblyIds = new Map<string, string>();
  for (const id of reachable) {
    let candidate = `step_assembly_${assemblyIds.size + 1}`;
    while (definitionIds.has(candidate)) candidate += "_";
    definitionIds.add(candidate);
    assemblyIds.set(id, candidate);
    for (const instance of byId.get(id)!.instances) {
      const scale = instance.transform.scale;
      if (
        scale.some((value) => Math.abs(Math.abs(value) - 1) > 1e-9) ||
        scale[0] * scale[1] * scale[2] < 0
      )
        throw new Error(
          `STEP occurrence ${instance.id} requires a rigid placement; scale and reflection are unsupported.`
        );
    }
  }
  const identity = assemblyTransformToMatrix(IDENTITY_ASSEMBLY_TRANSFORM);
  const roots = rootIds.map((id, index) => ({
    id: `root_assembly_${index + 1}`,
    definitionId: assemblyIds.get(id)!,
    name: byId.get(id)!.name,
    transform: identity
  }));
  // A full-scene export also includes active bodies outside assemblies.
  if (!options.assemblyIds)
    for (const b of activeBodies)
      if (!used.has(b.id)) {
        used.add(b.id);
        roots.push({
          id: `root_body_${roots.length + 1}`,
          definitionId: b.id,
          name: b.name ?? b.id,
          transform: identity
        });
      }
  const assembly: GeometryKernelStepAssembly = {
    definitions: assemblies
      .filter((a) => reachable.has(a.id))
      .map((a) => ({
        id: assemblyIds.get(a.id)!,
        name: a.name,
        components: a.instances.map((i) => ({
          id: i.id,
          name: i.name,
          definitionId:
            i.definition.kind === "body"
              ? i.definition.bodyId
              : assemblyIds.get(i.definition.assemblyId)!,
          transform: assemblyTransformToMatrix(i.transform),
          ...(i.color ? { color: i.color } : {})
        }))
      })),
    roots,
    occurrenceCount:
      occurrences.length + roots.filter((r) => used.has(r.definitionId)).length
  };
  return { bodyIds: [...used], assembly };
}

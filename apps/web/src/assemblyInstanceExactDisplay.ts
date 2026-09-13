import type { AssemblySnapshot, Transform, Vec3 } from "@web-cad/cad-protocol";
import {
  flattenAssemblyOccurrences,
  resolveAssemblyOccurrence,
  assemblyTransformFromMatrix,
  assemblyTransformToMatrix,
  multiplyAssemblyMatrices,
  IDENTITY_ASSEMBLY_TRANSFORM,
  type AssemblyOccurrence
} from "@web-cad/cad-core";
import type {
  RenderPrimitive,
  RenderTransform,
  RenderTriangleMesh
} from "@web-cad/renderer";
import { documentTreeSelectionKey } from "./workbench/documentTreeProjection";

export interface AssemblyInstanceExactDisplayRef {
  readonly assemblyId: string;
  readonly instanceId: string;
  readonly bodyId: string;
  readonly name: string;
  readonly transform: Transform;
  readonly renderTargetId: string;
  readonly rootAssemblyId?: string;
  readonly instancePath?: readonly string[];
}

const ASSEMBLY_INSTANCE_RENDER_ID_PREFIX = "assembly-instance:";

/** Select a derived view without changing definitions or assembly source. */
export function createAssemblySceneView(input: {
  readonly base: {
    readonly primitives: readonly RenderPrimitive[];
    readonly meshes: readonly RenderTriangleMesh[];
  };
  readonly assemblies: readonly AssemblySnapshot[];
  readonly view: "assembly" | "parts";
  readonly definitionColorsByBodyId?: ReadonlyMap<string, Vec3>;
  readonly bodyRenderIdsByBodyId?: ReadonlyMap<string, string>;
}) {
  const base = input.definitionColorsByBodyId?.size
    ? {
        ...input.base,
        meshes: input.base.meshes.map((mesh) => {
          const color = input.definitionColorsByBodyId?.get(mesh.id);
          return color ? { ...mesh, color } : mesh;
        })
      }
    : input.base;
  if (
    input.view === "parts" ||
    !input.assemblies.some((assembly) => assembly.instances.length > 0)
  ) {
    return base;
  }
  const instantiatedBodyIds = new Set(
    flattenAssemblyOccurrences(input.assemblies).map(
      (occurrence) => occurrence.bodyId
    )
  );
  const instantiatedRenderIds = new Set(
    [...instantiatedBodyIds].map(
      (bodyId) => input.bodyRenderIdsByBodyId?.get(bodyId) ?? bodyId
    )
  );
  const meshesById = new Map(base.meshes.map((mesh) => [mesh.id, mesh]));
  const meshesByBodyId = new Map(meshesById);
  for (const [bodyId, renderId] of input.bodyRenderIdsByBodyId ?? []) {
    const mesh = meshesById.get(renderId);
    if (mesh) meshesByBodyId.set(bodyId, mesh);
  }
  return {
    primitives: base.primitives.filter(
      (primitive) => !instantiatedRenderIds.has(primitive.id)
    ),
    meshes: [
      ...base.meshes.filter(
        (mesh) =>
          mesh.source !== "sketch" &&
          !mesh.id.startsWith("sketch:") &&
          !instantiatedBodyIds.has(mesh.id) &&
          !instantiatedRenderIds.has(mesh.id)
      ),
      ...createAssemblyInstanceExactDisplayMeshes({
        assemblies: input.assemblies,
        definitionMeshesByBodyId: meshesByBodyId
      })
    ]
  };
}

export function createAssemblyInstanceRenderId(
  assemblyId: string,
  instanceId: string | readonly string[]
): string {
  const path = typeof instanceId === "string" ? [instanceId] : instanceId;
  return documentTreeSelectionKey({
    kind: "assembly-instance",
    assemblyId,
    id: path.at(-1) ?? "",
    ...(path.length > 1
      ? { rootAssemblyId: assemblyId, instancePath: path }
      : {})
  });
}

export function parseAssemblyInstanceRenderId(renderId: string | undefined):
  | {
      readonly assemblyId: string;
      readonly instanceId: string;
      readonly instancePath?: readonly string[];
    }
  | undefined {
  if (!renderId?.startsWith(ASSEMBLY_INSTANCE_RENDER_ID_PREFIX)) {
    return undefined;
  }
  const remainder = renderId.slice(ASSEMBLY_INSTANCE_RENDER_ID_PREFIX.length);
  const separator = remainder.indexOf(":");
  if (separator <= 0 || separator >= remainder.length - 1) {
    return undefined;
  }
  let path: string[], assemblyId: string;
  try {
    path = remainder
      .slice(separator + 1)
      .split("/")
      .map(decodeURIComponent);
    assemblyId = decodeURIComponent(remainder.slice(0, separator));
  } catch {
    return undefined;
  }
  if (path.some((part) => !part)) return undefined;
  return {
    assemblyId,
    instanceId: path.at(-1)!,
    ...(path.length > 1 ? { instancePath: path } : {})
  };
}

/**
 * Exact display of assembly instances: reuse one V21 exact mesh per definition
 * body and apply each instance transform. Does not retessellate.
 */
export function createAssemblyInstanceExactDisplayMeshes(input: {
  readonly assemblies: readonly AssemblySnapshot[];
  readonly definitionMeshesByBodyId: ReadonlyMap<string, RenderTriangleMesh>;
}): readonly RenderTriangleMesh[] {
  const meshes: RenderTriangleMesh[] = [];
  for (const occurrence of flattenAssemblyOccurrences(input.assemblies)) {
    const definitionMesh = input.definitionMeshesByBodyId.get(
      occurrence.bodyId
    );
    if (!definitionMesh) continue;
    meshes.push(createInstanceDisplayMesh(occurrence, definitionMesh));
  }
  return meshes;
}

export function listAssemblyInstanceExactDisplayRefs(input: {
  readonly assemblies: readonly AssemblySnapshot[];
  readonly definitionBodyIds?: ReadonlySet<string>;
}): readonly AssemblyInstanceExactDisplayRef[] {
  const refs: AssemblyInstanceExactDisplayRef[] = [];
  for (const occurrence of flattenAssemblyOccurrences(input.assemblies)) {
    if (
      input.definitionBodyIds &&
      !input.definitionBodyIds.has(occurrence.bodyId)
    ) {
      continue;
    }
    refs.push(occurrenceDisplayRef(occurrence));
  }
  return refs;
}

export function resolveAssemblyInstanceBodyPick(input: {
  readonly pickedRenderId: string | undefined;
  readonly assemblies: readonly AssemblySnapshot[];
}): AssemblyInstanceExactDisplayRef | undefined {
  const parsed = parseAssemblyInstanceRenderId(input.pickedRenderId);
  if (!parsed) return undefined;
  const path = parsed.instancePath ?? [parsed.instanceId];
  const resolved = resolveAssemblyOccurrence(
    input.assemblies,
    parsed.assemblyId,
    path
  );
  if (!resolved || resolved.instance.definition.kind !== "body") {
    return undefined;
  }
  let matrix = assemblyTransformToMatrix(IDENTITY_ASSEMBLY_TRANSFORM);
  const byId = new Map(
    input.assemblies.map((assembly) => [assembly.id, assembly])
  );
  let parent = byId.get(parsed.assemblyId);
  for (const id of path) {
    const instance = parent?.instances.find((candidate) => candidate.id === id);
    if (!instance) return undefined;
    matrix = multiplyAssemblyMatrices(
      matrix,
      assemblyTransformToMatrix(instance.transform)
    );
    if (instance.definition.kind === "assembly")
      parent = byId.get(instance.definition.assemblyId);
  }
  return occurrenceDisplayRef({
    rootAssemblyId: parsed.assemblyId,
    assemblyId: resolved.assembly.id,
    instanceId: resolved.instance.id,
    path,
    bodyId: resolved.instance.definition.bodyId,
    name: resolved.instance.name,
    transform: assemblyTransformFromMatrix(matrix)
  });
}

export function findAssemblyInstanceDefinitionBodyId(input: {
  readonly assemblies: readonly AssemblySnapshot[];
  readonly assemblyId: string;
  readonly instanceId: string;
  readonly rootAssemblyId?: string;
  readonly instancePath?: readonly string[];
}): string | undefined {
  const instance = resolveAssemblyOccurrence(
    input.assemblies,
    input.rootAssemblyId ?? input.assemblyId,
    input.instancePath ?? [input.instanceId]
  )?.instance;
  return instance?.definition.kind === "body"
    ? instance.definition.bodyId
    : undefined;
}

function createInstanceDisplayMesh(
  occurrence: AssemblyOccurrence,
  definitionMesh: RenderTriangleMesh
): RenderTriangleMesh {
  const bodyId = occurrence.bodyId;
  return {
    ...definitionMesh,
    id: createAssemblyInstanceRenderId(
      occurrence.rootAssemblyId,
      occurrence.path
    ),
    parentId: definitionMesh.id,
    source: bodyId,
    label: `${occurrence.name} · instance of ${bodyId}`,
    ...(occurrence.color ? { color: occurrence.color } : {}),
    // Instances are transforms over the shared definition mesh.
    transform: toRenderTransform(
      assemblyTransformFromMatrix(
        multiplyAssemblyMatrices(
          assemblyTransformToMatrix(occurrence.transform),
          assemblyTransformToMatrix(definitionMesh.transform)
        )
      )
    )
  };
}

function occurrenceDisplayRef(
  occurrence: AssemblyOccurrence
): AssemblyInstanceExactDisplayRef {
  return {
    assemblyId: occurrence.assemblyId,
    instanceId: occurrence.instanceId,
    bodyId: occurrence.bodyId,
    name: occurrence.name,
    transform: toRenderTransform(occurrence.transform),
    renderTargetId: createAssemblyInstanceRenderId(
      occurrence.rootAssemblyId,
      occurrence.path
    ),
    ...(occurrence.path.length > 1
      ? {
          rootAssemblyId: occurrence.rootAssemblyId,
          instancePath: occurrence.path
        }
      : {})
  };
}

function toRenderTransform(transform: Transform): RenderTransform {
  const clean = (vector: Vec3): Vec3 => [
    vector[0] === 0 ? 0 : vector[0],
    vector[1] === 0 ? 0 : vector[1],
    vector[2] === 0 ? 0 : vector[2]
  ];
  return {
    translation: clean(transform.translation),
    rotation: clean(transform.rotation),
    scale: clean(transform.scale)
  };
}

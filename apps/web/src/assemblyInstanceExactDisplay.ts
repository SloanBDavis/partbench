import type {
  AssemblyInstanceSnapshot,
  AssemblySnapshot,
  Transform
} from "@web-cad/cad-protocol";
import type { RenderTransform, RenderTriangleMesh } from "@web-cad/renderer";
import { documentTreeSelectionKey } from "./workbench/documentTreeProjection";

export interface AssemblyInstanceExactDisplayRef {
  readonly assemblyId: string;
  readonly instanceId: string;
  readonly bodyId: string;
  readonly name: string;
  readonly transform: Transform;
  readonly renderTargetId: string;
}

const ASSEMBLY_INSTANCE_RENDER_ID_PREFIX = "assembly-instance:";

export function createAssemblyInstanceRenderId(
  assemblyId: string,
  instanceId: string
): string {
  return documentTreeSelectionKey({
    kind: "assembly-instance",
    assemblyId,
    id: instanceId
  });
}

export function parseAssemblyInstanceRenderId(
  renderId: string | undefined
): { readonly assemblyId: string; readonly instanceId: string } | undefined {
  if (!renderId?.startsWith(ASSEMBLY_INSTANCE_RENDER_ID_PREFIX)) {
    return undefined;
  }
  const remainder = renderId.slice(ASSEMBLY_INSTANCE_RENDER_ID_PREFIX.length);
  const separator = remainder.indexOf(":");
  if (separator <= 0 || separator >= remainder.length - 1) {
    return undefined;
  }
  return {
    assemblyId: remainder.slice(0, separator),
    instanceId: remainder.slice(separator + 1)
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
  for (const assembly of input.assemblies) {
    for (const instance of assembly.instances) {
      if (instance.definition.kind !== "body") continue;
      const definitionMesh = input.definitionMeshesByBodyId.get(
        instance.definition.bodyId
      );
      if (!definitionMesh) continue;
      meshes.push(
        createInstanceDisplayMesh(assembly.id, instance, definitionMesh)
      );
    }
  }
  return meshes;
}

export function listAssemblyInstanceExactDisplayRefs(input: {
  readonly assemblies: readonly AssemblySnapshot[];
  readonly definitionBodyIds?: ReadonlySet<string>;
}): readonly AssemblyInstanceExactDisplayRef[] {
  const refs: AssemblyInstanceExactDisplayRef[] = [];
  for (const assembly of input.assemblies) {
    for (const instance of assembly.instances) {
      if (instance.definition.kind !== "body") continue;
      if (
        input.definitionBodyIds &&
        !input.definitionBodyIds.has(instance.definition.bodyId)
      ) {
        continue;
      }
      refs.push({
        assemblyId: assembly.id,
        instanceId: instance.id,
        bodyId: instance.definition.bodyId,
        name: instance.name,
        transform: instance.transform,
        renderTargetId: createAssemblyInstanceRenderId(assembly.id, instance.id)
      });
    }
  }
  return refs;
}

export function resolveAssemblyInstanceBodyPick(input: {
  readonly pickedRenderId: string | undefined;
  readonly assemblies: readonly AssemblySnapshot[];
}): AssemblyInstanceExactDisplayRef | undefined {
  const parsed = parseAssemblyInstanceRenderId(input.pickedRenderId);
  if (!parsed) return undefined;
  const assembly = input.assemblies.find(
    (candidate) => candidate.id === parsed.assemblyId
  );
  const instance = assembly?.instances.find(
    (candidate) => candidate.id === parsed.instanceId
  );
  if (!assembly || !instance || instance.definition.kind !== "body") {
    return undefined;
  }
  return {
    assemblyId: assembly.id,
    instanceId: instance.id,
    bodyId: instance.definition.bodyId,
    name: instance.name,
    transform: instance.transform,
    renderTargetId: createAssemblyInstanceRenderId(assembly.id, instance.id)
  };
}

export function findAssemblyInstanceDefinitionBodyId(input: {
  readonly assemblies: readonly AssemblySnapshot[];
  readonly assemblyId: string;
  readonly instanceId: string;
}): string | undefined {
  const assembly = input.assemblies.find(
    (candidate) => candidate.id === input.assemblyId
  );
  const instance = assembly?.instances.find(
    (candidate) => candidate.id === input.instanceId
  );
  return instance?.definition.kind === "body"
    ? instance.definition.bodyId
    : undefined;
}

function createInstanceDisplayMesh(
  assemblyId: string,
  instance: AssemblyInstanceSnapshot,
  definitionMesh: RenderTriangleMesh
): RenderTriangleMesh {
  const bodyId = instance.definition.bodyId;
  return {
    ...definitionMesh,
    id: createAssemblyInstanceRenderId(assemblyId, instance.id),
    parentId: definitionMesh.id,
    source: bodyId,
    label: `${instance.name} · instance of ${bodyId}`,
    // Instances are transforms over the shared definition mesh.
    transform: toRenderTransform(instance.transform)
  };
}

function toRenderTransform(transform: Transform): RenderTransform {
  return {
    translation: transform.translation,
    rotation: transform.rotation,
    scale: transform.scale
  };
}

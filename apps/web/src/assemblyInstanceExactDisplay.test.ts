import type { AssemblySnapshot } from "@web-cad/cad-protocol";
import type { RenderTriangleMesh } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import {
  createAssemblyInstanceExactDisplayMeshes,
  createAssemblyInstanceRenderId,
  findAssemblyInstanceDefinitionBodyId,
  listAssemblyInstanceExactDisplayRefs,
  parseAssemblyInstanceRenderId,
  resolveAssemblyInstanceBodyPick
} from "./assemblyInstanceExactDisplay";

describe("assemblyInstanceExactDisplay", () => {
  const assemblies: readonly AssemblySnapshot[] = [
    {
      id: "asm_bolts",
      name: "Bolts",
      instances: [
        {
          id: "inst_a",
          name: "Bolt A",
          definition: { kind: "body", bodyId: "body_bolt" },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        },
        {
          id: "inst_b",
          name: "Bolt B",
          definition: { kind: "body", bodyId: "body_bolt" },
          transform: {
            translation: [40, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      ]
    }
  ];

  it("reuses one exact definition mesh for ≥2 instances with distinct transforms", () => {
    const definitionMesh = createMesh("body_bolt");
    const meshes = createAssemblyInstanceExactDisplayMeshes({
      assemblies,
      definitionMeshesByBodyId: new Map([["body_bolt", definitionMesh]])
    });

    expect(meshes).toHaveLength(2);
    expect(meshes[0]?.vertices).toBe(definitionMesh.vertices);
    expect(meshes[1]?.vertices).toBe(definitionMesh.vertices);
    expect(meshes[0]?.indices).toBe(definitionMesh.indices);
    expect(meshes[1]?.indices).toBe(definitionMesh.indices);
    expect(meshes.map((mesh) => mesh.id)).toEqual([
      "assembly-instance:asm_bolts:inst_a",
      "assembly-instance:asm_bolts:inst_b"
    ]);
    expect(meshes[0]?.transform.translation).toEqual([0, 0, 0]);
    expect(meshes[1]?.transform.translation).toEqual([40, 0, 0]);
    expect(meshes[0]?.source).toBe("body_bolt");
    expect(meshes[1]?.source).toBe("body_bolt");
  });

  it("lists display refs for shared definitions with different transforms", () => {
    const refs = listAssemblyInstanceExactDisplayRefs({ assemblies });
    expect(refs).toEqual([
      {
        assemblyId: "asm_bolts",
        instanceId: "inst_a",
        bodyId: "body_bolt",
        name: "Bolt A",
        transform: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        },
        renderTargetId: "assembly-instance:asm_bolts:inst_a"
      },
      {
        assemblyId: "asm_bolts",
        instanceId: "inst_b",
        bodyId: "body_bolt",
        name: "Bolt B",
        transform: {
          translation: [40, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        },
        renderTargetId: "assembly-instance:asm_bolts:inst_b"
      }
    ]);
  });

  it("resolves body-level pick/measure target on an instance render id", () => {
    const picked = resolveAssemblyInstanceBodyPick({
      pickedRenderId: createAssemblyInstanceRenderId("asm_bolts", "inst_b"),
      assemblies
    });
    expect(picked).toEqual({
      assemblyId: "asm_bolts",
      instanceId: "inst_b",
      bodyId: "body_bolt",
      name: "Bolt B",
      transform: {
        translation: [40, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      },
      renderTargetId: "assembly-instance:asm_bolts:inst_b"
    });
    expect(
      findAssemblyInstanceDefinitionBodyId({
        assemblies,
        assemblyId: "asm_bolts",
        instanceId: "inst_b"
      })
    ).toBe("body_bolt");
    expect(parseAssemblyInstanceRenderId("body_bolt")).toBeUndefined();
  });

  it("skips instances whose definition exact mesh is not ready", () => {
    const meshes = createAssemblyInstanceExactDisplayMeshes({
      assemblies,
      definitionMeshesByBodyId: new Map()
    });
    expect(meshes).toEqual([]);
  });
});

function createMesh(id: string): RenderTriangleMesh {
  return {
    id,
    kind: "mesh",
    vertices: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0]
    ],
    indices: [0, 1, 2],
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    },
    source: id,
    label: `${id} OCCT mesh`
  };
}

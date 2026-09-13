import type { AssemblySnapshot } from "@web-cad/cad-protocol";
import type { RenderTriangleMesh } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import {
  createAssemblyInstanceExactDisplayMeshes,
  createAssemblySceneView,
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

  it("keeps loose active parts beside posed assemblies and restores definitions in parts view", () => {
    const base = {
      primitives: [],
      meshes: [
        createMesh("body_bolt"),
        createMesh("sketch:bolt"),
        createMesh("loose_part")
      ]
    };
    const assemblyView = createAssemblySceneView({
      base,
      assemblies,
      view: "assembly"
    });
    expect(assemblyView.meshes.map((mesh) => mesh.id)).toEqual([
      "loose_part",
      "assembly-instance:asm_bolts:inst_a",
      "assembly-instance:asm_bolts:inst_b"
    ]);
    expect(createAssemblySceneView({ base, assemblies, view: "parts" })).toBe(
      base
    );
    expect(
      createAssemblySceneView({ base, assemblies: [], view: "assembly" })
    ).toBe(base);
    expect(
      createAssemblySceneView({
        base: { primitives: [], meshes: [] },
        assemblies,
        view: "assembly"
      }).meshes
    ).toEqual([]);
  });

  it("renders repeated nested definitions once per root occurrence, composes transforms, and resolves the authoritative pick owner", () => {
    const identity = {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    } as const;
    const nested: readonly AssemblySnapshot[] = [
      {
        id: "child",
        name: "Subassembly",
        instances: [
          {
            id: "bolt",
            name: "Bolt",
            definition: { kind: "body", bodyId: "body_bolt" },
            transform: { ...identity, translation: [3, 0, 0] }
          },
          {
            id: "pin",
            name: "Pin",
            definition: { kind: "body", bodyId: "body_bolt" },
            transform: identity,
            color: [1, 0, 0]
          }
        ]
      },
      {
        id: "root",
        name: "Engine",
        instances: [
          {
            id: "left",
            name: "Left",
            definition: { kind: "assembly", assemblyId: "child" },
            transform: {
              ...identity,
              translation: [10, 0, 0],
              rotation: [0, 0, Math.PI / 2]
            },
            color: [0, 0, 1]
          },
          {
            id: "right",
            name: "Right",
            definition: { kind: "assembly", assemblyId: "child" },
            transform: { ...identity, translation: [30, 0, 0] }
          }
        ]
      }
    ];
    const definitionMesh = {
      ...createMesh("body_bolt"),
      color: [0, 1, 0] as const
    };
    const meshes = createAssemblyInstanceExactDisplayMeshes({
      assemblies: nested,
      definitionMeshesByBodyId: new Map([["body_bolt", definitionMesh]])
    });
    expect(meshes.map((mesh) => mesh.id)).toEqual([
      "assembly-instance:root:left/bolt",
      "assembly-instance:root:left/pin",
      "assembly-instance:root:right/bolt",
      "assembly-instance:root:right/pin"
    ]);
    expect(
      meshes.every(
        (mesh) =>
          mesh.vertices === definitionMesh.vertices &&
          mesh.indices === definitionMesh.indices
      )
    ).toBe(true);
    expect(meshes[0]?.transform.translation).toEqual([10, 3, 0]);
    expect(meshes[2]?.transform.translation).toEqual([33, 0, 0]);
    expect(meshes.map((mesh) => mesh.color)).toEqual([
      [0, 0, 1],
      [1, 0, 0],
      [0, 1, 0],
      [1, 0, 0]
    ]);
    const pick = resolveAssemblyInstanceBodyPick({
      assemblies: nested,
      pickedRenderId: meshes[0]!.id
    });
    expect(pick).toMatchObject({
      assemblyId: "child",
      instanceId: "bolt",
      rootAssemblyId: "root",
      instancePath: ["left", "bolt"],
      bodyId: "body_bolt",
      transform: { translation: [10, 3, 0] }
    });
    expect(
      listAssemblyInstanceExactDisplayRefs({ assemblies: nested })
    ).toHaveLength(4);
    expect(
      findAssemblyInstanceDefinitionBodyId({
        assemblies: nested,
        assemblyId: "child",
        instanceId: "bolt",
        rootAssemblyId: "root",
        instancePath: ["left", "bolt"]
      })
    ).toBe("body_bolt");
    expect(
      resolveAssemblyInstanceBodyPick({
        assemblies: nested,
        pickedRenderId: "assembly-instance:root:left/missing"
      })
    ).toBeUndefined();
    const coloredParts = createAssemblySceneView({
      base: { primitives: [], meshes: [createMesh("body_bolt")] },
      assemblies: nested,
      view: "parts",
      definitionColorsByBodyId: new Map([["body_bolt", [0.2, 0.4, 0.6]]])
    });
    expect(coloredParts.meshes[0]?.color).toEqual([0.2, 0.4, 0.6]);
  });

  it("encodes path separators in caller IDs without confusing nested occurrences", () => {
    const renderId = createAssemblyInstanceRenderId("root:1", [
      "one/two",
      "leaf%id"
    ]);
    expect(parseAssemblyInstanceRenderId(renderId)).toEqual({
      assemblyId: "root:1",
      instanceId: "leaf%id",
      instancePath: ["one/two", "leaf%id"]
    });
    expect(
      parseAssemblyInstanceRenderId("assembly-instance:root:bad%ZZ")
    ).toBeUndefined();
  });

  it("maps authored primitive body identities explicitly and keeps loose primitives visible", () => {
    const mesh = {
      ...createMesh("bolt_object"),
      transform: {
        translation: [2, 0, 0] as const,
        rotation: [0, 0, 0] as const,
        scale: [1, 1, 1] as const
      }
    };
    const result = createAssemblySceneView({
      base: {
        meshes: [mesh],
        primitives: [
          {
            id: "loose_box",
            kind: "box",
            dimensions: { width: 2, height: 2, depth: 2 },
            transform: mesh.transform
          }
        ]
      },
      assemblies,
      view: "assembly",
      bodyRenderIdsByBodyId: new Map([["body_bolt", "bolt_object"]])
    });
    expect(result.meshes.map((part) => part.id)).toEqual([
      "assembly-instance:asm_bolts:inst_a",
      "assembly-instance:asm_bolts:inst_b"
    ]);
    expect(result.meshes[0]?.transform.translation).toEqual([2, 0, 0]);
    expect(result.meshes[1]?.transform.translation).toEqual([42, 0, 0]);
    expect(result.primitives.map((part) => part.id)).toEqual(["loose_box"]);
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

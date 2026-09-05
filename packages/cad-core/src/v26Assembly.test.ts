import { describe, expect, it } from "vitest";
import {
  CAD_PROJECT_FORMAT_VERSION_V22,
  CadEngine,
  exportCadProject,
  importCadProject
} from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

function seedCompletedBolt(engine: CadEngine): void {
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_bolt", name: "Bolt", plane: "XY" },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_bolt",
      id: "circle_bolt",
      center: [0, 0],
      radius: 5
    },
    {
      op: "feature.extrude",
      id: "feat_bolt",
      bodyId: "body_bolt",
      sketchId: "sketch_bolt",
      entityId: "circle_bolt",
      depth: 20
    }
  ]);
}

describe("V26 slice A assembly definition vs instance", () => {
  it("creates an assembly, inserts two instances of one solid, and round-trips without a schema bump", () => {
    const engine = new CadEngine();
    seedCompletedBolt(engine);

    const created = engine.apply({
      op: "assembly.create",
      id: "asm_bolt",
      name: "Bolt assembly"
    });
    expect(created.transaction.diff).toMatchObject({
      assemblies: {
        created: [{ id: "asm_bolt", name: "Bolt assembly" }]
      }
    });

    const first = engine.apply({
      op: "assembly.instance.insert",
      id: "inst_bolt_a",
      assemblyId: "asm_bolt",
      name: "Bolt A",
      definition: { kind: "body", bodyId: "body_bolt" },
      transform: { translation: [0, 0, 0] }
    });
    const second = engine.apply({
      op: "assembly.instance.insert",
      id: "inst_bolt_b",
      assemblyId: "asm_bolt",
      name: "Bolt B",
      definition: { kind: "body", bodyId: "body_bolt" },
      transform: { translation: [40, 0, 0] }
    });

    expect(first.transaction.diff.assemblies?.instancesCreated).toHaveLength(1);
    expect(second.transaction.diff.assemblies?.instancesCreated).toHaveLength(1);
    expect(first.transaction.diff.features?.bodiesCreated).toBeUndefined();
    expect(second.transaction.diff.features?.bodiesCreated).toBeUndefined();

    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(structure).toMatchObject({
      ok: true,
      query: "project.structure",
      bodyCount: 1,
      assemblies: [
        {
          id: "asm_bolt",
          name: "Bolt assembly",
          instances: [
            {
              id: "inst_bolt_a",
              definition: { kind: "body", bodyId: "body_bolt" },
              transform: { translation: [0, 0, 0] }
            },
            {
              id: "inst_bolt_b",
              definition: { kind: "body", bodyId: "body_bolt" },
              transform: { translation: [40, 0, 0] }
            }
          ]
        }
      ]
    });
    expect(JSON.stringify(structure)).not.toMatch(PRIVATE_ID_PATTERN);

    const definitionIds = new Set(
      structure.ok && "assemblies" in structure
        ? (structure.assemblies ?? []).flatMap((assembly) =>
            assembly.instances.map((instance) => instance.definition.bodyId)
          )
        : []
    );
    expect(definitionIds.size).toBe(1);
    expect(
      structure.ok && "assemblies" in structure
        ? (structure.assemblies?.[0]?.instances.length ?? 0)
        : 0
    ).toBe(2);

    const exported = exportCadProject(engine);
    // Assemblies are optional on the existing document snapshot (like datums).
    // A simple solid does not elevate schema; prove we did not invent a bump.
    expect(exported.schemaVersion).not.toBe("web-cad.project.v23");
    expect(exported.schemaVersion).not.toBe("web-cad.project.v26");
    expect(CAD_PROJECT_FORMAT_VERSION_V22).toBe("web-cad.project.v22");
    expect(exported.document.assemblies).toEqual([
      {
        id: "asm_bolt",
        name: "Bolt assembly",
        instances: [
          {
            id: "inst_bolt_a",
            name: "Bolt A",
            definition: { kind: "body", bodyId: "body_bolt" },
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1]
            }
          },
          {
            id: "inst_bolt_b",
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
    ]);

    const restored = importCadProject(exported);
    const reexported = exportCadProject(restored);
    expect(reexported.schemaVersion).toBe(exported.schemaVersion);
    expect(reexported.schemaVersion).not.toBe("web-cad.project.v23");
    expect(reexported.document.assemblies).toEqual(exported.document.assemblies);

    const restoredStructure = restored.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(restoredStructure).toMatchObject({
      ok: true,
      bodyCount: 1,
      assemblies: [
        {
          id: "asm_bolt",
          instances: [
            { id: "inst_bolt_a", definition: { bodyId: "body_bolt" } },
            { id: "inst_bolt_b", definition: { bodyId: "body_bolt" } }
          ]
        }
      ]
    });
  });
});

describe("V26 slice B fixed/ground mate and assembly tree", () => {
  it("grounds a root instance with assembly.mate.create kind fixed and persists mates", () => {
    const engine = new CadEngine();
    seedCompletedBolt(engine);
    engine.applyBatch([
      { op: "assembly.create", id: "asm_root", name: "Root assembly" },
      {
        op: "assembly.instance.insert",
        id: "inst_root",
        assemblyId: "asm_root",
        name: "Root",
        definition: { kind: "body", bodyId: "body_bolt" },
        transform: { translation: [0, 0, 0] }
      },
      {
        op: "assembly.instance.insert",
        id: "inst_child",
        assemblyId: "asm_root",
        name: "Child",
        definition: { kind: "body", bodyId: "body_bolt" },
        transform: { translation: [30, 0, 0] }
      }
    ]);

    const grounded = engine.apply({
      op: "assembly.mate.create",
      id: "mate_ground",
      assemblyId: "asm_root",
      name: "Ground",
      kind: "fixed",
      instanceId: "inst_root"
    });
    expect(grounded.transaction.diff).toMatchObject({
      assemblies: {
        matesCreated: [
          {
            id: "mate_ground",
            assemblyId: "asm_root",
            name: "Ground",
            kind: "fixed",
            instanceId: "inst_root"
          }
        ]
      }
    });

    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(structure).toMatchObject({
      ok: true,
      assemblies: [
        {
          id: "asm_root",
          instances: [{ id: "inst_root" }, { id: "inst_child" }],
          mates: [
            {
              id: "mate_ground",
              kind: "fixed",
              instanceId: "inst_root"
            }
          ]
        }
      ]
    });
    expect(JSON.stringify(structure)).not.toMatch(PRIVATE_ID_PATTERN);

    const exported = exportCadProject(engine);
    expect(exported.schemaVersion).not.toBe("web-cad.project.v23");
    expect(exported.schemaVersion).not.toBe("web-cad.project.v26");
    expect(exported.document.assemblies?.[0]?.mates).toEqual([
      {
        id: "mate_ground",
        name: "Ground",
        kind: "fixed",
        instanceId: "inst_root"
      }
    ]);

    const restored = importCadProject(exported);
    expect(exportCadProject(restored).document.assemblies).toEqual(
      exported.document.assemblies
    );
  });

  it("rejects duplicate fixed mates on the same instance", () => {
    const engine = new CadEngine();
    seedCompletedBolt(engine);
    engine.applyBatch([
      { op: "assembly.create", id: "asm_root", name: "Root assembly" },
      {
        op: "assembly.instance.insert",
        id: "inst_root",
        assemblyId: "asm_root",
        name: "Root",
        definition: { kind: "body", bodyId: "body_bolt" }
      },
      {
        op: "assembly.mate.create",
        id: "mate_ground",
        assemblyId: "asm_root",
        kind: "fixed",
        instanceId: "inst_root"
      }
    ]);

    expect(() =>
      engine.apply({
        op: "assembly.mate.create",
        id: "mate_ground_2",
        assemblyId: "asm_root",
        kind: "fixed",
        instanceId: "inst_root"
      })
    ).toThrow(/already has a fixed mate/);
  });
});

describe("V26 slice C coincident plane mate", () => {
  it("stacks two instances with coincident XY planes and persists pose", () => {
    const engine = new CadEngine();
    seedCompletedBolt(engine);
    engine.applyBatch([
      { op: "assembly.create", id: "asm_stack", name: "Stack assembly" },
      {
        op: "assembly.instance.insert",
        id: "inst_base",
        assemblyId: "asm_stack",
        name: "Base",
        definition: { kind: "body", bodyId: "body_bolt" },
        transform: { translation: [0, 0, 0] }
      },
      {
        op: "assembly.instance.insert",
        id: "inst_top",
        assemblyId: "asm_stack",
        name: "Top",
        definition: { kind: "body", bodyId: "body_bolt" },
        transform: { translation: [0, 0, 50] }
      },
      {
        op: "assembly.mate.create",
        id: "mate_ground",
        assemblyId: "asm_stack",
        name: "Ground",
        kind: "fixed",
        instanceId: "inst_base"
      }
    ]);

    const stacked = engine.apply({
      op: "assembly.mate.create",
      id: "mate_stack",
      assemblyId: "asm_stack",
      name: "Stack",
      kind: "coincident",
      primary: { instanceId: "inst_base", plane: "XY", offset: 20 },
      secondary: { instanceId: "inst_top", plane: "XY" }
    });
    expect(stacked.transaction.diff).toMatchObject({
      assemblies: {
        matesCreated: [
          {
            id: "mate_stack",
            kind: "coincident",
            primary: { instanceId: "inst_base", plane: "XY", offset: 20 },
            secondary: { instanceId: "inst_top", plane: "XY" }
          }
        ],
        instancesModified: [
          {
            id: "inst_top",
            transform: { translation: [0, 0, 20] }
          }
        ]
      }
    });

    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(structure).toMatchObject({
      ok: true,
      assemblies: [
        {
          id: "asm_stack",
          instances: [
            { id: "inst_base", transform: { translation: [0, 0, 0] } },
            { id: "inst_top", transform: { translation: [0, 0, 20] } }
          ],
          mates: [
            { id: "mate_ground", kind: "fixed", instanceId: "inst_base" },
            {
              id: "mate_stack",
              kind: "coincident",
              primary: { instanceId: "inst_base", plane: "XY", offset: 20 },
              secondary: { instanceId: "inst_top", plane: "XY" }
            }
          ]
        }
      ]
    });
    expect(JSON.stringify(structure)).not.toMatch(PRIVATE_ID_PATTERN);

    const exported = exportCadProject(engine);
    expect(exported.schemaVersion).not.toBe("web-cad.project.v23");
    expect(exported.schemaVersion).not.toBe("web-cad.project.v26");
    expect(exported.document.assemblies?.[0]?.mates).toEqual([
      {
        id: "mate_ground",
        name: "Ground",
        kind: "fixed",
        instanceId: "inst_base"
      },
      {
        id: "mate_stack",
        name: "Stack",
        kind: "coincident",
        primary: { instanceId: "inst_base", plane: "XY", offset: 20 },
        secondary: { instanceId: "inst_top", plane: "XY" }
      }
    ]);
    expect(exported.document.assemblies?.[0]?.instances[1]?.transform.translation).toEqual([
      0, 0, 20
    ]);

    const restored = importCadProject(exported);
    expect(exportCadProject(restored).document.assemblies).toEqual(
      exported.document.assemblies
    );
  });

  it("fails structured when underconstrained or conflicting", () => {
    const engine = new CadEngine();
    seedCompletedBolt(engine);
    engine.applyBatch([
      { op: "assembly.create", id: "asm_stack", name: "Stack assembly" },
      {
        op: "assembly.instance.insert",
        id: "inst_base",
        assemblyId: "asm_stack",
        name: "Base",
        definition: { kind: "body", bodyId: "body_bolt" }
      },
      {
        op: "assembly.instance.insert",
        id: "inst_top",
        assemblyId: "asm_stack",
        name: "Top",
        definition: { kind: "body", bodyId: "body_bolt" },
        transform: { translation: [0, 0, 50] }
      }
    ]);

    try {
      engine.apply({
        op: "assembly.mate.create",
        id: "mate_stack",
        assemblyId: "asm_stack",
        kind: "coincident",
        primary: { instanceId: "inst_base", plane: "XY", offset: 20 },
        secondary: { instanceId: "inst_top", plane: "XY" }
      });
      expect.unreachable("expected underconstrained fail");
    } catch (error) {
      expect(error).toMatchObject({
        validationError: {
          code: "ASSEMBLY_MATE_UNDERCONSTRAINED",
          message: expect.stringMatching(/underconstrained/)
        }
      });
    }

    engine.apply({
      op: "assembly.mate.create",
      id: "mate_ground_base",
      assemblyId: "asm_stack",
      kind: "fixed",
      instanceId: "inst_base"
    });
    engine.apply({
      op: "assembly.mate.create",
      id: "mate_ground_top",
      assemblyId: "asm_stack",
      kind: "fixed",
      instanceId: "inst_top"
    });

    try {
      engine.apply({
        op: "assembly.mate.create",
        id: "mate_stack",
        assemblyId: "asm_stack",
        kind: "coincident",
        primary: { instanceId: "inst_base", plane: "XY", offset: 20 },
        secondary: { instanceId: "inst_top", plane: "XY" }
      });
      expect.unreachable("expected conflicting fail");
    } catch (error) {
      expect(error).toMatchObject({
        validationError: {
          code: "ASSEMBLY_MATE_CONFLICTING",
          message: expect.stringMatching(/conflicts/)
        }
      });
    }
  });
});

describe("V26 slice D concentric axes mate", () => {
  it("mates pin into bore with concentric Z axes and persists pose", () => {
    const engine = new CadEngine();
    seedCompletedBolt(engine);
    engine.applyBatch([
      { op: "assembly.create", id: "asm_pin", name: "Pin assembly" },
      {
        op: "assembly.instance.insert",
        id: "inst_bore",
        assemblyId: "asm_pin",
        name: "Bore",
        definition: { kind: "body", bodyId: "body_bolt" },
        transform: { translation: [0, 0, 0] }
      },
      {
        op: "assembly.instance.insert",
        id: "inst_pin",
        assemblyId: "asm_pin",
        name: "Pin",
        definition: { kind: "body", bodyId: "body_bolt" },
        transform: { translation: [40, 10, 5] }
      },
      {
        op: "assembly.mate.create",
        id: "mate_ground",
        assemblyId: "asm_pin",
        name: "Ground",
        kind: "fixed",
        instanceId: "inst_bore"
      }
    ]);

    const mated = engine.apply({
      op: "assembly.mate.create",
      id: "mate_concentric",
      assemblyId: "asm_pin",
      name: "Pin in bore",
      kind: "concentric",
      primary: { instanceId: "inst_bore", axis: "Z" },
      secondary: { instanceId: "inst_pin", axis: "Z" }
    });
    expect(mated.transaction.diff).toMatchObject({
      assemblies: {
        matesCreated: [
          {
            id: "mate_concentric",
            kind: "concentric",
            primary: { instanceId: "inst_bore", axis: "Z" },
            secondary: { instanceId: "inst_pin", axis: "Z" }
          }
        ],
        instancesModified: [
          {
            id: "inst_pin",
            transform: { translation: [0, 0, 5] }
          }
        ]
      }
    });

    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(structure).toMatchObject({
      ok: true,
      assemblies: [
        {
          id: "asm_pin",
          instances: [
            { id: "inst_bore", transform: { translation: [0, 0, 0] } },
            { id: "inst_pin", transform: { translation: [0, 0, 5] } }
          ],
          mates: [
            { id: "mate_ground", kind: "fixed", instanceId: "inst_bore" },
            {
              id: "mate_concentric",
              kind: "concentric",
              primary: { instanceId: "inst_bore", axis: "Z" },
              secondary: { instanceId: "inst_pin", axis: "Z" }
            }
          ]
        }
      ]
    });
    expect(JSON.stringify(structure)).not.toMatch(PRIVATE_ID_PATTERN);

    const exported = exportCadProject(engine);
    expect(exported.schemaVersion).not.toBe("web-cad.project.v23");
    expect(exported.schemaVersion).not.toBe("web-cad.project.v26");
    expect(exported.document.assemblies?.[0]?.mates).toEqual([
      {
        id: "mate_ground",
        name: "Ground",
        kind: "fixed",
        instanceId: "inst_bore"
      },
      {
        id: "mate_concentric",
        name: "Pin in bore",
        kind: "concentric",
        primary: { instanceId: "inst_bore", axis: "Z" },
        secondary: { instanceId: "inst_pin", axis: "Z" }
      }
    ]);
    expect(exported.document.assemblies?.[0]?.instances[1]?.transform.translation).toEqual([
      0, 0, 5
    ]);

    const restored = importCadProject(exported);
    expect(exportCadProject(restored).document.assemblies).toEqual(
      exported.document.assemblies
    );
  });

  it("fails structured when underconstrained or conflicting", () => {
    const engine = new CadEngine();
    seedCompletedBolt(engine);
    engine.applyBatch([
      { op: "assembly.create", id: "asm_pin", name: "Pin assembly" },
      {
        op: "assembly.instance.insert",
        id: "inst_bore",
        assemblyId: "asm_pin",
        name: "Bore",
        definition: { kind: "body", bodyId: "body_bolt" }
      },
      {
        op: "assembly.instance.insert",
        id: "inst_pin",
        assemblyId: "asm_pin",
        name: "Pin",
        definition: { kind: "body", bodyId: "body_bolt" },
        transform: { translation: [40, 10, 5] }
      }
    ]);

    try {
      engine.apply({
        op: "assembly.mate.create",
        id: "mate_concentric",
        assemblyId: "asm_pin",
        kind: "concentric",
        primary: { instanceId: "inst_bore", axis: "Z" },
        secondary: { instanceId: "inst_pin", axis: "Z" }
      });
      expect.unreachable("expected underconstrained fail");
    } catch (error) {
      expect(error).toMatchObject({
        validationError: {
          code: "ASSEMBLY_MATE_UNDERCONSTRAINED",
          message: expect.stringMatching(/underconstrained/)
        }
      });
    }

    engine.apply({
      op: "assembly.mate.create",
      id: "mate_ground_bore",
      assemblyId: "asm_pin",
      kind: "fixed",
      instanceId: "inst_bore"
    });
    engine.apply({
      op: "assembly.mate.create",
      id: "mate_ground_pin",
      assemblyId: "asm_pin",
      kind: "fixed",
      instanceId: "inst_pin"
    });

    try {
      engine.apply({
        op: "assembly.mate.create",
        id: "mate_concentric",
        assemblyId: "asm_pin",
        kind: "concentric",
        primary: { instanceId: "inst_bore", axis: "Z" },
        secondary: { instanceId: "inst_pin", axis: "Z" }
      });
      expect.unreachable("expected conflicting fail");
    } catch (error) {
      expect(error).toMatchObject({
        validationError: {
          code: "ASSEMBLY_MATE_CONFLICTING",
          message: expect.stringMatching(/conflicts/)
        }
      });
    }
  });
});

describe("V26 slice E distance offset mate", () => {
  it("spaces two instances with a distance XY mate and persists pose", () => {
    const engine = new CadEngine();
    seedCompletedBolt(engine);
    engine.applyBatch([
      { op: "assembly.create", id: "asm_gap", name: "Gap assembly" },
      {
        op: "assembly.instance.insert",
        id: "inst_base",
        assemblyId: "asm_gap",
        name: "Base",
        definition: { kind: "body", bodyId: "body_bolt" },
        transform: { translation: [0, 0, 0] }
      },
      {
        op: "assembly.instance.insert",
        id: "inst_top",
        assemblyId: "asm_gap",
        name: "Top",
        definition: { kind: "body", bodyId: "body_bolt" },
        transform: { translation: [0, 0, 50] }
      },
      {
        op: "assembly.mate.create",
        id: "mate_ground",
        assemblyId: "asm_gap",
        name: "Ground",
        kind: "fixed",
        instanceId: "inst_base"
      }
    ]);

    const spaced = engine.apply({
      op: "assembly.mate.create",
      id: "mate_gap",
      assemblyId: "asm_gap",
      name: "Gap",
      kind: "distance",
      primary: { instanceId: "inst_base", plane: "XY" },
      secondary: { instanceId: "inst_top", plane: "XY" },
      distance: 30
    });
    expect(spaced.transaction.diff).toMatchObject({
      assemblies: {
        matesCreated: [
          {
            id: "mate_gap",
            kind: "distance",
            primary: { instanceId: "inst_base", plane: "XY" },
            secondary: { instanceId: "inst_top", plane: "XY" },
            distance: 30
          }
        ],
        instancesModified: [
          {
            id: "inst_top",
            transform: { translation: [0, 0, 30] }
          }
        ]
      }
    });

    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(structure).toMatchObject({
      ok: true,
      assemblies: [
        {
          id: "asm_gap",
          instances: [
            { id: "inst_base", transform: { translation: [0, 0, 0] } },
            { id: "inst_top", transform: { translation: [0, 0, 30] } }
          ],
          mates: [
            { id: "mate_ground", kind: "fixed", instanceId: "inst_base" },
            {
              id: "mate_gap",
              kind: "distance",
              primary: { instanceId: "inst_base", plane: "XY" },
              secondary: { instanceId: "inst_top", plane: "XY" },
              distance: 30
            }
          ]
        }
      ]
    });
    expect(JSON.stringify(structure)).not.toMatch(PRIVATE_ID_PATTERN);

    const exported = exportCadProject(engine);
    expect(exported.schemaVersion).not.toBe("web-cad.project.v23");
    expect(exported.schemaVersion).not.toBe("web-cad.project.v26");
    expect(exported.document.assemblies?.[0]?.mates).toEqual([
      {
        id: "mate_ground",
        name: "Ground",
        kind: "fixed",
        instanceId: "inst_base"
      },
      {
        id: "mate_gap",
        name: "Gap",
        kind: "distance",
        primary: { instanceId: "inst_base", plane: "XY" },
        secondary: { instanceId: "inst_top", plane: "XY" },
        distance: 30
      }
    ]);
    expect(exported.document.assemblies?.[0]?.instances[1]?.transform.translation).toEqual([
      0, 0, 30
    ]);

    const restored = importCadProject(exported);
    expect(exportCadProject(restored).document.assemblies).toEqual(
      exported.document.assemblies
    );
  });

  it("fails structured when underconstrained or conflicting", () => {
    const engine = new CadEngine();
    seedCompletedBolt(engine);
    engine.applyBatch([
      { op: "assembly.create", id: "asm_gap", name: "Gap assembly" },
      {
        op: "assembly.instance.insert",
        id: "inst_base",
        assemblyId: "asm_gap",
        name: "Base",
        definition: { kind: "body", bodyId: "body_bolt" }
      },
      {
        op: "assembly.instance.insert",
        id: "inst_top",
        assemblyId: "asm_gap",
        name: "Top",
        definition: { kind: "body", bodyId: "body_bolt" },
        transform: { translation: [0, 0, 50] }
      }
    ]);

    try {
      engine.apply({
        op: "assembly.mate.create",
        id: "mate_gap",
        assemblyId: "asm_gap",
        kind: "distance",
        primary: { instanceId: "inst_base", plane: "XY" },
        secondary: { instanceId: "inst_top", plane: "XY" },
        distance: 30
      });
      expect.unreachable("expected underconstrained fail");
    } catch (error) {
      expect(error).toMatchObject({
        validationError: {
          code: "ASSEMBLY_MATE_UNDERCONSTRAINED",
          message: expect.stringMatching(/underconstrained/)
        }
      });
    }

    engine.apply({
      op: "assembly.mate.create",
      id: "mate_ground_base",
      assemblyId: "asm_gap",
      kind: "fixed",
      instanceId: "inst_base"
    });
    engine.apply({
      op: "assembly.mate.create",
      id: "mate_ground_top",
      assemblyId: "asm_gap",
      kind: "fixed",
      instanceId: "inst_top"
    });

    try {
      engine.apply({
        op: "assembly.mate.create",
        id: "mate_gap",
        assemblyId: "asm_gap",
        kind: "distance",
        primary: { instanceId: "inst_base", plane: "XY" },
        secondary: { instanceId: "inst_top", plane: "XY" },
        distance: 30
      });
      expect.unreachable("expected conflicting fail");
    } catch (error) {
      expect(error).toMatchObject({
        validationError: {
          code: "ASSEMBLY_MATE_CONFLICTING",
          message: expect.stringMatching(/conflicts/)
        }
      });
    }
  });
});

describe("V26 slice F instance and mate CRUD", () => {
  function seedTwoBodies(engine: CadEngine): void {
    seedCompletedBolt(engine);
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_nut", name: "Nut", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_nut",
        id: "circle_nut",
        center: [0, 0],
        radius: 8
      },
      {
        op: "feature.extrude",
        id: "feat_nut",
        bodyId: "body_nut",
        sketchId: "sketch_nut",
        entityId: "circle_nut",
        depth: 10
      }
    ]);
  }

  function seedCrudAssembly(engine: CadEngine): void {
    seedTwoBodies(engine);
    engine.applyBatch([
      { op: "assembly.create", id: "asm_crud", name: "CRUD assembly" },
      {
        op: "assembly.instance.insert",
        id: "inst_base",
        assemblyId: "asm_crud",
        name: "Base",
        definition: { kind: "body", bodyId: "body_bolt" }
      },
      {
        op: "assembly.instance.insert",
        id: "inst_top",
        assemblyId: "asm_crud",
        name: "Top",
        definition: { kind: "body", bodyId: "body_bolt" },
        transform: { translation: [0, 0, 50] }
      },
      {
        op: "assembly.mate.create",
        id: "mate_ground",
        assemblyId: "asm_crud",
        kind: "fixed",
        instanceId: "inst_base"
      },
      {
        op: "assembly.mate.create",
        id: "mate_gap",
        assemblyId: "asm_crud",
        name: "Gap",
        kind: "distance",
        primary: { instanceId: "inst_base", plane: "XY" },
        secondary: { instanceId: "inst_top", plane: "XY" },
        distance: 30
      }
    ]);
  }

  it("edits a distance mate and re-solves pose", () => {
    const engine = new CadEngine();
    seedCrudAssembly(engine);
    const edited = engine.apply({
      op: "assembly.mate.edit",
      mateId: "mate_gap",
      assemblyId: "asm_crud",
      name: "Gap wide",
      kind: "distance",
      primary: { instanceId: "inst_base", plane: "XY" },
      secondary: { instanceId: "inst_top", plane: "XY" },
      distance: 40
    });
    expect(edited.transaction.diff.assemblies?.matesModified).toEqual([
      expect.objectContaining({
        id: "mate_gap",
        kind: "distance",
        distance: 40,
        name: "Gap wide"
      })
    ]);
    expect(edited.transaction.diff.assemblies?.matesCreated ?? []).toHaveLength(0);
    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(structure).toMatchObject({
      ok: true,
      assemblies: [
        {
          id: "asm_crud",
          instances: [
            { id: "inst_base" },
            { id: "inst_top", transform: { translation: [0, 0, 40] } }
          ],
          mates: [
            { id: "mate_ground", kind: "fixed" },
            { id: "mate_gap", kind: "distance", distance: 40 }
          ]
        }
      ]
    });
  });

  it("replaces an instance definition without duplicating bodies", () => {
    const engine = new CadEngine();
    seedCrudAssembly(engine);
    const replaced = engine.apply({
      op: "assembly.instance.replace",
      assemblyId: "asm_crud",
      instanceId: "inst_top",
      definition: { kind: "body", bodyId: "body_nut" }
    });
    expect(replaced.transaction.diff.assemblies?.instancesModified).toEqual([
      expect.objectContaining({
        id: "inst_top",
        definition: { kind: "body", bodyId: "body_nut" }
      })
    ]);
    expect(replaced.transaction.diff.features?.bodiesCreated).toBeUndefined();
    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(structure).toMatchObject({
      ok: true,
      bodyCount: 2,
      assemblies: [
        {
          instances: [
            { id: "inst_base", definition: { kind: "body", bodyId: "body_bolt" } },
            {
              id: "inst_top",
              definition: { kind: "body", bodyId: "body_nut" },
              transform: { translation: [0, 0, 30] }
            }
          ]
        }
      ]
    });
  });

  it("deletes a mate and leaves instance transforms", () => {
    const engine = new CadEngine();
    seedCrudAssembly(engine);
    const deleted = engine.apply({
      op: "assembly.mate.delete",
      assemblyId: "asm_crud",
      mateId: "mate_gap"
    });
    expect(deleted.transaction.diff.assemblies?.matesDeleted).toEqual([
      expect.objectContaining({ id: "mate_gap", kind: "distance" })
    ]);
    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(structure).toMatchObject({
      ok: true,
      assemblies: [
        {
          instances: [
            { id: "inst_base" },
            { id: "inst_top", transform: { translation: [0, 0, 30] } }
          ],
          mates: [{ id: "mate_ground", kind: "fixed" }]
        }
      ]
    });
  });

  it("deletes an instance and cascade-deletes referencing mates", () => {
    const engine = new CadEngine();
    seedCrudAssembly(engine);
    const deleted = engine.apply({
      op: "assembly.instance.delete",
      assemblyId: "asm_crud",
      instanceId: "inst_top"
    });
    expect(deleted.transaction.diff.assemblies?.instancesDeleted).toEqual([
      expect.objectContaining({ id: "inst_top" })
    ]);
    expect(deleted.transaction.diff.assemblies?.matesDeleted).toEqual([
      expect.objectContaining({ id: "mate_gap", kind: "distance" })
    ]);
    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(structure).toMatchObject({
      ok: true,
      assemblies: [
        {
          instances: [{ id: "inst_base" }],
          mates: [{ id: "mate_ground", kind: "fixed" }]
        }
      ]
    });
  });
});

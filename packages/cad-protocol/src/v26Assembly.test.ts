import { describe, expect, it } from "vitest";
import {
  CAD_V19_PROJECT_SCHEMA_VERSION,
  type AssemblyCreateOp,
  type AssemblyInstanceInsertOp,
  type AssemblyMateCreateOp,
  type AssemblySnapshot,
  type CadOp
} from "./index";

describe("assembly definition/instance protocol", () => {
  it("names assembly.create and assembly.instance.insert without a schema bump", () => {
    const create: AssemblyCreateOp = {
      op: "assembly.create",
      id: "asm_bolt",
      name: "Bolt assembly"
    };
    const insertA: AssemblyInstanceInsertOp = {
      op: "assembly.instance.insert",
      id: "inst_bolt_a",
      assemblyId: "asm_bolt",
      name: "Bolt A",
      definition: { kind: "body", bodyId: "body_bolt" },
      transform: { translation: [0, 0, 0] }
    };
    const insertB: AssemblyInstanceInsertOp = {
      op: "assembly.instance.insert",
      id: "inst_bolt_b",
      assemblyId: "asm_bolt",
      name: "Bolt B",
      definition: { kind: "body", bodyId: "body_bolt" },
      transform: { translation: [40, 0, 0] }
    };
    const snapshot: AssemblySnapshot = {
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
    };
    const ops: readonly CadOp[] = [create, insertA, insertB];

    expect(ops.map((op) => op.op)).toEqual([
      "assembly.create",
      "assembly.instance.insert",
      "assembly.instance.insert"
    ]);
    expect(insertA.definition).toEqual(insertB.definition);
    expect(insertA.transform).not.toEqual(insertB.transform);
    expect(snapshot.instances).toHaveLength(2);
    expect(
      new Set(snapshot.instances.map((instance) => instance.definition.bodyId))
        .size
    ).toBe(1);
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v22");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).not.toBe("web-cad.project.v23");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).not.toBe("web-cad.project.v26");
  });

  it("names assembly.mate.create kind fixed for a grounded root instance", () => {
    const fixed: AssemblyMateCreateOp = {
      op: "assembly.mate.create",
      id: "mate_ground",
      assemblyId: "asm_bolt",
      name: "Ground",
      kind: "fixed",
      instanceId: "inst_bolt_a"
    };
    const snapshot: AssemblySnapshot = {
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
        }
      ],
      mates: [
        {
          id: "mate_ground",
          name: "Ground",
          kind: "fixed",
          instanceId: "inst_bolt_a"
        }
      ]
    };
    const ops: readonly CadOp[] = [fixed];
    expect(ops.map((op) => op.op)).toEqual(["assembly.mate.create"]);
    expect(fixed.kind).toBe("fixed");
    expect(snapshot.mates?.[0]?.kind).toBe("fixed");
    expect(
      snapshot.mates?.[0]?.kind === "fixed"
        ? snapshot.mates[0].instanceId
        : undefined
    ).toBe("inst_bolt_a");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v22");
  });

  it("names assembly.mate.create kind coincident for plane-plane refs", () => {
    const coincident: AssemblyMateCreateOp = {
      op: "assembly.mate.create",
      id: "mate_stack",
      assemblyId: "asm_stack",
      name: "Stack",
      kind: "coincident",
      primary: { instanceId: "inst_base", plane: "XY", offset: 20 },
      secondary: { instanceId: "inst_top", plane: "XY" }
    };
    const snapshot: AssemblySnapshot = {
      id: "asm_stack",
      name: "Stack assembly",
      instances: [
        {
          id: "inst_base",
          name: "Base",
          definition: { kind: "body", bodyId: "body_plate" },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        },
        {
          id: "inst_top",
          name: "Top",
          definition: { kind: "body", bodyId: "body_plate" },
          transform: {
            translation: [0, 0, 20],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      ],
      mates: [
        {
          id: "mate_stack",
          name: "Stack",
          kind: "coincident",
          primary: { instanceId: "inst_base", plane: "XY", offset: 20 },
          secondary: { instanceId: "inst_top", plane: "XY" }
        }
      ]
    };
    const ops: readonly CadOp[] = [coincident];
    expect(ops.map((op) => op.op)).toEqual(["assembly.mate.create"]);
    expect(coincident.kind).toBe("coincident");
    expect(snapshot.mates?.[0]?.kind).toBe("coincident");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v22");
  });

  it("names assembly.mate.create kind concentric for axis-axis refs", () => {
    const concentric: AssemblyMateCreateOp = {
      op: "assembly.mate.create",
      id: "mate_concentric",
      assemblyId: "asm_pin",
      name: "Pin in bore",
      kind: "concentric",
      primary: { instanceId: "inst_bore", axis: "Z" },
      secondary: { instanceId: "inst_pin", axis: "Z" }
    };
    const snapshot: AssemblySnapshot = {
      id: "asm_pin",
      name: "Pin assembly",
      instances: [
        {
          id: "inst_bore",
          name: "Bore",
          definition: { kind: "body", bodyId: "body_bore" },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        },
        {
          id: "inst_pin",
          name: "Pin",
          definition: { kind: "body", bodyId: "body_pin" },
          transform: {
            translation: [0, 0, 5],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      ],
      mates: [
        {
          id: "mate_concentric",
          name: "Pin in bore",
          kind: "concentric",
          primary: { instanceId: "inst_bore", axis: "Z" },
          secondary: { instanceId: "inst_pin", axis: "Z" }
        }
      ]
    };
    const ops: readonly CadOp[] = [concentric];
    expect(ops.map((op) => op.op)).toEqual(["assembly.mate.create"]);
    expect(concentric.kind).toBe("concentric");
    expect(snapshot.mates?.[0]?.kind).toBe("concentric");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v22");
  });

  it("names assembly.mate.create kind distance for plane-plane separation", () => {
    const distance: AssemblyMateCreateOp = {
      op: "assembly.mate.create",
      id: "mate_gap",
      assemblyId: "asm_gap",
      name: "Gap",
      kind: "distance",
      primary: { instanceId: "inst_base", plane: "XY" },
      secondary: { instanceId: "inst_top", plane: "XY" },
      distance: 30
    };
    const snapshot: AssemblySnapshot = {
      id: "asm_gap",
      name: "Gap assembly",
      instances: [
        {
          id: "inst_base",
          name: "Base",
          definition: { kind: "body", bodyId: "body_plate" },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        },
        {
          id: "inst_top",
          name: "Top",
          definition: { kind: "body", bodyId: "body_plate" },
          transform: {
            translation: [0, 0, 30],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      ],
      mates: [
        {
          id: "mate_gap",
          name: "Gap",
          kind: "distance",
          primary: { instanceId: "inst_base", plane: "XY" },
          secondary: { instanceId: "inst_top", plane: "XY" },
          distance: 30
        }
      ]
    };
    const ops: readonly CadOp[] = [distance];
    expect(ops.map((op) => op.op)).toEqual(["assembly.mate.create"]);
    expect(distance.kind).toBe("distance");
    expect(snapshot.mates?.[0]?.kind).toBe("distance");
    expect(CAD_V19_PROJECT_SCHEMA_VERSION).toBe("web-cad.project.v22");
  });
});

import { describe, expect, it } from "vitest";
import {
  CAD_V19_PROJECT_SCHEMA_VERSION,
  type AssemblyCreateOp,
  type AssemblyInstanceInsertOp,
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
});

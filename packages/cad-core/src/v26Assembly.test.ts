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

import { expect, it } from "vitest";
import { CadEngine } from "@web-cad/cad-core";
import { createCadSession } from "../index";
import { createProjectStepExportScope } from "./projectStepAssembly";

function assemblyFixture() {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "profile", name: "Profile", plane: "XY" },
    {
      op: "sketch.addCircle",
      sketchId: "profile",
      id: "circle",
      center: [0, 0],
      radius: 1
    },
    {
      op: "feature.extrude",
      id: "part",
      bodyId: "body",
      sketchId: "profile",
      entityId: "circle",
      depth: 2
    },
    {
      op: "feature.extrude",
      id: "standalone",
      bodyId: "step_assembly_1",
      sketchId: "profile",
      entityId: "circle",
      depth: 3
    },
    { op: "assembly.create", id: "body", name: "Selected assembly" },
    { op: "assembly.create", id: "child", name: "Nested assembly" },
    { op: "assembly.create", id: "empty" },
    {
      op: "assembly.instance.insert",
      assemblyId: "child",
      id: "leaf",
      definition: { kind: "body", bodyId: "body" },
      transform: { translation: [3, 0, 0] }
    },
    {
      op: "assembly.instance.insert",
      assemblyId: "body",
      id: "nested",
      definition: { kind: "assembly", assemblyId: "child" },
      transform: { translation: [0, 5, 0] }
    }
  ]);
  return engine;
}

it("exports only the selected assembly and separates overlapping source ID namespaces", () => {
  const engine = assemblyFixture(),
    before = engine.exportProject();
  const selected = createProjectStepExportScope(engine, {
    assemblyIds: ["body"]
  });
  expect(selected.bodyIds).toEqual(["body"]);
  expect(selected.assembly?.occurrenceCount).toBe(1);
  expect(
    selected.assembly?.definitions.map((definition) => definition.name)
  ).toEqual(["Selected assembly", "Nested assembly"]);
  const definitionIds = [
    ...selected.bodyIds!,
    ...selected.assembly!.definitions.map((definition) => definition.id)
  ];
  expect(new Set(definitionIds).size).toBe(definitionIds.length);
  const root = selected.assembly!.roots[0]!;
  const parent = selected.assembly!.definitions.find(
    (definition) => definition.id === root.definitionId
  )!;
  const child = selected.assembly!.definitions.find(
    (definition) => definition.id === parent.components[0]!.definitionId
  )!;
  expect(child.components[0]?.definitionId).toBe("body");
  [1, 0, 0, 3, 0, 1, 0, 0, 0, 0, 1, 0].forEach((value, index) =>
    expect(child.components[0]?.transform[index]).toBeCloseTo(value, 12)
  );
  const full = createProjectStepExportScope(engine);
  expect(full.bodyIds).toEqual(["body", "step_assembly_1"]);
  expect(full.assembly?.occurrenceCount).toBe(2);
  const allIds = [
    ...full.bodyIds!,
    ...full.assembly!.definitions.map((definition) => definition.id)
  ];
  expect(new Set(allIds).size).toBe(allIds.length);
  expect(engine.exportProject()).toEqual(before);
});

it("rejects empty selection and nonrigid placements before geometry work without changing source", async () => {
  const engine = assemblyFixture();
  for (const options of [
    { bodyIds: [] },
    { bodyIds: ["body", "body"] },
    { assemblyIds: [] },
    { assemblyIds: ["empty"] }
  ])
    expect(() => createProjectStepExportScope(engine, options)).toThrow(
      /Select/
    );
  engine.apply({
    op: "assembly.instance.updateTransform",
    assemblyId: "child",
    instanceId: "leaf",
    transform: { scale: [2, 1, 1] }
  });
  const before = engine.exportProject();
  const session = createCadSession({ project: before });
  try {
    await expect(session.exportStep({ assemblyIds: ["body"] })).rejects.toThrow(
      /rigid placement/
    );
    expect(session.engine.exportProject()).toEqual(before);
  } finally {
    session.dispose();
  }
});

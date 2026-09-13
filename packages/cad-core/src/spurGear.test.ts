import { describe, expect, it } from "vitest";
import {
  CadEngine,
  exportCadProject,
  importCadProject,
  exportCadProjectWcad,
  importCadProjectWcad
} from "./index";
import { createSpurGearGeometry, resolveSpurGearValues } from "./spurGear";
import { createBodyGeneratedReferences } from "./generatedReferences";
import type { FeatureSpurGearOp, SketchSnapshot } from "@web-cad/cad-protocol";
const gear: FeatureSpurGearOp = {
  op: "feature.spurGear",
  id: "gear",
  sketchId: "gear-source",
  bodyId: "gear-body",
  teeth: { parameterId: "teeth" },
  module: 1.5,
  faceWidth: 10,
  boreDiameter: 8.1,
  backlash: 0.08
};
function create() {
  const e = new CadEngine();
  e.applyBatch([
    { op: "parameter.create", id: "teeth", name: "teeth", value: 20 },
    gear
  ]);
  return e;
}
function toothCount(e: CadEngine) {
  const s = e.getDocument().sketches.get("gear-source")!;
  const v = s.spurGear!.values;
  return [...s.entities.values()].filter(
    (e) =>
      e.kind === "arc" &&
      Math.hypot(...e.center) < 1e-10 &&
      Math.abs(e.radius - v.module * (v.teeth / 2 + 1)) < 1e-8
  ).length;
}
describe("parametric spur gears", () => {
  it("keeps generated references bounded and deterministic through tooth revisions", () => {
    const e = create();
    const references = () =>
      createBodyGeneratedReferences(e.getDocument(), "gear-body", "part_1")!;
    const initial = references();
    const initialCap = initial.faces[0]!.stableId;
    expect(initialCap).toContain("gear-loop-sha256");
    e.applyBatch([{ op: "parameter.update", id: "teeth", value: 60 }]);
    const revised = references();
    expect(revised.faces[0]!.stableId).not.toBe(initialCap);
    for (const reference of [
      ...revised.faces,
      ...revised.edges,
      ...revised.vertices
    ]) {
      expect(reference.stableId.length).toBeLessThan(300);
    }
    expect(JSON.stringify(e.getTransactions().at(-1)).length).toBeLessThan(
      1_500_000
    );
    e.applyBatch([{ op: "parameter.update", id: "teeth", value: 20 }]);
    expect(references()).toEqual(initial);

    // Editable regions keep their existing identity convention.
    const document = e.getDocument();
    const sketches = new Map(document.sketches);
    const sketch = sketches.get("gear-source")!;
    const { spurGear: _recipe, ...editable } = sketch;
    void _recipe;
    sketches.set(sketch.id, editable);
    const legacy = createBodyGeneratedReferences(
      { ...document, sketches },
      "gear-body",
      "part_1"
    )!;
    expect(legacy.faces[0]!.stableId).not.toContain("gear-loop-sha256");
    expect(legacy.faces[0]!.stableId).toContain(
      encodeURIComponent("gear-source:edge:0")
    );
  });
  it("regenerates actual teeth and bore under one native parameter change with stable IDs and history", () => {
    const e = create(),
      before = e.createSnapshot();
    expect(toothCount(e)).toBe(20);
    const changed = e.applyBatch([
      { op: "parameter.update", id: "teeth", value: 60 }
    ]);
    expect(toothCount(e)).toBe(60);
    expect(e.getDocument().features.get("gear")?.bodyId).toBe("gear-body");
    expect(
      changed.transaction.diff.features?.bodiesModified?.map((b) => b.id)
    ).toContain("gear-body");
    const s = e.getDocument().sketches.get("gear-source")!;
    expect(s.spurGear?.values.teeth).toBe(60);
    expect(s.entities.get("gear-source:bore")).toMatchObject({ radius: 4.05 });
    e.undo();
    expect(e.createSnapshot()).toEqual(before);
    e.redo();
    expect(toothCount(e)).toBe(60);
  });
  it("updates input bindings, names and face width through the gear command", () => {
    const e = create();
    e.applyBatch([
      {
        op: "feature.updateSpurGear",
        id: "gear",
        teeth: 40,
        faceWidth: 12,
        name: "Output gear"
      }
    ]);
    expect(toothCount(e)).toBe(40);
    expect(e.getDocument().features.get("gear")).toMatchObject({
      depth: 12,
      name: "Output gear"
    });
    expect(
      e.getTransactions().at(-1)?.diff.sketches?.modified?.at(-1)?.id
    ).toBe("gear-source");
    expect(e.getDocument().sketches.get("gear-source")?.name).toBe(
      "Output gear profile"
    );
    e.applyBatch([{ op: "parameter.update", id: "teeth", value: 60 }]);
    expect(toothCount(e)).toBe(40);
  });
  it("does not touch generated entities or body diffs for unrelated motion parameters", () => {
    const e = create();
    e.applyBatch([
      { op: "parameter.create", id: "angle", name: "angle", value: 0 }
    ]);
    const before = e.getDocument().sketches.get("gear-source");
    const r = e.applyBatch([
      { op: "parameter.update", id: "angle", value: 90 }
    ]);
    expect(r.transaction.diff.features?.bodiesModified ?? []).toEqual([]);
    expect(r.transaction.diff.sketches?.entitiesModified ?? []).toEqual([]);
    expect(e.getDocument().sketches.get("gear-source")).toEqual(before);
  });
  it("rejects invalid bound values and manual source drift atomically", () => {
    const e = create(),
      before = e.createSnapshot();
    for (const op of [
      { op: "parameter.update", id: "teeth", value: 20.5 },
      { op: "parameter.delete", id: "teeth" },
      { op: "feature.updateSpurGear", id: "gear", boreDiameter: 100 },
      {
        op: "sketch.updateEntity",
        sketchId: "gear-source",
        entity: {
          id: "gear-source:edge:0",
          kind: "line",
          start: [1, 2],
          end: [3, 4]
        }
      },
      { op: "feature.updateExtrude", id: "gear", depth: 99, side: "negative" }
    ] as const) {
      expect(() => e.applyBatch([op])).toThrow();
      expect(e.createSnapshot()).toEqual(before);
    }
  });
  it("persists the recipe and can revise after JSON and native reopening", async () => {
    const e = create();
    const project = exportCadProject(e);
    const imported = importCadProject(project);
    expect(imported).toBeInstanceOf(CadEngine);
    imported.applyBatch([{ op: "parameter.update", id: "teeth", value: 40 }]);
    expect(toothCount(imported)).toBe(40);
    const reopened = await importCadProjectWcad(
      (await exportCadProjectWcad(e)).bytes
    );
    expect(
      reopened.getDocument().sketches.get("gear-source")?.spurGear
    ).toEqual(e.getDocument().sketches.get("gear-source")?.spurGear);
    reopened.applyBatch([{ op: "parameter.update", id: "teeth", value: 60 }]);
    expect(toothCount(reopened)).toBe(60);
  });
  it("rejects forged stored recipes and generated coordinates during import", () => {
    type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
    const mutations: Array<(s: Mutable<SketchSnapshot>) => void> = [
      (s) => {
        s.spurGear!.values.teeth = 40;
      },
      (s) => {
        const e = s.entities.find((e) => e.kind === "arc")!;
        if (e.kind === "arc") e.radius += 1;
      },
      (s) => {
        s.spurGear!.inputs.teeth = { parameterId: "missing" };
      }
    ];
    for (const mutate of mutations) {
      const project = structuredClone(exportCadProject(create()));
      mutate(project.document.sketches[0]! as Mutable<SketchSnapshot>);
      expect(() => importCadProject(project)).toThrow(
        /Invalid Partbench project JSON/
      );
    }
  });
  it("preserves physical gear dimensions and tooth count through native unit conversion", () => {
    const e = create();
    e.applyBatch([
      { op: "document.updateUnits", units: "in", mode: "preservePhysicalSize" }
    ]);
    expect(e.getDocument().parameters.get("teeth")?.value).toBe(20);
    expect(
      e.getDocument().sketches.get("gear-source")?.spurGear?.values.module
    ).toBeCloseTo(1.5 / 25.4, 10);
    const restored = importCadProject(exportCadProject(e));
    restored.applyBatch([{ op: "parameter.update", id: "teeth", value: 40 }]);
    expect(toothCount(restored)).toBe(40);
  });
  it("rejects generated ID collisions during a tooth-count revision", () => {
    const e = create();
    e.applyBatch([
      { op: "sketch.create", id: "other", name: "Other", plane: "XY" },
      {
        op: "sketch.addPoint",
        sketchId: "other",
        id: "gear-source:edge:300",
        point: [0, 0]
      }
    ]);
    const before = e.createSnapshot();
    expect(() =>
      e.applyBatch([{ op: "parameter.update", id: "teeth", value: 60 }])
    ).toThrow(/already in use/);
    expect(e.createSnapshot()).toEqual(before);
  });
  it("routes ordinary depth edits through the recipe and rejects independent generated-profile consumers", () => {
    const e = create();
    e.applyBatch([{ op: "feature.updateExtrude", id: "gear", depth: 12 }]);
    expect(
      e.getDocument().sketches.get("gear-source")?.spurGear?.values.faceWidth
    ).toBe(12);
    const before = e.createSnapshot();
    expect(() =>
      e.applyBatch([
        {
          op: "feature.extrude",
          id: "copy",
          bodyId: "copy",
          sketchId: "gear-source",
          entityId: "gear-source:bore",
          depth: 3
        }
      ])
    ).toThrow(/belong/);
    expect(e.createSnapshot()).toEqual(before);
  });
  it("bounds profile work without reducing validation of real geometry", () => {
    expect(() =>
      createSpurGearGeometry(
        "g",
        resolveSpurGearValues(
          { teeth: 128, module: 1.5, faceWidth: 10, profileTolerance: 1e-12 },
          new Map()
        )
      )
    ).toThrow();
    for (const n of [20, 40, 60]) {
      const v = resolveSpurGearValues(
        { teeth: n, module: 1.5, faceWidth: 10 },
        new Map()
      );
      const g = createSpurGearGeometry("g", v);
      expect(g.entities.length).toBeLessThan(4096);
      const arcs = g.entities.filter(
        (e): e is Extract<typeof e, { kind: "arc" }> =>
          e.kind === "arc" && Math.hypot(...e.center) < 1e-10
      );
      expect(
        arcs.filter((a) => Math.abs(a.radius - 1.5 * (n / 2 + 1)) < 1e-8)
      ).toHaveLength(n);
      expect(
        arcs.filter((a) => Math.abs(a.radius - 1.5 * (n / 2 - 1.25)) < 1e-8)
      ).toHaveLength(n);
    }
  });
});

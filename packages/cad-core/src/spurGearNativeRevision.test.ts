import { describe, expect, it } from "vitest";
import type { CadOp } from "@web-cad/cad-protocol";
import {
  CadEngine,
  createCadProjectSourceIdentity,
  exportCadProjectWcad,
  importCadProjectWcad
} from "./index";

describe("native gear revision replay", () => {
  it("accepts only tiny generated roundoff and preserves saved coordinates through motion history", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "parameter.create", id: "angle", name: "angle", value: 0 },
      {
        op: "feature.spurGear",
        id: "gear",
        bodyId: "gear_body",
        sketchId: "gear_profile",
        teeth: 20,
        module: 1.5,
        faceWidth: 10
      },
      { op: "sketch.create", id: "authored", name: "Authored", plane: "XY" },
      {
        op: "sketch.addCircle",
        id: "authored_circle",
        sketchId: "authored",
        center: [0, 0],
        radius: 3
      }
    ]);
    engine.apply({ op: "parameter.update", id: "angle", value: 90 });
    engine.apply({ op: "parameter.update", id: "angle", value: 180 });
    const project = structuredClone(engine.exportProject());
    const sketch = project.document.sketches.find(
      (s) => s.id === "gear_profile"
    )!;
    const line = sketch.entities.find((e) => e.kind === "line")!;
    if (line.kind !== "line") throw new Error("Expected generated line");
    (line.end as [number, number])[0] += 1e-14;
    const expected = createCadProjectSourceIdentity(project);
    const reopened = CadEngine.fromProject(project);
    expect(createCadProjectSourceIdentity(reopened.exportProject())).toEqual(
      expected
    );
    const savedEntities = reopened
      .getDocument()
      .sketches.get(sketch.id)!.entities;
    const assertRetained = () =>
      expect(reopened.getDocument().sketches.get(sketch.id)!.entities).toEqual(
        savedEntities
      );
    reopened.undo();
    assertRetained();
    reopened.redo();
    assertRetained();
    reopened.apply({ op: "parameter.update", id: "angle", value: 270 });
    assertRetained();
    reopened.apply({ op: "feature.updateSpurGear", id: "gear", teeth: 40 });
    reopened.undo();
    assertRetained();

    const drifted = structuredClone(project);
    const drift = drifted.document.sketches
      .find((s) => s.id === sketch.id)!
      .entities.find((e) => e.id === line.id)!;
    if (drift.kind !== "line") throw new Error("Expected generated line");
    (drift.end as [number, number])[0] += 1e-10;
    expect(() => CadEngine.fromProject(drifted)).toThrow(/replayed|recipe/);

    const authored = structuredClone(project);
    const circle = authored.document.sketches.find((s) => s.id === "authored")!
      .entities[0]!;
    if (circle.kind !== "circle") throw new Error("Expected authored circle");
    (circle as { radius: number }).radius += 1e-14;
    expect(() => CadEngine.fromProject(authored)).toThrow(/replayed/);
  });
  it("changes only the bound output gear after native open and reopens the revised history", async () => {
    const created = new CadEngine();
    created.applyBatch([
      {
        op: "parameter.create",
        id: "output_teeth",
        name: "output_teeth",
        value: 40
      },
      { op: "parameter.create", id: "angle", name: "angle", value: 0 },
      ...["input", "output"].map(
        (side): CadOp => ({
          op: "feature.spurGear",
          id: `${side}_feature`,
          bodyId: side,
          sketchId: `${side}_profile`,
          teeth: side === "input" ? 20 : { parameterId: "output_teeth" },
          module: 1.5,
          faceWidth: 10,
          boreDiameter: 8.1,
          pressureAngleDegrees: 20,
          backlash: 0.08
        })
      )
    ]);
    const opened = await importCadProjectWcad(
      (await exportCadProjectWcad(created)).bytes
    );
    const originalInput = opened.getDocument().sketches.get("input_profile");
    const initialMotion = opened.apply({
      op: "parameter.update",
      id: "angle",
      value: 90
    });
    expect(
      initialMotion.transaction.diff.features?.bodiesModified ?? []
    ).toEqual([]);
    expect(initialMotion.transaction.diff.sketches?.modified ?? []).toEqual([]);
    const revision = opened.apply({
      op: "parameter.update",
      id: "output_teeth",
      value: 60
    });
    expect(
      revision.transaction.diff.features?.bodiesModified?.map((body) => body.id)
    ).toEqual(["output"]);
    expect(
      revision.transaction.diff.features?.inputReferences?.map(
        (reference) => reference.featureId
      )
    ).toEqual(["output_feature"]);
    expect(opened.getDocument().sketches.get("input_profile")).toEqual(
      originalInput
    );
    const revisedProject = opened.exportProject();
    const reopened = await importCadProjectWcad(
      (await exportCadProjectWcad(opened)).bytes
    );
    expect(reopened.exportProject()).toEqual(revisedProject);
    const motion = reopened.apply({
      op: "parameter.update",
      id: "angle",
      value: 180
    });
    expect(motion.transaction.diff.features?.bodiesModified ?? []).toEqual([]);
    expect(motion.transaction.diff.sketches?.modified ?? []).toEqual([]);
    const inputAfter = reopened.getDocument().sketches.get("input_profile");
    expect(inputAfter).toEqual(originalInput);
    reopened.undo();
    reopened.undo();
    expect(
      reopened.getDocument().sketches.get("output_profile")!.spurGear!.values
        .teeth
    ).toBe(40);
    reopened.redo();
    expect(
      reopened.getDocument().sketches.get("output_profile")!.spurGear!.values
        .teeth
    ).toBe(60);
  });
});

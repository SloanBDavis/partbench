import { describe, expect, it } from "vitest";
import type { AssemblyMateFrameRef, CadOp, Vec3 } from "@web-cad/cad-protocol";
import { CadEngine } from "./index";

const local = (instanceId: string, origin: Vec3): AssemblyMateFrameRef => ({
  instanceId,
  frame: { kind: "local", origin, xDirection: [1, 0, 0], zDirection: [0, 0, 1] }
});
const convert: CadOp = {
  op: "document.updateUnits",
  units: "in",
  mode: "preservePhysicalSize"
};

function gearbox() {
  const engine = new CadEngine();
  engine.applyBatch([
    ...Object.entries({
      input_teeth: 20,
      output_teeth: 40,
      input_angle: 90,
      ratio: 2,
      output_angle: -40.5,
      module: 1.5
    }).map(
      ([id, value]): CadOp => ({ op: "parameter.create", id, name: id, value })
    ),
    {
      op: "parameter.setExpression",
      id: "ratio",
      expression: "output_teeth / input_teeth"
    },
    {
      op: "parameter.setExpression",
      id: "output_angle",
      expression: "180 / output_teeth - input_angle / ratio"
    },
    ...["input", "output"].map(
      (side): CadOp => ({
        op: "feature.spurGear",
        id: side,
        bodyId: `${side}_body`,
        sketchId: `${side}_profile`,
        teeth: { parameterId: `${side}_teeth` },
        module: { parameterId: "module" },
        faceWidth: 10,
        boreDiameter: 8
      })
    ),
    { op: "assembly.create", id: "gearbox", name: "Gearbox" },
    ...["base", "input", "output"].map(
      (id): CadOp => ({
        op: "assembly.instance.insert",
        assemblyId: "gearbox",
        id,
        definition: {
          kind: "body",
          bodyId: id === "output" ? "output_body" : "input_body"
        },
        ...(id === "base"
          ? { transform: { translation: [25.4, 50.8, 76.2] } }
          : {})
      })
    ),
    {
      op: "assembly.mate.create",
      assemblyId: "gearbox",
      id: "root",
      kind: "fixed",
      instanceId: "base"
    },
    {
      op: "assembly.mate.create",
      assemblyId: "gearbox",
      id: "input_joint",
      kind: "revolute",
      primary: local("base", [12, 0, 4]),
      secondary: {
        instanceId: "input",
        frame: {
          kind: "sketch",
          sketchId: "input_profile",
          entityId: "input_profile:bore",
          offset: 1
        }
      },
      offset: 2,
      angleParameterId: "input_angle"
    },
    {
      op: "assembly.mate.create",
      assemblyId: "gearbox",
      id: "output_joint",
      kind: "revolute",
      primary: local("base", [57, 0, 4]),
      secondary: local("output", [0, 0, 1]),
      offset: 2,
      angleParameterId: "output_angle"
    },
    {
      op: "assembly.instance.insert",
      assemblyId: "gearbox",
      id: "axial_float",
      definition: { kind: "body", bodyId: "input_body" },
      transform: { translation: [55.4, 40.8, 120] }
    },
    {
      op: "assembly.mate.create",
      assemblyId: "gearbox",
      id: "axial_joint",
      kind: "concentric",
      primary: { instanceId: "base", axis: "Z", origin: [5, 0, 0] },
      secondary: { instanceId: "axial_float", axis: "Z", origin: [0, 0, 0] }
    }
  ]);
  return engine;
}

describe("gearbox physical unit conversion", () => {
  it("preserves connected local/sketch-frame poses and dimensionless expressions through conversion and native reopening", () => {
    const engine = gearbox();
    const before = engine.getDocument();
    engine.apply(convert);
    const after = engine.getDocument();
    expect(after.parameters.get("ratio")!.value).toBe(2);
    expect(after.parameters.get("input_teeth")!.value).toBe(20);
    expect(after.parameters.get("output_angle")!.value).toBe(-40.5);
    for (const instance of after.assemblies.get("gearbox")!.instances) {
      const previous = before.assemblies
        .get("gearbox")!
        .instances.find((i) => i.id === instance.id)!;
      instance.transform.translation.forEach((value, i) =>
        expect(value * 25.4).toBeCloseTo(previous.transform.translation[i]!, 7)
      );
      expect(instance.transform.rotation).toEqual(previous.transform.rotation);
      expect(instance.transform.scale).toEqual(previous.transform.scale);
    }
    for (const side of ["input", "output"]) {
      const gear = after.sketches.get(`${side}_profile`)!.spurGear!;
      expect(gear.values.module * 25.4).toBeCloseTo(1.5, 8);
      expect(gear.values.faceWidth * 25.4).toBeCloseTo(10, 8);
    }
    const reopened = CadEngine.fromProject(engine.exportProject());
    reopened.apply({ op: "parameter.update", id: "input_angle", value: 180 });
    expect(reopened.getDocument().parameters.get("output_angle")!.value).toBe(
      -85.5
    );
    engine.undo();
    expect(engine.getDocument()).toEqual(before);
    engine.redo();
    expect(engine.getDocument()).toEqual(after);
  });

  it("blocks an indirect untyped ratio chain without changing source or history", () => {
    const engine = gearbox();
    engine.applyBatch([
      { op: "parameter.setExpression", id: "ratio", expression: null },
      {
        op: "parameter.setExpression",
        id: "output_teeth",
        expression: "input_teeth * ratio"
      }
    ]);
    const before = engine.exportProject();
    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [convert]
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_UNITS", path: "$.ops[0].mode" }
    });
    expect(engine.exportProject()).toEqual(before);
  });

  it("blocks mixed length/tooth-count parameter roles atomically", () => {
    const engine = gearbox();
    engine.apply({
      op: "feature.updateSpurGear",
      id: "input",
      module: { parameterId: "input_teeth" }
    });
    const before = engine.exportProject();
    for (const mode of ["dryRun", "commit"] as const) {
      expect(
        engine.executeBatch({ version: "cadops.v1", mode, ops: [convert] })
      ).toMatchObject({
        ok: false,
        error: {
          code: "INVALID_UNITS",
          parameterId: "input_teeth",
          message: expect.stringContaining("both a length")
        }
      });
      expect(engine.exportProject()).toEqual(before);
    }
  });
});

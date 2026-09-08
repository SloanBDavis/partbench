import { describe, expect, it } from "vitest";
import type {
  AssemblyMateFrameRef,
  CadOp,
  Transform,
  Vec3
} from "@web-cad/cad-protocol";
import {
  CadEngine,
  exportCadProject,
  exportCadProjectWcad,
  importCadProject,
  importCadProjectWcad
} from "./index";

const frame = (instanceId: string, entityId: string): AssemblyMateFrameRef => ({
  instanceId,
  frame: { kind: "sketch", sketchId: "link", entityId }
});
const local = (
  instanceId: string,
  origin: Vec3 = [0, 0, 0]
): AssemblyMateFrameRef => ({
  instanceId,
  frame: { kind: "local", origin, xDirection: [1, 0, 0], zDirection: [0, 0, 1] }
});
function seed(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "parameter.create", id: "span", name: "span", value: 160 },
    { op: "parameter.create", id: "half", name: "half", value: 80 },
    { op: "parameter.setExpression", id: "half", expression: "span / 2" },
    { op: "parameter.create", id: "angle", name: "angle", value: 60 },
    { op: "parameter.create", id: "opening", name: "opening", value: 20 },
    { op: "sketch.create", id: "link", name: "Link", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "link",
      id: "outline",
      center: [0, 0],
      width: 240,
      height: 30
    },
    {
      op: "sketch.addCircle",
      sketchId: "link",
      id: "left",
      center: [-80, 0],
      radius: 4
    },
    {
      op: "sketch.addCircle",
      sketchId: "link",
      id: "right",
      center: [80, 0],
      radius: 4
    },
    ...([-1, 1] as const).map(
      (sign, index): CadOp => ({
        op: "sketch.dimension.create",
        id: `d${index}`,
        name: `pivot${index}`,
        sketchId: "link",
        target: {
          kind: "pointPair",
          primary: {
            entityId: "outline",
            entityKind: "rectangle",
            role: "center"
          },
          secondary: {
            entityId: sign < 0 ? "left" : "right",
            entityKind: "circle",
            role: "center"
          },
          measurement: "horizontal",
          direction: sign < 0 ? "negative" : "positive"
        },
        parameterId: "half"
      })
    ),
    {
      op: "feature.extrude",
      id: "f_link",
      bodyId: "body",
      sketchId: "link",
      entityId: "outline",
      depth: 8
    },
    { op: "assembly.create", id: "arm", name: "Arm" },
    ...["root", "upper", "forearm", "jaw"].map(
      (id): CadOp => ({
        op: "assembly.instance.insert",
        assemblyId: "arm",
        id,
        definition: { kind: "body", bodyId: "body" }
      })
    ),
    {
      op: "assembly.mate.create",
      assemblyId: "arm",
      id: "fixed",
      kind: "fixed",
      instanceId: "root"
    },
    {
      op: "assembly.mate.create",
      assemblyId: "arm",
      id: "shoulder",
      name: "Shoulder",
      kind: "revolute",
      primary: local("root"),
      secondary: frame("upper", "left"),
      angleParameterId: "angle",
      offset: 10
    },
    {
      op: "assembly.mate.create",
      assemblyId: "arm",
      id: "elbow",
      kind: "revolute",
      primary: frame("upper", "right"),
      secondary: frame("forearm", "left"),
      angleDegrees: -100,
      offset: 10
    },
    {
      op: "assembly.mate.create",
      assemblyId: "arm",
      id: "grip",
      kind: "revolute",
      primary: frame("forearm", "right"),
      secondary: local("jaw"),
      angleDegrees: 40,
      offsetParameterId: "opening"
    }
  ]);
  return engine;
}
function pose(engine: CadEngine, id: string): Transform {
  return engine
    .getDocument()
    .assemblies.get("arm")!
    .instances.find((i) => i.id === id)!.transform;
}
function point(p: Vec3, t: Transform): Vec3 {
  const [rx, ry, rz] = t.rotation,
    c = Math.cos,
    s = Math.sin;
  const y = p[1] * c(rx) - p[2] * s(rx),
    z = p[1] * s(rx) + p[2] * c(rx),
    x = p[0] * c(ry) + z * s(ry);
  return [
    x * c(rz) - y * s(rz) + t.translation[0],
    x * s(rz) + y * c(rz) + t.translation[1],
    -p[0] * s(ry) + z * c(ry) + t.translation[2]
  ];
}
function close(a: Vec3, b: Vec3) {
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 7));
}
function aligned(engine: CadEngine, half = 80) {
  const a = point([half, 0, 0], pose(engine, "upper")),
    b = point([-half, 0, 0], pose(engine, "forearm"));
  close([a[0], a[1], a[2] + 10], b);
  close(point([-half, 0, 0], pose(engine, "upper")), [0, 0, 10]);
}

describe("connected authored assembly motion", () => {
  it("replays legacy already-aligned mate rows without discarding tampered or unrelated modifications", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "s", name: "Pin", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "s",
        id: "c",
        center: [0, 0],
        radius: 4
      },
      {
        op: "feature.extrude",
        id: "f",
        bodyId: "b",
        sketchId: "s",
        entityId: "c",
        depth: 8
      },
      { op: "assembly.create", id: "a", name: "Legacy assembly" },
      {
        op: "assembly.instance.insert",
        assemblyId: "a",
        id: "root",
        definition: { kind: "body", bodyId: "b" }
      },
      {
        op: "assembly.instance.insert",
        assemblyId: "a",
        id: "pin",
        definition: { kind: "body", bodyId: "b" },
        transform: { translation: [0, 0, 5] }
      },
      {
        op: "assembly.mate.create",
        assemblyId: "a",
        id: "fixed",
        kind: "fixed",
        instanceId: "root"
      }
    ]);
    engine.apply({
      op: "assembly.mate.create",
      assemblyId: "a",
      id: "axis",
      kind: "concentric",
      primary: { instanceId: "root", axis: "Z" },
      secondary: { instanceId: "pin", axis: "Z" }
    });
    const legacy = exportCadProject(engine);
    const assembly = legacy.document.assemblies![0]!;
    const diff = legacy.history[1]!.diff.assemblies!;
    // Baseline's one-pair solver emitted this already-aligned instance row.
    // Assembly summaries are redundant set membership, not a change counter.
    Object.assign(diff, {
      instancesModified: [{ ...assembly.instances[1]!, assemblyId: "a" }],
      modified: [...(diff.modified ?? []), ...(diff.modified ?? [])]
    });
    // Older mate edits also moved the edited relation to the end of the list.
    // Loading retains that saved order while validating all mate fields by ID.
    Object.assign(assembly, { mates: [...(assembly.mates ?? [])].reverse() });
    const restored = importCadProject(legacy);
    expect(exportCadProject(restored)).toEqual(legacy);
    restored.undo();
    restored.redo();
    expect(restored.createSnapshot()).toEqual(engine.createSnapshot());
    const tamper = [
      (project: typeof legacy) => {
        Object.assign(
          project.history[1]!.diff.assemblies!.instancesModified![0]!,
          { name: "Changed pin" }
        );
      },
      (project: typeof legacy) => {
        Object.assign(
          project.history[1]!.diff.assemblies!.instancesModified![0]!.transform,
          { translation: [0, 0, 5 + 1e-6] }
        );
      },
      (project: typeof legacy) => {
        Object.assign(project.history[1]!.diff.assemblies!, {
          instancesModified: [{ ...assembly.instances[0]!, assemblyId: "a" }]
        });
      },
      (project: typeof legacy) => {
        Object.assign(project.history[1]!.diff.assemblies!.modified![0]!, {
          name: "Changed assembly"
        });
      }
    ];
    for (const modify of tamper) {
      const changed = structuredClone(legacy);
      modify(changed);
      expect(() => importCadProject(changed)).toThrow(/transaction|history/i);
    }
  });

  it("reopens unrounded native history across trig runtimes and retains derived poses through detach, pose edits and redo", async () => {
    const engine = seed();
    engine.applyBatch([
      { op: "parameter.update", id: "span", value: 180 },
      { op: "parameter.update", id: "angle", value: 35 }
    ]);
    engine.apply({
      op: "assembly.mate.delete",
      assemblyId: "arm",
      mateId: "grip"
    });
    engine.apply({
      op: "assembly.instance.updateTransform",
      assemblyId: "arm",
      instanceId: "jaw",
      transform: { translation: [4, 5, 6] }
    });
    engine.apply({ op: "parameter.update", id: "angle", value: 25 });
    engine.undo();
    const saved = engine.createSnapshot();
    const native = await exportCadProjectWcad(engine);
    const sin = Math.sin;
    Math.sin = (value) => sin(value) * (1 + Number.EPSILON);
    try {
      const restored = await importCadProjectWcad(native.bytes);
      // The saved native document remains authoritative; only replay comparison
      // tolerates derived roundoff. No new rounding is written into the file.
      expect(restored.createSnapshot()).toEqual(saved);
      restored.redo();
      expect(pose(restored, "upper").rotation[2]).toBeCloseTo(
        (25 * Math.PI) / 180,
        12
      );
      restored.undo();
      aligned(restored, 90);
      close(pose(restored, "jaw").translation, [4, 5, 6]);
      restored.apply({ op: "parameter.update", id: "span", value: 200 });
      aligned(restored, 100);
      const resaved = await exportCadProjectWcad(restored);
      const reopened = await importCadProjectWcad(resaved.bytes);
      expect(reopened.createSnapshot()).toEqual(restored.createSnapshot());
    } finally {
      Math.sin = sin;
    }
  });

  it("rejects substantive derived-pose changes and keeps authored assembly history/document values exact", () => {
    const engine = seed();
    const project = exportCadProject(engine);
    const modifications = [
      (value: typeof project) => {
        const ref = value.history[0]!.diff.assemblies!.instancesModified![0]!;
        Object.assign(ref.transform, {
          translation: [
            ref.transform.translation[0] + 1e-6,
            ref.transform.translation[1],
            ref.transform.translation[2]
          ]
        });
      },
      (value: typeof project) => {
        const ref = value.history[0]!.diff.assemblies!.instancesCreated![0]!;
        Object.assign(ref.transform, { translation: [1e-12, 0, 0] });
      },
      (value: typeof project) => {
        const ref = value.history[0]!.diff.assemblies!.instancesModified![0]!;
        Object.assign(ref.transform, { scale: [1 + 1e-12, 1, 1] });
      },
      (value: typeof project) => {
        const ref = value.history[0]!.diff.assemblies!.matesCreated![1]!;
        Object.assign(ref, { angleDegrees: 60 + 1e-12 });
      },
      (value: typeof project) => {
        Object.assign(value.document.assemblies![0]!.instances[0]!, {
          name: "Changed root"
        });
      },
      (value: typeof project) => {
        Object.assign(value.document.assemblies![0]!.instances[0]!.transform, {
          translation: [1e-12, 0, 0]
        });
      }
    ];
    for (const modify of modifications) {
      const changed = structuredClone(project);
      modify(changed);
      expect(() => importCadProject(changed)).toThrow(/transaction|history/i);
    }
  });

  it("propagates link parameters and controlled angles without deleting instances, with undo/redo and native reopen", async () => {
    const engine = seed();
    aligned(engine);
    const initial = engine.createSnapshot();
    const revision = engine.applyBatch([
      { op: "parameter.update", id: "span", value: 180 },
      { op: "parameter.update", id: "angle", value: 35 },
      { op: "parameter.update", id: "opening", value: 35 }
    ]);
    aligned(engine, 90);
    expect(pose(engine, "upper").rotation[2]).toBeCloseTo(
      (35 * Math.PI) / 180,
      9
    );
    expect(revision.transaction.diff.assemblies?.instancesDeleted).toHaveLength(
      0
    );
    expect(revision.transaction.diff.assemblies?.instancesCreated).toHaveLength(
      0
    );
    expect(
      new Set(
        revision.transaction.diff.assemblies?.instancesModified?.map(
          (i) => i.id
        )
      )
    ).toEqual(new Set(["upper", "forearm", "jaw"]));
    expect(
      engine
        .getDocument()
        .assemblies.get("arm")!
        .mates?.find((m) => m.id === "grip")
    ).toMatchObject({ offset: 35, offsetParameterId: "opening" });
    const after = engine.createSnapshot();
    engine.undo();
    expect(engine.createSnapshot()).toEqual(initial);
    engine.redo();
    expect(engine.createSnapshot()).toEqual(after);
    const reopened = importCadProject(exportCadProject(engine));
    expect(reopened.createSnapshot()).toEqual(after);
    const native = await exportCadProjectWcad(engine);
    const fresh = await importCadProjectWcad(native.bytes);
    expect(fresh.createSnapshot()).toEqual(after);
    fresh.apply({ op: "parameter.update", id: "span", value: 200 });
    aligned(fresh, 100);
  });

  it("moves a rooted subtree with direct translation/rotation and rejects direct constrained-child edits atomically", () => {
    const engine = seed(),
      before = engine.createSnapshot();
    expect(() =>
      engine.apply({
        op: "assembly.instance.updateTransform",
        assemblyId: "arm",
        instanceId: "upper",
        transform: { translation: [3, 4, 5] }
      })
    ).toThrow(/controlled by its mates/);
    expect(engine.createSnapshot()).toEqual(before);
    const moved = engine.apply({
      op: "assembly.instance.updateTransform",
      assemblyId: "arm",
      instanceId: "root",
      transform: { translation: [5, 7, 9], rotation: [Math.PI / 2, 0.3, 0.2] }
    });
    const end = point([-80, 0, 0], pose(engine, "upper"));
    close(end, point([0, 0, 10], pose(engine, "root")));
    expect(
      new Set(
        moved.transaction.diff.assemblies?.instancesModified?.map((i) => i.id)
      )
    ).toEqual(new Set(["root", "upper", "forearm", "jaw"]));
    expect(importCadProject(exportCadProject(engine)).createSnapshot()).toEqual(
      engine.createSnapshot()
    );
  });

  it("propagates a legacy concentric chain and preserves axial slide under parent motion", () => {
    const engine = seed();
    engine.applyBatch([
      { op: "assembly.instance.delete", assemblyId: "arm", instanceId: "jaw" },
      { op: "assembly.mate.delete", assemblyId: "arm", mateId: "shoulder" },
      { op: "assembly.mate.delete", assemblyId: "arm", mateId: "elbow" },
      {
        op: "assembly.mate.create",
        assemblyId: "arm",
        id: "c1",
        kind: "concentric",
        primary: { instanceId: "root", axis: "Z" },
        secondary: { instanceId: "upper", axis: "Z" }
      },
      {
        op: "assembly.mate.create",
        assemblyId: "arm",
        id: "c2",
        kind: "concentric",
        primary: { instanceId: "upper", axis: "Z", origin: [50, 0, 0] },
        secondary: { instanceId: "forearm", axis: "Z" }
      }
    ]);
    const old = pose(engine, "forearm");
    engine.apply({
      op: "assembly.instance.updateTransform",
      assemblyId: "arm",
      instanceId: "root",
      transform: { translation: [20, 30, 40] }
    });
    close(pose(engine, "forearm").translation, [
      old.translation[0] + 20,
      old.translation[1] + 30,
      old.translation[2] + 40
    ]);
  });

  it("binds distance mates to parameters through a connected parent and preserves both constraints", () => {
    const engine = seed();
    engine.applyBatch([
      { op: "assembly.mate.delete", assemblyId: "arm", mateId: "grip" },
      {
        op: "assembly.mate.create",
        assemblyId: "arm",
        id: "distance",
        kind: "distance",
        primary: { instanceId: "forearm", plane: "XY" },
        secondary: { instanceId: "jaw", plane: "XY" },
        distanceParameterId: "opening"
      }
    ]);
    engine.apply({ op: "parameter.update", id: "opening", value: 35 });
    expect(
      pose(engine, "jaw").translation[2] -
        pose(engine, "forearm").translation[2]
    ).toBeCloseTo(35, 9);
    expect(
      engine
        .getDocument()
        .assemblies.get("arm")!
        .mates?.find((m) => m.id === "distance")
    ).toMatchObject({ distance: 35, distanceParameterId: "opening" });
  });

  it("rejects cycles, conflicting parallel constraints, missing/foreign refs, deleted bindings and nonunit revolute scale atomically", () => {
    const engine = seed();
    const original = engine.createSnapshot();
    const bad: CadOp[] = [
      {
        op: "assembly.mate.create",
        assemblyId: "arm",
        kind: "revolute",
        primary: local("root"),
        secondary: local("forearm"),
        angleDegrees: 0
      },
      {
        op: "assembly.mate.create",
        assemblyId: "arm",
        kind: "distance",
        primary: { instanceId: "root", plane: "XY" },
        secondary: { instanceId: "upper", plane: "XY" },
        distance: 100
      },
      {
        op: "assembly.mate.edit",
        assemblyId: "arm",
        mateId: "shoulder",
        kind: "revolute",
        primary: local("root"),
        secondary: frame("upper", "missing"),
        angleDegrees: 0
      },
      { op: "parameter.delete", id: "angle" },
      {
        op: "assembly.instance.updateTransform",
        assemblyId: "arm",
        instanceId: "root",
        transform: { scale: [2, 2, 2] }
      }
    ];
    for (const op of bad) {
      expect(() => engine.apply(op)).toThrow();
      expect(engine.createSnapshot()).toEqual(original);
    }
    engine.applyBatch([
      { op: "sketch.create", id: "foreign", name: "Foreign", plane: "XY" },
      { op: "sketch.addPoint", sketchId: "foreign", id: "p", point: [0, 0] }
    ]);
    const before = engine.createSnapshot();
    expect(() =>
      engine.apply({
        op: "assembly.mate.edit",
        assemblyId: "arm",
        mateId: "shoulder",
        kind: "revolute",
        primary: local("root"),
        secondary: {
          instanceId: "upper",
          frame: { kind: "sketch", sketchId: "foreign", entityId: "p" }
        },
        angleDegrees: 0
      })
    ).toThrow(/ancestry/);
    expect(engine.createSnapshot()).toEqual(before);
  });

  it("supports a secondary fixed parent, full frame offsets and preserves mate name on edit", () => {
    const engine = seed();
    engine.applyBatch([
      {
        op: "assembly.instance.delete",
        assemblyId: "arm",
        instanceId: "forearm"
      },
      { op: "assembly.instance.delete", assemblyId: "arm", instanceId: "jaw" },
      {
        op: "assembly.mate.edit",
        assemblyId: "arm",
        mateId: "shoulder",
        kind: "revolute",
        primary: frame("upper", "left"),
        secondary: local("root"),
        angleDegrees: -60,
        offset: -10
      }
    ]);
    alignedUpper();
    expect(
      engine
        .getDocument()
        .assemblies.get("arm")!
        .mates?.find((m) => m.id === "shoulder")?.name
    ).toBe("Shoulder");
    function alignedUpper() {
      close(point([-80, 0, 0], pose(engine, "upper")), [0, 0, 10]);
      expect(pose(engine, "upper").rotation[2]).toBeCloseTo(Math.PI / 3, 9);
    }
  });
});

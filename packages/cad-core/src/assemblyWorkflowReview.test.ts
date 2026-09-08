import { describe, expect, it } from "vitest";
import type {
  AssemblyMateFrameRef,
  CadOp,
  Transform,
  Vec3
} from "@web-cad/cad-protocol";
import { CadEngine, exportCadProject, importCadProject } from "./index";

function seed(pattern = false): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "outline", name: "Outline", plane: "XY" },
    {
      op: "sketch.addCircle",
      sketchId: "outline",
      id: "circle",
      center: [2, 3],
      radius: 2
    },
    {
      op: "feature.extrude",
      id: "extrude",
      bodyId: "part",
      sketchId: "outline",
      entityId: "circle",
      depth: 4
    },
    ...(pattern
      ? [
          {
            op: "feature.linearPattern",
            id: "pattern",
            bodyId: "patterned",
            seedFeatureId: "extrude",
            axis: "x",
            spacing: 10,
            instanceCount: 2
          } as CadOp
        ]
      : []),
    { op: "parameter.create", id: "gap", name: "Gap", value: 5 },
    { op: "assembly.create", id: "assembly" },
    ...["root", "child"].map(
      (id): CadOp => ({
        op: "assembly.instance.insert",
        assemblyId: "assembly",
        id,
        definition: { kind: "body", bodyId: pattern ? "patterned" : "part" }
      })
    ),
    {
      op: "assembly.mate.create",
      assemblyId: "assembly",
      id: "fixed",
      kind: "fixed",
      instanceId: "root"
    }
  ]);
  return engine;
}

function pose(engine: CadEngine, id: string): Transform {
  return engine
    .getDocument()
    .assemblies.get("assembly")!
    .instances.find((instance) => instance.id === id)!.transform;
}
function point(p: Vec3, t: Transform): Vec3 {
  let [x, y, z] = p.map((value, index) => value * t.scale[index]!) as [
    number,
    number,
    number
  ];
  const [rx, ry, rz] = t.rotation;
  [y, z] = [
    y * Math.cos(rx) - z * Math.sin(rx),
    y * Math.sin(rx) + z * Math.cos(rx)
  ];
  [x, z] = [
    x * Math.cos(ry) + z * Math.sin(ry),
    -x * Math.sin(ry) + z * Math.cos(ry)
  ];
  [x, y] = [
    x * Math.cos(rz) - y * Math.sin(rz),
    x * Math.sin(rz) + y * Math.cos(rz)
  ];
  return [x + t.translation[0], y + t.translation[1], z + t.translation[2]];
}
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (v: Vec3, scalar: number): Vec3 => [
  v[0] * scalar,
  v[1] * scalar,
  v[2] * scalar
];
const dot = (a: Vec3, b: Vec3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function close(actual: Vec3, expected: Vec3) {
  actual.forEach((value, index) =>
    expect(value).toBeCloseTo(expected[index]!, 7)
  );
}
const local = (
  instanceId: string,
  origin: Vec3 = [0, 0, 0],
  xDirection: Vec3 = [1, 0, 0],
  zDirection: Vec3 = [0, 0, 1]
): AssemblyMateFrameRef => ({
  instanceId,
  frame: { kind: "local", origin, xDirection, zDirection }
});

describe("independent connected assembly workflow review", () => {
  it("keeps reversed custom joint frames aligned under a rotated root and native reopen", () => {
    const engine = seed();
    const primary = local("child", [2, 3, 4], [0, 1, 0], [1, 0, 0]);
    const secondary = local("root", [-3, 2, 1], [1, 0, 0], [0, 0, -1]);
    engine.applyBatch([
      {
        op: "assembly.instance.updateTransform",
        assemblyId: "assembly",
        instanceId: "root",
        transform: {
          translation: [7, 8, 9],
          rotation: [Math.PI / 2, 0.3, Math.PI / 2]
        }
      },
      {
        op: "assembly.mate.create",
        assemblyId: "assembly",
        id: "joint",
        kind: "revolute",
        primary,
        secondary,
        angleDegrees: 35,
        offset: 3
      }
    ]);
    function check(current: CadEngine) {
      const a = pose(current, "child"),
        b = pose(current, "root");
      const aOrigin = point([2, 3, 4], a),
        bOrigin = point([-3, 2, 1], b);
      const aX = sub(point([2, 4, 4], a), aOrigin),
        aZ = sub(point([3, 3, 4], a), aOrigin);
      const aY = sub(point([2, 3, 5], a), aOrigin);
      const bX = sub(point([-2, 2, 1], b), bOrigin),
        bZ = sub(point([-3, 2, 0], b), bOrigin);
      close(bOrigin, add(aOrigin, mul(aZ, 3)));
      close(bZ, aZ);
      close(
        bX,
        add(
          mul(aX, Math.cos((35 * Math.PI) / 180)),
          mul(aY, Math.sin((35 * Math.PI) / 180))
        )
      );
    }
    check(engine);
    const before = engine.createSnapshot();
    engine.apply({
      op: "assembly.instance.updateTransform",
      assemblyId: "assembly",
      instanceId: "root",
      transform: { rotation: [0.5, -Math.PI / 2, 0.8] }
    });
    check(engine);
    check(importCadProject(exportCadProject(engine)));
    engine.undo();
    expect(engine.createSnapshot()).toEqual(before);
  });

  it("solves compatible concentric and distance constraints together after root motion", () => {
    const engine = seed();
    engine.applyBatch([
      {
        op: "assembly.instance.updateTransform",
        assemblyId: "assembly",
        instanceId: "child",
        transform: { translation: [8, 9, 7], rotation: [0, 0, 0.7] }
      },
      {
        op: "assembly.mate.create",
        assemblyId: "assembly",
        id: "axis",
        kind: "concentric",
        primary: { instanceId: "root", axis: "Z" },
        secondary: { instanceId: "child", axis: "Z", origin: [2, 0, 0] }
      },
      {
        op: "assembly.mate.create",
        assemblyId: "assembly",
        id: "distance",
        kind: "distance",
        primary: { instanceId: "root", plane: "XY" },
        secondary: { instanceId: "child", plane: "XY" },
        distanceParameterId: "gap"
      }
    ]);
    engine.applyBatch([
      {
        op: "assembly.instance.updateTransform",
        assemblyId: "assembly",
        instanceId: "root",
        transform: { translation: [5, 6, 7], rotation: [Math.PI / 2, 0.2, 0.3] }
      },
      { op: "parameter.update", id: "gap", value: 11 }
    ]);
    const root = pose(engine, "root"),
      child = pose(engine, "child");
    const origin = point([0, 0, 0], root),
      axis = sub(point([0, 0, 1], root), origin);
    const delta = sub(point([2, 0, 0], child), origin);
    close(delta, mul(axis, 11));
    expect(dot(sub(point([0, 0, 0], child), origin), axis)).toBeCloseTo(11, 7);
  });

  it("retains authored sketch-frame ancestry through an existing feature pattern", () => {
    const engine = seed(true);
    engine.apply({
      op: "assembly.mate.create",
      assemblyId: "assembly",
      id: "joint",
      kind: "revolute",
      primary: local("root"),
      secondary: {
        instanceId: "child",
        frame: { kind: "sketch", sketchId: "outline", entityId: "circle" }
      },
      angleDegrees: 0
    });
    close(point([2, 3, 0], pose(engine, "child")), [0, 0, 0]);
  });

  it("preserves an explicitly reinserted child's free slide when the root also moves", () => {
    const engine = seed();
    const concentric = {
      op: "assembly.mate.create",
      assemblyId: "assembly",
      id: "axis",
      kind: "concentric",
      primary: { instanceId: "root", axis: "Z" },
      secondary: { instanceId: "child", axis: "Z" }
    } as const;
    engine.applyBatch([
      {
        op: "assembly.instance.updateTransform",
        assemblyId: "assembly",
        instanceId: "child",
        transform: { translation: [0, 0, 5] }
      },
      concentric
    ]);
    engine.applyBatch([
      {
        op: "assembly.instance.updateTransform",
        assemblyId: "assembly",
        instanceId: "root",
        transform: { translation: [0, 0, 10] }
      },
      {
        op: "assembly.instance.delete",
        assemblyId: "assembly",
        instanceId: "child"
      },
      {
        op: "assembly.instance.insert",
        assemblyId: "assembly",
        id: "child",
        definition: { kind: "body", bodyId: "part" },
        transform: { translation: [0, 0, 15] }
      },
      concentric
    ]);
    close(pose(engine, "child").translation, [0, 0, 15]);
  });

  it("attributes an invalid joint to its operation while preserving the whole batch", () => {
    for (const id of ["bad_joint", undefined]) {
      const engine = seed(),
        before = engine.createSnapshot();
      const response = engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "assembly.mate.create",
            assemblyId: "assembly",
            ...(id ? { id } : {}),
            kind: "revolute",
            primary: local("root"),
            secondary: {
              instanceId: "child",
              frame: {
                kind: "sketch",
                sketchId: "outline",
                entityId: "missing"
              }
            },
            angleDegrees: 0
          },
          { op: "parameter.update", id: "gap", value: 8 }
        ]
      });
      expect(engine.createSnapshot()).toEqual(before);
      expect(response).toMatchObject({
        ok: false,
        error: { opIndex: 0, op: "assembly.mate.create", path: "$.ops[0]" }
      });
    }

    const engine = seed();
    engine.apply({
      op: "assembly.mate.create",
      assemblyId: "assembly",
      id: "distance",
      kind: "distance",
      primary: { instanceId: "root", plane: "XY" },
      secondary: { instanceId: "child", plane: "XY" },
      distanceParameterId: "gap"
    });
    const before = engine.createSnapshot();
    const response = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        { op: "parameter.delete", id: "gap" },
        { op: "parameter.create", id: "unrelated", name: "Unrelated", value: 3 }
      ]
    });
    expect(engine.createSnapshot()).toEqual(before);
    expect(response).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining("gap") }
    });
    if (response.ok)
      throw new Error("Expected rejected missing parameter binding.");
    expect(response.error.opIndex).not.toBe(1);
    expect(response.error.op).not.toBe("parameter.create");
  });
});

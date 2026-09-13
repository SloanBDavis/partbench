import { describe, expect, it } from "vitest";
import {
  CadEngine,
  flattenAssemblyOccurrences,
  assemblyTransformToMatrix,
  assemblyTransformFromMatrix
} from "./index";
import type { Transform } from "@web-cad/cad-protocol";

describe("shared nested assembly hierarchy", () => {
  it("places a repeated subassembly, persists it and moves only its occurrence", () => {
    const e = new CadEngine();
    e.applyBatch([
      { op: "sketch.create", id: "sk", name: "Profile", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "sk",
        id: "circle",
        center: [0, 0],
        radius: 2
      },
      {
        op: "feature.extrude",
        id: "part",
        bodyId: "body",
        sketchId: "sk",
        entityId: "circle",
        depth: 5
      },
      { op: "assembly.create", id: "root" },
      { op: "assembly.create", id: "child" },
      {
        op: "assembly.instance.insert",
        assemblyId: "child",
        id: "leaf",
        definition: { kind: "body", bodyId: "body" },
        transform: { translation: [10, 0, 0] }
      },
      {
        op: "assembly.instance.insert",
        assemblyId: "root",
        id: "first",
        definition: { kind: "assembly", assemblyId: "child" },
        transform: { rotation: [0, 0, Math.PI / 2] }
      },
      {
        op: "assembly.instance.insert",
        assemblyId: "root",
        id: "second",
        definition: { kind: "assembly", assemblyId: "child" },
        transform: { translation: [30, 0, 0] }
      }
    ]);
    const firstPage = e.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure", projection: "occurrences", limit: 1 }
    });
    expect(firstPage).toMatchObject({
      ok: true,
      projection: "occurrences",
      totalInstanceCount: 2,
      nextOffset: 1,
      instancePoses: [
        {
          rootAssemblyId: "root",
          instancePath: ["first", "leaf"],
          ownerAssemblyId: "child",
          localInstanceId: "leaf",
          definition: { kind: "body", bodyId: "body" }
        }
      ]
    });
    const secondPage = e.executeQuery({
      version: "cadops.v1",
      query: {
        query: "project.structure",
        projection: "occurrences",
        offset: 1,
        limit: 1
      }
    });
    expect(secondPage).toMatchObject({
      ok: true,
      projection: "occurrences",
      instancePoses: [
        {
          instancePath: ["second", "leaf"],
          transform: { translation: [40, 0, 0] }
        }
      ]
    });
    const local = e.executeQuery({
      version: "cadops.v1",
      query: {
        query: "project.structure",
        projection: "poses",
        instanceIds: ["leaf"]
      }
    });
    expect(local).toMatchObject({
      ok: true,
      projection: "poses",
      instancePoses: [{ transform: { translation: [10, 0, 0] } }]
    });
    const poses = () =>
      flattenAssemblyOccurrences(e.createSnapshot().assemblies ?? []);
    expect(poses()).toHaveLength(2);
    expect(poses()[0]!.transform.translation[0]).toBeCloseTo(0);
    expect(poses()[0]!.transform.translation[1]).toBeCloseTo(10);
    expect(poses()[1]!.transform.translation).toEqual([40, 0, 0]);
    e.apply({
      op: "assembly.instance.updateTransform",
      assemblyId: "root",
      instanceId: "first",
      transform: { translation: [0, 20, 0] }
    });
    expect(poses()[0]!.transform.translation[1]).toBeCloseTo(30);
    expect(poses()[1]!.transform.translation).toEqual([40, 0, 0]);
    const reopened = CadEngine.fromProject(e.exportProject());
    expect(
      flattenAssemblyOccurrences(reopened.createSnapshot().assemblies ?? [])
    ).toEqual(poses());
    const before = e.exportProject();
    const bad = e.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "assembly.instance.insert",
          assemblyId: "child",
          id: "cycle",
          definition: { kind: "assembly", assemblyId: "root" }
        }
      ]
    });
    expect(bad.ok).toBe(false);
    expect(e.exportProject()).toEqual(before);
  });
  it("preserves gimbal-lock and reflected transforms without baking geometry", () => {
    for (const rotation of [
      [0.2, 0.3, -0.7],
      [0.3, Math.PI / 2, 0.7],
      [0.3, -Math.PI / 2, 0.7]
    ] as const) {
      const t: Transform = {
        translation: [17, -5, 22],
        rotation,
        scale: [-2, 2, 2]
      };
      const m = assemblyTransformToMatrix(t);
      const actual = assemblyTransformToMatrix(assemblyTransformFromMatrix(m));
      m.forEach((v, i) => expect(actual[i]).toBeCloseTo(v, 7));
    }
    expect(() =>
      assemblyTransformFromMatrix([1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0])
    ).toThrow(/shear/);
  });
});

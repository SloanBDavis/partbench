import { CadEngine } from "@web-cad/cad-core";
import { describe, expect, it, vi } from "vitest";

import {
  createEmptyDerivedGeometrySnapshot,
  deriveGeometrySourceMesh,
  DerivedGeometryService,
  type DerivedBooleanExtrudeGeometrySource
} from "./derivedGeometry";
import { createExactMetadataRuntimeInput } from "./derivedExactMetadata";
import type {
  DerivedGeometryResult,
  DerivedGeometryRuntime
} from "./derivedGeometryRuntime";
import { createExtrudeDerivedGeometrySources } from "./derivedGeometrySources";

describe("V19 region extrude integration", () => {
  it("projects one region with a hole into one exact sequential cut recipe", async () => {
    const engine = createRegionExtrudeEngine();
    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    if (!structure.ok || structure.query !== "project.structure") {
      throw new Error("Expected project structure.");
    }
    const sketches = [...engine.getDocument().sketches.values()].map(
      (sketch) => ({
        id: sketch.id,
        name: sketch.name,
        plane: sketch.plane,
        attachment: sketch.attachment,
        entities: [...sketch.entities.values()]
      })
    );
    const [source] = createExtrudeDerivedGeometrySources(
      structure.features,
      sketches
    );
    expect(source).toMatchObject({
      id: "body_region",
      kind: "extrudeBoolean",
      operation: "cut",
      target: {
        kind: "extrude",
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 20,
          height: 20
        },
        depth: 5,
        side: "positive"
      },
      tool: {
        kind: "extrude",
        profile: { kind: "circle", center: [-5, 0], radius: 4 },
        depth: 5,
        side: "positive"
      }
    });
    if (!source || source.kind !== "extrudeBoolean") {
      throw new Error("Expected one region boolean recipe.");
    }

    const booleanExtrudes = vi.fn(async () => createMeshResult(source.id));
    await deriveGeometrySourceMesh(
      { booleanExtrudes } as unknown as DerivedGeometryRuntime,
      source
    );
    expect(booleanExtrudes).toHaveBeenCalledWith(
      {
        id: "body_region",
        operation: "cut",
        materialPolicy: "regionPositiveVolumeSingleSolid",
        target: expect.objectContaining({
          profile: expect.objectContaining({ kind: "rectangle" })
        }),
        tool: expect.objectContaining({
          profile: expect.objectContaining({ kind: "circle" })
        })
      },
      undefined
    );

    expect(createExactMetadataRuntimeInput(source)).toMatchObject({
      id: "body_region",
      source: {
        kind: "booleanExtrudes",
        operation: "cut",
        target: {
          profile: expect.objectContaining({ kind: "rectangle" })
        },
        tool: {
          profile: expect.objectContaining({ kind: "circle" })
        }
      }
    });
  });

  it("keeps deterministic nested hole order in the authored recipe", () => {
    const engine = createRegionExtrudeEngine(true);
    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    if (!structure.ok || structure.query !== "project.structure") {
      throw new Error("Expected project structure.");
    }
    const sketches = [...engine.getDocument().sketches.values()].map(
      (sketch) => ({
        id: sketch.id,
        name: sketch.name,
        plane: sketch.plane,
        attachment: sketch.attachment,
        entities: [...sketch.entities.values()]
      })
    );
    const source = createExtrudeDerivedGeometrySources(
      structure.features,
      sketches
    )[0] as DerivedBooleanExtrudeGeometrySource;

    expect(source).toMatchObject({
      id: "body_region",
      operation: "cut",
      tool: { profile: { kind: "circle", radius: 2 } },
      target: {
        operation: "cut",
        tool: { profile: { kind: "circle", radius: 4 } },
        target: { profile: { kind: "rectangle" } }
      }
    });
  });

  it.each(["add", "cut"] as const)(
    "projects canonical multi-region %s as sequential exact tools",
    (operationMode) => {
      const engine = createMultiRegionBooleanEngine(operationMode);
      const structure = engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.structure" }
      });
      if (!structure.ok || structure.query !== "project.structure") {
        throw new Error("Expected project structure.");
      }
      const sketches = [...engine.getDocument().sketches.values()].map(
        (sketch) => ({
          id: sketch.id,
          name: sketch.name,
          plane: sketch.plane,
          attachment: sketch.attachment,
          entities: [...sketch.entities.values()]
        })
      );
      const [source] = createExtrudeDerivedGeometrySources(
        structure.features,
        sketches
      );

      expect(source).toMatchObject({
        id: "body_regions",
        kind: "extrudeBoolean",
        operation: operationMode,
        tool: {
          kind: "extrude",
          profile: { kind: "circle", center: [10, 0], radius: 3 }
        },
        target: {
          kind: "extrudeBoolean",
          operation: operationMode,
          tool: {
            kind: "extrude",
            profile: { kind: "circle", center: [-10, 0], radius: 3 }
          },
          target: {
            kind: "extrude",
            profile: { kind: "rectangle" }
          }
        }
      });
    }
  );

  it("evicts display geometry when an authored region becomes invalid", async () => {
    const engine = createRegionExtrudeEngine();
    const booleanExtrudes = vi.fn(async ({ id }: { readonly id: string }) =>
      createMeshResult(id)
    );
    const invalidateDerivedWork = vi.fn();
    let snapshot = createEmptyDerivedGeometrySnapshot();
    const service = new DerivedGeometryService({
      runtime: {
        booleanExtrudes,
        invalidateDerivedWork
      } as unknown as DerivedGeometryRuntime,
      onChange(next) {
        snapshot = next;
      }
    });

    service.reconcile(readRegionExtrudeSources(engine));
    await flushPromises();
    expect(snapshot.meshes.map((mesh) => mesh.id)).toEqual(["body_region"]);

    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "hole_a",
        kind: "circle",
        center: [20, 0],
        radius: 4,
        construction: false
      }
    });
    const blockedSources = readRegionExtrudeSources(engine);
    expect(blockedSources[0]?.placementError).toContain(
      "no longer forms one valid material region"
    );
    service.reconcile(blockedSources);

    expect(snapshot.meshes).toEqual([]);
    expect(snapshot.entries).toMatchObject([
      { objectId: "body_region", status: "unsupported" }
    ]);
    expect(booleanExtrudes).toHaveBeenCalledTimes(1);
    expect(invalidateDerivedWork).toHaveBeenCalledWith(
      "display",
      "body_region",
      expect.any(Number)
    );
  });
});

function readRegionExtrudeSources(engine: CadEngine) {
  const structure = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });
  if (!structure.ok || structure.query !== "project.structure") {
    throw new Error("Expected project structure.");
  }
  return createExtrudeDerivedGeometrySources(
    structure.features,
    [...engine.getDocument().sketches.values()].map((sketch) => ({
      id: sketch.id,
      name: sketch.name,
      plane: sketch.plane,
      attachment: sketch.attachment,
      entities: [...sketch.entities.values()]
    }))
  );
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function createRegionExtrudeEngine(secondHole = false): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Plate", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "outer",
      center: [0, 0],
      width: 20,
      height: 20
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "hole_a",
      center: [-5, 0],
      radius: 4
    },
    ...(secondHole
      ? [
          {
            op: "sketch.addCircle" as const,
            sketchId: "sketch_1",
            id: "hole_b",
            center: [5, 0] as const,
            radius: 2
          }
        ]
      : []),
    {
      op: "feature.extrude",
      id: "feature_region",
      bodyId: "body_region",
      profile: {
        kind: "regions",
        sketchId: "sketch_1",
        regions: [
          {
            outer: { kind: "entity", entityId: "outer" },
            holes: [
              { kind: "entity", entityId: "hole_a" },
              ...(secondHole
                ? [{ kind: "entity" as const, entityId: "hole_b" }]
                : [])
            ]
          }
        ]
      },
      operationMode: "newBody",
      depth: 5,
      side: "positive"
    }
  ]);
  return engine;
}

function createMultiRegionBooleanEngine(
  operationMode: "add" | "cut"
): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Boolean", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "target",
      center: [0, 0],
      width: operationMode === "cut" ? 30 : 20,
      height: 10
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "region_a",
      center: [-10, 0],
      radius: 3
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "region_b",
      center: [10, 0],
      radius: 3
    },
    {
      op: "feature.extrude",
      id: "feature_target",
      bodyId: "body_target",
      sketchId: "sketch_1",
      entityId: "target",
      operationMode: "newBody",
      depth: 5,
      side: "positive"
    },
    {
      op: "feature.extrude",
      id: "feature_regions",
      bodyId: "body_regions",
      profile: {
        kind: "regions",
        sketchId: "sketch_1",
        regions: [
          {
            outer: { kind: "entity", entityId: "region_b" },
            holes: []
          },
          {
            outer: { kind: "entity", entityId: "region_a" },
            holes: []
          }
        ]
      },
      operationMode,
      targetBodyId: "body_target",
      depth: 5,
      side: "positive"
    }
  ]);
  return engine;
}

function createMeshResult(id: string): DerivedGeometryResult {
  return {
    mesh: {
      id,
      kind: "mesh",
      vertices: [[0, 0, 0]],
      indices: [],
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      }
    },
    metrics: {
      objectId: id,
      roundTripMs: 1,
      vertexCount: 3,
      triangleCount: 1
    },
    message: "ready"
  };
}

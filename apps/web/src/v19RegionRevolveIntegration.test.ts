import { CadEngine } from "@web-cad/cad-core";
import { describe, expect, it, vi } from "vitest";

import {
  createEmptyDerivedGeometrySnapshot,
  deriveGeometrySourceMesh,
  DerivedGeometryService
} from "./derivedGeometry";
import { createExactMetadataRuntimeInput } from "./derivedExactMetadata";
import type {
  DerivedGeometryResult,
  DerivedGeometryRuntime
} from "./derivedGeometryRuntime";
import { createRevolveDerivedGeometrySources } from "./derivedGeometrySources";

describe("V19 region revolve integration", () => {
  it("projects one canonical region with a hole into the shared exact revolve recipe", async () => {
    const engine = createRegionRevolveEngine();
    const [source] = readRegionRevolveSources(engine);

    expect(source).toMatchObject({
      id: "body_region_revolve",
      kind: "revolve",
      sketchPlane: "XY",
      profile: {
        kind: "region",
        outer: {
          kind: "rectangle",
          center: [4, 0],
          width: 2,
          height: 4
        },
        holes: [{ kind: "circle", center: [4, 0], radius: 0.5 }]
      },
      axis: { start: [0, -5], end: [0, 5] },
      angleDegrees: 360
    });
    if (!source) throw new Error("Expected a region revolve source.");

    const revolveProfile = vi.fn(async () => createMeshResult(source.id));
    await deriveGeometrySourceMesh(
      { revolveProfile } as unknown as DerivedGeometryRuntime,
      source
    );
    expect(revolveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "body_region_revolve",
        profile: expect.objectContaining({
          kind: "region",
          sourceIdentity: expect.stringContaining(
            "partbench-region-revolve-v1:"
          )
        }),
        angleDegrees: 360
      }),
      undefined
    );
    expect(createExactMetadataRuntimeInput(source)).toMatchObject({
      id: "body_region_revolve",
      source: {
        kind: "revolve",
        profile: {
          kind: "region",
          holes: [{ kind: "circle", radius: 0.5 }]
        },
        axis: { start: [0, -5], end: [0, 5] },
        angleDegrees: 360
      }
    });

    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "hole",
        kind: "circle",
        center: [4.75, 0],
        radius: 0.5,
        construction: false
      }
    });
    expect(readRegionRevolveSources(engine)).toEqual([]);
  });

  it("evicts ready display output and exposes blocked source health after retained-ID invalidation", async () => {
    const engine = createRegionRevolveEngine();
    const invalidateDerivedWork = vi.fn();
    let snapshot = createEmptyDerivedGeometrySnapshot();
    const service = new DerivedGeometryService({
      runtime: {
        invalidateDerivedWork,
        revolveProfile: vi.fn(async ({ id }: { readonly id: string }) =>
          createMeshResult(id)
        )
      } as unknown as DerivedGeometryRuntime,
      onChange(next) {
        snapshot = next;
      }
    });

    service.reconcile(readRegionRevolveSources(engine));
    await flushPromises();
    expect(snapshot.entries).toMatchObject([
      { objectId: "body_region_revolve", status: "ready" }
    ]);
    expect(snapshot.meshes.map((mesh) => mesh.id)).toEqual([
      "body_region_revolve"
    ]);

    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "hole",
        kind: "circle",
        center: [4.75, 0],
        radius: 0.5,
        construction: false
      }
    });
    expect(readRegionRevolveSources(engine)).toEqual([]);
    service.reconcile([]);

    expect(snapshot.entries).toEqual([]);
    expect(snapshot.meshes).toEqual([]);
    expect(invalidateDerivedWork).toHaveBeenCalledWith(
      "display",
      "body_region_revolve",
      expect.any(Number)
    );
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.health" }
      })
    ).toMatchObject({
      ok: true,
      authoredRevolves: [
        {
          featureId: "feature_region_revolve",
          status: "unsupported",
          issues: expect.arrayContaining([
            expect.objectContaining({
              code: expect.stringMatching(
                /SKETCH_REGION_HOLE_OUTSIDE|SKETCH_REGION_BOUNDARY_TOUCHING/
              )
            })
          ])
        }
      ]
    });
    expect(
      engine.getDocument().features.get("feature_region_revolve")
    ).toMatchObject({
      profile: {
        kind: "regions",
        regions: [
          {
            holes: [{ kind: "entity", entityId: "hole" }]
          }
        ]
      }
    });
  });
});

function readRegionRevolveSources(engine: CadEngine) {
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
  return createRevolveDerivedGeometrySources(
    structure.features,
    sketches,
    new Map(),
    new Set(),
    engine.getDocument()
  );
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function createRegionRevolveEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Hollow", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "outer",
      center: [4, 0],
      width: 2,
      height: 4
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "hole",
      center: [4, 0],
      radius: 0.5
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "axis",
      start: [0, -5],
      end: [0, 5],
      construction: true
    },
    {
      op: "feature.revolve",
      id: "feature_region_revolve",
      bodyId: "body_region_revolve",
      profile: {
        kind: "regions",
        sketchId: "sketch_1",
        regions: [
          {
            outer: { kind: "entity", entityId: "outer" },
            holes: [{ kind: "entity", entityId: "hole" }]
          }
        ]
      },
      axis: {
        type: "sketchLine",
        sketchId: "sketch_1",
        entityId: "axis"
      },
      angleDegrees: 360,
      operationMode: "newBody"
    }
  ]);
  return engine;
}

function createMeshResult(objectId: string): DerivedGeometryResult {
  return {
    mesh: {
      id: objectId,
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
      objectId,
      roundTripMs: 1,
      vertexCount: 3,
      triangleCount: 1
    },
    message: "ready"
  };
}

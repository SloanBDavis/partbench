import { describe, expect, it, vi } from "vitest";
import type { DerivedGeometryMeshCache } from "./derivedGeometry";
import { createLazyDerivedMeshOpfsCache } from "./derivedMeshOpfsCacheLazy";
import type { DerivedMeshOpfsCacheOptions } from "./derivedMeshOpfsCache";

const options: DerivedMeshOpfsCacheOptions = {
  target: {},
  getContext: () => undefined
};

describe("lazy derived mesh OPFS cache", () => {
  it("loads once on first access and delegates reads and writes", async () => {
    const read = vi
      .fn<DerivedGeometryMeshCache["read"]>()
      .mockResolvedValue(undefined);
    const write = vi
      .fn<DerivedGeometryMeshCache["write"]>()
      .mockResolvedValue(undefined);
    const createDerivedMeshOpfsCache = vi.fn(() => ({ read, write }));
    const load = vi.fn(async () => ({ createDerivedMeshOpfsCache }));
    const cache = createLazyDerivedMeshOpfsCache(options, load);
    const readInput: Parameters<DerivedGeometryMeshCache["read"]>[0] = {
      source: {
        id: "box-1",
        kind: "box",
        object: {
          id: "box-1",
          kind: "box",
          dimensions: { width: 1, height: 1, depth: 1 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      },
      sourceKey: "box-1"
    };
    const writeInput: Parameters<DerivedGeometryMeshCache["write"]>[0] = {
      ...readInput,
      result: {
        mesh: {
          id: "box-1",
          kind: "mesh",
          vertices: [],
          indices: [],
          edgeSegments: [],
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          },
          source: "derived",
          label: "box-1"
        },
        metrics: {
          objectId: "box-1",
          roundTripMs: 1,
          vertexCount: 0,
          triangleCount: 0
        },
        message: "ready"
      }
    };

    expect(load).not.toHaveBeenCalled();

    await cache.read(readInput);
    await cache.write(writeInput);

    expect(load).toHaveBeenCalledTimes(1);
    expect(createDerivedMeshOpfsCache).toHaveBeenCalledWith(options);
    expect(read).toHaveBeenCalledWith(readInput);
    expect(write).toHaveBeenCalledWith(writeInput);
  });

  it("shares concurrent loads and retries after a rejected load", async () => {
    const read = vi
      .fn<DerivedGeometryMeshCache["read"]>()
      .mockResolvedValue(undefined);
    const write = vi
      .fn<DerivedGeometryMeshCache["write"]>()
      .mockResolvedValue(undefined);
    const createDerivedMeshOpfsCache = vi.fn(() => ({ read, write }));
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("chunk unavailable"))
      .mockResolvedValue({ createDerivedMeshOpfsCache });
    const cache = createLazyDerivedMeshOpfsCache(options, load);
    const input: Parameters<DerivedGeometryMeshCache["read"]>[0] = {
      source: {
        id: "box-1",
        kind: "box",
        object: {
          id: "box-1",
          kind: "box",
          dimensions: { width: 1, height: 1, depth: 1 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      },
      sourceKey: "box-1"
    };

    const rejected = await Promise.allSettled([
      cache.read(input),
      cache.read(input)
    ]);

    expect(rejected.map((result) => result.status)).toEqual([
      "rejected",
      "rejected"
    ]);
    expect(load).toHaveBeenCalledTimes(1);

    await cache.read(input);

    expect(load).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenCalledWith(input);
  });
});

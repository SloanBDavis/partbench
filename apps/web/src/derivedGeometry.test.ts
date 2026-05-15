import type { BoxObject, CylinderObject } from "@web-cad/cad-core";
import type { RenderTriangleMesh } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import {
  createDerivedGeometryCacheKey,
  createEmptyDerivedGeometrySnapshot,
  DerivedGeometryService,
  getDerivedGeometryStatusLabel,
  type DerivedGeometrySnapshot
} from "./derivedGeometry";
import type {
  OcctMeshDevBoxInput,
  OcctMeshDevCylinderInput,
  OcctMeshDevResult,
  OcctMeshDevRuntime
} from "./occtMeshDev";

describe("derivedGeometry", () => {
  it("creates cache keys that change when object geometry inputs change", () => {
    const object = createBoxObject("box_1", 2);
    const movedObject: BoxObject = {
      ...object,
      transform: {
        ...object.transform,
        translation: [1, 0, 1]
      }
    };

    expect(createDerivedGeometryCacheKey(object)).not.toBe(
      createDerivedGeometryCacheKey(movedObject)
    );
  });

  it("marks boxes and cylinders pending then ready", async () => {
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime(async (input) =>
      createResult(input.id, createMesh(input.id))
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([createBoxObject("box_1", 2), createCylinderObject()]);

    expect(snapshots.at(-1)?.entries.map((entry) => entry.status)).toEqual([
      "pending",
      "pending"
    ]);
    expect(runtime.inputs.map((input) => input.id)).toEqual([
      "box_1",
      "cylinder_1"
    ]);

    await flushPromises();

    const snapshot = snapshots.at(-1) ?? createEmptyDerivedGeometrySnapshot();
    expect(snapshot.entries.map((entry) => entry.status)).toEqual([
      "ready",
      "ready"
    ]);
    expect(snapshot.meshes.map((mesh) => mesh.id)).toEqual([
      "box_1",
      "cylinder_1"
    ]);
    expect(getDerivedGeometryStatusLabel(snapshot.entries[0])).toBe(
      "mesh ready"
    );
  });

  it("does not duplicate requests for unchanged pending or ready objects", async () => {
    const deferred = createDeferred<OcctMeshDevResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const object = createBoxObject("box_1", 2);
    const runtime = createRuntime(() => deferred.promise);
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([object]);
    service.reconcile([object]);

    expect(runtime.inputs.map((input) => input.id)).toEqual(["box_1"]);

    deferred.resolve(createResult("box_1", createMesh("box_1")));
    await flushPromises();
    service.reconcile([object]);

    expect(runtime.inputs.map((input) => input.id)).toEqual(["box_1"]);
    expect(snapshots.at(-1)?.entries[0]?.status).toBe("ready");
  });

  it("emits reordered snapshots without re-requesting unchanged meshes", async () => {
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime(async (input) =>
      createResult(input.id, createMesh(input.id))
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const box = createBoxObject("box_1", 2);
    const cylinder = createCylinderObject("cylinder_1");

    service.reconcile([box, cylinder]);
    await flushPromises();
    service.reconcile([cylinder, box]);

    expect(runtime.inputs.map((input) => input.id)).toEqual([
      "box_1",
      "cylinder_1"
    ]);
    expect(snapshots.at(-1)?.entries.map((entry) => entry.objectId)).toEqual([
      "cylinder_1",
      "box_1"
    ]);
  });

  it("invalidates deleted objects and removes derived meshes", async () => {
    const snapshots: DerivedGeometrySnapshot[] = [];
    const service = new DerivedGeometryService({
      runtime: createRuntime(async (input) =>
        createResult(input.id, createMesh(input.id))
      ),
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([createBoxObject("box_1", 2)]);
    await flushPromises();
    service.reconcile([]);

    const snapshot = snapshots.at(-1) ?? createEmptyDerivedGeometrySnapshot();
    expect(snapshot.entries).toEqual([]);
    expect(snapshot.meshes).toEqual([]);
  });

  it("ignores stale worker results after object deletion", async () => {
    const pending = createDeferred<OcctMeshDevResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const service = new DerivedGeometryService({
      runtime: createRuntime(() => pending.promise),
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([createBoxObject("box_1", 2)]);
    service.reconcile([]);
    pending.resolve(createResult("box_1", createMesh("stale_mesh")));
    await flushPromises();

    const snapshot = snapshots.at(-1) ?? createEmptyDerivedGeometrySnapshot();
    expect(snapshot.entries).toEqual([]);
    expect(snapshot.meshes).toEqual([]);
  });

  it("ignores stale worker results after cache-key invalidation", async () => {
    const first = createDeferred<OcctMeshDevResult>();
    const second = createDeferred<OcctMeshDevResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const service = new DerivedGeometryService({
      runtime: createRuntime((input) =>
        "width" in input.dimensions && input.dimensions.width === 2
          ? first.promise
          : second.promise
      ),
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([createBoxObject("box_1", 2)]);
    service.reconcile([createBoxObject("box_1", 4)]);

    first.resolve(createResult("box_1", createMesh("stale_mesh")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]?.status).toBe("pending");
    expect(snapshots.at(-1)?.meshes).toEqual([]);

    second.resolve(createResult("box_1", createMesh("box_1")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]?.status).toBe("ready");
    expect(snapshots.at(-1)?.meshes.map((mesh) => mesh.id)).toEqual(["box_1"]);
  });

  it("ignores stale worker results after refresh with the same cache key", async () => {
    const first = createDeferred<OcctMeshDevResult>();
    const second = createDeferred<OcctMeshDevResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    let requestCount = 0;
    const service = new DerivedGeometryService({
      runtime: createRuntime(() => {
        requestCount += 1;
        return requestCount === 1 ? first.promise : second.promise;
      }),
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const object = createBoxObject("box_1", 2);

    service.reconcile([object]);
    service.refresh([object]);

    first.resolve(createResult("box_1", createMesh("stale_mesh")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]?.status).toBe("pending");
    expect(snapshots.at(-1)?.meshes).toEqual([]);

    second.resolve(createResult("box_1", createMesh("box_1")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]?.status).toBe("ready");
    expect(snapshots.at(-1)?.meshes.map((mesh) => mesh.id)).toEqual(["box_1"]);
  });

  it("records service errors without throwing from reconcile", async () => {
    const snapshots: DerivedGeometrySnapshot[] = [];
    const service = new DerivedGeometryService({
      runtime: createRuntime(async () => {
        throw new Error("worker failed");
      }),
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([createBoxObject("box_1", 2)]);
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "box_1",
      status: "error",
      error: {
        code: "UNKNOWN_OCCT_MESH_DEV_ERROR",
        message: "worker failed"
      }
    });
  });

  it("disposes runtime and ignores pending work after disposal", async () => {
    const pending = createDeferred<OcctMeshDevResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime(() => pending.promise);
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([createBoxObject("box_1", 2)]);
    service.dispose();
    service.reconcile([createBoxObject("box_2", 4)]);
    service.refresh([createBoxObject("box_2", 4)]);

    pending.resolve(createResult("box_1", createMesh("stale_mesh")));
    await flushPromises();

    expect(runtime.disposeCount).toBe(1);
    expect(runtime.inputs.map((input) => input.id)).toEqual(["box_1"]);
    expect(service.getSnapshot()).toEqual(createEmptyDerivedGeometrySnapshot());
    expect(snapshots.at(-1)?.entries.map((entry) => entry.status)).toEqual([
      "pending"
    ]);
  });
});

function createBoxObject(id: string, width: number): BoxObject {
  return {
    id,
    kind: "box",
    dimensions: {
      width,
      height: 3,
      depth: 4
    },
    transform: {
      translation: [0, 0, 2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createCylinderObject(id = "cylinder_1"): CylinderObject {
  return {
    id,
    kind: "cylinder",
    dimensions: {
      radius: 1,
      height: 2
    },
    transform: {
      translation: [0, 0, 1],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createRuntime(
  handler: (
    input: OcctMeshDevBoxInput | OcctMeshDevCylinderInput
  ) => Promise<OcctMeshDevResult>
): OcctMeshDevRuntime & {
  readonly inputs: readonly (OcctMeshDevBoxInput | OcctMeshDevCylinderInput)[];
  readonly disposeCount: number;
} {
  const inputs: (OcctMeshDevBoxInput | OcctMeshDevCylinderInput)[] = [];
  let disposeCount = 0;

  return {
    inputs,
    get disposeCount() {
      return disposeCount;
    },
    tessellateBox(input) {
      inputs.push(input);
      return handler(input);
    },
    tessellateCylinder(input) {
      inputs.push(input);
      return handler(input);
    },
    dispose() {
      disposeCount += 1;
    }
  };
}

function createResult(
  objectId: string,
  mesh: RenderTriangleMesh
): OcctMeshDevResult {
  return {
    mesh,
    metrics: {
      objectId,
      roundTripMs: 1,
      vertexCount: 24,
      triangleCount: 12
    },
    message: `Displayed derived OCCT mesh for ${objectId}.`
  };
}

function createMesh(id: string): RenderTriangleMesh {
  return {
    id,
    kind: "mesh",
    vertices: [],
    indices: [],
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolveValue: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    resolveValue = resolve;
  });

  return {
    promise,
    resolve: resolveValue
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

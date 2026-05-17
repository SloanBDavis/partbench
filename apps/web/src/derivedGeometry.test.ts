import {
  CadEngine,
  type BoxObject,
  type CadFeatureSummary,
  type ConeObject,
  type CylinderObject,
  type SphereObject,
  type TorusObject
} from "@web-cad/cad-core";
import type { RenderTriangleMesh } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import {
  createDerivedGeometryCacheKey,
  createEmptyDerivedGeometrySnapshot,
  DerivedGeometryService,
  getDerivedGeometryStatusLabel,
  type DerivedExtrudeGeometrySource,
  type DerivedGeometrySource,
  type DerivedGeometrySnapshot
} from "./derivedGeometry";
import type {
  DerivedGeometryBoxInput,
  DerivedGeometryConeInput,
  DerivedGeometryCylinderInput,
  DerivedGeometryExtrudeInput,
  DerivedGeometryResult,
  DerivedGeometryRuntime,
  DerivedGeometrySphereInput,
  DerivedGeometryTorusInput
} from "./derivedGeometryRuntime";
import { createDerivedGeometrySourcesFromDocument } from "./derivedGeometrySources";

type RuntimeInput =
  | DerivedGeometryBoxInput
  | DerivedGeometryCylinderInput
  | DerivedGeometrySphereInput
  | DerivedGeometryConeInput
  | DerivedGeometryTorusInput
  | DerivedGeometryExtrudeInput;

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
    const resizedObject: BoxObject = {
      ...object,
      dimensions: {
        ...object.dimensions,
        width: 4
      }
    };

    expect(createDerivedGeometryCacheKey(object)).not.toBe(
      createDerivedGeometryCacheKey(movedObject)
    );
    expect(createDerivedGeometryCacheKey(object)).not.toBe(
      createDerivedGeometryCacheKey(resizedObject)
    );
  });

  it("marks supported primitives pending then ready", async () => {
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime(async (input) =>
      createResult(input.id, createMesh(input.id))
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([
      createBoxObject("box_1", 2),
      createCylinderObject(),
      createSphereObject(),
      createConeObject(),
      createTorusObject()
    ]);

    expect(snapshots.at(-1)?.entries.map((entry) => entry.status)).toEqual([
      "pending",
      "pending",
      "pending",
      "pending",
      "pending"
    ]);
    expect(runtime.inputs.map((input) => input.id)).toEqual([
      "box_1",
      "cylinder_1",
      "sphere_1",
      "cone_1",
      "torus_1"
    ]);

    await flushPromises();

    const snapshot = snapshots.at(-1) ?? createEmptyDerivedGeometrySnapshot();
    expect(snapshot.entries.map((entry) => entry.status)).toEqual([
      "ready",
      "ready",
      "ready",
      "ready",
      "ready"
    ]);
    expect(snapshot.meshes.map((mesh) => mesh.id)).toEqual([
      "box_1",
      "cylinder_1",
      "sphere_1",
      "cone_1",
      "torus_1"
    ]);
    expect(getDerivedGeometryStatusLabel(snapshot.entries[0])).toBe(
      "OCCT mesh ready"
    );
    expect(getDerivedGeometryStatusLabel(undefined)).toBe("Primitive fallback");
  });

  it("does not duplicate requests for unchanged pending or ready objects", async () => {
    const deferred = createDeferred<DerivedGeometryResult>();
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

  it("updates extrude sources across feature delete undo and redo", () => {
    const engine = createExtrudedRectangleEngine();

    expect(getDerivedSourceIds(engine)).toEqual(["body_rect_1"]);

    engine.apply({ op: "feature.delete", id: "feat_rect_1" });

    expect(getDerivedSourceIds(engine)).toEqual([]);

    engine.undo();

    expect(getDerivedSourceIds(engine)).toEqual(["body_rect_1"]);

    engine.redo();

    expect(getDerivedSourceIds(engine)).toEqual([]);
  });

  it("updates extrude source cache keys across depth edits, undo, and redo", () => {
    const engine = createExtrudedRectangleEngine();
    const initialSource = getDerivedSources(engine)[0];

    if (!initialSource || initialSource.kind !== "extrude") {
      throw new Error("Expected an extrude derived source.");
    }

    const initialKey = createDerivedGeometryCacheKey(initialSource);
    expect(initialSource.depth).toBe(3);

    engine.apply({
      op: "feature.updateExtrude",
      id: "feat_rect_1",
      depth: 8
    });

    const editedSource = getDerivedSources(engine)[0];

    if (!editedSource || editedSource.kind !== "extrude") {
      throw new Error("Expected an edited extrude derived source.");
    }

    const editedKey = createDerivedGeometryCacheKey(editedSource);
    expect(editedSource.depth).toBe(8);
    expect(editedKey).not.toBe(initialKey);

    engine.undo();

    const undoneSource = getDerivedSources(engine)[0];

    if (!undoneSource || undoneSource.kind !== "extrude") {
      throw new Error("Expected an undone extrude derived source.");
    }

    expect(undoneSource.depth).toBe(3);
    expect(createDerivedGeometryCacheKey(undoneSource)).toBe(initialKey);

    engine.redo();

    const redoneSource = getDerivedSources(engine)[0];

    if (!redoneSource || redoneSource.kind !== "extrude") {
      throw new Error("Expected a redone extrude derived source.");
    }

    expect(redoneSource.depth).toBe(8);
    expect(createDerivedGeometryCacheKey(redoneSource)).toBe(editedKey);
  });

  it("invalidates deleted extrude bodies and removes derived meshes", async () => {
    const snapshots: DerivedGeometrySnapshot[] = [];
    const service = new DerivedGeometryService({
      runtime: createRuntime(async (input) =>
        createResult(input.id, createMesh(input.id))
      ),
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const source = createExtrudeSource("body_rect_1");

    service.reconcile([source]);
    await flushPromises();
    service.reconcile([]);

    const snapshot = snapshots.at(-1) ?? createEmptyDerivedGeometrySnapshot();
    expect(snapshot.entries).toEqual([]);
    expect(snapshot.meshes).toEqual([]);
  });

  it("ignores stale worker results after extrude depth invalidation", async () => {
    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime((input) =>
      "depth" in input && input.depth === 3 ? first.promise : second.promise
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const initialSource = createExtrudeSource("body_rect_1");
    const editedSource = { ...initialSource, depth: 8 };

    service.reconcile([initialSource]);
    service.reconcile([editedSource]);

    expect(
      runtime.inputs.map((input) => ("depth" in input ? input.depth : null))
    ).toEqual([3, 8]);

    first.resolve(createResult("body_rect_1", createMesh("stale_extrude")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_rect_1",
      status: "pending",
      cacheKey: createDerivedGeometryCacheKey(editedSource)
    });
    expect(snapshots.at(-1)?.meshes).toEqual([]);

    second.resolve(createResult("body_rect_1", createMesh("body_rect_1")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_rect_1",
      status: "ready",
      cacheKey: createDerivedGeometryCacheKey(editedSource)
    });
    expect(snapshots.at(-1)?.meshes.map((mesh) => mesh.id)).toEqual([
      "body_rect_1"
    ]);
  });

  it("ignores stale worker results after object deletion", async () => {
    const pending = createDeferred<DerivedGeometryResult>();
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

  it("ignores stale worker results after extrude body deletion", async () => {
    const pending = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const service = new DerivedGeometryService({
      runtime: createRuntime(() => pending.promise),
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([createExtrudeSource("body_rect_1")]);
    service.reconcile([]);
    pending.resolve(createResult("body_rect_1", createMesh("stale_mesh")));
    await flushPromises();

    const snapshot = snapshots.at(-1) ?? createEmptyDerivedGeometrySnapshot();
    expect(snapshot.entries).toEqual([]);
    expect(snapshot.meshes).toEqual([]);
  });

  it("ignores stale worker results after cache-key invalidation", async () => {
    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const service = new DerivedGeometryService({
      runtime: createRuntime((input) =>
        "dimensions" in input &&
        "width" in input.dimensions &&
        input.dimensions.width === 2
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
    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
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
        code: "UNKNOWN_DERIVED_GEOMETRY_ERROR",
        message: "worker failed"
      }
    });
  });

  it("labels error and unsupported states as primitive fallback", async () => {
    const snapshots: DerivedGeometrySnapshot[] = [];
    const service = new DerivedGeometryService({
      runtime: createRuntime(async () => {
        throw new Error("worker failed");
      }),
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([createBoxObject("box_1", 2)]);
    await flushPromises();

    const errorEntry = snapshots.at(-1)?.entries[0];
    expect(getDerivedGeometryStatusLabel(errorEntry)).toBe(
      "Primitive fallback"
    );

    service.reconcile([
      {
        ...createBoxObject("unsupported_1", 2),
        kind: "unsupported" as never
      }
    ]);

    expect(getDerivedGeometryStatusLabel(snapshots.at(-1)?.entries[0])).toBe(
      "Primitive fallback"
    );
  });

  it("disposes runtime and ignores pending work after disposal", async () => {
    const pending = createDeferred<DerivedGeometryResult>();
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

function createSphereObject(id = "sphere_1"): SphereObject {
  return {
    id,
    kind: "sphere",
    dimensions: {
      radius: 1.25
    },
    transform: {
      translation: [0, 0, 1.25],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createConeObject(id = "cone_1"): ConeObject {
  return {
    id,
    kind: "cone",
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

function createTorusObject(id = "torus_1"): TorusObject {
  return {
    id,
    kind: "torus",
    dimensions: {
      majorRadius: 1.5,
      minorRadius: 0.35
    },
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createExtrudeSource(id = "body_rect_1"): DerivedExtrudeGeometrySource {
  return {
    id,
    kind: "extrude",
    sketchPlane: "XY",
    profile: {
      kind: "rectangle",
      center: [0, 0],
      width: 4,
      height: 2
    },
    depth: 3
  };
}

function createExtrudedRectangleEngine(): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "rect_1",
      center: [0, 0],
      width: 4,
      height: 2
    }
  ]);
  engine.apply({
    op: "feature.extrude",
    id: "feat_rect_1",
    bodyId: "body_rect_1",
    sketchId: "sketch_1",
    entityId: "rect_1",
    depth: 3
  });

  return engine;
}

function getDerivedSourceIds(engine: CadEngine): readonly string[] {
  return getDerivedSources(engine).map((source) => source.id);
}

function getDerivedSources(
  engine: CadEngine
): readonly DerivedGeometrySource[] {
  return createDerivedGeometrySourcesFromDocument(
    engine.getDocument(),
    getProjectStructureFeatures(engine)
  );
}

function getProjectStructureFeatures(
  engine: CadEngine
): readonly CadFeatureSummary[] {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "project.structure" }
  });

  if (!response.ok || response.query !== "project.structure") {
    throw new Error("Expected project.structure query response.");
  }

  return response.features;
}

function createRuntime(
  handler: (input: RuntimeInput) => Promise<DerivedGeometryResult>
): DerivedGeometryRuntime & {
  readonly inputs: readonly RuntimeInput[];
  readonly disposeCount: number;
} {
  const inputs: RuntimeInput[] = [];
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
    tessellateSphere(input) {
      inputs.push(input);
      return handler(input);
    },
    tessellateCone(input) {
      inputs.push(input);
      return handler(input);
    },
    tessellateTorus(input) {
      inputs.push(input);
      return handler(input);
    },
    tessellateExtrude(input) {
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
): DerivedGeometryResult {
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

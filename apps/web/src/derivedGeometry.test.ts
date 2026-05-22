import {
  CadEngine,
  type BoxObject,
  type CadFeatureSummary,
  type ConeObject,
  type CylinderObject,
  type SphereObject,
  type TorusObject
} from "@web-cad/cad-core";
import type { CadGeneratedFaceReference } from "@web-cad/cad-protocol";
import type { RenderTriangleMesh } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import {
  createDerivedGeometryCacheKey,
  createEmptyDerivedGeometrySnapshot,
  DerivedGeometryService,
  getDerivedGeometryStatusLabel,
  transformExtrudeMeshToPlacement,
  type DerivedExtrudeGeometrySource,
  type DerivedBooleanExtrudeGeometrySource,
  type DerivedGeometrySource,
  type DerivedGeometrySnapshot
} from "./derivedGeometry";
import type {
  DerivedGeometryBoxInput,
  DerivedGeometryBooleanExtrudeInput,
  DerivedGeometryConeInput,
  DerivedGeometryCylinderInput,
  DerivedGeometryExtrudeInput,
  DerivedGeometryResult,
  DerivedGeometryRuntime,
  DerivedGeometrySphereInput,
  DerivedGeometryTorusInput
} from "./derivedGeometryRuntime";
import { createDerivedGeometrySourcesFromDocument } from "./derivedGeometrySources";
import { createGeneratedFaceReferenceKey } from "./sketchDisplayFrames";

type RuntimeInput =
  | DerivedGeometryBoxInput
  | DerivedGeometryCylinderInput
  | DerivedGeometrySphereInput
  | DerivedGeometryConeInput
  | DerivedGeometryTorusInput
  | DerivedGeometryExtrudeInput
  | DerivedGeometryBooleanExtrudeInput;

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

  it("updates extrude source cache keys across side edits, undo, and redo", () => {
    const engine = createExtrudedRectangleEngine();
    const initialSource = getDerivedSources(engine)[0];

    if (!initialSource || initialSource.kind !== "extrude") {
      throw new Error("Expected an extrude derived source.");
    }

    const initialKey = createDerivedGeometryCacheKey(initialSource);
    expect(initialSource.side).toBe("positive");

    engine.apply({
      op: "feature.updateExtrude",
      id: "feat_rect_1",
      side: "symmetric"
    });

    const editedSource = getDerivedSources(engine)[0];

    if (!editedSource || editedSource.kind !== "extrude") {
      throw new Error("Expected an edited extrude derived source.");
    }

    const editedKey = createDerivedGeometryCacheKey(editedSource);
    expect(editedSource.side).toBe("symmetric");
    expect(editedKey).not.toBe(initialKey);

    engine.undo();

    const undoneSource = getDerivedSources(engine)[0];

    if (!undoneSource || undoneSource.kind !== "extrude") {
      throw new Error("Expected an undone extrude derived source.");
    }

    expect(undoneSource.side).toBe("positive");
    expect(createDerivedGeometryCacheKey(undoneSource)).toBe(initialKey);

    engine.redo();

    const redoneSource = getDerivedSources(engine)[0];

    if (!redoneSource || redoneSource.kind !== "extrude") {
      throw new Error("Expected a redone extrude derived source.");
    }

    expect(redoneSource.side).toBe("symmetric");
    expect(createDerivedGeometryCacheKey(redoneSource)).toBe(editedKey);
  });

  it("updates extrude source cache keys across profile edits, undo, and redo", () => {
    const engine = createExtrudedRectangleEngine();
    const initialSource = getDerivedSources(engine)[0];

    if (!initialSource || initialSource.kind !== "extrude") {
      throw new Error("Expected an extrude derived source.");
    }

    const initialKey = createDerivedGeometryCacheKey(initialSource);
    expect(initialSource.profile).toMatchObject({
      kind: "rectangle",
      center: [0, 0],
      width: 4,
      height: 2
    });

    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "rect_1",
        kind: "rectangle",
        center: [1, 2],
        width: 6,
        height: 5
      }
    });

    const editedSource = getDerivedSources(engine)[0];

    if (!editedSource || editedSource.kind !== "extrude") {
      throw new Error("Expected an edited extrude derived source.");
    }

    const editedKey = createDerivedGeometryCacheKey(editedSource);
    expect(editedSource.profile).toMatchObject({
      kind: "rectangle",
      center: [1, 2],
      width: 6,
      height: 5
    });
    expect(editedKey).not.toBe(initialKey);

    engine.undo();

    const undoneSource = getDerivedSources(engine)[0];

    if (!undoneSource || undoneSource.kind !== "extrude") {
      throw new Error("Expected an undone extrude derived source.");
    }

    expect(undoneSource.profile).toMatchObject({
      kind: "rectangle",
      center: [0, 0],
      width: 4,
      height: 2
    });
    expect(createDerivedGeometryCacheKey(undoneSource)).toBe(initialKey);

    engine.redo();

    const redoneSource = getDerivedSources(engine)[0];

    if (!redoneSource || redoneSource.kind !== "extrude") {
      throw new Error("Expected a redone extrude derived source.");
    }

    expect(redoneSource.profile).toMatchObject({
      kind: "rectangle",
      center: [1, 2],
      width: 6,
      height: 5
    });
    expect(createDerivedGeometryCacheKey(redoneSource)).toBe(editedKey);
  });

  it("updates extrude source cache keys across driving dimension edits", () => {
    const engine = createExtrudedRectangleEngine();
    engine.applyBatch([
      { op: "parameter.create", id: "param_w", name: "Width", value: 6 },
      {
        op: "sketch.dimension.create",
        id: "dim_w",
        name: "Width dimension",
        sketchId: "sketch_1",
        entityId: "rect_1",
        target: { entityKind: "rectangle", role: "width" },
        parameterId: "param_w"
      }
    ]);

    const initialSource = getDerivedSources(engine)[0];

    if (!initialSource || initialSource.kind !== "extrude") {
      throw new Error("Expected an extrude derived source.");
    }

    const initialKey = createDerivedGeometryCacheKey(initialSource);
    expect(initialSource.profile).toMatchObject({
      kind: "rectangle",
      width: 6,
      height: 2
    });

    engine.apply({ op: "parameter.update", id: "param_w", value: 9 });

    const editedSource = getDerivedSources(engine)[0];

    if (!editedSource || editedSource.kind !== "extrude") {
      throw new Error("Expected an edited extrude derived source.");
    }

    const editedKey = createDerivedGeometryCacheKey(editedSource);
    expect(editedSource.profile).toMatchObject({
      kind: "rectangle",
      width: 9,
      height: 2
    });
    expect(editedKey).not.toBe(initialKey);

    engine.undo();
    const undoneSource = getDerivedSources(engine)[0];

    if (!undoneSource || undoneSource.kind !== "extrude") {
      throw new Error("Expected an undone extrude derived source.");
    }

    expect(undoneSource.profile).toMatchObject({
      kind: "rectangle",
      width: 6,
      height: 2
    });
    expect(createDerivedGeometryCacheKey(undoneSource)).toBe(initialKey);
  });

  it("derives attached extrude placement from generated face references", () => {
    const engine = createExtrudedRectangleEngine();

    engine.apply({
      op: "sketch.createOnFace",
      id: "sketch_attached_1",
      name: "Attached profile",
      bodyId: "body_rect_1",
      faceStableId: "generated:face:body_rect_1:endCap"
    });
    engine.apply({
      op: "sketch.addRectangle",
      sketchId: "sketch_attached_1",
      id: "rect_attached_1",
      center: [0, 0],
      width: 1,
      height: 1
    });
    engine.apply({
      op: "feature.extrude",
      id: "feat_attached_1",
      bodyId: "body_attached_1",
      sketchId: "sketch_attached_1",
      entityId: "rect_attached_1",
      depth: 2
    });

    const sources = createDerivedGeometrySourcesFromDocument(
      engine.getDocument(),
      getProjectStructureFeatures(engine),
      getGeneratedFacesByKey(engine, ["body_rect_1"])
    );
    const attachedSource = sources.find(
      (source): source is DerivedExtrudeGeometrySource =>
        source.kind === "extrude" && source.id === "body_attached_1"
    );

    expect(attachedSource?.placementError).toBeUndefined();
    expect(attachedSource?.placementFrame?.origin).toEqual([0, 0, 3]);
  });

  it("derives attached circle extrude placement from generated face references", () => {
    const engine = createExtrudedRectangleEngine();

    engine.apply({
      op: "sketch.createOnFace",
      id: "sketch_attached_1",
      name: "Attached circle profile",
      bodyId: "body_rect_1",
      faceStableId: "generated:face:body_rect_1:endCap"
    });
    engine.apply({
      op: "sketch.addCircle",
      sketchId: "sketch_attached_1",
      id: "circle_attached_1",
      center: [0.5, 0.25],
      radius: 0.75
    });
    engine.apply({
      op: "feature.extrude",
      id: "feat_attached_1",
      bodyId: "body_attached_1",
      sketchId: "sketch_attached_1",
      entityId: "circle_attached_1",
      depth: 2
    });

    const sources = createDerivedGeometrySourcesFromDocument(
      engine.getDocument(),
      getProjectStructureFeatures(engine),
      getGeneratedFacesByKey(engine, ["body_rect_1"])
    );
    const attachedSource = sources.find(
      (source): source is DerivedExtrudeGeometrySource =>
        source.kind === "extrude" && source.id === "body_attached_1"
    );

    expect(attachedSource?.profile).toMatchObject({
      kind: "circle",
      center: [0.5, 0.25],
      radius: 0.75
    });
    expect(attachedSource?.placementFrame?.origin).toEqual([0, 0, 3]);
  });

  it("derives cut result sources from active rectangle target and tool extrudes", async () => {
    const engine = createExtrudedRectangleEngine();

    engine.apply({
      op: "feature.extrude",
      id: "feat_cut_1",
      bodyId: "body_cut_1",
      targetBodyId: "body_rect_1",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 1,
      operationMode: "cut"
    });

    const sources = createDerivedGeometrySourcesFromDocument(
      engine.getDocument(),
      getProjectStructureFeatures(engine)
    );
    const cutSource = sources.find(
      (source): source is DerivedBooleanExtrudeGeometrySource =>
        source.kind === "extrudeBoolean"
    );

    expect(sources.map((source) => source.id)).toEqual(["body_cut_1"]);
    expect(cutSource).toMatchObject({
      id: "body_cut_1",
      kind: "extrudeBoolean",
      operation: "cut",
      target: { id: "body_rect_1", profile: { kind: "rectangle" } },
      tool: { id: "body_cut_1", profile: { kind: "rectangle" } }
    });

    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime(async (input) =>
      createResult(input.id, createMesh(input.id))
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile(sources);
    await flushPromises();

    expect(runtime.inputs).toEqual([
      expect.objectContaining({
        id: "body_cut_1",
        operation: "cut",
        target: expect.objectContaining({ depth: 3 }),
        tool: expect.objectContaining({ depth: 1 })
      })
    ]);
    expect(snapshots.at(-1)?.entries).toMatchObject([
      {
        objectId: "body_cut_1",
        objectKind: "extrudeBoolean",
        status: "ready"
      }
    ]);
  });

  it("derives add result sources from active rectangle target and tool extrudes", async () => {
    const engine = createExtrudedRectangleEngine();

    engine.apply({
      op: "feature.extrude",
      id: "feat_add_1",
      bodyId: "body_add_1",
      targetBodyId: "body_rect_1",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 1,
      operationMode: "add"
    });

    const sources = createDerivedGeometrySourcesFromDocument(
      engine.getDocument(),
      getProjectStructureFeatures(engine)
    );
    const addSource = sources.find(
      (source): source is DerivedBooleanExtrudeGeometrySource =>
        source.kind === "extrudeBoolean"
    );

    expect(sources.map((source) => source.id)).toEqual(["body_add_1"]);
    expect(addSource).toMatchObject({
      id: "body_add_1",
      kind: "extrudeBoolean",
      operation: "add",
      target: { id: "body_rect_1", profile: { kind: "rectangle" } },
      tool: { id: "body_add_1", profile: { kind: "rectangle" } }
    });

    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime(async (input) =>
      createResult(input.id, createMesh(input.id))
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile(sources);
    await flushPromises();

    expect(runtime.inputs).toEqual([
      expect.objectContaining({
        id: "body_add_1",
        operation: "add",
        target: expect.objectContaining({ depth: 3 }),
        tool: expect.objectContaining({ depth: 1 })
      })
    ]);
    expect(snapshots.at(-1)?.entries).toMatchObject([
      {
        objectId: "body_add_1",
        objectKind: "extrudeBoolean",
        status: "ready"
      }
    ]);
  });

  it("updates add result sources across undo and redo without double-listing the consumed target", () => {
    const engine = createExtrudedRectangleEngine();

    expect(getDerivedSourceIds(engine)).toEqual(["body_rect_1"]);

    engine.apply({
      op: "feature.extrude",
      id: "feat_add_1",
      bodyId: "body_add_1",
      targetBodyId: "body_rect_1",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 1,
      operationMode: "add"
    });

    expect(getDerivedSourceIds(engine)).toEqual(["body_add_1"]);

    engine.undo();

    expect(getDerivedSourceIds(engine)).toEqual(["body_rect_1"]);

    engine.redo();

    expect(getDerivedSourceIds(engine)).toEqual(["body_add_1"]);
  });

  it("updates boolean source keys and ignores stale results after parameter-driven target edits", async () => {
    const engine = createExtrudedRectangleEngine();

    engine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_tool",
        name: "Tool",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_tool",
        id: "rect_tool",
        center: [0, 0],
        width: 1,
        height: 1
      },
      {
        op: "feature.extrude",
        id: "feat_add_1",
        bodyId: "body_add_1",
        targetBodyId: "body_rect_1",
        sketchId: "sketch_tool",
        entityId: "rect_tool",
        depth: 1,
        operationMode: "add"
      },
      { op: "parameter.create", id: "param_w", name: "Width", value: 4 },
      {
        op: "sketch.dimension.create",
        id: "dim_w",
        name: "Target width",
        sketchId: "sketch_1",
        entityId: "rect_1",
        target: { entityKind: "rectangle", role: "width" },
        parameterId: "param_w"
      }
    ]);

    const initialSource = getDerivedSources(engine).find(
      (source): source is DerivedBooleanExtrudeGeometrySource =>
        source.kind === "extrudeBoolean" && source.id === "body_add_1"
    );

    engine.apply({ op: "parameter.update", id: "param_w", value: 8 });

    const editedSource = getDerivedSources(engine).find(
      (source): source is DerivedBooleanExtrudeGeometrySource =>
        source.kind === "extrudeBoolean" && source.id === "body_add_1"
    );

    expect(initialSource).toBeDefined();
    expect(editedSource).toBeDefined();
    if (!initialSource || !editedSource) {
      throw new Error("Expected boolean sources.");
    }

    expect(createDerivedGeometryCacheKey(initialSource)).not.toBe(
      createDerivedGeometryCacheKey(editedSource)
    );
    expect(editedSource.target.profile).toMatchObject({
      kind: "rectangle",
      width: 8
    });

    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime((input) =>
      "target" in input &&
      input.target.profile.kind === "rectangle" &&
      input.target.profile.width === 4
        ? first.promise
        : second.promise
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([initialSource]);
    service.reconcile([editedSource]);

    first.resolve(createResult("body_add_1", createMesh("stale_add")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_add_1",
      objectKind: "extrudeBoolean",
      status: "pending",
      cacheKey: createDerivedGeometryCacheKey(editedSource)
    });
    expect(snapshots.at(-1)?.meshes).toEqual([]);

    second.resolve(createResult("body_add_1", createMesh("body_add_1")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_add_1",
      objectKind: "extrudeBoolean",
      status: "ready",
      cacheKey: createDerivedGeometryCacheKey(editedSource)
    });
    expect(snapshots.at(-1)?.meshes.map((mesh) => mesh.id)).toEqual([
      "body_add_1"
    ]);
  });

  it("derives cut result sources from active circle target and rectangle tool extrudes", async () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        id: "circle_1",
        center: [0, 0],
        radius: 2
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "rect_tool",
        center: [0, 0],
        width: 1,
        height: 1
      },
      {
        op: "feature.extrude",
        id: "feat_circle_1",
        bodyId: "body_circle_1",
        sketchId: "sketch_1",
        entityId: "circle_1",
        depth: 4
      },
      {
        op: "feature.extrude",
        id: "feat_circle_cut",
        bodyId: "body_circle_cut",
        targetBodyId: "body_circle_1",
        sketchId: "sketch_1",
        entityId: "rect_tool",
        depth: 1,
        operationMode: "cut"
      }
    ]);

    const sources = createDerivedGeometrySourcesFromDocument(
      engine.getDocument(),
      getProjectStructureFeatures(engine)
    );
    const cutSource = sources.find(
      (source): source is DerivedBooleanExtrudeGeometrySource =>
        source.kind === "extrudeBoolean"
    );

    expect(sources.map((source) => source.id)).toEqual(["body_circle_cut"]);
    expect(cutSource).toMatchObject({
      id: "body_circle_cut",
      kind: "extrudeBoolean",
      operation: "cut",
      target: { id: "body_circle_1", profile: { kind: "circle" } },
      tool: { id: "body_circle_cut", profile: { kind: "rectangle" } }
    });

    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime(async (input) =>
      createResult(input.id, createMesh(input.id))
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile(sources);
    await flushPromises();

    expect(runtime.inputs).toEqual([
      expect.objectContaining({
        id: "body_circle_cut",
        operation: "cut",
        target: expect.objectContaining({
          depth: 4,
          profile: expect.objectContaining({ kind: "circle" })
        }),
        tool: expect.objectContaining({
          depth: 1,
          profile: expect.objectContaining({ kind: "rectangle" })
        })
      })
    ]);
    expect(snapshots.at(-1)?.entries).toMatchObject([
      {
        objectId: "body_circle_cut",
        objectKind: "extrudeBoolean",
        status: "ready"
      }
    ]);
  });

  it("keeps attached circle target cut tools placed from consumed target source references", async () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        id: "circle_1",
        center: [0, 0],
        radius: 2
      },
      {
        op: "feature.extrude",
        id: "feat_circle_1",
        bodyId: "body_circle_1",
        sketchId: "sketch_1",
        entityId: "circle_1",
        depth: 4
      },
      {
        op: "sketch.createOnFace",
        id: "sketch_face_1",
        name: "Cut sketch",
        bodyId: "body_circle_1",
        faceStableId: "generated:face:body_circle_1:endCap"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_face_1",
        id: "rect_tool",
        center: [0, 0],
        width: 1,
        height: 1
      },
      {
        op: "feature.extrude",
        id: "feat_circle_cut",
        bodyId: "body_circle_cut",
        targetBodyId: "body_circle_1",
        sketchId: "sketch_face_1",
        entityId: "rect_tool",
        depth: 1,
        operationMode: "cut"
      }
    ]);

    const sources = createDerivedGeometrySourcesFromDocument(
      engine.getDocument(),
      getProjectStructureFeatures(engine),
      getGeneratedFacesByKey(engine, ["body_circle_1"])
    );
    const cutSource = sources.find(
      (source): source is DerivedBooleanExtrudeGeometrySource =>
        source.kind === "extrudeBoolean"
    );

    expect(sources.map((source) => source.id)).toEqual(["body_circle_cut"]);
    expect(cutSource).toMatchObject({
      id: "body_circle_cut",
      kind: "extrudeBoolean",
      target: {
        id: "body_circle_1",
        profile: { kind: "circle" }
      },
      tool: {
        id: "body_circle_cut",
        profile: { kind: "rectangle" },
        placementFrame: {
          origin: [0, 0, 4]
        }
      }
    });
  });

  it("ignores stale worker results after cut target source invalidation", async () => {
    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime((input) =>
      "target" in input && input.target.profile.kind === "rectangle"
        ? input.target.profile.width === 4
          ? first.promise
          : second.promise
        : second.promise
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const initialSource: DerivedBooleanExtrudeGeometrySource = {
      id: "body_cut_1",
      kind: "extrudeBoolean",
      operation: "cut",
      target: createExtrudeSource("body_rect_1"),
      tool: createExtrudeSource("body_cut_1")
    };
    const editedSource: DerivedBooleanExtrudeGeometrySource = {
      ...initialSource,
      target: {
        ...initialSource.target,
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 8,
          height: 2
        }
      }
    };

    service.reconcile([initialSource]);
    service.reconcile([editedSource]);

    expect(
      runtime.inputs.map((input) =>
        "target" in input && input.target.profile.kind === "rectangle"
          ? input.target.profile.width
          : null
      )
    ).toEqual([4, 8]);

    first.resolve(createResult("body_cut_1", createMesh("stale_cut")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_cut_1",
      objectKind: "extrudeBoolean",
      status: "pending",
      cacheKey: createDerivedGeometryCacheKey(editedSource)
    });
    expect(snapshots.at(-1)?.meshes).toEqual([]);

    second.resolve(createResult("body_cut_1", createMesh("body_cut_1")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_cut_1",
      objectKind: "extrudeBoolean",
      status: "ready",
      cacheKey: createDerivedGeometryCacheKey(editedSource)
    });
    expect(snapshots.at(-1)?.meshes.map((mesh) => mesh.id)).toEqual([
      "body_cut_1"
    ]);
  });

  it("ignores stale worker results after add target source invalidation", async () => {
    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime((input) =>
      "target" in input && input.target.profile.kind === "rectangle"
        ? input.target.profile.width === 4
          ? first.promise
          : second.promise
        : second.promise
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const initialSource: DerivedBooleanExtrudeGeometrySource = {
      id: "body_add_1",
      kind: "extrudeBoolean",
      operation: "add",
      target: createExtrudeSource("body_rect_1"),
      tool: createExtrudeSource("body_add_1")
    };
    const editedSource: DerivedBooleanExtrudeGeometrySource = {
      ...initialSource,
      target: {
        ...initialSource.target,
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 8,
          height: 2
        }
      }
    };

    service.reconcile([initialSource]);
    service.reconcile([editedSource]);

    expect(
      runtime.inputs.map((input) =>
        "target" in input && input.target.profile.kind === "rectangle"
          ? input.target.profile.width
          : null
      )
    ).toEqual([4, 8]);

    first.resolve(createResult("body_add_1", createMesh("stale_add")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_add_1",
      objectKind: "extrudeBoolean",
      status: "pending",
      cacheKey: createDerivedGeometryCacheKey(editedSource)
    });
    expect(snapshots.at(-1)?.meshes).toEqual([]);

    second.resolve(createResult("body_add_1", createMesh("body_add_1")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_add_1",
      objectKind: "extrudeBoolean",
      status: "ready",
      cacheKey: createDerivedGeometryCacheKey(editedSource)
    });
    expect(snapshots.at(-1)?.meshes.map((mesh) => mesh.id)).toEqual([
      "body_add_1"
    ]);
  });

  it("ignores stale worker results after add tool source invalidation", async () => {
    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime((input) =>
      "tool" in input && input.tool.profile.kind === "rectangle"
        ? input.tool.profile.width === 4
          ? first.promise
          : second.promise
        : second.promise
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const initialSource: DerivedBooleanExtrudeGeometrySource = {
      id: "body_add_1",
      kind: "extrudeBoolean",
      operation: "add",
      target: createExtrudeSource("body_rect_1"),
      tool: createExtrudeSource("body_add_1")
    };
    const editedSource: DerivedBooleanExtrudeGeometrySource = {
      ...initialSource,
      tool: {
        ...initialSource.tool,
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 8,
          height: 2
        }
      }
    };

    service.reconcile([initialSource]);
    service.reconcile([editedSource]);

    expect(
      runtime.inputs.map((input) =>
        "tool" in input && input.tool.profile.kind === "rectangle"
          ? input.tool.profile.width
          : null
      )
    ).toEqual([4, 8]);

    first.resolve(createResult("body_add_1", createMesh("stale_add_tool")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_add_1",
      objectKind: "extrudeBoolean",
      status: "pending",
      cacheKey: createDerivedGeometryCacheKey(editedSource)
    });
    expect(snapshots.at(-1)?.meshes).toEqual([]);

    second.resolve(createResult("body_add_1", createMesh("body_add_1")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_add_1",
      objectKind: "extrudeBoolean",
      status: "ready",
      cacheKey: createDerivedGeometryCacheKey(editedSource)
    });
    expect(snapshots.at(-1)?.meshes.map((mesh) => mesh.id)).toEqual([
      "body_add_1"
    ]);
  });

  it("ignores stale worker results after circle cut target source invalidation", async () => {
    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime((input) =>
      "target" in input && input.target.profile.kind === "circle"
        ? input.target.profile.radius === 2
          ? first.promise
          : second.promise
        : second.promise
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const initialSource: DerivedBooleanExtrudeGeometrySource = {
      id: "body_circle_cut_1",
      kind: "extrudeBoolean",
      operation: "cut",
      target: createCircleExtrudeSource("body_circle_1"),
      tool: createExtrudeSource("body_circle_cut_1")
    };
    const editedSource: DerivedBooleanExtrudeGeometrySource = {
      ...initialSource,
      target: {
        ...initialSource.target,
        profile: {
          kind: "circle",
          center: [0, 0],
          radius: 3
        }
      }
    };

    service.reconcile([initialSource]);
    service.reconcile([editedSource]);

    expect(
      runtime.inputs.map((input) =>
        "target" in input && input.target.profile.kind === "circle"
          ? input.target.profile.radius
          : null
      )
    ).toEqual([2, 3]);

    first.resolve(
      createResult("body_circle_cut_1", createMesh("stale_circle_cut"))
    );
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_circle_cut_1",
      objectKind: "extrudeBoolean",
      status: "pending",
      cacheKey: createDerivedGeometryCacheKey(editedSource)
    });
    expect(snapshots.at(-1)?.meshes).toEqual([]);

    second.resolve(
      createResult("body_circle_cut_1", createMesh("body_circle_cut_1"))
    );
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_circle_cut_1",
      objectKind: "extrudeBoolean",
      status: "ready",
      cacheKey: createDerivedGeometryCacheKey(editedSource)
    });
    expect(snapshots.at(-1)?.meshes.map((mesh) => mesh.id)).toEqual([
      "body_circle_cut_1"
    ]);
  });

  it("marks attached extrudes unsupported when their generated face is stale", () => {
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime(async (input) =>
      createResult(input.id, createMesh(input.id))
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const source: DerivedExtrudeGeometrySource = {
      ...createExtrudeSource("body_attached_1"),
      placementError:
        "Attachment unresolved for Attached profile; derived extrude mesh is unavailable."
    };

    service.reconcile([source]);

    expect(runtime.inputs).toEqual([]);
    expect(snapshots.at(-1)?.entries).toEqual([
      {
        objectId: "body_attached_1",
        objectKind: "extrude",
        sourceId: "body_attached_1",
        sourceKind: "extrude",
        cacheKey: createDerivedGeometryCacheKey(source),
        status: "unsupported",
        message:
          "Attachment unresolved for Attached profile; derived extrude mesh is unavailable."
      }
    ]);
    expect(getDerivedGeometryStatusLabel(snapshots.at(-1)?.entries[0])).toBe(
      "Attachment unresolved for Attached profile; derived extrude mesh is unavailable."
    );
  });

  it("includes attached placement frames in extrude cache keys", () => {
    const source = createExtrudeSource("body_attached_1");
    const firstFrame = createPlacementFrame([0, 0, 3]);
    const secondFrame = createPlacementFrame([10, 0, 3]);

    expect(
      createDerivedGeometryCacheKey({
        ...source,
        placementFrame: firstFrame
      })
    ).not.toBe(
      createDerivedGeometryCacheKey({
        ...source,
        placementFrame: secondFrame
      })
    );
  });

  it("transforms attached extrude mesh results into the placement frame", async () => {
    const snapshots: DerivedGeometrySnapshot[] = [];
    const source: DerivedExtrudeGeometrySource = {
      ...createExtrudeSource("body_attached_1"),
      placementFrame: {
        origin: [10, 20, 30],
        uAxis: [0, 1, 0],
        vAxis: [0, 0, 1]
      }
    };
    const runtime = createRuntime(async (input) =>
      createResult(
        input.id,
        createMeshWithVertices(input.id, [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 1]
        ])
      )
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([source]);
    await flushPromises();

    expect(snapshots.at(-1)?.meshes[0]?.vertices).toEqual([
      [10, 20, 30],
      [10, 21, 30],
      [11, 20, 31]
    ]);
  });

  it("ignores stale worker results after attached placement invalidation", async () => {
    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    let requestCount = 0;
    const runtime = createRuntime(() => {
      requestCount += 1;

      return requestCount === 1 ? first.promise : second.promise;
    });
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const initialSource: DerivedExtrudeGeometrySource = {
      ...createExtrudeSource("body_attached_1"),
      placementFrame: createPlacementFrame([0, 0, 3])
    };
    const movedSource: DerivedExtrudeGeometrySource = {
      ...initialSource,
      placementFrame: createPlacementFrame([0, 0, 6])
    };

    service.reconcile([initialSource]);
    service.reconcile([movedSource]);

    first.resolve(createResult("body_attached_1", createMesh("stale_mesh")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_attached_1",
      status: "pending",
      cacheKey: createDerivedGeometryCacheKey(movedSource)
    });
    expect(snapshots.at(-1)?.meshes).toEqual([]);

    second.resolve(
      createResult("body_attached_1", createMesh("body_attached_1"))
    );
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_attached_1",
      status: "ready",
      cacheKey: createDerivedGeometryCacheKey(movedSource)
    });
  });

  it("transforms standalone extrude meshes with placement frames", () => {
    const mesh = createMeshWithVertices("body_attached_1", [
      [0, 0, 0],
      [0, 1, 2]
    ]);

    expect(
      transformExtrudeMeshToPlacement(mesh, "XY", {
        origin: [5, 6, 7],
        uAxis: [0, 1, 0],
        vAxis: [0, 0, 1]
      }).vertices
    ).toEqual([
      [5, 6, 7],
      [7, 6, 8]
    ]);
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

  it("ignores stale worker results after extrude side invalidation", async () => {
    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime((input) =>
      "side" in input && input.side === "positive"
        ? first.promise
        : second.promise
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const initialSource = createExtrudeSource("body_rect_1");
    const editedSource: DerivedExtrudeGeometrySource = {
      ...initialSource,
      side: "negative"
    };

    service.reconcile([initialSource]);
    service.reconcile([editedSource]);

    expect(
      runtime.inputs.map((input) => ("side" in input ? input.side : null))
    ).toEqual(["positive", "negative"]);

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

  it("ignores stale worker results after extrude profile invalidation", async () => {
    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime((input) =>
      "profile" in input &&
      input.profile.kind === "rectangle" &&
      input.profile.width === 4
        ? first.promise
        : second.promise
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const initialSource = createExtrudeSource("body_rect_1");
    const editedSource: DerivedExtrudeGeometrySource = {
      ...initialSource,
      profile: {
        kind: "rectangle",
        center: [1, 2],
        width: 6,
        height: 5
      }
    };

    service.reconcile([initialSource]);
    service.reconcile([editedSource]);

    expect(
      runtime.inputs.map((input) =>
        "profile" in input && input.profile.kind === "rectangle"
          ? input.profile.width
          : null
      )
    ).toEqual([4, 6]);

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

  it("labels fallback-capable errors separately from unsupported cut results", async () => {
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

    service.reconcile([
      {
        id: "body_cut_unsupported",
        kind: "extrudeBoolean",
        operation: "cut",
        target: createExtrudeSource("body_target"),
        tool: createCircleExtrudeSource("body_circle_tool")
      }
    ]);

    expect(getDerivedGeometryStatusLabel(snapshots.at(-1)?.entries[0])).toBe(
      "Boolean display currently supports rectangle tool extrudes only."
    );

    service.reconcile([
      {
        id: "body_add_unsupported",
        kind: "extrudeBoolean",
        operation: "add",
        target: createCircleExtrudeSource("body_circle_target"),
        tool: createExtrudeSource("body_add_tool")
      }
    ]);

    expect(getDerivedGeometryStatusLabel(snapshots.at(-1)?.entries[0])).toBe(
      "Boolean add display currently supports rectangle target extrudes only."
    );
  });

  it("labels boolean mesh errors without implying primitive fallback", async () => {
    const snapshots: DerivedGeometrySnapshot[] = [];
    const service = new DerivedGeometryService({
      runtime: createRuntime(async () => {
        throw new Error("boolean worker failed");
      }),
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([
      {
        id: "body_cut_1",
        kind: "extrudeBoolean",
        operation: "cut",
        target: createCircleExtrudeSource("body_circle_1"),
        tool: createExtrudeSource("body_cut_1")
      }
    ]);
    await flushPromises();

    expect(getDerivedGeometryStatusLabel(snapshots.at(-1)?.entries[0])).toBe(
      "Boolean mesh error"
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
    depth: 3,
    side: "positive"
  };
}

function createCircleExtrudeSource(id: string): DerivedExtrudeGeometrySource {
  return {
    id,
    kind: "extrude",
    sketchPlane: "XY",
    profile: {
      kind: "circle",
      center: [0, 0],
      radius: 2
    },
    depth: 3,
    side: "positive"
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
    booleanExtrudes(input) {
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

function createMeshWithVertices(
  id: string,
  vertices: RenderTriangleMesh["vertices"]
): RenderTriangleMesh {
  return {
    ...createMesh(id),
    vertices
  };
}

function createPlacementFrame(
  origin: readonly [number, number, number]
): DerivedExtrudeGeometrySource["placementFrame"] {
  return {
    origin: [origin[0], origin[1], origin[2]],
    uAxis: [1, 0, 0],
    vAxis: [0, 1, 0]
  };
}

function getGeneratedFacesByKey(
  engine: CadEngine,
  bodyIds: readonly string[]
): ReadonlyMap<string, CadGeneratedFaceReference> {
  const faces = new Map<string, CadGeneratedFaceReference>();

  for (const bodyId of bodyIds) {
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.generatedReferences", bodyId }
    });

    if (!response.ok || response.query !== "body.generatedReferences") {
      throw new Error("Expected body.generatedReferences query response.");
    }

    for (const face of response.faces) {
      faces.set(
        createGeneratedFaceReferenceKey(face.bodyId, face.stableId),
        face
      );
    }
  }

  return faces;
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

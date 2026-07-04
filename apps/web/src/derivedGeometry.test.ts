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
  type DerivedBooleanExtrudeGeometrySource,
  type DerivedEdgeFinishGeometrySource,
  type DerivedExtrudeGeometrySource,
  type DerivedHoleGeometrySource,
  type DerivedShellGeometrySource,
  type DerivedRevolveGeometrySource,
  type DerivedGeometrySource,
  type DerivedGeometrySnapshot
} from "./derivedGeometry";
import type {
  DerivedGeometryBoxInput,
  DerivedGeometryBooleanExtrudeInput,
  DerivedGeometryBooleanExtrudePrimitiveInputSource,
  DerivedGeometryCircularPatternInput,
  DerivedGeometryConeInput,
  DerivedGeometryCylinderInput,
  DerivedGeometryEdgeFinishInput,
  DerivedGeometryMirrorInput,
  DerivedGeometryShellInput,
  DerivedExactMetadataResult,
  DerivedGeometryExtrudeInput,
  DerivedGeometryHoleInput,
  DerivedGeometryLinearPatternInput,
  DerivedGeometryRevolveInput,
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
  | DerivedGeometryRevolveInput
  | DerivedGeometryHoleInput
  | DerivedGeometryEdgeFinishInput
  | DerivedGeometryBooleanExtrudeInput
  | DerivedGeometryLinearPatternInput
  | DerivedGeometryCircularPatternInput
  | DerivedGeometryMirrorInput
  | DerivedGeometryShellInput;

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
      "Display geometry ready"
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

  it("updates revolve sources across feature delete undo and redo", () => {
    const engine = createRevolveEngine();

    expect(getDerivedSourceIds(engine)).toEqual([
      "body_revolve_rect_1",
      "body_revolve_circle_1"
    ]);

    engine.apply({ op: "feature.delete", id: "feat_revolve_rect_1" });

    expect(getDerivedSourceIds(engine)).toEqual(["body_revolve_circle_1"]);

    engine.undo();

    expect(getDerivedSourceIds(engine)).toEqual([
      "body_revolve_rect_1",
      "body_revolve_circle_1"
    ]);

    engine.redo();

    expect(getDerivedSourceIds(engine)).toEqual(["body_revolve_circle_1"]);
  });

  it("creates authored revolve sources from rectangle and circle profiles", () => {
    const engine = createRevolveEngine();
    const sources = getDerivedSources(engine);

    expect(sources.map((source) => source.id)).toEqual([
      "body_revolve_rect_1",
      "body_revolve_circle_1"
    ]);
    expect(sources).toMatchObject([
      {
        id: "body_revolve_rect_1",
        kind: "revolve",
        sketchPlane: "XY",
        profile: {
          kind: "rectangle",
          center: [2, 0],
          width: 1,
          height: 2
        },
        axis: {
          start: [0, -2],
          end: [0, 2]
        },
        angleDegrees: 270
      },
      {
        id: "body_revolve_circle_1",
        kind: "revolve",
        sketchPlane: "XY",
        profile: {
          kind: "circle",
          center: [4, 0],
          radius: 0.5
        },
        axis: {
          start: [0, -2],
          end: [0, 2]
        },
        angleDegrees: 180
      }
    ]);
  });

  it("updates revolve source cache keys across profile and axis edits", () => {
    const engine = createRevolveEngine();
    const initialSource = getDerivedSources(engine).find(
      (source): source is DerivedRevolveGeometrySource =>
        source.id === "body_revolve_rect_1" && source.kind === "revolve"
    );

    if (!initialSource) {
      throw new Error("Expected a revolve derived source.");
    }

    const initialKey = createDerivedGeometryCacheKey(initialSource);

    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "rect_1",
        kind: "rectangle",
        center: [2, 0],
        width: 3,
        height: 2
      }
    });

    const profileEditedSource = getDerivedSources(engine).find(
      (source): source is DerivedRevolveGeometrySource =>
        source.id === "body_revolve_rect_1" && source.kind === "revolve"
    );

    if (!profileEditedSource) {
      throw new Error("Expected an edited revolve derived source.");
    }

    const profileEditedKey = createDerivedGeometryCacheKey(profileEditedSource);
    expect(profileEditedSource.profile).toMatchObject({
      kind: "rectangle",
      width: 3,
      height: 2
    });
    expect(profileEditedKey).not.toBe(initialKey);

    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "axis_1",
        kind: "line",
        start: [0, -3],
        end: [0, 3]
      }
    });

    const axisEditedSource = getDerivedSources(engine).find(
      (source): source is DerivedRevolveGeometrySource =>
        source.id === "body_revolve_rect_1" && source.kind === "revolve"
    );

    if (!axisEditedSource) {
      throw new Error("Expected an axis-edited revolve derived source.");
    }

    expect(axisEditedSource.axis).toEqual({
      start: [0, -3],
      end: [0, 3]
    });
    expect(createDerivedGeometryCacheKey(axisEditedSource)).not.toBe(
      profileEditedKey
    );
    expect(
      createDerivedGeometryCacheKey({
        ...axisEditedSource,
        angleDegrees: 90
      })
    ).not.toBe(createDerivedGeometryCacheKey(axisEditedSource));
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

  it("updates extrude source cache keys across constrained profile edits", () => {
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
      },
      {
        op: "sketch.constraint.create",
        id: "fix_center",
        name: "Fixed rectangle center",
        sketchId: "sketch_1",
        kind: "fixed",
        target: { entityId: "rect_1", role: "center" },
        coordinate: [2, 3]
      }
    ]);

    const constrainedSource = getDerivedSources(engine)[0];

    if (!constrainedSource || constrainedSource.kind !== "extrude") {
      throw new Error("Expected a constrained extrude derived source.");
    }

    const constrainedKey = createDerivedGeometryCacheKey(constrainedSource);
    expect(constrainedSource.profile).toMatchObject({
      kind: "rectangle",
      center: [2, 3],
      width: 6,
      height: 2
    });

    engine.apply({ op: "parameter.update", id: "param_w", value: 9 });

    const editedSource = getDerivedSources(engine)[0];

    if (!editedSource || editedSource.kind !== "extrude") {
      throw new Error("Expected an edited constrained extrude derived source.");
    }

    const editedKey = createDerivedGeometryCacheKey(editedSource);
    expect(editedSource.profile).toMatchObject({
      kind: "rectangle",
      center: [2, 3],
      width: 9,
      height: 2
    });
    expect(editedKey).not.toBe(constrainedKey);

    engine.undo();

    const undoneSource = getDerivedSources(engine)[0];

    if (!undoneSource || undoneSource.kind !== "extrude") {
      throw new Error("Expected an undone constrained extrude derived source.");
    }

    expect(undoneSource.profile).toMatchObject({
      kind: "rectangle",
      center: [2, 3],
      width: 6,
      height: 2
    });
    expect(createDerivedGeometryCacheKey(undoneSource)).toBe(constrainedKey);
  });

  it("updates extrude source cache keys across midpoint-driven center edits", () => {
    const engine = createExtrudedRectangleEngine();
    engine.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "mid_line",
        start: [-2, -2],
        end: [2, 2]
      },
      {
        op: "sketch.constraint.create",
        id: "mid_rect",
        name: "Rectangle center midpoint",
        sketchId: "sketch_1",
        kind: "midpoint",
        lineEntityId: "mid_line",
        target: { entityId: "rect_1", role: "center" }
      }
    ]);

    const midpointSource = getDerivedSources(engine)[0];

    if (!midpointSource || midpointSource.kind !== "extrude") {
      throw new Error("Expected a midpoint-constrained extrude source.");
    }

    const midpointKey = createDerivedGeometryCacheKey(midpointSource);
    expect(midpointSource.profile).toMatchObject({
      kind: "rectangle",
      center: [0, 0],
      width: 4,
      height: 2
    });

    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "mid_line",
        kind: "line",
        start: [2, 4],
        end: [6, 8]
      }
    });

    const editedSource = getDerivedSources(engine)[0];

    if (!editedSource || editedSource.kind !== "extrude") {
      throw new Error("Expected an edited midpoint extrude source.");
    }

    const editedKey = createDerivedGeometryCacheKey(editedSource);
    expect(editedSource.profile).toMatchObject({
      kind: "rectangle",
      center: [4, 6],
      width: 4,
      height: 2
    });
    expect(editedKey).not.toBe(midpointKey);

    engine.undo();

    const undoneSource = getDerivedSources(engine)[0];

    if (!undoneSource || undoneSource.kind !== "extrude") {
      throw new Error("Expected an undone midpoint extrude source.");
    }

    expect(undoneSource.profile).toMatchObject({
      kind: "rectangle",
      center: [0, 0],
      width: 4,
      height: 2
    });
    expect(createDerivedGeometryCacheKey(undoneSource)).toBe(midpointKey);

    engine.redo();

    const redoneSource = getDerivedSources(engine)[0];

    if (!redoneSource || redoneSource.kind !== "extrude") {
      throw new Error("Expected a redone midpoint extrude source.");
    }

    expect(redoneSource.profile).toMatchObject({
      kind: "rectangle",
      center: [4, 6],
      width: 4,
      height: 2
    });
    expect(createDerivedGeometryCacheKey(redoneSource)).toBe(editedKey);
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

  it("derives mirror sources alongside the surviving seed and dispatches mirror runtime requests", async () => {
    const engine = createExtrudedRectangleEngine();

    engine.apply({
      op: "feature.mirror",
      id: "feat_mirror_1",
      bodyId: "body_mirror_1",
      seedBodyId: "body_rect_1",
      mirrorPlane: "YZ",
      includeOriginal: false
    });

    const sources = createDerivedGeometrySourcesFromDocument(
      engine.getDocument(),
      getProjectStructureFeatures(engine)
    );

    // includeOriginal=false: the seed body keeps its own display source and
    // the mirror result renders as an independent reflected copy.
    expect(sources.map((source) => source.id)).toEqual([
      "body_rect_1",
      "body_mirror_1"
    ]);
    expect(sources[1]).toMatchObject({
      id: "body_mirror_1",
      kind: "mirror",
      mirrorPlane: "YZ",
      includeOriginal: false,
      seed: { id: "body_rect_1", profile: { kind: "rectangle" }, depth: 3 }
    });

    const runtime = createRuntime(async (input) =>
      createResult(input.id, createMesh(input.id))
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: () => undefined
    });

    service.reconcile(sources);
    await flushPromises();

    expect(runtime.inputs).toEqual([
      expect.objectContaining({ id: "body_rect_1" }),
      expect.objectContaining({
        id: "body_mirror_1",
        mirrorPlane: "YZ",
        includeOriginal: false,
        seed: expect.objectContaining({ kind: "extrude", depth: 3 })
      })
    ]);
  });

  it("hides the consumed seed display when a mirror includes the original", async () => {
    const engine = createExtrudedRectangleEngine();

    engine.apply({
      op: "feature.mirror",
      id: "feat_mirror_1",
      bodyId: "body_mirror_1",
      seedBodyId: "body_rect_1",
      mirrorPlane: "XZ",
      includeOriginal: true
    });

    const sources = createDerivedGeometrySourcesFromDocument(
      engine.getDocument(),
      getProjectStructureFeatures(engine)
    );

    // includeOriginal=true: the union result subsumes the seed, so only the
    // mirror source renders — no overlapping seed mesh.
    expect(sources.map((source) => source.id)).toEqual(["body_mirror_1"]);
    expect(sources[0]).toMatchObject({
      id: "body_mirror_1",
      kind: "mirror",
      mirrorPlane: "XZ",
      includeOriginal: true
    });
  });

  it("derives shell sources from consumed targets and dispatches open-face runtime requests", async () => {
    const engine = createExtrudedRectangleEngine();

    engine.apply({
      op: "feature.shell",
      id: "feat_shell_1",
      bodyId: "body_shell_1",
      targetBodyId: "body_rect_1",
      wallThickness: 0.2,
      openFaceRefs: [
        {
          kind: "generatedFace",
          bodyId: "body_rect_1",
          stableId: "generated:face:body_rect_1:endCap"
        }
      ]
    });

    const sources = createDerivedGeometrySourcesFromDocument(
      engine.getDocument(),
      getProjectStructureFeatures(engine),
      getGeneratedFacesByKey(engine, ["body_rect_1"])
    );
    const shellSource = sources.find(
      (source): source is DerivedShellGeometrySource =>
        source.kind === "shell"
    );

    expect(sources.map((source) => source.id)).toEqual(["body_shell_1"]);
    expect(shellSource).toMatchObject({
      id: "body_shell_1",
      kind: "shell",
      wallThickness: 0.2,
      openFaceStableIds: ["generated:face:body_rect_1:endCap"],
      target: {
        id: "body_rect_1",
        kind: "extrude",
        profile: { kind: "rectangle" },
        depth: 3
      }
    });
    expect(createDerivedGeometryCacheKey(shellSource!)).toContain(
      "generated:face:body_rect_1:endCap"
    );

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
        id: "body_shell_1",
        wallThickness: 0.2,
        openFaceStableIds: ["generated:face:body_rect_1:endCap"],
        target: expect.objectContaining({ kind: "extrude", depth: 3 })
      })
    ]);
    expect(snapshots.at(-1)?.entries).toMatchObject([
      {
        objectId: "body_shell_1",
        objectKind: "shell",
        status: "ready"
      }
    ]);
  });

  it("reports a placement error for mirror seeds outside the extrude family", async () => {
    const engine = new CadEngine();

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XZ" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "rect_1",
        center: [1.5, 1],
        width: 1,
        height: 2
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "axis_1",
        start: [0, 0],
        end: [0, 1]
      },
      {
        op: "feature.revolve",
        id: "feat_revolve_1",
        bodyId: "body_revolve_1",
        sketchId: "sketch_1",
        entityId: "rect_1",
        axis: { type: "sketchLine", sketchId: "sketch_1", entityId: "axis_1" },
        angleDegrees: 360
      },
      {
        op: "feature.mirror",
        id: "feat_mirror_1",
        bodyId: "body_mirror_1",
        seedBodyId: "body_revolve_1",
        mirrorPlane: "XY",
        includeOriginal: false
      }
    ]);

    const sources = createDerivedGeometrySourcesFromDocument(
      engine.getDocument(),
      getProjectStructureFeatures(engine)
    );
    const mirrorSource = sources.find((source) => source.kind === "mirror");

    expect(mirrorSource).toMatchObject({
      id: "body_mirror_1",
      placementError: expect.stringContaining("body_revolve_1")
    });
  });

  it("derives chained cut sources from active boolean result targets", async () => {
    const engine = createExtrudedRectangleEngine();

    engine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_cut_1",
        name: "Cut 1",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_cut_1",
        id: "rect_cut_1",
        center: [-0.5, 0],
        width: 1,
        height: 1
      },
      {
        op: "sketch.create",
        id: "sketch_cut_2",
        name: "Cut 2",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_cut_2",
        id: "rect_cut_2",
        center: [0.5, 0],
        width: 1,
        height: 1
      }
    ]);

    const baseFeature = getProjectStructureFeatures(engine).find(
      (feature): feature is Extract<CadFeatureSummary, { kind: "extrude" }> =>
        feature.kind === "extrude" && feature.bodyId === "body_rect_1"
    );

    if (!baseFeature) {
      throw new Error("Expected base extrude feature.");
    }

    const cut1Feature: Extract<CadFeatureSummary, { kind: "extrude" }> = {
      ...baseFeature,
      id: "feat_cut_1",
      bodyId: "body_cut_1",
      sketchId: "sketch_cut_1",
      entityId: "rect_cut_1",
      depth: 1,
      operationMode: "cut",
      targetBodyId: "body_rect_1",
      source: {
        type: "sketchEntity",
        sketchId: "sketch_cut_1",
        entityId: "rect_cut_1"
      }
    };
    const cut2Feature: Extract<CadFeatureSummary, { kind: "extrude" }> = {
      ...baseFeature,
      id: "feat_cut_2",
      bodyId: "body_cut_2",
      sketchId: "sketch_cut_2",
      entityId: "rect_cut_2",
      depth: 1,
      operationMode: "cut",
      targetBodyId: "body_cut_1",
      source: {
        type: "sketchEntity",
        sketchId: "sketch_cut_2",
        entityId: "rect_cut_2"
      }
    };

    const sources = createDerivedGeometrySourcesFromDocument(
      engine.getDocument(),
      [baseFeature, cut1Feature, cut2Feature]
    );
    const cutSource = sources.find(
      (source): source is DerivedBooleanExtrudeGeometrySource =>
        source.kind === "extrudeBoolean"
    );

    expect(sources.map((source) => source.id)).toEqual(["body_cut_2"]);
    expect(cutSource).toMatchObject({
      id: "body_cut_2",
      kind: "extrudeBoolean",
      operation: "cut",
      target: {
        id: "body_cut_1",
        kind: "extrudeBoolean",
        operation: "cut",
        target: { id: "body_rect_1", profile: { kind: "rectangle" } },
        tool: { id: "body_cut_1", profile: { kind: "rectangle" } }
      },
      tool: { id: "body_cut_2", profile: { kind: "rectangle" } }
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
        id: "body_cut_2",
        operation: "cut",
        target: expect.objectContaining({
          kind: "booleanExtrudes",
          operation: "cut",
          target: expect.objectContaining({
            depth: 3,
            profile: expect.objectContaining({ kind: "rectangle" })
          }),
          tool: expect.objectContaining({
            depth: 1,
            profile: expect.objectContaining({ kind: "rectangle" })
          })
        }),
        tool: expect.objectContaining({
          depth: 1,
          profile: expect.objectContaining({ kind: "rectangle" })
        })
      })
    ]);
    expect(snapshots.at(-1)?.entries).toMatchObject([
      {
        objectId: "body_cut_2",
        objectKind: "extrudeBoolean",
        status: "ready"
      }
    ]);
  });

  it("derives attached-face rectangle cuts with inward tool direction", async () => {
    const engine = createExtrudedRectangleEngine();

    engine.applyBatch([
      {
        op: "sketch.createOnFace",
        id: "sketch_cut_face",
        name: "Cut sketch",
        bodyId: "body_rect_1",
        faceStableId: "generated:face:body_rect_1:endCap"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_cut_face",
        id: "rect_cut_tool",
        center: [0, 0],
        width: 1,
        height: 1
      },
      {
        op: "feature.extrude",
        id: "feat_cut_face",
        bodyId: "body_cut_face",
        targetBodyId: "body_rect_1",
        sketchId: "sketch_cut_face",
        entityId: "rect_cut_tool",
        depth: 1,
        side: "negative",
        operationMode: "cut"
      }
    ]);

    const sources = createDerivedGeometrySourcesFromDocument(
      engine.getDocument(),
      getProjectStructureFeatures(engine),
      getGeneratedFacesByKey(engine, ["body_rect_1"])
    );
    const cutSource = sources.find(
      (source): source is DerivedBooleanExtrudeGeometrySource =>
        source.kind === "extrudeBoolean"
    );

    expect(sources.map((source) => source.id)).toEqual(["body_cut_face"]);
    expect(cutSource).toMatchObject({
      id: "body_cut_face",
      kind: "extrudeBoolean",
      operation: "cut",
      target: { id: "body_rect_1", profile: { kind: "rectangle" } },
      tool: {
        id: "body_cut_face",
        profile: { kind: "rectangle" },
        side: "negative",
        placementFrame: {
          origin: [0, 0, 3]
        }
      }
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
        id: "body_cut_face",
        operation: "cut",
        tool: expect.objectContaining({
          side: "negative",
          placementFrame: expect.objectContaining({
            origin: [0, 0, 3]
          })
        })
      })
    ]);
    expect(snapshots.at(-1)?.entries).toMatchObject([
      {
        objectId: "body_cut_face",
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
    expect(getPrimitiveBooleanTarget(editedSource).profile).toMatchObject({
      kind: "rectangle",
      width: 8
    });

    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime((input) => {
      const target = getRuntimePrimitiveTarget(input);

      return target?.profile.kind === "rectangle" && target.profile.width === 4
        ? first.promise
        : second.promise;
    });
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

  it("updates boolean source keys after constrained target edits", async () => {
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
      }
    ]);

    const initialSource = getDerivedSources(engine).find(
      (source): source is DerivedBooleanExtrudeGeometrySource =>
        source.kind === "extrudeBoolean" && source.id === "body_add_1"
    );

    engine.apply({
      op: "sketch.constraint.create",
      id: "fix_target_center",
      name: "Fixed target center",
      sketchId: "sketch_1",
      kind: "fixed",
      target: { entityId: "rect_1", role: "center" },
      coordinate: [2, 3]
    });

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
    expect(getPrimitiveBooleanTarget(editedSource).profile).toMatchObject({
      kind: "rectangle",
      center: [2, 3]
    });

    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime((input) => {
      const target = getRuntimePrimitiveTarget(input);

      return target?.profile.kind === "rectangle" &&
        target.profile.center[0] === 0
        ? first.promise
        : second.promise;
    });
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

  it("ignores stale worker results after midpoint-driven boolean target edits", async () => {
    const engine = createExtrudedRectangleEngine();

    engine.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "mid_line",
        start: [-2, -2],
        end: [2, 2]
      },
      {
        op: "sketch.constraint.create",
        id: "mid_rect",
        name: "Rectangle center midpoint",
        sketchId: "sketch_1",
        kind: "midpoint",
        lineEntityId: "mid_line",
        target: { entityId: "rect_1", role: "center" }
      },
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
      }
    ]);

    const initialSource = getDerivedSources(engine).find(
      (source): source is DerivedBooleanExtrudeGeometrySource =>
        source.kind === "extrudeBoolean" && source.id === "body_add_1"
    );

    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "mid_line",
        kind: "line",
        start: [2, 4],
        end: [6, 8]
      }
    });

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
    expect(getPrimitiveBooleanTarget(editedSource).profile).toMatchObject({
      kind: "rectangle",
      center: [4, 6]
    });

    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime((input) => {
      const target = getRuntimePrimitiveTarget(input);

      return target?.profile.kind === "rectangle" &&
        target.profile.center[0] === 0
        ? first.promise
        : second.promise;
    });
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([initialSource]);
    service.reconcile([editedSource]);

    first.resolve(createResult("body_add_1", createMesh("stale_midpoint_add")));
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

  it("ignores stale worker results after perpendicular-driven boolean target edits", async () => {
    const engine = createExtrudedRectangleEngine();

    engine.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "perpendicular_primary",
        start: [0, 0],
        end: [4, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "perpendicular_secondary",
        start: [0, 0],
        end: [0, 2]
      },
      {
        op: "sketch.constraint.create",
        id: "perpendicular_rect",
        name: "Target rectangle perpendicular",
        sketchId: "sketch_1",
        kind: "perpendicular",
        primaryLineEntityId: "perpendicular_primary",
        secondaryLineEntityId: "perpendicular_secondary"
      },
      {
        op: "sketch.constraint.create",
        id: "co_rect_center",
        name: "Target rectangle center",
        sketchId: "sketch_1",
        kind: "coincident",
        primaryTarget: { entityId: "perpendicular_secondary", role: "end" },
        secondaryTarget: { entityId: "rect_1", role: "center" }
      },
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
      }
    ]);

    const initialSource = getDerivedSources(engine).find(
      (source): source is DerivedBooleanExtrudeGeometrySource =>
        source.kind === "extrudeBoolean" && source.id === "body_add_1"
    );

    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "perpendicular_primary",
        kind: "line",
        start: [0, 0],
        end: [0, 4]
      }
    });

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
    expect(getPrimitiveBooleanTarget(editedSource).profile).toMatchObject({
      kind: "rectangle",
      center: [-1, 1]
    });

    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime((input) => {
      const target = getRuntimePrimitiveTarget(input);

      return target?.profile.kind === "rectangle" &&
        target.profile.center[0] === 0
        ? first.promise
        : second.promise;
    });
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([initialSource]);
    service.reconcile([editedSource]);

    first.resolve(
      createResult("body_add_1", createMesh("stale_perpendicular_add"))
    );
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

  it("updates derived source keys after parallel constraints drive an extruded profile", () => {
    const engine = createExtrudedRectangleEngine();

    engine.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "parallel_primary",
        start: [0, 0],
        end: [4, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "parallel_secondary",
        start: [0, 0],
        end: [0, 2]
      },
      {
        op: "sketch.constraint.create",
        id: "parallel_profile",
        name: "Profile parallel",
        sketchId: "sketch_1",
        kind: "parallel",
        primaryLineEntityId: "parallel_primary",
        secondaryLineEntityId: "parallel_secondary"
      },
      {
        op: "sketch.constraint.create",
        id: "co_profile_center",
        name: "Profile center",
        sketchId: "sketch_1",
        kind: "coincident",
        primaryTarget: { entityId: "parallel_secondary", role: "end" },
        secondaryTarget: { entityId: "rect_1", role: "center" }
      }
    ]);

    const initialSource = getDerivedSources(engine).find(
      (source) => source.kind === "extrude" && source.id === "body_rect_1"
    );

    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "parallel_primary",
        kind: "line",
        start: [0, 0],
        end: [0, 4]
      }
    });

    const editedSource = getDerivedSources(engine).find(
      (source) => source.kind === "extrude" && source.id === "body_rect_1"
    );

    expect(initialSource).toBeDefined();
    expect(editedSource).toBeDefined();
    if (!initialSource || !editedSource || editedSource.kind !== "extrude") {
      throw new Error("Expected extrude sources.");
    }

    expect(createDerivedGeometryCacheKey(initialSource)).not.toBe(
      createDerivedGeometryCacheKey(editedSource)
    );
    expect(editedSource.profile).toMatchObject({
      kind: "rectangle",
      center: [0, 2]
    });
  });

  it("updates derived source keys after perpendicular constraints drive an extruded profile", () => {
    const engine = createExtrudedRectangleEngine();

    engine.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "perpendicular_primary",
        start: [0, 0],
        end: [4, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "perpendicular_secondary",
        start: [0, 0],
        end: [0, 2]
      },
      {
        op: "sketch.constraint.create",
        id: "perpendicular_profile",
        name: "Profile perpendicular",
        sketchId: "sketch_1",
        kind: "perpendicular",
        primaryLineEntityId: "perpendicular_primary",
        secondaryLineEntityId: "perpendicular_secondary"
      },
      {
        op: "sketch.constraint.create",
        id: "co_perpendicular_profile_center",
        name: "Profile center",
        sketchId: "sketch_1",
        kind: "coincident",
        primaryTarget: { entityId: "perpendicular_secondary", role: "end" },
        secondaryTarget: { entityId: "rect_1", role: "center" }
      }
    ]);

    const initialSource = getDerivedSources(engine).find(
      (source) => source.kind === "extrude" && source.id === "body_rect_1"
    );

    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "perpendicular_primary",
        kind: "line",
        start: [0, 0],
        end: [0, 4]
      }
    });

    const editedSource = getDerivedSources(engine).find(
      (source) => source.kind === "extrude" && source.id === "body_rect_1"
    );

    expect(initialSource).toBeDefined();
    expect(editedSource).toBeDefined();
    if (!initialSource || !editedSource || editedSource.kind !== "extrude") {
      throw new Error("Expected extrude sources.");
    }

    expect(createDerivedGeometryCacheKey(initialSource)).not.toBe(
      createDerivedGeometryCacheKey(editedSource)
    );
    expect(editedSource.profile).toMatchObject({
      kind: "rectangle",
      center: [-1, 1]
    });
  });

  it("updates attached extrude source keys after perpendicular constraints drive the attached profile", () => {
    const engine = createExtrudedRectangleEngine();

    engine.applyBatch([
      {
        op: "sketch.createOnFace",
        id: "sketch_attached_perpendicular",
        name: "Attached perpendicular profile",
        bodyId: "body_rect_1",
        faceStableId: "generated:face:body_rect_1:endCap"
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_attached_perpendicular",
        id: "attached_perpendicular_primary",
        start: [0, 0],
        end: [4, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_attached_perpendicular",
        id: "attached_perpendicular_secondary",
        start: [0, 0],
        end: [0, 2]
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_attached_perpendicular",
        id: "attached_rect",
        center: [0, 0],
        width: 1,
        height: 1
      },
      {
        op: "sketch.constraint.create",
        id: "perpendicular_attached_rect",
        name: "Attached rectangle perpendicular",
        sketchId: "sketch_attached_perpendicular",
        kind: "perpendicular",
        primaryLineEntityId: "attached_perpendicular_primary",
        secondaryLineEntityId: "attached_perpendicular_secondary"
      },
      {
        op: "sketch.constraint.create",
        id: "co_attached_rect_center",
        name: "Attached rectangle center",
        sketchId: "sketch_attached_perpendicular",
        kind: "coincident",
        primaryTarget: {
          entityId: "attached_perpendicular_secondary",
          role: "end"
        },
        secondaryTarget: { entityId: "attached_rect", role: "center" }
      },
      {
        op: "feature.extrude",
        id: "feat_attached_perpendicular",
        bodyId: "body_attached_perpendicular",
        sketchId: "sketch_attached_perpendicular",
        entityId: "attached_rect",
        depth: 2
      }
    ]);

    const generatedFaces = getGeneratedFacesByKey(engine, ["body_rect_1"]);
    const getSourcesWithFaces = () =>
      createDerivedGeometrySourcesFromDocument(
        engine.getDocument(),
        getProjectStructureFeatures(engine),
        generatedFaces
      );

    const initialSource = getSourcesWithFaces().find(
      (source) =>
        source.kind === "extrude" && source.id === "body_attached_perpendicular"
    );

    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_attached_perpendicular",
      entity: {
        id: "attached_perpendicular_primary",
        kind: "line",
        start: [0, 0],
        end: [0, 4]
      }
    });

    const editedSource = getSourcesWithFaces().find(
      (source) =>
        source.kind === "extrude" && source.id === "body_attached_perpendicular"
    );

    expect(initialSource).toBeDefined();
    expect(editedSource).toBeDefined();
    if (!initialSource || !editedSource || editedSource.kind !== "extrude") {
      throw new Error("Expected attached extrude sources.");
    }

    expect(createDerivedGeometryCacheKey(initialSource)).not.toBe(
      createDerivedGeometryCacheKey(editedSource)
    );
    expect(editedSource).toMatchObject({
      profile: {
        kind: "rectangle",
        center: [-1, 1]
      },
      placementFrame: expect.any(Object)
    });
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

  it("runs circle-profile boolean sources for supported result-body targets", async () => {
    const circleResultCut: DerivedBooleanExtrudeGeometrySource = {
      id: "body_circle_result_cut",
      kind: "extrudeBoolean",
      operation: "cut",
      target: {
        id: "body_circle_rect_cut",
        kind: "extrudeBoolean",
        operation: "cut",
        target: createCircleExtrudeSource("body_circle_1"),
        tool: createExtrudeSource("body_rect_cut")
      },
      tool: createCircleExtrudeSource("body_circle_tool")
    };
    const rectangleResultAdd: DerivedBooleanExtrudeGeometrySource = {
      id: "body_rectangle_result_add",
      kind: "extrudeBoolean",
      operation: "add",
      target: {
        id: "body_rectangle_rect_cut",
        kind: "extrudeBoolean",
        operation: "cut",
        target: createExtrudeSource("body_rect_1"),
        tool: createExtrudeSource("body_rect_cut")
      },
      tool: createCircleExtrudeSource("body_circle_tool")
    };
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime(async (input) =>
      createResult(input.id, createMesh(input.id))
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([circleResultCut, rectangleResultAdd]);
    await flushPromises();

    expect(runtime.inputs).toEqual([
      expect.objectContaining({
        id: "body_circle_result_cut",
        operation: "cut",
        target: expect.objectContaining({
          operation: "cut",
          target: expect.objectContaining({
            profile: expect.objectContaining({ kind: "circle" })
          })
        }),
        tool: expect.objectContaining({
          profile: expect.objectContaining({ kind: "circle" })
        })
      }),
      expect.objectContaining({
        id: "body_rectangle_result_add",
        operation: "add",
        target: expect.objectContaining({
          operation: "cut",
          target: expect.objectContaining({
            profile: expect.objectContaining({ kind: "rectangle" })
          })
        }),
        tool: expect.objectContaining({
          profile: expect.objectContaining({ kind: "circle" })
        })
      })
    ]);
    expect(snapshots.at(-1)?.entries).toMatchObject([
      {
        objectId: "body_circle_result_cut",
        objectKind: "extrudeBoolean",
        status: "ready"
      },
      {
        objectId: "body_rectangle_result_add",
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

  it("derives hole result sources from active rectangle targets and circle tools", async () => {
    const engine = createExtrudedRectangleEngine();

    engine.applyBatch([
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        id: "circle_tool",
        center: [0.5, 0.25],
        radius: 0.4
      },
      {
        op: "feature.hole",
        id: "feat_hole_1",
        bodyId: "body_hole_1",
        targetBodyId: "body_rect_1",
        sketchId: "sketch_1",
        circleEntityId: "circle_tool",
        depthMode: "blind",
        depth: 1.5,
        direction: "negative"
      }
    ]);

    const sources = getDerivedSources(engine);
    const holeSource = sources.find(
      (source): source is DerivedHoleGeometrySource => source.kind === "hole"
    );

    expect(sources.map((source) => source.id)).toEqual(["body_hole_1"]);
    expect(holeSource).toMatchObject({
      id: "body_hole_1",
      kind: "hole",
      target: { id: "body_rect_1", profile: { kind: "rectangle" } },
      tool: {
        sketchPlane: "XY",
        circle: {
          kind: "circle",
          center: [0.5, 0.25],
          radius: 0.4
        },
        depthMode: "blind",
        depth: 1.5,
        direction: "negative"
      }
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
        id: "body_hole_1",
        target: expect.objectContaining({
          depth: 3,
          profile: expect.objectContaining({ kind: "rectangle" })
        }),
        tool: expect.objectContaining({
          depthMode: "blind",
          depth: 1.5,
          direction: "negative",
          circle: expect.objectContaining({ radius: 0.4 })
        })
      })
    ]);
    expect(snapshots.at(-1)?.entries).toMatchObject([
      {
        objectId: "body_hole_1",
        objectKind: "hole",
        status: "ready"
      }
    ]);
  });

  it("derives attached cap hole sources from active circle targets", async () => {
    const engine = createExtrudedCircleEngine();

    engine.applyBatch([
      {
        op: "sketch.createOnFace",
        id: "sketch_cap_hole",
        name: "Cap hole",
        bodyId: "body_circle_1",
        faceStableId: "generated:face:body_circle_1:endCap"
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_cap_hole",
        id: "circle_cap_hole",
        center: [0, 0],
        radius: 0.35
      },
      {
        op: "feature.hole",
        id: "feat_cap_hole",
        bodyId: "body_cap_hole",
        targetBodyId: "body_circle_1",
        sketchId: "sketch_cap_hole",
        circleEntityId: "circle_cap_hole",
        depthMode: "throughAll",
        direction: "positive"
      }
    ]);

    const sources = createDerivedGeometrySourcesFromDocument(
      engine.getDocument(),
      getProjectStructureFeatures(engine),
      getGeneratedFacesByKey(engine, ["body_circle_1"])
    );
    const holeSource = sources.find(
      (source): source is DerivedHoleGeometrySource => source.kind === "hole"
    );

    expect(sources.map((source) => source.id)).toEqual(["body_cap_hole"]);
    expect(holeSource).toMatchObject({
      id: "body_cap_hole",
      kind: "hole",
      target: { id: "body_circle_1", profile: { kind: "circle" } },
      tool: {
        sketchPlane: "XY",
        circle: {
          kind: "circle",
          center: [0, 0],
          radius: 0.35
        },
        placementFrame: {
          origin: [0, 0, 4]
        },
        depthMode: "throughAll",
        direction: "positive"
      }
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
        id: "body_cap_hole",
        target: expect.objectContaining({
          depth: 4,
          profile: expect.objectContaining({ kind: "circle" })
        }),
        tool: expect.objectContaining({
          sketchPlane: "XY",
          placementFrame: expect.objectContaining({
            origin: [0, 0, 4]
          }),
          depthMode: "throughAll",
          direction: "positive",
          circle: expect.objectContaining({ radius: 0.35 })
        })
      })
    ]);
    expect(snapshots.at(-1)?.entries).toMatchObject([
      {
        objectId: "body_cap_hole",
        objectKind: "hole",
        status: "ready"
      }
    ]);
  });

  it("derives hole sources from active topology-backed boolean result targets", async () => {
    const engine = createExtrudedRectangleEngine();

    engine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_cut_1",
        name: "Cut",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_cut_1",
        id: "rect_cut_1",
        center: [0, 0],
        width: 1,
        height: 1
      },
      {
        op: "sketch.create",
        id: "sketch_hole_1",
        name: "Hole",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_hole_1",
        id: "circle_hole_1",
        center: [0.5, 0.25],
        radius: 0.4
      }
    ]);

    const baseFeature = getProjectStructureFeatures(engine).find(
      (feature): feature is Extract<CadFeatureSummary, { kind: "extrude" }> =>
        feature.kind === "extrude" && feature.bodyId === "body_rect_1"
    );

    if (!baseFeature) {
      throw new Error("Expected base extrude feature.");
    }

    const cutFeature: Extract<CadFeatureSummary, { kind: "extrude" }> = {
      ...baseFeature,
      id: "feat_cut_1",
      bodyId: "body_cut_1",
      sketchId: "sketch_cut_1",
      entityId: "rect_cut_1",
      depth: 1,
      operationMode: "cut",
      targetBodyId: "body_rect_1",
      targetTopologyAnchorId: "anchor_body_rect",
      source: {
        type: "sketchEntity",
        sketchId: "sketch_cut_1",
        entityId: "rect_cut_1",
        targetTopologyAnchorId: "anchor_body_rect"
      }
    };
    const holeFeature: Extract<CadFeatureSummary, { kind: "hole" }> = {
      id: "feat_hole_1",
      kind: "hole",
      partId: "part:default",
      bodyId: "body_hole_1",
      targetBodyId: "body_cut_1",
      targetTopologyAnchorId: "anchor_body_rect",
      sketchId: "sketch_hole_1",
      circleEntityId: "circle_hole_1",
      depthMode: "throughAll",
      direction: "positive",
      source: {
        type: "sketchCircleHole",
        sketchId: "sketch_hole_1",
        circleEntityId: "circle_hole_1",
        targetBodyId: "body_cut_1",
        targetTopologyAnchorId: "anchor_body_rect"
      }
    };

    const sources = createDerivedGeometrySourcesFromDocument(
      engine.getDocument(),
      [baseFeature, cutFeature, holeFeature]
    );
    const holeSource = sources.find(
      (source): source is DerivedHoleGeometrySource => source.kind === "hole"
    );

    expect(sources.map((source) => source.id)).toEqual(["body_hole_1"]);
    expect(holeSource).toMatchObject({
      id: "body_hole_1",
      kind: "hole",
      target: {
        id: "body_cut_1",
        kind: "extrudeBoolean",
        operation: "cut",
        target: { id: "body_rect_1", profile: { kind: "rectangle" } },
        tool: { id: "body_cut_1", profile: { kind: "rectangle" } }
      },
      tool: {
        circle: { kind: "circle", center: [0.5, 0.25], radius: 0.4 },
        depthMode: "throughAll",
        direction: "positive"
      }
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
        id: "body_hole_1",
        target: expect.objectContaining({
          kind: "booleanExtrudes",
          operation: "cut",
          target: expect.objectContaining({
            profile: expect.objectContaining({ kind: "rectangle" })
          }),
          tool: expect.objectContaining({
            profile: expect.objectContaining({ kind: "rectangle" })
          })
        }),
        tool: expect.objectContaining({
          circle: expect.objectContaining({ radius: 0.4 }),
          depthMode: "throughAll",
          direction: "positive"
        })
      })
    ]);
    expect(snapshots.at(-1)?.entries).toMatchObject([
      {
        objectId: "body_hole_1",
        objectKind: "hole",
        status: "ready"
      }
    ]);
  });

  it("derives hole sources from active topology-backed circle-origin result targets", async () => {
    const engine = createExtrudedCircleEngine();

    engine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_cut_1",
        name: "Cut",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_cut_1",
        id: "rect_cut_1",
        center: [0, 0],
        width: 1,
        height: 1
      },
      {
        op: "sketch.create",
        id: "sketch_hole_1",
        name: "Hole",
        plane: "XZ"
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_hole_1",
        id: "circle_hole_1",
        center: [0, 1.5],
        radius: 0.4
      }
    ]);

    const baseFeature = getProjectStructureFeatures(engine).find(
      (feature): feature is Extract<CadFeatureSummary, { kind: "extrude" }> =>
        feature.kind === "extrude" && feature.bodyId === "body_circle_1"
    );

    if (!baseFeature) {
      throw new Error("Expected base circle extrude feature.");
    }

    const cutFeature: Extract<CadFeatureSummary, { kind: "extrude" }> = {
      ...baseFeature,
      id: "feat_cut_1",
      bodyId: "body_cut_1",
      sketchId: "sketch_cut_1",
      entityId: "rect_cut_1",
      profileKind: "rectangle",
      depth: 1,
      operationMode: "cut",
      targetBodyId: "body_circle_1",
      targetTopologyAnchorId: "anchor_body_circle",
      source: {
        type: "sketchEntity",
        sketchId: "sketch_cut_1",
        entityId: "rect_cut_1",
        targetTopologyAnchorId: "anchor_body_circle"
      }
    };
    const holeFeature: Extract<CadFeatureSummary, { kind: "hole" }> = {
      id: "feat_hole_1",
      kind: "hole",
      partId: "part:default",
      bodyId: "body_hole_1",
      targetBodyId: "body_cut_1",
      targetTopologyAnchorId: "anchor_body_circle",
      sketchId: "sketch_hole_1",
      circleEntityId: "circle_hole_1",
      depthMode: "throughAll",
      direction: "positive",
      source: {
        type: "sketchCircleHole",
        sketchId: "sketch_hole_1",
        circleEntityId: "circle_hole_1",
        targetBodyId: "body_cut_1",
        targetTopologyAnchorId: "anchor_body_circle"
      }
    };

    const sources = createDerivedGeometrySourcesFromDocument(
      engine.getDocument(),
      [baseFeature, cutFeature, holeFeature]
    );
    const holeSource = sources.find(
      (source): source is DerivedHoleGeometrySource => source.kind === "hole"
    );

    expect(sources.map((source) => source.id)).toEqual(["body_hole_1"]);
    expect(holeSource).toMatchObject({
      id: "body_hole_1",
      kind: "hole",
      target: {
        id: "body_cut_1",
        kind: "extrudeBoolean",
        operation: "cut",
        target: { id: "body_circle_1", profile: { kind: "circle" } },
        tool: { id: "body_cut_1", profile: { kind: "rectangle" } }
      },
      tool: {
        sketchPlane: "XZ",
        circle: { kind: "circle", center: [0, 1.5], radius: 0.4 },
        depthMode: "throughAll",
        direction: "positive"
      }
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
        id: "body_hole_1",
        target: expect.objectContaining({
          kind: "booleanExtrudes",
          operation: "cut",
          target: expect.objectContaining({
            profile: expect.objectContaining({ kind: "circle" })
          }),
          tool: expect.objectContaining({
            profile: expect.objectContaining({ kind: "rectangle" })
          })
        }),
        tool: expect.objectContaining({
          sketchPlane: "XZ",
          circle: expect.objectContaining({ radius: 0.4 }),
          depthMode: "throughAll",
          direction: "positive"
        })
      })
    ]);
    expect(snapshots.at(-1)?.entries).toMatchObject([
      {
        objectId: "body_hole_1",
        objectKind: "hole",
        status: "ready"
      }
    ]);
  });

  it("derives attached-sketch hole tool placement from generated face references", () => {
    const engine = createExtrudedRectangleEngine();

    engine.applyBatch([
      {
        op: "sketch.createOnFace",
        id: "sketch_hole_face",
        name: "Hole sketch",
        bodyId: "body_rect_1",
        faceStableId: "generated:face:body_rect_1:endCap"
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_hole_face",
        id: "circle_tool",
        center: [0.25, -0.25],
        radius: 0.35
      },
      {
        op: "feature.hole",
        id: "feat_hole_1",
        bodyId: "body_hole_1",
        targetBodyId: "body_rect_1",
        sketchId: "sketch_hole_face",
        circleEntityId: "circle_tool",
        depthMode: "throughAll",
        direction: "positive"
      }
    ]);

    const sources = createDerivedGeometrySourcesFromDocument(
      engine.getDocument(),
      getProjectStructureFeatures(engine),
      getGeneratedFacesByKey(engine, ["body_rect_1"])
    );
    const holeSource = sources.find(
      (source): source is DerivedHoleGeometrySource => source.kind === "hole"
    );

    expect(sources.map((source) => source.id)).toEqual(["body_hole_1"]);
    expect(holeSource).toMatchObject({
      id: "body_hole_1",
      kind: "hole",
      tool: {
        circle: {
          kind: "circle",
          center: [0.25, -0.25],
          radius: 0.35
        },
        depthMode: "throughAll",
        direction: "positive",
        placementFrame: {
          origin: [0, 0, 3]
        }
      }
    });
  });

  it("updates hole source cache keys across tool profile, depth, direction, and target edits", () => {
    const target = createExtrudeSource("body_rect_1");
    const source: DerivedHoleGeometrySource = {
      id: "body_hole_1",
      kind: "hole",
      target,
      tool: {
        sketchPlane: "XY",
        circle: { kind: "circle", center: [0, 0], radius: 0.5 },
        depthMode: "blind",
        depth: 1,
        direction: "positive"
      }
    };

    expect(createDerivedGeometryCacheKey(source)).not.toBe(
      createDerivedGeometryCacheKey({
        ...source,
        tool: {
          ...source.tool,
          circle: { kind: "circle", center: [0, 0], radius: 0.75 }
        }
      })
    );
    expect(createDerivedGeometryCacheKey(source)).not.toBe(
      createDerivedGeometryCacheKey({
        ...source,
        tool: { ...source.tool, depth: 2 }
      })
    );
    expect(createDerivedGeometryCacheKey(source)).not.toBe(
      createDerivedGeometryCacheKey({
        ...source,
        tool: { ...source.tool, depthMode: "throughAll", depth: undefined }
      })
    );
    expect(createDerivedGeometryCacheKey(source)).not.toBe(
      createDerivedGeometryCacheKey({
        ...source,
        tool: { ...source.tool, direction: "negative" }
      })
    );
    expect(createDerivedGeometryCacheKey(source)).not.toBe(
      createDerivedGeometryCacheKey({
        ...source,
        target: {
          ...target,
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 6,
            height: 2
          }
        }
      })
    );
  });

  it("ignores stale worker results after hole tool source invalidation", async () => {
    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime((input) =>
      "tool" in input &&
      "circle" in input.tool &&
      input.tool.circle.radius === 0.5
        ? first.promise
        : second.promise
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const initialSource: DerivedHoleGeometrySource = {
      id: "body_hole_1",
      kind: "hole",
      target: createExtrudeSource("body_rect_1"),
      tool: {
        sketchPlane: "XY",
        circle: { kind: "circle", center: [0, 0], radius: 0.5 },
        depthMode: "blind",
        depth: 1,
        direction: "positive"
      }
    };
    const editedSource: DerivedHoleGeometrySource = {
      ...initialSource,
      tool: {
        ...initialSource.tool,
        circle: { kind: "circle", center: [0, 0], radius: 0.75 }
      }
    };

    service.reconcile([initialSource]);
    service.reconcile([editedSource]);

    expect(
      runtime.inputs.map((input) =>
        "tool" in input && "circle" in input.tool
          ? input.tool.circle.radius
          : null
      )
    ).toEqual([0.5, 0.75]);

    first.resolve(createResult("body_hole_1", createMesh("stale_hole")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_hole_1",
      objectKind: "hole",
      status: "pending",
      cacheKey: createDerivedGeometryCacheKey(editedSource)
    });
    expect(snapshots.at(-1)?.meshes).toEqual([]);

    second.resolve(createResult("body_hole_1", createMesh("body_hole_1")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_hole_1",
      objectKind: "hole",
      status: "ready",
      cacheKey: createDerivedGeometryCacheKey(editedSource)
    });
    expect(snapshots.at(-1)?.meshes.map((mesh) => mesh.id)).toEqual([
      "body_hole_1"
    ]);
  });

  it("marks unsupported hole sources without using primitive fallback language", () => {
    const snapshots: DerivedGeometrySnapshot[] = [];
    const service = new DerivedGeometryService({
      runtime: createRuntime(async (input) =>
        createResult(input.id, createMesh(input.id))
      ),
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([
      {
        id: "body_hole_unsupported",
        kind: "hole",
        target: createExtrudeSource("body_rect_1"),
        tool: {
          sketchPlane: "XY",
          circle: { kind: "circle", center: [0, 0], radius: 0.5 },
          depthMode: "blind",
          depth: 1,
          direction: "positive"
        },
        placementError:
          "Hole feature feat_hole_1 cannot be displayed because its target or circle tool source is unavailable."
      }
    ]);

    expect(getDerivedGeometryStatusLabel(snapshots.at(-1)?.entries[0])).toBe(
      "Hole feature feat_hole_1 cannot be displayed because its target or circle tool source is unavailable."
    );
    expect(snapshots.at(-1)?.meshes).toEqual([]);
  });

  it("derives chamfer result sources from rectangle target extrudes and generated edges", async () => {
    const engine = createExtrudedRectangleEngine();

    engine.apply({
      op: "feature.chamfer",
      id: "feat_chamfer_1",
      bodyId: "body_chamfer_1",
      targetBodyId: "body_rect_1",
      edgeStableId: "generated:edge:body_rect_1:start:uMin",
      distance: 0.25
    });

    const sources = getDerivedSources(engine);
    const source = sources.find(
      (candidate): candidate is DerivedEdgeFinishGeometrySource =>
        candidate.kind === "edgeFinish"
    );

    expect(sources.map((candidate) => candidate.id)).toEqual([
      "body_chamfer_1"
    ]);
    expect(source).toMatchObject({
      id: "body_chamfer_1",
      kind: "edgeFinish",
      operation: "chamfer",
      target: { id: "body_rect_1", profile: { kind: "rectangle" } },
      edgeStableId: "generated:edge:body_rect_1:start:uMin",
      distance: 0.25
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
        id: "body_chamfer_1",
        operation: "chamfer",
        edgeStableId: "generated:edge:body_rect_1:start:uMin",
        distance: 0.25,
        target: expect.objectContaining({
          depth: 3,
          profile: expect.objectContaining({ kind: "rectangle" })
        })
      })
    ]);
    expect(snapshots.at(-1)?.entries).toMatchObject([
      {
        objectId: "body_chamfer_1",
        objectKind: "edgeFinish",
        status: "ready"
      }
    ]);
  });

  it("derives fillet result sources from rectangle target extrudes and generated edges", async () => {
    const engine = createExtrudedRectangleEngine();

    engine.apply({
      op: "feature.fillet",
      id: "feat_fillet_1",
      bodyId: "body_fillet_1",
      targetBodyId: "body_rect_1",
      edgeStableId: "generated:edge:body_rect_1:end:vMax",
      radius: 0.2
    });

    const sources = getDerivedSources(engine);
    const source = sources.find(
      (candidate): candidate is DerivedEdgeFinishGeometrySource =>
        candidate.kind === "edgeFinish"
    );

    expect(sources.map((candidate) => candidate.id)).toEqual(["body_fillet_1"]);
    expect(source).toMatchObject({
      id: "body_fillet_1",
      kind: "edgeFinish",
      operation: "fillet",
      target: { id: "body_rect_1", profile: { kind: "rectangle" } },
      edgeStableId: "generated:edge:body_rect_1:end:vMax",
      radius: 0.2
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
        id: "body_fillet_1",
        operation: "fillet",
        edgeStableId: "generated:edge:body_rect_1:end:vMax",
        radius: 0.2,
        target: expect.objectContaining({
          depth: 3,
          profile: expect.objectContaining({ kind: "rectangle" })
        })
      })
    ]);
    expect(snapshots.at(-1)?.entries).toMatchObject([
      {
        objectId: "body_fillet_1",
        objectKind: "edgeFinish",
        status: "ready"
      }
    ]);
  });

  it("derives chamfer result sources from rectangle cut-wall result edges", async () => {
    const engine = createExtrudedRectangleEngine();

    engine.applyBatch([
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "tool_rect_1",
        center: [1, 0],
        width: 2,
        height: 1
      },
      {
        op: "feature.extrude",
        id: "feat_cut_1",
        bodyId: "body_cut_1",
        sketchId: "sketch_1",
        entityId: "tool_rect_1",
        depth: 3,
        operationMode: "cut",
        targetBodyId: "body_rect_1"
      },
      {
        op: "feature.chamfer",
        id: "feat_cut_chamfer_1",
        bodyId: "body_cut_chamfer_1",
        targetBodyId: "body_cut_1",
        edgeStableId: "generated:edge:body_cut_1:longitudinal:uMin:vMin",
        distance: 0.1
      }
    ]);

    const sources = getDerivedSources(engine);
    const source = sources.find(
      (candidate): candidate is DerivedEdgeFinishGeometrySource =>
        candidate.kind === "edgeFinish"
    );

    expect(sources.map((candidate) => candidate.id)).toEqual([
      "body_cut_chamfer_1"
    ]);
    expect(source).toMatchObject({
      id: "body_cut_chamfer_1",
      kind: "edgeFinish",
      operation: "chamfer",
      target: {
        id: "body_cut_1",
        kind: "extrudeBoolean",
        operation: "cut",
        target: { id: "body_rect_1", profile: { kind: "rectangle" } },
        tool: { id: "body_cut_1", profile: { kind: "rectangle" } }
      },
      edgeStableId: "generated:edge:body_cut_1:longitudinal:uMin:vMin",
      distance: 0.1
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
        id: "body_cut_chamfer_1",
        operation: "chamfer",
        edgeStableId: "generated:edge:body_cut_1:longitudinal:uMin:vMin",
        distance: 0.1,
        target: {
          kind: "booleanExtrudes",
          operation: "cut",
          target: expect.objectContaining({
            depth: 3,
            profile: expect.objectContaining({ kind: "rectangle" })
          }),
          tool: expect.objectContaining({
            depth: 3,
            profile: expect.objectContaining({ kind: "rectangle" })
          })
        }
      })
    ]);
    expect(snapshots.at(-1)?.entries).toMatchObject([
      {
        objectId: "body_cut_chamfer_1",
        objectKind: "edgeFinish",
        status: "ready"
      }
    ]);
  });

  it("resolves named edge references for edge-finish derived sources when the name is still available", () => {
    const engine = createExtrudedRectangleEngine();

    engine.apply({
      op: "reference.nameGenerated",
      name: "Top edge",
      bodyId: "body_rect_1",
      stableId: "generated:edge:body_rect_1:end:uMax"
    });
    engine.apply({
      op: "feature.fillet",
      id: "feat_fillet_named",
      bodyId: "body_fillet_named",
      targetBodyId: "body_rect_1",
      namedReference: "Top edge",
      radius: 0.2
    });

    const source = getDerivedSources(engine).find(
      (candidate): candidate is DerivedEdgeFinishGeometrySource =>
        candidate.kind === "edgeFinish"
    );

    expect(source).toMatchObject({
      id: "body_fillet_named",
      kind: "edgeFinish",
      operation: "fillet",
      edgeStableId: "generated:edge:body_rect_1:end:uMax",
      radius: 0.2
    });
  });

  it("updates edge-finish source keys after target, edge, distance, and radius edits", () => {
    const chamferSource: Extract<
      DerivedEdgeFinishGeometrySource,
      { readonly operation: "chamfer" }
    > = {
      id: "body_chamfer_1",
      kind: "edgeFinish",
      operation: "chamfer",
      target: createExtrudeSource("body_rect_1"),
      edgeStableId: "generated:edge:body_rect_1:start:uMin",
      distance: 0.25
    };
    const filletSource: Extract<
      DerivedEdgeFinishGeometrySource,
      { readonly operation: "fillet" }
    > = {
      id: "body_fillet_1",
      kind: "edgeFinish",
      operation: "fillet",
      target: createExtrudeSource("body_rect_1"),
      edgeStableId: "generated:edge:body_rect_1:start:uMin",
      radius: 0.25
    };
    const chamferTarget = chamferSource.target;
    if (chamferTarget.kind !== "extrude") {
      throw new Error("Expected chamfer source target to be an extrude");
    }

    expect(createDerivedGeometryCacheKey(chamferSource)).not.toBe(
      createDerivedGeometryCacheKey({
        ...chamferSource,
        target: {
          ...chamferTarget,
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 6,
            height: 2
          }
        }
      })
    );
    expect(createDerivedGeometryCacheKey(chamferSource)).not.toBe(
      createDerivedGeometryCacheKey({
        ...chamferSource,
        edgeStableId: "generated:edge:body_rect_1:end:uMin"
      })
    );
    expect(createDerivedGeometryCacheKey(chamferSource)).not.toBe(
      createDerivedGeometryCacheKey({
        ...chamferSource,
        distance: 0.4
      })
    );
    expect(createDerivedGeometryCacheKey(filletSource)).not.toBe(
      createDerivedGeometryCacheKey({
        ...filletSource,
        radius: 0.35
      })
    );
  });

  it("updates edge-finish sources across undo and redo without double-listing the consumed target", () => {
    const engine = createExtrudedRectangleEngine();

    expect(getDerivedSourceIds(engine)).toEqual(["body_rect_1"]);

    engine.apply({
      op: "feature.chamfer",
      id: "feat_chamfer_1",
      bodyId: "body_chamfer_1",
      targetBodyId: "body_rect_1",
      edgeStableId: "generated:edge:body_rect_1:start:uMin",
      distance: 0.25
    });

    expect(getDerivedSourceIds(engine)).toEqual(["body_chamfer_1"]);

    engine.undo();

    expect(getDerivedSourceIds(engine)).toEqual(["body_rect_1"]);

    engine.redo();

    expect(getDerivedSourceIds(engine)).toEqual(["body_chamfer_1"]);
  });

  it("ignores stale worker results after edge-finish source invalidation", async () => {
    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime((input) =>
      "edgeStableId" in input &&
      input.edgeStableId === "generated:edge:body_rect_1:start:uMin"
        ? first.promise
        : second.promise
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const initialSource = createEdgeFinishSource("body_chamfer_1", "chamfer");
    const editedSource: DerivedEdgeFinishGeometrySource = {
      ...initialSource,
      edgeStableId: "generated:edge:body_rect_1:end:uMin"
    };

    service.reconcile([initialSource]);
    service.reconcile([editedSource]);

    expect(
      runtime.inputs.map((input) =>
        "edgeStableId" in input ? input.edgeStableId : null
      )
    ).toEqual([
      "generated:edge:body_rect_1:start:uMin",
      "generated:edge:body_rect_1:end:uMin"
    ]);

    first.resolve(createResult("body_chamfer_1", createMesh("stale_chamfer")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_chamfer_1",
      objectKind: "edgeFinish",
      status: "pending",
      cacheKey: createDerivedGeometryCacheKey(editedSource)
    });
    expect(snapshots.at(-1)?.meshes).toEqual([]);

    second.resolve(
      createResult("body_chamfer_1", createMesh("body_chamfer_1"))
    );
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_chamfer_1",
      objectKind: "edgeFinish",
      status: "ready",
      cacheKey: createDerivedGeometryCacheKey(editedSource)
    });
    expect(snapshots.at(-1)?.meshes.map((mesh) => mesh.id)).toEqual([
      "body_chamfer_1"
    ]);
  });

  it("marks unsupported edge-finish sources without using primitive fallback language", () => {
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime(async (input) =>
      createResult(input.id, createMesh(input.id))
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([
      {
        id: "body_chamfer_circle",
        kind: "edgeFinish",
        operation: "chamfer",
        target: createCircleExtrudeSource("body_circle_1"),
        edgeStableId: "generated:edge:body_circle_1:start:uMin",
        distance: 0.2
      }
    ]);

    expect(runtime.inputs).toEqual([]);
    expect(getDerivedGeometryStatusLabel(snapshots.at(-1)?.entries[0])).toBe(
      "Edge finish display currently supports rectangle source edges and rectangle cut-wall result edges only."
    );
    expect(snapshots.at(-1)?.meshes).toEqual([]);
  });

  it("keeps stale named-reference edge finishes unsupported when the name is unavailable", () => {
    const engine = createExtrudedRectangleEngine();

    engine.apply({
      op: "reference.nameGenerated",
      name: "Top edge",
      bodyId: "body_rect_1",
      stableId: "generated:edge:body_rect_1:end:uMax"
    });
    engine.apply({
      op: "feature.fillet",
      id: "feat_fillet_named",
      bodyId: "body_fillet_named",
      targetBodyId: "body_rect_1",
      namedReference: "Top edge",
      radius: 0.2
    });
    engine.apply({ op: "reference.deleteName", name: "Top edge" });

    const sources = getDerivedSources(engine);
    const source = sources.find(
      (candidate): candidate is DerivedEdgeFinishGeometrySource =>
        candidate.kind === "edgeFinish"
    );

    expect(source).toMatchObject({
      id: "body_fillet_named",
      kind: "edgeFinish",
      placementError:
        "Fillet feature feat_fillet_named cannot be displayed because named reference Top edge is unavailable."
    });

    const snapshots: DerivedGeometrySnapshot[] = [];
    const service = new DerivedGeometryService({
      runtime: createRuntime(async (input) =>
        createResult(input.id, createMesh(input.id))
      ),
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile(sources);

    expect(getDerivedGeometryStatusLabel(snapshots.at(-1)?.entries[0])).toBe(
      "Fillet feature feat_fillet_named cannot be displayed because named reference Top edge is unavailable."
    );
    expect(snapshots.at(-1)?.meshes).toEqual([]);
  });

  it("ignores stale worker results after cut target source invalidation", async () => {
    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime((input) => {
      const target = getRuntimePrimitiveTarget(input);

      return target?.profile.kind === "rectangle"
        ? target.profile.width === 4
          ? first.promise
          : second.promise
        : second.promise;
    });
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
        ...getPrimitiveBooleanTarget(initialSource),
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
      runtime.inputs.map((input) => {
        const target = getRuntimePrimitiveTarget(input);

        return target?.profile.kind === "rectangle"
          ? target.profile.width
          : null;
      })
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
    const runtime = createRuntime((input) => {
      const target = getRuntimePrimitiveTarget(input);

      return target?.profile.kind === "rectangle"
        ? target.profile.width === 4
          ? first.promise
          : second.promise
        : second.promise;
    });
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
        ...getPrimitiveBooleanTarget(initialSource),
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
      runtime.inputs.map((input) => {
        const target = getRuntimePrimitiveTarget(input);

        return target?.profile.kind === "rectangle"
          ? target.profile.width
          : null;
      })
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
      "tool" in input &&
      "profile" in input.tool &&
      input.tool.profile.kind === "rectangle"
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
        "tool" in input &&
        "profile" in input.tool &&
        input.tool.profile.kind === "rectangle"
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
    const runtime = createRuntime((input) => {
      const target = getRuntimePrimitiveTarget(input);

      return target?.profile.kind === "circle"
        ? target.profile.radius === 2
          ? first.promise
          : second.promise
        : second.promise;
    });
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
        ...getPrimitiveBooleanTarget(initialSource),
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
      runtime.inputs.map((input) => {
        const target = getRuntimePrimitiveTarget(input);

        return target?.profile.kind === "circle" ? target.profile.radius : null;
      })
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

  it("ignores stale worker results after revolve source invalidation", async () => {
    const first = createDeferred<DerivedGeometryResult>();
    const second = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime((input) =>
      "axis" in input &&
      typeof input.axis === "object" &&
      input.axis !== null &&
      "end" in input.axis &&
      input.axis.end[1] === 2
        ? first.promise
        : second.promise
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const initialSource = createRevolveSource("body_revolve_1");
    const editedSource: DerivedRevolveGeometrySource = {
      ...initialSource,
      axis: { start: [0, -3], end: [0, 3] }
    };

    service.reconcile([initialSource]);
    service.reconcile([editedSource]);

    expect(
      runtime.inputs.map((input) =>
        "axis" in input &&
        typeof input.axis === "object" &&
        input.axis !== null &&
        "end" in input.axis
          ? input.axis.end
          : null
      )
    ).toEqual([
      [0, 2],
      [0, 3]
    ]);

    first.resolve(createResult("body_revolve_1", createMesh("stale_revolve")));
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_revolve_1",
      status: "pending",
      cacheKey: createDerivedGeometryCacheKey(editedSource)
    });
    expect(snapshots.at(-1)?.meshes).toEqual([]);

    second.resolve(
      createResult("body_revolve_1", createMesh("body_revolve_1"))
    );
    await flushPromises();

    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "body_revolve_1",
      status: "ready",
      cacheKey: createDerivedGeometryCacheKey(editedSource)
    });
    expect(snapshots.at(-1)?.meshes.map((mesh) => mesh.id)).toEqual([
      "body_revolve_1"
    ]);
  });

  it("ignores stale worker results after revolve body deletion", async () => {
    const pending = createDeferred<DerivedGeometryResult>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    const service = new DerivedGeometryService({
      runtime: createRuntime(() => pending.promise),
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([createRevolveSource("body_revolve_1")]);
    service.reconcile([]);
    pending.resolve(createResult("body_revolve_1", createMesh("stale_mesh")));
    await flushPromises();

    const snapshot = snapshots.at(-1) ?? createEmptyDerivedGeometrySnapshot();
    expect(snapshot.entries).toEqual([]);
    expect(snapshot.meshes).toEqual([]);
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

  it("uses derived mesh cache hits without requesting the runtime", async () => {
    const snapshots: DerivedGeometrySnapshot[] = [];
    const source = createBoxObject("box_1", 2);
    const readInputs: {
      readonly objectId: string;
      readonly sourceKey: string;
    }[] = [];
    const writeInputs: string[] = [];
    const runtime = createRuntime(async () => {
      throw new Error("Runtime should not be called for cache hits.");
    });
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot),
      meshCache: {
        read: async (input) => {
          readInputs.push({
            objectId: input.source.id,
            sourceKey: input.sourceKey
          });
          return createResult("box_1", createMesh("cached_box_1"));
        },
        write: async (input) => {
          writeInputs.push(input.sourceKey);
        }
      }
    });

    service.reconcile([source]);
    await flushPromises();

    expect(runtime.inputs).toEqual([]);
    expect(readInputs).toEqual([
      {
        objectId: "box_1",
        sourceKey: createDerivedGeometryCacheKey(source)
      }
    ]);
    expect(writeInputs).toEqual([]);
    expect(snapshots.at(-1)?.entries[0]).toMatchObject({
      objectId: "box_1",
      status: "ready",
      cacheKey: createDerivedGeometryCacheKey(source)
    });
    expect(snapshots.at(-1)?.meshes.map((mesh) => mesh.id)).toEqual([
      "cached_box_1"
    ]);
  });

  it("falls back to runtime generation and writes cache misses", async () => {
    const snapshots: DerivedGeometrySnapshot[] = [];
    const source = createBoxObject("box_1", 2);
    const writeInputs: {
      readonly sourceKey: string;
      readonly meshId: string;
    }[] = [];
    const runtime = createRuntime(async (input) =>
      createResult(input.id, createMesh("generated_box_1"))
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot),
      meshCache: {
        read: async () => undefined,
        write: async (input) => {
          writeInputs.push({
            sourceKey: input.sourceKey,
            meshId: input.result.mesh.id
          });
        }
      }
    });

    service.reconcile([source]);
    await flushPromises();

    expect(runtime.inputs.map((input) => input.id)).toEqual(["box_1"]);
    expect(writeInputs).toEqual([
      {
        sourceKey: createDerivedGeometryCacheKey(source),
        meshId: "generated_box_1"
      }
    ]);
    expect(snapshots.at(-1)?.meshes.map((mesh) => mesh.id)).toEqual([
      "generated_box_1"
    ]);
  });

  it("falls back to runtime generation when cache reads fail", async () => {
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime(async (input) =>
      createResult(input.id, createMesh(input.id))
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot),
      meshCache: {
        read: async () => {
          throw new Error("cache read failed");
        },
        write: async () => {}
      }
    });

    service.reconcile([createBoxObject("box_1", 2)]);
    await flushPromises();

    expect(runtime.inputs.map((input) => input.id)).toEqual(["box_1"]);
    expect(snapshots.at(-1)?.entries[0]?.status).toBe("ready");
  });

  it("ignores stale cache read results after cache-key invalidation", async () => {
    const firstRead = createDeferred<DerivedGeometryResult | undefined>();
    const snapshots: DerivedGeometrySnapshot[] = [];
    let readCount = 0;
    const runtime = createRuntime(async (input) =>
      createResult(input.id, createMesh("generated_box_1"))
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot),
      meshCache: {
        read: async () => {
          readCount += 1;
          return readCount === 1 ? firstRead.promise : undefined;
        },
        write: async () => {}
      }
    });

    service.reconcile([createBoxObject("box_1", 2)]);
    service.reconcile([createBoxObject("box_1", 4)]);
    await flushPromises();

    expect(snapshots.at(-1)?.meshes.map((mesh) => mesh.id)).toEqual([
      "generated_box_1"
    ]);

    firstRead.resolve(createResult("box_1", createMesh("stale_cached_box_1")));
    await flushPromises();

    expect(snapshots.at(-1)?.meshes.map((mesh) => mesh.id)).toEqual([
      "generated_box_1"
    ]);
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
  });

  it("requests display geometry for supported circle-target add results", async () => {
    const snapshots: DerivedGeometrySnapshot[] = [];
    const runtime = createRuntime(async (input) =>
      createResult(input.id, createMesh(input.id))
    );
    const service = new DerivedGeometryService({
      runtime,
      onChange: (snapshot) => snapshots.push(snapshot)
    });
    const source: DerivedBooleanExtrudeGeometrySource = {
      id: "body_circle_add",
      kind: "extrudeBoolean",
      operation: "add",
      target: createCircleExtrudeSource("body_circle_target"),
      tool: createCircleExtrudeSource("body_circle_tool")
    };

    service.reconcile([source]);
    await flushPromises();

    expect(runtime.inputs).toEqual([
      expect.objectContaining({
        id: "body_circle_add",
        operation: "add",
        target: expect.objectContaining({
          profile: expect.objectContaining({ kind: "circle" })
        }),
        tool: expect.objectContaining({
          profile: expect.objectContaining({ kind: "circle" })
        })
      })
    ]);
    expect(snapshots.at(-1)?.entries).toMatchObject([
      {
        objectId: "body_circle_add",
        objectKind: "extrudeBoolean",
        status: "ready"
      }
    ]);
  });

  it("labels display geometry failures with product language", async () => {
    const cases: ReadonlyArray<{
      readonly source: DerivedGeometrySource;
      readonly expected: string;
    }> = [
      {
        source: {
          id: "body_cut_1",
          kind: "extrudeBoolean",
          operation: "cut",
          target: createCircleExtrudeSource("body_circle_1"),
          tool: createExtrudeSource("body_cut_1")
        },
        expected: "Boolean display geometry issue"
      },
      {
        source: createRevolveSource("body_revolve_1"),
        expected: "Revolve display geometry issue"
      },
      {
        source: {
          id: "body_hole_1",
          kind: "hole",
          target: createExtrudeSource("body_rect_1"),
          tool: {
            sketchPlane: "XY",
            circle: { kind: "circle", center: [0, 0], radius: 0.5 },
            depthMode: "blind",
            depth: 1,
            direction: "positive"
          }
        },
        expected: "Hole display geometry issue"
      },
      {
        source: createEdgeFinishSource("body_chamfer_1", "chamfer"),
        expected: "Edge finish display geometry issue"
      }
    ];

    for (const { source, expected } of cases) {
      const snapshots: DerivedGeometrySnapshot[] = [];
      const service = new DerivedGeometryService({
        runtime: createRuntime(async () => {
          throw new Error("display worker failed");
        }),
        onChange: (snapshot) => snapshots.push(snapshot)
      });

      service.reconcile([source]);
      await flushPromises();

      const label = getDerivedGeometryStatusLabel(snapshots.at(-1)?.entries[0]);
      expect(label).toBe(expected);
      expect(label).not.toMatch(/\b(mesh error|primitive fallback)\b/i);
    }
  });

  it("labels unsupported revolve placement without implying primitive fallback", () => {
    const snapshots: DerivedGeometrySnapshot[] = [];
    const service = new DerivedGeometryService({
      runtime: createRuntime(async (input) =>
        createResult(input.id, createMesh(input.id))
      ),
      onChange: (snapshot) => snapshots.push(snapshot)
    });

    service.reconcile([
      {
        ...createRevolveSource("body_revolve_1"),
        placementError:
          "Revolve display currently supports newBody revolve features only."
      }
    ]);

    expect(getDerivedGeometryStatusLabel(snapshots.at(-1)?.entries[0])).toBe(
      "Revolve display currently supports newBody revolve features only."
    );
    expect(snapshots.at(-1)?.meshes).toEqual([]);
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

function createRevolveSource(id: string): DerivedRevolveGeometrySource {
  return {
    id,
    kind: "revolve",
    sketchPlane: "XY",
    profile: {
      kind: "rectangle",
      center: [2, 0],
      width: 1,
      height: 2
    },
    axis: {
      start: [0, -2],
      end: [0, 2]
    },
    angleDegrees: 270
  };
}

function createEdgeFinishSource(
  id: string,
  operation: "chamfer" | "fillet"
): DerivedEdgeFinishGeometrySource {
  return operation === "chamfer"
    ? {
        id,
        kind: "edgeFinish",
        operation,
        target: createExtrudeSource("body_rect_1"),
        edgeStableId: "generated:edge:body_rect_1:start:uMin",
        distance: 0.25
      }
    : {
        id,
        kind: "edgeFinish",
        operation,
        target: createExtrudeSource("body_rect_1"),
        edgeStableId: "generated:edge:body_rect_1:start:uMin",
        radius: 0.25
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

function createExtrudedCircleEngine(): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "circle_1",
      center: [0, 0],
      radius: 2
    }
  ]);
  engine.apply({
    op: "feature.extrude",
    id: "feat_circle_1",
    bodyId: "body_circle_1",
    sketchId: "sketch_1",
    entityId: "circle_1",
    depth: 4
  });

  return engine;
}

function createRevolveEngine(): CadEngine {
  const engine = new CadEngine();

  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "rect_1",
      center: [2, 0],
      width: 1,
      height: 2
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "circle_1",
      center: [4, 0],
      radius: 0.5
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "axis_1",
      start: [0, -2],
      end: [0, 2]
    },
    {
      op: "feature.revolve",
      id: "feat_revolve_rect_1",
      bodyId: "body_revolve_rect_1",
      sketchId: "sketch_1",
      entityId: "rect_1",
      axis: {
        type: "sketchLine",
        sketchId: "sketch_1",
        entityId: "axis_1"
      },
      angleDegrees: 270
    },
    {
      op: "feature.revolve",
      id: "feat_revolve_circle_1",
      bodyId: "body_revolve_circle_1",
      sketchId: "sketch_1",
      entityId: "circle_1",
      axis: {
        type: "sketchLine",
        sketchId: "sketch_1",
        entityId: "axis_1"
      },
      angleDegrees: 180
    }
  ]);

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

function getPrimitiveBooleanTarget(
  source: DerivedBooleanExtrudeGeometrySource
): DerivedExtrudeGeometrySource {
  if (source.target.kind === "extrudeBoolean") {
    throw new Error("Expected primitive boolean target source.");
  }

  return source.target;
}

function getRuntimePrimitiveTarget(
  input: RuntimeInput
): DerivedGeometryBooleanExtrudePrimitiveInputSource | undefined {
  if (!("target" in input)) {
    return undefined;
  }

  return "profile" in input.target ? input.target : undefined;
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
    revolveProfile(input) {
      inputs.push(input);
      return handler(input);
    },
    booleanExtrudes(input) {
      inputs.push(input);
      return handler(input);
    },
    hole(input) {
      inputs.push(input);
      return handler(input);
    },
    edgeFinish(input) {
      inputs.push(input);
      return handler(input);
    },
    linearPattern(input) {
      inputs.push(input);
      return handler(input);
    },
    circularPattern(input) {
      inputs.push(input);
      return handler(input);
    },
    mirror(input) {
      inputs.push(input);
      return handler(input);
    },
    shell(input) {
      inputs.push(input);
      return handler(input);
    },
    exactBodyMetadata(): Promise<DerivedExactMetadataResult> {
      throw new Error("Exact metadata is not used by derived geometry tests.");
    },
    exactTopologyCheckpointPayload() {
      throw new Error(
        "Checkpoint payload requests are not used by derived geometry tests."
      );
    },
    importStep() {
      throw new Error("STEP import is not used by derived geometry tests.");
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

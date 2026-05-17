import { describe, expect, it } from "vitest";
import {
  areTransformFormsEqual,
  buildBatch,
  buildCreateBoxOp,
  buildCreateConeOp,
  buildCreateSphereOp,
  buildCreateTorusOp,
  buildFeatureDeleteOp,
  buildFeatureUpdateExtrudeOp,
  buildDeleteObjectOp,
  buildOperationFromBatchForm,
  buildRenameObjectOp,
  buildUpdateBoxDimensionsOp,
  buildUpdateConeDimensionsOp,
  buildUpdateCylinderDimensionsOp,
  buildUpdateSketchEntityOp,
  buildUpdateSphereDimensionsOp,
  buildUpdateTorusDimensionsOp,
  buildUpdateUnitsOp,
  buildUpdateTransformOp,
  boxDimensionsToForm,
  areBoxDimensionFormsEqual,
  areConeDimensionFormsEqual,
  areCylinderDimensionFormsEqual,
  areSphereDimensionFormsEqual,
  areTorusDimensionFormsEqual,
  coneDimensionsToForm,
  cylinderDimensionsToForm,
  resetTransformRotation,
  resetTransformScale,
  resetTransformTranslation,
  sphereDimensionsToForm,
  torusDimensionsToForm,
  transformToForm,
  WEB_UI_ACTOR
} from "./cadCommands";

describe("cad command builders", () => {
  it("builds create commands from form values", () => {
    expect(
      buildCreateBoxOp({
        id: "box_1",
        width: 2,
        height: 3,
        depth: 4,
        radius: 1,
        majorRadius: 2,
        minorRadius: 0.5,
        translationX: 5,
        translationY: 6,
        translationZ: 7
      })
    ).toEqual({
      op: "scene.createBox",
      id: "box_1",
      dimensions: { width: 2, height: 3, depth: 4 },
      transform: { translation: [5, 6, 7] }
    });

    expect(
      buildCreateSphereOp({
        id: "sphere_1",
        width: 1,
        height: 1,
        depth: 1,
        radius: 2,
        majorRadius: 2,
        minorRadius: 0.5,
        translationX: 5,
        translationY: 6,
        translationZ: 7
      })
    ).toEqual({
      op: "scene.createSphere",
      id: "sphere_1",
      dimensions: { radius: 2 },
      transform: { translation: [5, 6, 7] }
    });

    expect(
      buildCreateConeOp({
        id: "cone_1",
        width: 1,
        height: 4,
        depth: 1,
        radius: 2,
        majorRadius: 2,
        minorRadius: 0.5,
        translationX: 5,
        translationY: 6,
        translationZ: 7
      })
    ).toEqual({
      op: "scene.createCone",
      id: "cone_1",
      dimensions: { radius: 2, height: 4 },
      transform: { translation: [5, 6, 7] }
    });

    expect(
      buildCreateTorusOp({
        id: "torus_1",
        width: 1,
        height: 1,
        depth: 1,
        radius: 1,
        majorRadius: 3,
        minorRadius: 0.75,
        translationX: 5,
        translationY: 6,
        translationZ: 7
      })
    ).toEqual({
      op: "scene.createTorus",
      id: "torus_1",
      dimensions: { majorRadius: 3, minorRadius: 0.75 },
      transform: { translation: [5, 6, 7] }
    });
  });

  it("builds transform and delete commands", () => {
    expect(
      buildUpdateTransformOp("box_1", {
        translationX: 1,
        translationY: 2,
        translationZ: 3,
        rotationX: 0.1,
        rotationY: 0.2,
        rotationZ: 0.3,
        scaleX: 2,
        scaleY: 3,
        scaleZ: 4
      })
    ).toEqual({
      op: "scene.updateTransform",
      id: "box_1",
      transform: {
        translation: [1, 2, 3],
        rotation: [0.1, 0.2, 0.3],
        scale: [2, 3, 4]
      }
    });
    expect(buildDeleteObjectOp("box_1")).toEqual({
      op: "scene.deleteObject",
      id: "box_1"
    });
    expect(buildFeatureDeleteOp("feat_1")).toEqual({
      op: "feature.delete",
      id: "feat_1"
    });
    expect(buildFeatureUpdateExtrudeOp("feat_1", 6)).toEqual({
      op: "feature.updateExtrude",
      id: "feat_1",
      depth: 6
    });
    expect(
      buildUpdateSketchEntityOp("sketch_1", {
        id: "rect_1",
        kind: "rectangle",
        center: [1, 2],
        width: 3,
        height: 4
      })
    ).toEqual({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: {
        id: "rect_1",
        kind: "rectangle",
        center: [1, 2],
        width: 3,
        height: 4
      }
    });
  });

  it("builds dimension update commands", () => {
    expect(
      buildUpdateBoxDimensionsOp("box_1", {
        width: 4,
        height: 5,
        depth: 6,
        radius: 1,
        majorRadius: 2,
        minorRadius: 0.5
      })
    ).toEqual({
      op: "scene.updateBoxDimensions",
      id: "box_1",
      dimensions: { width: 4, height: 5, depth: 6 }
    });

    expect(
      buildUpdateCylinderDimensionsOp("cylinder_1", {
        width: 1,
        height: 8,
        depth: 1,
        radius: 2,
        majorRadius: 2,
        minorRadius: 0.5
      })
    ).toEqual({
      op: "scene.updateCylinderDimensions",
      id: "cylinder_1",
      dimensions: { radius: 2, height: 8 }
    });

    expect(
      buildUpdateSphereDimensionsOp("sphere_1", {
        width: 1,
        height: 1,
        depth: 1,
        radius: 3,
        majorRadius: 2,
        minorRadius: 0.5
      })
    ).toEqual({
      op: "scene.updateSphereDimensions",
      id: "sphere_1",
      dimensions: { radius: 3 }
    });

    expect(
      buildUpdateConeDimensionsOp("cone_1", {
        width: 1,
        height: 4,
        depth: 1,
        radius: 2,
        majorRadius: 2,
        minorRadius: 0.5
      })
    ).toEqual({
      op: "scene.updateConeDimensions",
      id: "cone_1",
      dimensions: { radius: 2, height: 4 }
    });

    expect(
      buildUpdateTorusDimensionsOp("torus_1", {
        width: 1,
        height: 1,
        depth: 1,
        radius: 1,
        majorRadius: 3,
        minorRadius: 0.75
      })
    ).toEqual({
      op: "scene.updateTorusDimensions",
      id: "torus_1",
      dimensions: { majorRadius: 3, minorRadius: 0.75 }
    });
  });

  it("builds units and rename commands", () => {
    expect(buildUpdateUnitsOp("in")).toEqual({
      op: "document.updateUnits",
      units: "in",
      mode: "metadataOnly"
    });
    expect(buildUpdateUnitsOp("cm", "preservePhysicalSize")).toEqual({
      op: "document.updateUnits",
      units: "cm",
      mode: "preservePhysicalSize"
    });
    expect(buildRenameObjectOp("box_1", "  Base plate  ")).toEqual({
      op: "scene.renameObject",
      id: "box_1",
      name: "Base plate"
    });
  });

  it("builds a CadBatch from queued operations", () => {
    const ops = [
      buildOperationFromBatchForm({
        op: "scene.createCylinder",
        id: "cylinder_1",
        targetId: "",
        width: 1,
        height: 8,
        depth: 1,
        radius: 2,
        majorRadius: 2,
        minorRadius: 0.5,
        translationX: 0,
        translationY: 1,
        translationZ: 2,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        name: "",
        units: "mm"
      })
    ];

    expect(buildBatch("dryRun", ops)).toEqual({
      version: "cadops.v1",
      mode: "dryRun",
      ops
    });

    expect(buildBatch("commit", ops, WEB_UI_ACTOR)).toEqual({
      version: "cadops.v1",
      mode: "commit",
      ops,
      actor: WEB_UI_ACTOR
    });
  });

  it("builds dimension update operations from batch form values", () => {
    expect(
      buildOperationFromBatchForm({
        op: "scene.updateBoxDimensions",
        id: "",
        targetId: "box_1",
        width: 4,
        height: 5,
        depth: 6,
        radius: 1,
        majorRadius: 2,
        minorRadius: 0.5,
        translationX: 0,
        translationY: 0,
        translationZ: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        name: "",
        units: "mm"
      })
    ).toEqual({
      op: "scene.updateBoxDimensions",
      id: "box_1",
      dimensions: { width: 4, height: 5, depth: 6 }
    });

    expect(
      buildOperationFromBatchForm({
        op: "scene.updateCylinderDimensions",
        id: "",
        targetId: "cylinder_1",
        width: 1,
        height: 8,
        depth: 1,
        radius: 2,
        majorRadius: 2,
        minorRadius: 0.5,
        translationX: 0,
        translationY: 0,
        translationZ: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        name: "",
        units: "mm"
      })
    ).toEqual({
      op: "scene.updateCylinderDimensions",
      id: "cylinder_1",
      dimensions: { radius: 2, height: 8 }
    });

    expect(
      buildOperationFromBatchForm({
        op: "scene.updateSphereDimensions",
        id: "",
        targetId: "sphere_1",
        width: 1,
        height: 1,
        depth: 1,
        radius: 3,
        majorRadius: 2,
        minorRadius: 0.5,
        translationX: 0,
        translationY: 0,
        translationZ: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        name: "",
        units: "mm"
      })
    ).toEqual({
      op: "scene.updateSphereDimensions",
      id: "sphere_1",
      dimensions: { radius: 3 }
    });

    expect(
      buildOperationFromBatchForm({
        op: "scene.updateConeDimensions",
        id: "",
        targetId: "cone_1",
        width: 1,
        height: 4,
        depth: 1,
        radius: 2,
        majorRadius: 2,
        minorRadius: 0.5,
        translationX: 0,
        translationY: 0,
        translationZ: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        name: "",
        units: "mm"
      })
    ).toEqual({
      op: "scene.updateConeDimensions",
      id: "cone_1",
      dimensions: { radius: 2, height: 4 }
    });

    expect(
      buildOperationFromBatchForm({
        op: "scene.updateTorusDimensions",
        id: "",
        targetId: "torus_1",
        width: 1,
        height: 1,
        depth: 1,
        radius: 1,
        majorRadius: 3,
        minorRadius: 0.75,
        translationX: 0,
        translationY: 0,
        translationZ: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        name: "",
        units: "mm"
      })
    ).toEqual({
      op: "scene.updateTorusDimensions",
      id: "torus_1",
      dimensions: { majorRadius: 3, minorRadius: 0.75 }
    });

    expect(
      buildOperationFromBatchForm({
        op: "scene.renameObject",
        id: "",
        targetId: "box_1",
        width: 1,
        height: 1,
        depth: 1,
        radius: 1,
        majorRadius: 2,
        minorRadius: 0.5,
        translationX: 0,
        translationY: 0,
        translationZ: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        name: "Panel",
        units: "mm"
      })
    ).toEqual({
      op: "scene.renameObject",
      id: "box_1",
      name: "Panel"
    });

    expect(
      buildOperationFromBatchForm({
        op: "document.updateUnits",
        id: "",
        targetId: "",
        width: 1,
        height: 1,
        depth: 1,
        radius: 1,
        majorRadius: 2,
        minorRadius: 0.5,
        translationX: 0,
        translationY: 0,
        translationZ: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        name: "",
        units: "cm",
        unitUpdateMode: "preservePhysicalSize"
      })
    ).toEqual({
      op: "document.updateUnits",
      units: "cm",
      mode: "preservePhysicalSize"
    });
  });

  it("round-trips transform values into editable form state", () => {
    expect(
      transformToForm({
        translation: [1, 2, 3],
        rotation: [0.1, 0.2, 0.3],
        scale: [2, 2, 2]
      })
    ).toEqual({
      translationX: 1,
      translationY: 2,
      translationZ: 3,
      rotationX: 0.1,
      rotationY: 0.2,
      rotationZ: 0.3,
      scaleX: 2,
      scaleY: 2,
      scaleZ: 2
    });
  });

  it("round-trips and compares dimension form values", () => {
    const boxForm = boxDimensionsToForm({ width: 2, height: 3, depth: 4 });
    const cylinderForm = cylinderDimensionsToForm({ radius: 1.5, height: 6 });
    const sphereForm = sphereDimensionsToForm({ radius: 2.5 });
    const coneForm = coneDimensionsToForm({ radius: 2, height: 4 });
    const torusForm = torusDimensionsToForm({
      majorRadius: 3,
      minorRadius: 0.75
    });

    expect(boxForm).toEqual({
      width: 2,
      height: 3,
      depth: 4,
      radius: 1,
      majorRadius: 2,
      minorRadius: 0.5
    });
    expect(cylinderForm).toEqual({
      width: 1,
      height: 6,
      depth: 1,
      radius: 1.5,
      majorRadius: 2,
      minorRadius: 0.5
    });
    expect(sphereForm).toEqual({
      width: 1,
      height: 1,
      depth: 1,
      radius: 2.5,
      majorRadius: 2,
      minorRadius: 0.5
    });
    expect(coneForm).toEqual({
      width: 1,
      height: 4,
      depth: 1,
      radius: 2,
      majorRadius: 2,
      minorRadius: 0.5
    });
    expect(torusForm).toEqual({
      width: 1,
      height: 1,
      depth: 1,
      radius: 1,
      majorRadius: 3,
      minorRadius: 0.75
    });
    expect(areBoxDimensionFormsEqual(boxForm, { ...boxForm })).toBe(true);
    expect(areBoxDimensionFormsEqual(boxForm, { ...boxForm, depth: 5 })).toBe(
      false
    );
    expect(
      areCylinderDimensionFormsEqual(cylinderForm, { ...cylinderForm })
    ).toBe(true);
    expect(
      areCylinderDimensionFormsEqual(cylinderForm, {
        ...cylinderForm,
        radius: 2
      })
    ).toBe(false);
    expect(areSphereDimensionFormsEqual(sphereForm, { ...sphereForm })).toBe(
      true
    );
    expect(
      areSphereDimensionFormsEqual(sphereForm, {
        ...sphereForm,
        radius: 3
      })
    ).toBe(false);
    expect(areConeDimensionFormsEqual(coneForm, { ...coneForm })).toBe(true);
    expect(
      areConeDimensionFormsEqual(coneForm, {
        ...coneForm,
        height: 5
      })
    ).toBe(false);
    expect(areTorusDimensionFormsEqual(torusForm, { ...torusForm })).toBe(true);
    expect(
      areTorusDimensionFormsEqual(torusForm, {
        ...torusForm,
        minorRadius: 1
      })
    ).toBe(false);
  });

  it("compares and resets transform form sections", () => {
    const form = {
      translationX: 1,
      translationY: 2,
      translationZ: 3,
      rotationX: 0.1,
      rotationY: 0.2,
      rotationZ: 0.3,
      scaleX: 2,
      scaleY: 3,
      scaleZ: 4
    };

    expect(areTransformFormsEqual(form, { ...form })).toBe(true);
    expect(areTransformFormsEqual(form, { ...form, scaleZ: 5 })).toBe(false);
    expect(resetTransformTranslation(form)).toMatchObject({
      translationX: 0,
      translationY: 0,
      translationZ: 0,
      rotationX: 0.1
    });
    expect(resetTransformRotation(form)).toMatchObject({
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 2
    });
    expect(resetTransformScale(form)).toMatchObject({
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      translationX: 1
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  areTransformFormsEqual,
  buildBatch,
  buildCreateBoxOp,
  buildCreateConeOp,
  buildCreateParameterOp,
  buildCreateSphereOp,
  buildCreateSketchDimensionOp,
  buildCreateSketchOp,
  buildCreateTorusOp,
  buildAddSketchCircleOp,
  buildAddSketchLineOp,
  buildAddSketchPointOp,
  buildAddSketchRectangleOp,
  buildFeatureDeleteOp,
  buildFeatureExtrudeOp,
  buildFeatureUpdateExtrudeOp,
  buildDeleteNamedReferenceOp,
  buildDeleteParameterOp,
  buildDeleteSketchDimensionOp,
  buildNameGeneratedReferenceOp,
  buildParameterEditOps,
  buildCreateSketchOnFaceOp,
  buildDeleteObjectOp,
  buildDeleteSketchEntityOp,
  buildDeleteSketchOp,
  buildOperationFromBatchForm,
  buildRenameObjectOp,
  buildRenameParameterOp,
  buildRenameSketchOp,
  buildRenameSketchDimensionOp,
  buildSketchDimensionEditOps,
  buildUpdateBoxDimensionsOp,
  buildUpdateConeDimensionsOp,
  buildUpdateCylinderDimensionsOp,
  buildUpdateParameterOp,
  buildUpdateSketchDimensionOp,
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
    expect(buildFeatureUpdateExtrudeOp("feat_1", 6, "symmetric")).toEqual({
      op: "feature.updateExtrude",
      id: "feat_1",
      depth: 6,
      side: "symmetric"
    });
    expect(
      buildNameGeneratedReferenceOp(
        " Mounting face ",
        "body_1",
        "generated:face:body_1:endCap"
      )
    ).toEqual({
      op: "reference.nameGenerated",
      name: "Mounting face",
      bodyId: "body_1",
      stableId: "generated:face:body_1:endCap"
    });
    expect(buildDeleteNamedReferenceOp(" Mounting face ")).toEqual({
      op: "reference.deleteName",
      name: "Mounting face"
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

  it("builds V2 sketch commands", () => {
    const entityForm = {
      id: "entity_1",
      x: 1,
      y: 2,
      x2: 3,
      y2: 4,
      width: 5,
      height: 6,
      radius: 7
    };

    expect(
      buildCreateSketchOp({
        id: " sketch_1 ",
        name: " Profile ",
        plane: "XY"
      })
    ).toEqual({
      op: "sketch.create",
      id: "sketch_1",
      name: "Profile",
      plane: "XY"
    });
    expect(buildRenameSketchOp("sketch_1", " Updated profile ")).toEqual({
      op: "sketch.rename",
      id: "sketch_1",
      name: "Updated profile"
    });
    expect(buildDeleteSketchOp("sketch_1")).toEqual({
      op: "sketch.delete",
      id: "sketch_1"
    });
    expect(buildAddSketchPointOp("sketch_1", entityForm)).toEqual({
      op: "sketch.addPoint",
      sketchId: "sketch_1",
      id: "entity_1",
      point: [1, 2]
    });
    expect(buildAddSketchLineOp("sketch_1", entityForm)).toEqual({
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "entity_1",
      start: [1, 2],
      end: [3, 4]
    });
    expect(buildAddSketchRectangleOp("sketch_1", entityForm)).toEqual({
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "entity_1",
      center: [1, 2],
      width: 5,
      height: 6
    });
    expect(buildAddSketchCircleOp("sketch_1", entityForm)).toEqual({
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "entity_1",
      center: [1, 2],
      radius: 7
    });
    expect(buildDeleteSketchEntityOp("sketch_1", "entity_1")).toEqual({
      op: "sketch.deleteEntity",
      sketchId: "sketch_1",
      entityId: "entity_1"
    });
  });

  it("builds parameter commands and edit batches", () => {
    expect(
      buildCreateParameterOp({
        id: " p_width ",
        name: " Width ",
        value: 12,
        description: " Main width "
      })
    ).toEqual({
      op: "parameter.create",
      id: "p_width",
      name: "Width",
      value: 12,
      description: "Main width"
    });

    expect(
      buildCreateParameterOp({
        id: "",
        name: "Radius",
        value: 3,
        description: "   "
      })
    ).toEqual({
      op: "parameter.create",
      id: undefined,
      name: "Radius",
      value: 3
    });

    expect(
      buildUpdateParameterOp("p_width", {
        name: "Ignored by update",
        value: 14,
        description: " Updated "
      })
    ).toEqual({
      op: "parameter.update",
      id: "p_width",
      value: 14,
      description: "Updated"
    });
    expect(buildRenameParameterOp("p_width", " Plate width ")).toEqual({
      op: "parameter.rename",
      id: "p_width",
      name: "Plate width"
    });
    expect(buildDeleteParameterOp("p_width")).toEqual({
      op: "parameter.delete",
      id: "p_width"
    });
    expect(
      buildParameterEditOps(
        { id: "p_width", name: "Width", value: 12 },
        { name: "Plate width", value: 14, description: "" }
      )
    ).toEqual([
      {
        op: "parameter.rename",
        id: "p_width",
        name: "Plate width"
      },
      {
        op: "parameter.update",
        id: "p_width",
        value: 14
      }
    ]);
  });

  it("builds sketch dimension commands and edit batches", () => {
    const widthTarget = {
      entityKind: "rectangle" as const,
      role: "width" as const
    };

    expect(
      buildCreateSketchDimensionOp("sketch_1", "rect_1", widthTarget, {
        id: " dim_width ",
        name: " Width ",
        valueSourceType: "literal",
        value: 8,
        parameterId: ""
      })
    ).toEqual({
      op: "sketch.dimension.create",
      id: "dim_width",
      name: "Width",
      sketchId: "sketch_1",
      entityId: "rect_1",
      target: widthTarget,
      value: 8
    });

    expect(
      buildCreateSketchDimensionOp("sketch_1", "rect_1", widthTarget, {
        id: "",
        name: "Width",
        valueSourceType: "parameter",
        value: 8,
        parameterId: " p_width "
      })
    ).toEqual({
      op: "sketch.dimension.create",
      id: undefined,
      name: "Width",
      sketchId: "sketch_1",
      entityId: "rect_1",
      target: widthTarget,
      parameterId: "p_width"
    });

    expect(
      buildUpdateSketchDimensionOp("dim_width", {
        id: "",
        name: "Width",
        valueSourceType: "parameter",
        value: 8,
        parameterId: " p_width "
      })
    ).toEqual({
      op: "sketch.dimension.update",
      id: "dim_width",
      parameterId: "p_width"
    });
    expect(buildRenameSketchDimensionOp("dim_width", " Plate width ")).toEqual({
      op: "sketch.dimension.rename",
      id: "dim_width",
      name: "Plate width"
    });
    expect(buildDeleteSketchDimensionOp("dim_width")).toEqual({
      op: "sketch.dimension.delete",
      id: "dim_width"
    });
    expect(
      buildSketchDimensionEditOps(
        {
          id: "dim_width",
          name: "Width",
          sketchId: "sketch_1",
          entityId: "rect_1",
          target: widthTarget,
          valueSource: { type: "literal", value: 8 },
          status: "healthy",
          issues: [],
          effectiveValue: 8
        },
        {
          id: "",
          name: "Plate width",
          valueSourceType: "parameter",
          value: 8,
          parameterId: "p_width"
        }
      )
    ).toEqual([
      {
        op: "sketch.dimension.rename",
        id: "dim_width",
        name: "Plate width"
      },
      {
        op: "sketch.dimension.update",
        id: "dim_width",
        parameterId: "p_width"
      }
    ]);
  });

  it("builds sketch extrude commands with explicit side", () => {
    expect(
      buildCreateSketchOnFaceOp({
        id: "sketch_face_1",
        name: " End cap sketch ",
        bodyId: "body_1",
        faceStableId: "generated:face:body_1:endCap"
      })
    ).toEqual({
      op: "sketch.createOnFace",
      id: "sketch_face_1",
      name: "End cap sketch",
      bodyId: "body_1",
      faceStableId: "generated:face:body_1:endCap"
    });

    expect(
      buildFeatureExtrudeOp("sketch_1", "rect_1", {
        id: "feat_1",
        bodyId: "body_1",
        name: "Pad",
        depth: 6,
        side: "negative",
        operationMode: "newBody"
      })
    ).toEqual({
      op: "feature.extrude",
      id: "feat_1",
      bodyId: "body_1",
      name: "Pad",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 6,
      side: "negative",
      operationMode: "newBody"
    });

    expect(
      buildFeatureExtrudeOp("sketch_face_1", "face_circle_1", {
        id: "",
        bodyId: "",
        name: " Boss ",
        depth: 2.5,
        side: "positive",
        operationMode: "newBody"
      })
    ).toEqual({
      op: "feature.extrude",
      id: undefined,
      bodyId: undefined,
      name: "Boss",
      sketchId: "sketch_face_1",
      entityId: "face_circle_1",
      depth: 2.5,
      side: "positive",
      operationMode: "newBody"
    });

    expect(
      buildFeatureExtrudeOp("sketch_1", "rect_1", {
        id: "feat_cut_1",
        bodyId: "body_cut_1",
        targetBodyId: "body_rect_1",
        name: "Cut",
        depth: 1,
        side: "positive",
        operationMode: "cut"
      })
    ).toEqual({
      op: "feature.extrude",
      id: "feat_cut_1",
      bodyId: "body_cut_1",
      targetBodyId: "body_rect_1",
      name: "Cut",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 1,
      side: "positive",
      operationMode: "cut"
    });

    expect(
      buildFeatureExtrudeOp("sketch_1", "rect_1", {
        id: "feat_add_1",
        bodyId: "body_add_1",
        targetBodyId: "body_rect_1",
        name: "Add boss",
        depth: 1,
        side: "positive",
        operationMode: "add"
      })
    ).toEqual({
      op: "feature.extrude",
      id: "feat_add_1",
      bodyId: "body_add_1",
      targetBodyId: "body_rect_1",
      name: "Add boss",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 1,
      side: "positive",
      operationMode: "add"
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

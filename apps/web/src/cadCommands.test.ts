import { describe, expect, it } from "vitest";
import {
  areTransformFormsEqual,
  buildBatch,
  buildCreateBoxOp,
  buildCreateConeOp,
  buildCreateCylinderOp,
  buildCreateParameterOp,
  buildCreateSketchConstraintOp,
  buildCreateSphereOp,
  buildCreateSketchDimensionOp,
  buildCreateSketchOp,
  buildCreateTorusOp,
  buildAddSketchCircleOp,
  buildAddSketchArcOp,
  buildAddSketchThreePointArcOp,
  buildAddSketchLineOp,
  buildAddSketchPointOp,
  buildAddSketchRectangleOp,
  buildFeatureDeleteOp,
  buildFeatureChamferOp,
  buildFeatureCircularPatternOp,
  buildFeatureExtrudeOp,
  buildFeatureCompositeExtrudeOp,
  buildFeatureFilletOp,
  buildFeatureHoleOp,
  buildFeatureLinearPatternOp,
  buildFeatureRevolveOp,
  buildFeatureCompositeRevolveOp,
  buildFeatureSweepOp,
  buildFeatureCompositeSweepOp,
  buildFeatureLoftOp,
  buildFeatureUpdateCircularPatternOp,
  buildFeatureUpdateChamferOp,
  buildFeatureUpdateExtrudeOp,
  buildFeatureUpdateCompositeExtrudeOp,
  buildFeatureUpdateFilletOp,
  buildFeatureUpdateHoleOp,
  buildFeatureUpdateLinearPatternOp,
  buildFeatureUpdateRevolveOp,
  buildFeatureUpdateCompositeRevolveOp,
  buildFeatureUpdateCompositeSweepOp,
  buildDeleteNamedReferenceOp,
  buildDeleteParameterOp,
  buildDeleteSketchConstraintOp,
  buildDeleteSketchDimensionOp,
  buildNameGeneratedReferenceOp,
  buildParameterEditOps,
  buildRepairNamedReferenceOp,
  buildRepairNamedReferenceToTopologyAnchorOp,
  buildCreateSketchOnFaceOp,
  buildDeleteObjectOp,
  buildDeleteSketchEntityOp,
  buildDeleteSketchOp,
  buildRenameObjectOp,
  buildRenameParameterOp,
  buildRenameSketchConstraintOp,
  buildRenameSketchOp,
  buildRenameSketchDimensionOp,
  buildSetParameterExpressionOp,
  buildSetSketchEntityConstructionOp,
  buildSketchConstraintEditOps,
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
  it("builds a normalized loft feature operation", () => {
    const sections = [
      { sketchId: "base", entityId: "rectangle" },
      { sketchId: "top", entityId: "circle" }
    ];
    expect(
      buildFeatureLoftOp({
        id: " loft_1 ",
        bodyId: " body_loft ",
        name: " Transition ",
        sections
      })
    ).toEqual({
      op: "feature.loft",
      id: "loft_1",
      bodyId: "body_loft",
      name: "Transition",
      sections
    });
  });

  it("builds a normalized sweep feature operation", () => {
    expect(
      buildFeatureSweepOp("profile_sketch", "profile", {
        id: " sweep_1 ",
        bodyId: " body_sweep ",
        name: " Rail ",
        pathSketchId: "path_sketch",
        pathEntityIds: ["path"]
      })
    ).toEqual({
      op: "feature.sweep",
      id: "sweep_1",
      bodyId: "body_sweep",
      name: "Rail",
      profileSketchId: "profile_sketch",
      profileEntityId: "profile",
      pathSketchId: "path_sketch",
      pathEntityIds: ["path"]
    });
  });

  it("builds V17 arc, construction, and exact composite reference operations", () => {
    const entityForm = {
      id: " arc_1 ", construction: true, x: 1, y: 2, x2: 0, y2: 0,
      width: 1, height: 1, radius: 3, startAngleDegrees: 45,
      sweepAngleDegrees: -120
    };
    expect(buildAddSketchArcOp("sketch_profile", entityForm)).toEqual({
      op: "sketch.addArc", sketchId: "sketch_profile", id: "arc_1",
      construction: true,
      definition: { kind: "centerAngles", center: [1, 2], radius: 3,
        startAngleDegrees: 45, sweepAngleDegrees: -120 }
    });
    expect(buildAddSketchThreePointArcOp("sketch_profile", {
      id: "", construction: false, start: [0, 0], pointOnArc: [1, 1], end: [2, 0]
    })).toEqual({
      op: "sketch.addArc", sketchId: "sketch_profile", id: undefined,
      construction: false,
      definition: { kind: "threePoint", start: [0, 0], pointOnArc: [1, 1], end: [2, 0] }
    });
    expect(buildSetSketchEntityConstructionOp("sketch_profile", "arc_1", false)).toEqual({
      op: "sketch.setEntityConstruction", sketchId: "sketch_profile",
      entityId: "arc_1", construction: false
    });

    const profile = { kind: "wire" as const, sketchId: "sketch_profile", segments: [
      { entityId: "line", orientation: "forward" as const },
      { entityId: "arc", orientation: "reverse" as const }
    ] };
    expect(buildFeatureCompositeExtrudeOp({ id: "", bodyId: "", name: "",
      profile, depth: 4, side: "positive", operationMode: "newBody" })).toMatchObject({
      op: "feature.extrude", profile, depth: 4, operationMode: "newBody"
    });
    expect(buildFeatureCompositeRevolveOp({ id: "", bodyId: "", name: "",
      profile, axisEntityId: "axis", angleDegrees: 180 })).toMatchObject({
      op: "feature.revolve", profile,
      axis: { type: "sketchLine", sketchId: "sketch_profile", entityId: "axis" },
      angleDegrees: 180, operationMode: "newBody"
    });
    const sweepProfile = { kind: "entity" as const, sketchId: "profile", entityId: "circle" };
    const path = { kind: "entity" as const, sketchId: "path", entityId: "arc", orientation: "reverse" as const };
    expect(buildFeatureCompositeSweepOp({ id: "", bodyId: "", name: "", profile: sweepProfile, path })).toMatchObject({
      op: "feature.sweep", profile: sweepProfile, path
    });
    expect(buildFeatureUpdateCompositeExtrudeOp("extrude", profile)).toEqual({
      op: "feature.updateExtrude", id: "extrude", profile
    });
    expect(buildFeatureUpdateCompositeRevolveOp("revolve", profile)).toEqual({
      op: "feature.updateRevolve", id: "revolve", profile
    });
    expect(buildFeatureUpdateCompositeSweepOp("sweep", sweepProfile, path)).toEqual({
      op: "feature.updateSweep", id: "sweep", profile: sweepProfile, path
    });
  });

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
    expect(buildFeatureUpdateRevolveOp("feat_revolve", 180)).toEqual({
      op: "feature.updateRevolve",
      id: "feat_revolve",
      angleDegrees: 180
    });
    expect(
      buildFeatureUpdateHoleOp("feat_hole", "blind", 2.5, "negative")
    ).toEqual({
      op: "feature.updateHole",
      id: "feat_hole",
      depthMode: "blind",
      depth: 2.5,
      direction: "negative"
    });
    expect(buildFeatureUpdateHoleOp("feat_hole", "throughAll")).toEqual({
      op: "feature.updateHole",
      id: "feat_hole",
      depthMode: "throughAll"
    });
    expect(buildFeatureUpdateChamferOp("feat_chamfer", 0.25)).toEqual({
      op: "feature.updateChamfer",
      id: "feat_chamfer",
      distance: 0.25
    });
    expect(buildFeatureUpdateFilletOp("feat_fillet", 0.5)).toEqual({
      op: "feature.updateFillet",
      id: "feat_fillet",
      radius: 0.5
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
      buildRepairNamedReferenceOp(
        " Mounting face ",
        "body_2",
        "generated:face:body_2:endCap"
      )
    ).toEqual({
      op: "reference.repairName",
      name: "Mounting face",
      bodyId: "body_2",
      stableId: "generated:face:body_2:endCap"
    });
    expect(
      buildRepairNamedReferenceToTopologyAnchorOp(
        " Mounting face ",
        " anchor_face_1 "
      )
    ).toEqual({
      op: "reference.repairName",
      name: "Mounting face",
      topologyAnchorId: "anchor_face_1"
    });
    expect(
      buildCreateSketchOnFaceOp({
        id: "sketch_anchor_1",
        name: " Anchor face sketch ",
        bodyId: "body_1",
        faceStableId: "generated:face:body_1:endCap",
        topologyAnchorId: " anchor_face_1 ",
        topologyAnchorProof: {
          kind: "axisAlignedPlanarFace",
          entityKind: "face",
          evidenceSource: "checkpointSnapshot",
          exposesCheckpointLocalIds: false,
          planarAxis: "z",
          planarCoordinate: 1,
          bounds: { min: [0, 0, 1], max: [1, 1, 1] }
        }
      })
    ).toEqual({
      op: "sketch.createOnFace",
      id: "sketch_anchor_1",
      name: "Anchor face sketch",
      topologyAnchorId: "anchor_face_1",
      topologyAnchorProof: {
        kind: "axisAlignedPlanarFace",
        entityKind: "face",
        evidenceSource: "checkpointSnapshot",
        exposesCheckpointLocalIds: false,
        planarAxis: "z",
        planarCoordinate: 1,
        bounds: { min: [0, 0, 1], max: [1, 1, 1] }
      }
    });
    expect(
      buildUpdateSketchEntityOp("sketch_1", {
        id: "rect_1",
        kind: "rectangle",
        construction: false,
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
        construction: false,
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
      radius: 7,
      construction: false,
      startAngleDegrees: 0,
      sweepAngleDegrees: 90
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
      point: [1, 2],
      construction: false
    });
    expect(buildAddSketchLineOp("sketch_1", entityForm)).toEqual({
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "entity_1",
      start: [1, 2],
      end: [3, 4],
      construction: false
    });
    expect(buildAddSketchRectangleOp("sketch_1", entityForm)).toEqual({
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "entity_1",
      center: [1, 2],
      width: 5,
      height: 6,
      construction: false
    });
    expect(buildAddSketchCircleOp("sketch_1", entityForm)).toEqual({
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "entity_1",
      center: [1, 2],
      radius: 7,
      construction: false
    });
    expect(buildDeleteSketchEntityOp("sketch_1", "entity_1")).toEqual({
      op: "sketch.deleteEntity",
      sketchId: "sketch_1",
      entityId: "entity_1"
    });
  });

  it("builds V15 pattern feature commands", () => {
    expect(
      buildFeatureLinearPatternOp({
        id: " feat_linear ",
        bodyId: " body_linear ",
        seedBodyId: "body_seed",
        name: " Linear copies ",
        direction: { kind: "globalAxis", axis: "x" },
        spacing: 30,
        instanceCount: 4
      })
    ).toEqual({
      op: "feature.linearPattern",
      id: "feat_linear",
      bodyId: "body_linear",
      seedBodyId: "body_seed",
      name: "Linear copies",
      direction: { kind: "globalAxis", axis: "x" },
      spacing: 30,
      instanceCount: 4
    });

    expect(
      buildFeatureUpdateLinearPatternOp("feat_linear", {
        direction: { kind: "globalAxis", axis: "y" },
        spacing: 40,
        instanceCount: 5
      })
    ).toEqual({
      op: "feature.updateLinearPattern",
      id: "feat_linear",
      direction: { kind: "globalAxis", axis: "y" },
      spacing: 40,
      instanceCount: 5
    });

    expect(
      buildFeatureCircularPatternOp({
        id: "   ",
        bodyId: "",
        seedBodyId: "body_seed",
        name: "   ",
        rotationAxis: { kind: "globalAxis", axis: "z" },
        totalAngleDegrees: 360,
        instanceCount: 6
      })
    ).toEqual({
      op: "feature.circularPattern",
      id: undefined,
      bodyId: undefined,
      seedBodyId: "body_seed",
      rotationAxis: { kind: "globalAxis", axis: "z" },
      totalAngleDegrees: 360,
      instanceCount: 6
    });

    expect(
      buildFeatureUpdateCircularPatternOp("feat_circular", {
        rotationAxis: { kind: "globalAxis", axis: "x" },
        totalAngleDegrees: 180,
        instanceCount: 3
      })
    ).toEqual({
      op: "feature.updateCircularPattern",
      id: "feat_circular",
      rotationAxis: { kind: "globalAxis", axis: "x" },
      totalAngleDegrees: 180,
      instanceCount: 3
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
    expect(buildSetParameterExpressionOp("p_width", " Plate / 2 ")).toEqual({
      op: "parameter.setExpression",
      id: "p_width",
      expression: "Plate / 2"
    });
    expect(buildSetParameterExpressionOp("p_width", "   ")).toEqual({
      op: "parameter.setExpression",
      id: "p_width",
      expression: null
    });
    expect(
      buildParameterEditOps(
        { id: "p_width", name: "Width", value: 12 },
        { name: "Plate width", value: 14, expression: "", description: "" }
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
    expect(
      buildParameterEditOps(
        {
          id: "p_width",
          name: "Width",
          value: 12,
          expression: "Plate / 2",
          description: "Stored description"
        },
        { name: "Width", value: 12, expression: "", description: "   " }
      )
    ).toEqual([
      {
        op: "parameter.setExpression",
        id: "p_width",
        expression: null
      },
      {
        op: "parameter.update",
        id: "p_width",
        value: 12,
        description: ""
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

  it("builds sketch constraint commands and edit batches", () => {
    expect(
      buildCreateSketchConstraintOp("sketch_1", "line_1", {
        id: " con_horizontal ",
        name: " Horizontal ",
        kind: "horizontal",
        targetRole: "start",
        coordinateMode: "current",
        coordinateX: 0,
        coordinateY: 0,
        secondaryEntityId: "",
        secondaryTargetRole: "position"
      })
    ).toEqual({
      op: "sketch.constraint.create",
      id: "con_horizontal",
      name: "Horizontal",
      sketchId: "sketch_1",
      entityId: "line_1",
      kind: "horizontal"
    });

    expect(
      buildCreateSketchConstraintOp("sketch_1", "line_1", {
        id: " fix_start ",
        name: " Fixed start ",
        kind: "fixed",
        targetRole: "start",
        coordinateMode: "current",
        coordinateX: 0,
        coordinateY: 0,
        secondaryEntityId: "",
        secondaryTargetRole: "position"
      })
    ).toEqual({
      op: "sketch.constraint.create",
      id: "fix_start",
      name: "Fixed start",
      sketchId: "sketch_1",
      kind: "fixed",
      target: { entityId: "line_1", role: "start" }
    });

    expect(
      buildCreateSketchConstraintOp("sketch_1", "line_1", {
        id: " fix_custom ",
        name: " Fixed custom ",
        kind: "fixed",
        targetRole: "end",
        coordinateMode: "custom",
        coordinateX: 3,
        coordinateY: 4,
        secondaryEntityId: "",
        secondaryTargetRole: "position"
      })
    ).toEqual({
      op: "sketch.constraint.create",
      id: "fix_custom",
      name: "Fixed custom",
      sketchId: "sketch_1",
      kind: "fixed",
      target: { entityId: "line_1", role: "end" },
      coordinate: [3, 4]
    });

    expect(
      buildCreateSketchConstraintOp("sketch_1", "line_1", {
        id: " co_start_point ",
        name: " Start to point ",
        kind: "coincident",
        targetRole: "start",
        coordinateMode: "current",
        coordinateX: 0,
        coordinateY: 0,
        secondaryEntityId: "point_1",
        secondaryTargetRole: "position"
      })
    ).toEqual({
      op: "sketch.constraint.create",
      id: "co_start_point",
      name: "Start to point",
      sketchId: "sketch_1",
      kind: "coincident",
      primaryTarget: { entityId: "line_1", role: "start" },
      secondaryTarget: { entityId: "point_1", role: "position" }
    });

    expect(
      buildCreateSketchConstraintOp("sketch_1", "line_1", {
        id: " mid_point ",
        name: " Point midpoint ",
        kind: "midpoint",
        targetRole: "start",
        coordinateMode: "current",
        coordinateX: 0,
        coordinateY: 0,
        secondaryEntityId: "point_1",
        secondaryTargetRole: "position"
      })
    ).toEqual({
      op: "sketch.constraint.create",
      id: "mid_point",
      name: "Point midpoint",
      sketchId: "sketch_1",
      kind: "midpoint",
      lineEntityId: "line_1",
      target: { entityId: "point_1", role: "position" }
    });

    expect(
      buildCreateSketchConstraintOp("sketch_1", "line_1", {
        id: " parallel_1 ",
        name: " Parallel ",
        kind: "parallel",
        targetRole: "start",
        coordinateMode: "current",
        coordinateX: 0,
        coordinateY: 0,
        secondaryEntityId: "line_2",
        secondaryTargetRole: "position"
      })
    ).toEqual({
      op: "sketch.constraint.create",
      id: "parallel_1",
      name: "Parallel",
      sketchId: "sketch_1",
      kind: "parallel",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2"
    });

    expect(
      buildCreateSketchConstraintOp("sketch_1", "line_1", {
        id: " perpendicular_1 ",
        name: " Perpendicular ",
        kind: "perpendicular",
        targetRole: "start",
        coordinateMode: "current",
        coordinateX: 0,
        coordinateY: 0,
        secondaryEntityId: "line_2",
        secondaryTargetRole: "position"
      })
    ).toEqual({
      op: "sketch.constraint.create",
      id: "perpendicular_1",
      name: "Perpendicular",
      sketchId: "sketch_1",
      kind: "perpendicular",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2"
    });

    expect(
      buildRenameSketchConstraintOp("con_horizontal", " Base horizontal ")
    ).toEqual({
      op: "sketch.constraint.rename",
      id: "con_horizontal",
      name: "Base horizontal"
    });

    expect(buildDeleteSketchConstraintOp("con_horizontal")).toEqual({
      op: "sketch.constraint.delete",
      id: "con_horizontal"
    });

    expect(
      buildSketchConstraintEditOps(
        {
          id: "con_horizontal",
          name: "Horizontal",
          sketchId: "sketch_1",
          entityId: "line_1",
          kind: "horizontal",
          status: "healthy",
          issues: []
        },
        {
          id: "",
          name: "Base horizontal",
          kind: "horizontal",
          targetRole: "start",
          coordinateMode: "current",
          coordinateX: 0,
          coordinateY: 0,
          secondaryEntityId: "",
          secondaryTargetRole: "position"
        }
      )
    ).toEqual([
      {
        op: "sketch.constraint.rename",
        id: "con_horizontal",
        name: "Base horizontal"
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

    expect(
      buildFeatureExtrudeOp("sketch_1", "rect_1", {
        id: "feat_anchor_cut",
        bodyId: "body_anchor_cut",
        targetBodyId: "body_active_result",
        targetTopologyAnchorId: " anchor_body_1 ",
        name: "Anchor cut",
        depth: 1,
        side: "positive",
        operationMode: "cut"
      })
    ).toEqual({
      op: "feature.extrude",
      id: "feat_anchor_cut",
      bodyId: "body_anchor_cut",
      targetTopologyAnchorId: "anchor_body_1",
      name: "Anchor cut",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 1,
      side: "positive",
      operationMode: "cut"
    });

    expect(
      buildFeatureRevolveOp("sketch_1", "circle_1", {
        id: "feat_revolve_1",
        bodyId: "body_revolve_1",
        name: " Revolved boss ",
        axisEntityId: "axis_1",
        angleDegrees: 270
      })
    ).toEqual({
      op: "feature.revolve",
      id: "feat_revolve_1",
      bodyId: "body_revolve_1",
      name: "Revolved boss",
      sketchId: "sketch_1",
      entityId: "circle_1",
      axis: {
        type: "sketchLine",
        sketchId: "sketch_1",
        entityId: "axis_1"
      },
      angleDegrees: 270,
      operationMode: "newBody"
    });

    expect(
      buildFeatureHoleOp("sketch_1", "circle_1", {
        id: "feat_hole_1",
        bodyId: "body_hole_1",
        targetBodyId: "body_rect_1",
        name: " Mounting hole ",
        depthMode: "blind",
        depth: 0.75,
        direction: "negative"
      })
    ).toEqual({
      op: "feature.hole",
      id: "feat_hole_1",
      bodyId: "body_hole_1",
      targetBodyId: "body_rect_1",
      name: "Mounting hole",
      sketchId: "sketch_1",
      circleEntityId: "circle_1",
      depthMode: "blind",
      depth: 0.75,
      direction: "negative"
    });

    expect(
      buildFeatureHoleOp("sketch_1", "circle_1", {
        id: "",
        bodyId: "",
        targetBodyId: "body_rect_1",
        name: "",
        depthMode: "throughAll",
        depth: 12,
        direction: "positive"
      })
    ).toEqual({
      op: "feature.hole",
      id: undefined,
      bodyId: undefined,
      targetBodyId: "body_rect_1",
      name: undefined,
      sketchId: "sketch_1",
      circleEntityId: "circle_1",
      depthMode: "throughAll",
      direction: "positive"
    });

    expect(
      buildFeatureHoleOp("sketch_1", "circle_1", {
        id: "feat_anchor_hole",
        bodyId: "body_anchor_hole",
        targetBodyId: "body_active_result",
        targetTopologyAnchorId: " anchor_body_1 ",
        name: " Anchor hole ",
        depthMode: "throughAll",
        depth: 12,
        direction: "positive"
      })
    ).toEqual({
      op: "feature.hole",
      id: "feat_anchor_hole",
      bodyId: "body_anchor_hole",
      targetTopologyAnchorId: "anchor_body_1",
      name: "Anchor hole",
      sketchId: "sketch_1",
      circleEntityId: "circle_1",
      depthMode: "throughAll",
      direction: "positive"
    });

    expect(
      buildFeatureChamferOp({
        id: "",
        bodyId: "",
        targetBodyId: "body_rect_1",
        name: " Edge break ",
        edgeStableId: "generated:edge:body_rect_1:start:uMin",
        distance: 0.25,
        radius: 0.1
      })
    ).toEqual({
      op: "feature.chamfer",
      id: undefined,
      bodyId: undefined,
      targetBodyId: "body_rect_1",
      edgeStableId: "generated:edge:body_rect_1:start:uMin",
      distance: 0.25,
      name: "Edge break"
    });

    expect(
      buildFeatureChamferOp({
        id: "feat_anchor_chamfer",
        bodyId: "body_anchor_chamfer",
        targetBodyId: "body_rect_1",
        name: "Anchor break",
        edgeStableId: "generated:edge:body_rect_1:start:uMin",
        topologyAnchorId: "anchor_edge_1",
        topologyAnchorProof: {
          kind: "axisAlignedLinearEdge",
          entityKind: "edge",
          evidenceSource: "checkpointSnapshot",
          exposesCheckpointLocalIds: false,
          bounds: { min: [0, 0, 0], max: [0, 1, 0] },
          linearAxis: "y",
          length: 1
        },
        distance: 0.25,
        radius: 0.1
      })
    ).toEqual({
      op: "feature.chamfer",
      id: "feat_anchor_chamfer",
      bodyId: "body_anchor_chamfer",
      targetBodyId: "body_rect_1",
      topologyAnchorId: "anchor_edge_1",
      topologyAnchorProof: {
        kind: "axisAlignedLinearEdge",
        entityKind: "edge",
        evidenceSource: "checkpointSnapshot",
        exposesCheckpointLocalIds: false,
        bounds: { min: [0, 0, 0], max: [0, 1, 0] },
        linearAxis: "y",
        length: 1
      },
      distance: 0.25,
      name: "Anchor break"
    });

    expect(
      buildFeatureFilletOp({
        id: "feat_fillet_1",
        bodyId: "body_fillet_1",
        targetBodyId: "body_rect_1",
        name: "Round",
        topologyAnchorId: "anchor_edge_1",
        topologyAnchorProof: {
          kind: "axisAlignedLinearEdge",
          entityKind: "edge",
          evidenceSource: "checkpointSnapshot",
          exposesCheckpointLocalIds: false,
          bounds: { min: [0, 0, 0], max: [0, 1, 0] },
          linearAxis: "y",
          length: 1
        },
        distance: 0.25,
        radius: 0.125
      })
    ).toEqual({
      op: "feature.fillet",
      id: "feat_fillet_1",
      bodyId: "body_fillet_1",
      targetBodyId: "body_rect_1",
      topologyAnchorId: "anchor_edge_1",
      topologyAnchorProof: {
        kind: "axisAlignedLinearEdge",
        entityKind: "edge",
        evidenceSource: "checkpointSnapshot",
        exposesCheckpointLocalIds: false,
        bounds: { min: [0, 0, 0], max: [0, 1, 0] },
        linearAxis: "y",
        length: 1
      },
      radius: 0.125,
      name: "Round"
    });

    expect(
      buildFeatureFilletOp({
        id: "feat_named_fillet",
        bodyId: "body_named_fillet",
        targetBodyId: "body_rect_1",
        name: "Named round",
        namedReference: "Top edge",
        distance: 0.25,
        radius: 0.125
      })
    ).toEqual({
      op: "feature.fillet",
      id: "feat_named_fillet",
      bodyId: "body_named_fillet",
      targetBodyId: "body_rect_1",
      namedReference: "Top edge",
      radius: 0.125,
      name: "Named round"
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
      buildCreateCylinderOp({
        id: "cylinder_1",
        width: 1,
        height: 8,
        depth: 1,
        radius: 2,
        majorRadius: 2,
        minorRadius: 0.5,
        translationX: 0,
        translationY: 1,
        translationZ: 2
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

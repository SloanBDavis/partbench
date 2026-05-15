import { describe, expect, it } from "vitest";
import {
  areTransformFormsEqual,
  buildBatch,
  buildCreateBoxOp,
  buildDeleteObjectOp,
  buildOperationFromBatchForm,
  buildUpdateTransformOp,
  resetTransformRotation,
  resetTransformScale,
  resetTransformTranslation,
  transformToForm
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
        translationX: 0,
        translationY: 1,
        translationZ: 2,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1
      })
    ];

    expect(buildBatch("dryRun", ops)).toEqual({
      version: "cadops.v1",
      mode: "dryRun",
      ops
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

import type { SketchEntitySnapshot } from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import { buildUpdateSketchEntityOp } from "./cadCommands";
import {
  entityToSketchEntityForm,
  formatSketchEntity,
  getSketchEntityFormLabels,
  sketchEntityFormToEntity,
  validateSketchEntityForm
} from "./sketchEntityForms";

describe("sketch entity form helpers", () => {
  it("builds rectangle profile update commands from form values", () => {
    const entity: SketchEntitySnapshot = {
      id: "rect_1",
      kind: "rectangle",
      center: [0, 0],
      width: 4,
      height: 2
    };
    const form = entityToSketchEntityForm(entity);
    const updatedEntity = sketchEntityFormToEntity("rect_1", "rectangle", {
      ...form,
      x: 1,
      y: 2,
      width: 6,
      height: 5
    });

    expect(updatedEntity).toEqual({
      id: "rect_1",
      kind: "rectangle",
      center: [1, 2],
      width: 6,
      height: 5
    });
    expect(buildUpdateSketchEntityOp("sketch_1", updatedEntity)).toEqual({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: updatedEntity
    });
  });

  it("builds circle profile update commands from form values", () => {
    const entity: SketchEntitySnapshot = {
      id: "circle_1",
      kind: "circle",
      center: [0, 0],
      radius: 2
    };
    const form = entityToSketchEntityForm(entity);
    const updatedEntity = sketchEntityFormToEntity("circle_1", "circle", {
      ...form,
      x: -1,
      y: 3,
      radius: 4
    });

    expect(updatedEntity).toEqual({
      id: "circle_1",
      kind: "circle",
      center: [-1, 3],
      radius: 4
    });
    expect(buildUpdateSketchEntityOp("sketch_1", updatedEntity)).toEqual({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: updatedEntity
    });
  });

  it("validates rectangle and circle source-profile forms before saving", () => {
    expect(
      validateSketchEntityForm("rectangle", {
        id: "rect_1",
        x: 0,
        y: 0,
        x2: 1,
        y2: 1,
        width: 0,
        height: 2,
        radius: 1
      })
    ).toEqual({
      ok: false,
      message: "Rectangle width and height must be positive finite numbers."
    });

    expect(
      validateSketchEntityForm("circle", {
        id: "circle_1",
        x: Number.NaN,
        y: 0,
        x2: 1,
        y2: 1,
        width: 1,
        height: 1,
        radius: 2
      })
    ).toEqual({
      ok: false,
      message: "Center coordinates must be finite numbers."
    });

    expect(
      validateSketchEntityForm("circle", {
        id: "circle_1",
        x: 0,
        y: 0,
        x2: 1,
        y2: 1,
        width: 1,
        height: 1,
        radius: 0
      })
    ).toEqual({
      ok: false,
      message: "Circle radius must be a positive finite number."
    });
  });

  it("labels and formats profile edit fields clearly", () => {
    expect(getSketchEntityFormLabels("rectangle")).toEqual({
      x: "Center X",
      y: "Center Y",
      width: "Width",
      height: "Height"
    });
    expect(getSketchEntityFormLabels("circle")).toEqual({
      x: "Center X",
      y: "Center Y",
      radius: "Radius"
    });
    expect(
      formatSketchEntity({
        id: "rect_1",
        kind: "rectangle",
        center: [1, 2],
        width: 6,
        height: 5
      })
    ).toBe("Rectangle 6 x 5 at (1, 2)");
  });
});

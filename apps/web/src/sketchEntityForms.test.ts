import type {
  SketchEntitySnapshot,
  SketchSnapshot
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";
import { buildUpdateSketchEntityOp } from "./cadCommands";
import {
  defaultSketchEntityForm,
  entityToSketchEntityForm,
  formatSketchEntity,
  getDefaultSketchEntityFormForSketch,
  getSketchEntityFormLabels,
  sketchEntityFormToEntity,
  validateSketchEntityForm
} from "./sketchEntityForms";

describe("sketch entity form helpers", () => {
  it("keeps base sketch entity defaults unchanged", () => {
    const sketch = createSketch("sketch_1", [
      {
        id: "rect_1",
        kind: "rectangle",
        center: [0, 0],
        width: 4,
        height: 2,
        construction: false
      }
    ]);

    expect(
      getDefaultSketchEntityFormForSketch(sketch, "rectangle", [sketch])
    ).toEqual(defaultSketchEntityForm);
  });

  it("shrinks first attached rectangle defaults from the source profile", () => {
    const sourceSketch = createSketch("sketch_1", [
      {
        id: "rect_1",
        kind: "rectangle",
        center: [0, 0],
        width: 4,
        height: 2,
        construction: false
      }
    ]);
    const attachedSketch = createAttachedSketch(
      "sketch_face",
      "sketch_1",
      "rect_1"
    );

    expect(
      getDefaultSketchEntityFormForSketch(attachedSketch, "rectangle", [
        sourceSketch,
        attachedSketch
      ])
    ).toEqual({
      ...defaultSketchEntityForm,
      width: 2,
      height: 1
    });
  });

  it("shrinks first attached circle defaults from the source profile", () => {
    const sourceSketch = createSketch("sketch_1", [
      {
        id: "circle_1",
        kind: "circle",
        center: [0, 0],
        radius: 2,
        construction: false
      }
    ]);
    const attachedSketch = createAttachedSketch(
      "sketch_face",
      "sketch_1",
      "circle_1"
    );

    expect(
      getDefaultSketchEntityFormForSketch(attachedSketch, "circle", [
        sourceSketch,
        attachedSketch
      ])
    ).toEqual({
      ...defaultSketchEntityForm,
      radius: 1
    });
  });

  it("builds rectangle profile update commands from form values", () => {
    const entity: SketchEntitySnapshot = {
      id: "rect_1",
      kind: "rectangle",
      center: [0, 0],
      width: 4,
      height: 2,
      construction: true
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
      height: 5,
      construction: true
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
      radius: 2,
      construction: true
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
      radius: 4,
      construction: true
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
        ...defaultSketchEntityForm,
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
        ...defaultSketchEntityForm,
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
        ...defaultSketchEntityForm,
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
        height: 5,
        construction: false
      })
    ).toBe("Rectangle 6 x 5 at (1, 2)");
  });

  it("converts a selected arc into canonical editable fields and update source", () => {
    const arc: SketchEntitySnapshot = {
      id: "arc_1",
      kind: "arc",
      center: [1, -2],
      radius: 4,
      startAngleDegrees: 350,
      sweepAngleDegrees: -120,
      construction: true
    };
    const selectedForm = entityToSketchEntityForm(arc);
    const updated = sketchEntityFormToEntity("arc_1", "arc", {
      ...selectedForm,
      x: 3,
      radius: 5,
      startAngleDegrees: 370,
      sweepAngleDegrees: 80
    });

    expect(selectedForm).toMatchObject({
      x: 1,
      y: -2,
      radius: 4,
      startAngleDegrees: 350,
      sweepAngleDegrees: -120,
      construction: true
    });
    expect(updated).toEqual({
      id: "arc_1",
      kind: "arc",
      center: [3, -2],
      radius: 5,
      startAngleDegrees: 10,
      sweepAngleDegrees: 80,
      construction: true
    });
    expect(buildUpdateSketchEntityOp("sketch_1", updated)).toEqual({
      op: "sketch.updateEntity",
      sketchId: "sketch_1",
      entity: updated
    });
    expect(getSketchEntityFormLabels("arc")).toMatchObject({
      x: "Center X",
      radius: "Radius",
      startAngleDegrees: "Start angle (deg)",
      sweepAngleDegrees: "Signed sweep (deg)"
    });
    expect(formatSketchEntity(updated)).toBe(
      "Arc r 5 at (3, -2), start 10°, sweep 80°"
    );
  });

  it("validates finite canonical arc fields and signed sweep policy", () => {
    expect(
      validateSketchEntityForm("arc", {
        ...defaultSketchEntityForm,
        radius: 0,
        startAngleDegrees: 0,
        sweepAngleDegrees: 90
      })
    ).toEqual({
      ok: false,
      message: "Arc radius must exceed the sketch tolerance."
    });
    expect(
      validateSketchEntityForm("arc", {
        ...defaultSketchEntityForm,
        startAngleDegrees: Number.NaN,
        sweepAngleDegrees: 90
      })
    ).toEqual({
      ok: false,
      message: "Arc start and signed sweep angles must be finite numbers."
    });
    expect(
      validateSketchEntityForm("arc", {
        ...defaultSketchEntityForm,
        sweepAngleDegrees: 360
      })
    ).toEqual({
      ok: false,
      message:
        "Arc signed sweep must be between 0.1 and 359.9 degrees in magnitude."
    });
    expect(
      validateSketchEntityForm("arc", {
        ...defaultSketchEntityForm,
        startAngleDegrees: -10,
        sweepAngleDegrees: -90
      })
    ).toEqual({ ok: true });
  });

  it("preserves construction when editing every sketch entity kind", () => {
    const entities: readonly SketchEntitySnapshot[] = [
      { id: "point", kind: "point", point: [1, 2], construction: true },
      {
        id: "line",
        kind: "line",
        start: [0, 0],
        end: [1, 1],
        construction: true
      },
      {
        id: "rectangle",
        kind: "rectangle",
        center: [0, 0],
        width: 2,
        height: 3,
        construction: true
      },
      {
        id: "circle",
        kind: "circle",
        center: [0, 0],
        radius: 2,
        construction: true
      },
      {
        id: "arc",
        kind: "arc",
        center: [0, 0],
        radius: 2,
        startAngleDegrees: 10,
        sweepAngleDegrees: -90,
        construction: true
      }
    ];

    for (const entity of entities) {
      const roundTripped = sketchEntityFormToEntity(
        entity.id,
        entity.kind,
        entityToSketchEntityForm(entity)
      );
      expect(roundTripped.construction).toBe(true);
    }
  });
});

function createSketch(
  id: string,
  entities: readonly SketchEntitySnapshot[]
): SketchSnapshot {
  return {
    id,
    name: id,
    plane: "XY",
    entities
  };
}

function createAttachedSketch(
  id: string,
  sourceSketchId: string,
  sourceSketchEntityId: string
): SketchSnapshot {
  return {
    id,
    name: id,
    plane: "XY",
    attachment: {
      kind: "generatedFace",
      bodyId: "body_1",
      faceStableId: "generated:face:body_1:endCap",
      sourceFeatureId: "feat_1",
      sourceSketchId,
      sourceSketchEntityId,
      faceRole: "endCap"
    },
    entities: []
  };
}

import { describe, expect, it } from "vitest";
import {
  buildSketchConvenienceOp,
  createSketchConvenienceDraft,
  validateSketchConvenienceDraft
} from "./sketchConvenienceModel";

describe("V19 sketch convenience command model", () => {
  it("builds the exact ordinary Slot CADOps sugar input", () => {
    const draft = {
      ...createSketchConvenienceDraft("slot"),
      slot: {
        centerlineStart: [1, 2] as const,
        centerlineEnd: [9, 4] as const,
        radius: 1.5,
        construction: true
      }
    };

    expect(buildSketchConvenienceOp("sketch-a", draft)).toEqual({
      op: "sketch.addSlot",
      sketchId: "sketch-a",
      centerlineStart: [1, 2],
      centerlineEnd: [9, 4],
      radius: 1.5,
      construction: true
    });
  });

  it("builds the exact ordinary Rounded Rectangle CADOps sugar input", () => {
    const draft = {
      ...createSketchConvenienceDraft("roundedRectangle"),
      roundedRectangle: {
        center: [3, -2] as const,
        width: 12,
        height: 8,
        cornerRadius: 2,
        construction: false
      }
    };

    expect(buildSketchConvenienceOp("sketch-a", draft)).toEqual({
      op: "sketch.addRoundedRectangle",
      sketchId: "sketch-a",
      center: [3, -2],
      width: 12,
      height: 8,
      cornerRadius: 2,
      construction: false
    });
  });

  it("blocks collapsed/tolerance-invalid convenience geometry locally", () => {
    const slot = createSketchConvenienceDraft("slot");
    const rounded = createSketchConvenienceDraft("roundedRectangle");

    expect(
      validateSketchConvenienceDraft({
        ...slot,
        slot: {
          ...slot.slot,
          centerlineEnd: slot.slot.centerlineStart
        }
      })
    ).toContain("Centerline endpoints");
    expect(
      validateSketchConvenienceDraft({
        ...rounded,
        roundedRectangle: {
          ...rounded.roundedRectangle,
          width: 4,
          cornerRadius: 2
        }
      })
    ).toContain("straight spans");
  });
});

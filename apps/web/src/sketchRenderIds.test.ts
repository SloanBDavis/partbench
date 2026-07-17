import { describe, expect, it } from "vitest";
import {
  createSketchEntitySelectionId,
  createSketchSelectionId,
  parseSketchRenderId
} from "./sketchRenderIds";

describe("sketch render ids", () => {
  it("round-trips delimiter-heavy semantic IDs without collisions", () => {
    const first = createSketchEntitySelectionId("a:entity:b", "c");
    const second = createSketchEntitySelectionId("a", "b:entity:c");

    expect(first).not.toBe(second);
    expect(parseSketchRenderId(first)).toEqual({
      kind: "sketchEntity",
      sketchId: "a:entity:b",
      entityId: "c"
    });
    expect(parseSketchRenderId(second)).toEqual({
      kind: "sketchEntity",
      sketchId: "a",
      entityId: "b:entity:c"
    });
  });

  it("keeps sketch-level IDs distinct and rejects malformed lengths", () => {
    const renderId = createSketchSelectionId("sketch:1:entity:2");

    expect(parseSketchRenderId(renderId)).toEqual({
      kind: "sketch",
      sketchId: "sketch:1:entity:2"
    });
    expect(parseSketchRenderId("sketch:99:short")).toBeUndefined();
    expect(parseSketchRenderId(`${renderId}:trailing`)).toBeUndefined();
  });
});

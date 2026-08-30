import { describe, expect, it } from "vitest";
import {
  clearInspectSectionPlane,
  createInspectFaceSectionPlane,
  createInspectWorldSectionPlane,
  inspectSectionClipPlane,
  updateInspectSectionPlane
} from "./inspectSectionPlane";

describe("inspect section plane", () => {
  it("copies a world or face plane into session clip state", () => {
    const xy = createInspectWorldSectionPlane("xy", 2);
    const face = createInspectFaceSectionPlane([0, 0, 4], [0, 0, 1], 1, true);

    expect(inspectSectionClipPlane(xy)).toEqual({
      origin: [0, 0, 2],
      normal: [0, 0, 1]
    });
    expect(inspectSectionClipPlane(face)).toEqual({
      origin: [0, 0, 3],
      normal: [0, 0, -1]
    });
  });

  it("does not silently follow later source changes and clears on reset", () => {
    const copied = createInspectFaceSectionPlane([1, 2, 3], [0, 1, 0]);
    const offset = updateInspectSectionPlane(copied, { offset: 5 });

    expect(offset.origin).toEqual([1, 2, 3]);
    expect(inspectSectionClipPlane(clearInspectSectionPlane())).toBeUndefined();
  });
});

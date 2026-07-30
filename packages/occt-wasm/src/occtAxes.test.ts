import type { OpenCascadeInstance } from "opencascade.js";
import { describe, expect, it } from "vitest";
import { createOcctAxes } from "./occtAxes";

describe("OCCT axes", () => {
  it("owns and disposes every handle exactly once", () => {
    const deleted: string[] = [];
    const disposable = (name: string) =>
      class {
        delete() {
          deleted.push(name);
        }
      };
    const oc = {
      gp_Pnt_3: disposable("point"),
      gp_Dir_4: disposable("direction"),
      gp_Ax2_2: disposable("axes")
    } as unknown as OpenCascadeInstance;

    const axes = createOcctAxes(oc, [1, 2, 3], [0, 0, 1], [1, 0, 0]);
    axes.delete();
    axes.delete();

    expect(deleted).toEqual(["axes", "direction", "direction", "point"]);
  });
});

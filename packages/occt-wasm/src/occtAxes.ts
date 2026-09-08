import type { OpenCascadeInstance } from "opencascade.js";

/** Sketch frames are right-handed: the extrusion normal is u × v. */
export function getOcctStandardSketchFrame(plane: "XY" | "XZ" | "YZ"): {
  readonly origin: readonly [number, number, number];
  readonly uAxis: readonly [number, number, number];
  readonly vAxis: readonly [number, number, number];
  readonly normalAxis: readonly [number, number, number];
} {
  const uAxis = plane === "YZ" ? ([0, 1, 0] as const) : ([1, 0, 0] as const);
  const vAxis = plane === "XY" ? ([0, 1, 0] as const) : ([0, 0, 1] as const);
  return {
    origin: [0, 0, 0],
    uAxis,
    vAxis,
    normalAxis: [
      uAxis[1] * vAxis[2] - uAxis[2] * vAxis[1],
      uAxis[2] * vAxis[0] - uAxis[0] * vAxis[2],
      uAxis[0] * vAxis[1] - uAxis[1] * vAxis[0]
    ]
  };
}

export function createOcctAxes(
  oc: OpenCascadeInstance,
  origin: readonly [number, number, number],
  normalAxis: readonly [number, number, number],
  uAxis: readonly [number, number, number]
): {
  readonly axis: InstanceType<typeof oc.gp_Ax2_2>;
  readonly delete: () => void;
} {
  let point: InstanceType<typeof oc.gp_Pnt_3> | undefined;
  let normal: InstanceType<typeof oc.gp_Dir_4> | undefined;
  let xDirection: InstanceType<typeof oc.gp_Dir_4> | undefined;
  let axis: InstanceType<typeof oc.gp_Ax2_2> | undefined;
  try {
    point = new oc.gp_Pnt_3(...origin);
    normal = new oc.gp_Dir_4(...normalAxis);
    xDirection = new oc.gp_Dir_4(...uAxis);
    axis = new oc.gp_Ax2_2(point, normal, xDirection);
    let disposed = false;
    return {
      axis,
      delete: () => {
        if (disposed) return;
        disposed = true;
        axis?.delete();
        xDirection?.delete();
        normal?.delete();
        point?.delete();
        axis = undefined;
        xDirection = undefined;
        normal = undefined;
        point = undefined;
      }
    };
  } catch (error) {
    axis?.delete();
    xDirection?.delete();
    normal?.delete();
    point?.delete();
    throw error;
  }
}

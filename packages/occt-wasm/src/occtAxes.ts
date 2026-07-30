import type { OpenCascadeInstance } from "opencascade.js";

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

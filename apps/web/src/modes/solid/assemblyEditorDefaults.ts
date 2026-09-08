import type { AssemblyMateFrameRef } from "@web-cad/cad-protocol";

export const defaultAssemblyFrame = (
  instanceId: string
): AssemblyMateFrameRef => ({
  instanceId,
  frame: {
    kind: "local",
    origin: [0, 0, 0],
    xDirection: [1, 0, 0],
    zDirection: [0, 0, 1]
  }
});

import type { OcctMeshDevRuntime } from "./occtMeshDev";

export function createOcctMeshDevRuntime(): OcctMeshDevRuntime {
  return {
    async tessellateBox() {
      throw new Error("OCCT mesh dev runtime is disabled.");
    },
    async tessellateCylinder() {
      throw new Error("OCCT mesh dev runtime is disabled.");
    },
    dispose() {}
  };
}

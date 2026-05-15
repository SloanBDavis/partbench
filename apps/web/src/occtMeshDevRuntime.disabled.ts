import type { OcctMeshDevRuntime } from "./occtMeshDev";

export function createOcctMeshDevRuntime(): OcctMeshDevRuntime {
  return {
    async tessellateBox() {
      throw new Error("Derived geometry runtime is disabled.");
    },
    async tessellateCylinder() {
      throw new Error("Derived geometry runtime is disabled.");
    },
    dispose() {}
  };
}

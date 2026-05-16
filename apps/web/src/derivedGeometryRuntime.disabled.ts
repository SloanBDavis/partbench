import type { DerivedGeometryRuntime } from "./derivedGeometryRuntime";

export function createDerivedGeometryRuntime(): DerivedGeometryRuntime {
  return {
    async tessellateBox() {
      throw new Error("Derived geometry runtime is disabled.");
    },
    async tessellateCylinder() {
      throw new Error("Derived geometry runtime is disabled.");
    },
    async tessellateSphere() {
      throw new Error("Derived geometry runtime is disabled.");
    },
    dispose() {}
  };
}

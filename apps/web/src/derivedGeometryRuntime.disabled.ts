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
    async tessellateCone() {
      throw new Error("Derived geometry runtime is disabled.");
    },
    async tessellateTorus() {
      throw new Error("Derived geometry runtime is disabled.");
    },
    async tessellateExtrude() {
      throw new Error("Derived geometry runtime is disabled.");
    },
    async revolveProfile() {
      throw new Error("Derived geometry runtime is disabled.");
    },
    async booleanExtrudes() {
      throw new Error("Derived geometry runtime is disabled.");
    },
    async hole() {
      throw new Error("Derived geometry runtime is disabled.");
    },
    async edgeFinish() {
      throw new Error("Derived geometry runtime is disabled.");
    },
    async linearPattern() {
      throw new Error("Derived geometry runtime is disabled.");
    },
    async circularPattern() {
      throw new Error("Derived geometry runtime is disabled.");
    },
    async mirror() {
      throw new Error("Derived geometry runtime is disabled.");
    },
    async exactBodyMetadata() {
      throw new Error("Derived geometry runtime is disabled.");
    },
    async exactTopologyCheckpointPayload() {
      throw new Error("Derived geometry runtime is disabled.");
    },
    async importStep() {
      throw new Error("Derived geometry runtime is disabled.");
    },
    dispose() {}
  };
}

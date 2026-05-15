import { describe, expect, it } from "vitest";
import { createOcctBoxMeshSpike, createOcctCylinderMeshSpike } from "./index";

describe("occt-spike", () => {
  it("creates and tessellates a box through Open CASCADE WASM", async () => {
    const mesh = await createOcctBoxMeshSpike({
      width: 10,
      height: 20,
      depth: 30
    });

    expect(mesh.primitive).toBe("box");
    expect(mesh.faceCount).toBe(6);
    expect(mesh.vertexCount).toBe(24);
    expect(mesh.triangleCount).toBe(12);
    expect(mesh.positions).toBeInstanceOf(Float32Array);
    expect(mesh.indices).toBeInstanceOf(Uint32Array);
    expect(mesh.positions).toHaveLength(mesh.vertexCount * 3);
    expect(mesh.indices).toHaveLength(mesh.triangleCount * 3);
    expect(Math.max(...mesh.positions)).toBe(30);
    expect(Math.min(...mesh.positions)).toBe(0);
  });

  it("creates and tessellates a cylinder through Open CASCADE WASM", async () => {
    const mesh = await createOcctCylinderMeshSpike({
      radius: 10,
      height: 30
    });

    expect(mesh.primitive).toBe("cylinder");
    expect(mesh.faceCount).toBeGreaterThanOrEqual(3);
    expect(mesh.vertexCount).toBeGreaterThan(0);
    expect(mesh.triangleCount).toBeGreaterThan(0);
    expect(mesh.positions).toBeInstanceOf(Float32Array);
    expect(mesh.indices).toBeInstanceOf(Uint32Array);
    expect(mesh.positions).toHaveLength(mesh.vertexCount * 3);
    expect(mesh.indices).toHaveLength(mesh.triangleCount * 3);
  });
});

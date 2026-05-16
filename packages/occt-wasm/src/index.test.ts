import { describe, expect, it } from "vitest";
import {
  createOcctBoxMesh,
  createOcctConeMesh,
  createOcctCylinderMesh,
  createOcctSphereMesh,
  createOcctTorusMesh
} from "./index";

describe("occt-wasm", () => {
  it("creates and tessellates a box through Open CASCADE WASM", async () => {
    const mesh = await createOcctBoxMesh({
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
    const mesh = await createOcctCylinderMesh({
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

  it("creates and tessellates a sphere through Open CASCADE WASM", async () => {
    const mesh = await createOcctSphereMesh({
      radius: 10
    });

    expect(mesh.primitive).toBe("sphere");
    expect(mesh.faceCount).toBeGreaterThan(0);
    expect(mesh.vertexCount).toBeGreaterThan(0);
    expect(mesh.triangleCount).toBeGreaterThan(0);
    expect(mesh.positions).toBeInstanceOf(Float32Array);
    expect(mesh.indices).toBeInstanceOf(Uint32Array);
    expect(mesh.positions).toHaveLength(mesh.vertexCount * 3);
    expect(mesh.indices).toHaveLength(mesh.triangleCount * 3);
  });

  it("creates and tessellates cone and torus primitives through Open CASCADE WASM", async () => {
    const cone = await createOcctConeMesh({
      radius: 2,
      height: 5
    });
    const torus = await createOcctTorusMesh({
      majorRadius: 3,
      minorRadius: 0.5
    });

    expect(cone.primitive).toBe("cone");
    expect(cone.vertexCount).toBeGreaterThan(0);
    expect(cone.triangleCount).toBeGreaterThan(0);
    expect(torus.primitive).toBe("torus");
    expect(torus.vertexCount).toBeGreaterThan(0);
    expect(torus.triangleCount).toBeGreaterThan(0);
  });
});

import {
  RENDER_FOCAL_LENGTH,
  createViewportRay,
  createRenderVisualStateMap,
  type RenderSceneOptions,
  type RenderTransform,
  type RenderTriangleMesh,
  type RenderVisualStyle,
  type Vec3
} from "./index";

const vertexSource = `#version 300 es
layout(location=0) in vec3 position;
layout(location=1) in mat4 model;
layout(location=5) in vec3 color;
uniform mat4 viewProjection;
out vec3 worldPosition;
out vec3 surfaceColor;
void main(){ vec4 world=model*vec4(position,1.0); worldPosition=world.xyz; surfaceColor=color; gl_Position=viewProjection*world; }`;
const fragmentSource = `#version 300 es
precision highp float;
in vec3 worldPosition;
in vec3 surfaceColor;
uniform vec4 clipPlane;
uniform bool clipping;
uniform bool edges;
out vec4 outputColor;
void main(){
 if(clipping && dot(clipPlane.xyz,worldPosition)+clipPlane.w<0.0) discard;
 vec3 normal=normalize(cross(dFdx(worldPosition),dFdy(worldPosition)));
 float light=edges ? 0.62 : 0.64+0.36*abs(dot(normal,normalize(vec3(0.4,-0.6,1.0))));
 outputColor=vec4(surfaceColor*light,1.0);
}`;

export function gpuModelMatrix(t: RenderTransform): Float32Array {
  const [x, y, z] = t.rotation,
    [sx, sy, sz] = t.scale;
  const cx = Math.cos(x),
    cy = Math.cos(y),
    cz = Math.cos(z),
    ax = Math.sin(x),
    ay = Math.sin(y),
    az = Math.sin(z);
  return new Float32Array([
    cz * cy * sx,
    az * cy * sx,
    -ay * sx,
    0,
    (cz * ay * ax - az * cx) * sy,
    (az * ay * ax + cz * cx) * sy,
    cy * ax * sy,
    0,
    (cz * ay * cx + az * ax) * sz,
    (az * ay * cx - cz * ax) * sz,
    cy * cx * sz,
    0,
    ...t.translation,
    1
  ]);
}
export function gpuViewProjection(
  options: Pick<RenderSceneOptions, "camera" | "size">
): Float32Array {
  const { camera, size } = options;
  const ray = createViewportRay(camera, size, {
    x: size.width / 2,
    y: size.height / 2
  });
  const f = ray.direction,
    p = ray.origin;
  const length = Math.hypot(f[1], f[0]);
  const r: Vec3 = [f[1] / length, -f[0] / length, 0];
  const u: Vec3 = [r[1] * f[2], -r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const dot = (a: Vec3) => a[0] * p[0] + a[1] * p[1] + a[2] * p[2];
  const near = 0.1,
    far = Math.max(10000, camera.distance * 1000),
    a = (far + near) / (far - near),
    b = (2 * far * near) / (far - near);
  const xs = (2 * RENDER_FOCAL_LENGTH) / size.width,
    ys = (2 * RENDER_FOCAL_LENGTH) / size.height;
  return new Float32Array([
    r[0] * xs,
    u[0] * ys,
    f[0] * a,
    f[0],
    r[1] * xs,
    u[1] * ys,
    f[1] * a,
    f[1],
    r[2] * xs,
    u[2] * ys,
    f[2] * a,
    f[2],
    -dot(r) * xs,
    -dot(u) * ys,
    -dot(f) * a - b,
    -dot(f)
  ]);
}
interface MeshBuffers {
  positions: WebGLBuffer;
  indices: WebGLBuffer;
  edges?: WebGLBuffer;
  instances: WebGLBuffer;
  indexCount: number;
  edgeCount: number;
  key: RenderTriangleMesh["indices"];
}
/** Shared display only: immutable definition buffers, hardware-instanced poses.
 * CADOps, exact topology and the existing CPU picking authority are unchanged. */
export function createGpuMeshRenderer(canvas: HTMLCanvasElement) {
  const fail = (stage: string, error: unknown) => {
    canvas.dataset.gpuStatus = stage;
    canvas.dataset.gpuError =
      error instanceof Error ? error.message : String(error);
  };
  let context: WebGL2RenderingContext | null;
  try {
    context = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false
    });
  } catch (error) {
    fail("context-unavailable", error);
    return undefined;
  }
  if (!context) {
    fail(
      "context-unavailable",
      "WebGL 2 context is unavailable in this browser."
    );
    return undefined;
  }
  const gl = context;
  const shaders: WebGLShader[] = [];
  const compile = (kind: number, source: string) => {
    const shader = gl.createShader(kind);
    if (!shader) throw new Error("GPU shader unavailable");
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(shader) ?? "GPU shader failed");
    return shader;
  };
  const program = gl.createProgram();
  if (!program) {
    fail("program-failed", "GPU program allocation failed.");
    return undefined;
  }
  try {
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(
        gl.getProgramInfoLog(program) || "GPU program linking failed."
      );
  } catch (error) {
    shaders.forEach((s) => gl.deleteShader(s));
    gl.deleteProgram(program);
    fail("shader-failed", error);
    return undefined;
  }
  shaders.forEach((s) => gl.deleteShader(s));
  canvas.dataset.gpuStatus = "ready";
  delete canvas.dataset.gpuError;
  const locations = {
    view: gl.getUniformLocation(program, "viewProjection"),
    clip: gl.getUniformLocation(program, "clipPlane"),
    clipping: gl.getUniformLocation(program, "clipping"),
    edges: gl.getUniformLocation(program, "edges")
  };
  type GeometryKey = {
    readonly vertices: RenderTriangleMesh["vertices"];
    readonly indices: RenderTriangleMesh["indices"];
    readonly edges: NonNullable<RenderTriangleMesh["edgeSegments"]>;
  };
  const emptyEdges: NonNullable<RenderTriangleMesh["edgeSegments"]> = [];
  const keys = new WeakMap<
    RenderTriangleMesh["vertices"],
    WeakMap<
      RenderTriangleMesh["indices"],
      WeakMap<NonNullable<RenderTriangleMesh["edgeSegments"]>, GeometryKey>
    >
  >();
  const keyFor = (mesh: RenderTriangleMesh) => {
    let indices = keys.get(mesh.vertices);
    if (!indices) {
      indices = new WeakMap();
      keys.set(mesh.vertices, indices);
    }
    let byEdges = indices.get(mesh.indices);
    if (!byEdges) {
      byEdges = new WeakMap();
      indices.set(mesh.indices, byEdges);
    }
    const edges = mesh.edgeSegments ?? emptyEdges;
    let key = byEdges.get(edges);
    if (!key) {
      key = { vertices: mesh.vertices, indices: mesh.indices, edges };
      byEdges.set(edges, key);
    }
    return key;
  };
  const cache = new Map<GeometryKey, MeshBuffers>();
  let uploads = 0;
  let disposed = false,
    failed = false;
  const allocatedBuffers = new Set<WebGLBuffer>();
  function buffer(target: number, data: Float32Array | Uint32Array) {
    const result = gl!.createBuffer();
    if (!result) throw new Error("GPU buffer allocation failed");
    allocatedBuffers.add(result);
    gl!.bindBuffer(target, result);
    gl!.bufferData(target, data, gl!.STATIC_DRAW);
    return result;
  }
  function release(value: MeshBuffers) {
    for (const b of [
      value.positions,
      value.indices,
      value.edges,
      value.instances
    ])
      if (b && allocatedBuffers.delete(b)) gl!.deleteBuffer(b);
  }
  function releaseAll() {
    for (const value of allocatedBuffers) gl.deleteBuffer(value);
    allocatedBuffers.clear();
    cache.clear();
  }
  return {
    draw(options: RenderSceneOptions, ratio: number): boolean {
      if (disposed || failed) return false;
      if (gl.isContextLost()) {
        canvas.dataset.gpuStatus = "context-lost";
        return false;
      }
      try {
        const started = performance.now();
        const groups = new Map<GeometryKey, RenderTriangleMesh[]>();
        for (const mesh of options.meshes ?? [])
          if (
            mesh.source !== "sketch" &&
            !mesh.presentation &&
            mesh.indices.length
          ) {
            const key = keyFor(mesh);
            let group = groups.get(key);
            if (!group) {
              group = [];
              groups.set(key, group);
            }
            group.push(mesh);
          }
        if (!groups.size) {
          cache.forEach(release);
          cache.clear();
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          canvas.dataset.gpuStatus = "empty";
          canvas.dataset.gpuMetrics = JSON.stringify({
            definitions: 0,
            instances: 0,
            uploads,
            inputMeshes: options.meshes?.length ?? 0,
            presentationMeshes:
              options.meshes?.filter((mesh) => mesh.presentation).length ?? 0
          });
          return false;
        }
        const width = Math.round(options.size.width * ratio),
          height = Math.round(options.size.height * ratio);
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.disable(gl.BLEND);
        gl.disable(gl.CULL_FACE);
        gl.uniformMatrix4fv(locations.view, false, gpuViewProjection(options));
        const clip = options.clipPlane;
        gl.uniform1i(locations.clipping, clip ? 1 : 0);
        if (clip)
          gl.uniform4f(
            locations.clip,
            ...clip.normal,
            -clip.normal.reduce((sum, v, i) => sum + v * clip.origin[i]!, 0)
          );
        const active = new Set<GeometryKey>();
        const styles = createRenderVisualStateMap(options);
        let instanceCount = 0,
          triangles = 0;
        for (const [key, meshes] of groups) {
          const vertices = key.vertices;
          const mesh = meshes[0]!;
          active.add(key);
          let buffers = cache.get(key);
          if (buffers?.key !== mesh.indices) {
            if (buffers) release(buffers);
            buffers = undefined;
          }
          if (!buffers) {
            const edgePoints = new Float32Array(
              key.edges.flatMap((e) => [...e.start, ...e.end])
            );
            buffers = {
              positions: buffer(
                gl.ARRAY_BUFFER,
                new Float32Array(vertices.flat())
              ),
              indices: buffer(
                gl.ELEMENT_ARRAY_BUFFER,
                new Uint32Array(mesh.indices)
              ),
              instances: buffer(gl.ARRAY_BUFFER, new Float32Array()),
              indexCount: mesh.indices.length,
              edgeCount: edgePoints.length / 3,
              key: mesh.indices,
              ...(edgePoints.length
                ? { edges: buffer(gl.ARRAY_BUFFER, edgePoints) }
                : {})
            };
            cache.set(key, buffers);
            uploads++;
          }
          const instances = new Float32Array(meshes.length * 19);
          for (const [i, item] of meshes.entries()) {
            instances.set(gpuModelMatrix(item.transform), i * 19);
            const own = styles.get(item.id),
              parent = item.parentId ? styles.get(item.parentId) : undefined;
            const has = (state: keyof RenderVisualStyle) =>
              own?.[state] || parent?.[state];
            const color: Vec3 = has("failed")
              ? [0.9, 0.23, 0.23]
              : has("warning")
                ? [0.72, 0.48, 0.12]
                : has("commandTarget")
                  ? [0.18, 0.52, 0.35]
                  : has("selected")
                    ? [1, 0.65, 0.23]
                    : has("pending")
                      ? [0.55, 0.44, 0.18]
                      : has("hover")
                        ? [0.5, 0.8, 1]
                        : (item.color ?? [0.61, 0.73, 0.8]);
            instances.set(color, i * 19 + 16);
          }
          gl.bindBuffer(gl.ARRAY_BUFFER, buffers.instances);
          gl.bufferData(gl.ARRAY_BUFFER, instances, gl.DYNAMIC_DRAW);
          for (let column = 0; column < 4; column++) {
            gl.enableVertexAttribArray(1 + column);
            gl.vertexAttribPointer(
              1 + column,
              4,
              gl.FLOAT,
              false,
              76,
              column * 16
            );
            gl.vertexAttribDivisor(1 + column, 1);
          }
          gl.enableVertexAttribArray(5);
          gl.vertexAttribPointer(5, 3, gl.FLOAT, false, 76, 64);
          gl.vertexAttribDivisor(5, 1);
          gl.bindBuffer(gl.ARRAY_BUFFER, buffers.positions);
          gl.enableVertexAttribArray(0);
          gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
          gl.vertexAttribDivisor(0, 0);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
          gl.uniform1i(locations.edges, 0);
          gl.enable(gl.POLYGON_OFFSET_FILL);
          gl.polygonOffset(1, 1);
          gl.drawElementsInstanced(
            gl.TRIANGLES,
            buffers.indexCount,
            gl.UNSIGNED_INT,
            0,
            meshes.length
          );
          gl.disable(gl.POLYGON_OFFSET_FILL);
          if (buffers.edges) {
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.edges);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
            gl.uniform1i(locations.edges, 1);
            gl.drawArraysInstanced(
              gl.LINES,
              0,
              buffers.edgeCount,
              meshes.length
            );
          }
          instanceCount += meshes.length;
          triangles += (buffers.indexCount / 3) * meshes.length;
        }
        for (const [key, value] of cache)
          if (!active.has(key)) {
            release(value);
            cache.delete(key);
          }
        canvas.dataset.gpuMetrics = JSON.stringify({
          definitions: cache.size,
          instances: instanceCount,
          triangles,
          uploads,
          submitMs: performance.now() - started
        });
        canvas.dataset.gpuStatus = "rendering";
        return true;
      } catch (error) {
        releaseAll();
        failed = true;
        fail("draw-failed", error);
        return false;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      releaseAll();
      gl.deleteProgram(program);
      canvas.dataset.gpuStatus = "disposed";
    }
  };
}

import { describe, expect, it } from "vitest";
import {
  createRenderVisualStateMap,
  createDefaultCamera,
  createViewportRay,
  orbitCamera,
  panCamera,
  pickExactRenderBodies,
  pickPrimitive,
  pickRenderScene,
  projectPoint,
  renderCanvasScene,
  rendererPackage,
  type RenderExactPickBody,
  zoomCamera
} from "./index";

describe("renderer", () => {
  it("exports package status", () => {
    expect(rendererPackage).toEqual({
      name: "@web-cad/renderer",
      status: "ready"
    });
  });

  it("projects a world point into viewport space", () => {
    const projected = projectPoint([0, 0, 0], createDefaultCamera(), {
      width: 800,
      height: 600
    });

    expect(projected?.x).toBeGreaterThan(0);
    expect(projected?.x).toBeLessThan(800);
    expect(projected?.y).toBeGreaterThan(0);
    expect(projected?.y).toBeLessThan(600);
    expect(projected?.depth).toBeGreaterThan(0);
  });

  it("creates a viewport ray through a projected world point", () => {
    const camera = createDefaultCamera();
    const size = { width: 800, height: 600 };
    const worldPoint = [0.5, 4, 0] as const;
    const projected = projectPoint(worldPoint, camera, size);

    expect(projected).toBeDefined();
    if (!projected) return;
    const ray = createViewportRay(camera, size, projected);
    const zDistance = -ray.origin[2] / ray.direction[2];
    const intersection = ray.origin.map(
      (value, index) => value + ray.direction[index]! * zDistance
    );
    expect(intersection[0]).toBeCloseTo(worldPoint[0], 12);
    expect(intersection[1]).toBeCloseTo(worldPoint[1], 12);
    expect(intersection[2]).toBeCloseTo(worldPoint[2], 12);
  });

  it("updates orbit, pan, and zoom camera state", () => {
    const camera = createDefaultCamera();
    const orbited = orbitCamera(camera, { x: 20, y: -10 });
    const panned = panCamera(
      orbited,
      { x: 12, y: -8 },
      { width: 800, height: 600 }
    );
    const zoomed = zoomCamera(panned, -120);

    expect(orbited.yaw).not.toBe(camera.yaw);
    expect(orbited.pitch).not.toBe(camera.pitch);
    expect(panned.target).not.toEqual(orbited.target);
    expect(zoomed.distance).toBeLessThan(panned.distance);
  });

  it("picks a primitive by projected bounds", () => {
    const selectedId = pickPrimitive(
      [
        {
          id: "box_1",
          kind: "box",
          dimensions: { width: 4, height: 4, depth: 4 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      ],
      createDefaultCamera(),
      { width: 800, height: 600 },
      { x: 400, y: 300 }
    );

    expect(selectedId).toBe("box_1");
  });

  it("does not double-apply scale when picking box primitives", () => {
    const camera = createDefaultCamera();
    const size = { width: 800, height: 600 };
    const outsideCorrectBox = projectPoint([3.5, 0, 0], camera, size);

    expect(outsideCorrectBox).toBeDefined();

    const selectedId = pickPrimitive(
      [
        {
          id: "box_1",
          kind: "box",
          dimensions: { width: 2, height: 2, depth: 2 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [2, 1, 1]
          }
        }
      ],
      camera,
      size,
      {
        x: outsideCorrectBox?.x ?? 0,
        y: outsideCorrectBox?.y ?? 0
      }
    );

    expect(selectedId).toBeUndefined();
  });

  it("picks a sphere primitive by projected bounds", () => {
    const selectedId = pickPrimitive(
      [
        {
          id: "sphere_1",
          kind: "sphere",
          dimensions: { radius: 2 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      ],
      createDefaultCamera(),
      { width: 800, height: 600 },
      { x: 400, y: 300 }
    );

    expect(selectedId).toBe("sphere_1");
  });

  it("picks cone and torus primitives by projected bounds", () => {
    const camera = createDefaultCamera();
    const size = { width: 800, height: 600 };

    expect(
      pickPrimitive(
        [
          {
            id: "cone_1",
            kind: "cone",
            dimensions: { radius: 2, height: 4 },
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1]
            }
          }
        ],
        camera,
        size,
        { x: 400, y: 300 }
      )
    ).toBe("cone_1");

    expect(
      pickPrimitive(
        [
          {
            id: "torus_1",
            kind: "torus",
            dimensions: { majorRadius: 2, minorRadius: 0.4 },
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1]
            }
          }
        ],
        camera,
        size,
        { x: 400, y: 300 }
      )
    ).toBe("torus_1");
  });

  it("picks a mesh by projected bounds", () => {
    const selectedId = pickRenderScene(
      [],
      [
        {
          id: "mesh_1",
          kind: "mesh",
          vertices: [
            [-2, -2, 0],
            [2, -2, 0],
            [2, 2, 0],
            [-2, 2, 0]
          ],
          indices: [0, 1, 2, 0, 2, 3],
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      ],
      createDefaultCamera(),
      { width: 800, height: 600 },
      { x: 400, y: 300 }
    );

    expect(selectedId).toBe("mesh_1");
  });

  it("keeps preview meshes out of renderer scene picking", () => {
    const preview = {
      id: "preview_mesh",
      kind: "mesh" as const,
      vertices: [
        [-2, -2, 0],
        [2, -2, 0],
        [2, 2, 0],
        [-2, 2, 0]
      ] as const,
      indices: [0, 1, 2, 0, 2, 3],
      transform: {
        translation: [0, 0, 0] as const,
        rotation: [0, 0, 0] as const,
        scale: [1, 1, 1] as const
      },
      presentation: "preview" as const
    };

    expect(
      pickRenderScene(
        [],
        [preview],
        createDefaultCamera(),
        { width: 800, height: 600 },
        { x: 400, y: 300 }
      )
    ).toBeUndefined();

    expect(
      pickRenderScene(
        [],
        [{ ...preview, presentation: "subdued" }],
        createDefaultCamera(),
        { width: 800, height: 600 },
        { x: 400, y: 300 }
      )
    ).toBe("preview_mesh");
  });

  it("can pick only derived edge segments instead of a mesh bounding box", () => {
    const camera = createDefaultCamera();
    const size = { width: 800, height: 600 };
    const mesh = {
      id: "sketch:sketch_1:entity:arc_1",
      kind: "mesh" as const,
      vertices: [
        [0, 0, 0],
        [2, 0, 0]
      ] as const,
      indices: [],
      transform: {
        translation: [0, 0, 0] as const,
        rotation: [0, 0, 0] as const,
        scale: [1, 1, 1] as const
      },
      edgeSegments: [{ start: [0, 0, 0] as const, end: [2, 0, 0] as const }],
      pickMode: "edgeSegments" as const
    };
    const onEdge = projectPoint([1, 0, 0], camera, size);
    const insideBoundsAwayFromEdge = projectPoint([1, 1, 0], camera, size);

    expect(onEdge).toBeDefined();
    expect(insideBoundsAwayFromEdge).toBeDefined();
    expect(
      pickRenderScene([], [mesh], camera, size, {
        x: onEdge?.x ?? 0,
        y: onEdge?.y ?? 0
      })
    ).toBe(mesh.id);
    expect(
      pickRenderScene([], [mesh], camera, size, {
        x: insideBoundsAwayFromEdge?.x ?? 0,
        y: insideBoundsAwayFromEdge?.y ?? 0
      })
    ).toBeUndefined();
  });

  it("interpolates edge depth at the closest projected crossing", () => {
    const camera = {
      target: [0, 0, 0] as const,
      yaw: 0,
      pitch: 0,
      distance: 10
    };
    const size = { width: 800, height: 600 };
    const transform = {
      translation: [0, 0, 0] as const,
      rotation: [0, 0, 0] as const,
      scale: [1, 1, 1] as const
    };
    const crossingMeshes = [
      {
        id: "varying-depth",
        kind: "mesh" as const,
        vertices: [],
        indices: [],
        transform,
        edgeSegments: [
          {
            start: [-2, -5, 0] as const,
            end: [2, 5, 0] as const
          }
        ],
        pickMode: "edgeSegments" as const
      },
      {
        id: "near-at-crossing",
        kind: "mesh" as const,
        vertices: [],
        indices: [],
        transform,
        edgeSegments: [
          {
            start: [-2, 0, 0] as const,
            end: [2, 0, 0] as const
          }
        ],
        pickMode: "edgeSegments" as const
      }
    ];

    expect(
      pickRenderScene([], crossingMeshes, camera, size, { x: 400, y: 300 })
    ).toBe("near-at-crossing");
  });

  it("orders edge and body hits by their projected depth", () => {
    const camera = {
      target: [0, 0, 0] as const,
      yaw: 0,
      pitch: 0,
      distance: 10
    };
    const size = { width: 800, height: 600 };
    const box = {
      id: "body",
      kind: "box" as const,
      dimensions: { width: 4, height: 2, depth: 4 },
      transform: {
        translation: [0, 0, 0] as const,
        rotation: [0, 0, 0] as const,
        scale: [1, 1, 1] as const
      }
    };
    const createEdge = (id: string, y: number) => ({
      id,
      kind: "mesh" as const,
      vertices: [],
      indices: [],
      transform: {
        translation: [0, 0, 0] as const,
        rotation: [0, 0, 0] as const,
        scale: [1, 1, 1] as const
      },
      edgeSegments: [{ start: [-1, y, 0] as const, end: [1, y, 0] as const }],
      pickMode: "edgeSegments" as const
    });

    expect(
      pickRenderScene([box], [createEdge("edge-behind", 3)], camera, size, {
        x: 400,
        y: 300
      })
    ).toBe("body");
    expect(
      pickRenderScene([box], [createEdge("edge-in-front", -3)], camera, size, {
        x: 400,
        y: 300
      })
    ).toBe("edge-in-front");
  });

  it("binds depth-ordered face, edge, vertex, and body hits to exact entities", () => {
    const camera = exactPickCamera();
    const size = { width: 800, height: 600 };
    const result = pickExactRenderBodies(
      [createExactPickBody("near", -2), createExactPickBody("far", 2)],
      camera,
      size,
      { x: 400, y: 300 }
    );

    expect(result).toMatchObject({
      status: "ready",
      examined: 4,
      truncated: false
    });
    expect(
      result.candidates.slice(0, 4).map((candidate) => candidate.bodyId)
    ).toEqual(["near", "near", "near", "near"]);
    expect(
      result.candidates.slice(0, 4).map((candidate) => candidate.entityKind)
    ).toEqual(["face", "edge", "vertex", "body"]);
    expect(
      result.candidates
        .filter((candidate) => candidate.bodyId === "far")
        .every((candidate) => candidate.occluded)
    ).toBe(true);
    expect(result.candidates[0]).toMatchObject({
      bodySourceIdentitySignature: "source:near",
      topologySignature: "topology:near",
      localId: "face:near",
      entitySignature: "face-signature:near"
    });
  });

  it("omits clipped exact candidates before depth ordering", () => {
    const result = pickExactRenderBodies(
      [createExactPickBody("near", -2), createExactPickBody("clipped", 2)],
      exactPickCamera(),
      { width: 800, height: 600 },
      { x: 400, y: 300 },
      "auto",
      { origin: [0, 0, 0], normal: [0, -1, 0] }
    );

    expect(result.candidates.map((candidate) => candidate.bodyId)).toEqual([
      "near",
      "near",
      "near",
      "near"
    ]);
    expect(result.candidates.every((candidate) => !candidate.occluded)).toBe(
      true
    );
  });

  it("clips exact edge segments at the visible plane boundary", () => {
    const camera = exactPickCamera();
    const size = { width: 800, height: 600 };
    const body = createExactPickBody("body", 0);
    const plane = { origin: [0, 0, 0] as const, normal: [1, 0, 0] as const };
    const visible = projectPoint([0.5, 0, 0], camera, size)!;
    const clipped = projectPoint([-0.5, 0, 0], camera, size)!;

    expect(
      pickExactRenderBodies([body], camera, size, visible, "edge", plane)
        .candidates
    ).toHaveLength(1);
    expect(
      pickExactRenderBodies([body], camera, size, clipped, "edge", plane)
        .candidates
    ).toHaveLength(0);
  });

  it("clips drawing and exact picks with the same display section plane", () => {
    const camera = exactPickCamera();
    const size = { width: 800, height: 600 };
    const body = createExactPickBody("body", 0);
    const plane = { origin: [0, 0, 0] as const, normal: [1, 0, 0] as const };
    const visible = projectPoint([0.5, 0, 0], camera, size)!;
    const clipped = projectPoint([-0.5, 0, 0], camera, size)!;
    const unclipped = createRecordingCanvasContext();
    const sectioned = createRecordingCanvasContext();

    renderCanvasScene(unclipped.context, {
      camera,
      size,
      primitives: [],
      meshes: [body.mesh]
    });
    renderCanvasScene(sectioned.context, {
      camera,
      size,
      primitives: [],
      meshes: [body.mesh],
      clipPlane: plane
    });

    expect(
      pickExactRenderBodies([body], camera, size, visible, "auto", plane)
        .candidates.length
    ).toBeGreaterThan(0);
    expect(
      pickExactRenderBodies([body], camera, size, clipped, "auto", plane)
        .candidates
    ).toHaveLength(0);
    expect(sectioned.fills.length).toBeGreaterThan(0);
    expect(sectioned.fills.length).toBeLessThan(unclipped.fills.length);
  });

  it("keeps CSS-pixel edge tolerance stable across camera zoom", () => {
    const size = { width: 800, height: 600 };
    const body = createExactPickBody("body", 0);
    for (const distance of [10, 20]) {
      const camera = { ...exactPickCamera(), distance };
      const center = projectPoint([0, 0, 0], camera, size);
      expect(center).toBeDefined();
      const result = pickExactRenderBodies(
        [body],
        camera,
        size,
        { x: (center?.x ?? 0) + 9, y: center?.y ?? 0 },
        "edge"
      );
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0]).toMatchObject({ entityKind: "edge" });
    }
  });

  it("rejects by body bounds and hard-stops at 250,000 triangle examinations", () => {
    const camera = exactPickCamera();
    const size = { width: 800, height: 600 };
    const offscreen = createExactPickBody("offscreen", 0, {
      translation: [100, 0, 0]
    });
    expect(
      pickExactRenderBodies([offscreen], camera, size, { x: 400, y: 300 })
    ).toMatchObject({ status: "ready", examined: 0 });

    const oversized = createExactPickBody("oversized", 0);
    const triangleCount = 250_001;
    const indices = Array.from(
      { length: triangleCount * 3 },
      (_, index) => index % 3
    );
    const result = pickExactRenderBodies(
      [
        {
          mesh: { ...oversized.mesh, indices },
          pickMap: {
            ...oversized.pickMap,
            meshTriangleCount: triangleCount,
            faceTriangleRanges: new Uint32Array([0, triangleCount])
          }
        }
      ],
      camera,
      size,
      { x: 400, y: 300 }
    );

    expect(result).toEqual({
      status: "resource-limited",
      candidates: [],
      examined: 0,
      truncated: false
    });
  });

  it("keeps only the first 64 deterministic exact candidates", () => {
    const body = createExactPickBody("body", 0);
    const vertices = Array.from({ length: 65 }, (_, index) => ({
      localId: `vertex:${String(index).padStart(2, "0")}`,
      entitySignature: `vertex-signature:${index}`
    }));
    const result = pickExactRenderBodies(
      [
        {
          mesh: body.mesh,
          pickMap: {
            ...body.pickMap,
            vertices,
            vertexPoints: new Float64Array(vertices.length * 3)
          }
        }
      ],
      exactPickCamera(),
      { width: 800, height: 600 },
      { x: 400, y: 300 },
      "vertex"
    );

    expect(result).toMatchObject({ status: "ready", truncated: true });
    expect(result.candidates).toHaveLength(64);
    expect(result.candidates[0]?.localId).toBe("vertex:00");
    expect(result.candidates.at(-1)?.localId).toBe("vertex:63");
  });

  it("falls back before scanning more than 250,000 exact display points", () => {
    const body = createExactPickBody("body", 0);
    const pointCount = 250_001;
    const result = pickExactRenderBodies(
      [
        {
          mesh: body.mesh,
          pickMap: {
            ...body.pickMap,
            edgePointRanges: new Uint32Array([0, pointCount]),
            edgePoints: new Float64Array(pointCount * 3)
          }
        }
      ],
      exactPickCamera(),
      { width: 800, height: 600 },
      { x: 400, y: 300 },
      "edge"
    );

    expect(result).toMatchObject({
      status: "resource-limited",
      candidates: [],
      examined: 0
    });
  });

  it("renders identity-bound face, edge, and vertex visual states", () => {
    const recorder = createRecordingCanvasContext();
    const body = createExactPickBody("body", 0);

    renderCanvasScene(recorder.context, {
      camera: exactPickCamera(),
      size: { width: 800, height: 600 },
      primitives: [],
      meshes: [body.mesh],
      exactPickBodies: [body],
      exactVisualStates: [
        {
          bodyId: "body",
          bodySourceIdentitySignature: "source:body",
          topologySignature: "topology:body",
          entityKind: "face",
          localId: "face:body",
          entitySignature: "face-signature:body",
          state: "selected"
        },
        {
          bodyId: "body",
          bodySourceIdentitySignature: "source:body",
          topologySignature: "topology:body",
          entityKind: "edge",
          localId: "edge:body",
          entitySignature: "edge-signature:body",
          state: "preselection"
        },
        {
          bodyId: "body",
          bodySourceIdentitySignature: "source:body",
          topologySignature: "topology:body",
          entityKind: "vertex",
          localId: "vertex:body",
          entitySignature: "vertex-signature:body",
          state: "commandTarget"
        },
        {
          bodyId: "body",
          bodySourceIdentitySignature: "source:body",
          topologySignature: "stale",
          entityKind: "body",
          state: "failed"
        }
      ]
    });

    expect(recorder.fillStyles).toContain("rgba(242, 165, 65, 0.16)");
    expect(recorder.fillStyles).toContain("#2f855a");
    expect(recorder.fillStyles).not.toContain("rgba(180, 35, 24, 0.14)");
    expect(recorder.strokes).toContainEqual(
      expect.objectContaining({ lineWidth: 3, strokeStyle: "#188bbf" })
    );
  });

  it("renders construction edges with the restrained dashed vocabulary", () => {
    const recorder = createRecordingCanvasContext();

    renderCanvasScene(recorder.context, {
      camera: createDefaultCamera(),
      size: { width: 800, height: 600 },
      primitives: [],
      meshes: [
        {
          id: "sketch:sketch_1:entity:arc_1",
          kind: "mesh",
          vertices: [
            [0, 0, 0],
            [1, 0, 0]
          ],
          indices: [],
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          },
          edgeSegments: [{ start: [0, 0, 0], end: [1, 0, 0] }],
          lineStyle: "construction"
        }
      ]
    });

    expect(recorder.strokes.at(-1)).toMatchObject({
      lineDash: [5, 4],
      lineWidth: 2,
      strokeStyle: "#6f7c86"
    });
  });

  it("batches consecutive sketch meshes into one canvas stroke", () => {
    const recorder = createRecordingCanvasContext();
    const transform = {
      translation: [0, 0, 0] as const,
      rotation: [0, 0, 0] as const,
      scale: [1, 1, 1] as const
    };

    renderCanvasScene(recorder.context, {
      camera: createDefaultCamera(),
      size: { width: 800, height: 600 },
      primitives: [],
      meshes: [
        {
          id: "sketch:sketch_1:entity:circle_1",
          kind: "mesh",
          vertices: [],
          indices: [],
          transform,
          source: "sketch",
          edgeSegments: [
            { start: [0, 0, 0], end: [1, 0, 0] },
            { start: [1, 0, 0], end: [1, 1, 0] },
            { start: [1, 1, 0], end: [0, 1, 0] }
          ]
        },
        {
          id: "sketch:sketch_1:entity:circle_2",
          kind: "mesh",
          vertices: [],
          indices: [],
          transform,
          source: "sketch",
          edgeSegments: [
            { start: [2, 0, 0], end: [3, 0, 0] },
            { start: [3, 0, 0], end: [3, 1, 0] },
            { start: [3, 1, 0], end: [2, 1, 0] }
          ]
        }
      ]
    });

    const semanticStrokes = recorder.strokes.filter(
      (stroke) => stroke.strokeStyle === "#235f86"
    );
    expect(semanticStrokes).toHaveLength(1);
    expect(semanticStrokes[0]?.points).toHaveLength(12);
  });

  it("renders a progressive mesh layer without clearing or redrawing the grid", () => {
    const recorder = createRecordingCanvasContext();

    renderCanvasScene(recorder.context, {
      camera: createDefaultCamera(),
      size: { width: 800, height: 600 },
      primitives: [],
      preserveDrawingBuffer: true,
      meshes: [
        {
          id: "sketch:sketch_1:entity:line_1",
          kind: "mesh",
          vertices: [],
          indices: [],
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          },
          source: "sketch",
          edgeSegments: [{ start: [0, 0, 0], end: [1, 0, 0] }]
        }
      ]
    });

    expect(recorder.strokes).toHaveLength(1);
    expect(recorder.strokes[0]?.strokeStyle).toBe("#235f86");
  });

  it("applies sketch-level visual state to child entity meshes", () => {
    const recorder = createRecordingCanvasContext();

    renderCanvasScene(recorder.context, {
      camera: createDefaultCamera(),
      size: { width: 800, height: 600 },
      primitives: [],
      meshes: [
        {
          id: "entity",
          parentId: "sketch",
          kind: "mesh",
          vertices: [],
          indices: [],
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          },
          edgeSegments: [{ start: [0, 0, 0], end: [1, 0, 0] }]
        }
      ],
      selectedId: "sketch"
    });

    expect(recorder.strokes.some((stroke) => stroke.lineWidth === 7)).toBe(
      true
    );
    expect(recorder.strokes.at(-1)).toMatchObject({
      lineWidth: 3,
      strokeStyle: "#f2a541"
    });
  });

  it("renders selected meshes without semantic edges as one projected outline", () => {
    const recorder = createRecordingCanvasContext();

    renderCanvasScene(recorder.context, {
      camera: createDefaultCamera(),
      size: { width: 800, height: 600 },
      primitives: [],
      meshes: [
        {
          id: "mesh_without_edges",
          kind: "mesh",
          vertices: [
            [-2, -2, 0],
            [2, -2, 0],
            [2, 2, 0],
            [-2, 2, 0]
          ],
          indices: [0, 1, 2, 0, 2, 3],
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      ],
      selectedId: "mesh_without_edges"
    });

    const selectedMeshStrokes = recorder.strokes.filter(
      (stroke) => stroke.lineWidth === 3
    );
    expect(selectedMeshStrokes).toHaveLength(1);
    const selectedMeshStroke = selectedMeshStrokes[0];
    expect(selectedMeshStroke).toBeDefined();
    expect(selectedMeshStroke?.closed).toBe(true);
    expect(selectedMeshStroke?.points).toHaveLength(4);
  });

  it("renders preview meshes with a distinct ghost style and no pending state", () => {
    const recorder = createRecordingCanvasContext();
    const body = createExactPickBody("preview", 0);

    renderCanvasScene(recorder.context, {
      camera: exactPickCamera(),
      size: { width: 800, height: 600 },
      primitives: [],
      meshes: [{ ...body.mesh, presentation: "preview" }],
      visualStates: [
        {
          targetId: body.mesh.id,
          targetKind: "body",
          state: "pending"
        }
      ]
    });

    expect(recorder.fillStyles).toContain("rgba(40, 121, 170, 0.16)");
    expect(recorder.fillStyles).not.toContain("rgba(139, 111, 47, 0.12)");
    expect(recorder.strokes).toContainEqual(
      expect.objectContaining({
        lineWidth: 2,
        strokeStyle: "rgba(40, 121, 170, 0.3)"
      })
    );
  });

  it("subdues a replaced committed mesh without changing default mesh styling", () => {
    const defaultRecorder = createRecordingCanvasContext();
    const subduedRecorder = createRecordingCanvasContext();
    const body = createExactPickBody("body", 0);

    renderCanvasScene(defaultRecorder.context, {
      camera: exactPickCamera(),
      size: { width: 800, height: 600 },
      primitives: [],
      meshes: [body.mesh]
    });
    renderCanvasScene(subduedRecorder.context, {
      camera: exactPickCamera(),
      size: { width: 800, height: 600 },
      primitives: [],
      meshes: [{ ...body.mesh, presentation: "subdued" }]
    });

    expect(defaultRecorder.fillStyles).toContain(
      "rgba(47, 111, 151, 0.08)"
    );
    expect(defaultRecorder.strokes).toContainEqual(
      expect.objectContaining({
        lineWidth: 1.25,
        strokeStyle: "rgba(53, 75, 91, 0.22)"
      })
    );
    expect(subduedRecorder.fillStyles).toContain("rgba(53, 75, 91, 0.035)");
    expect(subduedRecorder.strokes).toContainEqual(
      expect.objectContaining({
        lineWidth: 1.25,
        strokeStyle: "rgba(53, 75, 91, 0.12)"
      })
    );
  });

  it("skips malformed mesh faces without discarding valid triangles", () => {
    const recorder = createRecordingCanvasContext();

    renderCanvasScene(recorder.context, {
      camera: createDefaultCamera(),
      size: { width: 800, height: 600 },
      primitives: [],
      meshes: [
        {
          id: "partially_malformed_mesh",
          kind: "mesh",
          vertices: [
            [-2, -2, 0],
            [2, -2, 0],
            [0, 2, 0]
          ],
          indices: [0, 1, 2, 0, 2, 99],
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      ]
    });

    expect(recorder.fills).toHaveLength(1);
    expect(recorder.fills[0]).toHaveLength(3);
  });

  it("normalizes semantic display visual states without storing generated refs", () => {
    const states = createRenderVisualStateMap({
      selectedId: "body_rect",
      hoveredId: "body_hover",
      visualStates: [
        {
          targetId: "body_rect",
          targetKind: "face",
          state: "commandTarget"
        },
        {
          targetId: "body_rect",
          targetKind: "face",
          state: "pending"
        },
        {
          targetId: "body_warning",
          targetKind: "body",
          state: "warning"
        }
      ]
    });

    expect(states.get("body_rect")).toEqual({
      hover: false,
      selected: true,
      commandTarget: true,
      warning: false,
      pending: true,
      failed: false
    });
    expect(states.get("body_hover")?.hover).toBe(true);
    expect(states.get("body_warning")?.warning).toBe(true);
    expect(JSON.stringify([...states])).not.toContain("generated:face");
    expect(JSON.stringify([...states])).not.toContain("selection-buffer");
  });
});

function exactPickCamera() {
  return {
    target: [0, 0, 0] as const,
    yaw: 0,
    pitch: 0,
    distance: 10
  };
}

function createExactPickBody(
  bodyId: string,
  y: number,
  transform?: { readonly translation: readonly [number, number, number] }
): RenderExactPickBody {
  return {
    mesh: {
      id: bodyId,
      kind: "mesh",
      vertices: [
        [-2, 0, -2],
        [2, 0, -2],
        [2, 0, 2],
        [-2, 0, 2]
      ],
      indices: [0, 1, 2, 0, 2, 3],
      transform: {
        translation: transform?.translation ?? [0, y, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      }
    },
    pickMap: {
      version: "partbench.exact-pick-map.v1",
      bodyId,
      bodySourceIdentitySignature: `source:${bodyId}`,
      topologySignature: `topology:${bodyId}`,
      meshVertexCount: 4,
      meshTriangleCount: 2,
      faces: [
        {
          localId: `face:${bodyId}`,
          entitySignature: `face-signature:${bodyId}`
        }
      ],
      edges: [
        {
          localId: `edge:${bodyId}`,
          entitySignature: `edge-signature:${bodyId}`
        }
      ],
      vertices: [
        {
          localId: `vertex:${bodyId}`,
          entitySignature: `vertex-signature:${bodyId}`
        }
      ],
      faceTriangleRanges: new Uint32Array([0, 2]),
      edgePointRanges: new Uint32Array([0, 2]),
      edgePoints: new Float64Array([-1, 0, 0, 1, 0, 0]),
      vertexPoints: new Float64Array([0, 0, 0])
    }
  };
}

interface StrokeRecord {
  readonly closed: boolean;
  readonly lineDash: readonly number[];
  readonly lineWidth: number;
  readonly points: readonly { readonly x: number; readonly y: number }[];
  readonly strokeStyle: string;
}

function createRecordingCanvasContext(): {
  readonly context: CanvasRenderingContext2D;
  readonly fills: { readonly x: number; readonly y: number }[][];
  readonly fillStyles: readonly string[];
  readonly strokes: StrokeRecord[];
} {
  const fills: { readonly x: number; readonly y: number }[][] = [];
  const fillStyles: string[] = [];
  const strokes: StrokeRecord[] = [];
  let closed = false;
  let lineDash: number[] = [];
  let lineWidth = 1;
  let points: { x: number; y: number }[] = [];
  let fillStyle = "";
  let strokeStyle = "";

  const context = {
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {
      closed = false;
      points = [];
    },
    moveTo: (x: number, y: number) => {
      points.push({ x, y });
    },
    lineTo: (x: number, y: number) => {
      points.push({ x, y });
    },
    closePath: () => {
      closed = true;
    },
    setLineDash: (value: number[]) => {
      lineDash = [...value];
    },
    fill: () => {
      fills.push([...points]);
      fillStyles.push(fillStyle);
    },
    fillRect: () => {
      fillStyles.push(fillStyle);
    },
    stroke: () => {
      strokes.push({
        closed,
        lineDash: [...lineDash],
        lineWidth,
        points: [...points],
        strokeStyle
      });
    },
    set fillStyle(value: string) {
      fillStyle = value;
    },
    set lineCap(_value: CanvasLineCap) {},
    set lineJoin(_value: CanvasLineJoin) {},
    set lineWidth(value: number) {
      lineWidth = value;
    },
    get lineWidth() {
      return lineWidth;
    },
    set strokeStyle(value: string) {
      strokeStyle = value;
    }
  } as unknown as CanvasRenderingContext2D;

  return { context, fills, fillStyles, strokes };
}

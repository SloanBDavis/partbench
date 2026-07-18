import type {
  BoxObject,
  ConeObject,
  CylinderObject,
  SketchSnapshot,
  SphereObject,
  TorusObject
} from "@web-cad/cad-core";
import {
  pickRenderScene,
  projectPoint,
  type RenderCamera,
  type RenderEdgeSegment,
  type RenderTriangleMesh
} from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import type {
  DerivedBooleanExtrudeGeometrySource,
  DerivedEdgeFinishGeometrySource,
  DerivedExtrudeGeometrySource,
  DerivedGeometryEntry,
  DerivedHoleGeometrySource,
  DerivedRevolveGeometrySource
} from "./derivedGeometry";
import {
  createMeshDisplayEdges,
  createRenderSceneInputs,
  createSketchArcDisplayEdges,
  createSketchDisplayMeshes
} from "./renderScene";
import { createDefaultSketchDisplayFrame } from "./sketchDisplayFrames";
import {
  createSketchEntitySelectionId,
  createSketchSelectionId
} from "./sketchRenderIds";
import { getRenderObjectBounds } from "./viewportCamera";

describe("renderScene", () => {
  it("prefers a ready derived mesh over the primitive fallback", () => {
    const box = createBoxObject("box_1");
    const mesh = createMesh("box_1");
    const scene = createRenderSceneInputs(
      [box],
      new Map([
        [
          box.id,
          {
            objectId: box.id,
            objectKind: "box",
            cacheKey: "box-ready",
            status: "ready",
            mesh,
            metrics: {
              objectId: box.id,
              roundTripMs: 1,
              vertexCount: 4,
              triangleCount: 2
            }
          }
        ]
      ])
    );

    expect(scene.primitives).toEqual([]);
    expect(scene.meshes).toEqual([
      {
        ...mesh,
        edgeSegments: createMeshDisplayEdges(box)
      }
    ]);
    expect(scene.meshes[0].edgeSegments).toHaveLength(12);
  });

  it("keeps renderable IDs stable for primitive and mesh selection", () => {
    const box = createBoxObject("selected_box");
    const cylinder = createCylinderObject("selected_cylinder");
    const mesh = createMesh(box.id);
    const scene = createRenderSceneInputs(
      [box, cylinder],
      new Map([
        [
          box.id,
          {
            objectId: box.id,
            objectKind: "box",
            cacheKey: "box-ready",
            status: "ready",
            mesh,
            metrics: {
              objectId: box.id,
              roundTripMs: 1,
              vertexCount: 4,
              triangleCount: 2
            }
          }
        ]
      ])
    );

    expect(scene.meshes.map((renderable) => renderable.id)).toEqual([
      "selected_box"
    ]);
    expect(scene.meshes[0].edgeSegments).toHaveLength(12);
    expect(scene.primitives.map((renderable) => renderable.id)).toEqual([
      "selected_cylinder"
    ]);
  });

  it("adds cylinder display edges to ready derived meshes", () => {
    const cylinder = createCylinderObject("cylinder_1");
    const mesh = createMesh(cylinder.id);
    const scene = createRenderSceneInputs(
      [cylinder],
      new Map([
        [
          cylinder.id,
          {
            objectId: cylinder.id,
            objectKind: "cylinder",
            cacheKey: "cylinder-ready",
            status: "ready",
            mesh,
            metrics: {
              objectId: cylinder.id,
              roundTripMs: 1,
              vertexCount: 4,
              triangleCount: 2
            }
          }
        ]
      ])
    );

    expect(scene.primitives).toEqual([]);
    expect(scene.meshes[0].edgeSegments).toHaveLength(68);
    expect(scene.meshes[0].edgeSegments?.slice(-4)).toEqual([
      {
        start: [1, 0, 1],
        end: [1, 0, -1]
      },
      {
        start: [0, 1, 1],
        end: [0, 1, -1]
      },
      {
        start: [-1, 0, 1],
        end: [-1, 0, -1]
      },
      {
        start: [0, -1, 1],
        end: [0, -1, -1]
      }
    ]);
  });

  it("adds sphere display edges to ready derived meshes", () => {
    const sphere = createSphereObject("sphere_1");
    const mesh = createMesh(sphere.id);
    const scene = createRenderSceneInputs(
      [sphere],
      new Map([
        [
          sphere.id,
          {
            objectId: sphere.id,
            objectKind: "sphere",
            cacheKey: "sphere-ready",
            status: "ready",
            mesh,
            metrics: {
              objectId: sphere.id,
              roundTripMs: 1,
              vertexCount: 4,
              triangleCount: 2
            }
          }
        ]
      ])
    );

    expect(scene.primitives).toEqual([]);
    expect(scene.meshes[0].edgeSegments).toHaveLength(96);
    expect(scene.meshes[0].edgeSegments?.[0]).toEqual({
      start: [1, 0, 0],
      end: [0.980785280403, 0.195090322016, 0]
    });
  });

  it("adds cone and torus display edges to ready derived meshes", () => {
    const cone = createConeObject("cone_1");
    const torus = createTorusObject("torus_1");
    const scene = createRenderSceneInputs(
      [cone, torus],
      new Map([
        [
          cone.id,
          {
            objectId: cone.id,
            objectKind: "cone",
            cacheKey: "cone-ready",
            status: "ready",
            mesh: createMesh(cone.id),
            metrics: {
              objectId: cone.id,
              roundTripMs: 1,
              vertexCount: 4,
              triangleCount: 2
            }
          }
        ],
        [
          torus.id,
          {
            objectId: torus.id,
            objectKind: "torus",
            cacheKey: "torus-ready",
            status: "ready",
            mesh: createMesh(torus.id),
            metrics: {
              objectId: torus.id,
              roundTripMs: 1,
              vertexCount: 4,
              triangleCount: 2
            }
          }
        ]
      ])
    );

    expect(scene.primitives).toEqual([]);
    expect(scene.meshes[0].edgeSegments?.length).toBeGreaterThan(32);
    expect(scene.meshes[1].edgeSegments?.length).toBeGreaterThan(96);
  });

  it("keeps primitive fallback when derived geometry is unavailable", () => {
    const box = createBoxObject("box_1");
    const cylinder = createCylinderObject("cylinder_1");
    const scene = createRenderSceneInputs([box, cylinder], new Map());

    expect(scene.primitives.map((primitive) => primitive.id)).toEqual([
      "box_1",
      "cylinder_1"
    ]);
    expect(scene.meshes).toEqual([]);
  });

  it("keeps primitive fallback for pending, unsupported, and error entries", () => {
    const box = createBoxObject("box_pending");
    const cylinder = createCylinderObject("cylinder_error");
    const unsupportedBox = createBoxObject("box_unsupported");
    const entries = new Map<string, DerivedGeometryEntry>([
      [
        box.id,
        {
          objectId: box.id,
          objectKind: "box",
          cacheKey: "box-pending",
          status: "pending"
        }
      ],
      [
        cylinder.id,
        {
          objectId: cylinder.id,
          objectKind: "cylinder",
          cacheKey: "cylinder-error",
          status: "error",
          error: {
            code: "UNKNOWN_DERIVED_GEOMETRY_ERROR",
            message: "worker failed",
            stage: "unknown",
            wasmLoadStatus: "unknown",
            workerStarted: false
          }
        }
      ],
      [
        unsupportedBox.id,
        {
          objectId: unsupportedBox.id,
          objectKind: "box",
          cacheKey: "unsupported",
          status: "unsupported",
          message: "Unsupported."
        }
      ]
    ]);
    const scene = createRenderSceneInputs(
      [box, cylinder, unsupportedBox],
      entries
    );

    expect(scene.primitives.map((primitive) => primitive.id)).toEqual([
      "box_pending",
      "cylinder_error",
      "box_unsupported"
    ]);
    expect(scene.meshes).toEqual([]);
  });

  it("positions extrude primitive fallbacks from their side setting", () => {
    const sources: DerivedExtrudeGeometrySource[] = [
      createExtrudeSource("body_positive", "positive"),
      createExtrudeSource("body_negative", "negative"),
      createExtrudeSource("body_symmetric", "symmetric")
    ];
    const scene = createRenderSceneInputs([], new Map(), sources);

    expect(scene.meshes).toEqual([]);
    expect(scene.primitives).toMatchObject([
      {
        id: "body_positive",
        kind: "box",
        transform: { translation: [0, 0, 2] }
      },
      {
        id: "body_negative",
        kind: "box",
        transform: { translation: [0, 0, -2] }
      },
      {
        id: "body_symmetric",
        kind: "box",
        transform: { translation: [0, 0, 0] }
      }
    ]);
  });

  it("uses an aligned mesh fallback for attached extrude sources", () => {
    const source: DerivedExtrudeGeometrySource = {
      ...createExtrudeSource("body_attached", "positive"),
      placementFrame: {
        origin: [10, 20, 30],
        uAxis: [0, 1, 0],
        vAxis: [0, 0, 1]
      }
    };
    const scene = createRenderSceneInputs([], new Map(), [source]);

    expect(scene.primitives).toEqual([]);
    expect(scene.meshes).toHaveLength(1);
    expect(scene.meshes[0]).toMatchObject({
      id: "body_attached",
      kind: "mesh",
      indices: [],
      source: "extrude-fallback"
    });

    const xValues = collectEdgeCoordinate(scene.meshes[0].edgeSegments, 0);
    const yValues = collectEdgeCoordinate(scene.meshes[0].edgeSegments, 1);
    const zValues = collectEdgeCoordinate(scene.meshes[0].edgeSegments, 2);

    expect(Math.min(...xValues)).toBe(10);
    expect(Math.max(...xValues)).toBe(14);
    expect(Math.min(...yValues)).toBe(19);
    expect(Math.max(...yValues)).toBe(21);
    expect(Math.min(...zValues)).toBe(28.5);
    expect(Math.max(...zValues)).toBe(31.5);
  });

  it("keeps attached extrude fallback side behavior in the attached frame normal", () => {
    const sources: DerivedExtrudeGeometrySource[] = [
      createAttachedExtrudeSource("body_positive", "positive"),
      createAttachedExtrudeSource("body_negative", "negative"),
      createAttachedExtrudeSource("body_symmetric", "symmetric")
    ];
    const scene = createRenderSceneInputs([], new Map(), sources);
    const xRanges = scene.meshes.map((mesh) => {
      const xValues = collectEdgeCoordinate(mesh.edgeSegments, 0);

      return [Math.min(...xValues), Math.max(...xValues)];
    });

    expect(xRanges).toEqual([
      [10, 14],
      [6, 10],
      [8, 12]
    ]);
  });

  it("does not render attached extrudes when attachment placement is unresolved", () => {
    const source: DerivedExtrudeGeometrySource = {
      ...createExtrudeSource("body_attached", "positive"),
      placementError:
        "Attachment unresolved for Attached sketch; derived extrude mesh is unavailable."
    };
    const scene = createRenderSceneInputs([], new Map(), [source]);

    expect(scene.primitives).toEqual([]);
    expect(scene.meshes).toEqual([]);
  });

  it("renders ready boolean meshes without an honest-looking pending fallback", () => {
    for (const booleanSource of [createCutSource(), createAddSource()]) {
      const readyMesh = createMesh(booleanSource.id);
      const readyScene = createRenderSceneInputs(
        [],
        new Map([
          [
            booleanSource.id,
            {
              objectId: booleanSource.id,
              objectKind: "extrudeBoolean",
              sourceId: booleanSource.id,
              sourceKind: "extrudeBoolean",
              cacheKey: `${booleanSource.operation}-ready`,
              status: "ready",
              mesh: readyMesh,
              metrics: {
                objectId: booleanSource.id,
                roundTripMs: 1,
                vertexCount: 4,
                triangleCount: 2
              }
            }
          ]
        ]),
        [booleanSource]
      );
      const pendingScene = createRenderSceneInputs(
        [],
        new Map([
          [
            booleanSource.id,
            {
              objectId: booleanSource.id,
              objectKind: "extrudeBoolean",
              sourceId: booleanSource.id,
              sourceKind: "extrudeBoolean",
              cacheKey: `${booleanSource.operation}-pending`,
              status: "pending"
            }
          ]
        ]),
        [booleanSource]
      );

      expect(readyScene.primitives).toEqual([]);
      expect(readyScene.meshes).toEqual([readyMesh]);
      expect(pendingScene.primitives).toEqual([]);
      expect(pendingScene.meshes).toEqual([]);
    }
  });

  it("renders wire extrudes only when their exact mesh is ready", () => {
    const source = createWireExtrudeSource("body_wire");
    const readyMesh = createMesh(source.id);
    const readyScene = createRenderSceneInputs(
      [],
      new Map([
        [
          source.id,
          {
            objectId: source.id,
            objectKind: "extrude",
            sourceId: source.id,
            sourceKind: "extrude",
            cacheKey: "wire-ready",
            status: "ready",
            mesh: readyMesh,
            metrics: {
              objectId: source.id,
              roundTripMs: 1,
              vertexCount: 4,
              triangleCount: 2
            }
          }
        ]
      ]),
      [source]
    );
    const pendingScene = createRenderSceneInputs(
      [],
      new Map([
        [
          source.id,
          {
            objectId: source.id,
            objectKind: "extrude",
            sourceId: source.id,
            sourceKind: "extrude",
            cacheKey: "wire-pending",
            status: "pending"
          }
        ]
      ]),
      [source]
    );

    expect(readyScene.primitives).toEqual([]);
    expect(readyScene.meshes).toEqual([readyMesh]);
    expect(pendingScene.primitives).toEqual([]);
    expect(pendingScene.meshes).toEqual([]);
  });

  it("renders ready revolve meshes without a primitive-style pending fallback", () => {
    const source = createRevolveSource("body_revolve_1");
    const readyMesh = createMesh(source.id);
    const readyScene = createRenderSceneInputs(
      [],
      new Map([
        [
          source.id,
          {
            objectId: source.id,
            objectKind: "revolve",
            sourceId: source.id,
            sourceKind: "revolve",
            cacheKey: "revolve-ready",
            status: "ready",
            mesh: readyMesh,
            metrics: {
              objectId: source.id,
              roundTripMs: 1,
              vertexCount: 4,
              triangleCount: 2
            }
          }
        ]
      ]),
      [source]
    );
    const pendingScene = createRenderSceneInputs(
      [],
      new Map([
        [
          source.id,
          {
            objectId: source.id,
            objectKind: "revolve",
            sourceId: source.id,
            sourceKind: "revolve",
            cacheKey: "revolve-pending",
            status: "pending"
          }
        ]
      ]),
      [source]
    );

    expect(readyScene.primitives).toEqual([]);
    expect(readyScene.meshes).toEqual([readyMesh]);
    expect(pendingScene.primitives).toEqual([]);
    expect(pendingScene.meshes).toEqual([]);
  });

  it("renders ready hole meshes without a primitive-style pending fallback", () => {
    const source = createHoleSource("body_hole_1");
    const readyMesh = createMesh(source.id);
    const readyScene = createRenderSceneInputs(
      [],
      new Map([
        [
          source.id,
          {
            objectId: source.id,
            objectKind: "hole",
            sourceId: source.id,
            sourceKind: "hole",
            cacheKey: "hole-ready",
            status: "ready",
            mesh: readyMesh,
            metrics: {
              objectId: source.id,
              roundTripMs: 1,
              vertexCount: 4,
              triangleCount: 2
            }
          }
        ]
      ]),
      [source]
    );
    const pendingScene = createRenderSceneInputs(
      [],
      new Map([
        [
          source.id,
          {
            objectId: source.id,
            objectKind: "hole",
            sourceId: source.id,
            sourceKind: "hole",
            cacheKey: "hole-pending",
            status: "pending"
          }
        ]
      ]),
      [source]
    );

    expect(readyScene.primitives).toEqual([]);
    expect(readyScene.meshes).toEqual([readyMesh]);
    expect(pendingScene.primitives).toEqual([]);
    expect(pendingScene.meshes).toEqual([]);
  });

  it("renders ready edge-finish meshes without a primitive-style pending fallback", () => {
    const source = createEdgeFinishSource("body_chamfer_1");
    const readyMesh = createMesh(source.id);
    const readyScene = createRenderSceneInputs(
      [],
      new Map([
        [
          source.id,
          {
            objectId: source.id,
            objectKind: "edgeFinish",
            sourceId: source.id,
            sourceKind: "edgeFinish",
            cacheKey: "edge-finish-ready",
            status: "ready",
            mesh: readyMesh,
            metrics: {
              objectId: source.id,
              roundTripMs: 1,
              vertexCount: 4,
              triangleCount: 2
            }
          }
        ]
      ]),
      [source]
    );
    const pendingScene = createRenderSceneInputs(
      [],
      new Map([
        [
          source.id,
          {
            objectId: source.id,
            objectKind: "edgeFinish",
            sourceId: source.id,
            sourceKind: "edgeFinish",
            cacheKey: "edge-finish-pending",
            status: "pending"
          }
        ]
      ]),
      [source]
    );

    expect(readyScene.primitives).toEqual([]);
    expect(readyScene.meshes).toEqual([readyMesh]);
    expect(pendingScene.primitives).toEqual([]);
    expect(pendingScene.meshes).toEqual([]);
  });

  it("does not render a primitive-style fallback for unsupported revolve sources", () => {
    const source: DerivedRevolveGeometrySource = {
      ...createRevolveSource("body_revolve_1"),
      placementError:
        "Revolve display currently supports newBody revolve features only."
    };
    const scene = createRenderSceneInputs([], new Map(), [source]);

    expect(scene.primitives).toEqual([]);
    expect(scene.meshes).toEqual([]);
  });

  it("does not render a primitive-style fallback for unsupported hole sources", () => {
    const source: DerivedHoleGeometrySource = {
      ...createHoleSource("body_hole_1"),
      placementError:
        "Hole feature feat_hole_1 cannot be displayed because its target or circle tool source is unavailable."
    };
    const scene = createRenderSceneInputs([], new Map(), [source]);

    expect(scene.primitives).toEqual([]);
    expect(scene.meshes).toEqual([]);
  });

  it("does not render a primitive-style fallback for unsupported edge-finish sources", () => {
    const source: DerivedEdgeFinishGeometrySource = {
      ...createEdgeFinishSource("body_chamfer_1"),
      placementError:
        "Chamfer feature feat_chamfer_1 cannot be displayed because its edge reference is unavailable."
    };
    const scene = createRenderSceneInputs([], new Map(), [source]);

    expect(scene.primitives).toEqual([]);
    expect(scene.meshes).toEqual([]);
  });

  it("adds sketch display edges so authored sketches are visible in the viewport", () => {
    const sketch: SketchSnapshot = {
      id: "sketch_1",
      name: "Base sketch",
      plane: "XY",
      entities: [
        {
          id: "rect_1",
          kind: "rectangle",
          center: [1, 2],
          width: 4,
          height: 6,
          construction: false
        }
      ]
    };
    const scene = createRenderSceneInputs([], new Map(), [], [sketch]);

    expect(scene.meshes).toHaveLength(1);
    expect(scene.meshes[0]).toMatchObject({
      id: createSketchEntitySelectionId("sketch_1", "rect_1"),
      parentId: createSketchSelectionId("sketch_1"),
      kind: "mesh",
      vertices: [],
      indices: [],
      pickMode: "edgeSegments",
      lineStyle: "solid",
      source: "sketch",
      label: "Base sketch: rect_1"
    });
    expect(scene.meshes[0].edgeSegments).toEqual([
      {
        start: [-1, -1, 0],
        end: [3, -1, 0]
      },
      {
        start: [3, -1, 0],
        end: [3, 5, 0]
      },
      {
        start: [3, 5, 0],
        end: [-1, 5, 0]
      },
      {
        start: [-1, 5, 0],
        end: [-1, -1, 0]
      }
    ]);
  });

  it("derives signed and wraparound arc display from canonical source", () => {
    const frame = createDefaultSketchDisplayFrame("XY");
    const counterclockwise = createSketchArcDisplayEdges(
      frame,
      [0, 0],
      2,
      350,
      30
    );
    const clockwise = createSketchArcDisplayEdges(frame, [0, 0], 2, 10, -30);
    const ccwEnd = counterclockwise.at(-1)?.end;
    const cwEnd = clockwise.at(-1)?.end;

    expect(counterclockwise[0]?.end[1]).toBeGreaterThan(
      counterclockwise[0]?.start[1] ?? Number.POSITIVE_INFINITY
    );
    expect(clockwise[0]?.end[1]).toBeLessThan(
      clockwise[0]?.start[1] ?? Number.NEGATIVE_INFINITY
    );
    expect(ccwEnd?.[0]).toBeCloseTo(2 * Math.cos((20 * Math.PI) / 180));
    expect(ccwEnd?.[1]).toBeCloseTo(2 * Math.sin((20 * Math.PI) / 180));
    expect(cwEnd?.[0]).toBeCloseTo(2 * Math.cos((340 * Math.PI) / 180));
    expect(cwEnd?.[1]).toBeCloseTo(2 * Math.sin((340 * Math.PI) / 180));
    expect(
      counterclockwise.flatMap((edge) => [edge.start[0], edge.end[0]])
    ).toContain(2);
  });

  it("keeps arc render identity stable across derived sampling changes", () => {
    const createArcSketch = (sweepAngleDegrees: number): SketchSnapshot => ({
      id: "sketch_1",
      name: "Arc sketch",
      plane: "XY",
      entities: [
        {
          id: "arc_1",
          kind: "arc",
          center: [0, 0],
          radius: 2,
          startAngleDegrees: 0,
          sweepAngleDegrees,
          construction: false
        }
      ]
    });
    const before = createSketchDisplayMeshes([createArcSketch(45)]);
    const after = createSketchDisplayMeshes([createArcSketch(200)]);

    expect(before[0]?.id).toBe(
      createSketchEntitySelectionId("sketch_1", "arc_1")
    );
    expect(after[0]?.id).toBe(before[0]?.id);
    expect(after[0]?.edgeSegments?.length).toBeGreaterThan(
      before[0]?.edgeSegments?.length ?? Number.POSITIVE_INFINITY
    );
  });

  it("marks construction arcs as visible selectable construction display", () => {
    const meshes = createSketchDisplayMeshes([
      {
        id: "sketch_1",
        name: "Construction sketch",
        plane: "XY",
        entities: [
          {
            id: "arc_construction",
            kind: "arc",
            center: [0, 0],
            radius: 2,
            startAngleDegrees: 0,
            sweepAngleDegrees: 90,
            construction: true
          }
        ]
      }
    ]);

    expect(meshes[0]).toMatchObject({
      id: createSketchEntitySelectionId("sketch_1", "arc_construction"),
      lineStyle: "construction",
      pickMode: "edgeSegments",
      source: "sketch"
    });
    expect(meshes[0]?.edgeSegments?.length).toBeGreaterThan(0);
  });

  it("picks the finite arc but not the absent side of its support circle", () => {
    const mesh = createSketchDisplayMeshes([
      {
        id: "sketch_1",
        name: "Quarter arc",
        plane: "XY",
        entities: [
          {
            id: "arc_1",
            kind: "arc",
            center: [0, 0],
            radius: 4,
            startAngleDegrees: 0,
            sweepAngleDegrees: 90,
            construction: false
          }
        ]
      }
    ])[0];
    const camera: RenderCamera = {
      target: [0, 0, 0],
      yaw: Math.PI / 4,
      pitch: -Math.PI / 3,
      distance: 18
    };
    const size = { width: 800, height: 600 };
    const onArc = projectPoint(
      [4 * Math.SQRT1_2, 4 * Math.SQRT1_2, 0],
      camera,
      size
    );
    const absentSupportCircle = projectPoint([-4, 0, 0], camera, size);

    expect(mesh).toBeDefined();
    expect(onArc).toBeDefined();
    expect(absentSupportCircle).toBeDefined();
    expect(
      pickRenderScene([], mesh ? [mesh] : [], camera, size, {
        x: onArc?.x ?? 0,
        y: onArc?.y ?? 0
      })
    ).toBe(createSketchEntitySelectionId("sketch_1", "arc_1"));
    expect(
      pickRenderScene([], mesh ? [mesh] : [], camera, size, {
        x: absentSupportCircle?.x ?? 0,
        y: absentSupportCircle?.y ?? 0
      })
    ).toBeUndefined();
  });

  it("keeps multi-entity and delimiter-heavy source identities independently pickable", () => {
    const sketchId = "a:entity:b";
    const meshes = createSketchDisplayMeshes([
      {
        id: sketchId,
        name: "Adversarial IDs",
        plane: "XY",
        entities: [
          {
            id: "c",
            kind: "line",
            start: [-2, -2],
            end: [2, -2],
            construction: false
          },
          {
            id: "b:entity:c",
            kind: "line",
            start: [-2, 2],
            end: [2, 2],
            construction: false
          }
        ]
      }
    ]);
    const camera: RenderCamera = {
      target: [0, 0, 0],
      yaw: Math.PI / 4,
      pitch: -Math.PI / 3,
      distance: 18
    };
    const size = { width: 800, height: 600 };

    expect(meshes.map((mesh) => mesh.id)).toEqual([
      createSketchEntitySelectionId(sketchId, "c"),
      createSketchEntitySelectionId(sketchId, "b:entity:c")
    ]);
    expect(new Set(meshes.map((mesh) => mesh.id)).size).toBe(2);
    expect(
      meshes.every(
        (mesh) => mesh.parentId === createSketchSelectionId(sketchId)
      )
    ).toBe(true);

    for (const [entityId, point] of [
      ["c", [0, -2, 0]],
      ["b:entity:c", [0, 2, 0]]
    ] as const) {
      const projected = projectPoint(point, camera, size);
      expect(projected).toBeDefined();
      expect(
        pickRenderScene([], meshes, camera, size, {
          x: projected?.x ?? 0,
          y: projected?.y ?? 0
        })
      ).toBe(createSketchEntitySelectionId(sketchId, entityId));
    }
  });

  it("aggregates exact child bounds for a sketch in a rotated attached frame", () => {
    const sketch: SketchSnapshot = {
      id: "sketch_attached",
      name: "Attached",
      plane: "XY",
      entities: [
        {
          id: "line_1",
          kind: "line",
          start: [-1, -2],
          end: [3, 4],
          construction: false
        },
        {
          id: "point_1",
          kind: "point",
          point: [5, 6],
          construction: true
        }
      ]
    };
    const meshes = createSketchDisplayMeshes(
      [sketch],
      new Map([
        [
          sketch.id,
          {
            origin: [10, 20, 30],
            uAxis: [0, 1, 0],
            vAxis: [0, 0, 1]
          }
        ]
      ])
    );

    expect(
      getRenderObjectBounds(createSketchSelectionId(sketch.id), [], meshes)
    ).toEqual({
      min: [10, 19, 28],
      max: [10, 25.1, 36.1]
    });
    expect(
      getRenderObjectBounds(
        createSketchEntitySelectionId(sketch.id, "line_1"),
        [],
        meshes
      )
    ).toEqual({ min: [10, 19, 28], max: [10, 23, 34] });
  });

  it("adds a small plane marker for empty sketches", () => {
    const meshes = createSketchDisplayMeshes([
      {
        id: "sketch_empty",
        name: "Empty sketch",
        plane: "XZ",
        entities: []
      }
    ]);

    expect(meshes).toHaveLength(1);
    expect(meshes[0]?.id).toBe(createSketchSelectionId("sketch_empty"));
    expect(meshes[0]?.edgeSegments).toEqual([
      {
        start: [-0.5, 0, -0.5],
        end: [0.5, 0, -0.5]
      },
      {
        start: [0.5, 0, -0.5],
        end: [0.5, 0, 0.5]
      },
      {
        start: [0.5, 0, 0.5],
        end: [-0.5, 0, 0.5]
      },
      {
        start: [-0.5, 0, 0.5],
        end: [-0.5, 0, -0.5]
      },
      {
        start: [-0.1, 0, 0],
        end: [0.1, 0, 0]
      },
      {
        start: [0, 0, -0.1],
        end: [0, 0, 0.1]
      }
    ]);
  });
});

function createBoxObject(id: string): BoxObject {
  return {
    id,
    kind: "box",
    dimensions: {
      width: 2,
      height: 3,
      depth: 4
    },
    transform: {
      translation: [0, 0, 2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createCylinderObject(id: string): CylinderObject {
  return {
    id,
    kind: "cylinder",
    dimensions: {
      radius: 1,
      height: 2
    },
    transform: {
      translation: [0, 0, 1],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createSphereObject(id: string): SphereObject {
  return {
    id,
    kind: "sphere",
    dimensions: {
      radius: 1
    },
    transform: {
      translation: [0, 0, 1],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createConeObject(id: string): ConeObject {
  return {
    id,
    kind: "cone",
    dimensions: {
      radius: 1,
      height: 2
    },
    transform: {
      translation: [0, 0, 1],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createTorusObject(id: string): TorusObject {
  return {
    id,
    kind: "torus",
    dimensions: {
      majorRadius: 2,
      minorRadius: 0.4
    },
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createMesh(id: string): RenderTriangleMesh {
  return {
    id,
    kind: "mesh",
    vertices: [
      [-1, -1, 0],
      [1, -1, 0],
      [1, 1, 0],
      [-1, 1, 0]
    ],
    indices: [0, 1, 2, 0, 2, 3],
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }
  };
}

function createExtrudeSource(
  id: string,
  side: DerivedExtrudeGeometrySource["side"]
): DerivedExtrudeGeometrySource {
  return {
    id,
    kind: "extrude",
    sketchPlane: "XY",
    profile: {
      kind: "rectangle",
      center: [0, 0],
      width: 2,
      height: 3
    },
    depth: 4,
    side
  };
}

function createAttachedExtrudeSource(
  id: string,
  side: DerivedExtrudeGeometrySource["side"]
): DerivedExtrudeGeometrySource {
  return {
    ...createExtrudeSource(id, side),
    placementFrame: {
      origin: [10, 20, 30],
      uAxis: [0, 1, 0],
      vAxis: [0, 0, 1]
    }
  };
}

function createWireExtrudeSource(id: string): DerivedExtrudeGeometrySource {
  return {
    id,
    kind: "extrude",
    sketchPlane: "XY",
    profile: {
      kind: "wire",
      frame: {
        origin: [0, 0, 0],
        uAxis: [1, 0, 0],
        vAxis: [0, 1, 0]
      },
      closed: true,
      segments: [
        {
          kind: "line",
          sourceEntityId: "line_1",
          start: [0, 0],
          end: [2, 0]
        },
        {
          kind: "arc",
          sourceEntityId: "arc_1",
          center: [1, 0],
          radius: 1,
          startAngleDegrees: 0,
          sweepAngleDegrees: 180
        }
      ],
      sourceIdentity: "partbench-wire-extrude-v1:render-scene",
      geometryPolicy: {
        linearTolerance: 1e-7,
        angularToleranceDegrees: 0.1,
        minimumProfileArea: 1e-12
      }
    },
    depth: 4,
    side: "positive"
  };
}

function createCutSource(): DerivedBooleanExtrudeGeometrySource {
  return {
    id: "body_cut",
    kind: "extrudeBoolean",
    operation: "cut",
    target: createExtrudeSource("body_target", "positive"),
    tool: createExtrudeSource("body_cut", "positive")
  };
}

function createAddSource(): DerivedBooleanExtrudeGeometrySource {
  return {
    id: "body_add",
    kind: "extrudeBoolean",
    operation: "add",
    target: createExtrudeSource("body_target", "positive"),
    tool: createExtrudeSource("body_add", "positive")
  };
}

function createRevolveSource(id: string): DerivedRevolveGeometrySource {
  return {
    id,
    kind: "revolve",
    sketchPlane: "XY",
    profile: {
      kind: "rectangle",
      center: [2, 0],
      width: 1,
      height: 2
    },
    axis: {
      start: [0, -2],
      end: [0, 2]
    },
    angleDegrees: 270
  };
}

function createHoleSource(id: string): DerivedHoleGeometrySource {
  return {
    id,
    kind: "hole",
    target: createExtrudeSource("body_target", "positive"),
    tool: {
      sketchPlane: "XY",
      circle: {
        kind: "circle",
        center: [0, 0],
        radius: 0.5
      },
      depthMode: "blind",
      depth: 1,
      direction: "positive"
    }
  };
}

function createEdgeFinishSource(id: string): DerivedEdgeFinishGeometrySource {
  return {
    id,
    kind: "edgeFinish",
    operation: "chamfer",
    target: createExtrudeSource("body_target", "positive"),
    edgeStableId: "generated:edge:body_target:start:uMin",
    distance: 0.25
  };
}

function collectEdgeCoordinate(
  edges: readonly RenderEdgeSegment[] | undefined,
  coordinateIndex: 0 | 1 | 2
): readonly number[] {
  return (edges ?? []).flatMap((edge) => [
    edge.start[coordinateIndex],
    edge.end[coordinateIndex]
  ]);
}

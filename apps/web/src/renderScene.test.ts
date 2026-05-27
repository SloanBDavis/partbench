import type {
  BoxObject,
  ConeObject,
  CylinderObject,
  SketchSnapshot,
  SphereObject,
  TorusObject
} from "@web-cad/cad-core";
import type { RenderEdgeSegment, RenderTriangleMesh } from "@web-cad/renderer";
import { describe, expect, it } from "vitest";
import type {
  DerivedBooleanExtrudeGeometrySource,
  DerivedExtrudeGeometrySource,
  DerivedGeometryEntry,
  DerivedRevolveGeometrySource
} from "./derivedGeometry";
import {
  createMeshDisplayEdges,
  createRenderSceneInputs,
  createSketchDisplayEdges
} from "./renderScene";

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
          height: 6
        }
      ]
    };
    const scene = createRenderSceneInputs([], new Map(), [], [sketch]);

    expect(scene.meshes).toHaveLength(1);
    expect(scene.meshes[0]).toMatchObject({
      id: "sketch:sketch_1",
      kind: "mesh",
      vertices: [],
      indices: [],
      source: "sketch",
      label: "Base sketch"
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

  it("adds a small plane marker for empty sketches", () => {
    expect(
      createSketchDisplayEdges({
        id: "sketch_empty",
        name: "Empty sketch",
        plane: "XZ",
        entities: []
      })
    ).toEqual([
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

function collectEdgeCoordinate(
  edges: readonly RenderEdgeSegment[] | undefined,
  coordinateIndex: 0 | 1 | 2
): readonly number[] {
  return (edges ?? []).flatMap((edge) => [
    edge.start[coordinateIndex],
    edge.end[coordinateIndex]
  ]);
}

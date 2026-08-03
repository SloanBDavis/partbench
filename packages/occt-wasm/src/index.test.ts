import { describe, expect, it } from "vitest";
import {
  assertBooleanAddSolidCount,
  createOcctBooleanExtrudeMesh,
  createOcctBooleanExtrudeMeshWithInstance,
  createOcctBoxMesh,
  createOcctBoxMeshWithInstance,
  createOcctConeMesh,
  createOcctConeMeshWithInstance,
  createOcctCylinderMesh,
  createOcctCylinderMeshWithInstance,
  createOcctEdgeFinishMesh,
  createOcctExactBodyMetadata,
  createOcctExactBodyArtifactMetadataWithInstance,
  createOcctExactBodyArtifactWithInstance,
  createOcctExactBodyMeshWithInstance,
  createOcctExactTopologyCheckpointPayload,
  createOcctExactTopologySnapshot,
  createOcctRevolveProfileMesh,
  createOcctShellMesh,
  createOcctSweepMesh,
  createOcctLoftMesh,
  createOcctSphereMesh,
  createOcctSphereMeshWithInstance,
  createOcctStepImport,
  createOcctStepImportWithInstance,
  createOcctStepExport,
  createOcctStepExportWithInstance,
  getOcctBrepCheckpointWriterCapability,
  getOcctNamedStepProbeCapabilityWithInstance,
  getOcctStepReaderCapability,
  getOcctStepWriterCapability,
  getOcctStepWriterCapabilityWithInstance,
  loadOcct,
  runOcctNamedStepProbeWithInstance,
  createOcctTorusMesh,
  createOcctTorusMeshWithInstance,
  createOcctWireExtrudeMesh,
  createOcctWireExtrudeMeshWithInstance
} from "./index";
import type { OpenCascadeInstance } from "opencascade.js";
import {
  createOcctBooleanExtrudeMeshWithShapeFactories,
  makeBooleanExtrudeShape,
  MAX_OCCT_BOOLEAN_EXTRUDE_RECIPE_DEPTH,
  type OcctBooleanExtrudeShapeBuilder,
  type OcctBooleanExtrudeShapeFactories,
  type OcctBooleanExtrudeSource
} from "./booleanExtrudes";
import {
  assertWireExtrudeSolidCount,
  withOcctWireExtrudeBuildShape,
  type OcctGeneratedReferences,
  type OcctWireExtrudeShapeBuild
} from "./wireExtrude";
import { readTriangulatedShape } from "./readTriangulatedShape";
import {
  makeCircularPatternShape,
  makeLinearPatternShape,
  withOcctPatternSeedShape
} from "./pattern";
import { makeMirrorShape } from "./mirror";
import { makeShellShape } from "./shell";
import { makeLoftShape } from "./loft";
import { withOcctHoleResultShape } from "./hole";
import { assertRevolveSolidResult, makeProfileFace } from "./revolveProfile";
import { assertSweepSolidResult } from "./sweep";

const OCCT_WASM_TEST_TIMEOUT_MS = 120_000;

type StepTestSource = Parameters<
  typeof createOcctExactBodyArtifactWithInstance
>[1]["source"];
type BodyArtifactTestLeaf = Extract<StepTestSource, { kind: "bodyArtifact" }>;

function createBodyArtifactTestLeaf(
  artifact: ReturnType<typeof createOcctExactBodyArtifactWithInstance>
): BodyArtifactTestLeaf {
  return {
    kind: "bodyArtifact",
    artifactVersion: "partbench.exact-body-artifact.v1",
    bodyId: "artifact_dependency",
    sourceType: "sketchExtrudeFeature",
    documentSourceIdentity: {
      algorithm: "partbench-source-v1",
      sha256: "a".repeat(64)
    },
    bodySourceIdentitySignature: `body-topology-source:v1:${"b".repeat(64)}`,
    sourceCacheKeySha256: "c".repeat(64),
    sourceGraphNodeCount: 1,
    units: "mm",
    shapePolicy: "singleSolid",
    sourceKind: artifact.sourceKind,
    brepFormat: artifact.brepFormat,
    brepWriter: artifact.brepWriter,
    brepBytes: artifact.brepBytes,
    brepByteLength: artifact.brepByteLength,
    brepSha256: "d".repeat(64),
    topologySignature: artifact.topologySnapshot.signature
  };
}

async function createStepFromSources(input: {
  readonly units: "mm" | "cm" | "m" | "in";
  readonly bodies: readonly {
    readonly bodyId: string;
    readonly bodyName?: string;
    readonly source: StepTestSource;
  }[];
}) {
  const oc = await loadOcct();
  return createOcctStepExport({
    units: input.units,
    bodies: input.bodies.map((body) => {
      const artifact = createOcctExactBodyArtifactWithInstance(oc, {
        source: body.source
      });
      return {
        bodyId: body.bodyId,
        bodyName: body.bodyName ?? body.bodyId,
        brepFormat: artifact.brepFormat,
        brepByteLength: artifact.brepByteLength,
        brepSha256: "0".repeat(64),
        brepBytes: artifact.brepBytes
      };
    })
  });
}

const slotWireProfile = {
  kind: "wire" as const,
  frame: {
    origin: [0, 0, 0] as const,
    uAxis: [1, 0, 0] as const,
    vAxis: [0, 1, 0] as const
  },
  closed: true as const,
  segments: [
    {
      kind: "line" as const,
      sourceEntityId: "bottom",
      start: [-2, -1] as const,
      end: [2, -1] as const
    },
    {
      kind: "arc" as const,
      sourceEntityId: "right",
      center: [2, 0] as const,
      radius: 1,
      startAngleDegrees: 270,
      sweepAngleDegrees: 180
    },
    {
      kind: "line" as const,
      sourceEntityId: "top",
      start: [2, 1] as const,
      end: [-2, 1] as const
    },
    {
      kind: "arc" as const,
      sourceEntityId: "left",
      center: [-2, 0] as const,
      radius: 1,
      startAngleDegrees: 90,
      sweepAngleDegrees: 180
    }
  ],
  sourceIdentity: "slot:bottom,right,top,left",
  geometryPolicy: {
    linearTolerance: 1e-7 as const,
    angularToleranceDegrees: 0.1 as const,
    minimumProfileArea: 1e-12 as const
  }
};

const notchedWireProfile = {
  ...slotWireProfile,
  sourceIdentity: "notched:bottom,right,top-right,reverse-arc,top-left,left",
  segments: [
    {
      kind: "line" as const,
      sourceEntityId: "notch-bottom",
      start: [-2, -1] as const,
      end: [2, -1] as const
    },
    {
      kind: "line" as const,
      sourceEntityId: "notch-right",
      start: [2, -1] as const,
      end: [2, 1] as const
    },
    {
      kind: "line" as const,
      sourceEntityId: "notch-top-right",
      start: [2, 1] as const,
      end: [1, 1] as const
    },
    {
      kind: "arc" as const,
      sourceEntityId: "notch-reverse-arc",
      center: [0, 1] as const,
      radius: 1,
      startAngleDegrees: 0,
      sweepAngleDegrees: -180
    },
    {
      kind: "line" as const,
      sourceEntityId: "notch-top-left",
      start: [-1, 1] as const,
      end: [-2, 1] as const
    },
    {
      kind: "line" as const,
      sourceEntityId: "notch-left",
      start: [-2, 1] as const,
      end: [-2, -1] as const
    }
  ]
};

const occtBooleanRecipePrimitive = {
  sketchPlane: "XY" as const,
  profile: {
    kind: "rectangle" as const,
    center: [0, 0] as const,
    width: 4,
    height: 4
  },
  depth: 4
};

function createNestedOcctBooleanRecipe(
  resultDepth: number
): OcctBooleanExtrudeSource {
  let source: OcctBooleanExtrudeSource = occtBooleanRecipePrimitive;
  for (let index = 0; index < resultDepth; index += 1) {
    source = {
      kind: "booleanExtrudes",
      operation: "add",
      target: source,
      tool: occtBooleanRecipePrimitive
    };
  }
  return source;
}

describe("occt-wasm", () => {
  it(
    "derives face, edge, and vertex pick evidence from one exact artifact shape",
    async () => {
      const oc = await loadOcct();
      const artifact = createOcctExactBodyArtifactWithInstance(oc, {
        source: {
          kind: "box",
          dimensions: { width: 2, height: 3, depth: 4 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      });
      const pickMap = artifact.viewportPickMap;
      expect(pickMap).toBeDefined();
      if (!pickMap) throw new Error("Expected same-shape exact pick evidence.");

      for (const [kind, entries] of [
        ["face", pickMap.faces],
        ["edge", pickMap.edges],
        ["vertex", pickMap.vertices]
      ] as const) {
        expect(entries).toEqual(
          artifact.topologySnapshot.entities
            .filter((entity) => entity.kind === kind)
            .map((entity) => ({
              localId: entity.localId,
              entitySignature: entity.signature
            }))
        );
      }
      expect(pickMap.meshVertexCount).toBe(artifact.displayMesh.vertexCount);
      expect(pickMap.meshTriangleCount).toBe(
        artifact.displayMesh.triangleCount
      );
      expect(pickMap.faceTriangleRanges.length).toBe(pickMap.faces.length * 2);
      expect(pickMap.edgePointRanges.length).toBe(pickMap.edges.length * 2);
      expect(pickMap.vertexPoints.length).toBe(pickMap.vertices.length * 3);
      expect(
        pickMap.faceTriangleRanges
          .filter((_, index) => index % 2 === 1)
          .reduce((total, count) => total + count, 0)
      ).toBe(artifact.displayMesh.triangleCount);
      expect(
        [...pickMap.edgePoints, ...pickMap.vertexPoints].every(Number.isFinite)
      ).toBe(true);
      expect(Array.from(pickMap.vertexPoints)).toEqual(
        artifact.topologySnapshot.entities
          .filter((entity) => entity.kind === "vertex")
          .flatMap((entity) => entity.point ?? [])
      );

      const cylinder = createOcctExactBodyArtifactWithInstance(oc, {
        source: {
          kind: "cylinder",
          dimensions: { radius: 1, height: 2 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      });
      expect(cylinder.viewportPickMap).toBeDefined();
      expect(
        cylinder.viewportPickMap?.edgePointRanges.some(
          (count, index) => index % 2 === 1 && count > 2
        )
      ).toBe(true);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "keeps an exact artifact when optional pick-map bindings are unavailable",
    async () => {
      const oc = await loadOcct();
      const withoutPickSampler = new Proxy(oc, {
        get(target, candidate) {
          return candidate === "GCPnts_TangentialDeflection_3"
            ? undefined
            : Reflect.get(target, candidate);
        }
      }) as OpenCascadeInstance;
      const artifact = createOcctExactBodyArtifactWithInstance(
        withoutPickSampler,
        {
          source: {
            kind: "box",
            dimensions: { width: 2, height: 3, depth: 4 },
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1]
            }
          }
        }
      );

      expect(artifact.viewportPickMap).toBeUndefined();
      expect(artifact.displayMesh.triangleCount).toBeGreaterThan(0);
      expect(artifact.topologySnapshot.entityCounts.faceCount).toBeGreaterThan(
        0
      );

      let faceMapShapesCalls = 0;
      const faceShapeType = oc.TopAbs_ShapeEnum
        .TopAbs_FACE as unknown as Parameters<typeof oc.TopExp.MapShapes_1>[1];
      const topExpWithFaceRangeFailure = new Proxy(oc.TopExp, {
        get(target, candidate) {
          if (candidate !== "MapShapes_1")
            return Reflect.get(target, candidate);
          return (...args: Parameters<typeof oc.TopExp.MapShapes_1>) => {
            if (args[1] === faceShapeType) faceMapShapesCalls += 1;
            if (args[1] === faceShapeType && faceMapShapesCalls === 3) {
              throw new Error("Injected face-range map failure.");
            }
            return target.MapShapes_1(...args);
          };
        }
      });
      const withFaceRangeFailure = new Proxy(oc, {
        get(target, candidate) {
          return candidate === "TopExp"
            ? topExpWithFaceRangeFailure
            : Reflect.get(target, candidate);
        }
      }) as OpenCascadeInstance;
      const fallbackArtifact = createOcctExactBodyArtifactWithInstance(
        withFaceRangeFailure,
        {
          source: {
            kind: "box",
            dimensions: { width: 2, height: 3, depth: 4 },
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1]
            }
          }
        }
      );
      expect(faceMapShapesCalls).toBe(3);
      expect(fallbackArtifact.viewportPickMap).toBeUndefined();
      expect(fallbackArtifact.displayMesh.triangleCount).toBeGreaterThan(0);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it.each(["positive", "negative", "symmetric"] as const)(
    "builds an exact mixed line/arc composite %s extrude with proven roles",
    async (side) => {
      const mesh = await createOcctWireExtrudeMesh({
        sketchPlane: "XY",
        profile: slotWireProfile,
        depth: 4,
        side
      });

      expect(mesh.primitive).toBe("extrude");
      expect(mesh.vertexCount).toBeGreaterThan(0);
      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect(mesh.generatedReferences.status).toBe("ready");
      expect(mesh.generatedReferences.faces).toHaveLength(6);
      expect(mesh.generatedReferences.edges).toHaveLength(12);
      expect(mesh.generatedReferences.faces).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "side",
            sourceEntityId: "bottom",
            surfaceClass: "plane"
          }),
          expect.objectContaining({
            role: "side",
            sourceEntityId: "right",
            surfaceClass: "cylinder"
          })
        ])
      );
      expect(
        mesh.generatedReferences.edges
          .filter((edge) => edge.role === "longitudinal")
          .map((edge) => edge.adjacentSourceEntityIds)
      ).toEqual([
        ["bottom", "right"],
        ["right", "top"],
        ["top", "left"],
        ["left", "bottom"]
      ]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "builds two complementary exact arcs as one solid without tessellated authority",
    async () => {
      const profile = {
        ...slotWireProfile,
        sourceIdentity: "two-arcs:upper,lower",
        segments: [
          {
            kind: "arc" as const,
            sourceEntityId: "upper",
            center: [0, 0] as const,
            radius: 2,
            startAngleDegrees: 0,
            sweepAngleDegrees: 180
          },
          {
            kind: "arc" as const,
            sourceEntityId: "lower",
            center: [0, 0] as const,
            radius: 2,
            startAngleDegrees: 180,
            sweepAngleDegrees: 180
          }
        ]
      };
      const mesh = await createOcctWireExtrudeMesh({
        sketchPlane: "XY",
        profile,
        depth: 3
      });
      expect(
        mesh.generatedReferences.status,
        JSON.stringify(mesh.generatedReferences)
      ).toBe("ready");
      expect(mesh.generatedReferences.faces).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceEntityId: "upper",
            surfaceClass: "cylinder"
          }),
          expect.objectContaining({
            sourceEntityId: "lower",
            surfaceClass: "cylinder"
          })
        ])
      );
      expect(
        mesh.generatedReferences.edges
          .filter((edge) => edge.role === "longitudinal")
          .map((edge) => edge.adjacentSourceEntityIds)
      ).toEqual([
        ["upper", "lower"],
        ["lower", "upper"]
      ]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "preserves reverse arc traversal and current-next join identity",
    async () => {
      const profile = {
        ...slotWireProfile,
        sourceIdentity: "reverse-slot:left,top,right,bottom",
        segments: [
          {
            kind: "arc" as const,
            sourceEntityId: "left",
            center: [-2, 0] as const,
            radius: 1,
            startAngleDegrees: 270,
            sweepAngleDegrees: -180
          },
          {
            kind: "line" as const,
            sourceEntityId: "top",
            start: [-2, 1] as const,
            end: [2, 1] as const
          },
          {
            kind: "arc" as const,
            sourceEntityId: "right",
            center: [2, 0] as const,
            radius: 1,
            startAngleDegrees: 90,
            sweepAngleDegrees: -180
          },
          {
            kind: "line" as const,
            sourceEntityId: "bottom",
            start: [2, -1] as const,
            end: [-2, -1] as const
          }
        ]
      };
      const mesh = await createOcctWireExtrudeMesh({
        sketchPlane: "XY",
        profile,
        depth: 2
      });

      expect(mesh.generatedReferences.status).toBe("ready");
      expect(
        mesh.generatedReferences.edges
          .filter((edge) => edge.role === "longitudinal")
          .map((edge) => edge.adjacentSourceEntityIds)
      ).toEqual([
        ["left", "top"],
        ["top", "right"],
        ["right", "bottom"],
        ["bottom", "left"]
      ]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "retains authored exact line support when a shared join is healed within tolerance",
    async () => {
      const profile = {
        ...slotWireProfile,
        sourceIdentity: "tolerant-lines:bottom,right,top,left",
        segments: [
          {
            kind: "line" as const,
            sourceEntityId: "bottom",
            start: [0, 0] as const,
            end: [2, 0] as const
          },
          {
            kind: "line" as const,
            sourceEntityId: "right",
            start: [2, 5e-8] as const,
            end: [2, 1] as const
          },
          {
            kind: "line" as const,
            sourceEntityId: "top",
            start: [2, 1] as const,
            end: [0, 1] as const
          },
          {
            kind: "line" as const,
            sourceEntityId: "left",
            start: [0, 1] as const,
            end: [0, 0] as const
          }
        ]
      };
      const topology = await createOcctExactTopologySnapshot({
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile,
          depth: 3
        }
      });
      const authoredHorizontalEdges = topology.entities.filter(
        (entity) =>
          entity.kind === "edge" &&
          entity.curveClass === "line" &&
          entity.length !== undefined &&
          Math.abs(entity.length - 2) < 1e-6
      );

      expect(topology.generatedReferences?.status).toBe("ready");
      expect(authoredHorizontalEdges).toHaveLength(4);
      expect(
        authoredHorizontalEdges.some((edge) => (edge.axis?.[0] ?? 0) > 0.99)
      ).toBe(true);
      expect(
        authoredHorizontalEdges.some((edge) => (edge.axis?.[0] ?? 0) < -0.99)
      ).toBe(true);
      expect(
        authoredHorizontalEdges.every(
          (edge) => Math.abs(edge.axis?.[0] ?? 0) > 0.99
        )
      ).toBe(true);
      for (const edge of authoredHorizontalEdges) {
        expect(Math.abs(edge.axis?.[1] ?? Number.NaN)).toBeLessThan(1e-12);
      }
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "rebuilds composite extrude exact metadata, topology, checkpoint, and STEP from one recipe",
    async () => {
      const source = {
        kind: "extrude" as const,
        sketchPlane: "XY" as const,
        profile: slotWireProfile,
        depth: 4,
        side: "symmetric" as const
      };
      const [metadata, topology, checkpoint] = await Promise.all([
        createOcctExactBodyMetadata({ source }),
        createOcctExactTopologySnapshot({ source }),
        createOcctExactTopologyCheckpointPayload({
          checkpointId: "checkpoint_wire",
          bodyId: "body_wire",
          source
        })
      ]);
      const step = await createStepFromSources({
        units: "mm",
        bodies: [{ bodyId: "body_wire", source }]
      });

      const expectedMin = [-3, -1, -2] as const;
      const expectedMax = [3, 1, 2] as const;
      for (let index = 0; index < 3; index += 1) {
        expect(
          Math.abs(metadata.bounds.min[index]! - expectedMin[index]!)
        ).toBeLessThanOrEqual(
          slotWireProfile.geometryPolicy.linearTolerance * 1.01
        );
        expect(
          Math.abs(metadata.bounds.max[index]! - expectedMax[index]!)
        ).toBeLessThanOrEqual(
          slotWireProfile.geometryPolicy.linearTolerance * 1.01
        );
      }
      expect(metadata.volume).toBeCloseTo((8 + Math.PI) * 4, 6);
      expect(metadata.topologyCounts).toMatchObject({
        solidCount: 1,
        faceCount: 6
      });
      expect(metadata.generatedReferences?.status).toBe("ready");
      expect(metadata.centroid).toEqual([
        expect.closeTo(0, 7),
        expect.closeTo(0, 7),
        expect.closeTo(0, 7)
      ]);
      expect(topology.entityCounts.solidCount).toBe(1);
      expect(topology.entityCounts.faceCount).toBe(6);
      expect(topology.generatedReferences?.status).toBe("ready");
      expect(checkpoint.brepByteLength).toBeGreaterThan(0);
      expect(checkpoint.topologySnapshot.signature).toBe(topology.signature);
      expect(checkpoint.topologySnapshot.generatedReferences?.status).toBe(
        "ready"
      );
      expect(step.bodyCount).toBe(1);
      expect(step.byteLength).toBeGreaterThan(0);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it("disposes a box result shape when mesher construction fails", () => {
    const deleted: string[] = [];
    class Shape {
      delete() {
        deleted.push("shape");
      }
    }
    class BoxBuilder {
      Shape() {
        return new Shape();
      }
      delete() {
        deleted.push("box-builder");
      }
    }
    class FailingMesher {
      constructor() {
        throw new Error("Injected box mesher failure.");
      }
    }
    const oc = {
      BRepPrimAPI_MakeBox_2: BoxBuilder,
      BRepMesh_IncrementalMesh_2: FailingMesher
    } as unknown as OpenCascadeInstance;

    expect(() =>
      createOcctBoxMeshWithInstance(oc, {
        width: 1,
        height: 2,
        depth: 3
      })
    ).toThrow("Injected box mesher failure");
    expect(deleted).toEqual(["shape", "box-builder"]);
  });

  it("disposes a primitive pattern seed wrapper after its callback", () => {
    const deleted: string[] = [];
    let directionIndex = 0;
    class Point {
      delete() {
        deleted.push("point");
      }
    }
    class Direction {
      readonly #label: string;
      constructor() {
        directionIndex += 1;
        this.#label = directionIndex === 1 ? "normal" : "x-direction";
      }
      delete() {
        deleted.push(this.#label);
      }
    }
    class Axis {
      delete() {
        deleted.push("axis");
      }
    }
    class Shape {
      delete() {
        deleted.push("shape");
      }
    }
    class BoxBuilder {
      Shape() {
        return new Shape();
      }
      delete() {
        deleted.push("box-builder");
      }
    }
    const oc = {
      gp_Pnt_3: Point,
      gp_Dir_4: Direction,
      gp_Ax2_2: Axis,
      BRepPrimAPI_MakeBox_5: BoxBuilder
    } as unknown as OpenCascadeInstance;

    expect(
      withOcctPatternSeedShape(
        oc,
        { kind: "extrude", ...occtBooleanRecipePrimitive },
        () => "read"
      )
    ).toBe("read");
    expect(deleted).toEqual([
      "axis",
      "x-direction",
      "normal",
      "point",
      "shape",
      "box-builder"
    ]);
  });

  it("disposes partial linear transform parameters after builder failure", () => {
    const deleted: string[] = [];
    class Vector {
      delete() {
        deleted.push("vector");
      }
    }
    class Transform {
      SetTranslation_1() {}
      delete() {
        deleted.push("transform");
      }
    }
    class FailingTransformBuilder {
      constructor() {
        throw new Error("Injected linear transform builder failure.");
      }
    }
    const oc = {
      gp_Vec_4: Vector,
      gp_Trsf_1: Transform,
      BRepBuilderAPI_Transform_2: FailingTransformBuilder
    } as unknown as OpenCascadeInstance;

    expect(() =>
      makeLinearPatternShape(oc, {} as never, {
        direction: [1, 0, 0],
        spacing: 2,
        instanceCount: 1
      })
    ).toThrow("Injected linear transform builder failure");
    expect(deleted).toEqual(["transform", "vector"]);
  });

  it("disposes partial circular rotation parameters after builder failure", () => {
    const deleted: string[] = [];
    class CopiedShape {
      delete() {
        deleted.push("copied-shape");
      }
    }
    class CopyBuilder {
      Shape() {
        return new CopiedShape();
      }
      delete() {
        deleted.push("copy-builder");
      }
    }
    class Origin {
      delete() {
        deleted.push("origin");
      }
    }
    class Direction {
      delete() {
        deleted.push("direction");
      }
    }
    class Axis {
      delete() {
        deleted.push("axis");
      }
    }
    class Transform {
      SetRotation_1() {}
      delete() {
        deleted.push("transform");
      }
    }
    class FailingTransformBuilder {
      constructor() {
        throw new Error("Injected circular transform builder failure.");
      }
    }
    const oc = {
      BRepBuilderAPI_Copy_2: CopyBuilder,
      gp_Pnt_3: Origin,
      gp_Dir_4: Direction,
      gp_Ax1_2: Axis,
      gp_Trsf_1: Transform,
      BRepBuilderAPI_Transform_2: FailingTransformBuilder
    } as unknown as OpenCascadeInstance;

    expect(() =>
      makeCircularPatternShape(oc, {} as never, {
        axis: { origin: [0, 0, 0], direction: [0, 0, 1] },
        totalAngleDegrees: 360,
        instanceCount: 2
      })
    ).toThrow("Injected circular transform builder failure");
    expect(deleted).toEqual([
      "copy-builder",
      "transform",
      "axis",
      "direction",
      "origin",
      "copied-shape"
    ]);
  });

  it("disposes partial mirror parameters after builder failure", () => {
    const deleted: string[] = [];
    class Origin {
      delete() {
        deleted.push("origin");
      }
    }
    class Direction {
      delete() {
        deleted.push("direction");
      }
    }
    class Axis {
      delete() {
        deleted.push("axis");
      }
    }
    class Transform {
      SetMirror_3() {}
      delete() {
        deleted.push("transform");
      }
    }
    class FailingTransformBuilder {
      constructor() {
        throw new Error("Injected mirror transform builder failure.");
      }
    }
    const oc = {
      gp_Pnt_3: Origin,
      gp_Dir_4: Direction,
      gp_Ax2_3: Axis,
      gp_Trsf_1: Transform,
      BRepBuilderAPI_Transform_2: FailingTransformBuilder
    } as unknown as OpenCascadeInstance;

    expect(() =>
      makeMirrorShape(oc, {} as never, {
        plane: { point: [0, 0, 0], normal: [1, 0, 0] },
        includeOriginal: false
      })
    ).toThrow("Injected mirror transform builder failure");
    expect(deleted).toEqual(["transform", "axis", "direction", "origin"]);
  });

  it("disposes partial shell setup after face-list construction fails", () => {
    const deleted: string[] = [];
    class ThickSolidMaker {
      delete() {
        deleted.push("maker");
      }
    }
    class FailingFaceList {
      constructor() {
        throw new Error("Injected shell face-list failure.");
      }
    }
    const oc = {
      BRepOffsetAPI_MakeThickSolid: ThickSolidMaker,
      TopTools_ListOfShape_1: FailingFaceList
    } as unknown as OpenCascadeInstance;

    expect(() =>
      makeShellShape(oc, {} as never, {
        target: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 1
          },
          depth: 1
        },
        wallThickness: 0.1,
        openFaceStableIds: []
      })
    ).toThrow("Injected shell face-list failure");
    expect(deleted).toEqual(["maker"]);
  });

  it("disposes partial loft setup after builder construction fails", () => {
    const deleted: string[] = [];
    class Progress {
      delete() {
        deleted.push("progress");
      }
    }
    class FailingLoftBuilder {
      constructor() {
        throw new Error("Injected loft builder failure.");
      }
    }
    const oc = {
      Message_ProgressRange_1: Progress,
      BRepOffsetAPI_ThruSections: FailingLoftBuilder
    } as unknown as OpenCascadeInstance;
    const section = {
      sketchPlane: "XY" as const,
      profile: {
        kind: "rectangle" as const,
        center: [0, 0] as const,
        width: 2,
        height: 1
      }
    };

    expect(() => makeLoftShape(oc, { sections: [section, section] })).toThrow(
      "Injected loft builder failure"
    );
    expect(deleted).toEqual(["progress"]);
  });

  it("disposes STEP progress after reader construction fails", () => {
    const deleted: string[] = [];
    class Progress {
      delete() {
        deleted.push("progress");
      }
    }
    class FailingReader {
      constructor() {
        throw new Error("Injected STEP reader failure.");
      }
    }
    class ReaderBindings {
      ReadFile() {}
      TransferRoots() {}
      OneShape() {}
    }
    class ShapeFixBindings {
      Init() {}
      Perform() {}
      Shape() {}
    }
    const oc = {
      Message_ProgressRange_1: Progress,
      STEPControl_Reader_1: FailingReader,
      STEPControl_Reader: ReaderBindings,
      ShapeFix_Shape_1: ShapeFixBindings,
      ShapeFix_Shape: ShapeFixBindings,
      IFSelect_ReturnStatus: { IFSelect_RetDone: 1 },
      BRepTools: { Write_3() {} },
      FS: {
        writeFile() {},
        readFile() {
          return new Uint8Array();
        },
        unlink() {}
      },
      TopExp: { MapShapes_1() {} }
    } as unknown as OpenCascadeInstance;

    expect(() =>
      createOcctStepImportWithInstance(oc, {
        sourceFileName: "failure.step",
        bytes: new Uint8Array([1])
      })
    ).toThrow("Injected STEP reader failure");
    expect(deleted).toEqual(["progress"]);
  });

  it("disposes partial hole axes and its target after direction failure", () => {
    const deleted: string[] = [];
    let pointIndex = 0;
    let directionIndex = 0;
    let axisIndex = 0;
    class Point {
      readonly #label: string;
      constructor() {
        pointIndex += 1;
        this.#label = `point-${pointIndex}`;
      }
      delete() {
        deleted.push(this.#label);
      }
    }
    class Direction {
      readonly #label: string;
      constructor() {
        directionIndex += 1;
        if (directionIndex === 4) {
          throw new Error("Injected hole x-direction failure.");
        }
        this.#label = `direction-${directionIndex}`;
      }
      delete() {
        deleted.push(this.#label);
      }
    }
    class Axis {
      readonly #label: string;
      constructor() {
        axisIndex += 1;
        this.#label = `axis-${axisIndex}`;
      }
      delete() {
        deleted.push(this.#label);
      }
    }
    class TargetShape {
      delete() {
        deleted.push("target-shape");
      }
    }
    class BoxBuilder {
      Shape() {
        return new TargetShape();
      }
      delete() {
        deleted.push("box-builder");
      }
    }
    class UnusedBinding {}
    const oc = {
      gp_Pnt_3: Point,
      gp_Dir_4: Direction,
      gp_Ax2_2: Axis,
      BRepPrimAPI_MakeBox_5: BoxBuilder,
      BRepPrimAPI_MakeCylinder_3: UnusedBinding,
      BRepAlgoAPI_Cut_3: UnusedBinding,
      BRepCheck_Analyzer: UnusedBinding,
      BRepGProp: { VolumeProperties_1() {} },
      GProp_GProps_1: UnusedBinding,
      Message_ProgressRange_1: UnusedBinding,
      BRepBndLib: { AddOptimal() {} },
      Bnd_Box_1: UnusedBinding
    } as unknown as OpenCascadeInstance;

    expect(() =>
      withOcctHoleResultShape(
        oc,
        {
          target: occtBooleanRecipePrimitive,
          tool: {
            sketchPlane: "XY",
            circle: { kind: "circle", center: [0, 0], radius: 0.5 },
            depthMode: "blind",
            depth: 1
          }
        },
        () => undefined
      )
    ).toThrow("Injected hole x-direction failure");
    expect(deleted).toEqual([
      "axis-1",
      "direction-2",
      "direction-1",
      "point-1",
      "direction-3",
      "point-2",
      "target-shape",
      "box-builder"
    ]);
  });

  it.each([
    [
      "cylinder",
      "BRepPrimAPI_MakeCylinder_1",
      (oc: OpenCascadeInstance) =>
        createOcctCylinderMeshWithInstance(oc, { radius: 1, height: 2 })
    ],
    [
      "sphere",
      "BRepPrimAPI_MakeSphere_1",
      (oc: OpenCascadeInstance) =>
        createOcctSphereMeshWithInstance(oc, { radius: 1 })
    ],
    [
      "cone",
      "BRepPrimAPI_MakeCone_1",
      (oc: OpenCascadeInstance) =>
        createOcctConeMeshWithInstance(oc, { radius: 1, height: 2 })
    ],
    [
      "torus",
      "BRepPrimAPI_MakeTorus_1",
      (oc: OpenCascadeInstance) =>
        createOcctTorusMeshWithInstance(oc, {
          majorRadius: 2,
          minorRadius: 0.5
        })
    ]
  ] as const)(
    "disposes a %s result shape when mesher construction fails",
    (primitive, builderName, createMesh) => {
      const deleted: string[] = [];
      class Shape {
        delete() {
          deleted.push("shape");
        }
      }
      class PrimitiveBuilder {
        Shape() {
          return new Shape();
        }
        delete() {
          deleted.push(`${primitive}-builder`);
        }
      }
      class FailingMesher {
        constructor() {
          throw new Error(`Injected ${primitive} mesher failure.`);
        }
      }
      const oc = {
        [builderName]: PrimitiveBuilder,
        BRepMesh_IncrementalMesh_2: FailingMesher
      } as unknown as OpenCascadeInstance;

      expect(() => createMesh(oc)).toThrow(
        `Injected ${primitive} mesher failure`
      );
      expect(deleted).toEqual(["shape", `${primitive}-builder`]);
    }
  );

  it("disposes empty face triangulation wrappers", () => {
    const deleted: string[] = [];
    class CurrentShape {
      delete() {
        deleted.push("current-shape");
      }
    }
    class Face {
      delete() {
        deleted.push("face");
      }
    }
    class Explorer {
      #more = true;
      More() {
        return this.#more;
      }
      Current() {
        return new CurrentShape();
      }
      Next() {
        this.#more = false;
      }
      delete() {
        deleted.push("explorer");
      }
    }
    class Location {
      delete() {
        deleted.push("location");
      }
    }
    class TriangulationHandle {
      IsNull() {
        return true;
      }
      delete() {
        deleted.push("triangulation-handle");
      }
    }
    const oc = {
      TopAbs_ShapeEnum: {
        TopAbs_FACE: "face",
        TopAbs_SHAPE: "shape"
      },
      TopExp_Explorer_2: Explorer,
      TopoDS: {
        Face_1: () => new Face()
      },
      TopLoc_Location_1: Location,
      BRep_Tool: {
        Triangulation: () => new TriangulationHandle()
      }
    } as unknown as OpenCascadeInstance;

    expect(readTriangulatedShape(oc, {} as never, "box")).toMatchObject({
      faceCount: 0,
      vertexCount: 0,
      triangleCount: 0
    });
    expect(deleted).toEqual([
      "current-shape",
      "triangulation-handle",
      "location",
      "face",
      "explorer"
    ]);
  });

  it("appends a large face without overflowing the call stack", () => {
    const nodeCount = 50_000;
    class Shape {
      delete() {}
    }
    class Explorer {
      #more = true;
      More() {
        return this.#more;
      }
      Current() {
        return new Shape();
      }
      Next() {
        this.#more = false;
      }
      delete() {}
    }
    class Location {
      IsIdentity() {
        return true;
      }
      delete() {}
    }
    class Point {
      constructor(private readonly value: number) {}
      X() {
        return this.value;
      }
      Y() {
        return 0;
      }
      Z() {
        return 0;
      }
      delete() {}
    }
    class Triangle {
      Value(index: number) {
        return index;
      }
      delete() {}
    }
    class Triangulation {
      NbNodes() {
        return nodeCount;
      }
      Node(index: number) {
        return new Point(index);
      }
      NbTriangles() {
        return 1;
      }
      Triangle() {
        return new Triangle();
      }
    }
    class TriangulationHandle {
      IsNull() {
        return false;
      }
      get() {
        return new Triangulation();
      }
      delete() {}
    }
    const oc = {
      TopAbs_ShapeEnum: {
        TopAbs_FACE: "face",
        TopAbs_SHAPE: "shape"
      },
      TopExp_Explorer_2: Explorer,
      TopoDS: {
        Face_1: () => new Shape()
      },
      TopLoc_Location_1: Location,
      BRep_Tool: {
        Triangulation: () => new TriangulationHandle()
      }
    } as unknown as OpenCascadeInstance;

    expect(readTriangulatedShape(oc, {} as never, "box")).toMatchObject({
      vertexCount: nodeCount,
      triangleCount: 1
    });
  });

  it("disposes mesh point transforms after transformation fails", () => {
    const deleted: string[] = [];
    class CurrentShape {
      delete() {
        deleted.push("current-shape");
      }
    }
    class Face {
      delete() {
        deleted.push("face");
      }
    }
    class Explorer {
      #more = true;
      More() {
        return this.#more;
      }
      Current() {
        return new CurrentShape();
      }
      Next() {
        this.#more = false;
      }
      delete() {
        deleted.push("explorer");
      }
    }
    class Transformation {
      delete() {
        deleted.push("transformation");
      }
    }
    class Location {
      IsIdentity() {
        return false;
      }
      Transformation() {
        return new Transformation();
      }
      delete() {
        deleted.push("location");
      }
    }
    class Point {
      Transformed() {
        throw new Error("Injected point transformation failure.");
      }
      delete() {
        deleted.push("point");
      }
    }
    class Triangulation {
      NbNodes() {
        return 1;
      }
      Node() {
        return new Point();
      }
    }
    class TriangulationHandle {
      IsNull() {
        return false;
      }
      get() {
        return new Triangulation();
      }
      delete() {
        deleted.push("triangulation-handle");
      }
    }
    const oc = {
      TopAbs_ShapeEnum: {
        TopAbs_FACE: "face",
        TopAbs_SHAPE: "shape"
      },
      TopExp_Explorer_2: Explorer,
      TopoDS: {
        Face_1: () => new Face()
      },
      TopLoc_Location_1: Location,
      BRep_Tool: {
        Triangulation: () => new TriangulationHandle()
      }
    } as unknown as OpenCascadeInstance;

    expect(() => readTriangulatedShape(oc, {} as never, "box")).toThrow(
      "Injected point transformation failure"
    );
    expect(deleted).toEqual([
      "current-shape",
      "transformation",
      "point",
      "triangulation-handle",
      "location",
      "face",
      "explorer"
    ]);
  });

  it("disposes every allocated wrapper when an exact edge builder fails", () => {
    const deleted: string[] = [];
    class Point {
      delete() {
        deleted.push("point");
      }
    }
    class VertexShape {
      delete() {
        deleted.push("vertex-shape");
      }
    }
    class VertexBuilder {
      Vertex() {
        return new VertexShape();
      }
      delete() {
        deleted.push("vertex-builder");
      }
    }
    class WireBuilder {
      delete() {
        deleted.push("wire-builder");
      }
    }
    class TopologyBuilder {
      UpdateVertex_6() {}
      delete() {
        deleted.push("topology-builder");
      }
    }
    class FailedEdgeBuilder {
      IsDone() {
        return false;
      }
      delete() {
        deleted.push("edge-builder");
      }
    }
    class Direction {
      delete() {
        deleted.push("line-direction");
      }
    }
    class Line {
      delete() {
        deleted.push("line");
      }
    }
    const oc = {
      gp_Pnt_3: Point,
      BRepBuilderAPI_MakeVertex: VertexBuilder,
      BRepBuilderAPI_MakeWire_1: WireBuilder,
      BRep_Builder: TopologyBuilder,
      gp_Dir_4: Direction,
      gp_Lin_3: Line,
      BRepBuilderAPI_MakeEdge_7: FailedEdgeBuilder
    } as unknown as OpenCascadeInstance;
    const lineProfile = {
      ...slotWireProfile,
      sourceIdentity: "failure-lines:a,b",
      segments: [
        {
          kind: "line" as const,
          sourceEntityId: "a",
          start: [0, 0] as const,
          end: [1, 0] as const
        },
        {
          kind: "line" as const,
          sourceEntityId: "b",
          start: [1, 0] as const,
          end: [0, 0] as const
        }
      ]
    };

    expect(() =>
      createOcctWireExtrudeMeshWithInstance(oc, {
        sketchPlane: "XY",
        profile: lineProfile,
        depth: 1
      })
    ).toThrow("failed to build exact line edge for a");
    expect(deleted).toEqual([
      "point",
      "point",
      "topology-builder",
      "line",
      "line-direction",
      "point",
      "wire-builder",
      "edge-builder",
      "vertex-shape",
      "vertex-shape",
      "vertex-builder",
      "vertex-builder"
    ]);
  });

  it.each(["normal-direction", "x-direction", "axis"] as const)(
    "disposes partial primitive axes after injected %s constructor failure",
    (failureStage) => {
      const deleted: string[] = [];
      let directionIndex = 0;
      class Point {
        delete() {
          deleted.push("point");
        }
      }
      class Direction {
        readonly #label: string;
        constructor() {
          directionIndex += 1;
          if (
            (failureStage === "normal-direction" && directionIndex === 1) ||
            (failureStage === "x-direction" && directionIndex === 2)
          ) {
            throw new Error(`Injected ${failureStage} failure.`);
          }
          this.#label = directionIndex === 1 ? "normal" : "x-direction";
        }
        delete() {
          deleted.push(this.#label);
        }
      }
      class Axis {
        constructor() {
          if (failureStage === "axis") {
            throw new Error("Injected axis failure.");
          }
        }
      }
      class UnexpectedBox {
        constructor() {
          throw new Error("Box allocation must not be reached.");
        }
      }
      const oc = {
        gp_Pnt_3: Point,
        gp_Dir_4: Direction,
        gp_Ax2_2: Axis,
        BRepPrimAPI_MakeBox_5: UnexpectedBox
      } as unknown as OpenCascadeInstance;

      expect(() =>
        makeBooleanExtrudeShape(oc, occtBooleanRecipePrimitive)
      ).toThrow(`Injected ${failureStage} failure`);
      expect(deleted).toEqual(
        failureStage === "normal-direction"
          ? ["point"]
          : failureStage === "x-direction"
            ? ["normal", "point"]
            : ["x-direction", "normal", "point"]
      );
    }
  );

  it("disposes a partial circle profile after edge construction fails", () => {
    const deleted: string[] = [];
    let directionIndex = 0;
    class Point {
      delete() {
        deleted.push("point");
      }
    }
    class Direction {
      readonly #label: string;
      constructor() {
        directionIndex += 1;
        this.#label = directionIndex === 1 ? "normal" : "x-direction";
      }
      delete() {
        deleted.push(this.#label);
      }
    }
    class Axis {
      delete() {
        deleted.push("axis");
      }
    }
    class Circle {
      delete() {
        deleted.push("circle");
      }
    }
    class FailingEdgeBuilder {
      constructor() {
        throw new Error("Injected circle edge failure.");
      }
    }
    const oc = {
      gp_Pnt_3: Point,
      gp_Dir_4: Direction,
      gp_Ax2_2: Axis,
      gp_Circ_2: Circle,
      BRepBuilderAPI_MakeEdge_8: FailingEdgeBuilder
    } as unknown as OpenCascadeInstance;

    expect(() =>
      makeProfileFace(
        oc,
        {
          origin: [0, 0, 0],
          uAxis: [1, 0, 0],
          vAxis: [0, 1, 0],
          normalAxis: [0, 0, 1]
        },
        { kind: "circle", center: [0, 0], radius: 1 }
      )
    ).toThrow("Injected circle edge failure");
    expect(deleted).toEqual([
      "circle",
      "axis",
      "x-direction",
      "normal",
      "point"
    ]);
  });

  it("disposes earlier rectangle points after point construction fails", () => {
    const deleted: string[] = [];
    let pointIndex = 0;
    class Point {
      constructor() {
        pointIndex += 1;
        if (pointIndex === 2) {
          throw new Error("Injected rectangle point failure.");
        }
      }
      delete() {
        deleted.push("point");
      }
    }
    class UnexpectedPolygon {
      constructor() {
        throw new Error("Polygon construction must not be reached.");
      }
    }
    const oc = {
      gp_Pnt_3: Point,
      BRepBuilderAPI_MakePolygon_4: UnexpectedPolygon
    } as unknown as OpenCascadeInstance;

    expect(() =>
      makeProfileFace(
        oc,
        {
          origin: [0, 0, 0],
          uAxis: [1, 0, 0],
          vAxis: [0, 1, 0],
          normalAxis: [0, 0, 1]
        },
        { kind: "rectangle", center: [0, 0], width: 2, height: 1 }
      )
    ).toThrow("Injected rectangle point failure");
    expect(deleted).toEqual(["point"]);
  });

  it("disposes boolean target/tool builders when later allocation fails", () => {
    const createPrimitiveOcct = (
      deleted: string[],
      Wire: new () => unknown,
      Progress: new () => unknown
    ) => {
      class Point {
        delete() {
          deleted.push("point");
        }
      }
      class Direction {
        delete() {
          deleted.push("direction");
        }
      }
      class Axes {
        delete() {
          deleted.push("axes");
        }
      }
      class Box {
        delete() {
          deleted.push("box");
        }
      }
      return {
        gp_Pnt_3: Point,
        gp_Dir_4: Direction,
        gp_Ax2_2: Axes,
        BRepPrimAPI_MakeBox_5: Box,
        BRepBuilderAPI_MakeWire_1: Wire,
        Message_ProgressRange_1: Progress
      } as unknown as OpenCascadeInstance;
    };
    const target = {
      sketchPlane: "XY" as const,
      profile: {
        kind: "rectangle" as const,
        center: [0, 0] as const,
        width: 4,
        height: 4
      },
      depth: 4
    };
    const tool = {
      sketchPlane: "XY" as const,
      profile: slotWireProfile,
      depth: 4
    };
    const toolFailureDeleted: string[] = [];
    class FailingWire {
      constructor() {
        throw new Error("Injected wire allocation failure.");
      }
    }
    class UnusedProgress {}
    expect(() =>
      createOcctBooleanExtrudeMeshWithInstance(
        createPrimitiveOcct(toolFailureDeleted, FailingWire, UnusedProgress),
        { operation: "add", target, tool }
      )
    ).toThrow("Injected wire allocation failure");
    expect(toolFailureDeleted).toEqual([
      "axes",
      "direction",
      "direction",
      "point",
      "box"
    ]);

    const progressFailureDeleted: string[] = [];
    class UnusedWire {}
    class FailingProgress {
      constructor() {
        throw new Error("Injected boolean progress failure.");
      }
    }
    expect(() =>
      createOcctBooleanExtrudeMeshWithInstance(
        createPrimitiveOcct(
          progressFailureDeleted,
          UnusedWire,
          FailingProgress
        ),
        {
          operation: "add",
          target,
          tool: {
            ...target,
            profile: { ...target.profile, center: [1, 0] as const }
          }
        }
      )
    ).toThrow("Injected boolean progress failure");
    expect(progressFailureDeleted).toEqual([
      "axes",
      "direction",
      "direction",
      "point",
      "axes",
      "direction",
      "direction",
      "point",
      "box",
      "box"
    ]);
  });

  it.each([
    ["add", "boolean"],
    ["add", "completion"],
    ["add", "errors"],
    ["add", "null"],
    ["add", "invalid"],
    ["add", "analyzer"],
    ["add", "mesh"],
    ["cut", "boolean"],
    ["cut", "completion"],
    ["cut", "errors"],
    ["cut", "null"],
    ["cut", "invalid"],
    ["cut", "analyzer"],
    ["cut", "mesh"]
  ] as const)(
    "disposes composite-%s allocations after injected %s failure",
    (operation, failureStage) => {
      const deleted: string[] = [];
      const makeBuilder = (label: string): OcctBooleanExtrudeShapeBuilder => ({
        Shape: () =>
          ({
            delete: () => deleted.push(`${label}-shape`)
          }) as never,
        delete: () => deleted.push(`${label}-builder`)
      });
      const factories: OcctBooleanExtrudeShapeFactories = {
        target: () => makeBuilder("target"),
        tool: () => makeBuilder("wire-tool")
      };
      class Progress {
        delete() {
          deleted.push("progress");
        }
      }
      class BooleanBuilder {
        constructor() {
          if (failureStage === "boolean") {
            throw new Error("Injected boolean builder failure.");
          }
        }
        HasErrors() {
          return failureStage === "errors";
        }
        IsDone() {
          return failureStage !== "completion";
        }
        Shape() {
          return {
            IsNull: () => failureStage === "null",
            delete: () => deleted.push("result-shape")
          };
        }
        delete() {
          deleted.push("boolean-builder");
        }
      }
      class Analyzer {
        constructor() {
          if (failureStage === "analyzer") {
            throw new Error("Injected analyzer failure.");
          }
        }
        IsValid_2() {
          return failureStage !== "invalid";
        }
        delete() {
          deleted.push("analyzer");
        }
      }
      class Explorer {
        #more = true;
        More() {
          return this.#more;
        }
        Next() {
          this.#more = false;
        }
        delete() {
          deleted.push("explorer");
        }
      }
      class Mesh {
        constructor() {
          throw new Error("Injected mesh failure.");
        }
      }
      const oc = {
        Message_ProgressRange_1: Progress,
        BRepAlgoAPI_Fuse_3: BooleanBuilder,
        BRepAlgoAPI_Cut_3: BooleanBuilder,
        BRepCheck_Analyzer: Analyzer,
        TopExp_Explorer_2: Explorer,
        BRepMesh_IncrementalMesh_2: Mesh,
        TopAbs_ShapeEnum: {
          TopAbs_SOLID: "solid",
          TopAbs_SHAPE: "shape"
        }
      } as unknown as OpenCascadeInstance;
      const target = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 4,
          height: 4
        },
        depth: 4
      };
      const tool = {
        sketchPlane: "XY" as const,
        profile: slotWireProfile,
        depth: 4
      };
      const input =
        operation === "add"
          ? {
              operation: "add" as const,
              target,
              tool
            }
          : {
              operation: "cut" as const,
              target,
              tool
            };

      expect(() =>
        createOcctBooleanExtrudeMeshWithShapeFactories(oc, input, factories)
      ).toThrow(
        failureStage === "completion"
          ? `boolean ${operation} builder did not complete`
          : failureStage === "errors"
            ? `boolean ${operation} failed`
            : failureStage === "null"
              ? `boolean ${operation} returned a null shape`
              : failureStage === "invalid"
                ? `boolean ${operation} returned an invalid shape`
                : `Injected ${failureStage}`
      );
      expect(deleted).toEqual(
        failureStage === "boolean"
          ? [
              "wire-tool-shape",
              "target-shape",
              "progress",
              "wire-tool-builder",
              "target-builder"
            ]
          : failureStage === "completion" || failureStage === "errors"
            ? [
                "wire-tool-shape",
                "target-shape",
                "boolean-builder",
                "progress",
                "wire-tool-builder",
                "target-builder"
              ]
            : failureStage === "analyzer" || failureStage === "null"
              ? [
                  "wire-tool-shape",
                  "target-shape",
                  "result-shape",
                  "boolean-builder",
                  "progress",
                  "wire-tool-builder",
                  "target-builder"
                ]
              : failureStage === "invalid"
                ? [
                    "wire-tool-shape",
                    "target-shape",
                    "analyzer",
                    "result-shape",
                    "boolean-builder",
                    "progress",
                    "wire-tool-builder",
                    "target-builder"
                  ]
                : [
                    "wire-tool-shape",
                    "target-shape",
                    "analyzer",
                    ...(operation === "add" ? ["explorer"] : []),
                    "result-shape",
                    "boolean-builder",
                    "progress",
                    "wire-tool-builder",
                    "target-builder"
                  ]
      );
    }
  );

  it("disposes a composite build when Shape acquisition or reading throws", () => {
    const references: OcctGeneratedReferences = {
      status: "unavailable",
      sourceIdentity: "failure-shape",
      faces: [],
      edges: [],
      diagnostic: "Injected failure evidence."
    };
    const acquiredDeleted: string[] = [];
    const acquisitionBuild = {
      builder: {
        Shape() {
          throw new Error("Injected Shape failure.");
        }
      },
      generatedReferences: references,
      delete() {
        acquiredDeleted.push("build");
      }
    } as unknown as OcctWireExtrudeShapeBuild;
    expect(() =>
      withOcctWireExtrudeBuildShape(acquisitionBuild, () => undefined)
    ).toThrow("Injected Shape failure");
    expect(acquiredDeleted).toEqual(["build"]);

    const readDeleted: string[] = [];
    const readBuild = {
      builder: {
        Shape() {
          return {
            delete() {
              readDeleted.push("shape");
            }
          };
        }
      },
      generatedReferences: references,
      delete() {
        readDeleted.push("build");
      }
    } as unknown as OcctWireExtrudeShapeBuild;
    expect(() =>
      withOcctWireExtrudeBuildShape(readBuild, () => {
        throw new Error("Injected read failure.");
      })
    ).toThrow("Injected read failure");
    expect(readDeleted).toEqual(["shape", "build"]);
  });

  it("rejects composite extrudes unless OCCT returns exactly one solid", () => {
    expect(() => assertWireExtrudeSolidCount(0)).toThrow(
      "must return exactly one solid"
    );
    expect(() => assertWireExtrudeSolidCount(2)).toThrow(
      "must return exactly one solid"
    );
    expect(() => assertWireExtrudeSolidCount(1)).not.toThrow();
  });

  it(
    "rejects empty composite profiles before OCCT wire construction",
    async () => {
      await expect(
        createOcctWireExtrudeMesh({
          sketchPlane: "XY",
          profile: {
            ...slotWireProfile,
            segments: [],
            sourceIdentity: "empty-profile"
          },
          depth: 1
        })
      ).rejects.toThrow("requires at least one source segment");
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it("rejects composite revolves unless the result itself is exactly one solid", () => {
    const solid = "solid";
    expect(() => assertRevolveSolidResult(solid, solid, 1)).not.toThrow();
    for (const [shapeType, solidCount] of [
      ["null", 0],
      ["face", 0],
      ["shell", 0],
      ["wire", 0],
      [solid, 0],
      [solid, 2]
    ] as const) {
      expect(() =>
        assertRevolveSolidResult(shapeType, solid, solidCount)
      ).toThrow("must return exactly one solid");
    }
    expect(() => assertRevolveSolidResult(solid, solid, 2, true)).toThrowError(
      expect.objectContaining({
        code: "SKETCH_REGION_RESULT_NOT_SINGLE_SOLID"
      })
    );
  });

  it("rejects null, invalid, shell, and multi-solid sweep results", () => {
    const solid = "solid";
    expect(() =>
      assertSweepSolidResult(false, true, solid, solid, 1)
    ).not.toThrow();
    for (const args of [
      [true, false, "null", solid, 0],
      [false, false, solid, solid, 1],
      [false, true, "shell", solid, 0],
      [false, true, solid, solid, 2]
    ] as const) {
      expect(() =>
        assertSweepSolidResult(args[0], args[1], args[2], args[3], args[4])
      ).toThrow();
    }
    let curvedError: unknown;
    try {
      assertSweepSolidResult(
        false,
        false,
        solid,
        solid,
        1,
        "SWEEP_CURVED_GEOMETRY_FAILED"
      );
    } catch (error) {
      curvedError = error;
    }
    expect(curvedError).toMatchObject({
      code: "SWEEP_CURVED_GEOMETRY_FAILED"
    });
  });

  it(
    "sweeps rectangle and circle profiles along a line as real OCCT solids",
    async () => {
      const pathSegments = [{ start: [0, 0, 0], end: [0, 0, 5] }] as const;
      const rectangleProfile = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 2,
          height: 3
        }
      };
      const circleProfile = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "circle" as const,
          center: [0, 0] as const,
          radius: 1
        }
      };

      const [rectangleMesh, circleMesh, rectangleMetadata, circleMetadata] =
        await Promise.all([
          createOcctSweepMesh({
            profile: rectangleProfile,
            pathSegments
          }),
          createOcctSweepMesh({ profile: circleProfile, pathSegments }),
          createOcctExactBodyMetadata({
            source: {
              kind: "sweep",
              profile: rectangleProfile,
              pathSegments
            }
          }),
          createOcctExactBodyMetadata({
            source: {
              kind: "sweep",
              profile: circleProfile,
              pathSegments
            }
          })
        ]);

      expect(rectangleMesh).toMatchObject({ primitive: "sweep" });
      expect(rectangleMesh.triangleCount).toBeGreaterThan(0);
      expect(circleMesh).toMatchObject({ primitive: "sweep" });
      expect(circleMesh.triangleCount).toBeGreaterThan(0);
      expect(rectangleMetadata.sourceKind).toBe("sweep");
      expect(rectangleMetadata.volume).toBeCloseTo(30, 5);
      expect(rectangleMetadata.topologyCounts.solidCount).toBe(1);
      expect(circleMetadata.sourceKind).toBe("sweep");
      expect(circleMetadata.volume).toBeCloseTo(5 * Math.PI, 5);
      expect(circleMetadata.topologyCounts.solidCount).toBe(1);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "rebuilds an attached signed arc sweep across mesh, exact, topology, checkpoint, and STEP",
    async () => {
      const profile = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 2,
          height: 1
        },
        placementFrame: {
          origin: [10, 20, 30] as const,
          uAxis: [1, 0, 0] as const,
          vAxis: [0, 1, 0] as const
        }
      };
      const pathSegments = [
        {
          kind: "arc" as const,
          start: [10, 20, 30] as const,
          end: [15, 20, 35] as const,
          center: [15, 20, 30] as const,
          normal: [0, 1, 0] as const,
          sweepAngleDegrees: 90
        }
      ];
      const source = { kind: "sweep" as const, profile, pathSegments };
      const before = JSON.stringify(source);
      const [mesh, metadata, topology, checkpoint, step] = await Promise.all([
        createOcctSweepMesh({ profile, pathSegments }),
        createOcctExactBodyMetadata({ source }),
        createOcctExactTopologySnapshot({ source }),
        createOcctExactTopologyCheckpointPayload({
          checkpointId: "checkpoint_arc_sweep",
          bodyId: "body_arc_sweep",
          source
        }),
        createStepFromSources({
          units: "mm",
          bodies: [{ bodyId: "body_arc_sweep", source }]
        })
      ]);

      expect(mesh).toMatchObject({ primitive: "sweep" });
      expect(mesh.vertexCount).toBeGreaterThan(0);
      expect(metadata.sourceKind).toBe("sweep");
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.volume).toBeCloseTo(5 * Math.PI, 4);
      expect(metadata.bounds.min[0]).toBeGreaterThan(8.9);
      expect(metadata.bounds.min[1]).toBeCloseTo(19.5, 4);
      expect(metadata.bounds.min[2]).toBeGreaterThanOrEqual(29.999);
      expect(metadata.bounds.max[0]).toBeGreaterThan(15);
      expect(metadata.bounds.max[2]).toBeGreaterThan(35);
      expect(topology.sourceKind).toBe("sweep");
      expect(topology.entityCounts.solidCount).toBe(1);
      expect(checkpoint.sourceKind).toBe("sweep");
      expect(checkpoint.brepByteLength).toBeGreaterThan(1000);
      expect(step.bodyCount).toBe(1);
      expect(step.byteLength).toBeGreaterThan(1000);
      expect(JSON.stringify(source)).toBe(before);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "preserves negative signed arc sweep orientation",
    async () => {
      const profile = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "circle" as const,
          center: [0, 0] as const,
          radius: 0.5
        }
      };
      const pathSegments = [
        {
          kind: "arc" as const,
          start: [0, 0, 0] as const,
          end: [5, 0, -5] as const,
          center: [5, 0, 0] as const,
          normal: [0, 1, 0] as const,
          sweepAngleDegrees: -90
        }
      ];
      const metadata = await createOcctExactBodyMetadata({
        source: { kind: "sweep", profile, pathSegments }
      });

      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.volume).toBeCloseTo((5 * Math.PI * Math.PI) / 8, 4);
      expect(metadata.bounds.min[2]).toBeLessThan(-5);
      expect(metadata.bounds.max[2]).toBeLessThanOrEqual(0.001);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "builds one exact solid from a G1 line/arc chain in both orientations",
    async () => {
      const forward = [
        {
          kind: "line" as const,
          start: [0, 0, 0] as const,
          end: [0, 0, 2] as const
        },
        {
          kind: "arc" as const,
          start: [0, 0, 2] as const,
          end: [1, 0, 3] as const,
          center: [1, 0, 2] as const,
          normal: [0, -1, 0] as const,
          sweepAngleDegrees: -90
        }
      ];
      const reverse = [
        {
          kind: "arc" as const,
          start: [1, 0, 3] as const,
          end: [0, 0, 2] as const,
          center: [1, 0, 2] as const,
          normal: [0, -1, 0] as const,
          sweepAngleDegrees: 90
        },
        {
          kind: "line" as const,
          start: [0, 0, 2] as const,
          end: [0, 0, 0] as const
        }
      ];
      const createProfile = (
        origin: readonly [number, number, number],
        uAxis: readonly [number, number, number] = [1, 0, 0],
        vAxis: readonly [number, number, number] = [0, 1, 0]
      ) => ({
        sketchPlane: "XY" as const,
        profile: {
          kind: "circle" as const,
          center: [0, 0] as const,
          radius: 0.2
        },
        placementFrame: {
          origin,
          uAxis,
          vAxis
        }
      });
      const [forwardMesh, reverseMesh, forwardMetadata, reverseMetadata] =
        await Promise.all([
          createOcctSweepMesh({
            profile: createProfile([0, 0, 0]),
            pathSegments: forward
          }),
          createOcctSweepMesh({
            profile: createProfile([1, 0, 3], [0, -1, 0], [0, 0, 1]),
            pathSegments: reverse
          }),
          createOcctExactBodyMetadata({
            source: {
              kind: "sweep",
              profile: createProfile([0, 0, 0]),
              pathSegments: forward
            }
          }),
          createOcctExactBodyMetadata({
            source: {
              kind: "sweep",
              profile: createProfile([1, 0, 3], [0, -1, 0], [0, 0, 1]),
              pathSegments: reverse
            }
          })
        ]);

      expect(forwardMesh.triangleCount).toBeGreaterThan(0);
      expect(reverseMesh.triangleCount).toBeGreaterThan(0);
      expect(forwardMetadata.topologyCounts.solidCount).toBe(1);
      expect(reverseMetadata.topologyCounts.solidCount).toBe(1);
      expect(forwardMetadata.volume).toBeCloseTo(reverseMetadata.volume, 5);
      expect(forwardMetadata.volume).toBeCloseTo(
        (2 + Math.PI / 2) * Math.PI * 0.2 * 0.2,
        3
      );
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "lofts separated rectangle and circle sections as a real OCCT solid",
    async () => {
      const sections = [
        {
          sketchPlane: "XY" as const,
          profile: {
            kind: "rectangle" as const,
            center: [0, 0] as const,
            width: 4,
            height: 3
          }
        },
        {
          sketchPlane: "XY" as const,
          profile: {
            kind: "circle" as const,
            center: [0, 0] as const,
            radius: 1
          },
          placementFrame: {
            origin: [0, 0, 5] as const,
            uAxis: [1, 0, 0] as const,
            vAxis: [0, 1, 0] as const
          }
        }
      ];
      const [mesh, metadata] = await Promise.all([
        createOcctLoftMesh({ sections }),
        createOcctExactBodyMetadata({
          source: { kind: "loft", sections }
        })
      ]);

      expect(mesh).toMatchObject({ primitive: "loft" });
      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect(metadata.sourceKind).toBe("loft");
      expect(metadata.bounds.min[2]).toBeCloseTo(0, 6);
      expect(metadata.bounds.max[2]).toBeCloseTo(5, 6);
      expect(metadata.volume).toBeGreaterThan(0);
      expect(metadata.topologyCounts.solidCount).toBe(1);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "reports STEP writer bindings as available through the isolated boundary",
    async () => {
      const capability = await getOcctStepWriterCapability();

      expect(capability).toMatchObject({
        format: "step",
        status: "available",
        writerAvailable: true,
        namedWriterAvailable: true,
        boundary: "occt-wasm",
        packageName: "opencascade.js"
      });
      expect(capability.missingBindings).toEqual([]);
      expect(capability.availableBindings).toContain("STEPControl_Writer_1");
      expect(capability.availableBindings).toContain("FS.readFile");
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "reports basic and named STEP writer capability separately",
    async () => {
      const oc = await loadOcct();
      const withoutNames = new Proxy(oc, {
        get(target, candidate) {
          return candidate === "TDataStd_Name"
            ? undefined
            : Reflect.get(target, candidate);
        }
      }) as OpenCascadeInstance;

      expect(
        getOcctStepWriterCapabilityWithInstance(withoutNames)
      ).toMatchObject({
        status: "unavailable",
        writerAvailable: true,
        namedWriterAvailable: false,
        missingBindings: ["TDataStd_Name.Set_1"]
      });
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "cleans named STEP documents and temporary files after controller, transfer, write, and read failures",
    async () => {
      const oc = await loadOcct();
      const files = () => ({
        root: [...oc.FS.readdir("/")].sort(),
        tmp: [...oc.FS.readdir("/tmp")].sort()
      });
      const artifact = createOcctExactBodyArtifactWithInstance(oc, {
        source: {
          kind: "box",
          dimensions: { width: 2, height: 3, depth: 4 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      });
      const input = {
        units: "mm" as const,
        bodies: ["first", "second"].map((bodyId) => ({
          bodyId,
          bodyName: "Duplicate Ω",
          brepFormat: artifact.brepFormat,
          brepByteLength: artifact.brepByteLength,
          brepSha256: "0".repeat(64),
          brepBytes: artifact.brepBytes
        }))
      };
      const before = files();
      const override = (
        key: keyof OpenCascadeInstance,
        value: unknown
      ): OpenCascadeInstance =>
        new Proxy(oc, {
          get(target, candidate) {
            return candidate === key ? value : Reflect.get(target, candidate);
          }
        }) as OpenCascadeInstance;
      const writerFailure = (method: "Transfer_1" | "Write") =>
        new Proxy(oc.STEPCAFControl_Writer_1, {
          construct(Target, args) {
            const writer = Reflect.construct(Target, args) as object;
            return new Proxy(writer, {
              get(target, candidate) {
                if (candidate === method) return () => false;
                const value = Reflect.get(target, candidate);
                return typeof value === "function" ? value.bind(target) : value;
              }
            });
          }
        });
      const controller = new Proxy(oc.STEPCAFControl_Controller, {
        get(target, candidate) {
          return candidate === "Init"
            ? () => false
            : Reflect.get(target, candidate);
        }
      });
      const emptyStepFs = new Proxy(oc.FS, {
        get(target, candidate) {
          if (candidate === "readFile") return () => new Uint8Array();
          const value = Reflect.get(target, candidate);
          return typeof value === "function" ? value.bind(target) : value;
        }
      });
      const failures: readonly [OpenCascadeInstance, RegExp][] = [
        [override("STEPCAFControl_Controller", controller), /controller/i],
        [
          override("STEPCAFControl_Writer_1", writerFailure("Transfer_1")),
          /transfer/i
        ],
        [override("STEPCAFControl_Writer_1", writerFailure("Write")), /write/i],
        [override("FS", emptyStepFs), /empty bytes/i]
      ];

      for (const [instance, message] of failures) {
        expect(() => createOcctStepExportWithInstance(instance, input)).toThrow(
          message
        );
        expect(files()).toEqual(before);
      }
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it("reports every missing named STEP probe binding", () => {
    const capability = getOcctNamedStepProbeCapabilityWithInstance({});

    expect(capability).toMatchObject({
      status: "unavailable",
      namedStepAvailable: false
    });
    expect(capability.availableBindings).toEqual([]);
    expect(capability.missingBindings).toEqual(capability.checkedBindings);
  });

  it(
    "round-trips duplicate Unicode XDE names and all units through real OCCT",
    async () => {
      const result = runOcctNamedStepProbeWithInstance(await loadOcct());

      expect(result.ok).toBe(true);
      expect(result.capability).toMatchObject({
        status: "available",
        namedStepAvailable: true,
        missingBindings: []
      });
      expect(result.units.map(({ unit }) => unit)).toEqual([
        "mm",
        "cm",
        "m",
        "in"
      ]);
      for (const unit of result.units) {
        expect(unit).toMatchObject({
          schema: "AP242DIS",
          bodyCount: 2,
          names: result.expectedNames,
          nonNullShapeCount: 2
        });
        expect(unit.fileSchemas).toHaveLength(1);
        expect(unit.fileSchemas[0]).toMatch(/^AP242_/);
        expect(unit.stepByteLength).toBeGreaterThan(1_000);
        expect(unit.brepByteLength).toBeGreaterThan(100);
        expect(unit.fileUnits.length).toBeGreaterThan(0);
      }
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "preserves physical scale for every document unit through STEP re-import",
    async () => {
      const scaleToMillimetres = { mm: 1, cm: 10, m: 1_000, in: 25.4 } as const;

      for (const unit of ["mm", "cm", "m", "in"] as const) {
        const artifact = await createStepFromSources({
          units: unit,
          bodies: [
            {
              bodyId: `body_step_scale_${unit}`,
              source: {
                kind: "box",
                dimensions: { width: 2, height: 3, depth: 4 },
                transform: {
                  translation: [0, 0, 0],
                  rotation: [0, 0, 0],
                  scale: [1, 1, 1]
                }
              }
            }
          ]
        });
        const imported = await createOcctStepImport({
          sourceFileName: `scale-${unit}.step`,
          bytes: artifact.bytes,
          maxBodyCount: 1
        });
        const body = imported.bodies[0];
        if (!body) throw new Error(`Expected ${unit} STEP body.`);
        const metadata = await createOcctExactBodyMetadata({
          source: {
            kind: "importedBody",
            brepBytes: body.checkpointPayload.brepBytes
          }
        });
        const scale = scaleToMillimetres[unit];
        expect(metadata.volume).toBeCloseTo(24 * scale ** 3, 4);
        expect(metadata.surfaceArea).toBeCloseTo(52 * scale ** 2, 4);
        expect(metadata.bounds.max[0] - metadata.bounds.min[0]).toBeCloseTo(
          2 * scale,
          5
        );
        expect(metadata.bounds.max[1] - metadata.bounds.min[1]).toBeCloseTo(
          3 * scale,
          5
        );
        expect(metadata.bounds.max[2] - metadata.bounds.min[2]).toBeCloseTo(
          4 * scale,
          5
        );
      }
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "reports BRep checkpoint writer bindings as available through the isolated boundary",
    async () => {
      const capability = await getOcctBrepCheckpointWriterCapability();

      expect(capability).toMatchObject({
        format: "occt-brep",
        status: "available",
        writerAvailable: true,
        boundary: "occt-wasm",
        packageName: "opencascade.js"
      });
      expect(capability.missingBindings).toEqual([]);
      expect(capability.availableBindings).toContain("BRepTools.Write_3");
      expect(capability.availableBindings).toContain("FS.readFile");
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "reports STEP reader and healing bindings as available through the isolated boundary",
    async () => {
      const capability = await getOcctStepReaderCapability();

      expect(capability).toMatchObject({
        format: "step",
        status: "available",
        readerAvailable: true,
        healingAvailable: true,
        checkpointWriterAvailable: true,
        boundary: "occt-wasm",
        packageName: "opencascade.js"
      });
      expect(capability.missingBindings).toEqual([]);
      expect(capability.availableBindings).toContain("STEPControl_Reader_1");
      expect(capability.availableBindings).toContain("ShapeFix_Shape_1");
      expect(capability.availableBindings).toContain("BRepTools.Write_3");
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "exports a rectangle extrude as real STEP bytes through Open CASCADE WASM",
    async () => {
      const artifact = await createStepFromSources({
        units: "mm",
        bodies: [
          {
            bodyId: "body_step_rect",
            source: {
              kind: "extrude",
              sketchPlane: "XY",
              profile: {
                kind: "rectangle",
                center: [0, 0],
                width: 2,
                height: 1
              },
              depth: 3,
              side: "positive"
            }
          }
        ]
      });
      const text = new TextDecoder().decode(artifact.bytes);

      expect(artifact).toMatchObject({
        format: "step",
        schema: "AP242DIS",
        units: "mm",
        bodyCount: 1
      });
      expect(artifact.byteLength).toBeGreaterThan(1000);
      expect(text).toContain("ISO-10303-21");
      expect(text).toContain("SI_UNIT(.MILLI.,.METRE.)");
      expect(text).not.toContain("mesh");
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "imports real STEP bytes into transient imported body and checkpoint payloads through Open CASCADE WASM",
    async () => {
      const artifact = await createStepFromSources({
        units: "mm",
        bodies: [
          {
            bodyId: "body_step_import_source",
            source: {
              kind: "extrude",
              sketchPlane: "XY",
              profile: {
                kind: "rectangle",
                center: [0, 0],
                width: 2,
                height: 1
              },
              depth: 3,
              side: "positive"
            }
          }
        ]
      });
      const importResult = await createOcctStepImport({
        sourceFileName: "roundtrip-import.step",
        bytes: artifact.bytes,
        maxBodyCount: 1,
        bodyId: "body_imported_roundtrip",
        checkpointId: "checkpoint_imported_roundtrip"
      });
      const body = importResult.bodies[0];
      if (!body) {
        throw new Error("Expected one imported STEP body.");
      }
      const brepText = new TextDecoder().decode(
        body.checkpointPayload.brepBytes
      );
      const importedMetadata = await createOcctExactBodyMetadata({
        source: {
          kind: "importedBody",
          brepBytes: body.checkpointPayload.brepBytes
        }
      });

      expect(importResult).toMatchObject({
        sourceFormat: "step",
        sourceFileName: "roundtrip-import.step",
        bodyCount: 1
      });
      expect(body).toMatchObject({
        sourceFormat: "step",
        sourceFileName: "roundtrip-import.step",
        bodyName: "roundtrip-import",
        shapeType: "solid",
        solidCount: 1,
        checkpointPayload: {
          checkpointId: "checkpoint_imported_roundtrip",
          bodyId: "body_imported_roundtrip",
          sourceKind: "importedBody",
          brepFormat: "occt-brep",
          brepWriter: "BRepTools.Write_3"
        }
      });
      expect(body.faceCount).toBeGreaterThanOrEqual(6);
      expect(body.edgeCount).toBeGreaterThan(0);
      expect(body.vertexCount).toBeGreaterThan(0);
      expect(body.topologySnapshot).toMatchObject({
        sourceKind: "importedBody",
        source: "kernel-derived",
        signatureAlgorithm: "partbench-derived-topology-snapshot-v1"
      });
      expect(body.checkpointPayload.brepByteLength).toBe(
        body.checkpointPayload.brepBytes.byteLength
      );
      expect(body.checkpointPayload.brepByteLength).toBeGreaterThan(1000);
      expect(brepText).toContain("CASCADE Topology");
      expect(importedMetadata.sourceKind).toBe("importedBody");
      expect(importedMetadata.volume).toBeCloseTo(6, 6);
      expect(importedMetadata.momentsOfInertia.xx).toBeGreaterThan(0);
      expect(body.checkpointPayload.signaturePayload).toMatchObject({
        checkpointId: "checkpoint_imported_roundtrip",
        signature: body.topologySnapshot.signature,
        entityCount: body.topologySnapshot.entityCount
      });
      expect(
        importResult.diagnostics.map((diagnostic) => diagnostic.code)
      ).toEqual(
        expect.arrayContaining([
          "STEP_READER_AVAILABLE",
          "STEP_TRANSFER_COMPLETE",
          "STEP_TOPOLOGY_EXTRACTED",
          "STEP_CHECKPOINT_PAYLOAD_CREATED"
        ])
      );
      expect(body.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
        body.healingApplied
          ? "STEP_HEALING_APPLIED"
          : "STEP_HEALING_NOT_REQUIRED"
      );
      expect(JSON.stringify(importResult)).not.toMatch(
        /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex/i
      );
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "rejects corrupt STEP bytes before creating imported body payloads",
    async () => {
      await expect(
        createOcctStepImport({
          sourceFileName: "corrupt.step",
          bytes: new TextEncoder().encode("not a STEP file")
        })
      ).rejects.toThrow(/STEP|Open CASCADE/i);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "creates real BRep checkpoint bytes and matching topology payloads through Open CASCADE WASM",
    async () => {
      const checkpointPayload = await createOcctExactTopologyCheckpointPayload({
        checkpointId: "checkpoint_occt_rect",
        bodyId: "body_occt_rect",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [1, 2],
            width: 4,
            height: 3
          },
          depth: 5
        }
      });
      const brepText = new TextDecoder().decode(checkpointPayload.brepBytes);

      expect(checkpointPayload).toMatchObject({
        checkpointId: "checkpoint_occt_rect",
        bodyId: "body_occt_rect",
        sourceKind: "extrude",
        brepFormat: "occt-brep",
        brepWriter: "BRepTools.Write_3"
      });
      expect(checkpointPayload.brepByteLength).toBe(
        checkpointPayload.brepBytes.byteLength
      );
      expect(checkpointPayload.brepByteLength).toBeGreaterThan(1000);
      expect(brepText).toContain("CASCADE Topology");
      expect(checkpointPayload.topologySnapshot).toMatchObject({
        sourceKind: "extrude",
        source: "kernel-derived",
        signatureAlgorithm: "partbench-derived-topology-snapshot-v1"
      });
      expect(checkpointPayload.signaturePayload).toEqual({
        checkpointId: "checkpoint_occt_rect",
        signatureAlgorithm:
          checkpointPayload.topologySnapshot.signatureAlgorithm,
        signature: checkpointPayload.topologySnapshot.signature,
        entityCount: checkpointPayload.topologySnapshot.entityCount,
        entities: checkpointPayload.topologySnapshot.entities.map((entity) => ({
          localId: entity.localId,
          kind: entity.kind,
          signature: entity.signature
        }))
      });
      expect(checkpointPayload.topologySnapshot.entities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "face",
            surfaceClass: "plane",
            area: expect.any(Number)
          }),
          expect.objectContaining({
            kind: "edge",
            curveClass: "line",
            length: expect.any(Number)
          })
        ])
      );
      expect(checkpointPayload.signaturePayload.entities).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            surfaceClass: expect.any(String)
          }),
          expect.objectContaining({
            curveClass: expect.any(String)
          }),
          expect.objectContaining({
            area: expect.any(Number)
          }),
          expect.objectContaining({
            length: expect.any(Number)
          })
        ])
      );
      expect(JSON.stringify(checkpointPayload)).not.toMatch(
        /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex/i
      );
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "isolates corrupt checkpoint reads and cleans artifact files across builder, validation, write, metadata, and topology faults",
    async () => {
      const oc = await loadOcct();
      const files = () => ({
        root: [...oc.FS.readdir("/")].sort(),
        tmp: [...oc.FS.readdir("/tmp")].sort()
      });
      const before = files();
      expect(() =>
        createOcctExactBodyArtifactWithInstance(oc, {
          source: {
            kind: "checkpointBody",
            brepBytes: new TextEncoder().encode("corrupt BRep"),
            brepByteLength: 12,
            brepSha256: "0".repeat(64),
            topologySourceKind: "importedBody",
            topologySignature: "corrupt"
          }
        })
      ).toThrow(/BRep checkpoint/i);
      expect(files()).toEqual(before);

      const source = {
        kind: "extrude" as const,
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 2,
          height: 3
        },
        depth: 4
      };
      const override = (
        key: keyof OpenCascadeInstance,
        value: unknown
      ): OpenCascadeInstance =>
        new Proxy(oc, {
          get(target, candidate) {
            return candidate === key ? value : Reflect.get(target, candidate);
          }
        }) as OpenCascadeInstance;

      const failures: readonly [string, OpenCascadeInstance][] = [
        [
          "builder",
          override(
            "BRepPrimAPI_MakeBox_5",
            class {
              constructor() {
                throw new Error("Injected builder failure.");
              }
            }
          )
        ],
        [
          "validation",
          override(
            "BRepCheck_Analyzer",
            class {
              IsValid_2() {
                return false;
              }
              delete() {}
            }
          )
        ],
        [
          "write",
          override(
            "BRepTools",
            new Proxy(oc.BRepTools, {
              get(target, candidate) {
                return candidate === "Write_3"
                  ? () => false
                  : Reflect.get(target, candidate);
              }
            })
          )
        ],
        [
          "metadata",
          override(
            "BRepBndLib",
            new Proxy(oc.BRepBndLib, {
              get(target, candidate) {
                if (candidate === "AddOptimal") {
                  return () => {
                    throw new Error("Injected metadata failure.");
                  };
                }
                return Reflect.get(target, candidate);
              }
            })
          )
        ],
        [
          "topology",
          (() => {
            let calls = 0;
            return override(
              "TopExp",
              new Proxy(oc.TopExp, {
                get(target, candidate) {
                  if (candidate === "MapShapes_1") {
                    return (
                      ...args: Parameters<typeof oc.TopExp.MapShapes_1>
                    ) => {
                      calls += 1;
                      if (calls === 5) {
                        throw new Error("Injected topology failure.");
                      }
                      return oc.TopExp.MapShapes_1(...args);
                    };
                  }
                  return Reflect.get(target, candidate);
                }
              })
            );
          })()
        ],
        [
          "display",
          override(
            "BRepMesh_IncrementalMesh_2",
            class {
              constructor() {
                throw new Error("Injected display failure.");
              }
            }
          )
        ]
      ];

      for (const [stage, instance] of failures) {
        expect(() =>
          createOcctExactBodyArtifactWithInstance(instance, { source })
        ).toThrow(
          stage === "validation" ? /not valid/i : new RegExp(stage, "i")
        );
        expect(files(), stage).toEqual(before);
      }
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "derives matching display and metadata for imported and checkpoint-backed downstream bodies",
    async () => {
      const oc = await loadOcct();
      const checkpoint = await createOcctExactTopologyCheckpointPayload({
        checkpointId: "checkpoint_exact_result_parity",
        bodyId: "body_exact_result_parity",
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [1, 2],
            width: 4,
            height: 3
          },
          depth: 5
        }
      });
      const checkpointBody = {
        kind: "checkpointBody" as const,
        brepBytes: checkpoint.brepBytes,
        brepByteLength: checkpoint.brepByteLength,
        brepSha256: "0".repeat(64),
        topologySourceKind: checkpoint.sourceKind,
        topologySignature: checkpoint.topologySnapshot.signature
      };
      const edge = checkpoint.topologySnapshot.entities.find(
        (entity) => entity.kind === "edge"
      );
      expect(edge).toBeDefined();
      const sources: readonly StepTestSource[] = [
        checkpointBody,
        {
          kind: "checkpointBoolean",
          operation: "add",
          target: checkpointBody,
          tool: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [3, 2],
              width: 2,
              height: 2
            },
            depth: 5,
            side: "positive"
          }
        },
        {
          kind: "checkpointHole",
          target: checkpointBody,
          tool: {
            sketchPlane: "XY",
            circle: { kind: "circle", center: [1, 2], radius: 0.5 },
            depthMode: "throughAll"
          }
        },
        {
          kind: "checkpointEdgeFinish",
          operation: "chamfer",
          target: checkpointBody,
          checkpointEntityId: edge!.localId,
          amount: 0.2
        }
      ];
      const filesBefore = [...oc.FS.readdir("/tmp")].sort();

      for (const source of sources) {
        const mesh = createOcctExactBodyMeshWithInstance(oc, { source });
        const metadata = createOcctExactBodyArtifactMetadataWithInstance(oc, {
          source
        });
        expect(mesh.triangleCount).toBeGreaterThan(0);
        expect(mesh.vertexCount).toBeGreaterThan(0);
        expect(metadata.volume).toBeGreaterThan(0);
        expect(metadata.topologyCounts.solidCount).toBeGreaterThan(0);
      }
      expect([...oc.FS.readdir("/tmp")].sort()).toEqual(filesBefore);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "parses one verified artifact leaf once for hole, pattern, mirror, and local-face shell results",
    async () => {
      const oc = await loadOcct();
      const seed = createOcctExactBodyArtifactWithInstance(oc, {
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [4, 0],
            width: 4,
            height: 4
          },
          depth: 4,
          side: "positive"
        }
      });
      const leaf = createBodyArtifactTestLeaf(seed);
      const face = seed.topologySnapshot.entities.find(
        (entity) => entity.kind === "face"
      );
      expect(face).toBeDefined();
      const sources: readonly {
        readonly expectedKind:
          | "hole"
          | "linearPattern"
          | "circularPattern"
          | "mirror"
          | "shell";
        readonly source: StepTestSource;
      }[] = [
        {
          expectedKind: "hole",
          source: {
            kind: "artifactHole",
            target: leaf,
            tool: {
              sketchPlane: "XY",
              circle: { kind: "circle", center: [4, 0], radius: 0.5 },
              depthMode: "blind",
              depth: 2,
              direction: "positive"
            }
          }
        },
        {
          expectedKind: "linearPattern",
          source: {
            kind: "artifactLinearPattern",
            seed: leaf,
            direction: [1, 0, 0],
            spacing: 8,
            instanceCount: 2
          }
        },
        {
          expectedKind: "circularPattern",
          source: {
            kind: "artifactCircularPattern",
            seed: leaf,
            axis: { origin: [0, 0, 0], direction: [0, 0, 1] },
            totalAngleDegrees: 180,
            instanceCount: 2
          }
        },
        {
          expectedKind: "mirror",
          source: {
            kind: "artifactMirror",
            seed: leaf,
            plane: { point: [0, 0, 0], normal: [1, 0, 0] },
            includeOriginal: true
          }
        },
        {
          expectedKind: "shell",
          source: {
            kind: "artifactShell",
            target: {
              ...leaf,
              shapePolicy: "singleShapeOneOrMoreSolids"
            },
            wallThickness: 0.2,
            openFaces: [{ localId: face!.localId }]
          }
        }
      ];
      const files = () => ({
        root: [...oc.FS.readdir("/")].sort(),
        tmp: [...oc.FS.readdir("/tmp")].sort()
      });
      const meshMeasures = (mesh: typeof seed.displayMesh) => {
        let surfaceArea = 0;
        let signedVolume = 0;
        for (let index = 0; index < mesh.indices.length; index += 3) {
          const vertices = [0, 1, 2].map((offset) => {
            const vertexIndex = mesh.indices[index + offset]! * 3;
            return [
              mesh.positions[vertexIndex]!,
              mesh.positions[vertexIndex + 1]!,
              mesh.positions[vertexIndex + 2]!
            ] as const;
          });
          const [a, b, c] = vertices;
          const ab = [b![0] - a![0], b![1] - a![1], b![2] - a![2]];
          const ac = [c![0] - a![0], c![1] - a![1], c![2] - a![2]];
          const cross = [
            ab[1]! * ac[2]! - ab[2]! * ac[1]!,
            ab[2]! * ac[0]! - ab[0]! * ac[2]!,
            ab[0]! * ac[1]! - ab[1]! * ac[0]!
          ];
          surfaceArea += Math.hypot(...cross) / 2;
          signedVolume +=
            (a![0] * (b![1] * c![2] - b![2] * c![1]) -
              a![1] * (b![0] * c![2] - b![2] * c![0]) +
              a![2] * (b![0] * c![1] - b![1] * c![0])) /
            6;
        }
        return { surfaceArea, volume: Math.abs(signedVolume) };
      };
      const filesBefore = files();
      let multiSolidArtifact:
        | ReturnType<typeof createOcctExactBodyArtifactWithInstance>
        | undefined;
      const builtArtifacts: {
        readonly kind: (typeof sources)[number]["expectedKind"];
        readonly artifact: ReturnType<
          typeof createOcctExactBodyArtifactWithInstance
        >;
      }[] = [];

      for (const entry of sources) {
        let reads = 0;
        const instance = new Proxy(oc, {
          get(target, candidate) {
            if (candidate !== "BRepTools")
              return Reflect.get(target, candidate);
            return new Proxy(oc.BRepTools, {
              get(brepTools, method) {
                if (method !== "Read_2") return Reflect.get(brepTools, method);
                return (...args: Parameters<typeof oc.BRepTools.Read_2>) => {
                  reads += 1;
                  return oc.BRepTools.Read_2(...args);
                };
              }
            });
          }
        }) as OpenCascadeInstance;
        const artifact = createOcctExactBodyArtifactWithInstance(instance, {
          source: entry.source
        });
        expect(reads, entry.expectedKind).toBe(1);
        expect(artifact.sourceKind).toBe(entry.expectedKind);
        expect(artifact.brepByteLength).toBe(artifact.brepBytes.byteLength);
        expect(artifact.metadata.topologyCounts.solidCount).toBe(
          artifact.topologySnapshot.entityCounts.solidCount
        );
        expect(artifact.displayMesh.vertexCount).toBeGreaterThan(0);
        expect(artifact.displayMesh.triangleCount).toBeGreaterThan(0);
        const displayBounds = {
          min: [
            Number.POSITIVE_INFINITY,
            Number.POSITIVE_INFINITY,
            Number.POSITIVE_INFINITY
          ],
          max: [
            Number.NEGATIVE_INFINITY,
            Number.NEGATIVE_INFINITY,
            Number.NEGATIVE_INFINITY
          ]
        };
        for (
          let index = 0;
          index < artifact.displayMesh.positions.length;
          index += 1
        ) {
          const axis = index % 3;
          const coordinate = artifact.displayMesh.positions[index]!;
          displayBounds.min[axis] = Math.min(
            displayBounds.min[axis]!,
            coordinate
          );
          displayBounds.max[axis] = Math.max(
            displayBounds.max[axis]!,
            coordinate
          );
        }
        for (const axis of [0, 1, 2] as const) {
          expect(displayBounds.min[axis]).toBeCloseTo(
            artifact.metadata.bounds.min[axis],
            2
          );
          expect(displayBounds.max[axis]).toBeCloseTo(
            artifact.metadata.bounds.max[axis],
            2
          );
        }
        const reparsed = createOcctExactBodyArtifactWithInstance(oc, {
          source: {
            ...createBodyArtifactTestLeaf(artifact),
            shapePolicy:
              artifact.metadata.topologyCounts.solidCount === 1
                ? "singleSolid"
                : "singleShapeOneOrMoreSolids"
          }
        });
        expect(reparsed.brepBytes).toBe(artifact.brepBytes);
        expect(reparsed.metadata.topologyCounts).toEqual(
          artifact.metadata.topologyCounts
        );
        expect(reparsed.metadata.volume).toBeCloseTo(
          artifact.metadata.volume,
          8
        );
        expect(reparsed.metadata.surfaceArea).toBeCloseTo(
          artifact.metadata.surfaceArea,
          8
        );
        for (const axis of [0, 1, 2] as const) {
          expect(reparsed.metadata.bounds.min[axis]).toBeCloseTo(
            artifact.metadata.bounds.min[axis],
            8
          );
          expect(reparsed.metadata.bounds.max[axis]).toBeCloseTo(
            artifact.metadata.bounds.max[axis],
            8
          );
          expect(reparsed.metadata.centroid[axis]).toBeCloseTo(
            artifact.metadata.centroid[axis],
            8
          );
        }
        expect(reparsed.displayMesh).toMatchObject({
          vertexCount: artifact.displayMesh.vertexCount,
          triangleCount: artifact.displayMesh.triangleCount,
          faceCount: artifact.displayMesh.faceCount
        });
        const measures = meshMeasures(artifact.displayMesh);
        const reparsedMeasures = meshMeasures(reparsed.displayMesh);
        expect(reparsedMeasures.surfaceArea).toBeCloseTo(
          measures.surfaceArea,
          4
        );
        expect(reparsedMeasures.volume).toBeCloseTo(measures.volume, 4);
        const positions = [...artifact.displayMesh.positions].sort(
          (left, right) => left - right
        );
        const reparsedPositions = [...reparsed.displayMesh.positions].sort(
          (left, right) => left - right
        );
        expect(reparsedPositions).toHaveLength(positions.length);
        for (const [index, coordinate] of positions.entries()) {
          expect(reparsedPositions[index]).toBeCloseTo(coordinate, 5);
        }
        expect(reparsed.topologySnapshot.signature).toBe(
          artifact.topologySnapshot.signature
        );
        if (entry.expectedKind === "linearPattern") {
          multiSolidArtifact = artifact;
        }
        builtArtifacts.push({ kind: entry.expectedKind, artifact });
        expect(files(), entry.expectedKind).toEqual(filesBefore);
      }

      const step = createOcctStepExportWithInstance(oc, {
        units: "mm",
        bodies: builtArtifacts.map(({ kind, artifact }) => ({
          bodyId: `body_v21_1_${kind}`,
          bodyName: `V21.1 ${kind}`,
          brepFormat: artifact.brepFormat,
          brepByteLength: artifact.brepByteLength,
          brepSha256: "0".repeat(64),
          brepBytes: artifact.brepBytes
        }))
      });
      const imported = createOcctStepImportWithInstance(oc, {
        sourceFileName: "v21-1-downstream-roundtrip.step",
        bytes: step.bytes,
        maxBodyCount: builtArtifacts.reduce(
          (count, { artifact }) =>
            count + artifact.metadata.topologyCounts.solidCount,
          0
        )
      });
      expect(imported.bodyCount).toBe(1);
      const importedBody = imported.bodies[0];
      if (!importedBody)
        throw new Error("Expected re-imported downstream body.");
      const importedMetadata = createOcctExactBodyArtifactMetadataWithInstance(
        oc,
        {
          source: {
            kind: "importedBody",
            brepBytes: importedBody.checkpointPayload.brepBytes
          }
        }
      );
      expect(importedMetadata.topologyCounts.solidCount).toBe(
        builtArtifacts.reduce(
          (count, { artifact }) =>
            count + artifact.metadata.topologyCounts.solidCount,
          0
        )
      );
      expect(importedMetadata.volume).toBeCloseTo(
        builtArtifacts.reduce(
          (volume, { artifact }) => volume + artifact.metadata.volume,
          0
        ),
        5
      );
      expect(files()).toEqual(filesBefore);

      let nullShapeDeleted = false;
      let nullCutDeleted = false;
      const nullResultInstance = new Proxy(oc, {
        get(target, candidate) {
          if (candidate !== "BRepAlgoAPI_Cut_3") {
            return Reflect.get(target, candidate);
          }
          return class {
            HasErrors() {
              return false;
            }
            Shape() {
              return {
                IsNull: () => true,
                delete: () => {
                  nullShapeDeleted = true;
                }
              };
            }
            delete() {
              nullCutDeleted = true;
            }
          };
        }
      }) as OpenCascadeInstance;
      expect(() =>
        createOcctExactBodyArtifactWithInstance(nullResultInstance, {
          source: sources[0]!.source
        })
      ).toThrow(/fully removed/i);
      expect({ nullShapeDeleted, nullCutDeleted }).toEqual({
        nullShapeDeleted: true,
        nullCutDeleted: true
      });
      expect(files()).toEqual(filesBefore);

      expect(multiSolidArtifact?.metadata.topologyCounts.solidCount).toBe(2);
      expect(() =>
        createOcctExactBodyArtifactWithInstance(oc, {
          source: createBodyArtifactTestLeaf(multiSolidArtifact!)
        })
      ).toThrow(/shape policy/i);
      expect(files()).toEqual(filesBefore);
      expect(() =>
        createOcctExactBodyArtifactWithInstance(oc, {
          source: { ...leaf, brepByteLength: leaf.brepByteLength + 1 }
        })
      ).toThrow(/artifact leaf/i);
      expect(files()).toEqual(filesBefore);

      expect(() =>
        createOcctExactBodyArtifactWithInstance(oc, {
          source: {
            kind: "artifactHole",
            target: { ...leaf, topologySignature: "fnv1a32:bad00000" },
            tool: {
              sketchPlane: "XY",
              circle: { kind: "circle", center: [4, 0], radius: 0.5 },
              depthMode: "blind",
              depth: 2,
              direction: "positive"
            }
          }
        })
      ).toThrow(/topology signature/i);
      expect(files()).toEqual(filesBefore);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "cuts universal artifact-hole targets in every retained mode with multi-solid atomicity",
    async () => {
      const oc = await loadOcct();
      const files = () => ({
        root: [...oc.FS.readdir("/")].sort(),
        tmp: [...oc.FS.readdir("/tmp")].sort()
      });
      const filesBefore = files();

      for (const direction of ["positive", "negative"] as const) {
        const target = createOcctExactBodyArtifactWithInstance(oc, {
          source: {
            kind: "extrude",
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 4,
              height: 4
            },
            depth: 4,
            side: direction
          }
        });
        const leaf = createBodyArtifactTestLeaf(target);
        for (const depthMode of ["blind", "throughAll"] as const) {
          const artifact = createOcctExactBodyArtifactWithInstance(oc, {
            source: {
              kind: "artifactHole",
              target: leaf,
              tool: {
                sketchPlane: "XY",
                circle: { kind: "circle", center: [0, 0], radius: 0.5 },
                depthMode,
                ...(depthMode === "blind" ? { depth: 2 } : {}),
                direction
              }
            }
          });
          const removedDepth = depthMode === "blind" ? 2 : 4;
          expect(artifact.metadata.volume).toBeCloseTo(
            target.metadata.volume - Math.PI * 0.5 ** 2 * removedDepth,
            5
          );
          expect(artifact.metadata.topologyCounts.solidCount).toBe(1);
          expect(artifact.topologySnapshot.entityCounts.solidCount).toBe(1);
          expect(artifact.displayMesh.triangleCount).toBeGreaterThan(0);
          expect(files(), `${direction}-${depthMode}`).toEqual(filesBefore);
        }
      }

      const seed = createOcctExactBodyArtifactWithInstance(oc, {
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [-4, 0],
            width: 3,
            height: 3
          },
          depth: 4,
          side: "positive"
        }
      });
      const patterned = createOcctExactBodyArtifactWithInstance(oc, {
        source: {
          kind: "artifactLinearPattern",
          seed: createBodyArtifactTestLeaf(seed),
          direction: [1, 0, 0],
          spacing: 8,
          instanceCount: 2
        }
      });
      expect(patterned.metadata.topologyCounts.solidCount).toBe(2);
      const multiLeaf: BodyArtifactTestLeaf = {
        ...createBodyArtifactTestLeaf(patterned),
        shapePolicy: "singleShapeOneOrMoreSolids"
      };
      const partial = createOcctExactBodyArtifactWithInstance(oc, {
        source: {
          kind: "artifactHole",
          target: multiLeaf,
          tool: {
            sketchPlane: "XY",
            circle: { kind: "circle", center: [-4, 0], radius: 0.5 },
            depthMode: "throughAll",
            direction: "positive"
          }
        }
      });
      expect(partial.metadata.topologyCounts.solidCount).toBe(2);
      expect(partial.metadata.volume).toBeCloseTo(
        patterned.metadata.volume - Math.PI,
        5
      );
      expect(partial.metadata.centroid[0]).toBeGreaterThan(0);
      expect(files()).toEqual(filesBefore);

      const all = createOcctExactBodyArtifactWithInstance(oc, {
        source: {
          kind: "artifactHole",
          target: multiLeaf,
          tool: {
            sketchPlane: "XY",
            circle: { kind: "circle", center: [0, 0], radius: 3.5 },
            depthMode: "throughAll",
            direction: "positive"
          }
        }
      });
      expect(all.metadata.topologyCounts.solidCount).toBe(2);
      expect(all.metadata.volume).toBeLessThan(partial.metadata.volume);
      expect(all.metadata.centroid[0]).toBeCloseTo(0, 6);
      expect(files()).toEqual(filesBefore);

      const reparsed = createOcctExactBodyArtifactWithInstance(oc, {
        source: {
          ...createBodyArtifactTestLeaf(partial),
          shapePolicy: "singleShapeOneOrMoreSolids"
        }
      });
      expect(reparsed.topologySnapshot.signature).toBe(
        partial.topologySnapshot.signature
      );
      expect(reparsed.metadata.topologyCounts).toEqual(
        partial.metadata.topologyCounts
      );
      expect(reparsed.metadata.volume).toBeCloseTo(partial.metadata.volume, 8);
      expect(reparsed.metadata.surfaceArea).toBeCloseTo(
        partial.metadata.surfaceArea,
        8
      );
      for (const axis of [0, 1, 2] as const) {
        expect(reparsed.metadata.bounds.min[axis]).toBeCloseTo(
          partial.metadata.bounds.min[axis],
          8
        );
        expect(reparsed.metadata.bounds.max[axis]).toBeCloseTo(
          partial.metadata.bounds.max[axis],
          8
        );
        expect(reparsed.metadata.centroid[axis]).toBeCloseTo(
          partial.metadata.centroid[axis],
          8
        );
      }
      expect(reparsed.displayMesh).toMatchObject({
        vertexCount: partial.displayMesh.vertexCount,
        triangleCount: partial.displayMesh.triangleCount,
        faceCount: partial.displayMesh.faceCount
      });
      expect(files()).toEqual(filesBefore);

      const step = createOcctStepExportWithInstance(oc, {
        units: "mm",
        bodies: [
          {
            bodyId: "body_universal_hole_roundtrip",
            bodyName: "Universal hole round trip",
            brepFormat: partial.brepFormat,
            brepByteLength: partial.brepByteLength,
            brepSha256: "0".repeat(64),
            brepBytes: partial.brepBytes
          }
        ]
      });
      const imported = createOcctStepImportWithInstance(oc, {
        sourceFileName: "universal-hole-roundtrip.step",
        bytes: step.bytes,
        maxBodyCount: 2
      });
      const importedBody = imported.bodies[0];
      if (!importedBody) throw new Error("Expected round-tripped hole body.");
      const importedMetadata = createOcctExactBodyArtifactMetadataWithInstance(
        oc,
        {
          source: {
            kind: "importedBody",
            brepBytes: importedBody.checkpointPayload.brepBytes
          }
        }
      );
      expect(importedMetadata.topologyCounts.solidCount).toBe(2);
      expect(importedMetadata.volume).toBeCloseTo(partial.metadata.volume, 5);
      expect(files()).toEqual(filesBefore);

      for (const [label, radius, message] of [
        ["no-intersection", 1, /positive-volume intersection/i],
        ["tangency", 2.5, /positive-volume intersection|invalid result/i],
        ["full-removal", 10, /fully removed/i]
      ] as const) {
        expect(() =>
          createOcctExactBodyArtifactWithInstance(oc, {
            source: {
              kind: "artifactHole",
              target: multiLeaf,
              tool: {
                sketchPlane: "XY",
                circle: { kind: "circle", center: [0, 0], radius },
                depthMode: "throughAll",
                direction: "positive"
              }
            }
          })
        ).toThrow(message);
        expect(files(), label).toEqual(filesBefore);
      }

      const invalidResultInstance = new Proxy(oc, {
        get(target, candidate) {
          if (candidate !== "BRepCheck_Analyzer") {
            return Reflect.get(target, candidate);
          }
          return class {
            IsValid_2() {
              return false;
            }
            delete() {}
          };
        }
      }) as OpenCascadeInstance;
      expect(() =>
        createOcctExactBodyArtifactWithInstance(invalidResultInstance, {
          source: {
            kind: "artifactHole",
            target: multiLeaf,
            tool: {
              sketchPlane: "XY",
              circle: { kind: "circle", center: [-4, 0], radius: 0.5 },
              depthMode: "throughAll",
              direction: "positive"
            }
          }
        })
      ).toThrow(/invalid result/i);
      expect(files()).toEqual(filesBefore);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "creates and tessellates a box through Open CASCADE WASM",
    async () => {
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
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "creates and tessellates a cylinder through Open CASCADE WASM",
    async () => {
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
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "creates and tessellates a sphere through Open CASCADE WASM",
    async () => {
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
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "creates and tessellates cone and torus primitives through Open CASCADE WASM",
    async () => {
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
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "creates a circle-target rectangle-tool boolean cut through Open CASCADE WASM",
    async () => {
      const mesh = await createOcctBooleanExtrudeMesh({
        operation: "cut",
        target: {
          sketchPlane: "XY",
          profile: {
            kind: "circle",
            center: [0, 0],
            radius: 3
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 6
          },
          depth: 4
        }
      });

      expect(mesh.primitive).toBe("boolean");
      expect(mesh.faceCount).toBeGreaterThan(0);
      expect(mesh.vertexCount).toBeGreaterThan(0);
      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect(mesh.positions).toHaveLength(mesh.vertexCount * 3);
      expect(mesh.indices).toHaveLength(mesh.triangleCount * 3);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it.each(["positive", "negative", "symmetric"] as const)(
    "fuses an exact mixed line/arc composite %s tool into one result solid",
    async (side) => {
      const source = {
        kind: "booleanExtrudes" as const,
        operation: "add" as const,
        target: {
          sketchPlane: "XY" as const,
          profile: {
            kind: "rectangle" as const,
            center: [0, 0] as const,
            width: 8,
            height: 6
          },
          depth: 4,
          side
        },
        tool: {
          sketchPlane: "XY" as const,
          profile: {
            ...slotWireProfile,
            frame: { ...slotWireProfile.frame, origin: [4, 0, 0] as const }
          },
          depth: 4,
          side
        }
      };
      const mesh = await createOcctBooleanExtrudeMesh(source);
      const metadata = await createOcctExactBodyMetadata({ source });

      expect(mesh.primitive).toBe("boolean");
      expect(mesh.vertexCount).toBeGreaterThan(0);
      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect("generatedReferences" in mesh).toBe(false);
      const expectedMin = [
        -4,
        -3,
        side === "positive" ? 0 : side === "negative" ? -4 : -2
      ] as const;
      const expectedMax = [
        7,
        3,
        side === "negative" ? 0 : side === "positive" ? 4 : 2
      ] as const;
      for (const axis of [0, 1, 2] as const) {
        expect(metadata.bounds.min[axis]).toBeCloseTo(expectedMin[axis], 4);
        expect(metadata.bounds.max[axis]).toBeCloseTo(expectedMax[axis], 4);
      }
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.volume).toBeCloseTo(208 + 2 * Math.PI, 5);
      expect(metadata.generatedReferences).toBeUndefined();
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it.each(["positive", "negative", "symmetric"] as const)(
    "subtracts an exact mixed line/arc composite %s tool into one result solid",
    async (side) => {
      const source = {
        kind: "booleanExtrudes" as const,
        operation: "cut" as const,
        target: {
          sketchPlane: "XY" as const,
          profile: {
            kind: "rectangle" as const,
            center: [0, 0] as const,
            width: 8,
            height: 6
          },
          depth: 4,
          side
        },
        tool: {
          sketchPlane: "XY" as const,
          profile: slotWireProfile,
          depth: 4,
          side
        }
      };
      const mesh = await createOcctBooleanExtrudeMesh(source);
      const metadata = await createOcctExactBodyMetadata({ source });

      expect(mesh.primitive).toBe("boolean");
      expect(mesh.vertexCount).toBeGreaterThan(0);
      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect("generatedReferences" in mesh).toBe(false);
      const expectedMin = [
        -4,
        -3,
        side === "positive" ? 0 : side === "negative" ? -4 : -2
      ] as const;
      const expectedMax = [
        4,
        3,
        side === "negative" ? 0 : side === "positive" ? 4 : 2
      ] as const;
      for (const axis of [0, 1, 2] as const) {
        expect(metadata.bounds.min[axis]).toBeCloseTo(expectedMin[axis], 4);
        expect(metadata.bounds.max[axis]).toBeCloseTo(expectedMax[axis], 4);
      }
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.volume).toBeCloseTo(160 - 4 * Math.PI, 5);
      expect(metadata.generatedReferences).toBeUndefined();
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "fuses a reverse-arc wire through its resolved attached world frame",
    async () => {
      const frame = {
        origin: [10, 20, 30] as const,
        uAxis: [0, 1, 0] as const,
        vAxis: [0, 0, 1] as const
      };
      const source = {
        kind: "booleanExtrudes" as const,
        operation: "add" as const,
        target: {
          sketchPlane: "YZ" as const,
          profile: {
            kind: "rectangle" as const,
            center: [0, 0] as const,
            width: 8,
            height: 6
          },
          depth: 4,
          side: "symmetric" as const,
          placementFrame: frame
        },
        tool: {
          sketchPlane: "XY" as const,
          profile: {
            ...notchedWireProfile,
            frame: {
              ...frame,
              origin: [10, 24, 30] as const
            }
          },
          depth: 4,
          side: "symmetric" as const
        }
      };
      const [mesh, topology] = await Promise.all([
        createOcctBooleanExtrudeMesh(source),
        createOcctExactTopologySnapshot({ source })
      ]);

      expect(mesh.primitive).toBe("boolean");
      expect(topology.entityCounts.solidCount).toBe(1);
      expect(
        Math.min(...mesh.positions.filter((_, index) => index % 3 === 1))
      ).toBeCloseTo(16, 5);
      expect(
        Math.max(...mesh.positions.filter((_, index) => index % 3 === 1))
      ).toBeCloseTo(26, 5);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "keeps composite-add exact metadata, topology, checkpoint, and STEP on the same result B-rep recipe",
    async () => {
      const source = {
        kind: "booleanExtrudes" as const,
        operation: "add" as const,
        target: {
          sketchPlane: "XY" as const,
          profile: {
            kind: "rectangle" as const,
            center: [0, 0] as const,
            width: 8,
            height: 6
          },
          depth: 4,
          side: "symmetric" as const
        },
        tool: {
          sketchPlane: "XY" as const,
          profile: {
            ...slotWireProfile,
            frame: { ...slotWireProfile.frame, origin: [4, 0, 0] as const }
          },
          depth: 4,
          side: "symmetric" as const
        }
      };
      const [metadata, topology, checkpoint] = await Promise.all([
        createOcctExactBodyMetadata({ source }),
        createOcctExactTopologySnapshot({ source }),
        createOcctExactTopologyCheckpointPayload({
          checkpointId: "checkpoint_wire_add",
          bodyId: "body_wire_add",
          source
        })
      ]);
      const step = await createStepFromSources({
        units: "mm",
        bodies: [{ bodyId: "body_wire_add", source }]
      });

      expect(metadata.sourceKind).toBe("booleanExtrudes");
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.topologyCounts.faceCount).toBe(
        topology.entityCounts.faceCount
      );
      expect(metadata.topologyCounts.edgeCount).toBe(
        topology.entityCounts.edgeCount
      );
      expect(topology.generatedReferences).toBeUndefined();
      expect(checkpoint.topologySnapshot.signature).toBe(topology.signature);
      expect(checkpoint.brepByteLength).toBeGreaterThan(1000);
      expect(step.bodyCount).toBe(1);
      expect(step.byteLength).toBeGreaterThan(1000);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "keeps composite-cut exact metadata, topology, checkpoint, and STEP on the same result B-rep recipe",
    async () => {
      const source = {
        kind: "booleanExtrudes" as const,
        operation: "cut" as const,
        target: {
          sketchPlane: "XY" as const,
          profile: {
            kind: "rectangle" as const,
            center: [0, 0] as const,
            width: 8,
            height: 6
          },
          depth: 4,
          side: "symmetric" as const
        },
        tool: {
          sketchPlane: "XY" as const,
          profile: slotWireProfile,
          depth: 4,
          side: "symmetric" as const
        }
      };
      const [metadata, topology, checkpoint] = await Promise.all([
        createOcctExactBodyMetadata({ source }),
        createOcctExactTopologySnapshot({ source }),
        createOcctExactTopologyCheckpointPayload({
          checkpointId: "checkpoint_wire_cut",
          bodyId: "body_wire_cut",
          source
        })
      ]);
      const step = await createStepFromSources({
        units: "mm",
        bodies: [{ bodyId: "body_wire_cut", source }]
      });

      expect(metadata.sourceKind).toBe("booleanExtrudes");
      expect(metadata.volume).toBeCloseTo(160 - 4 * Math.PI, 5);
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.topologyCounts.faceCount).toBe(
        topology.entityCounts.faceCount
      );
      expect(metadata.topologyCounts.edgeCount).toBe(
        topology.entityCounts.edgeCount
      );
      expect(topology.generatedReferences).toBeUndefined();
      expect(checkpoint.topologySnapshot.signature).toBe(topology.signature);
      expect(checkpoint.brepByteLength).toBeGreaterThan(1000);
      expect(step.bodyCount).toBe(1);
      expect(step.byteLength).toBeGreaterThan(1000);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "rebuilds a nested composite-add result target through every exact route",
    async () => {
      const inner = {
        kind: "booleanExtrudes" as const,
        operation: "add" as const,
        target: {
          sketchPlane: "XY" as const,
          profile: {
            kind: "rectangle" as const,
            center: [0, 0] as const,
            width: 8,
            height: 6
          },
          depth: 4,
          side: "symmetric" as const
        },
        tool: {
          sketchPlane: "XY" as const,
          profile: {
            ...slotWireProfile,
            frame: { ...slotWireProfile.frame, origin: [4, 0, 0] as const }
          },
          depth: 4,
          side: "symmetric" as const
        }
      };
      const source = {
        kind: "booleanExtrudes" as const,
        operation: "add" as const,
        target: inner,
        tool: {
          sketchPlane: "XY" as const,
          profile: {
            ...slotWireProfile,
            sourceIdentity: "slot:nested-outer",
            frame: { ...slotWireProfile.frame, origin: [0, 3, 0] as const }
          },
          depth: 4,
          side: "symmetric" as const
        }
      };
      const [mesh, metadata, topology, checkpoint] = await Promise.all([
        createOcctBooleanExtrudeMesh(source),
        createOcctExactBodyMetadata({ source }),
        createOcctExactTopologySnapshot({ source }),
        createOcctExactTopologyCheckpointPayload({
          checkpointId: "checkpoint_nested_wire_add",
          bodyId: "body_nested_wire_add",
          source
        })
      ]);
      const step = await createStepFromSources({
        units: "mm",
        bodies: [{ bodyId: "body_nested_wire_add", source }]
      });

      expect(mesh.primitive).toBe("boolean");
      expect(metadata.volume).toBeCloseTo(224 + 4 * Math.PI, 5);
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.topologyCounts.faceCount).toBe(
        topology.entityCounts.faceCount
      );
      expect(metadata.topologyCounts.edgeCount).toBe(
        topology.entityCounts.edgeCount
      );
      expect(topology.generatedReferences).toBeUndefined();
      expect(checkpoint.topologySnapshot.signature).toBe(topology.signature);
      expect(checkpoint.brepByteLength).toBeGreaterThan(1000);
      expect(step.bodyCount).toBe(1);
      expect(step.byteLength).toBeGreaterThan(1000);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "rebuilds a nested composite-add target through a composite-cut exact recipe",
    async () => {
      const inner = {
        kind: "booleanExtrudes" as const,
        operation: "add" as const,
        target: {
          sketchPlane: "XY" as const,
          profile: {
            kind: "rectangle" as const,
            center: [0, 0] as const,
            width: 8,
            height: 6
          },
          depth: 4,
          side: "symmetric" as const
        },
        tool: {
          sketchPlane: "XY" as const,
          profile: {
            ...slotWireProfile,
            frame: { ...slotWireProfile.frame, origin: [4, 0, 0] as const }
          },
          depth: 4,
          side: "symmetric" as const
        }
      };
      const source = {
        kind: "booleanExtrudes" as const,
        operation: "cut" as const,
        target: inner,
        tool: {
          sketchPlane: "XY" as const,
          profile: slotWireProfile,
          depth: 4,
          side: "symmetric" as const
        }
      };
      const [innerMetadata, mesh, metadata, topology, checkpoint] =
        await Promise.all([
          createOcctExactBodyMetadata({ source: inner }),
          createOcctBooleanExtrudeMesh(source),
          createOcctExactBodyMetadata({ source }),
          createOcctExactTopologySnapshot({ source }),
          createOcctExactTopologyCheckpointPayload({
            checkpointId: "checkpoint_nested_wire_cut",
            bodyId: "body_nested_wire_cut",
            source
          })
        ]);
      const step = await createStepFromSources({
        units: "mm",
        bodies: [{ bodyId: "body_nested_wire_cut", source }]
      });

      expect(mesh.primitive).toBe("boolean");
      expect(metadata.volume).toBeGreaterThan(0);
      expect(metadata.volume).toBeLessThan(innerMetadata.volume);
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.topologyCounts.faceCount).toBe(
        topology.entityCounts.faceCount
      );
      expect(metadata.topologyCounts.edgeCount).toBe(
        topology.entityCounts.edgeCount
      );
      expect(topology.generatedReferences).toBeUndefined();
      expect(checkpoint.topologySnapshot.signature).toBe(topology.signature);
      expect(checkpoint.brepByteLength).toBeGreaterThan(1000);
      expect(step.bodyCount).toBe(1);
      expect(step.byteLength).toBeGreaterThan(1000);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "keeps composite cut no-op and compound behavior aligned with primitive cut",
    async () => {
      const target = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 4,
          height: 4
        },
        depth: 4
      };
      const tool = {
        sketchPlane: "XY" as const,
        profile: {
          ...slotWireProfile,
          frame: { ...slotWireProfile.frame, origin: [20, 0, 0] as const }
        },
        depth: 4
      };

      await expect(
        createOcctBooleanExtrudeMesh({ operation: "add", target, tool })
      ).rejects.toThrow("must return exactly one solid; received 2");
      const disjointSource = {
        kind: "booleanExtrudes" as const,
        operation: "cut" as const,
        target,
        tool
      };
      const splitSource = {
        kind: "booleanExtrudes" as const,
        operation: "cut" as const,
        target,
        tool: {
          ...tool,
          profile: slotWireProfile
        }
      };
      const [disjointMesh, disjointMetadata, splitMesh, splitMetadata] =
        await Promise.all([
          createOcctBooleanExtrudeMesh(disjointSource),
          createOcctExactBodyMetadata({ source: disjointSource }),
          createOcctBooleanExtrudeMesh(splitSource),
          createOcctExactBodyMetadata({ source: splitSource })
        ]);

      expect(disjointMesh.primitive).toBe("boolean");
      expect(disjointMetadata.volume).toBeCloseTo(4 * 4 * 4, 5);
      expect(disjointMetadata.topologyCounts.solidCount).toBe(1);
      expect(splitMesh.primitive).toBe("boolean");
      expect(splitMetadata.volume).toBeGreaterThan(0);
      expect(splitMetadata.volume).toBeLessThan(4 * 4 * 4);
      expect(splitMetadata.topologyCounts.solidCount).toBe(2);
      expect(() => assertBooleanAddSolidCount(0)).toThrow(
        "exactly one solid; received 0"
      );
      expect(() => assertBooleanAddSolidCount(2)).toThrow(
        "exactly one solid; received 2"
      );
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "rebuilds a region-with-hole boolean tool through mesh, metadata, topology, checkpoint, and STEP",
    async () => {
      const regionTool = {
        kind: "booleanExtrudes" as const,
        operation: "cut" as const,
        materialPolicy: "regionPositiveVolumeSingleSolid" as const,
        target: {
          sketchPlane: "XY" as const,
          profile: {
            kind: "rectangle" as const,
            center: [3, 0] as const,
            width: 6,
            height: 6
          },
          depth: 4
        },
        tool: {
          sketchPlane: "XY" as const,
          profile: {
            kind: "circle" as const,
            center: [3, 0] as const,
            radius: 1
          },
          depth: 4
        }
      };
      const source = {
        kind: "booleanExtrudes" as const,
        operation: "add" as const,
        materialPolicy: "regionPositiveVolumeSingleSolid" as const,
        target: {
          sketchPlane: "XY" as const,
          profile: {
            kind: "rectangle" as const,
            center: [0, 0] as const,
            width: 4,
            height: 4
          },
          depth: 4
        },
        tool: regionTool
      };
      const [mesh, metadata, topology, checkpoint, step] = await Promise.all([
        createOcctBooleanExtrudeMesh(source),
        createOcctExactBodyMetadata({ source }),
        createOcctExactTopologySnapshot({ source }),
        createOcctExactTopologyCheckpointPayload({
          checkpointId: "checkpoint_region_tool",
          bodyId: "body_region_tool",
          source
        }),
        createStepFromSources({
          units: "mm",
          bodies: [{ bodyId: "body_region_tool", source }]
        })
      ]);

      expect(mesh.primitive).toBe("boolean");
      expect(metadata.volume).toBeCloseTo(
        4 * 4 * 4 + 6 * 6 * 4 - 2 * 4 * 4 - Math.PI * 4,
        4
      );
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.topologyCounts.faceCount).toBe(
        topology.entityCounts.faceCount
      );
      expect(checkpoint.topologySnapshot.signature).toBe(topology.signature);
      expect(checkpoint.brepByteLength).toBeGreaterThan(1000);
      expect(step.bodyCount).toBe(1);
      expect(step.byteLength).toBeGreaterThan(1000);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "enforces positive-volume and one-solid policy only for region boolean recipes",
    async () => {
      const target = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 4,
          height: 4
        },
        depth: 4
      };
      const disjointTool = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "circle" as const,
          center: [20, 0] as const,
          radius: 1
        },
        depth: 4
      };
      const splitTool = {
        sketchPlane: "XY" as const,
        profile: slotWireProfile,
        depth: 4
      };
      const completeRemovalTool = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 4,
          height: 4
        },
        depth: 4
      };
      const materialPolicy = "regionPositiveVolumeSingleSolid" as const;

      for (const input of [
        {
          operation: "add" as const,
          materialPolicy,
          target,
          tool: disjointTool
        },
        {
          operation: "cut" as const,
          materialPolicy,
          target,
          tool: disjointTool
        },
        {
          operation: "cut" as const,
          materialPolicy,
          target,
          tool: splitTool
        },
        {
          operation: "cut" as const,
          materialPolicy,
          target,
          tool: completeRemovalTool
        }
      ]) {
        await expect(createOcctBooleanExtrudeMesh(input)).rejects.toMatchObject(
          {
            code: "SKETCH_REGION_RESULT_NOT_SINGLE_SOLID"
          }
        );
      }

      const legacyNoOp = await createOcctBooleanExtrudeMesh({
        operation: "cut",
        target,
        tool: disjointTool
      });
      expect(legacyNoOp.primitive).toBe("boolean");
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it("rejects cyclic and over-deep direct OCCT boolean recipes before allocation", () => {
    const cyclic = {
      kind: "booleanExtrudes" as const,
      operation: "add" as const,
      target: occtBooleanRecipePrimitive as OcctBooleanExtrudeSource,
      tool: occtBooleanRecipePrimitive
    };
    (cyclic as { target: OcctBooleanExtrudeSource }).target = cyclic;
    const overDeep = createNestedOcctBooleanRecipe(
      MAX_OCCT_BOOLEAN_EXTRUDE_RECIPE_DEPTH + 1
    );
    const oc = {} as OpenCascadeInstance;

    expect(() => makeBooleanExtrudeShape(oc, cyclic)).toThrow(
      "boolean recipe is cyclic"
    );
    expect(() => makeBooleanExtrudeShape(oc, overDeep)).toThrow(
      `exceeds ${MAX_OCCT_BOOLEAN_EXTRUDE_RECIPE_DEPTH}`
    );
  });

  it.each([
    ["add", MAX_OCCT_BOOLEAN_EXTRUDE_RECIPE_DEPTH - 1, true],
    ["add", MAX_OCCT_BOOLEAN_EXTRUDE_RECIPE_DEPTH, false],
    ["cut", MAX_OCCT_BOOLEAN_EXTRUDE_RECIPE_DEPTH - 1, true],
    ["cut", MAX_OCCT_BOOLEAN_EXTRUDE_RECIPE_DEPTH, false]
  ] as const)(
    "%s reserves the outer mesh operation for a target with %i result nodes",
    (operation, targetDepth, reachesTargetFactory) => {
      let targetFactoryCalls = 0;
      const targetFactoryReached = new Error("Target factory reached.");
      const factories: OcctBooleanExtrudeShapeFactories = {
        target: () => {
          targetFactoryCalls += 1;
          throw targetFactoryReached;
        },
        tool: () => {
          throw new Error("Unexpected tool factory call.");
        }
      };
      const input =
        operation === "add"
          ? {
              operation: "add" as const,
              target: createNestedOcctBooleanRecipe(targetDepth),
              tool: occtBooleanRecipePrimitive
            }
          : {
              operation: "cut" as const,
              target: createNestedOcctBooleanRecipe(targetDepth),
              tool: occtBooleanRecipePrimitive
            };

      expect(() =>
        createOcctBooleanExtrudeMeshWithShapeFactories(
          {} as OpenCascadeInstance,
          input,
          factories
        )
      ).toThrow(
        reachesTargetFactory
          ? targetFactoryReached
          : `exceeds ${MAX_OCCT_BOOLEAN_EXTRUDE_RECIPE_DEPTH}`
      );
      expect(targetFactoryCalls).toBe(reachesTargetFactory ? 1 : 0);
    }
  );

  it(
    "creates a chained rectangle boolean cut through Open CASCADE WASM",
    async () => {
      const mesh = await createOcctBooleanExtrudeMesh({
        operation: "cut",
        target: {
          kind: "booleanExtrudes",
          operation: "cut",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 4,
              height: 4
            },
            depth: 4
          },
          tool: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [-0.5, 0],
              width: 1,
              height: 1
            },
            depth: 4
          }
        },
        tool: {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0.5, 0],
            width: 1,
            height: 1
          },
          depth: 4
        }
      });

      expect(mesh.primitive).toBe("boolean");
      expect(mesh.faceCount).toBeGreaterThan(0);
      expect(mesh.vertexCount).toBeGreaterThan(0);
      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect(mesh.positions).toHaveLength(mesh.vertexCount * 3);
      expect(mesh.indices).toHaveLength(mesh.triangleCount * 3);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "creates closed and open rectangle shell meshes through Open CASCADE WASM",
    async () => {
      const target = {
        kind: "extrude" as const,
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 1,
          height: 1
        },
        depth: 1,
        side: "positive" as const
      };
      const closed = await createOcctShellMesh({
        target,
        wallThickness: 0.2,
        openFaceStableIds: []
      });
      const open = await createOcctShellMesh({
        target,
        wallThickness: 0.2,
        openFaceStableIds: ["generated:face:body_1:endCap"]
      });

      expect(closed.primitive).toBe("boolean");
      expect(closed.faceCount).toBeGreaterThan(0);
      expect(closed.vertexCount).toBeGreaterThan(0);
      expect(closed.triangleCount).toBeGreaterThan(0);
      expect(closed.positions).toHaveLength(closed.vertexCount * 3);
      expect(closed.indices).toHaveLength(closed.triangleCount * 3);
      expect(open.primitive).toBe("boolean");
      expect(open.faceCount).toBeGreaterThan(0);
      expect(open.vertexCount).toBeGreaterThan(0);
      expect(open.triangleCount).toBeGreaterThan(0);
      expect(open.positions).toHaveLength(open.vertexCount * 3);
      expect(open.indices).toHaveLength(open.triangleCount * 3);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "creates rectangle chamfer and fillet meshes through Open CASCADE WASM",
    async () => {
      const target = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 6,
          height: 4
        },
        depth: 4
      };
      const chamfer = await createOcctEdgeFinishMesh({
        operation: "chamfer",
        target,
        edgeStableId: "generated:edge:body:1:start:uMin",
        distance: 0.25
      });
      const fillet = await createOcctEdgeFinishMesh({
        operation: "fillet",
        target,
        edgeStableId: "generated:edge:body:1:longitudinal:uMax:vMax",
        radius: 0.2
      });

      expect(chamfer.primitive).toBe("edgeFinish");
      expect(chamfer.faceCount).toBeGreaterThan(0);
      expect(chamfer.vertexCount).toBeGreaterThan(0);
      expect(chamfer.triangleCount).toBeGreaterThan(0);
      expect(chamfer.positions).toHaveLength(chamfer.vertexCount * 3);
      expect(chamfer.indices).toHaveLength(chamfer.triangleCount * 3);
      expect(fillet.primitive).toBe("edgeFinish");
      expect(fillet.faceCount).toBeGreaterThan(0);
      expect(fillet.vertexCount).toBeGreaterThan(0);
      expect(fillet.triangleCount).toBeGreaterThan(0);
      expect(fillet.positions).toHaveLength(fillet.vertexCount * 3);
      expect(fillet.indices).toHaveLength(fillet.triangleCount * 3);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "creates and tessellates rectangle and circle revolve profiles through Open CASCADE WASM",
    async () => {
      const rectangle = await createOcctRevolveProfileMesh({
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
        angleDegrees: 360
      });
      const circle = await createOcctRevolveProfileMesh({
        sketchPlane: "XZ",
        profile: {
          kind: "circle",
          center: [2, 0],
          radius: 0.5
        },
        axis: {
          start: [0, -2],
          end: [0, 2]
        },
        angleDegrees: 180
      });

      expect(rectangle.primitive).toBe("revolve");
      expect(rectangle.faceCount).toBeGreaterThan(0);
      expect(rectangle.vertexCount).toBeGreaterThan(0);
      expect(rectangle.triangleCount).toBeGreaterThan(0);
      expect(rectangle.positions).toHaveLength(rectangle.vertexCount * 3);
      expect(rectangle.indices).toHaveLength(rectangle.triangleCount * 3);
      expect(circle.primitive).toBe("revolve");
      expect(circle.faceCount).toBeGreaterThan(0);
      expect(circle.vertexCount).toBeGreaterThan(0);
      expect(circle.triangleCount).toBeGreaterThan(0);
      expect(circle.positions).toHaveLength(circle.vertexCount * 3);
      expect(circle.indices).toHaveLength(circle.triangleCount * 3);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "rebuilds an attached composite revolve display and exact artifacts from one B-rep recipe",
    async () => {
      const attachedProfile = {
        ...slotWireProfile,
        frame: {
          origin: [10, 20, 30] as const,
          uAxis: [1, 0, 0] as const,
          vAxis: [0, 1, 0] as const
        }
      };
      const source = {
        kind: "revolve" as const,
        sketchPlane: "YZ" as const,
        profile: attachedProfile,
        axis: { start: [-4, -10] as const, end: [-4, 10] as const },
        angleDegrees: 360
      };
      const before = JSON.stringify(source);
      const mesh = await createOcctRevolveProfileMesh(source);
      const metadata = await createOcctExactBodyMetadata({ source });
      const topology = await createOcctExactTopologySnapshot({ source });
      const checkpoint = await createOcctExactTopologyCheckpointPayload({
        checkpointId: "checkpoint_wire_revolve",
        bodyId: "body_wire_revolve",
        source
      });
      const step = await createStepFromSources({
        units: "mm",
        bodies: [{ bodyId: "body_wire_revolve", source }]
      });

      expect(mesh).toMatchObject({ primitive: "revolve" });
      expect(mesh.vertexCount).toBeGreaterThan(0);
      expect(metadata.sourceKind).toBe("revolve");
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.volume).toBeCloseTo(8 * Math.PI * (8 + Math.PI), 5);
      expect(metadata.bounds.min).toEqual(
        expect.arrayContaining([
          expect.closeTo(-1, 5),
          expect.closeTo(19, 5),
          expect.closeTo(23, 5)
        ])
      );
      expect(metadata.bounds.max).toEqual(
        expect.arrayContaining([
          expect.closeTo(13, 5),
          expect.closeTo(21, 5),
          expect.closeTo(37, 5)
        ])
      );
      expect(topology.sourceKind).toBe("revolve");
      expect(topology.entityCounts.solidCount).toBe(1);
      expect(checkpoint.sourceKind).toBe("revolve");
      expect(checkpoint.brepByteLength).toBeGreaterThan(1000);
      expect(step.bodyCount).toBe(1);
      expect(step.byteLength).toBeGreaterThan(1000);
      expect(JSON.stringify(source)).toBe(before);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "revolves one exact planar region face with a void through mesh, metadata, topology, checkpoint, and STEP",
    async () => {
      const profile = {
        kind: "region" as const,
        frame: {
          origin: [0, 0, 0] as const,
          uAxis: [1, 0, 0] as const,
          vAxis: [0, 1, 0] as const
        },
        outer: {
          kind: "rectangle" as const,
          center: [4, 0] as const,
          width: 2,
          height: 4
        },
        holes: [
          {
            kind: "circle" as const,
            center: [4, 0] as const,
            radius: 0.5
          }
        ],
        sourceIdentity: "region-revolve-rectangle-circle-v1",
        geometryPolicy: {
          linearTolerance: 1e-7,
          angularToleranceDegrees: 0.1,
          minimumProfileArea: 1e-12
        }
      };
      const source = {
        kind: "revolve" as const,
        sketchPlane: "XY" as const,
        profile,
        axis: { start: [0, -5] as const, end: [0, 5] as const },
        angleDegrees: 360
      };
      const mesh = await createOcctRevolveProfileMesh(source);
      const partial = await createOcctRevolveProfileMesh({
        ...source,
        angleDegrees: 120
      });
      const metadata = await createOcctExactBodyMetadata({ source });
      const topology = await createOcctExactTopologySnapshot({ source });
      const checkpoint = await createOcctExactTopologyCheckpointPayload({
        checkpointId: "checkpoint_region_revolve",
        bodyId: "body_region_revolve",
        source
      });
      const step = await createStepFromSources({
        units: "mm",
        bodies: [{ bodyId: "body_region_revolve", source }]
      });

      expect(mesh).toMatchObject({ primitive: "revolve" });
      expect(mesh.vertexCount).toBeGreaterThan(0);
      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect(partial).toMatchObject({ primitive: "revolve" });
      expect(partial.vertexCount).toBeGreaterThan(0);
      expect(metadata.sourceKind).toBe("revolve");
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.volume).toBeCloseTo(64 * Math.PI - 2 * Math.PI ** 2, 5);
      expect(topology.sourceKind).toBe("revolve");
      expect(topology.entityCounts.solidCount).toBe(1);
      expect(checkpoint.sourceKind).toBe("revolve");
      expect(checkpoint.brepByteLength).toBeGreaterThan(1000);
      expect(step.bodyCount).toBe(1);
      expect(step.byteLength).toBeGreaterThan(1000);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "revolves a normalized line/arc wire region with a clockwise wire hole",
    async () => {
      const translateX = 7;
      const outer = {
        ...slotWireProfile,
        sourceIdentity: "region-revolve-wire-outer-v1",
        segments: slotWireProfile.segments.map((segment) =>
          segment.kind === "line"
            ? {
                ...segment,
                start: [
                  segment.start[0] + translateX,
                  segment.start[1]
                ] as const,
                end: [segment.end[0] + translateX, segment.end[1]] as const
              }
            : {
                ...segment,
                center: [
                  segment.center[0] + translateX,
                  segment.center[1]
                ] as const
              }
        )
      };
      const hole = {
        kind: "wire" as const,
        frame: slotWireProfile.frame,
        closed: true as const,
        segments: [
          {
            kind: "line" as const,
            sourceEntityId: "hole-left",
            start: [6.5, -0.5] as const,
            end: [6.5, 0.5] as const
          },
          {
            kind: "line" as const,
            sourceEntityId: "hole-top",
            start: [6.5, 0.5] as const,
            end: [7.5, 0.5] as const
          },
          {
            kind: "line" as const,
            sourceEntityId: "hole-right",
            start: [7.5, 0.5] as const,
            end: [7.5, -0.5] as const
          },
          {
            kind: "line" as const,
            sourceEntityId: "hole-bottom",
            start: [7.5, -0.5] as const,
            end: [6.5, -0.5] as const
          }
        ],
        sourceIdentity: "region-revolve-wire-hole-clockwise-v1",
        geometryPolicy: slotWireProfile.geometryPolicy
      };
      const source = {
        kind: "revolve" as const,
        sketchPlane: "XY" as const,
        profile: {
          kind: "region" as const,
          frame: slotWireProfile.frame,
          outer,
          holes: [hole],
          sourceIdentity: "region-revolve-wire-with-wire-hole-v1",
          geometryPolicy: slotWireProfile.geometryPolicy
        },
        axis: { start: [0, -10] as const, end: [0, 10] as const },
        angleDegrees: 180
      };

      const mesh = await createOcctRevolveProfileMesh(source);
      const metadata = await createOcctExactBodyMetadata({ source });

      expect(mesh).toMatchObject({ primitive: "revolve" });
      expect(mesh.vertexCount).toBeGreaterThan(0);
      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect(metadata.sourceKind).toBe("revolve");
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.volume).toBeGreaterThan(0);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "supports partial composite revolves for positive and negative axis directions and reversed segments",
    async () => {
      const reversedProfile = {
        ...slotWireProfile,
        sourceIdentity: "slot-reversed",
        segments: [...slotWireProfile.segments].reverse().map((segment) =>
          segment.kind === "line"
            ? { ...segment, start: segment.end, end: segment.start }
            : {
                ...segment,
                startAngleDegrees:
                  (segment.startAngleDegrees +
                    segment.sweepAngleDegrees +
                    360) %
                  360,
                sweepAngleDegrees: -segment.sweepAngleDegrees
              }
        )
      };
      const [positive, negative] = await Promise.all([
        createOcctRevolveProfileMesh({
          sketchPlane: "XY",
          profile: reversedProfile,
          axis: { start: [-4, -10], end: [-4, 10] },
          angleDegrees: 120
        }),
        createOcctRevolveProfileMesh({
          sketchPlane: "XY",
          profile: reversedProfile,
          axis: { start: [-4, 10], end: [-4, -10] },
          angleDegrees: 120
        })
      ]);

      for (const mesh of [positive, negative]) {
        expect(mesh.primitive).toBe("revolve");
        expect(mesh.vertexCount).toBeGreaterThan(0);
        expect(mesh.triangleCount).toBeGreaterThan(0);
      }
      expect(Array.from(positive.positions)).not.toEqual(
        Array.from(negative.positions)
      );
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "allows a composite profile vertex to touch the axis only when OCCT returns one solid",
    async () => {
      const touchingTriangle = {
        kind: "wire" as const,
        frame: slotWireProfile.frame,
        closed: true as const,
        segments: [
          {
            kind: "line" as const,
            sourceEntityId: "touch-out",
            start: [0, 0] as const,
            end: [2, -1] as const
          },
          {
            kind: "line" as const,
            sourceEntityId: "outer",
            start: [2, -1] as const,
            end: [2, 1] as const
          },
          {
            kind: "line" as const,
            sourceEntityId: "touch-return",
            start: [2, 1] as const,
            end: [0, 0] as const
          }
        ],
        sourceIdentity: "touching-triangle",
        geometryPolicy: slotWireProfile.geometryPolicy
      };
      const mesh = await createOcctRevolveProfileMesh({
        sketchPlane: "XY",
        profile: touchingTriangle,
        axis: { start: [0, -10], end: [0, 10] },
        angleDegrees: 360
      });

      expect(mesh.primitive).toBe("revolve");
      expect(mesh.vertexCount).toBeGreaterThan(0);
      expect(mesh.triangleCount).toBeGreaterThan(0);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact rectangle extrude metadata through Open CASCADE WASM",
    async () => {
      const metadata = await createOcctExactBodyMetadata({
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [1, 2],
            width: 4,
            height: 3
          },
          depth: 5
        }
      });

      expect(metadata.sourceKind).toBe("extrude");
      expect(metadata.bounds.min[0]).toBeCloseTo(-1, 6);
      expect(metadata.bounds.min[1]).toBeCloseTo(0.5, 6);
      expect(metadata.bounds.min[2]).toBeCloseTo(0, 6);
      expect(metadata.bounds.max[0]).toBeCloseTo(3, 6);
      expect(metadata.bounds.max[1]).toBeCloseTo(3.5, 6);
      expect(metadata.bounds.max[2]).toBeCloseTo(5, 6);
      expect(metadata.volume).toBeCloseTo(60, 6);
      expect(metadata.surfaceArea).toBeCloseTo(94, 6);
      expect(metadata.centroid).toEqual([1, 2, 2.5]);
      expect(metadata.topologyCounts).toEqual({
        solidCount: 1,
        faceCount: 6,
        edgeCount: 12,
        vertexCount: 8
      });
      expect(metadata.measurementSource).toBe("kernel-derived");
      expect(metadata.measurementConfidence).toBe("kernel-derived");
      expect(metadata.diagnostics).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns derived exact topology snapshots through Open CASCADE WASM",
    async () => {
      const snapshot = await createOcctExactTopologySnapshot({
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [1, 2],
            width: 4,
            height: 3
          },
          depth: 5
        }
      });

      expect(snapshot).toMatchObject({
        sourceKind: "extrude",
        status: "partial",
        source: "kernel-derived",
        adjacencyAvailable: true,
        signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
        unsupportedEntityKinds: ["axis"]
      });
      expect(snapshot.entityCounts).toMatchObject({
        bodyCount: 1,
        solidCount: 1,
        faceCount: 6,
        wireCount: 6,
        edgeCount: 12,
        vertexCount: 8,
        loopCount: 6,
        coedgeCount: 24,
        axisCount: 0
      });
      expect(snapshot.entityCount).toBe(snapshot.entities.length);
      const bodyEntity = snapshot.entities.find(
        (entity) => entity.kind === "body"
      );
      expect(bodyEntity?.bounds?.min[0]).toBeCloseTo(-1, 6);
      expect(bodyEntity?.bounds?.min[1]).toBeCloseTo(0.5, 6);
      expect(bodyEntity?.bounds?.min[2]).toBeCloseTo(0, 6);
      expect(bodyEntity?.bounds?.max[0]).toBeCloseTo(3, 6);
      expect(bodyEntity?.bounds?.max[1]).toBeCloseTo(3.5, 6);
      expect(bodyEntity?.bounds?.max[2]).toBeCloseTo(5, 6);
      expect(
        snapshot.entities.every(
          (entity) =>
            entity.bounds &&
            entity.bounds.min.every(Number.isFinite) &&
            entity.bounds.max.every(Number.isFinite)
        )
      ).toBe(true);
      expect(
        new Set(snapshot.entities.map((entity) => entity.signature)).size
      ).toBeGreaterThan(3);
      expect(
        snapshot.entities.some(
          (entity) => entity.kind === "face" && entity.adjacency?.available
        )
      ).toBe(true);
      expect(
        snapshot.entities.some(
          (entity) => entity.kind === "edge" && entity.adjacency?.available
        )
      ).toBe(true);
      expect(
        snapshot.entities
          .filter((entity) => entity.kind === "loop")
          .every(
            (entity) =>
              entity.loopRole === undefined ||
              entity.loopRole === "outer" ||
              entity.loopRole === "inner" ||
              entity.loopRole === "unknown"
          )
      ).toBe(true);
      expect(snapshot.entities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "face",
            surfaceClass: "plane",
            area: expect.any(Number),
            normal: expect.arrayContaining([
              expect.any(Number),
              expect.any(Number),
              expect.any(Number)
            ])
          }),
          expect.objectContaining({
            kind: "edge",
            curveClass: "line",
            midpoint: expect.arrayContaining([
              expect.any(Number),
              expect.any(Number),
              expect.any(Number)
            ]),
            axis: expect.arrayContaining([
              expect.any(Number),
              expect.any(Number),
              expect.any(Number)
            ]),
            length: expect.any(Number)
          }),
          expect.objectContaining({
            kind: "vertex",
            point: expect.arrayContaining([
              expect.any(Number),
              expect.any(Number),
              expect.any(Number)
            ])
          }),
          expect.objectContaining({
            kind: "loop",
            orientation: expect.stringMatching(/forward|reversed/),
            adjacency: expect.objectContaining({
              available: true,
              neighborSignatureHashes: expect.any(Array)
            }),
            relationships: expect.objectContaining({
              parentFaceLocalId: expect.stringMatching(/^snapshot-local:face:/),
              underlyingWireLocalId: expect.stringMatching(
                /^snapshot-local:wire:/
              ),
              childCoedgeLocalIds: expect.arrayContaining([
                expect.stringMatching(/^snapshot-local:coedge:/)
              ]),
              childEdgeLocalIds: expect.arrayContaining([
                expect.stringMatching(/^snapshot-local:edge:/)
              ])
            })
          }),
          expect.objectContaining({
            kind: "coedge",
            orientation: expect.stringMatching(/forward|reversed/),
            adjacency: expect.objectContaining({
              available: true,
              neighborSignatureHashes: expect.any(Array)
            }),
            relationships: expect.objectContaining({
              parentFaceLocalId: expect.stringMatching(/^snapshot-local:face:/),
              parentWireLocalId: expect.stringMatching(/^snapshot-local:wire:/),
              parentLoopLocalId: expect.stringMatching(/^snapshot-local:loop:/),
              underlyingEdgeLocalId: expect.stringMatching(
                /^snapshot-local:edge:/
              ),
              startVertexLocalId: expect.stringMatching(
                /^snapshot-local:vertex:/
              ),
              endVertexLocalId: expect.stringMatching(/^snapshot-local:vertex:/)
            })
          })
        ])
      );
      expect(
        snapshot.entities.some(
          (entity) => entity.kind === "edge" && (entity.length ?? 0) > 0
        )
      ).toBe(true);
      const faceAreas = snapshot.entities
        .filter((entity) => entity.kind === "face")
        .map((entity) => entity.area);
      const edgeLengths = snapshot.entities
        .filter((entity) => entity.kind === "edge")
        .map((entity) => entity.length);

      expect(faceAreas.every((area) => Number.isFinite(area))).toBe(true);
      expect(edgeLengths.every((length) => Number.isFinite(length))).toBe(true);
      expect(faceAreas.some((area) => area !== undefined && area > 0)).toBe(
        true
      );
      expect(
        faceAreas.some(
          (area) => area !== undefined && Math.abs(area - 12) < 1e-6
        )
      ).toBe(true);
      expect(
        edgeLengths.some(
          (length) => length !== undefined && Math.abs(length - 5) < 1e-6
        )
      ).toBe(true);
      expect(snapshot.entities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "body",
            source: "kernel-derived",
            localId: expect.stringMatching(/^snapshot-local:body:/),
            bounds: expect.any(Object)
          }),
          expect.objectContaining({
            kind: "face",
            source: "kernel-derived",
            localId: expect.stringMatching(/^snapshot-local:face:/),
            bounds: expect.any(Object)
          })
        ])
      );
      expect(snapshot.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "GEOMETRY_TOPOLOGY_SNAPSHOT_EXTRACTED"
          }),
          expect.objectContaining({
            code: "GEOMETRY_TOPOLOGY_DESCRIPTOR_EVIDENCE_EXTRACTED",
            message: expect.stringContaining("exact surface")
          }),
          expect.objectContaining({
            code: "GEOMETRY_TOPOLOGY_ADJACENCY_EXTRACTED"
          }),
          expect.objectContaining({
            code: "GEOMETRY_TOPOLOGY_SIGNATURE_LIMITED",
            message: expect.stringContaining("per-entity bounds")
          })
        ])
      );
      expect(snapshot.diagnostics).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "GEOMETRY_TOPOLOGY_ADJACENCY_UNAVAILABLE"
          })
        ])
      );
      expect(JSON.stringify(snapshot)).not.toMatch(
        /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex/i
      );
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "extracts exact cylindrical surface and circular edge descriptors through Open CASCADE WASM",
    async () => {
      const snapshot = await createOcctExactTopologySnapshot({
        source: {
          kind: "extrude",
          sketchPlane: "XY",
          profile: {
            kind: "circle",
            center: [0, 0],
            radius: 2
          },
          depth: 5
        }
      });
      const cylindricalFace = snapshot.entities.find(
        (entity) => entity.kind === "face" && entity.surfaceClass === "cylinder"
      );
      const circularEdge = snapshot.entities.find(
        (entity) => entity.kind === "edge" && entity.curveClass === "circle"
      );

      expect(cylindricalFace).toMatchObject({
        kind: "face",
        surfaceClass: "cylinder",
        axis: expect.arrayContaining([
          expect.any(Number),
          expect.any(Number),
          expect.any(Number)
        ]),
        radius: expect.any(Number),
        area: expect.any(Number)
      });
      expect(cylindricalFace?.radius).toBeCloseTo(2, 6);
      expect(cylindricalFace?.area).toBeCloseTo(20 * Math.PI, 6);
      expect(circularEdge).toMatchObject({
        kind: "edge",
        curveClass: "circle",
        axis: expect.arrayContaining([
          expect.any(Number),
          expect.any(Number),
          expect.any(Number)
        ]),
        radius: expect.any(Number),
        length: expect.any(Number)
      });
      expect(circularEdge?.radius).toBeCloseTo(2, 6);
      expect(circularEdge?.length).toBeCloseTo(4 * Math.PI, 6);
      expect(snapshot.signatureAlgorithm).toBe(
        "partbench-derived-topology-snapshot-v1"
      );
      expect(JSON.stringify(snapshot)).not.toMatch(
        /rendererId|renderId|meshId|occtId|occtShape|gpuId|selectionBufferId|triangleIndex|faceIndex|edgeIndex|vertexIndex/i
      );
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns centered transformed primitive metadata through Open CASCADE WASM",
    async () => {
      const transformedBox = await createOcctExactBodyMetadata({
        source: {
          kind: "box",
          dimensions: { width: 2, height: 3, depth: 4 },
          transform: {
            translation: [5, 7, 11],
            rotation: [0, 0, Math.PI / 2],
            scale: [2, 1, 0.5]
          }
        }
      });
      const primitives = await Promise.all([
        createOcctExactBodyMetadata({
          source: {
            kind: "cylinder",
            dimensions: { radius: 1, height: 2 },
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1]
            }
          }
        }),
        createOcctExactBodyMetadata({
          source: {
            kind: "sphere",
            dimensions: { radius: 1 },
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1]
            }
          }
        }),
        createOcctExactBodyMetadata({
          source: {
            kind: "cone",
            dimensions: { radius: 1, height: 2 },
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1]
            }
          }
        }),
        createOcctExactBodyMetadata({
          source: {
            kind: "torus",
            dimensions: { majorRadius: 3, minorRadius: 1 },
            transform: {
              translation: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1]
            }
          }
        })
      ]);

      expect(transformedBox).toMatchObject({
        sourceKind: "box",
        topologyCounts: { solidCount: 1, faceCount: 6 }
      });
      expect(transformedBox.volume).toBeCloseTo(24, 6);
      expect(transformedBox.centroid[0]).toBeCloseTo(5, 6);
      expect(transformedBox.centroid[1]).toBeCloseTo(7, 6);
      expect(transformedBox.centroid[2]).toBeCloseTo(11, 6);
      const boundSizes = [
        transformedBox.bounds.max[0] - transformedBox.bounds.min[0],
        transformedBox.bounds.max[1] - transformedBox.bounds.min[1],
        transformedBox.bounds.max[2] - transformedBox.bounds.min[2]
      ];
      expect(boundSizes[0]).toBeCloseTo(3, 6);
      expect(boundSizes[1]).toBeCloseTo(4, 6);
      expect(boundSizes[2]).toBeCloseTo(2, 6);
      expect(primitives.map((metadata) => metadata.sourceKind)).toEqual([
        "cylinder",
        "sphere",
        "cone",
        "torus"
      ]);
      expect(
        primitives.map((metadata) => metadata.topologyCounts.solidCount)
      ).toEqual([1, 1, 1, 1]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact boolean extrude metadata through Open CASCADE WASM",
    async () => {
      const metadata = await createOcctExactBodyMetadata({
        source: {
          kind: "booleanExtrudes",
          operation: "cut",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 4,
              height: 4
            },
            depth: 4
          },
          tool: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 2,
              height: 2
            },
            depth: 4
          }
        }
      });

      expect(metadata.sourceKind).toBe("booleanExtrudes");
      expect(metadata.volume).toBeCloseTo(48, 6);
      expect(metadata.surfaceArea).toBeGreaterThan(0);
      expect(metadata.centroid[0]).toBeCloseTo(0, 6);
      expect(metadata.centroid[1]).toBeCloseTo(0, 6);
      expect(metadata.centroid[2]).toBeCloseTo(2, 6);
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.topologyCounts.faceCount).toBeGreaterThan(0);
      expect(metadata.measurementSource).toBe("kernel-derived");
      expect(metadata.measurementConfidence).toBe("kernel-derived");
      expect(metadata.diagnostics).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact pattern, mirror, and shell metadata with inertia",
    async () => {
      const seed = {
        kind: "extrude" as const,
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [1, 0] as const,
          width: 1,
          height: 1
        },
        depth: 1,
        side: "positive" as const
      };
      const [pattern, mirror, shell] = await Promise.all([
        createOcctExactBodyMetadata({
          source: {
            kind: "linearPattern",
            seed,
            direction: [1, 0, 0],
            spacing: 3,
            instanceCount: 3
          }
        }),
        createOcctExactBodyMetadata({
          source: {
            kind: "mirror",
            seed,
            plane: { point: [0, 0, 0], normal: [1, 0, 0] },
            includeOriginal: true
          }
        }),
        createOcctExactBodyMetadata({
          source: {
            kind: "shell",
            target: seed,
            wallThickness: 0.2,
            openFaceStableIds: ["generated:face:body_1:endCap"]
          }
        })
      ]);

      expect(pattern).toMatchObject({
        sourceKind: "linearPattern",
        topologyCounts: { solidCount: 3 }
      });
      expect(pattern.volume).toBeCloseTo(3, 6);
      expect(mirror.sourceKind).toBe("mirror");
      expect(mirror.volume).toBeCloseTo(2, 6);
      expect(shell.sourceKind).toBe("shell");
      expect(shell.volume).toBeGreaterThan(0);
      for (const metadata of [pattern, mirror, shell]) {
        expect(metadata.momentsOfInertia.xx).toBeGreaterThan(0);
        expect(metadata.principalMoments).toHaveLength(3);
        expect(metadata.principalMoments.every(Number.isFinite)).toBe(true);
      }
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact revolve metadata through Open CASCADE WASM",
    async () => {
      const metadata = await createOcctExactBodyMetadata({
        source: {
          kind: "revolve",
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [2, 0],
            width: 1,
            height: 3
          },
          axis: {
            start: [0, -2],
            end: [0, 2]
          },
          angleDegrees: 360
        }
      });

      expect(metadata.sourceKind).toBe("revolve");
      expect(metadata.bounds.min[0]).toBeCloseTo(-2.5, 6);
      expect(metadata.bounds.max[0]).toBeCloseTo(2.5, 6);
      expect(metadata.bounds.min[1]).toBeCloseTo(-1.5, 6);
      expect(metadata.bounds.max[1]).toBeCloseTo(1.5, 6);
      expect(metadata.bounds.min[2]).toBeCloseTo(-2.5, 6);
      expect(metadata.bounds.max[2]).toBeCloseTo(2.5, 6);
      expect(metadata.volume).toBeCloseTo(12 * Math.PI, 6);
      expect(metadata.surfaceArea).toBeCloseTo(32 * Math.PI, 6);
      expect(metadata.centroid[0]).toBeCloseTo(0, 6);
      expect(metadata.centroid[1]).toBeCloseTo(0, 6);
      expect(metadata.centroid[2]).toBeCloseTo(0, 6);
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.topologyCounts.faceCount).toBeGreaterThan(0);
      expect(metadata.measurementSource).toBe("kernel-derived");
      expect(metadata.measurementConfidence).toBe("kernel-derived");
      expect(metadata.diagnostics).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact hole metadata through Open CASCADE WASM",
    async () => {
      const metadata = await createOcctExactBodyMetadata({
        source: {
          kind: "hole",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "rectangle",
              center: [0, 0],
              width: 6,
              height: 4
            },
            depth: 3,
            side: "positive"
          },
          tool: {
            sketchPlane: "XY",
            circle: {
              kind: "circle",
              center: [0, 0],
              radius: 0.5
            },
            depthMode: "blind",
            depth: 2,
            direction: "positive"
          }
        }
      });

      expect(metadata.sourceKind).toBe("hole");
      expect(metadata.bounds.min[0]).toBeCloseTo(-3, 6);
      expect(metadata.bounds.max[0]).toBeCloseTo(3, 6);
      expect(metadata.bounds.min[1]).toBeCloseTo(-2, 6);
      expect(metadata.bounds.max[1]).toBeCloseTo(2, 6);
      expect(metadata.bounds.min[2]).toBeCloseTo(0, 6);
      expect(metadata.bounds.max[2]).toBeCloseTo(3, 6);
      expect(metadata.volume).toBeCloseTo(72 - Math.PI * 0.5, 5);
      expect(metadata.surfaceArea).toBeGreaterThan(0);
      expect(metadata.centroid[2]).toBeGreaterThan(1.5);
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.topologyCounts.faceCount).toBeGreaterThan(0);
      expect(metadata.measurementSource).toBe("kernel-derived");
      expect(metadata.measurementConfidence).toBe("kernel-derived");
      expect(metadata.diagnostics).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact side-plane circle-target hole metadata through Open CASCADE WASM",
    async () => {
      const metadata = await createOcctExactBodyMetadata({
        source: {
          kind: "hole",
          target: {
            sketchPlane: "XY",
            profile: {
              kind: "circle",
              center: [0, 0],
              radius: 3
            },
            depth: 4,
            side: "positive"
          },
          tool: {
            sketchPlane: "XZ",
            circle: {
              kind: "circle",
              center: [0, 2],
              radius: 0.5
            },
            depthMode: "throughAll",
            direction: "positive"
          }
        }
      });

      expect(metadata.sourceKind).toBe("hole");
      expect(metadata.bounds.min[0]).toBeCloseTo(-3, 6);
      expect(metadata.bounds.max[0]).toBeCloseTo(3, 6);
      expect(metadata.bounds.min[2]).toBeCloseTo(0, 6);
      expect(metadata.bounds.max[2]).toBeCloseTo(4, 6);
      expect(metadata.volume).toBeGreaterThan(0);
      expect(metadata.volume).toBeLessThan(36 * Math.PI);
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.topologyCounts.faceCount).toBeGreaterThan(0);
      expect(metadata.measurementSource).toBe("kernel-derived");
      expect(metadata.diagnostics).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact hole metadata for a boolean-result target through Open CASCADE WASM",
    async () => {
      const metadata = await createOcctExactBodyMetadata({
        source: {
          kind: "hole",
          target: {
            kind: "booleanExtrudes",
            operation: "cut",
            target: {
              sketchPlane: "XY",
              profile: {
                kind: "rectangle",
                center: [0, 0],
                width: 6,
                height: 4
              },
              depth: 4,
              side: "positive"
            },
            tool: {
              sketchPlane: "XY",
              profile: {
                kind: "rectangle",
                center: [-1, 0],
                width: 1,
                height: 1
              },
              depth: 4
            }
          },
          tool: {
            sketchPlane: "XY",
            circle: {
              kind: "circle",
              center: [1, 0],
              radius: 0.4
            },
            depthMode: "throughAll",
            direction: "positive"
          }
        }
      });

      expect(metadata.sourceKind).toBe("hole");
      expect(metadata.volume).toBeGreaterThan(0);
      expect(metadata.volume).toBeLessThan(92);
      expect(metadata.topologyCounts.solidCount).toBe(1);
      expect(metadata.measurementSource).toBe("kernel-derived");
      expect(metadata.diagnostics).toEqual([]);
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );

  it(
    "returns exact edge-finish metadata through Open CASCADE WASM",
    async () => {
      const target = {
        sketchPlane: "XY" as const,
        profile: {
          kind: "rectangle" as const,
          center: [0, 0] as const,
          width: 6,
          height: 4
        },
        depth: 4
      };
      const chamfer = await createOcctExactBodyMetadata({
        source: {
          kind: "edgeFinish",
          operation: "chamfer",
          target,
          edgeStableId: "generated:edge:body:1:start:uMin",
          distance: 0.25
        }
      });
      const fillet = await createOcctExactBodyMetadata({
        source: {
          kind: "edgeFinish",
          operation: "fillet",
          target,
          edgeStableId: "generated:edge:body:1:longitudinal:uMax:vMax",
          radius: 0.2
        }
      });
      const cutWallChamfer = await createOcctExactBodyMetadata({
        source: {
          kind: "edgeFinish",
          operation: "chamfer",
          target: {
            kind: "booleanExtrudes",
            operation: "cut",
            target,
            tool: {
              sketchPlane: "XY",
              profile: {
                kind: "rectangle",
                center: [1, 0],
                width: 2,
                height: 1
              },
              depth: 4
            }
          },
          edgeStableId: "generated:edge:body_cut:longitudinal:uMin:vMin",
          distance: 0.1
        }
      });

      expect(chamfer.sourceKind).toBe("edgeFinish");
      expect(chamfer.bounds.min[0]).toBeCloseTo(-3, 6);
      expect(chamfer.bounds.min[1]).toBeCloseTo(-2, 6);
      expect(chamfer.bounds.min[2]).toBeCloseTo(0, 6);
      expect(chamfer.bounds.max[0]).toBeCloseTo(3, 6);
      expect(chamfer.bounds.max[1]).toBeCloseTo(2, 6);
      expect(chamfer.bounds.max[2]).toBeCloseTo(4, 6);
      expect(chamfer.volume).toBeLessThan(96);
      expect(chamfer.volume).toBeGreaterThan(0);
      expect(chamfer.surfaceArea).toBeGreaterThan(0);
      expect(chamfer.topologyCounts.solidCount).toBe(1);
      expect(chamfer.topologyCounts.faceCount).toBeGreaterThan(0);
      expect(chamfer.measurementSource).toBe("kernel-derived");
      expect(chamfer.measurementConfidence).toBe("kernel-derived");
      expect(chamfer.diagnostics).toEqual([]);
      expect(fillet.sourceKind).toBe("edgeFinish");
      expect(fillet.volume).toBeLessThan(96);
      expect(fillet.volume).toBeGreaterThan(0);
      expect(fillet.topologyCounts.solidCount).toBe(1);
      expect(fillet.measurementSource).toBe("kernel-derived");
      expect(fillet.measurementConfidence).toBe("kernel-derived");
      expect(cutWallChamfer.sourceKind).toBe("edgeFinish");
      expect(cutWallChamfer.volume).toBeGreaterThan(0);
      expect(cutWallChamfer.volume).toBeLessThan(96);
      expect(cutWallChamfer.topologyCounts.solidCount).toBe(1);
      expect(cutWallChamfer.measurementSource).toBe("kernel-derived");
      expect(cutWallChamfer.measurementConfidence).toBe("kernel-derived");
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );
});

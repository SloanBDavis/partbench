import { describe, expect, it } from "vitest";
import {
  createOcctBooleanExtrudeMesh,
  createOcctBoxMesh,
  createOcctConeMesh,
  createOcctCylinderMesh,
  createOcctEdgeFinishMesh,
  createOcctExactBodyMetadata,
  createOcctExactTopologyCheckpointPayload,
  createOcctExactTopologySnapshot,
  createOcctRevolveProfileMesh,
  createOcctSphereMesh,
  createOcctStepExport,
  getOcctBrepCheckpointWriterCapability,
  getOcctStepWriterCapability,
  createOcctTorusMesh
} from "./index";

const OCCT_WASM_TEST_TIMEOUT_MS = 120_000;

describe("occt-wasm", () => {
  it(
    "reports STEP writer bindings as available through the isolated boundary",
    async () => {
      const capability = await getOcctStepWriterCapability();

      expect(capability).toMatchObject({
        format: "step",
        status: "available",
        writerAvailable: true,
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
    "exports a rectangle extrude as real STEP bytes through Open CASCADE WASM",
    async () => {
      const artifact = await createOcctStepExport({
        units: "mm",
        bodies: [
          {
            bodyId: "body_step_rect",
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
    },
    OCCT_WASM_TEST_TIMEOUT_MS
  );
});

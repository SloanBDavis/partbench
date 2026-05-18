import { describe, expect, it } from "vitest";
import type {
  CadAxisAlignedBounds,
  CadBatch,
  CadBatchValidationError,
  CadBodySnapshot,
  CadExtrudeFeatureSummary,
  CadGeneratedEdgeReference,
  CadGeneratedFaceReference,
  CadGeneratedVertexReference,
  CadObjectModelSource,
  CadPartSnapshot,
  CadPrimitiveFeatureSummary,
  CadOp,
  CadQueryRequest,
  CadQueryResponse,
  SketchSnapshot
} from "./index";
import { protocolPackage } from "./index";

describe("cad-protocol", () => {
  it("exports package status", () => {
    expect(protocolPackage).toEqual({
      name: "@web-cad/cad-protocol",
      status: "ready"
    });
  });

  it("types supported scene commands", () => {
    const ops: CadOp[] = [
      {
        op: "document.updateUnits",
        units: "in",
        mode: "preservePhysicalSize"
      },
      {
        op: "scene.createBox",
        id: "box_1",
        dimensions: { width: 1, height: 2, depth: 3 }
      },
      {
        op: "scene.createCylinder",
        id: "cylinder_1",
        dimensions: { radius: 1, height: 4 }
      },
      {
        op: "scene.createSphere",
        id: "sphere_1",
        dimensions: { radius: 2 }
      },
      {
        op: "scene.createCone",
        id: "cone_1",
        dimensions: { radius: 2, height: 5 }
      },
      {
        op: "scene.createTorus",
        id: "torus_1",
        dimensions: { majorRadius: 3, minorRadius: 0.5 }
      },
      {
        op: "scene.updateTransform",
        id: "box_1",
        transform: { translation: [1, 2, 3] }
      },
      {
        op: "scene.updateBoxDimensions",
        id: "box_1",
        dimensions: { width: 4, height: 5, depth: 6 }
      },
      {
        op: "scene.updateCylinderDimensions",
        id: "cylinder_1",
        dimensions: { radius: 2, height: 8 }
      },
      {
        op: "scene.updateSphereDimensions",
        id: "sphere_1",
        dimensions: { radius: 3 }
      },
      {
        op: "scene.updateConeDimensions",
        id: "cone_1",
        dimensions: { radius: 3, height: 8 }
      },
      {
        op: "scene.updateTorusDimensions",
        id: "torus_1",
        dimensions: { majorRadius: 4, minorRadius: 0.75 }
      },
      {
        op: "scene.renameObject",
        id: "box_1",
        name: "Base plate"
      },
      {
        op: "scene.deleteObject",
        id: "cylinder_1"
      },
      {
        op: "sketch.create",
        id: "sketch_1",
        name: "Base sketch",
        plane: "XY"
      },
      {
        op: "sketch.createOnFace",
        id: "sketch_face_1",
        name: "Face sketch",
        bodyId: "body_1",
        faceStableId: "generated:face:body_1:endCap"
      },
      {
        op: "sketch.addPoint",
        sketchId: "sketch_1",
        id: "skent_1",
        point: [0, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        start: [0, 0],
        end: [1, 1]
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        center: [0, 0],
        width: 2,
        height: 3
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        center: [1, 1],
        radius: 2
      },
      {
        op: "sketch.updateEntity",
        sketchId: "sketch_1",
        entity: {
          id: "skent_1",
          kind: "point",
          point: [2, 3]
        }
      },
      {
        op: "sketch.deleteEntity",
        sketchId: "sketch_1",
        entityId: "skent_1"
      },
      {
        op: "sketch.rename",
        id: "sketch_1",
        name: "Renamed sketch"
      },
      {
        op: "sketch.delete",
        id: "sketch_1"
      },
      {
        op: "feature.extrude",
        id: "feat_1",
        bodyId: "body_1",
        name: "Pad",
        sketchId: "sketch_1",
        entityId: "rect_1",
        depth: 5,
        side: "negative"
      },
      {
        op: "feature.updateExtrude",
        id: "feat_1",
        depth: 7,
        side: "symmetric"
      },
      {
        op: "feature.delete",
        id: "feat_1"
      }
    ];

    expect(ops.map((op) => op.op)).toEqual([
      "document.updateUnits",
      "scene.createBox",
      "scene.createCylinder",
      "scene.createSphere",
      "scene.createCone",
      "scene.createTorus",
      "scene.updateTransform",
      "scene.updateBoxDimensions",
      "scene.updateCylinderDimensions",
      "scene.updateSphereDimensions",
      "scene.updateConeDimensions",
      "scene.updateTorusDimensions",
      "scene.renameObject",
      "scene.deleteObject",
      "sketch.create",
      "sketch.createOnFace",
      "sketch.addPoint",
      "sketch.addLine",
      "sketch.addRectangle",
      "sketch.addCircle",
      "sketch.updateEntity",
      "sketch.deleteEntity",
      "sketch.rename",
      "sketch.delete",
      "feature.extrude",
      "feature.updateExtrude",
      "feature.delete"
    ]);
    expect(ops[0]).toMatchObject({
      op: "document.updateUnits",
      mode: "preservePhysicalSize"
    });
  });

  it("types CADOps batches", () => {
    const batch: CadBatch = {
      version: "cadops.v1",
      mode: "dryRun",
      actor: {
        type: "script",
        id: "test-script",
        name: "Test Script"
      },
      audit: {
        source: "script",
        requestId: "script_req_1",
        toolName: "local-script",
        intent: "dryRun",
        operationCount: 1
      },
      ops: [
        {
          op: "scene.createBox",
          dimensions: { width: 4, height: 5, depth: 6 }
        }
      ]
    };

    expect(batch.version).toBe("cadops.v1");
    expect(batch.mode).toBe("dryRun");
    expect(batch.actor?.type).toBe("script");
    expect(batch.audit?.operationCount).toBe(1);
    expect(batch.ops).toHaveLength(1);
  });

  it("types structured validation errors", () => {
    const error: CadBatchValidationError = {
      code: "INVALID_DIMENSIONS",
      message: "Box dimensions must be positive finite numbers.",
      opIndex: 0,
      op: "scene.createBox",
      path: "$.ops[0].dimensions",
      expected: "positive finite width, height, and depth",
      received: '{"width":0,"height":1,"depth":1}'
    };

    expect(error).toMatchObject({
      code: "INVALID_DIMENSIONS",
      op: "scene.createBox",
      path: "$.ops[0].dimensions"
    });
  });

  it("types CADOps read queries", () => {
    const queries: CadQueryRequest[] = [
      {
        version: "cadops.v1",
        query: { query: "project.summary" }
      },
      {
        version: "cadops.v1",
        query: { query: "project.features" }
      },
      {
        version: "cadops.v1",
        query: { query: "project.structure" }
      },
      {
        version: "cadops.v1",
        query: { query: "project.sketches" }
      },
      {
        version: "cadops.v1",
        query: { query: "object.get", id: "box_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "object.measurements", id: "box_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "project.extents" }
      },
      {
        version: "cadops.v1",
        query: { query: "sketch.get", id: "sketch_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "body.generatedReferences", bodyId: "body_1" }
      },
      {
        version: "cadops.v1",
        query: {
          query: "body.resolveGeneratedReference",
          bodyId: "body_1",
          stableId: "generated:face:body_1:startCap"
        }
      },
      {
        version: "cadops.v1",
        query: { query: "body.measurements", bodyId: "body_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "transaction.history" }
      }
    ];

    expect(queries.map((request) => request.query.query)).toEqual([
      "project.summary",
      "project.features",
      "project.structure",
      "project.sketches",
      "object.get",
      "object.measurements",
      "project.extents",
      "sketch.get",
      "body.generatedReferences",
      "body.resolveGeneratedReference",
      "body.measurements",
      "transaction.history"
    ]);
  });

  it("types generated body face and edge references", () => {
    const face: CadGeneratedFaceReference = {
      kind: "face",
      stableId: "generated:face:body_1:side:uMin",
      label: "uMin side face",
      description: "Side face generated from the rectangle uMin profile edge.",
      eligibleOperations: [
        "feature.attachSketchPlane",
        "feature.measureReference",
        "feature.selectReference"
      ],
      eligibilityNotes: [
        "Generated references are semantic first-slice references, not exact B-rep topology."
      ],
      bodyId: "body_1",
      ownerPartId: "part:default",
      sourceFeatureId: "feat_1",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1",
      role: "side:uMin",
      geometricSignature: {
        profileKind: "rectangle",
        sketchPlane: "XY",
        extrudeSide: "positive",
        depth: 5,
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 4,
          height: 2
        },
        surfaceType: "plane",
        normal: [-1, 0, 0],
        normalRole: "side:uMin"
      }
    };

    expect(face).toMatchObject({
      kind: "face",
      label: "uMin side face",
      role: "side:uMin",
      geometricSignature: {
        profileKind: "rectangle",
        surfaceType: "plane"
      }
    });

    const edge: CadGeneratedEdgeReference = {
      kind: "edge",
      stableId: "generated:edge:body_1:longitudinal:uMin:vMin",
      label: "uMin/vMin longitudinal edge",
      description: "Longitudinal edge joining the uMin/vMin rectangle corners.",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      eligibilityNotes: [
        "Generated references are semantic first-slice references, not exact B-rep topology."
      ],
      bodyId: "body_1",
      ownerPartId: "part:default",
      sourceFeatureId: "feat_1",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1",
      role: "longitudinal:uMin:vMin",
      adjacentFaceRoles: ["side:uMin", "side:vMin"],
      geometricSignature: {
        profileKind: "rectangle",
        sketchPlane: "XY",
        extrudeSide: "positive",
        depth: 5,
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 4,
          height: 2
        },
        curveType: "line",
        axis: [0, 0, 1],
        axisRole: "sketchPlaneNormal"
      }
    };

    expect(edge).toMatchObject({
      kind: "edge",
      label: "uMin/vMin longitudinal edge",
      role: "longitudinal:uMin:vMin",
      adjacentFaceRoles: ["side:uMin", "side:vMin"],
      geometricSignature: {
        profileKind: "rectangle",
        curveType: "line"
      }
    });

    const vertex: CadGeneratedVertexReference = {
      kind: "vertex",
      stableId: "generated:vertex:body_1:start:uMin:vMin",
      label: "Start uMin/vMin corner",
      description:
        "Corner vertex where the start cap, uMin side face, and vMin side face meet.",
      eligibleOperations: [
        "feature.measureReference",
        "feature.selectReference"
      ],
      eligibilityNotes: [
        "Generated references are semantic first-slice references, not exact B-rep topology."
      ],
      bodyId: "body_1",
      ownerPartId: "part:default",
      sourceFeatureId: "feat_1",
      sourceSketchId: "sketch_1",
      sourceSketchEntityId: "rect_1",
      role: "start:uMin:vMin",
      adjacentFaceRoles: ["startCap", "side:uMin", "side:vMin"],
      adjacentEdgeRoles: ["start:uMin", "start:vMin", "longitudinal:uMin:vMin"],
      geometricSignature: {
        profileKind: "rectangle",
        sketchPlane: "XY",
        extrudeSide: "positive",
        depth: 5,
        profile: {
          kind: "rectangle",
          center: [0, 0],
          width: 4,
          height: 2
        },
        axis: [0, 0, 1],
        axisRole: "sketchPlaneNormal",
        profilePoint: [-2, -1],
        positionRole: "start"
      }
    };

    expect(vertex).toMatchObject({
      kind: "vertex",
      label: "Start uMin/vMin corner",
      role: "start:uMin:vMin",
      adjacentFaceRoles: ["startCap", "side:uMin", "side:vMin"],
      adjacentEdgeRoles: ["start:uMin", "start:vMin", "longitudinal:uMin:vMin"],
      geometricSignature: {
        profileKind: "rectangle",
        profilePoint: [-2, -1],
        positionRole: "start"
      }
    });

    const resolverResponse: CadQueryResponse = {
      ok: true,
      query: "body.resolveGeneratedReference",
      cadOpsVersion: "cadops.v1",
      bodyId: "body_1",
      stableId: "generated:vertex:body_1:start:uMin:vMin",
      kind: "vertex",
      reference: vertex
    };

    expect(resolverResponse).toMatchObject({
      ok: true,
      query: "body.resolveGeneratedReference",
      kind: "vertex",
      reference: {
        stableId: "generated:vertex:body_1:start:uMin:vMin",
        label: "Start uMin/vMin corner"
      }
    });
  });

  it("types measurement bounds", () => {
    const bounds: CadAxisAlignedBounds = {
      min: [-1, -2, -3],
      max: [1, 2, 3],
      size: [2, 4, 6],
      center: [0, 0, 0]
    };

    expect(bounds.size).toEqual([2, 4, 6]);
  });

  it("types authored body measurements", () => {
    const response: CadQueryResponse = {
      ok: true,
      query: "body.measurements",
      cadOpsVersion: "cadops.v1",
      measurements: {
        bodyId: "body_1",
        sourceFeatureId: "feat_1",
        sourceSketchId: "sketch_1",
        sourceSketchEntityId: "rect_1",
        profileKind: "rectangle",
        units: "mm",
        sketchPlane: "XY",
        side: "positive",
        depth: 3,
        measurementModel: "sourceAnalytic",
        localBounds: {
          min: [-2, -1, 0],
          max: [2, 1, 3],
          size: [4, 2, 3],
          center: [0, 0, 1.5]
        },
        localExtents: [4, 2, 3],
        centroid: [0, 0, 1.5],
        volume: 24,
        surfaceArea: 52
      }
    };

    expect(response).toMatchObject({
      ok: true,
      query: "body.measurements",
      measurements: {
        profileKind: "rectangle",
        measurementModel: "sourceAnalytic",
        localExtents: [4, 2, 3],
        volume: 24
      }
    });
  });

  it("types primitive feature summaries", () => {
    const feature: CadPrimitiveFeatureSummary = {
      id: "feature:torus_1",
      kind: "primitive",
      partId: "part:default",
      primitive: "torus",
      objectId: "torus_1",
      bodyId: "body:torus_1",
      dimensions: { majorRadius: 3, minorRadius: 0.5 },
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      },
      source: {
        type: "sceneObject",
        createdByTransactionId: "txn_1",
        createOp: "scene.createTorus"
      }
    };

    expect(feature).toMatchObject({
      id: "feature:torus_1",
      kind: "primitive",
      objectId: "torus_1"
    });
  });

  it("types sketch extrude feature summaries", () => {
    const feature: CadExtrudeFeatureSummary = {
      id: "feat_1",
      kind: "extrude",
      partId: "part:default",
      bodyId: "body_1",
      sketchId: "sketch_1",
      entityId: "rect_1",
      profileKind: "rectangle",
      depth: 5,
      side: "positive",
      source: {
        type: "sketchEntity",
        sketchId: "sketch_1",
        entityId: "rect_1"
      }
    };

    expect(feature).toMatchObject({
      id: "feat_1",
      kind: "extrude",
      bodyId: "body_1",
      profileKind: "rectangle"
    });
  });

  it("types the V2 structural model bridge", () => {
    const part: CadPartSnapshot = {
      id: "part:default",
      kind: "part",
      name: "Default Part",
      source: { type: "defaultScenePart" },
      objectIds: ["box_1"],
      featureIds: ["feature:box_1"],
      bodyIds: ["body:box_1"],
      sketchIds: ["sketch_1"]
    };
    const body: CadBodySnapshot = {
      id: "body:box_1",
      kind: "solid",
      partId: "part:default",
      featureId: "feature:box_1",
      objectId: "box_1",
      primitive: "box",
      source: {
        type: "primitiveFeature",
        featureId: "feature:box_1",
        objectId: "box_1"
      }
    };
    const objectSource: CadObjectModelSource = {
      objectId: "box_1",
      partId: part.id,
      featureId: body.featureId,
      bodyId: body.id
    };

    expect(part.featureIds).toEqual(["feature:box_1"]);
    expect(body.partId).toBe(part.id);
    expect(objectSource).toEqual({
      objectId: "box_1",
      partId: "part:default",
      featureId: "feature:box_1",
      bodyId: "body:box_1"
    });
  });

  it("types attached sketch metadata", () => {
    const sketch: SketchSnapshot = {
      id: "sketch_face_1",
      name: "Face sketch",
      plane: "XY",
      attachment: {
        kind: "generatedFace",
        bodyId: "body_1",
        faceStableId: "generated:face:body_1:endCap",
        sourceFeatureId: "feat_1",
        sourceSketchId: "sketch_1",
        sourceSketchEntityId: "rect_1",
        faceRole: "endCap"
      },
      entities: []
    };

    expect(sketch.attachment).toMatchObject({
      kind: "generatedFace",
      faceStableId: "generated:face:body_1:endCap",
      faceRole: "endCap"
    });
  });

  it("types project extents with authored bodies and warnings", () => {
    const response: CadQueryResponse = {
      ok: true,
      query: "project.extents",
      cadOpsVersion: "cadops.v1",
      units: "mm",
      objectCount: 0,
      bodyCount: 1,
      bounds: {
        min: [-2, -1, 0],
        max: [2, 1, 3],
        size: [4, 2, 3],
        center: [0, 0, 1.5]
      },
      approximateVolume: 24,
      objects: [],
      bodies: [
        {
          bodyId: "body_1",
          sourceFeatureId: "feat_1",
          sourceSketchId: "sketch_1",
          sourceSketchEntityId: "rect_1",
          profileKind: "rectangle",
          worldBounds: {
            min: [-2, -1, 0],
            max: [2, 1, 3],
            size: [4, 2, 3],
            center: [0, 0, 1.5]
          },
          volume: 24
        }
      ],
      warnings: [
        {
          code: "BODY_EXTENTS_UNAVAILABLE",
          message: "Skipped stale body.",
          bodyId: "body_stale",
          featureId: "feat_stale"
        }
      ]
    };

    expect(response).toMatchObject({
      ok: true,
      query: "project.extents",
      bodyCount: 1,
      bodies: [{ bodyId: "body_1", volume: 24 }],
      warnings: [{ code: "BODY_EXTENTS_UNAVAILABLE" }]
    });
  });
});

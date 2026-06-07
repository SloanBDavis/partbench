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
  CadHoleFeatureSummary,
  CadObjectModelSource,
  CadPartSnapshot,
  CadPrimitiveFeatureSummary,
  CadOp,
  CadRevolveFeatureSummary,
  CadQueryRequest,
  CadQueryResponse,
  HoleFeatureSnapshot,
  RevolveFeatureSnapshot,
  ProjectHealthQueryResponse,
  SketchEvaluationQueryResponse,
  NamedGeneratedReferenceEntry,
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
        side: "negative",
        operationMode: "cut",
        targetBodyId: "body_target"
      },
      {
        op: "feature.revolve",
        id: "feat_revolve_1",
        bodyId: "body_revolve_1",
        name: "Turn",
        sketchId: "sketch_1",
        entityId: "rect_1",
        axis: {
          type: "sketchLine",
          sketchId: "sketch_1",
          entityId: "axis_1"
        },
        angleDegrees: 180,
        operationMode: "newBody"
      },
      {
        op: "feature.hole",
        id: "feat_hole_1",
        bodyId: "body_hole_1",
        targetBodyId: "body_target",
        name: "Mounting hole",
        sketchId: "sketch_1",
        circleEntityId: "circle_1",
        depthMode: "blind",
        depth: 4,
        direction: "negative"
      },
      {
        op: "feature.chamfer",
        id: "feat_chamfer_1",
        bodyId: "body_chamfer_1",
        targetBodyId: "body_target",
        edgeStableId: "generated:edge:body_target:start:uMin",
        distance: 0.5,
        name: "Break edge"
      },
      {
        op: "feature.fillet",
        id: "feat_fillet_1",
        bodyId: "body_fillet_1",
        targetBodyId: "body_chamfer_1",
        namedReference: "Round edge",
        radius: 1,
        name: "Round edge"
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
      },
      {
        op: "reference.nameGenerated",
        name: "Mounting face",
        bodyId: "body_1",
        stableId: "generated:face:body_1:startCap"
      },
      {
        op: "reference.deleteName",
        name: "Mounting face"
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
      "feature.revolve",
      "feature.hole",
      "feature.chamfer",
      "feature.fillet",
      "feature.updateExtrude",
      "feature.delete",
      "reference.nameGenerated",
      "reference.deleteName"
    ]);
    expect(ops[0]).toMatchObject({
      op: "document.updateUnits",
      mode: "preservePhysicalSize"
    });
    const namedFaceOp: CadOp = {
      op: "sketch.createOnFace",
      id: "sketch_named_face_1",
      name: "Named face sketch",
      referenceName: "Mounting face"
    };
    const addExtrudeOp: CadOp = {
      op: "feature.extrude",
      id: "feat_add",
      bodyId: "body_add",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 2,
      operationMode: "add",
      targetBodyId: "body_target"
    };
    expect(namedFaceOp).toMatchObject({
      op: "sketch.createOnFace",
      referenceName: "Mounting face"
    });
    expect(addExtrudeOp).toMatchObject({
      op: "feature.extrude",
      operationMode: "add",
      targetBodyId: "body_target"
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

  it("types V3 parameter and sketch dimension commands", () => {
    const ops: CadOp[] = [
      {
        op: "parameter.create",
        id: "param_line",
        name: "Line length",
        value: 5
      },
      {
        op: "sketch.dimension.create",
        id: "dim_line_length",
        name: "Line length dimension",
        sketchId: "sketch_1",
        entityId: "line_1",
        target: { entityKind: "line", role: "length" },
        parameterId: "param_line"
      },
      {
        op: "sketch.dimension.update",
        id: "dim_line_length",
        value: 8
      },
      {
        op: "sketch.dimension.rename",
        id: "dim_line_length",
        name: "Overall line length"
      },
      { op: "sketch.dimension.delete", id: "dim_line_length" },
      {
        op: "sketch.constraint.create",
        id: "con_horizontal",
        name: "Horizontal line",
        sketchId: "sketch_1",
        entityId: "line_1",
        kind: "horizontal"
      },
      {
        op: "sketch.constraint.create",
        id: "con_fixed",
        name: "Fix line start",
        sketchId: "sketch_1",
        kind: "fixed",
        target: { entityId: "line_1", role: "start" },
        coordinate: [0, 0]
      },
      {
        op: "sketch.constraint.create",
        id: "con_coincident",
        name: "Coincident points",
        sketchId: "sketch_1",
        kind: "coincident",
        primaryTarget: { entityId: "point_1", role: "position" },
        secondaryTarget: { entityId: "line_1", role: "end" }
      },
      {
        op: "sketch.constraint.create",
        id: "con_midpoint",
        name: "Point at midpoint",
        sketchId: "sketch_1",
        kind: "midpoint",
        lineEntityId: "line_1",
        target: { entityId: "point_1", role: "position" }
      },
      {
        op: "sketch.constraint.create",
        id: "con_parallel",
        name: "Parallel lines",
        sketchId: "sketch_1",
        kind: "parallel",
        primaryLineEntityId: "line_1",
        secondaryLineEntityId: "line_2"
      },
      {
        op: "sketch.constraint.create",
        id: "con_perpendicular",
        name: "Perpendicular lines",
        sketchId: "sketch_1",
        kind: "perpendicular",
        primaryLineEntityId: "line_1",
        secondaryLineEntityId: "line_2"
      },
      {
        op: "sketch.constraint.rename",
        id: "con_horizontal",
        name: "Main horizontal"
      },
      { op: "sketch.constraint.delete", id: "con_horizontal" },
      { op: "parameter.delete", id: "param_line" }
    ];

    expect(ops.map((op) => op.op)).toEqual([
      "parameter.create",
      "sketch.dimension.create",
      "sketch.dimension.update",
      "sketch.dimension.rename",
      "sketch.dimension.delete",
      "sketch.constraint.create",
      "sketch.constraint.create",
      "sketch.constraint.create",
      "sketch.constraint.create",
      "sketch.constraint.create",
      "sketch.constraint.create",
      "sketch.constraint.rename",
      "sketch.constraint.delete",
      "parameter.delete"
    ]);
    expect(ops[1]).toMatchObject({
      op: "sketch.dimension.create",
      target: { entityKind: "line", role: "length" }
    });
    expect(ops[5]).toMatchObject({
      op: "sketch.constraint.create",
      kind: "horizontal"
    });
    expect(ops[6]).toMatchObject({
      op: "sketch.constraint.create",
      kind: "fixed",
      target: { entityId: "line_1", role: "start" }
    });
    expect(ops[7]).toMatchObject({
      op: "sketch.constraint.create",
      kind: "coincident",
      primaryTarget: { entityId: "point_1", role: "position" },
      secondaryTarget: { entityId: "line_1", role: "end" }
    });
    expect(ops[8]).toMatchObject({
      op: "sketch.constraint.create",
      kind: "midpoint",
      lineEntityId: "line_1",
      target: { entityId: "point_1", role: "position" }
    });
    expect(ops[9]).toMatchObject({
      op: "sketch.constraint.create",
      kind: "parallel",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2"
    });
    expect(ops[10]).toMatchObject({
      op: "sketch.constraint.create",
      kind: "perpendicular",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2"
    });
  });

  it("types rectangle-tool boolean commands with authored target body ids", () => {
    const cutOp: CadOp = {
      op: "feature.extrude",
      id: "feat_circle_cut",
      bodyId: "body_circle_cut",
      targetBodyId: "body_circle_target",
      sketchId: "sketch_1",
      entityId: "rect_tool",
      depth: 1,
      operationMode: "cut"
    };
    const addOp: CadOp = {
      op: "feature.extrude",
      id: "feat_rect_add",
      bodyId: "body_rect_add",
      targetBodyId: "body_rect_target",
      sketchId: "sketch_1",
      entityId: "rect_tool",
      depth: 1,
      operationMode: "add"
    };
    const batch: CadBatch = {
      version: "cadops.v1",
      mode: "dryRun",
      ops: [cutOp, addOp]
    };

    expect(batch.ops[0]).toMatchObject({
      op: "feature.extrude",
      operationMode: "cut",
      targetBodyId: "body_circle_target"
    });
    expect(batch.ops[1]).toMatchObject({
      op: "feature.extrude",
      operationMode: "add",
      targetBodyId: "body_rect_target"
    });
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
        query: { query: "project.health" }
      },
      {
        version: "cadops.v1",
        query: {
          query: "project.health",
          derivedExactMetadata: [
            {
              bodyId: "body_hole_1",
              sourceIdentityCacheKey: "body-topology:v1:hole",
              status: "unsupported",
              error: {
                code: "UNSUPPORTED_EXACT_METADATA_SOURCE",
                message: "Unsupported exact metadata source."
              }
            }
          ]
        }
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
        query: {
          query: "project.extents",
          derivedExactMetadata: [
            {
              bodyId: "body_revolve_1",
              sourceIdentityCacheKey: "body-topology:v1:revolve",
              status: "ready",
              metadata: {
                source: "kernel-derived",
                confidence: "kernel-derived",
                bounds: {
                  min: [0, 0, 0],
                  max: [1, 2, 3],
                  size: [1, 2, 3],
                  center: [0.5, 1, 1.5]
                },
                volume: 6,
                diagnostics: []
              }
            }
          ]
        }
      },
      {
        version: "cadops.v1",
        query: { query: "sketch.get", id: "sketch_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "parameter.list" }
      },
      {
        version: "cadops.v1",
        query: { query: "parameter.get", id: "param_width" }
      },
      {
        version: "cadops.v1",
        query: { query: "sketch.dimensions", sketchId: "sketch_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "sketch.dimension.get", id: "dim_width" }
      },
      {
        version: "cadops.v1",
        query: { query: "sketch.evaluation", sketchId: "sketch_1" }
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
        query: { query: "body.topology", bodyId: "body_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "body.measurements", bodyId: "body_1" }
      },
      {
        version: "cadops.v1",
        query: { query: "reference.listNamed" }
      },
      {
        version: "cadops.v1",
        query: { query: "reference.resolveNamed", name: "Mounting face" }
      },
      {
        version: "cadops.v1",
        query: {
          query: "selection.referenceCandidates",
          selection: {
            type: "generatedReference",
            bodyId: "body_1",
            stableId: "generated:face:body_1:endCap",
            expectedKind: "face"
          },
          requiredOperation: "feature.attachSketchPlane"
        }
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
      "project.health",
      "project.health",
      "project.sketches",
      "object.get",
      "object.measurements",
      "project.extents",
      "project.extents",
      "sketch.get",
      "parameter.list",
      "parameter.get",
      "sketch.dimensions",
      "sketch.dimension.get",
      "sketch.evaluation",
      "body.generatedReferences",
      "body.resolveGeneratedReference",
      "body.topology",
      "body.measurements",
      "reference.listNamed",
      "reference.resolveNamed",
      "selection.referenceCandidates",
      "transaction.history"
    ]);
  });

  it("types V4 sketch completeness status responses", () => {
    const evaluation: SketchEvaluationQueryResponse = {
      ok: true,
      query: "sketch.evaluation",
      cadOpsVersion: "cadops.v1",
      sketchId: "sketch_1",
      sketchName: "Profile",
      plane: "XY",
      status: "under-defined",
      drivenEntityCount: 1,
      drivenEntityIds: ["rect_1"],
      dimensionCount: 0,
      dimensions: [],
      constraintCount: 0,
      constraints: [],
      issueCount: 1,
      issues: [
        {
          code: "UNDER_DEFINED_SKETCH",
          message: "Sketch sketch_1 is under-defined.",
          sketchId: "sketch_1"
        }
      ]
    };
    const health: ProjectHealthQueryResponse = {
      ok: true,
      query: "project.health",
      cadOpsVersion: "cadops.v1",
      status: "under-defined",
      issueCount: 1,
      authoredExtrudeCount: 0,
      authoredRevolveCount: 1,
      authoredHoleCount: 0,
      authoredChamferCount: 0,
      authoredFilletCount: 0,
      attachedSketchCount: 0,
      sketchEvaluationCount: 1,
      sketchDimensionCount: 0,
      sketchConstraintCount: 0,
      namedReferenceCount: 0,
      authoredExtrudes: [],
      authoredRevolves: [
        {
          featureId: "feat_revolve_1",
          bodyId: "body_revolve_1",
          sketchId: "sketch_1",
          entityId: "rect_1",
          profileKind: "rectangle",
          axis: {
            type: "sketchLine",
            sketchId: "sketch_1",
            entityId: "axis_1"
          },
          angleDegrees: 360,
          operationMode: "newBody",
          topologyStatus: "unsupported",
          topologyModel: "none",
          topologyAvailable: false,
          exactMeasurementsAvailable: true,
          measurementConfidence: "kernel-derived",
          topologyIssueCount: 1,
          status: "healthy",
          issues: []
        }
      ],
      authoredHoles: [],
      authoredChamfers: [],
      authoredFillets: [],
      attachedSketches: [],
      sketchEvaluations: [
        {
          sketchId: "sketch_1",
          sketchName: "Profile",
          plane: "XY",
          status: "under-defined",
          drivenEntityIds: ["rect_1"],
          affectedFeatureIds: [],
          affectedBodyIds: [],
          issues: [
            {
              code: "UNDER_DEFINED_SKETCH",
              message: "Sketch sketch_1 is under-defined.",
              sketchId: "sketch_1"
            }
          ]
        }
      ],
      sketchDimensions: [],
      sketchConstraints: [],
      namedReferences: []
    };

    expect(evaluation.status).toBe("under-defined");
    expect(health.sketchEvaluations[0]?.status).toBe("under-defined");
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

    const namedReference: NamedGeneratedReferenceEntry = {
      name: "Mounting face",
      bodyId: "body_1",
      stableId: "generated:face:body_1:side:uMin",
      kind: "face",
      status: "resolved",
      reference: face
    };

    const namedReferencesResponse: CadQueryResponse = {
      ok: true,
      query: "reference.listNamed",
      cadOpsVersion: "cadops.v1",
      referenceCount: 1,
      references: [namedReference]
    };

    expect(namedReferencesResponse).toMatchObject({
      ok: true,
      query: "reference.listNamed",
      references: [
        {
          name: "Mounting face",
          status: "resolved",
          reference: { label: "uMin side face" }
        }
      ]
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

  it("types derived body topology status", () => {
    const response: CadQueryResponse = {
      ok: true,
      query: "body.topology",
      cadOpsVersion: "cadops.v1",
      topology: {
        bodyId: "body_1",
        units: "mm",
        status: "healthy",
        sourceKind: "authoredExtrude",
        sourceIdentity: {
          bodyId: "body_1",
          sourceKind: "authoredExtrude",
          cacheKey: "body-topology:v1:{}",
          units: "mm",
          featureId: "feat_1",
          operationMode: "newBody",
          sourceSketchId: "sketch_1",
          sourceSketchEntityId: "rect_1",
          profileKind: "rectangle",
          profileSignature: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 2
          },
          side: "positive",
          depth: 3
        },
        topologyModel: "semantic-source",
        topologyAvailable: true,
        exactGeometryAvailable: false,
        exactMeasurementsAvailable: true,
        measurementConfidence: "source-analytic",
        faceCount: 6,
        edgeCount: 12,
        vertexCount: 8,
        issues: []
      }
    };

    expect(response).toMatchObject({
      ok: true,
      query: "body.topology",
      topology: {
        status: "healthy",
        topologyAvailable: true,
        exactMeasurementsAvailable: true,
        faceCount: 6
      }
    });
  });

  it("types derived exact body metadata snapshots on body topology queries", () => {
    const request: CadQueryRequest = {
      version: "cadops.v1",
      query: {
        query: "body.topology",
        bodyId: "body_1",
        derivedExactMetadata: {
          bodyId: "body_1",
          sourceIdentityCacheKey: "body-topology:v1:{}",
          status: "ready",
          metadata: {
            source: "kernel-derived",
            confidence: "kernel-derived",
            bounds: {
              min: [0, 0, 0],
              max: [4, 2, 3],
              size: [4, 2, 3],
              center: [2, 1, 1.5]
            },
            volume: 24,
            surfaceArea: 52,
            centroid: [2, 1, 1.5],
            topologyCounts: {
              solidCount: 1,
              faceCount: 6,
              edgeCount: 12,
              vertexCount: 8
            },
            diagnostics: []
          }
        }
      }
    };

    const response: CadQueryResponse = {
      ok: true,
      query: "body.topology",
      cadOpsVersion: request.version,
      topology: {
        bodyId: "body_1",
        units: "mm",
        status: "healthy",
        sourceKind: "authoredExtrude",
        sourceIdentity: {
          bodyId: "body_1",
          sourceKind: "authoredExtrude",
          cacheKey: "body-topology:v1:{}",
          units: "mm"
        },
        topologyModel: "semantic-source",
        topologyAvailable: true,
        exactGeometryAvailable: true,
        exactMeasurementsAvailable: true,
        measurementConfidence: "kernel-derived",
        exactMetadata: {
          status: "healthy",
          source: "kernel-derived",
          confidence: "kernel-derived",
          bounds: {
            min: [0, 0, 0],
            max: [4, 2, 3],
            size: [4, 2, 3],
            center: [2, 1, 1.5]
          },
          volume: 24,
          surfaceArea: 52,
          centroid: [2, 1, 1.5],
          topologyCounts: {
            solidCount: 1,
            faceCount: 6,
            edgeCount: 12,
            vertexCount: 8
          },
          diagnostics: []
        },
        faceCount: 6,
        edgeCount: 12,
        vertexCount: 8,
        issues: []
      }
    };

    expect(request.query).toMatchObject({
      query: "body.topology",
      derivedExactMetadata: { status: "ready" }
    });
    expect(response).toMatchObject({
      topology: {
        exactGeometryAvailable: true,
        measurementConfidence: "kernel-derived",
        exactMetadata: {
          status: "healthy",
          volume: 24,
          topologyCounts: { faceCount: 6 }
        }
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
      operationMode: "newBody",
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

  it("types sketch revolve feature snapshots and summaries", () => {
    const snapshot: RevolveFeatureSnapshot = {
      id: "feat_revolve_1",
      kind: "revolve",
      sketchId: "sketch_1",
      entityId: "rect_1",
      profileKind: "rectangle",
      axis: {
        type: "sketchLine",
        sketchId: "sketch_1",
        entityId: "axis_1"
      },
      angleDegrees: 270,
      operationMode: "newBody",
      bodyId: "body_revolve_1"
    };
    const feature: CadRevolveFeatureSummary = {
      id: snapshot.id,
      kind: "revolve",
      partId: "part:default",
      bodyId: snapshot.bodyId,
      sketchId: snapshot.sketchId,
      entityId: snapshot.entityId,
      profileKind: snapshot.profileKind,
      axis: snapshot.axis,
      angleDegrees: snapshot.angleDegrees,
      operationMode: "newBody",
      source: {
        type: "sketchEntityWithAxis",
        sketchId: snapshot.sketchId,
        entityId: snapshot.entityId,
        axis: snapshot.axis
      }
    };

    expect(feature).toMatchObject({
      id: "feat_revolve_1",
      kind: "revolve",
      bodyId: "body_revolve_1",
      angleDegrees: 270
    });
  });

  it("types sketch hole feature snapshots and summaries", () => {
    const snapshot: HoleFeatureSnapshot = {
      id: "feat_hole_1",
      kind: "hole",
      targetBodyId: "body_target",
      sketchId: "sketch_1",
      circleEntityId: "circle_1",
      depthMode: "blind",
      depth: 4,
      direction: "negative",
      bodyId: "body_hole_1"
    };
    const feature: CadHoleFeatureSummary = {
      id: snapshot.id,
      kind: "hole",
      partId: "part:default",
      bodyId: snapshot.bodyId,
      targetBodyId: snapshot.targetBodyId,
      sketchId: snapshot.sketchId,
      circleEntityId: snapshot.circleEntityId,
      depthMode: snapshot.depthMode,
      depth: snapshot.depth,
      direction: snapshot.direction,
      source: {
        type: "sketchCircleHole",
        sketchId: snapshot.sketchId,
        circleEntityId: snapshot.circleEntityId,
        targetBodyId: snapshot.targetBodyId
      }
    };

    expect(feature).toMatchObject({
      id: "feat_hole_1",
      kind: "hole",
      bodyId: "body_hole_1",
      targetBodyId: "body_target",
      depthMode: "blind"
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
      bodyCount: 2,
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
          sourceKind: "authoredExtrude",
          extentSource: "source-analytic",
          measurementConfidence: "source-analytic",
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
        },
        {
          bodyId: "body_revolve",
          sourceFeatureId: "feat_revolve",
          sourceKind: "authoredRevolve",
          extentSource: "kernel-derived",
          measurementConfidence: "kernel-derived",
          sourceIdentityCacheKey: "body-topology:v1:revolve",
          worldBounds: {
            min: [-1, -1, 0],
            max: [1, 1, 2],
            size: [2, 2, 2],
            center: [0, 0, 1]
          },
          volume: 8,
          surfaceArea: 24,
          centroid: [0, 0, 1],
          topologyCounts: {
            solidCount: 1,
            faceCount: 3,
            edgeCount: 6,
            vertexCount: 4
          }
        }
      ],
      warnings: [
        {
          code: "BODY_EXTENTS_UNAVAILABLE",
          message: "Skipped stale body.",
          bodyId: "body_stale",
          featureId: "feat_stale"
        },
        {
          code: "DERIVED_EXACT_METADATA_STALE",
          message: "Skipped stale exact metadata.",
          bodyId: "body_revolve",
          featureId: "feat_revolve",
          status: "stale",
          expected: "body-topology:v1:new",
          received: "body-topology:v1:old"
        }
      ]
    };

    expect(response).toMatchObject({
      ok: true,
      query: "project.extents",
      bodyCount: 2
    });
    if (response.ok && response.query === "project.extents") {
      expect(response.bodies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ bodyId: "body_1", volume: 24 })
        ])
      );
      expect(response.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "BODY_EXTENTS_UNAVAILABLE" }),
          expect.objectContaining({ code: "DERIVED_EXACT_METADATA_STALE" })
        ])
      );
    }
  });

  it("types generated reference measurements", () => {
    const response: CadQueryResponse = {
      ok: true,
      query: "body.generatedReferenceMeasurements",
      cadOpsVersion: "cadops.v1",
      bodyId: "body_1",
      stableId: "generated:face:body_1:endCap",
      kind: "face",
      reference: {
        kind: "face",
        stableId: "generated:face:body_1:endCap",
        label: "End cap",
        eligibleOperations: ["feature.measureReference"],
        bodyId: "body_1",
        ownerPartId: "part:default",
        sourceFeatureId: "feat_1",
        sourceSketchId: "sketch_1",
        sourceSketchEntityId: "rect_1",
        role: "endCap",
        geometricSignature: {
          profileKind: "rectangle",
          sketchPlane: "XY",
          extrudeSide: "positive",
          depth: 3
        }
      },
      measurements: {
        kind: "face",
        stableId: "generated:face:body_1:endCap",
        bodyId: "body_1",
        sourceFeatureId: "feat_1",
        sourceSketchId: "sketch_1",
        sourceSketchEntityId: "rect_1",
        profileKind: "rectangle",
        units: "mm",
        measurementModel: "sourceAnalytic",
        role: "endCap",
        area: 8,
        bounds: {
          min: [-2, -1, 3],
          max: [2, 1, 3],
          size: [4, 2, 0],
          center: [0, 0, 3]
        },
        center: [0, 0, 3],
        surfaceType: "plane",
        normal: [0, 0, 1],
        normalRole: "endCapOutward"
      }
    };

    expect(response).toMatchObject({
      ok: true,
      query: "body.generatedReferenceMeasurements",
      kind: "face",
      measurements: {
        kind: "face",
        role: "endCap",
        area: 8
      }
    });
  });

  it("types selection reference candidate responses", () => {
    const response: CadQueryResponse = {
      ok: true,
      query: "selection.referenceCandidates",
      cadOpsVersion: "cadops.v1",
      selection: {
        type: "generatedReference",
        bodyId: "body_1",
        stableId: "generated:face:body_1:endCap",
        expectedKind: "face"
      },
      requiredOperation: "feature.attachSketchPlane",
      status: "resolved",
      candidateCount: 1,
      candidates: [
        {
          source: "generatedReferenceSelection",
          target: {
            type: "generatedReference",
            bodyId: "body_1",
            stableId: "generated:face:body_1:endCap",
            kind: "face"
          },
          reference: {
            kind: "face",
            stableId: "generated:face:body_1:endCap",
            label: "End cap",
            eligibleOperations: [
              "feature.attachSketchPlane",
              "feature.measureReference",
              "feature.selectReference"
            ],
            bodyId: "body_1",
            ownerPartId: "part:default",
            sourceFeatureId: "feat_1",
            sourceSketchId: "sketch_1",
            sourceSketchEntityId: "rect_1",
            role: "endCap",
            geometricSignature: {
              profileKind: "rectangle",
              sketchPlane: "XY",
              extrudeSide: "positive",
              depth: 3
            }
          },
          commandable: true,
          commandOperations: [
            "reference.nameGenerated",
            "feature.attachSketchPlane",
            "feature.measureReference",
            "feature.selectReference"
          ],
          label: "End cap",
          issues: []
        }
      ],
      issueCount: 0,
      issues: []
    };
    const blocked: CadQueryResponse = {
      ok: true,
      query: "selection.referenceCandidates",
      cadOpsVersion: "cadops.v1",
      selection: { type: "body", bodyId: "body_cut" },
      status: "ambiguous",
      candidateCount: 0,
      candidates: [],
      issueCount: 1,
      issues: [
        {
          code: "AMBIGUOUS_SELECTION_TOPOLOGY",
          status: "ambiguous",
          message:
            "Boolean result body body_cut does not yet have stable command-ready generated topology.",
          bodyId: "body_cut",
          featureId: "feat_cut",
          expected: "authored rectangle/circle newBody extrude",
          received: "cut extrude result"
        }
      ]
    };

    expect(response).toMatchObject({
      ok: true,
      query: "selection.referenceCandidates",
      status: "resolved",
      candidates: [
        {
          commandable: true,
          commandOperations: expect.arrayContaining([
            "reference.nameGenerated",
            "feature.attachSketchPlane"
          ])
        }
      ]
    });
    expect(blocked).toMatchObject({
      ok: true,
      query: "selection.referenceCandidates",
      status: "ambiguous",
      issues: [{ code: "AMBIGUOUS_SELECTION_TOPOLOGY" }]
    });
  });
});

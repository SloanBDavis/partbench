import type {
  BodyId,
  CadBatch,
  CadDependencyHealthStatus,
  CadExportFormatId,
  CadExportReadinessStatus,
  CadGeneratedEntityKind,
  CadOp,
  CadSelectionReferenceInput,
  CadSelectionReferenceOperation,
  CadSelectionReferenceStatus,
  DocumentUnits,
  NamedReferenceName
} from "@web-cad/cad-protocol";

export type V7ReleaseSampleId =
  | "v7-rectangle-extrude-reference"
  | "v7-circle-extrude-export"
  | "v7-consumed-body-diagnostics"
  | "v7-revolve-source-diagnostics"
  | "v7-hole-source-diagnostics"
  | "v7-edge-finish-source-diagnostics";

export type V7ReleaseSampleWorkflowTag =
  | "sketch"
  | "rectangle-profile"
  | "circle-profile"
  | "axis-line"
  | "new-body-extrude"
  | "new-body-revolve"
  | "hole"
  | "chamfer"
  | "fillet"
  | "edge-finish"
  | "generated-references"
  | "named-references"
  | "selection-reference-candidates"
  | "export-readiness"
  | "consumed-body"
  | "unsupported-result-topology";

export interface V7ReleaseSampleSourceCounts {
  readonly sketchCount: number;
  readonly sketchEntityCount: number;
  readonly featureCount: number;
  readonly bodyCount: number;
  readonly activeBodyCount: number;
  readonly consumedBodyCount: number;
  readonly namedReferenceCount: number;
}

export interface V7ReleaseSampleGeneratedReferenceExpectation {
  readonly bodyId: BodyId;
  readonly bodyStableId: string;
  readonly faceStableIds: readonly string[];
  readonly edgeStableIds: readonly string[];
  readonly vertexStableIds: readonly string[];
}

export interface V7ReleaseSampleNamedReferenceExpectation {
  readonly name: NamedReferenceName;
  readonly bodyId: BodyId;
  readonly stableId: string;
  readonly kind: CadGeneratedEntityKind;
}

export interface V7ReleaseSampleSelectionExpectation {
  readonly selection: CadSelectionReferenceInput;
  readonly requiredOperation?: CadSelectionReferenceOperation;
  readonly expectedStatus: CadSelectionReferenceStatus;
  readonly expectedCandidateCount: number;
  readonly expectedCommandableCount: number;
}

export interface V7ReleaseSampleReferenceSummaryExpectation {
  readonly namedReferenceCount: number;
  readonly semanticBodySelectionCount: number;
  readonly generatedReferenceBodyCount: number;
  readonly generatedReferenceCount: number;
  readonly commandableReferenceCount: number;
}

export interface V7ReleaseSampleExportFormatExpectation {
  readonly format: CadExportFormatId;
  readonly status: CadExportReadinessStatus;
  readonly available: boolean;
  readonly sourceSupportedBodyCount: number;
  readonly deferredBodyCount: number;
  readonly unavailableBodyCount: number;
}

export interface V7ReleaseSampleExportExpectation {
  readonly status: CadExportReadinessStatus;
  readonly canExportFiles: boolean;
  readonly bodyCount: number;
  readonly sourceSupportedBodyCount: number;
  readonly deferredBodyCount: number;
  readonly unavailableBodyCount: number;
  readonly formats: readonly V7ReleaseSampleExportFormatExpectation[];
}

export interface V7ReleaseSampleFixture {
  readonly id: V7ReleaseSampleId;
  readonly title: string;
  readonly description: string;
  readonly units: DocumentUnits;
  readonly workflowTags: readonly V7ReleaseSampleWorkflowTag[];
  readonly expectedSourceCounts: V7ReleaseSampleSourceCounts;
  readonly expectedHealthStatus: CadDependencyHealthStatus;
  readonly expectedHealthIssueCount: number;
  readonly expectedGeneratedReferences: readonly V7ReleaseSampleGeneratedReferenceExpectation[];
  readonly expectedNamedReferences: readonly V7ReleaseSampleNamedReferenceExpectation[];
  readonly expectedSelectionQueries: readonly V7ReleaseSampleSelectionExpectation[];
  readonly expectedReferenceSummary: V7ReleaseSampleReferenceSummaryExpectation;
  readonly expectedExportReadiness: V7ReleaseSampleExportExpectation;
  readonly knownLimitations: readonly string[];
  readonly ops: readonly CadOp[];
}

const RECTANGLE_BODY_ID = "v7_rect_body";
const RECTANGLE_END_FACE = `generated:face:${RECTANGLE_BODY_ID}:endCap`;
const RECTANGLE_LONG_EDGE = `generated:edge:${RECTANGLE_BODY_ID}:longitudinal:uMin:vMin`;

const CIRCLE_BODY_ID = "v7_circle_body";
const CIRCLE_END_FACE = `generated:face:${CIRCLE_BODY_ID}:endCap`;
const CIRCLE_SIDE_FACE = `generated:face:${CIRCLE_BODY_ID}:side:circular`;
const CIRCLE_END_EDGE = `generated:edge:${CIRCLE_BODY_ID}:end:circular`;

const CONSUMED_TARGET_BODY_ID = "v7_consumed_rect_body";
const CONSUMED_RESULT_BODY_ID = "v7_consumed_cut_body";
const CONSUMED_END_FACE = `generated:face:${CONSUMED_TARGET_BODY_ID}:endCap`;
const CONSUMED_LONG_EDGE = `generated:edge:${CONSUMED_TARGET_BODY_ID}:longitudinal:uMin:vMin`;

const REVOLVE_BODY_ID = "v7_revolve_body";

const HOLE_TARGET_BODY_ID = "v7_hole_target_body";
const HOLE_RESULT_BODY_ID = "v7_hole_result_body";
const HOLE_TARGET_END_FACE = `generated:face:${HOLE_TARGET_BODY_ID}:endCap`;
const HOLE_TARGET_LONG_EDGE = `generated:edge:${HOLE_TARGET_BODY_ID}:longitudinal:uMin:vMin`;

const CHAMFER_TARGET_BODY_ID = "v7_chamfer_target_body";
const CHAMFER_RESULT_BODY_ID = "v7_chamfer_result_body";
const CHAMFER_TARGET_EDGE = `generated:edge:${CHAMFER_TARGET_BODY_ID}:start:uMin`;

const FILLET_TARGET_BODY_ID = "v7_fillet_target_body";
const FILLET_RESULT_BODY_ID = "v7_fillet_result_body";
const FILLET_TARGET_EDGE = `generated:edge:${FILLET_TARGET_BODY_ID}:longitudinal:uMax:vMax`;

export const V7_RELEASE_SAMPLE_FIXTURES = [
  {
    id: "v7-rectangle-extrude-reference",
    title: "V7 rectangle extrude reference sample",
    description:
      "Authored rectangle sketch extruded as a new body with generated face and edge references plus named generated references.",
    units: "mm",
    workflowTags: [
      "sketch",
      "rectangle-profile",
      "new-body-extrude",
      "generated-references",
      "named-references",
      "selection-reference-candidates",
      "export-readiness"
    ],
    expectedSourceCounts: {
      sketchCount: 1,
      sketchEntityCount: 1,
      featureCount: 1,
      bodyCount: 1,
      activeBodyCount: 1,
      consumedBodyCount: 0,
      namedReferenceCount: 2
    },
    expectedHealthStatus: "under-defined",
    expectedHealthIssueCount: 1,
    expectedGeneratedReferences: [
      {
        bodyId: RECTANGLE_BODY_ID,
        bodyStableId: `generated:body:${RECTANGLE_BODY_ID}`,
        faceStableIds: [
          `generated:face:${RECTANGLE_BODY_ID}:startCap`,
          RECTANGLE_END_FACE,
          `generated:face:${RECTANGLE_BODY_ID}:side:uMin`
        ],
        edgeStableIds: [
          RECTANGLE_LONG_EDGE,
          `generated:edge:${RECTANGLE_BODY_ID}:end:uMin`
        ],
        vertexStableIds: [
          `generated:vertex:${RECTANGLE_BODY_ID}:start:uMin:vMin`
        ]
      }
    ],
    expectedNamedReferences: [
      {
        name: "Rectangle top face",
        bodyId: RECTANGLE_BODY_ID,
        stableId: RECTANGLE_END_FACE,
        kind: "face"
      },
      {
        name: "Rectangle lower front edge",
        bodyId: RECTANGLE_BODY_ID,
        stableId: RECTANGLE_LONG_EDGE,
        kind: "edge"
      }
    ],
    expectedSelectionQueries: [
      {
        selection: { type: "body", bodyId: RECTANGLE_BODY_ID },
        expectedStatus: "resolved",
        expectedCandidateCount: 1,
        expectedCommandableCount: 1
      },
      {
        selection: {
          type: "generatedReference",
          bodyId: RECTANGLE_BODY_ID,
          stableId: RECTANGLE_END_FACE,
          expectedKind: "face"
        },
        requiredOperation: "feature.attachSketchPlane",
        expectedStatus: "resolved",
        expectedCandidateCount: 1,
        expectedCommandableCount: 1
      },
      {
        selection: {
          type: "generatedReference",
          bodyId: RECTANGLE_BODY_ID,
          stableId: RECTANGLE_LONG_EDGE,
          expectedKind: "edge"
        },
        requiredOperation: "feature.chamfer",
        expectedStatus: "resolved",
        expectedCandidateCount: 1,
        expectedCommandableCount: 1
      },
      {
        selection: { type: "namedReference", name: "Rectangle top face" },
        requiredOperation: "feature.attachSketchPlane",
        expectedStatus: "resolved",
        expectedCandidateCount: 1,
        expectedCommandableCount: 1
      }
    ],
    expectedReferenceSummary: {
      namedReferenceCount: 2,
      semanticBodySelectionCount: 1,
      generatedReferenceBodyCount: 1,
      generatedReferenceCount: 27,
      commandableReferenceCount: 27
    },
    expectedExportReadiness: {
      status: "deferred",
      canExportFiles: false,
      bodyCount: 1,
      sourceSupportedBodyCount: 1,
      deferredBodyCount: 1,
      unavailableBodyCount: 0,
      formats: [
        {
          format: "step",
          status: "deferred",
          available: false,
          sourceSupportedBodyCount: 1,
          deferredBodyCount: 1,
          unavailableBodyCount: 0
        },
        {
          format: "glb",
          status: "deferred",
          available: false,
          sourceSupportedBodyCount: 1,
          deferredBodyCount: 1,
          unavailableBodyCount: 0
        }
      ]
    },
    knownLimitations: [
      "STEP file writing is deferred; this sample proves current source readiness only.",
      "Visualization GLB availability remains an app-derived browser concern and is not fixture source truth."
    ],
    ops: [
      {
        op: "sketch.create",
        id: "v7_rect_sketch",
        name: "Rectangle release profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v7_rect_sketch",
        id: "v7_rect_profile",
        center: [0, 0],
        width: 4,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "v7_rect_extrude",
        bodyId: RECTANGLE_BODY_ID,
        name: "Rectangle reference body",
        sketchId: "v7_rect_sketch",
        entityId: "v7_rect_profile",
        depth: 3,
        side: "positive",
        operationMode: "newBody"
      },
      {
        op: "reference.nameGenerated",
        name: "Rectangle top face",
        bodyId: RECTANGLE_BODY_ID,
        stableId: RECTANGLE_END_FACE
      },
      {
        op: "reference.nameGenerated",
        name: "Rectangle lower front edge",
        bodyId: RECTANGLE_BODY_ID,
        stableId: RECTANGLE_LONG_EDGE
      }
    ]
  },
  {
    id: "v7-circle-extrude-export",
    title: "V7 circle extrude export-readiness sample",
    description:
      "Authored circle sketch extruded as a new body with generated references and export/reference readiness coverage.",
    units: "mm",
    workflowTags: [
      "sketch",
      "circle-profile",
      "new-body-extrude",
      "generated-references",
      "named-references",
      "selection-reference-candidates",
      "export-readiness"
    ],
    expectedSourceCounts: {
      sketchCount: 1,
      sketchEntityCount: 1,
      featureCount: 1,
      bodyCount: 1,
      activeBodyCount: 1,
      consumedBodyCount: 0,
      namedReferenceCount: 2
    },
    expectedHealthStatus: "under-defined",
    expectedHealthIssueCount: 1,
    expectedGeneratedReferences: [
      {
        bodyId: CIRCLE_BODY_ID,
        bodyStableId: `generated:body:${CIRCLE_BODY_ID}`,
        faceStableIds: [CIRCLE_END_FACE, CIRCLE_SIDE_FACE],
        edgeStableIds: [CIRCLE_END_EDGE],
        vertexStableIds: []
      }
    ],
    expectedNamedReferences: [
      {
        name: "Circle top face",
        bodyId: CIRCLE_BODY_ID,
        stableId: CIRCLE_END_FACE,
        kind: "face"
      },
      {
        name: "Circle rim edge",
        bodyId: CIRCLE_BODY_ID,
        stableId: CIRCLE_END_EDGE,
        kind: "edge"
      }
    ],
    expectedSelectionQueries: [
      {
        selection: { type: "body", bodyId: CIRCLE_BODY_ID },
        expectedStatus: "resolved",
        expectedCandidateCount: 1,
        expectedCommandableCount: 1
      },
      {
        selection: {
          type: "generatedReference",
          bodyId: CIRCLE_BODY_ID,
          stableId: CIRCLE_END_FACE,
          expectedKind: "face"
        },
        requiredOperation: "feature.attachSketchPlane",
        expectedStatus: "resolved",
        expectedCandidateCount: 1,
        expectedCommandableCount: 1
      },
      {
        selection: {
          type: "generatedReference",
          bodyId: CIRCLE_BODY_ID,
          stableId: CIRCLE_SIDE_FACE,
          expectedKind: "face"
        },
        requiredOperation: "feature.attachSketchPlane",
        expectedStatus: "non-commandable",
        expectedCandidateCount: 1,
        expectedCommandableCount: 0
      },
      {
        selection: {
          type: "generatedReference",
          bodyId: CIRCLE_BODY_ID,
          stableId: CIRCLE_END_EDGE,
          expectedKind: "edge"
        },
        requiredOperation: "feature.fillet",
        expectedStatus: "resolved",
        expectedCandidateCount: 1,
        expectedCommandableCount: 1
      },
      {
        selection: { type: "namedReference", name: "Circle rim edge" },
        requiredOperation: "feature.fillet",
        expectedStatus: "resolved",
        expectedCandidateCount: 1,
        expectedCommandableCount: 1
      }
    ],
    expectedReferenceSummary: {
      namedReferenceCount: 2,
      semanticBodySelectionCount: 1,
      generatedReferenceBodyCount: 1,
      generatedReferenceCount: 6,
      commandableReferenceCount: 6
    },
    expectedExportReadiness: {
      status: "deferred",
      canExportFiles: false,
      bodyCount: 1,
      sourceSupportedBodyCount: 1,
      deferredBodyCount: 1,
      unavailableBodyCount: 0,
      formats: [
        {
          format: "step",
          status: "deferred",
          available: false,
          sourceSupportedBodyCount: 1,
          deferredBodyCount: 1,
          unavailableBodyCount: 0
        },
        {
          format: "glb",
          status: "deferred",
          available: false,
          sourceSupportedBodyCount: 1,
          deferredBodyCount: 1,
          unavailableBodyCount: 0
        }
      ]
    },
    knownLimitations: [
      "The circular side face is semantic and measurable, but it is not planar and cannot attach a sketch plane.",
      "Mesh/GLB file export remains enabled only by app-derived ready visualization data, not by cad-core source fixtures."
    ],
    ops: [
      {
        op: "sketch.create",
        id: "v7_circle_sketch",
        name: "Circle release profile",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "v7_circle_sketch",
        id: "v7_circle_profile",
        center: [0, 0],
        radius: 1.5
      },
      {
        op: "feature.extrude",
        id: "v7_circle_extrude",
        bodyId: CIRCLE_BODY_ID,
        name: "Circle export body",
        sketchId: "v7_circle_sketch",
        entityId: "v7_circle_profile",
        depth: 4,
        side: "positive",
        operationMode: "newBody"
      },
      {
        op: "reference.nameGenerated",
        name: "Circle top face",
        bodyId: CIRCLE_BODY_ID,
        stableId: CIRCLE_END_FACE
      },
      {
        op: "reference.nameGenerated",
        name: "Circle rim edge",
        bodyId: CIRCLE_BODY_ID,
        stableId: CIRCLE_END_EDGE
      }
    ]
  },
  {
    id: "v7-consumed-body-diagnostics",
    title: "V7 consumed body diagnostics sample",
    description:
      "Authored rectangle target body consumed by a scoped cut result, documenting current non-commandable and ambiguous reference states.",
    units: "mm",
    workflowTags: [
      "sketch",
      "rectangle-profile",
      "new-body-extrude",
      "consumed-body",
      "selection-reference-candidates",
      "export-readiness",
      "unsupported-result-topology"
    ],
    expectedSourceCounts: {
      sketchCount: 1,
      sketchEntityCount: 1,
      featureCount: 2,
      bodyCount: 2,
      activeBodyCount: 1,
      consumedBodyCount: 1,
      namedReferenceCount: 1
    },
    expectedHealthStatus: "under-defined",
    expectedHealthIssueCount: 1,
    expectedGeneratedReferences: [
      {
        bodyId: CONSUMED_TARGET_BODY_ID,
        bodyStableId: `generated:body:${CONSUMED_TARGET_BODY_ID}`,
        faceStableIds: [CONSUMED_END_FACE],
        edgeStableIds: [CONSUMED_LONG_EDGE],
        vertexStableIds: []
      }
    ],
    expectedNamedReferences: [
      {
        name: "Consumed rectangle top face",
        bodyId: CONSUMED_TARGET_BODY_ID,
        stableId: CONSUMED_END_FACE,
        kind: "face"
      }
    ],
    expectedSelectionQueries: [
      {
        selection: { type: "body", bodyId: CONSUMED_TARGET_BODY_ID },
        expectedStatus: "consumed",
        expectedCandidateCount: 1,
        expectedCommandableCount: 0
      },
      {
        selection: {
          type: "generatedReference",
          bodyId: CONSUMED_TARGET_BODY_ID,
          stableId: CONSUMED_END_FACE,
          expectedKind: "face"
        },
        requiredOperation: "feature.attachSketchPlane",
        expectedStatus: "consumed",
        expectedCandidateCount: 1,
        expectedCommandableCount: 0
      },
      {
        selection: {
          type: "namedReference",
          name: "Consumed rectangle top face"
        },
        requiredOperation: "feature.attachSketchPlane",
        expectedStatus: "consumed",
        expectedCandidateCount: 1,
        expectedCommandableCount: 0
      },
      {
        selection: { type: "body", bodyId: CONSUMED_RESULT_BODY_ID },
        expectedStatus: "ambiguous",
        expectedCandidateCount: 0,
        expectedCommandableCount: 0
      }
    ],
    expectedReferenceSummary: {
      namedReferenceCount: 1,
      semanticBodySelectionCount: 2,
      generatedReferenceBodyCount: 0,
      generatedReferenceCount: 0,
      commandableReferenceCount: 0
    },
    expectedExportReadiness: {
      status: "deferred",
      canExportFiles: false,
      bodyCount: 2,
      sourceSupportedBodyCount: 0,
      deferredBodyCount: 1,
      unavailableBodyCount: 1,
      formats: [
        {
          format: "step",
          status: "deferred",
          available: false,
          sourceSupportedBodyCount: 0,
          deferredBodyCount: 1,
          unavailableBodyCount: 1
        },
        {
          format: "glb",
          status: "deferred",
          available: false,
          sourceSupportedBodyCount: 0,
          deferredBodyCount: 1,
          unavailableBodyCount: 1
        }
      ]
    },
    knownLimitations: [
      "The consumed source body can still resolve semantically, but it is non-commandable.",
      "The cut result body intentionally reports ambiguous generated topology until a later stable topological naming tranche proves it."
    ],
    ops: [
      {
        op: "sketch.create",
        id: "v7_consumed_sketch",
        name: "Consumed body release profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v7_consumed_sketch",
        id: "v7_consumed_rect_profile",
        center: [0, 0],
        width: 5,
        height: 2.5
      },
      {
        op: "feature.extrude",
        id: "v7_consumed_rect_extrude",
        bodyId: CONSUMED_TARGET_BODY_ID,
        name: "Consumed source body",
        sketchId: "v7_consumed_sketch",
        entityId: "v7_consumed_rect_profile",
        depth: 3,
        side: "positive",
        operationMode: "newBody"
      },
      {
        op: "reference.nameGenerated",
        name: "Consumed rectangle top face",
        bodyId: CONSUMED_TARGET_BODY_ID,
        stableId: CONSUMED_END_FACE
      },
      {
        op: "feature.extrude",
        id: "v7_consumed_cut",
        bodyId: CONSUMED_RESULT_BODY_ID,
        name: "Scoped cut result",
        targetBodyId: CONSUMED_TARGET_BODY_ID,
        sketchId: "v7_consumed_sketch",
        entityId: "v7_consumed_rect_profile",
        depth: 1,
        side: "positive",
        operationMode: "cut"
      }
    ]
  },
  {
    id: "v7-revolve-source-diagnostics",
    title: "V7 revolve source diagnostics sample",
    description:
      "Authored rectangle profile revolved as a new body, proving V6 source support while reporting result topology as diagnostic rather than stable.",
    units: "mm",
    workflowTags: [
      "sketch",
      "rectangle-profile",
      "axis-line",
      "new-body-revolve",
      "selection-reference-candidates",
      "export-readiness",
      "unsupported-result-topology"
    ],
    expectedSourceCounts: {
      sketchCount: 1,
      sketchEntityCount: 2,
      featureCount: 1,
      bodyCount: 1,
      activeBodyCount: 1,
      consumedBodyCount: 0,
      namedReferenceCount: 0
    },
    expectedHealthStatus: "under-defined",
    expectedHealthIssueCount: 1,
    expectedGeneratedReferences: [],
    expectedNamedReferences: [],
    expectedSelectionQueries: [
      {
        selection: { type: "body", bodyId: REVOLVE_BODY_ID },
        expectedStatus: "ambiguous",
        expectedCandidateCount: 0,
        expectedCommandableCount: 0
      },
      {
        selection: {
          type: "generatedReference",
          bodyId: REVOLVE_BODY_ID,
          stableId: `generated:face:${REVOLVE_BODY_ID}:endCap`,
          expectedKind: "face"
        },
        requiredOperation: "feature.attachSketchPlane",
        expectedStatus: "ambiguous",
        expectedCandidateCount: 0,
        expectedCommandableCount: 0
      }
    ],
    expectedReferenceSummary: {
      namedReferenceCount: 0,
      semanticBodySelectionCount: 1,
      generatedReferenceBodyCount: 0,
      generatedReferenceCount: 0,
      commandableReferenceCount: 0
    },
    expectedExportReadiness: {
      status: "deferred",
      canExportFiles: false,
      bodyCount: 1,
      sourceSupportedBodyCount: 0,
      deferredBodyCount: 1,
      unavailableBodyCount: 0,
      formats: [
        {
          format: "step",
          status: "deferred",
          available: false,
          sourceSupportedBodyCount: 0,
          deferredBodyCount: 1,
          unavailableBodyCount: 0
        },
        {
          format: "glb",
          status: "deferred",
          available: false,
          sourceSupportedBodyCount: 0,
          deferredBodyCount: 1,
          unavailableBodyCount: 0
        }
      ]
    },
    knownLimitations: [
      "The authored revolve source is accepted, round-trippable, and health-checked, but result-body topology is not stable for command-ready references.",
      "File export writers for revolve result bodies remain deferred."
    ],
    ops: [
      {
        op: "sketch.create",
        id: "v7_revolve_sketch",
        name: "Revolve release profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v7_revolve_sketch",
        id: "v7_revolve_profile",
        center: [2, 0],
        width: 1,
        height: 2
      },
      {
        op: "sketch.addLine",
        sketchId: "v7_revolve_sketch",
        id: "v7_revolve_axis",
        start: [0, -2],
        end: [0, 2]
      },
      {
        op: "feature.revolve",
        id: "v7_revolve_feature",
        bodyId: REVOLVE_BODY_ID,
        name: "Revolve diagnostic body",
        sketchId: "v7_revolve_sketch",
        entityId: "v7_revolve_profile",
        axis: {
          type: "sketchLine",
          sketchId: "v7_revolve_sketch",
          entityId: "v7_revolve_axis"
        },
        angleDegrees: 270,
        operationMode: "newBody"
      }
    ]
  },
  {
    id: "v7-hole-source-diagnostics",
    title: "V7 hole source diagnostics sample",
    description:
      "Authored rectangle target with a through hole result, preserving consumed-target diagnostics and unsupported result topology.",
    units: "mm",
    workflowTags: [
      "sketch",
      "rectangle-profile",
      "circle-profile",
      "new-body-extrude",
      "hole",
      "generated-references",
      "named-references",
      "selection-reference-candidates",
      "export-readiness",
      "consumed-body",
      "unsupported-result-topology"
    ],
    expectedSourceCounts: {
      sketchCount: 2,
      sketchEntityCount: 2,
      featureCount: 2,
      bodyCount: 2,
      activeBodyCount: 1,
      consumedBodyCount: 1,
      namedReferenceCount: 1
    },
    expectedHealthStatus: "under-defined",
    expectedHealthIssueCount: 2,
    expectedGeneratedReferences: [
      {
        bodyId: HOLE_TARGET_BODY_ID,
        bodyStableId: `generated:body:${HOLE_TARGET_BODY_ID}`,
        faceStableIds: [HOLE_TARGET_END_FACE],
        edgeStableIds: [HOLE_TARGET_LONG_EDGE],
        vertexStableIds: []
      }
    ],
    expectedNamedReferences: [
      {
        name: "Hole target top face",
        bodyId: HOLE_TARGET_BODY_ID,
        stableId: HOLE_TARGET_END_FACE,
        kind: "face"
      }
    ],
    expectedSelectionQueries: [
      {
        selection: { type: "body", bodyId: HOLE_TARGET_BODY_ID },
        expectedStatus: "consumed",
        expectedCandidateCount: 1,
        expectedCommandableCount: 0
      },
      {
        selection: {
          type: "namedReference",
          name: "Hole target top face"
        },
        requiredOperation: "feature.attachSketchPlane",
        expectedStatus: "consumed",
        expectedCandidateCount: 1,
        expectedCommandableCount: 0
      },
      {
        selection: { type: "body", bodyId: HOLE_RESULT_BODY_ID },
        expectedStatus: "ambiguous",
        expectedCandidateCount: 0,
        expectedCommandableCount: 0
      }
    ],
    expectedReferenceSummary: {
      namedReferenceCount: 1,
      semanticBodySelectionCount: 2,
      generatedReferenceBodyCount: 0,
      generatedReferenceCount: 0,
      commandableReferenceCount: 0
    },
    expectedExportReadiness: {
      status: "deferred",
      canExportFiles: false,
      bodyCount: 2,
      sourceSupportedBodyCount: 0,
      deferredBodyCount: 1,
      unavailableBodyCount: 1,
      formats: [
        {
          format: "step",
          status: "deferred",
          available: false,
          sourceSupportedBodyCount: 0,
          deferredBodyCount: 1,
          unavailableBodyCount: 1
        },
        {
          format: "glb",
          status: "deferred",
          available: false,
          sourceSupportedBodyCount: 0,
          deferredBodyCount: 1,
          unavailableBodyCount: 1
        }
      ]
    },
    knownLimitations: [
      "The hole result body is source-modeled but does not expose stable generated face or edge references.",
      "The original target body remains semantically resolvable for diagnostics but is non-commandable after consumption."
    ],
    ops: [
      {
        op: "sketch.create",
        id: "v7_hole_target_sketch",
        name: "Hole target profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v7_hole_target_sketch",
        id: "v7_hole_target_profile",
        center: [0, 0],
        width: 5,
        height: 3
      },
      {
        op: "feature.extrude",
        id: "v7_hole_target_extrude",
        bodyId: HOLE_TARGET_BODY_ID,
        name: "Hole target body",
        sketchId: "v7_hole_target_sketch",
        entityId: "v7_hole_target_profile",
        depth: 2,
        side: "positive",
        operationMode: "newBody"
      },
      {
        op: "reference.nameGenerated",
        name: "Hole target top face",
        bodyId: HOLE_TARGET_BODY_ID,
        stableId: HOLE_TARGET_END_FACE
      },
      {
        op: "sketch.create",
        id: "v7_hole_sketch",
        name: "Hole release profile",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "v7_hole_sketch",
        id: "v7_hole_profile",
        center: [0.5, 0],
        radius: 0.35
      },
      {
        op: "feature.hole",
        id: "v7_hole_feature",
        bodyId: HOLE_RESULT_BODY_ID,
        name: "Hole diagnostic result",
        targetBodyId: HOLE_TARGET_BODY_ID,
        sketchId: "v7_hole_sketch",
        circleEntityId: "v7_hole_profile",
        depthMode: "throughAll",
        direction: "positive"
      }
    ]
  },
  {
    id: "v7-edge-finish-source-diagnostics",
    title: "V7 edge-finish source diagnostics sample",
    description:
      "Two authored rectangle targets finished with chamfer and fillet operations, proving existing edge-finish source workflows without claiming stable result topology.",
    units: "mm",
    workflowTags: [
      "sketch",
      "rectangle-profile",
      "new-body-extrude",
      "chamfer",
      "fillet",
      "edge-finish",
      "generated-references",
      "named-references",
      "selection-reference-candidates",
      "export-readiness",
      "consumed-body",
      "unsupported-result-topology"
    ],
    expectedSourceCounts: {
      sketchCount: 2,
      sketchEntityCount: 2,
      featureCount: 4,
      bodyCount: 4,
      activeBodyCount: 2,
      consumedBodyCount: 2,
      namedReferenceCount: 1
    },
    expectedHealthStatus: "under-defined",
    expectedHealthIssueCount: 2,
    expectedGeneratedReferences: [
      {
        bodyId: CHAMFER_TARGET_BODY_ID,
        bodyStableId: `generated:body:${CHAMFER_TARGET_BODY_ID}`,
        faceStableIds: [`generated:face:${CHAMFER_TARGET_BODY_ID}:endCap`],
        edgeStableIds: [CHAMFER_TARGET_EDGE],
        vertexStableIds: []
      },
      {
        bodyId: FILLET_TARGET_BODY_ID,
        bodyStableId: `generated:body:${FILLET_TARGET_BODY_ID}`,
        faceStableIds: [`generated:face:${FILLET_TARGET_BODY_ID}:endCap`],
        edgeStableIds: [FILLET_TARGET_EDGE],
        vertexStableIds: []
      }
    ],
    expectedNamedReferences: [
      {
        name: "Fillet source edge",
        bodyId: FILLET_TARGET_BODY_ID,
        stableId: FILLET_TARGET_EDGE,
        kind: "edge"
      }
    ],
    expectedSelectionQueries: [
      {
        selection: { type: "body", bodyId: CHAMFER_TARGET_BODY_ID },
        expectedStatus: "consumed",
        expectedCandidateCount: 1,
        expectedCommandableCount: 0
      },
      {
        selection: {
          type: "generatedReference",
          bodyId: CHAMFER_TARGET_BODY_ID,
          stableId: CHAMFER_TARGET_EDGE,
          expectedKind: "edge"
        },
        requiredOperation: "feature.chamfer",
        expectedStatus: "consumed",
        expectedCandidateCount: 1,
        expectedCommandableCount: 0
      },
      {
        selection: {
          type: "namedReference",
          name: "Fillet source edge"
        },
        requiredOperation: "feature.fillet",
        expectedStatus: "consumed",
        expectedCandidateCount: 1,
        expectedCommandableCount: 0
      },
      {
        selection: { type: "body", bodyId: CHAMFER_RESULT_BODY_ID },
        expectedStatus: "ambiguous",
        expectedCandidateCount: 0,
        expectedCommandableCount: 0
      },
      {
        selection: { type: "body", bodyId: FILLET_RESULT_BODY_ID },
        expectedStatus: "ambiguous",
        expectedCandidateCount: 0,
        expectedCommandableCount: 0
      }
    ],
    expectedReferenceSummary: {
      namedReferenceCount: 1,
      semanticBodySelectionCount: 4,
      generatedReferenceBodyCount: 0,
      generatedReferenceCount: 0,
      commandableReferenceCount: 0
    },
    expectedExportReadiness: {
      status: "deferred",
      canExportFiles: false,
      bodyCount: 4,
      sourceSupportedBodyCount: 0,
      deferredBodyCount: 2,
      unavailableBodyCount: 2,
      formats: [
        {
          format: "step",
          status: "deferred",
          available: false,
          sourceSupportedBodyCount: 0,
          deferredBodyCount: 2,
          unavailableBodyCount: 2
        },
        {
          format: "glb",
          status: "deferred",
          available: false,
          sourceSupportedBodyCount: 0,
          deferredBodyCount: 2,
          unavailableBodyCount: 2
        }
      ]
    },
    knownLimitations: [
      "Chamfer and fillet source operations are accepted and round-trippable, but their result bodies intentionally report ambiguous generated topology.",
      "Consumed target edges remain useful diagnostics, not commandable downstream references."
    ],
    ops: [
      {
        op: "sketch.create",
        id: "v7_chamfer_target_sketch",
        name: "Chamfer target profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v7_chamfer_target_sketch",
        id: "v7_chamfer_target_profile",
        center: [-2, 0],
        width: 3,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "v7_chamfer_target_extrude",
        bodyId: CHAMFER_TARGET_BODY_ID,
        name: "Chamfer target body",
        sketchId: "v7_chamfer_target_sketch",
        entityId: "v7_chamfer_target_profile",
        depth: 2,
        side: "positive",
        operationMode: "newBody"
      },
      {
        op: "feature.chamfer",
        id: "v7_chamfer_feature",
        bodyId: CHAMFER_RESULT_BODY_ID,
        name: "Chamfer diagnostic result",
        targetBodyId: CHAMFER_TARGET_BODY_ID,
        edgeStableId: CHAMFER_TARGET_EDGE,
        distance: 0.2
      },
      {
        op: "sketch.create",
        id: "v7_fillet_target_sketch",
        name: "Fillet target profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v7_fillet_target_sketch",
        id: "v7_fillet_target_profile",
        center: [2, 0],
        width: 3,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "v7_fillet_target_extrude",
        bodyId: FILLET_TARGET_BODY_ID,
        name: "Fillet target body",
        sketchId: "v7_fillet_target_sketch",
        entityId: "v7_fillet_target_profile",
        depth: 2,
        side: "positive",
        operationMode: "newBody"
      },
      {
        op: "reference.nameGenerated",
        name: "Fillet source edge",
        bodyId: FILLET_TARGET_BODY_ID,
        stableId: FILLET_TARGET_EDGE
      },
      {
        op: "feature.fillet",
        id: "v7_fillet_feature",
        bodyId: FILLET_RESULT_BODY_ID,
        name: "Fillet diagnostic result",
        targetBodyId: FILLET_TARGET_BODY_ID,
        namedReference: "Fillet source edge",
        radius: 0.25
      }
    ]
  }
] as const satisfies readonly V7ReleaseSampleFixture[];

export function listV7ReleaseSampleFixtures(): readonly V7ReleaseSampleFixture[] {
  return V7_RELEASE_SAMPLE_FIXTURES;
}

export function getV7ReleaseSampleFixture(
  id: V7ReleaseSampleId
): V7ReleaseSampleFixture {
  const fixture = V7_RELEASE_SAMPLE_FIXTURES.find(
    (candidate) => candidate.id === id
  );

  if (!fixture) {
    throw new Error(`Unknown V7 release sample fixture: ${id}`);
  }

  return fixture;
}

export function createV7ReleaseSampleBatch(id: V7ReleaseSampleId): CadBatch {
  return {
    version: "cadops.v1",
    mode: "commit",
    ops: getV7ReleaseSampleFixture(id).ops.map((op) => ({ ...op }))
  };
}

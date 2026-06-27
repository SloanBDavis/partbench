import type {
  BodyId,
  CadBatch,
  CadDependencyHealthStatus,
  CadExportFormatId,
  CadExportReadinessStatus,
  CadFeatureEditabilityStatus,
  CadFeatureReferenceChangeCategory,
  CadBodyExactTopologySnapshot,
  CadGeneratedEntityKind,
  CadOp,
  CadRebuildPlanStatus,
  CadReferenceHealthTarget,
  CadReferenceHealthStatus,
  CadSelectionReferenceInput,
  CadSelectionReferenceOperation,
  CadSelectionReferenceStatus,
  CadTopologyIdentityState,
  CadTopologyMatchConfidence,
  CadTopologyMatchSnapshotInput,
  DocumentUnits,
  FeatureExtrudeOperationMode,
  NamedReferenceName,
  WcadTopologyCheckpointKernelMetadata,
  WcadTopologyCheckpointToleranceMetadata
} from "@web-cad/cad-protocol";

import { encodeCanonicalCbor } from "./canonicalCbor";

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
      status: "supported",
      canExportFiles: true,
      bodyCount: 1,
      sourceSupportedBodyCount: 1,
      deferredBodyCount: 0,
      unavailableBodyCount: 0,
      formats: [
        {
          format: "step",
          status: "supported",
          available: true,
          sourceSupportedBodyCount: 1,
          deferredBodyCount: 0,
          unavailableBodyCount: 0
        },
        {
          format: "glb",
          status: "deferred",
          available: false,
          sourceSupportedBodyCount: 1,
          deferredBodyCount: 0,
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
      status: "supported",
      canExportFiles: true,
      bodyCount: 1,
      sourceSupportedBodyCount: 1,
      deferredBodyCount: 0,
      unavailableBodyCount: 0,
      formats: [
        {
          format: "step",
          status: "supported",
          available: true,
          sourceSupportedBodyCount: 1,
          deferredBodyCount: 0,
          unavailableBodyCount: 0
        },
        {
          format: "glb",
          status: "deferred",
          available: false,
          sourceSupportedBodyCount: 1,
          deferredBodyCount: 0,
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
        expectedStatus: "non-commandable",
        expectedCandidateCount: 1,
        expectedCommandableCount: 0
      }
    ],
    expectedReferenceSummary: {
      namedReferenceCount: 1,
      semanticBodySelectionCount: 2,
      generatedReferenceBodyCount: 1,
      generatedReferenceCount: 9,
      commandableReferenceCount: 8
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
        expectedStatus: "resolved",
        expectedCandidateCount: 1,
        expectedCommandableCount: 1
      },
      {
        selection: {
          type: "generatedReference",
          bodyId: REVOLVE_BODY_ID,
          stableId: `generated:face:${REVOLVE_BODY_ID}:endCap`,
          expectedKind: "face"
        },
        requiredOperation: "feature.attachSketchPlane",
        expectedStatus: "stale",
        expectedCandidateCount: 0,
        expectedCommandableCount: 0
      }
    ],
    expectedReferenceSummary: {
      namedReferenceCount: 0,
      semanticBodySelectionCount: 1,
      generatedReferenceBodyCount: 1,
      generatedReferenceCount: 2,
      commandableReferenceCount: 2
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
        expectedStatus: "resolved",
        expectedCandidateCount: 1,
        expectedCommandableCount: 1
      }
    ],
    expectedReferenceSummary: {
      namedReferenceCount: 1,
      semanticBodySelectionCount: 2,
      generatedReferenceBodyCount: 1,
      generatedReferenceCount: 4,
      commandableReferenceCount: 4
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

export type V10ReleaseSampleId =
  | "v10-extrude-edit-attached-sketch"
  | "v10-c2-feature-lifecycle-edits"
  | "v10-named-reference-repair-roundtrip";

export type V10ReleaseSampleWorkflowTag =
  | "feature-editability"
  | "feature-update"
  | "source-rebuild"
  | "body-lifecycle"
  | "dependency-graph"
  | "reference-health"
  | "generated-references"
  | "named-reference-repair"
  | "attached-sketch"
  | "wcad-roundtrip"
  | "source-boundary";

export interface V10ReleaseSampleFeatureEditExpectation {
  readonly featureId: string;
  readonly expectedStatus: CadFeatureEditabilityStatus;
  readonly expectedCommitOperation: CadOp["op"];
  readonly expectedReferenceCategories: readonly CadFeatureReferenceChangeCategory[];
}

export interface V10ReleaseSampleRebuildExpectation {
  readonly initialStatus: CadRebuildPlanStatus;
  readonly committedStatus: CadRebuildPlanStatus;
  readonly expectedLifecycleBodies: readonly BodyId[];
}

export interface V10ReleaseSampleReferenceHealthExpectation {
  readonly targetLabel: string;
  readonly target: CadReferenceHealthTarget;
  readonly expectedStatus: CadReferenceHealthStatus;
  readonly expectedCommandable: boolean;
  readonly expectedConsumedByFeatureId?: string;
}

export interface V10ReleaseSampleFixture {
  readonly id: V10ReleaseSampleId;
  readonly title: string;
  readonly description: string;
  readonly units: DocumentUnits;
  readonly workflowTags: readonly V10ReleaseSampleWorkflowTag[];
  readonly expectedEditability: readonly V10ReleaseSampleFeatureEditExpectation[];
  readonly expectedRebuild: V10ReleaseSampleRebuildExpectation;
  readonly expectedReferenceHealth: readonly V10ReleaseSampleReferenceHealthExpectation[];
  readonly knownLimitations: readonly string[];
  readonly ops: readonly CadOp[];
}

const V10_ATTACHED_SOURCE_BODY = "v10_attached_source_body";
const V10_ATTACHED_CHILD_BODY = "v10_attached_child_body";
const V10_ATTACHED_END_FACE = `generated:face:${V10_ATTACHED_SOURCE_BODY}:endCap`;

const V10_C2_HOLE_TARGET_BODY = "v10_c2_hole_target_body";
const V10_C2_HOLE_BODY = "v10_c2_hole_body";
const V10_C2_REVOLVE_BODY = "v10_c2_revolve_body";
const V10_C2_CHAMFER_TARGET_BODY = "v10_c2_chamfer_target_body";
const V10_C2_CHAMFER_BODY = "v10_c2_chamfer_body";
const V10_C2_CHAMFER_EDGE = `generated:edge:${V10_C2_CHAMFER_TARGET_BODY}:start:uMin`;
const V10_C2_FILLET_TARGET_BODY = "v10_c2_fillet_target_body";
const V10_C2_FILLET_BODY = "v10_c2_fillet_body";
const V10_C2_FILLET_EDGE = `generated:edge:${V10_C2_FILLET_TARGET_BODY}:end:circular`;

const V10_REPAIR_OLD_BODY = "v10_repair_old_body";
const V10_REPAIR_NEW_BODY = "v10_repair_new_body";

export const V10_RELEASE_SAMPLE_FIXTURES = [
  {
    id: "v10-extrude-edit-attached-sketch",
    title: "V10 extrude edit with attached sketch sample",
    description:
      "Authored rectangle extrude with a named planar face, attached sketch, and child extrude used to prove editability, lifecycle, dependency, and reference-health chains.",
    units: "mm",
    workflowTags: [
      "feature-editability",
      "feature-update",
      "source-rebuild",
      "body-lifecycle",
      "dependency-graph",
      "reference-health",
      "generated-references",
      "attached-sketch",
      "wcad-roundtrip",
      "source-boundary"
    ],
    expectedEditability: [
      {
        featureId: "v10_attached_source_extrude",
        expectedStatus: "editable",
        expectedCommitOperation: "feature.updateExtrude",
        expectedReferenceCategories: ["active"]
      },
      {
        featureId: "v10_attached_child_extrude",
        expectedStatus: "editable",
        expectedCommitOperation: "feature.updateExtrude",
        expectedReferenceCategories: ["active"]
      }
    ],
    expectedRebuild: {
      initialStatus: "ready",
      committedStatus: "pending",
      expectedLifecycleBodies: [
        V10_ATTACHED_SOURCE_BODY,
        V10_ATTACHED_CHILD_BODY
      ]
    },
    expectedReferenceHealth: [
      {
        targetLabel: "V10 attached top face",
        target: { type: "namedReference", name: "V10 attached top face" },
        expectedStatus: "active",
        expectedCommandable: true
      }
    ],
    knownLimitations: [
      "The sample proves direct source lifecycle/readiness and attached-sketch reference survival; it does not claim arbitrary downstream topological naming.",
      "Visualization rebuild remains derived app/runtime work, not fixture source truth."
    ],
    ops: [
      {
        op: "sketch.create",
        id: "v10_attached_source_sketch",
        name: "V10 attached source profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v10_attached_source_sketch",
        id: "v10_attached_source_rect",
        center: [0, 0],
        width: 4,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "v10_attached_source_extrude",
        bodyId: V10_ATTACHED_SOURCE_BODY,
        name: "V10 editable source body",
        sketchId: "v10_attached_source_sketch",
        entityId: "v10_attached_source_rect",
        depth: 3,
        side: "positive",
        operationMode: "newBody"
      },
      {
        op: "reference.nameGenerated",
        name: "V10 attached top face",
        bodyId: V10_ATTACHED_SOURCE_BODY,
        stableId: V10_ATTACHED_END_FACE
      },
      {
        op: "sketch.createOnFace",
        id: "v10_attached_child_sketch",
        name: "V10 attached child sketch",
        referenceName: "V10 attached top face"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v10_attached_child_sketch",
        id: "v10_attached_child_rect",
        center: [0, 0],
        width: 1,
        height: 1
      },
      {
        op: "feature.extrude",
        id: "v10_attached_child_extrude",
        bodyId: V10_ATTACHED_CHILD_BODY,
        name: "V10 attached child body",
        sketchId: "v10_attached_child_sketch",
        entityId: "v10_attached_child_rect",
        depth: 1,
        side: "symmetric",
        operationMode: "newBody"
      }
    ]
  },
  {
    id: "v10-c2-feature-lifecycle-edits",
    title: "V10 C2 feature lifecycle edit sample",
    description:
      "Mixed authored revolve, hole, chamfer, and fillet source features used to prove conservative C2 edit commits, lifecycle effects, and supported generated reference expansion.",
    units: "mm",
    workflowTags: [
      "feature-editability",
      "feature-update",
      "source-rebuild",
      "body-lifecycle",
      "dependency-graph",
      "reference-health",
      "generated-references",
      "wcad-roundtrip",
      "source-boundary"
    ],
    expectedEditability: [
      {
        featureId: "v10_c2_revolve_feature",
        expectedStatus: "editable",
        expectedCommitOperation: "feature.updateRevolve",
        expectedReferenceCategories: ["repair-needed"]
      },
      {
        featureId: "v10_c2_hole_feature",
        expectedStatus: "editable",
        expectedCommitOperation: "feature.updateHole",
        expectedReferenceCategories: ["repair-needed"]
      },
      {
        featureId: "v10_c2_chamfer_feature",
        expectedStatus: "editable",
        expectedCommitOperation: "feature.updateChamfer",
        expectedReferenceCategories: ["repair-needed"]
      },
      {
        featureId: "v10_c2_fillet_feature",
        expectedStatus: "editable",
        expectedCommitOperation: "feature.updateFillet",
        expectedReferenceCategories: ["repair-needed"]
      }
    ],
    expectedRebuild: {
      initialStatus: "repair-needed",
      committedStatus: "repair-needed",
      expectedLifecycleBodies: [
        V10_C2_HOLE_TARGET_BODY,
        V10_C2_HOLE_BODY,
        V10_C2_REVOLVE_BODY,
        V10_C2_CHAMFER_TARGET_BODY,
        V10_C2_CHAMFER_BODY,
        V10_C2_FILLET_TARGET_BODY,
        V10_C2_FILLET_BODY
      ]
    },
    expectedReferenceHealth: [
      {
        targetLabel: "V10 C2 hole wall",
        target: { type: "namedReference", name: "V10 C2 hole wall" },
        expectedStatus: "active",
        expectedCommandable: true
      },
      {
        targetLabel: "V10 C2 fillet source edge",
        target: {
          type: "namedReference",
          name: "V10 C2 fillet source edge"
        },
        expectedStatus: "consumed",
        expectedCommandable: false,
        expectedConsumedByFeatureId: "v10_c2_fillet_feature"
      }
    ],
    knownLimitations: [
      "Revolve, chamfer, and fillet result topology remains repair-needed unless source semantics prove a specific generated reference.",
      "The sample proves parameter edit and diagnostic behavior, not arbitrary topology repair."
    ],
    ops: [
      {
        op: "sketch.create",
        id: "v10_c2_hole_target_sketch",
        name: "V10 C2 hole target profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v10_c2_hole_target_sketch",
        id: "v10_c2_hole_target_rect",
        center: [0, 0],
        width: 5,
        height: 3
      },
      {
        op: "feature.extrude",
        id: "v10_c2_hole_target_extrude",
        bodyId: V10_C2_HOLE_TARGET_BODY,
        name: "V10 C2 hole target body",
        sketchId: "v10_c2_hole_target_sketch",
        entityId: "v10_c2_hole_target_rect",
        depth: 3,
        side: "positive",
        operationMode: "newBody"
      },
      {
        op: "sketch.create",
        id: "v10_c2_hole_sketch",
        name: "V10 C2 hole profile",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "v10_c2_hole_sketch",
        id: "v10_c2_hole_circle",
        center: [0, 0],
        radius: 0.5
      },
      {
        op: "feature.hole",
        id: "v10_c2_hole_feature",
        bodyId: V10_C2_HOLE_BODY,
        name: "V10 C2 hole result",
        targetBodyId: V10_C2_HOLE_TARGET_BODY,
        sketchId: "v10_c2_hole_sketch",
        circleEntityId: "v10_c2_hole_circle",
        depthMode: "blind",
        depth: 1,
        direction: "negative"
      },
      {
        op: "reference.nameGenerated",
        name: "V10 C2 hole wall",
        bodyId: V10_C2_HOLE_BODY,
        stableId: `generated:face:${V10_C2_HOLE_BODY}:holeWall`
      },
      {
        op: "sketch.create",
        id: "v10_c2_revolve_sketch",
        name: "V10 C2 revolve profile",
        plane: "XY"
      },
      {
        op: "sketch.addLine",
        sketchId: "v10_c2_revolve_sketch",
        id: "v10_c2_revolve_axis",
        start: [0, -2],
        end: [0, 2]
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v10_c2_revolve_sketch",
        id: "v10_c2_revolve_rect",
        center: [2, 0],
        width: 1,
        height: 2
      },
      {
        op: "feature.revolve",
        id: "v10_c2_revolve_feature",
        bodyId: V10_C2_REVOLVE_BODY,
        name: "V10 C2 revolve body",
        sketchId: "v10_c2_revolve_sketch",
        entityId: "v10_c2_revolve_rect",
        axis: {
          type: "sketchLine",
          sketchId: "v10_c2_revolve_sketch",
          entityId: "v10_c2_revolve_axis"
        },
        angleDegrees: 270,
        operationMode: "newBody"
      },
      {
        op: "sketch.create",
        id: "v10_c2_chamfer_target_sketch",
        name: "V10 C2 chamfer target profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v10_c2_chamfer_target_sketch",
        id: "v10_c2_chamfer_target_rect",
        center: [-3, 0],
        width: 2,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "v10_c2_chamfer_target_extrude",
        bodyId: V10_C2_CHAMFER_TARGET_BODY,
        name: "V10 C2 chamfer target body",
        sketchId: "v10_c2_chamfer_target_sketch",
        entityId: "v10_c2_chamfer_target_rect",
        depth: 2,
        side: "positive",
        operationMode: "newBody"
      },
      {
        op: "feature.chamfer",
        id: "v10_c2_chamfer_feature",
        bodyId: V10_C2_CHAMFER_BODY,
        name: "V10 C2 chamfer result",
        targetBodyId: V10_C2_CHAMFER_TARGET_BODY,
        edgeStableId: V10_C2_CHAMFER_EDGE,
        distance: 0.2
      },
      {
        op: "sketch.create",
        id: "v10_c2_fillet_target_sketch",
        name: "V10 C2 fillet target profile",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "v10_c2_fillet_target_sketch",
        id: "v10_c2_fillet_target_circle",
        center: [3, 0],
        radius: 1
      },
      {
        op: "feature.extrude",
        id: "v10_c2_fillet_target_extrude",
        bodyId: V10_C2_FILLET_TARGET_BODY,
        name: "V10 C2 fillet target body",
        sketchId: "v10_c2_fillet_target_sketch",
        entityId: "v10_c2_fillet_target_circle",
        depth: 2,
        side: "positive",
        operationMode: "newBody"
      },
      {
        op: "reference.nameGenerated",
        name: "V10 C2 fillet source edge",
        bodyId: V10_C2_FILLET_TARGET_BODY,
        stableId: V10_C2_FILLET_EDGE
      },
      {
        op: "feature.fillet",
        id: "v10_c2_fillet_feature",
        bodyId: V10_C2_FILLET_BODY,
        name: "V10 C2 fillet result",
        targetBodyId: V10_C2_FILLET_TARGET_BODY,
        namedReference: "V10 C2 fillet source edge",
        radius: 0.25
      }
    ]
  },
  {
    id: "v10-named-reference-repair-roundtrip",
    title: "V10 named reference repair round-trip sample",
    description:
      "Two source-equivalent rectangle extrudes and a stale named face reference used to prove explicit repair, reference health, history, and WCAD round-trip behavior.",
    units: "mm",
    workflowTags: [
      "feature-editability",
      "feature-update",
      "dependency-graph",
      "reference-health",
      "named-reference-repair",
      "wcad-roundtrip",
      "source-boundary"
    ],
    expectedEditability: [
      {
        featureId: "v10_repair_new_extrude",
        expectedStatus: "editable",
        expectedCommitOperation: "feature.updateExtrude",
        expectedReferenceCategories: ["active"]
      }
    ],
    expectedRebuild: {
      initialStatus: "ready",
      committedStatus: "pending",
      expectedLifecycleBodies: [V10_REPAIR_NEW_BODY]
    },
    expectedReferenceHealth: [
      {
        targetLabel: "V10 repair face",
        target: { type: "namedReference", name: "V10 repair face" },
        expectedStatus: "active",
        expectedCommandable: true
      }
    ],
    knownLimitations: [
      "Repair is explicit and user/agent directed; V10 does not guess replacement references automatically.",
      "The stale intermediate state remains non-commandable until repaired."
    ],
    ops: [
      {
        op: "sketch.create",
        id: "v10_repair_sketch",
        name: "V10 repair profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v10_repair_sketch",
        id: "v10_repair_rect",
        center: [0, 0],
        width: 3,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "v10_repair_old_extrude",
        bodyId: V10_REPAIR_OLD_BODY,
        name: "V10 old repair source",
        sketchId: "v10_repair_sketch",
        entityId: "v10_repair_rect",
        depth: 2,
        side: "positive",
        operationMode: "newBody"
      },
      {
        op: "feature.extrude",
        id: "v10_repair_new_extrude",
        bodyId: V10_REPAIR_NEW_BODY,
        name: "V10 new repair source",
        sketchId: "v10_repair_sketch",
        entityId: "v10_repair_rect",
        depth: 3,
        side: "positive",
        operationMode: "newBody"
      },
      {
        op: "reference.nameGenerated",
        name: "V10 repair face",
        bodyId: V10_REPAIR_OLD_BODY,
        stableId: `generated:face:${V10_REPAIR_OLD_BODY}:startCap`
      }
    ]
  }
] as const satisfies readonly V10ReleaseSampleFixture[];

export function listV10ReleaseSampleFixtures(): readonly V10ReleaseSampleFixture[] {
  return V10_RELEASE_SAMPLE_FIXTURES;
}

export function getV10ReleaseSampleFixture(
  id: V10ReleaseSampleId
): V10ReleaseSampleFixture {
  const fixture = V10_RELEASE_SAMPLE_FIXTURES.find(
    (candidate) => candidate.id === id
  );

  if (!fixture) {
    throw new Error(`Unknown V10 release sample fixture: ${id}`);
  }

  return fixture;
}

export function createV10ReleaseSampleBatch(id: V10ReleaseSampleId): CadBatch {
  return {
    version: "cadops.v1",
    mode: "commit",
    ops: getV10ReleaseSampleFixture(id).ops.map((op) => ({ ...op }))
  };
}

export type V13ReleaseSampleId = "v13-topology-anchor-repair-command-chain";

export type V13ReleaseSampleWorkflowTag =
  | "topology-checkpoint"
  | "topology-anchor"
  | "topology-anchor-repair"
  | "topology-match"
  | "reference-health"
  | "named-reference-repair"
  | "selection-reference-candidates"
  | "target-topology-anchor"
  | "source-boundary";

export interface V13ReleaseSampleTopologyExpectation {
  readonly checkpointCount: number;
  readonly anchorCount: number;
  readonly repairCount: number;
  readonly repairedReferenceName: NamedReferenceName;
  readonly repairedTopologyAnchorId: string;
  readonly manualRepairAnchorId: string;
  readonly manualRepairId: string;
  readonly manualRepairReplacementCheckpointId: string;
  readonly downstreamFeatureId: string;
  readonly downstreamTargetTopologyAnchorId: string;
}

export interface V13ReleaseSampleTopologyMatchExpectation {
  readonly previousCheckpointEntityId: string;
  readonly expectedState: CadTopologyIdentityState;
  readonly expectedConfidence: CadTopologyMatchConfidence;
}

export interface V13ReleaseSampleFixture {
  readonly id: V13ReleaseSampleId;
  readonly title: string;
  readonly description: string;
  readonly units: DocumentUnits;
  readonly workflowTags: readonly V13ReleaseSampleWorkflowTag[];
  readonly expectedTopology: V13ReleaseSampleTopologyExpectation;
  readonly topologyMatchPrevious: CadTopologyMatchSnapshotInput;
  readonly topologyMatchCandidates: readonly CadTopologyMatchSnapshotInput[];
  readonly expectedTopologyMatches: readonly V13ReleaseSampleTopologyMatchExpectation[];
  readonly knownLimitations: readonly string[];
  readonly ops: readonly CadOp[];
}

export interface V13ReleaseSampleCheckpointPayloadInput {
  readonly checkpointId: string;
  readonly bodyId: BodyId;
  readonly sourceFeatureId?: string;
  readonly units?: DocumentUnits;
  readonly kernel: WcadTopologyCheckpointKernelMetadata;
  readonly tolerance: WcadTopologyCheckpointToleranceMetadata;
  readonly brepBytes: Uint8Array;
  readonly topologyBytes: Uint8Array;
  readonly signatureBytes: Uint8Array;
}

const V13_REPAIR_BODY = "v13_repair_body";
const V13_REPAIR_START_FACE = `generated:face:${V13_REPAIR_BODY}:startCap`;
const V13_REPAIR_END_FACE = `generated:face:${V13_REPAIR_BODY}:endCap`;
const V13_REPAIR_FACE_ANCHOR = "v13_anchor_repair_face";
const V13_MANUAL_REPAIR_FACE_ANCHOR = "v13_anchor_manual_repair_face";
const V13_MANUAL_REPAIR_ID = "v13_repair_manual_face_anchor";
const V13_REPAIR_CHECKPOINT = "v13_checkpoint_repair_body";
const V13_REPAIR_REBUILT_CHECKPOINT = "v13_checkpoint_repair_body_rebuilt";

const V13_TARGET_BODY = "v13_target_body";
const V13_TARGET_BODY_ANCHOR = "v13_anchor_target_body";
const V13_TARGET_CHECKPOINT = "v13_checkpoint_target_body";
const V13_CUT_BODY = "v13_cut_body";

export const V13_RELEASE_SAMPLE_FIXTURES = [
  {
    id: "v13-topology-anchor-repair-command-chain",
    title: "V13 topology anchor repair and command chain sample",
    description:
      "Two authored rectangle bodies with explicit topology checkpoints and anchors, a named-reference repair to a face anchor, an explicit topology-anchor repair record, a downstream cut through a body anchor, and deterministic topology matching fixtures.",
    units: "mm",
    workflowTags: [
      "topology-checkpoint",
      "topology-anchor",
      "topology-anchor-repair",
      "topology-match",
      "reference-health",
      "named-reference-repair",
      "selection-reference-candidates",
      "target-topology-anchor",
      "source-boundary"
    ],
    expectedTopology: {
      checkpointCount: 3,
      anchorCount: 3,
      repairCount: 1,
      repairedReferenceName: "V13 repair face",
      repairedTopologyAnchorId: V13_REPAIR_FACE_ANCHOR,
      manualRepairAnchorId: V13_MANUAL_REPAIR_FACE_ANCHOR,
      manualRepairId: V13_MANUAL_REPAIR_ID,
      manualRepairReplacementCheckpointId: V13_REPAIR_REBUILT_CHECKPOINT,
      downstreamFeatureId: "v13_cut_feature",
      downstreamTargetTopologyAnchorId: V13_TARGET_BODY_ANCHOR
    },
    topologyMatchPrevious: createV13TopologyMatchSnapshot({
      checkpointId: V13_REPAIR_CHECKPOINT,
      bodyId: V13_REPAIR_BODY,
      entities: [
        {
          localId: "v13_match_face_exact",
          kind: "face",
          signature: "v13:face:exact"
        },
        {
          localId: "v13_match_edge_split",
          kind: "edge",
          signature: "v13:edge:split"
        },
        {
          localId: "v13_match_axis_deleted",
          kind: "axis",
          signature: "v13:axis:deleted"
        },
        {
          localId: "v13_match_vertex_low",
          kind: "vertex",
          signature: "v13:vertex:low"
        },
        {
          localId: "v13_match_face_merged_a",
          kind: "face",
          signature: "v13:face:merged"
        },
        {
          localId: "v13_match_face_merged_b",
          kind: "face",
          signature: "v13:face:merged"
        },
        {
          localId: "v13_match_edge_ambiguous_a",
          kind: "edge",
          signature: "v13:edge:ambiguous"
        },
        {
          localId: "v13_match_edge_ambiguous_b",
          kind: "edge",
          signature: "v13:edge:ambiguous"
        }
      ]
    }),
    topologyMatchCandidates: [
      createV13TopologyMatchSnapshot({
        checkpointId: V13_TARGET_CHECKPOINT,
        bodyId: V13_TARGET_BODY,
        sourceIdentitySha:
          "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        entities: [
          {
            localId: "v13_match_face_exact_new",
            kind: "face",
            signature: "v13:face:exact"
          },
          {
            localId: "v13_match_edge_split_new_a",
            kind: "edge",
            signature: "v13:edge:split"
          },
          {
            localId: "v13_match_edge_split_new_b",
            kind: "edge",
            signature: "v13:edge:split"
          },
          {
            localId: "v13_match_vertex_low_new",
            kind: "vertex",
            signature: "v13:vertex:other"
          },
          {
            localId: "v13_match_face_merged_new",
            kind: "face",
            signature: "v13:face:merged"
          },
          {
            localId: "v13_match_edge_ambiguous_new_a",
            kind: "edge",
            signature: "v13:edge:ambiguous"
          },
          {
            localId: "v13_match_edge_ambiguous_new_b",
            kind: "edge",
            signature: "v13:edge:ambiguous"
          }
        ]
      })
    ],
    expectedTopologyMatches: [
      {
        previousCheckpointEntityId: "v13_match_face_exact",
        expectedState: "active",
        expectedConfidence: "exact"
      },
      {
        previousCheckpointEntityId: "v13_match_edge_split",
        expectedState: "split",
        expectedConfidence: "high"
      },
      {
        previousCheckpointEntityId: "v13_match_axis_deleted",
        expectedState: "deleted",
        expectedConfidence: "none"
      },
      {
        previousCheckpointEntityId: "v13_match_vertex_low",
        expectedState: "repair-needed",
        expectedConfidence: "low"
      },
      {
        previousCheckpointEntityId: "v13_match_face_merged_a",
        expectedState: "merged",
        expectedConfidence: "exact"
      },
      {
        previousCheckpointEntityId: "v13_match_face_merged_b",
        expectedState: "merged",
        expectedConfidence: "exact"
      },
      {
        previousCheckpointEntityId: "v13_match_edge_ambiguous_a",
        expectedState: "ambiguous",
        expectedConfidence: "high"
      },
      {
        previousCheckpointEntityId: "v13_match_edge_ambiguous_b",
        expectedState: "ambiguous",
        expectedConfidence: "high"
      }
    ],
    knownLimitations: [
      "Checkpoint payload bytes are still caller-supplied; this fixture proves source records, matching, repair, and command eligibility.",
      "Direct topology-anchor command targets without generated backing remain explicitly unsupported."
    ],
    ops: [
      {
        op: "sketch.create",
        id: "v13_repair_sketch",
        name: "V13 repair source profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v13_repair_sketch",
        id: "v13_repair_rect",
        center: [-2, 0],
        width: 3,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "v13_repair_extrude",
        bodyId: V13_REPAIR_BODY,
        name: "V13 repair body",
        sketchId: "v13_repair_sketch",
        entityId: "v13_repair_rect",
        depth: 2,
        side: "positive",
        operationMode: "newBody"
      },
      {
        op: "reference.nameGenerated",
        name: "V13 repair face",
        bodyId: V13_REPAIR_BODY,
        stableId: V13_REPAIR_START_FACE
      },
      {
        op: "topology.checkpoint.create",
        checkpointId: V13_REPAIR_CHECKPOINT,
        bodyId: V13_REPAIR_BODY,
        sourceFeatureId: "v13_repair_extrude",
        sourceIdentity: {
          algorithm: "partbench-source-v1",
          sha256:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        },
        status: "active"
      },
      {
        op: "topology.anchor.create",
        anchorId: V13_REPAIR_FACE_ANCHOR,
        entityKind: "face",
        bodyId: V13_REPAIR_BODY,
        checkpointId: V13_REPAIR_CHECKPOINT,
        checkpointEntityId: "v13_repair_checkpoint_face_end",
        stableId: V13_REPAIR_END_FACE,
        sourceFeatureId: "v13_repair_extrude",
        sourceSemanticRole: "end cap",
        signatureHash: "v13_repair_face_signature"
      },
      {
        op: "reference.repairName",
        name: "V13 repair face",
        topologyAnchorId: V13_REPAIR_FACE_ANCHOR
      },
      {
        op: "topology.anchor.create",
        anchorId: V13_MANUAL_REPAIR_FACE_ANCHOR,
        entityKind: "face",
        bodyId: V13_REPAIR_BODY,
        checkpointId: V13_REPAIR_CHECKPOINT,
        checkpointEntityId: "v13_repair_checkpoint_face_start",
        stableId: V13_REPAIR_START_FACE,
        sourceFeatureId: "v13_repair_extrude",
        sourceSemanticRole: "start cap",
        signatureHash: "v13_manual_repair_face_signature_old"
      },
      {
        op: "topology.checkpoint.create",
        checkpointId: V13_REPAIR_REBUILT_CHECKPOINT,
        bodyId: V13_REPAIR_BODY,
        sourceFeatureId: "v13_repair_extrude",
        sourceIdentity: {
          algorithm: "partbench-source-v1",
          sha256:
            "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
        },
        status: "active"
      },
      {
        op: "topology.anchor.repair",
        repairId: V13_MANUAL_REPAIR_ID,
        anchorId: V13_MANUAL_REPAIR_FACE_ANCHOR,
        replacementCheckpointId: V13_REPAIR_REBUILT_CHECKPOINT,
        replacementCheckpointEntityId:
          "v13_repair_checkpoint_face_start_rebuilt",
        confidence: "high",
        evidence: [
          {
            kind: "sourceLineage",
            confidence: "high",
            message:
              "Manual repair selects the rebuilt checkpoint face with matching source lineage."
          },
          {
            kind: "sourceSemanticRole",
            confidence: "high",
            message: "Both topology entities represent the rectangle start cap."
          }
        ]
      },
      {
        op: "sketch.create",
        id: "v13_target_sketch",
        name: "V13 target profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v13_target_sketch",
        id: "v13_target_rect",
        center: [2, 0],
        width: 4,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "v13_target_extrude",
        bodyId: V13_TARGET_BODY,
        name: "V13 anchored target body",
        sketchId: "v13_target_sketch",
        entityId: "v13_target_rect",
        depth: 2,
        side: "positive",
        operationMode: "newBody"
      },
      {
        op: "topology.checkpoint.create",
        checkpointId: V13_TARGET_CHECKPOINT,
        bodyId: V13_TARGET_BODY,
        sourceFeatureId: "v13_target_extrude",
        sourceIdentity: {
          algorithm: "partbench-source-v1",
          sha256:
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        },
        status: "active"
      },
      {
        op: "topology.anchor.create",
        anchorId: V13_TARGET_BODY_ANCHOR,
        entityKind: "body",
        bodyId: V13_TARGET_BODY,
        checkpointId: V13_TARGET_CHECKPOINT,
        checkpointEntityId: "v13_target_checkpoint_body",
        stableId: `generated:body:${V13_TARGET_BODY}`,
        sourceFeatureId: "v13_target_extrude",
        sourceSemanticRole: "target body",
        signatureHash: "v13_target_body_signature"
      },
      {
        op: "sketch.create",
        id: "v13_cut_sketch",
        name: "V13 anchored cut profile",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v13_cut_sketch",
        id: "v13_cut_rect",
        center: [2, 0],
        width: 1,
        height: 1
      },
      {
        op: "feature.extrude",
        id: "v13_cut_feature",
        bodyId: V13_CUT_BODY,
        name: "V13 anchored cut",
        sketchId: "v13_cut_sketch",
        entityId: "v13_cut_rect",
        depth: 1,
        side: "positive",
        operationMode: "cut",
        targetTopologyAnchorId: V13_TARGET_BODY_ANCHOR
      }
    ]
  }
] as const satisfies readonly V13ReleaseSampleFixture[];

export function listV13ReleaseSampleFixtures(): readonly V13ReleaseSampleFixture[] {
  return V13_RELEASE_SAMPLE_FIXTURES;
}

export function getV13ReleaseSampleFixture(
  id: V13ReleaseSampleId
): V13ReleaseSampleFixture {
  const fixture = V13_RELEASE_SAMPLE_FIXTURES.find(
    (candidate) => candidate.id === id
  );

  if (!fixture) {
    throw new Error(`Unknown V13 release sample fixture: ${id}`);
  }

  return fixture;
}

export function createV13ReleaseSampleBatch(id: V13ReleaseSampleId): CadBatch {
  return {
    version: "cadops.v1",
    mode: "commit",
    ops: getV13ReleaseSampleFixture(id).ops.map((op) => ({ ...op }))
  };
}

export function createV13ReleaseSampleCheckpointPayloads(
  id: V13ReleaseSampleId
): readonly V13ReleaseSampleCheckpointPayloadInput[] {
  const fixture = getV13ReleaseSampleFixture(id);
  const checkpointOps = fixture.ops.filter(
    (op): op is Extract<CadOp, { readonly op: "topology.checkpoint.create" }> =>
      op.op === "topology.checkpoint.create"
  );
  const anchorOps = fixture.ops.filter(
    (op): op is Extract<CadOp, { readonly op: "topology.anchor.create" }> =>
      op.op === "topology.anchor.create"
  );
  const repairOps = fixture.ops.filter(
    (op): op is Extract<CadOp, { readonly op: "topology.anchor.repair" }> =>
      op.op === "topology.anchor.repair"
  );

  return checkpointOps.map((checkpoint) => {
    const topologySnapshot = createV13ReleaseSampleCheckpointTopologySnapshot({
      checkpointId: checkpoint.checkpointId,
      bodyId: checkpoint.bodyId,
      entities: [
        ...anchorOps
          .filter((anchor) => anchor.checkpointId === checkpoint.checkpointId)
          .map((anchor) => ({
            localId: anchor.checkpointEntityId,
            kind: anchor.entityKind,
            signature:
              anchor.signatureHash ??
              `partbench-v13-release-fixture-signature:${checkpoint.checkpointId}:${anchor.checkpointEntityId}`
          })),
        ...repairOps
          .filter(
            (repair) =>
              repair.replacementCheckpointId === checkpoint.checkpointId
          )
          .flatMap((repair) => {
            const anchor = anchorOps.find(
              (candidate) => candidate.anchorId === repair.anchorId
            );

            return anchor
              ? [
                  {
                    localId: repair.replacementCheckpointEntityId,
                    kind: anchor.entityKind,
                    signature: `partbench-v13-release-fixture-repaired-signature:${checkpoint.checkpointId}:${repair.replacementCheckpointEntityId}`
                  }
                ]
              : [];
          })
      ]
    });
    const signaturePayload = {
      checkpointId: checkpoint.checkpointId,
      signatureAlgorithm: topologySnapshot.signatureAlgorithm,
      signature: topologySnapshot.signature,
      entityCount: topologySnapshot.entityCount,
      entities: topologySnapshot.entities.map((entity) => ({
        localId: entity.localId,
        kind: entity.kind,
        signature: entity.signature
      }))
    };

    return {
      checkpointId: checkpoint.checkpointId,
      bodyId: checkpoint.bodyId,
      ...(checkpoint.sourceFeatureId
        ? { sourceFeatureId: checkpoint.sourceFeatureId }
        : {}),
      units: fixture.units,
      kernel: {
        boundary: "geometry-kernel",
        snapshotAlgorithm: "partbench-derived-topology-snapshot-v1"
      },
      tolerance: {
        linearTolerance: 0.001,
        angularToleranceDegrees: 0.01
      },
      brepBytes: new TextEncoder().encode(
        `partbench-v13-release-fixture-brep:${fixture.id}:${checkpoint.checkpointId}`
      ),
      topologyBytes: encodeCanonicalCbor(topologySnapshot),
      signatureBytes: encodeCanonicalCbor(signaturePayload)
    };
  });
}

export type V14ReleaseSampleId =
  | "v14-result-body-cut-add-hole"
  | "v14-circle-side-plane-hole"
  | "v14-result-edge-finish";

export type V14ReleaseSampleWorkflowTag =
  | "topology-body-anchor"
  | "result-body-cut"
  | "result-body-add"
  | "result-body-hole"
  | "circle-side-plane-hole"
  | "blocked-support-matrix"
  | "result-edge-finish"
  | "named-reference"
  | "command-readiness"
  | "source-boundary"
  | "wcad-round-trip";

export interface V14ReleaseSampleTopologyExpectation {
  readonly checkpointCount: number;
  readonly anchorCount: number;
  readonly anchorIds: readonly string[];
}

export interface V14ReleaseSampleFeatureExpectation {
  readonly featureId: string;
  readonly kind: "extrude" | "hole" | "chamfer" | "fillet";
  readonly bodyId?: BodyId;
  readonly targetBodyId?: BodyId;
  readonly targetTopologyAnchorId?: string;
  readonly operationMode?: FeatureExtrudeOperationMode;
  readonly namedReference?: NamedReferenceName;
}

export interface V14ReleaseSampleReadinessExpectation {
  readonly label: string;
  readonly target: CadSelectionReferenceInput;
  readonly operation: CadSelectionReferenceOperation;
  readonly snapshot?: CadTopologyMatchSnapshotInput;
  readonly expectedStatus: "ready" | "non-commandable";
  readonly expectedCommandable: boolean;
  readonly expectedSupportedOperations: readonly CadSelectionReferenceOperation[];
}

export interface V14ReleaseSampleBlockedBatchExpectation {
  readonly label: string;
  readonly ops: readonly CadOp[];
  readonly expectedCode: string;
  readonly expectedPath: string;
}

export interface V14ReleaseSampleEditabilityExpectation {
  readonly featureId: string;
  readonly expectedStatus: CadFeatureEditabilityStatus;
}

export interface V14ReleaseSampleFixture {
  readonly id: V14ReleaseSampleId;
  readonly title: string;
  readonly description: string;
  readonly units: DocumentUnits;
  readonly workflowTags: readonly V14ReleaseSampleWorkflowTag[];
  readonly expectedTopology: V14ReleaseSampleTopologyExpectation;
  readonly expectedFeatures: readonly V14ReleaseSampleFeatureExpectation[];
  readonly expectedReadiness: readonly V14ReleaseSampleReadinessExpectation[];
  readonly readinessOpCount?: number;
  readonly expectedBlockedBatches?: readonly V14ReleaseSampleBlockedBatchExpectation[];
  readonly expectedEditability?: readonly V14ReleaseSampleEditabilityExpectation[];
  readonly knownLimitations: readonly string[];
  readonly ops: readonly CadOp[];
}

export interface V14ReleaseSampleCheckpointPayloadInput {
  readonly checkpointId: string;
  readonly bodyId: BodyId;
  readonly sourceFeatureId?: string;
  readonly units?: DocumentUnits;
  readonly kernel: WcadTopologyCheckpointKernelMetadata;
  readonly tolerance: WcadTopologyCheckpointToleranceMetadata;
  readonly brepBytes: Uint8Array;
  readonly topologyBytes: Uint8Array;
  readonly signatureBytes: Uint8Array;
}

const V14_RESULT_SOURCE_BODY = "v14_result_source_body";
const V14_RESULT_SEED_CUT_BODY = "v14_result_seed_cut_body";
const V14_RESULT_BODY_ANCHOR = "v14_anchor_result_body";
const V14_RESULT_BODY_CHECKPOINT = "v14_checkpoint_result_body";
const V14_RESULT_ADD_SOURCE_BODY = "v14_result_add_source_body";
const V14_RESULT_ADD_SEED_CUT_BODY = "v14_result_add_seed_cut_body";
const V14_RESULT_ADD_BODY_ANCHOR = "v14_anchor_result_add_body";
const V14_RESULT_ADD_BODY_CHECKPOINT = "v14_checkpoint_result_add_body";
const V14_RESULT_HOLE_SOURCE_BODY = "v14_result_hole_source_body";
const V14_RESULT_HOLE_BODY_ANCHOR = "v14_anchor_result_hole_body";
const V14_RESULT_HOLE_BODY_CHECKPOINT = "v14_checkpoint_result_hole_body";

const V14_CIRCLE_SOURCE_BODY = "v14_circle_source_body";
const V14_CIRCLE_BODY_ANCHOR = "v14_anchor_circle_body";
const V14_CIRCLE_BODY_CHECKPOINT = "v14_checkpoint_circle_body";

const V14_EDGE_SOURCE_BODY = "v14_edge_source_body";
const V14_EDGE_CUT_BODY = "v14_edge_cut_body";
const V14_EDGE_REFERENCE = "V14 result cut edge";
const V14_EDGE_STABLE_ID = `generated:edge:${V14_EDGE_CUT_BODY}:longitudinal:uMin:vMin`;

export const V14_RELEASE_SAMPLE_FIXTURES = [
  {
    id: "v14-result-body-cut-add-hole",
    title: "V14 topology body-anchor cut, add, and hole sample",
    description:
      "A rectangle-family result body is checkpointed as a public topology body anchor, then reused for a second cut, an add, and a hole through the same CADOps target path.",
    units: "mm",
    workflowTags: [
      "topology-body-anchor",
      "result-body-cut",
      "result-body-add",
      "result-body-hole",
      "command-readiness",
      "source-boundary",
      "wcad-round-trip"
    ],
    expectedTopology: {
      checkpointCount: 3,
      anchorCount: 3,
      anchorIds: [
        V14_RESULT_BODY_ANCHOR,
        V14_RESULT_ADD_BODY_ANCHOR,
        V14_RESULT_HOLE_BODY_ANCHOR
      ]
    },
    expectedFeatures: [
      {
        featureId: "v14_result_second_cut_feature",
        kind: "extrude",
        bodyId: "v14_result_second_cut_body",
        targetBodyId: V14_RESULT_SEED_CUT_BODY,
        targetTopologyAnchorId: V14_RESULT_BODY_ANCHOR,
        operationMode: "cut"
      },
      {
        featureId: "v14_result_add_feature",
        kind: "extrude",
        bodyId: "v14_result_add_body",
        targetBodyId: V14_RESULT_ADD_SEED_CUT_BODY,
        targetTopologyAnchorId: V14_RESULT_ADD_BODY_ANCHOR,
        operationMode: "add"
      },
      {
        featureId: "v14_result_hole_feature",
        kind: "hole",
        bodyId: "v14_result_hole_body",
        targetBodyId: "v14_result_hole_cut_body",
        targetTopologyAnchorId: V14_RESULT_HOLE_BODY_ANCHOR
      }
    ],
    expectedReadiness: [
      {
        label: "result body anchor remains hole-ready",
        target: {
          type: "topologyAnchor",
          anchorId: V14_RESULT_BODY_ANCHOR
        },
        operation: "feature.holeTarget",
        snapshot: createV13TopologyMatchSnapshot({
          checkpointId: V14_RESULT_BODY_CHECKPOINT,
          bodyId: V14_RESULT_SEED_CUT_BODY,
          sourceIdentitySha:
            "1414141414141414141414141414141414141414141414141414141414141414",
          entities: [
            {
              localId: "v14_result_checkpoint_body",
              kind: "body",
              signature: "v14_result_body_signature"
            }
          ]
        }),
        expectedStatus: "ready",
        expectedCommandable: true,
        expectedSupportedOperations: [
          "feature.extrudeCutTarget",
          "feature.holeTarget"
        ]
      }
    ],
    readinessOpCount: 11,
    knownLimitations: [
      "The fixture proves rectangle-family target chaining only; arbitrary profiles and circle-target add remain outside this matrix."
    ],
    ops: [
      {
        op: "sketch.create",
        id: "v14_result_source_sketch",
        name: "V14 result source",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v14_result_source_sketch",
        id: "v14_result_source_rect",
        center: [0, 0],
        width: 4,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "v14_result_source_feature",
        bodyId: V14_RESULT_SOURCE_BODY,
        name: "V14 result source body",
        sketchId: "v14_result_source_sketch",
        entityId: "v14_result_source_rect",
        depth: 3,
        operationMode: "newBody"
      },
      {
        op: "sketch.create",
        id: "v14_result_seed_cut_sketch",
        name: "V14 result seed cut",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v14_result_seed_cut_sketch",
        id: "v14_result_seed_cut_rect",
        center: [0, 0],
        width: 1.5,
        height: 1
      },
      {
        op: "feature.extrude",
        id: "v14_result_seed_cut_feature",
        bodyId: V14_RESULT_SEED_CUT_BODY,
        name: "V14 result seed cut body",
        sketchId: "v14_result_seed_cut_sketch",
        entityId: "v14_result_seed_cut_rect",
        depth: 1,
        operationMode: "cut",
        targetBodyId: V14_RESULT_SOURCE_BODY
      },
      {
        op: "topology.checkpoint.create",
        checkpointId: V14_RESULT_BODY_CHECKPOINT,
        bodyId: V14_RESULT_SEED_CUT_BODY,
        sourceFeatureId: "v14_result_seed_cut_feature",
        sourceIdentity: {
          algorithm: "partbench-source-v1",
          sha256:
            "1414141414141414141414141414141414141414141414141414141414141414"
        },
        status: "active"
      },
      {
        op: "topology.anchor.create",
        anchorId: V14_RESULT_BODY_ANCHOR,
        entityKind: "body",
        bodyId: V14_RESULT_SEED_CUT_BODY,
        checkpointId: V14_RESULT_BODY_CHECKPOINT,
        checkpointEntityId: "v14_result_checkpoint_body",
        sourceFeatureId: "v14_result_seed_cut_feature",
        stableId: `generated:body:${V14_RESULT_SEED_CUT_BODY}`,
        sourceSemanticRole: "result body",
        signatureHash: "v14_result_body_signature"
      },
      {
        op: "sketch.create",
        id: "v14_result_second_cut_sketch",
        name: "V14 result second cut",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v14_result_second_cut_sketch",
        id: "v14_result_second_cut_rect",
        center: [0.25, 0.25],
        width: 0.6,
        height: 0.5
      },
      {
        op: "feature.extrude",
        id: "v14_result_second_cut_feature",
        bodyId: "v14_result_second_cut_body",
        name: "V14 result second cut",
        sketchId: "v14_result_second_cut_sketch",
        entityId: "v14_result_second_cut_rect",
        depth: 0.5,
        operationMode: "cut",
        targetTopologyAnchorId: V14_RESULT_BODY_ANCHOR
      },
      {
        op: "sketch.create",
        id: "v14_result_add_source_sketch",
        name: "V14 result add source",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v14_result_add_source_sketch",
        id: "v14_result_add_source_rect",
        center: [5, 0],
        width: 4,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "v14_result_add_source_feature",
        bodyId: V14_RESULT_ADD_SOURCE_BODY,
        name: "V14 result add source body",
        sketchId: "v14_result_add_source_sketch",
        entityId: "v14_result_add_source_rect",
        depth: 3,
        operationMode: "newBody"
      },
      {
        op: "sketch.create",
        id: "v14_result_add_seed_cut_sketch",
        name: "V14 result add seed cut",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v14_result_add_seed_cut_sketch",
        id: "v14_result_add_seed_cut_rect",
        center: [5, 0],
        width: 1,
        height: 1
      },
      {
        op: "feature.extrude",
        id: "v14_result_add_seed_cut_feature",
        bodyId: V14_RESULT_ADD_SEED_CUT_BODY,
        name: "V14 result add seed cut body",
        sketchId: "v14_result_add_seed_cut_sketch",
        entityId: "v14_result_add_seed_cut_rect",
        depth: 1,
        operationMode: "cut",
        targetBodyId: V14_RESULT_ADD_SOURCE_BODY
      },
      {
        op: "topology.checkpoint.create",
        checkpointId: V14_RESULT_ADD_BODY_CHECKPOINT,
        bodyId: V14_RESULT_ADD_SEED_CUT_BODY,
        sourceFeatureId: "v14_result_add_seed_cut_feature",
        sourceIdentity: {
          algorithm: "partbench-source-v1",
          sha256:
            "1515151515151515151515151515151515151515151515151515151515151515"
        },
        status: "active"
      },
      {
        op: "topology.anchor.create",
        anchorId: V14_RESULT_ADD_BODY_ANCHOR,
        entityKind: "body",
        bodyId: V14_RESULT_ADD_SEED_CUT_BODY,
        checkpointId: V14_RESULT_ADD_BODY_CHECKPOINT,
        checkpointEntityId: "v14_result_add_checkpoint_body",
        sourceFeatureId: "v14_result_add_seed_cut_feature",
        stableId: `generated:body:${V14_RESULT_ADD_SEED_CUT_BODY}`,
        sourceSemanticRole: "result body",
        signatureHash: "v14_result_add_body_signature"
      },
      {
        op: "sketch.create",
        id: "v14_result_add_sketch",
        name: "V14 result add",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v14_result_add_sketch",
        id: "v14_result_add_rect",
        center: [1.75, 0],
        width: 0.5,
        height: 0.5
      },
      {
        op: "feature.extrude",
        id: "v14_result_add_feature",
        bodyId: "v14_result_add_body",
        name: "V14 result add",
        sketchId: "v14_result_add_sketch",
        entityId: "v14_result_add_rect",
        depth: 0.5,
        operationMode: "add",
        targetTopologyAnchorId: V14_RESULT_ADD_BODY_ANCHOR
      },
      {
        op: "sketch.create",
        id: "v14_result_hole_source_sketch",
        name: "V14 result hole source",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v14_result_hole_source_sketch",
        id: "v14_result_hole_source_rect",
        center: [-5, 0],
        width: 4,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "v14_result_hole_source_feature",
        bodyId: V14_RESULT_HOLE_SOURCE_BODY,
        name: "V14 result hole source body",
        sketchId: "v14_result_hole_source_sketch",
        entityId: "v14_result_hole_source_rect",
        depth: 3,
        operationMode: "newBody"
      },
      {
        op: "topology.checkpoint.create",
        checkpointId: V14_RESULT_HOLE_BODY_CHECKPOINT,
        bodyId: V14_RESULT_HOLE_SOURCE_BODY,
        sourceFeatureId: "v14_result_hole_source_feature",
        sourceIdentity: {
          algorithm: "partbench-source-v1",
          sha256:
            "1616161616161616161616161616161616161616161616161616161616161616"
        },
        status: "active"
      },
      {
        op: "topology.anchor.create",
        anchorId: V14_RESULT_HOLE_BODY_ANCHOR,
        entityKind: "body",
        bodyId: V14_RESULT_HOLE_SOURCE_BODY,
        checkpointId: V14_RESULT_HOLE_BODY_CHECKPOINT,
        checkpointEntityId: "v14_result_hole_checkpoint_body",
        sourceFeatureId: "v14_result_hole_source_feature",
        stableId: `generated:body:${V14_RESULT_HOLE_SOURCE_BODY}`,
        sourceSemanticRole: "source body",
        signatureHash: "v14_result_hole_body_signature"
      },
      {
        op: "sketch.create",
        id: "v14_result_hole_cut_sketch",
        name: "V14 result hole target cut",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v14_result_hole_cut_sketch",
        id: "v14_result_hole_cut_rect",
        center: [-5, 0],
        width: 1,
        height: 1
      },
      {
        op: "feature.extrude",
        id: "v14_result_hole_cut_feature",
        bodyId: "v14_result_hole_cut_body",
        name: "V14 result hole target cut",
        sketchId: "v14_result_hole_cut_sketch",
        entityId: "v14_result_hole_cut_rect",
        depth: 1,
        operationMode: "cut",
        targetTopologyAnchorId: V14_RESULT_HOLE_BODY_ANCHOR
      },
      {
        op: "sketch.create",
        id: "v14_result_hole_sketch",
        name: "V14 result hole",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "v14_result_hole_sketch",
        id: "v14_result_hole_circle",
        center: [0.5, 0.25],
        radius: 0.25
      },
      {
        op: "feature.hole",
        id: "v14_result_hole_feature",
        bodyId: "v14_result_hole_body",
        name: "V14 result hole",
        sketchId: "v14_result_hole_sketch",
        circleEntityId: "v14_result_hole_circle",
        depthMode: "throughAll",
        direction: "positive",
        targetTopologyAnchorId: V14_RESULT_HOLE_BODY_ANCHOR
      }
    ]
  },
  {
    id: "v14-circle-side-plane-hole",
    title: "V14 circle-origin side-plane hole sample",
    description:
      "A circle-origin topology body anchor accepts a rectangle cut and explicit XZ side-plane hole while keeping circle-target add blocked.",
    units: "mm",
    workflowTags: [
      "topology-body-anchor",
      "result-body-cut",
      "result-body-hole",
      "circle-side-plane-hole",
      "blocked-support-matrix",
      "command-readiness",
      "source-boundary",
      "wcad-round-trip"
    ],
    expectedTopology: {
      checkpointCount: 1,
      anchorCount: 1,
      anchorIds: [V14_CIRCLE_BODY_ANCHOR]
    },
    expectedFeatures: [
      {
        featureId: "v14_circle_cut_feature",
        kind: "extrude",
        bodyId: "v14_circle_cut_body",
        targetBodyId: V14_CIRCLE_SOURCE_BODY,
        targetTopologyAnchorId: V14_CIRCLE_BODY_ANCHOR,
        operationMode: "cut"
      },
      {
        featureId: "v14_circle_hole_feature",
        kind: "hole",
        bodyId: "v14_circle_hole_body",
        targetBodyId: "v14_circle_cut_body",
        targetTopologyAnchorId: V14_CIRCLE_BODY_ANCHOR
      }
    ],
    expectedReadiness: [
      {
        label: "circle-origin add remains blocked",
        target: {
          type: "topologyAnchor",
          anchorId: V14_CIRCLE_BODY_ANCHOR
        },
        operation: "feature.extrudeAddTarget",
        snapshot: createV13TopologyMatchSnapshot({
          checkpointId: V14_CIRCLE_BODY_CHECKPOINT,
          bodyId: V14_CIRCLE_SOURCE_BODY,
          sourceIdentitySha:
            "2424242424242424242424242424242424242424242424242424242424242424",
          entities: [
            {
              localId: "v14_circle_checkpoint_body",
              kind: "body",
              signature: "v14_circle_body_signature"
            }
          ]
        }),
        expectedStatus: "non-commandable",
        expectedCommandable: false,
        expectedSupportedOperations: [
          "feature.extrudeCutTarget",
          "feature.holeTarget"
        ]
      },
      {
        label: "circle-origin hole remains ready",
        target: {
          type: "topologyAnchor",
          anchorId: V14_CIRCLE_BODY_ANCHOR
        },
        operation: "feature.holeTarget",
        snapshot: createV13TopologyMatchSnapshot({
          checkpointId: V14_CIRCLE_BODY_CHECKPOINT,
          bodyId: V14_CIRCLE_SOURCE_BODY,
          sourceIdentitySha:
            "2424242424242424242424242424242424242424242424242424242424242424",
          entities: [
            {
              localId: "v14_circle_checkpoint_body",
              kind: "body",
              signature: "v14_circle_body_signature"
            }
          ]
        }),
        expectedStatus: "ready",
        expectedCommandable: true,
        expectedSupportedOperations: [
          "feature.extrudeCutTarget",
          "feature.holeTarget"
        ]
      }
    ],
    readinessOpCount: 8,
    expectedBlockedBatches: [
      {
        label: "circle add dry-run stays blocked",
        ops: [
          {
            op: "feature.extrude",
            id: "v14_circle_add_blocked_feature",
            bodyId: "v14_circle_add_blocked_body",
            sketchId: "v14_circle_add_blocked_sketch",
            entityId: "v14_circle_add_blocked_profile",
            depth: 0.5,
            operationMode: "add",
            targetTopologyAnchorId: V14_CIRCLE_BODY_ANCHOR
          }
        ],
        expectedCode: "UNSUPPORTED_FEATURE_OPERATION",
        expectedPath: "$.ops[0].operationMode"
      }
    ],
    knownLimitations: [
      "The side hole uses an explicit public XZ sketch plane; curved side faces remain non-attachable."
    ],
    ops: [
      {
        op: "sketch.create",
        id: "v14_circle_source_sketch",
        name: "V14 circle source",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "v14_circle_source_sketch",
        id: "v14_circle_source_profile",
        center: [0, 0],
        radius: 2
      },
      {
        op: "feature.extrude",
        id: "v14_circle_source_feature",
        bodyId: V14_CIRCLE_SOURCE_BODY,
        name: "V14 circle source body",
        sketchId: "v14_circle_source_sketch",
        entityId: "v14_circle_source_profile",
        depth: 4,
        operationMode: "newBody"
      },
      {
        op: "topology.checkpoint.create",
        checkpointId: V14_CIRCLE_BODY_CHECKPOINT,
        bodyId: V14_CIRCLE_SOURCE_BODY,
        sourceFeatureId: "v14_circle_source_feature",
        sourceIdentity: {
          algorithm: "partbench-source-v1",
          sha256:
            "2424242424242424242424242424242424242424242424242424242424242424"
        },
        status: "active"
      },
      {
        op: "topology.anchor.create",
        anchorId: V14_CIRCLE_BODY_ANCHOR,
        entityKind: "body",
        bodyId: V14_CIRCLE_SOURCE_BODY,
        checkpointId: V14_CIRCLE_BODY_CHECKPOINT,
        checkpointEntityId: "v14_circle_checkpoint_body",
        sourceFeatureId: "v14_circle_source_feature",
        stableId: `generated:body:${V14_CIRCLE_SOURCE_BODY}`,
        sourceSemanticRole: "source body",
        signatureHash: "v14_circle_body_signature"
      },
      {
        op: "sketch.create",
        id: "v14_circle_cut_sketch",
        name: "V14 circle result cut",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v14_circle_cut_sketch",
        id: "v14_circle_cut_rect",
        center: [0, 0],
        width: 1,
        height: 1
      },
      {
        op: "feature.extrude",
        id: "v14_circle_cut_feature",
        bodyId: "v14_circle_cut_body",
        name: "V14 circle result cut",
        sketchId: "v14_circle_cut_sketch",
        entityId: "v14_circle_cut_rect",
        depth: 1,
        operationMode: "cut",
        targetTopologyAnchorId: V14_CIRCLE_BODY_ANCHOR
      },
      {
        op: "sketch.create",
        id: "v14_circle_add_blocked_sketch",
        name: "V14 blocked circle add",
        plane: "XY"
      },
      {
        op: "sketch.addCircle",
        sketchId: "v14_circle_add_blocked_sketch",
        id: "v14_circle_add_blocked_profile",
        center: [1, 0],
        radius: 0.25
      },
      {
        op: "sketch.create",
        id: "v14_circle_hole_sketch",
        name: "V14 circle side hole",
        plane: "XZ"
      },
      {
        op: "sketch.addCircle",
        sketchId: "v14_circle_hole_sketch",
        id: "v14_circle_hole_profile",
        center: [0, 1.5],
        radius: 0.35
      },
      {
        op: "feature.hole",
        id: "v14_circle_hole_feature",
        bodyId: "v14_circle_hole_body",
        name: "V14 circle side hole",
        sketchId: "v14_circle_hole_sketch",
        circleEntityId: "v14_circle_hole_profile",
        depthMode: "throughAll",
        direction: "positive",
        targetTopologyAnchorId: V14_CIRCLE_BODY_ANCHOR
      }
    ]
  },
  {
    id: "v14-result-edge-finish",
    title: "V14 result-edge finish sample",
    description:
      "A rectangle cut-wall longitudinal result edge is named and consumed by a chamfer, proving source-backed edge-finish diagnostics and storage.",
    units: "mm",
    workflowTags: [
      "result-body-cut",
      "result-edge-finish",
      "named-reference",
      "command-readiness",
      "source-boundary",
      "wcad-round-trip"
    ],
    expectedTopology: {
      checkpointCount: 0,
      anchorCount: 0,
      anchorIds: []
    },
    expectedFeatures: [
      {
        featureId: "v14_edge_cut_feature",
        kind: "extrude",
        bodyId: V14_EDGE_CUT_BODY,
        targetBodyId: V14_EDGE_SOURCE_BODY,
        operationMode: "cut"
      },
      {
        featureId: "v14_edge_chamfer_feature",
        kind: "chamfer",
        bodyId: "v14_edge_chamfer_body",
        targetBodyId: V14_EDGE_CUT_BODY,
        namedReference: V14_EDGE_REFERENCE
      }
    ],
    expectedReadiness: [
      {
        label: "result cut-wall edge stays finish-ready",
        target: {
          type: "generatedReference",
          bodyId: V14_EDGE_CUT_BODY,
          stableId: V14_EDGE_STABLE_ID,
          expectedKind: "edge"
        },
        operation: "feature.chamfer",
        expectedStatus: "ready",
        expectedCommandable: true,
        expectedSupportedOperations: ["feature.chamfer", "feature.fillet"]
      }
    ],
    readinessOpCount: 6,
    expectedEditability: [
      {
        featureId: "v14_edge_source_feature",
        expectedStatus: "blocked"
      }
    ],
    knownLimitations: [
      "This fixture proves the rectangle cut-wall longitudinal edge subset, not arbitrary result-edge finishing."
    ],
    ops: [
      {
        op: "sketch.create",
        id: "v14_edge_source_sketch",
        name: "V14 edge source",
        plane: "XY"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v14_edge_source_sketch",
        id: "v14_edge_source_rect",
        center: [0, 0],
        width: 4,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "v14_edge_source_feature",
        bodyId: V14_EDGE_SOURCE_BODY,
        name: "V14 edge source body",
        sketchId: "v14_edge_source_sketch",
        entityId: "v14_edge_source_rect",
        depth: 3,
        operationMode: "newBody"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "v14_edge_source_sketch",
        id: "v14_edge_cut_rect",
        center: [1, 0],
        width: 2,
        height: 1
      },
      {
        op: "feature.extrude",
        id: "v14_edge_cut_feature",
        bodyId: V14_EDGE_CUT_BODY,
        name: "V14 edge cut body",
        sketchId: "v14_edge_source_sketch",
        entityId: "v14_edge_cut_rect",
        depth: 3,
        operationMode: "cut",
        targetBodyId: V14_EDGE_SOURCE_BODY
      },
      {
        op: "reference.nameGenerated",
        name: V14_EDGE_REFERENCE,
        bodyId: V14_EDGE_CUT_BODY,
        stableId: V14_EDGE_STABLE_ID
      },
      {
        op: "feature.chamfer",
        id: "v14_edge_chamfer_feature",
        bodyId: "v14_edge_chamfer_body",
        name: "V14 result-edge chamfer",
        targetBodyId: V14_EDGE_CUT_BODY,
        namedReference: V14_EDGE_REFERENCE,
        distance: 0.1
      }
    ]
  }
] as const satisfies readonly V14ReleaseSampleFixture[];

export function listV14ReleaseSampleFixtures(): readonly V14ReleaseSampleFixture[] {
  return V14_RELEASE_SAMPLE_FIXTURES;
}

export function getV14ReleaseSampleFixture(
  id: V14ReleaseSampleId
): V14ReleaseSampleFixture {
  const fixture = V14_RELEASE_SAMPLE_FIXTURES.find(
    (candidate) => candidate.id === id
  );

  if (!fixture) {
    throw new Error(`Unknown V14 release sample fixture: ${id}`);
  }

  return fixture;
}

export function createV14ReleaseSampleBatch(id: V14ReleaseSampleId): CadBatch {
  return {
    version: "cadops.v1",
    mode: "commit",
    ops: getV14ReleaseSampleFixture(id).ops.map((op) => ({ ...op }))
  };
}

export function createV14ReleaseSampleCheckpointPayloads(
  id: V14ReleaseSampleId
): readonly V14ReleaseSampleCheckpointPayloadInput[] {
  const fixture = getV14ReleaseSampleFixture(id);
  const checkpointOps = fixture.ops.filter(
    (op): op is Extract<CadOp, { readonly op: "topology.checkpoint.create" }> =>
      op.op === "topology.checkpoint.create"
  );
  const anchorOps = fixture.ops.filter(
    (op): op is Extract<CadOp, { readonly op: "topology.anchor.create" }> =>
      op.op === "topology.anchor.create"
  );

  return checkpointOps.map((checkpoint) => {
    const topologySnapshot = createV13ReleaseSampleCheckpointTopologySnapshot({
      checkpointId: checkpoint.checkpointId,
      bodyId: checkpoint.bodyId,
      entities: anchorOps
        .filter((anchor) => anchor.checkpointId === checkpoint.checkpointId)
        .map((anchor) => ({
          localId: anchor.checkpointEntityId,
          kind: anchor.entityKind,
          signature:
            anchor.signatureHash ??
            `partbench-v14-release-fixture-signature:${checkpoint.checkpointId}:${anchor.checkpointEntityId}`
        }))
    });
    const signaturePayload = {
      checkpointId: checkpoint.checkpointId,
      signatureAlgorithm: topologySnapshot.signatureAlgorithm,
      signature: topologySnapshot.signature,
      entityCount: topologySnapshot.entityCount,
      entities: topologySnapshot.entities.map((entity) => ({
        localId: entity.localId,
        kind: entity.kind,
        signature: entity.signature
      }))
    };

    return {
      checkpointId: checkpoint.checkpointId,
      bodyId: checkpoint.bodyId,
      ...(checkpoint.sourceFeatureId
        ? { sourceFeatureId: checkpoint.sourceFeatureId }
        : {}),
      units: fixture.units,
      kernel: {
        boundary: "geometry-kernel",
        snapshotAlgorithm: "partbench-derived-topology-snapshot-v1"
      },
      tolerance: {
        linearTolerance: 0.001,
        angularToleranceDegrees: 0.01
      },
      brepBytes: new TextEncoder().encode(
        `partbench-v14-release-fixture-brep:${fixture.id}:${checkpoint.checkpointId}`
      ),
      topologyBytes: encodeCanonicalCbor(topologySnapshot),
      signatureBytes: encodeCanonicalCbor(signaturePayload)
    };
  });
}

function createV13TopologyMatchSnapshot({
  checkpointId,
  bodyId,
  sourceIdentitySha = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  entities
}: {
  readonly checkpointId: string;
  readonly bodyId: BodyId;
  readonly sourceIdentitySha?: string;
  readonly entities: readonly {
    readonly localId: string;
    readonly kind: CadTopologyMatchSnapshotInput["topologySnapshot"]["entities"][number]["kind"];
    readonly signature: string;
  }[];
}): CadTopologyMatchSnapshotInput {
  return {
    checkpointId,
    bodyId,
    sourceIdentity: {
      algorithm: "partbench-source-v1",
      sha256: sourceIdentitySha
    },
    topologySnapshot: {
      source: "kernel-derived",
      status: "ready",
      entityCounts: {
        bodyCount: entities.filter((entity) => entity.kind === "body").length,
        solidCount: entities.filter((entity) => entity.kind === "solid").length,
        faceCount: entities.filter((entity) => entity.kind === "face").length,
        loopCount: entities.filter((entity) => entity.kind === "loop").length,
        wireCount: entities.filter((entity) => entity.kind === "wire").length,
        coedgeCount: entities.filter((entity) => entity.kind === "coedge")
          .length,
        edgeCount: entities.filter((entity) => entity.kind === "edge").length,
        vertexCount: entities.filter((entity) => entity.kind === "vertex")
          .length,
        axisCount: entities.filter((entity) => entity.kind === "axis").length
      },
      entityCount: entities.length,
      entities: entities.map((entity) => ({
        localId: entity.localId,
        kind: entity.kind,
        source: "kernel-derived",
        signature: entity.signature
      })),
      unsupportedEntityKinds: [],
      adjacencyAvailable: false,
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
      signature: `${checkpointId}:signature`,
      diagnostics: []
    }
  };
}

function createV13ReleaseSampleCheckpointTopologySnapshot({
  checkpointId,
  bodyId,
  entities: sourceEntities
}: {
  readonly checkpointId: string;
  readonly bodyId: BodyId;
  readonly entities: readonly {
    readonly localId: string;
    readonly kind: CadTopologyMatchSnapshotInput["topologySnapshot"]["entities"][number]["kind"];
    readonly signature: string;
  }[];
}): CadBodyExactTopologySnapshot {
  const entities = sourceEntities.map((entity) => ({
    localId: entity.localId,
    kind: entity.kind,
    source: "kernel-derived" as const,
    signature: entity.signature
  }));
  const entityCounts = {
    solidCount: 0,
    faceCount: entities.filter((entity) => entity.kind === "face").length,
    wireCount: 0,
    edgeCount: entities.filter((entity) => entity.kind === "edge").length,
    vertexCount: entities.filter((entity) => entity.kind === "vertex").length,
    bodyCount: entities.filter((entity) => entity.kind === "body").length,
    loopCount: 0,
    coedgeCount: 0,
    axisCount: entities.filter((entity) => entity.kind === "axis").length
  };

  return {
    source: "kernel-derived",
    status: "ready",
    entityCounts,
    entityCount: entities.length,
    entities,
    unsupportedEntityKinds: [],
    adjacencyAvailable: false,
    signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
    signature: `partbench-v13-release-fixture-topology:${bodyId}:${checkpointId}:${entities
      .map((entity) => `${entity.kind}:${entity.localId}:${entity.signature}`)
      .join("|")}`,
    diagnostics: []
  };
}

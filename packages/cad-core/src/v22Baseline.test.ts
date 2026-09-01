import { describe, expect, it } from "vitest";
import {
  CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE,
  type CadBodySource,
  type CadExactDownstreamOperation,
  type CadFeatureSummary,
  type CadGeneratedEntityKind,
  type CadOp,
  type CadQuery,
  type CadSelectionReferenceOperation
} from "@web-cad/cad-protocol";
import {
  CAD_DOWNSTREAM_BODY_OPERATIONS,
  CAD_DOWNSTREAM_BODY_POLICY
} from "./downstreamBodyPolicy";
import { V21_EXACT_BODY_SOURCE_POLICY } from "./releaseSamples";
type SelectableKind = Extract<
  CadGeneratedEntityKind,
  "body" | "face" | "edge" | "vertex"
>;
const MUST = "must" as const;
const NO = "no-new-promise" as const;
const SELECTABLE_KINDS = ["body", "face", "edge", "vertex"] as const;
const SELECTION_REQUIREMENTS = {
  kinds: [MUST, MUST, MUST, MUST],
  preconditions: [
    "active",
    "healthy",
    "current",
    "exact-ready",
    "identity-bound",
    "within-limits"
  ],
  blockers: [
    "consumed",
    "stale",
    "failed",
    "repair-needed",
    "missing-payload",
    "unsupported",
    "duplicate-owned",
    "cyclic",
    "over-limit",
    "identity-mismatched"
  ],
  missingOrInvalidPick: "truthful body-only fallback"
} as const;

type SelectionEntry = {
  readonly cases: readonly string[];
  readonly kinds: readonly [typeof MUST, typeof MUST, typeof MUST, typeof MUST];
  readonly preconditions: readonly string[];
  readonly blockers: readonly string[];
  readonly missingOrInvalidPick: string;
};

const selection = (
  cases: readonly string[],
  additions: readonly string[] = []
) => ({
  ...SELECTION_REQUIREMENTS,
  cases: [...cases, ...additions]
});
const SOURCE_POLICY = V21_EXACT_BODY_SOURCE_POLICY;
const S = SOURCE_POLICY;
const V22_ADDED_CASES = {
  sketchHoleFeature: ["recursive"],
  linearPatternFeature: ["recursive"],
  circularPatternFeature: ["recursive"],
  mirrorFeature: ["recursive"],
  importedStepBody: ["recovered-checkpoint-downstream"]
} as const;
const V = V22_ADDED_CASES;
const SELECTION = {
  primitiveFeature: selection(S.primitiveFeature.cases),
  sketchExtrudeFeature: selection(S.sketchExtrudeFeature.cases),
  sketchRevolveFeature: selection(S.sketchRevolveFeature.cases),
  sketchHoleFeature: selection(S.sketchHoleFeature.cases, V.sketchHoleFeature),
  edgeChamferFeature: selection(S.edgeChamferFeature.cases),
  edgeFilletFeature: selection(S.edgeFilletFeature.cases),
  linearPatternFeature: selection(
    S.linearPatternFeature.cases,
    V.linearPatternFeature
  ),
  circularPatternFeature: selection(
    S.circularPatternFeature.cases,
    V.circularPatternFeature
  ),
  mirrorFeature: selection(S.mirrorFeature.cases, V.mirrorFeature),
  combineFeature: selection(S.combineFeature.cases),
  shellFeature: selection(S.shellFeature.cases),
  sweepFeature: selection(S.sweepFeature.cases),
  loftFeature: selection(S.loftFeature.cases),
  importedStepBody: selection(S.importedStepBody.cases, V.importedStepBody)
} as const satisfies Record<CadBodySource["type"], SelectionEntry>;

type CollectorRow = readonly [
  readonly SelectableKind[],
  readonly CadSelectionReferenceOperation[],
  readonly CadExactDownstreamOperation[],
  readonly string[],
  string,
  readonly CadOp["op"][]
];
const collector = (...row: CollectorRow) => row;
const B = ["body"] as const;
const F = ["face"] as const;
const E = ["edge"] as const;
const ALL = SELECTABLE_KINDS;
const SINGLE_SHAPE = "single-shape policy";
const ACTIVE_ANCHOR = "generated/named/active anchor";

const COLLECTORS = [
  collector(
    B,
    ["feature.extrudeAddTarget", "feature.extrudeCutTarget"],
    [],
    ["targetBodyId", "body anchor"],
    "completed add/cut matrix",
    ["feature.extrude"]
  ),
  collector(
    B,
    ["feature.holeTarget"],
    ["holeTarget"],
    ["targetBodyId", "targetTopologyAnchorId"],
    SINGLE_SHAPE,
    ["feature.hole", "feature.updateHole"]
  ),
  collector(B, [], ["patternSeed"], ["seedBodyId"], SINGLE_SHAPE, [
    "feature.linearPattern",
    "feature.circularPattern"
  ]),
  collector(B, [], ["mirrorSeed"], ["seedBodyId"], SINGLE_SHAPE, [
    "feature.mirror"
  ]),
  collector(B, [], ["shellTarget"], ["targetBodyId"], "single-solid policy", [
    "feature.shell"
  ]),
  collector(
    F,
    ["feature.attachSketchPlane"],
    [],
    [`planar ${ACTIVE_ANCHOR}`],
    "planar sketch-on-face matrix",
    ["sketch.createOnFace"]
  ),
  collector(F, ["feature.shell"], [], [ACTIVE_ANCHOR], "shell readiness", [
    "feature.shell",
    "feature.updateShell"
  ]),
  collector(
    F,
    ["feature.mirrorPlane"],
    [],
    [`planar ${ACTIVE_ANCHOR}`, "existing offset"],
    "planar mirror matrix",
    ["feature.mirror", "feature.updateMirror"]
  ),
  collector(
    E,
    ["feature.chamfer", "feature.fillet"],
    [],
    [`eligible ${ACTIVE_ANCHOR}`],
    "completed edge-finish matrix",
    ["feature.chamfer", "feature.fillet"]
  ),
  collector(
    E,
    ["feature.linearPatternDirection", "feature.circularPatternAxis"],
    [],
    [`linear ${ACTIVE_ANCHOR}`, "global axis"],
    "linear pattern matrix",
    [
      "feature.linearPattern",
      "feature.updateLinearPattern",
      "feature.circularPattern",
      "feature.updateCircularPattern"
    ]
  ),
  collector(
    ALL,
    ["reference.nameGenerated"],
    [],
    ["existing generated stable ID"],
    "existing generated match",
    ["reference.nameGenerated"]
  )
] as const;

const HANDOFF = {
  outcomes: [
    "selectable",
    "inspectOnly",
    "existingGeneratedMatch",
    "existingAnchorMatch",
    "promotableGeneratedMatch",
    "blocked",
    "stale",
    "missing",
    "ambiguous",
    "resourceLimited",
    "unsupported"
  ],
  promotable: {
    kinds: ["body", "face", "edge"],
    requires: [
      "current exact entity",
      "existing generated stable-ID match",
      "completed checkpoint-and-anchor row",
      "planning and consuming CADOps in one Apply batch"
    ]
  },
  vertex:
    "existing generated match may name; arbitrary exact vertex never creates an anchor"
} as const;

type PreviewGrip = {
  readonly create: typeof MUST | typeof NO;
  readonly update: typeof MUST | typeof NO;
  readonly grips: readonly string[];
  readonly valueEditors: readonly string[];
};
const preview = (
  create: PreviewGrip["create"],
  update: PreviewGrip["update"],
  grips: readonly string[] = [],
  valueEditors: readonly string[] = []
) => ({ create, update, grips, valueEditors });

const PREVIEW_GRIPS = {
  primitive: preview(NO, NO),
  extrude: preview(MUST, MUST, ["depth"]),
  revolve: preview(MUST, MUST, ["angle"]),
  hole: preview(MUST, MUST, ["blindDepth"]),
  chamfer: preview(MUST, MUST, ["distance"]),
  fillet: preview(MUST, MUST, ["radius"]),
  importedBody: preview(NO, NO),
  linearPattern: preview(MUST, MUST, ["spacing"], ["count"]),
  circularPattern: preview(MUST, MUST, ["totalAngle"], ["count"]),
  mirror: preview(MUST, MUST, ["planeOffset"]),
  combine: preview(MUST, NO),
  shell: preview(MUST, MUST, ["wallThickness"]),
  sweep: preview(MUST, MUST),
  loft: preview(MUST, MUST)
} as const satisfies Record<CadFeatureSummary["kind"], PreviewGrip>;

const D = "distance" as const;
const A = "angle" as const;
const U = "unavailable" as const;
const MEASUREMENTS = {
  single: {
    body: ["volume", "surfaceArea", "centroid", "bounds", "inertia"],
    face: ["area", "surfaceClass", "normal/axis/radius when defined"],
    edge: ["length", "curveClass", "midpoint", "radius when defined"],
    vertex: ["model-space coordinates"]
  },
  pair: {
    body: { body: U, face: U, edge: U, vertex: U },
    face: { body: U, face: [D, A], edge: [D], vertex: [D] },
    edge: { body: U, face: [D], edge: [D, A], vertex: [D] },
    vertex: { body: U, face: [D], edge: [D], vertex: [D] }
  },
  rules: [
    "distinct current entities; same or different body",
    "face angle requires both planar",
    "edge angle requires both linear",
    "non-unique closest point omits points",
    "unavailable returns no approximate number"
  ]
} as const satisfies {
  readonly single: Record<SelectableKind, readonly string[]>;
  readonly pair: Record<
    SelectableKind,
    Record<SelectableKind, typeof U | readonly (typeof D | typeof A)[]>
  >;
  readonly rules: readonly string[];
};

const QUERY_SEAM = {
  query: "selection.referenceCandidates" as Extract<
    CadQuery,
    { readonly query: "selection.referenceCandidates" }
  >["query"],
  alternatives: ["existing selection", "currentTopologyEvidence only"],
  evidence: [
    "bodyId",
    "bodySourceIdentitySignature",
    "topologySignature",
    "entityKind",
    "localId",
    "entitySignature"
  ],
  outcomes: HANDOFF.outcomes,
  rejectedEvidenceFields: [
    "rendererHitId",
    "selectionBufferHitId",
    "triangleIndex",
    "faceTriangleRange",
    "edgePolyline",
    "vertexDisplayPoint",
    "depth",
    "pickMapOffset",
    "meshCoordinates",
    "pickFilterState",
    "candidateDisplayData",
    "brepBytes",
    "occtHandle",
    "opfsName",
    "path",
    "url",
    "blob",
    "fileHandle"
  ],
  grandfatheredPrivateViewportInputs: ["rendererHitId", "selectionBufferHitId"]
} as const;

const MIB = 1024 * 1024;
const LIMITS = {
  preview: 1,
  measurement: 1,
  candidates: 64,
  annotations: 512,
  pins: 32,
  sections: 1,
  recoveryProjects: 1,
  recoveryGenerations: 2,
  triangleExaminations: 250_000,
  pickMapBytes: 128 * MIB,
  retainedPickMapBytes: 512 * MIB,
  recoveryGenerationBytes: 512 * MIB,
  recoveryBytes: 1024 * MIB,
  recoveryZipEntryBytes: 128 * MIB,
  recoveryZipEntries: 12_300,
  recoveryRecordBytes: 64 * 1024,
  recoveryMarkerBytes: 4 * 1024,
  numericBounds:
    "safe integers for counts, offsets, ranges, and typed-array bytes"
} as const;

const INTERACTION = [
  "Auto/Body/Face/Edge/Vertex filters; deterministic keyboard cycle/list; Shift; Escape; collector priority; body fallback",
  "labels: kind, label, index/count, commandability, authority, truncation, pending/failure, recovery; no private IDs",
  "focus/live regions, screen reader, reduced motion, high zoom, narrow layout, editable-target exclusions; no hover-only action"
] as const;

describe("V22 Gate A baseline fixtures", () => {
  it("uses the current source matrix and V21.1 fixture cases", () => {
    const sources = Object.keys(CAD_EXPORT_SOURCE_KIND_BY_BODY_SOURCE_TYPE);
    expect(Object.keys(SELECTION)).toEqual(sources);
    expect(Object.keys(V21_EXACT_BODY_SOURCE_POLICY)).toEqual(sources);
    expect(Object.values(SELECTION).flatMap(({ cases }) => cases)).toHaveLength(
      Object.values(SOURCE_POLICY).flatMap(({ cases }) => cases).length +
        Object.values(V22_ADDED_CASES).flat().length
    );
    expect(
      Object.values(SELECTION).every(
        ({ cases, kinds, preconditions, blockers, missingOrInvalidPick }) =>
          cases.length > 0 &&
          kinds.every((kind) => kind === MUST) &&
          preconditions.length === 6 &&
          blockers.length === 10 &&
          missingOrInvalidPick === "truthful body-only fallback"
      )
    ).toBe(true);
  });

  it("keeps the collector grammar and promotion prerequisites bounded", () => {
    expect(
      COLLECTORS.every(
        ([kinds, reference, policy, durable, guard, consumes]) =>
          kinds.length > 0 &&
          durable.length > 0 &&
          guard.length > 0 &&
          consumes.length > 0 &&
          (reference.length > 0 || policy.length > 0)
      )
    ).toBe(true);
    expect(new Set(COLLECTORS.flatMap(([, reference]) => reference)).size).toBe(
      11
    );
    expect(HANDOFF.outcomes).toHaveLength(11);
    expect(HANDOFF.promotable.kinds).toEqual(["body", "face", "edge"]);
    expect(HANDOFF.promotable.requires).toHaveLength(4);
    expect(HANDOFF.vertex).toContain("never creates an anchor");
  });

  it("freezes exhaustive preview, measurement, query, and interaction fixtures", () => {
    const featureKinds = new Set(
      Object.values(V21_EXACT_BODY_SOURCE_POLICY).map(
        ({ featureKind }) => featureKind
      )
    );
    expect(
      Object.keys(PREVIEW_GRIPS).every((kind) =>
        featureKinds.has(kind as CadFeatureSummary["kind"])
      )
    ).toBe(true);
    expect(Object.keys(PREVIEW_GRIPS)).toHaveLength(featureKinds.size);
    expect(Object.keys(MEASUREMENTS.single)).toEqual(SELECTABLE_KINDS);
    expect(
      Object.values(MEASUREMENTS.pair).every(
        (row) => Object.keys(row).length === SELECTABLE_KINDS.length
      )
    ).toBe(true);
    expect(
      Object.values(MEASUREMENTS.pair).flatMap((row) =>
        Object.values(row).filter(
          (values) => Array.isArray(values) && values.includes(A)
        )
      )
    ).toHaveLength(2);
    expect(MEASUREMENTS.rules).toHaveLength(5);
    expect(QUERY_SEAM.alternatives).toHaveLength(2);
    expect(QUERY_SEAM.evidence).toHaveLength(6);
    expect(new Set(QUERY_SEAM.rejectedEvidenceFields).size).toBe(
      QUERY_SEAM.rejectedEvidenceFields.length
    );
    expect(
      QUERY_SEAM.grandfatheredPrivateViewportInputs.every((field) =>
        QUERY_SEAM.rejectedEvidenceFields.includes(field)
      )
    ).toBe(true);
    expect(QUERY_SEAM.outcomes).toContain("unsupported");
    expect(
      Object.values(LIMITS)
        .filter((value) => typeof value === "number")
        .every(Number.isSafeInteger)
    ).toBe(true);
    expect(INTERACTION).toHaveLength(3);
  });

  it("reuses the V21.1 downstream body policy without widening it", () => {
    expect(CAD_DOWNSTREAM_BODY_OPERATIONS).toEqual([
      "holeTarget",
      "patternSeed",
      "mirrorSeed",
      "shellTarget"
    ]);
    for (const source of Object.keys(SELECTION) as CadBodySource["type"][]) {
      expect(CAD_DOWNSTREAM_BODY_POLICY[source]).toEqual({
        holeTarget: "singleShapeOneOrMoreSolids",
        patternSeed: "singleShapeOneOrMoreSolids",
        mirrorSeed: "singleShapeOneOrMoreSolids",
        shellTarget: "singleSolid"
      });
    }
  });
});

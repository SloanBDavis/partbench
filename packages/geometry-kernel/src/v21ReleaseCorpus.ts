import type {
  ExactBodyArtifactShapePolicy,
  ExactBodyArtifactSource
} from "./kernel";

export interface V21ExactReleaseCorpusEntry {
  readonly id: string;
  readonly bodyName: string;
  readonly sourceType: string;
  readonly source: ExactBodyArtifactSource;
  readonly sourceGraphNodeCount: number;
  readonly shapePolicy: ExactBodyArtifactShapePolicy;
  readonly expectedSourceKind: string;
  readonly expectedSolidCountMinimum: number;
}

const transform = {
  translation: [1, 2, 3] as const,
  rotation: [5, 10, 15] as const,
  scale: [1, 1, 1] as const
};
const rectangle = {
  sketchPlane: "XY" as const,
  profile: {
    kind: "rectangle" as const,
    center: [0, 0] as const,
    width: 4,
    height: 4
  },
  depth: 4,
  side: "positive" as const
};
const booleanTool = {
  ...rectangle,
  profile: { ...rectangle.profile, center: [1.5, 0] as const, width: 2 }
};
const mixedWireProfile = {
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
      sourceEntityId: "line-bottom",
      start: [-2, -1] as const,
      end: [2, -1] as const
    },
    {
      kind: "arc" as const,
      sourceEntityId: "arc-right",
      center: [2, 0] as const,
      radius: 1,
      startAngleDegrees: 270,
      sweepAngleDegrees: 180
    },
    {
      kind: "line" as const,
      sourceEntityId: "line-top",
      start: [2, 1] as const,
      end: [-2, 1] as const
    },
    {
      kind: "arc" as const,
      sourceEntityId: "arc-left",
      center: [-2, 0] as const,
      radius: 1,
      startAngleDegrees: 90,
      sweepAngleDegrees: 180
    }
  ],
  sourceIdentity: "v21-release-slot:line-bottom,arc-right,line-top,arc-left",
  geometryPolicy: {
    linearTolerance: 1e-7 as const,
    angularToleranceDegrees: 0.1 as const,
    minimumProfileArea: 1e-12 as const
  }
};
const translatedWireProfile = {
  ...mixedWireProfile,
  sourceIdentity: "v21-release-translated-slot",
  segments: mixedWireProfile.segments.map((segment) =>
    segment.kind === "line"
      ? {
          ...segment,
          start: [segment.start[0] + 4, segment.start[1]] as const,
          end: [segment.end[0] + 4, segment.end[1]] as const
        }
      : {
          ...segment,
          center: [segment.center[0] + 4, segment.center[1]] as const
        }
  )
};
const patternSeed = { kind: "extrude" as const, ...rectangle };
const sweepProfile = {
  sketchPlane: "XY" as const,
  profile: {
    kind: "circle" as const,
    center: [0, 0] as const,
    radius: 0.2
  }
};

function entry(
  input: Omit<
    V21ExactReleaseCorpusEntry,
    "shapePolicy" | "expectedSolidCountMinimum"
  > &
    Partial<
      Pick<
        V21ExactReleaseCorpusEntry,
        "shapePolicy" | "expectedSolidCountMinimum"
      >
    >
): V21ExactReleaseCorpusEntry {
  return {
    shapePolicy: "singleSolid",
    expectedSolidCountMinimum: 1,
    ...input
  };
}

export const V21_EXACT_RELEASE_CORPUS = [
  ...(
    [
      {
        id: "primitive-box",
        bodyName: "Duplicate Ω",
        source: {
          kind: "box" as const,
          dimensions: { width: 2, height: 3, depth: 4 },
          transform
        }
      },
      {
        id: "primitive-cylinder",
        bodyName: "Duplicate Ω",
        source: {
          kind: "cylinder" as const,
          dimensions: { radius: 1, height: 4 },
          transform
        }
      },
      {
        id: "primitive-sphere",
        bodyName: "球体",
        source: {
          kind: "sphere" as const,
          dimensions: { radius: 2 },
          transform
        }
      },
      {
        id: "primitive-cone",
        bodyName: "Cone",
        source: {
          kind: "cone" as const,
          dimensions: { radius: 2, height: 4 },
          transform
        }
      },
      {
        id: "primitive-torus",
        bodyName: "Torus",
        source: {
          kind: "torus" as const,
          dimensions: { majorRadius: 3, minorRadius: 1 },
          transform
        }
      }
    ] as const
  ).map(({ id, bodyName, source }) =>
    entry({
      id,
      bodyName,
      sourceType: "primitiveFeature",
      source,
      sourceGraphNodeCount: 1,
      expectedSourceKind: source.kind
    })
  ),
  entry({
    id: "extrude-entity",
    bodyName: "Entity extrude",
    sourceType: "sketchExtrudeFeature",
    source: { kind: "extrude", ...rectangle },
    sourceGraphNodeCount: 1,
    expectedSourceKind: "extrude"
  }),
  entry({
    id: "extrude-wire",
    bodyName: "Wire arcs Ω",
    sourceType: "sketchExtrudeFeature",
    source: {
      kind: "extrude",
      sketchPlane: "XY",
      profile: mixedWireProfile,
      depth: 4,
      side: "positive"
    },
    sourceGraphNodeCount: 1,
    expectedSourceKind: "extrude"
  }),
  entry({
    id: "extrude-region",
    bodyName: "Region with hole",
    sourceType: "sketchExtrudeFeature",
    source: {
      kind: "booleanExtrudes",
      operation: "cut",
      materialPolicy: "regionPositiveVolumeSingleSolid",
      target: rectangle,
      tool: {
        ...rectangle,
        profile: { kind: "circle", center: [0, 0], radius: 0.5 }
      }
    },
    sourceGraphNodeCount: 3,
    expectedSourceKind: "booleanExtrudes"
  }),
  ...(["add", "cut"] as const).map((operation) =>
    entry({
      id: `boolean-${operation}`,
      bodyName: `Boolean ${operation}`,
      sourceType: "sketchExtrudeFeature",
      source: {
        kind: "booleanExtrudes",
        operation,
        target: rectangle,
        tool: booleanTool
      },
      sourceGraphNodeCount: 3,
      expectedSourceKind: "booleanExtrudes"
    })
  ),
  entry({
    id: "revolve-entity",
    bodyName: "Entity revolve",
    sourceType: "sketchRevolveFeature",
    source: {
      kind: "revolve",
      sketchPlane: "XY",
      profile: { kind: "rectangle", center: [2, 0], width: 1, height: 3 },
      axis: { start: [0, -2], end: [0, 2] },
      angleDegrees: 360
    },
    sourceGraphNodeCount: 1,
    expectedSourceKind: "revolve"
  }),
  entry({
    id: "revolve-wire",
    bodyName: "Wire revolve",
    sourceType: "sketchRevolveFeature",
    source: {
      kind: "revolve",
      sketchPlane: "XY",
      profile: {
        kind: "region",
        frame: mixedWireProfile.frame,
        outer: translatedWireProfile,
        holes: [],
        sourceIdentity: "v21-release-wire-revolve-region",
        geometryPolicy: mixedWireProfile.geometryPolicy
      },
      axis: { start: [0, -5], end: [0, 5] },
      angleDegrees: 360
    },
    sourceGraphNodeCount: 1,
    expectedSourceKind: "revolve"
  }),
  entry({
    id: "revolve-region",
    bodyName: "Region revolve",
    sourceType: "sketchRevolveFeature",
    source: {
      kind: "revolve",
      sketchPlane: "XY",
      profile: {
        kind: "region",
        frame: mixedWireProfile.frame,
        outer: { kind: "rectangle", center: [4, 0], width: 2, height: 4 },
        holes: [{ kind: "circle", center: [4, 0], radius: 0.5 }],
        sourceIdentity: "v21-release-region-revolve",
        geometryPolicy: mixedWireProfile.geometryPolicy
      },
      axis: { start: [0, -5], end: [0, 5] },
      angleDegrees: 360
    },
    sourceGraphNodeCount: 1,
    expectedSourceKind: "revolve"
  }),
  entry({
    id: "hole-blind",
    bodyName: "Blind hole",
    sourceType: "sketchHoleFeature",
    source: {
      kind: "hole",
      target: rectangle,
      tool: {
        sketchPlane: "XY",
        circle: { kind: "circle", center: [0, 0], radius: 0.5 },
        depthMode: "blind",
        depth: 2,
        direction: "positive"
      }
    },
    sourceGraphNodeCount: 2,
    expectedSourceKind: "hole"
  }),
  entry({
    id: "edge-chamfer",
    bodyName: "Chamfer",
    sourceType: "edgeChamferFeature",
    source: {
      kind: "edgeFinish",
      operation: "chamfer",
      target: rectangle,
      edgeStableId: "generated:edge:body:1:start:uMin",
      distance: 0.2
    },
    sourceGraphNodeCount: 2,
    expectedSourceKind: "edgeFinish"
  }),
  entry({
    id: "edge-fillet",
    bodyName: "Fillet",
    sourceType: "edgeFilletFeature",
    source: {
      kind: "edgeFinish",
      operation: "fillet",
      target: rectangle,
      edgeStableId: "generated:edge:body:1:longitudinal:uMax:vMax",
      radius: 0.2
    },
    sourceGraphNodeCount: 2,
    expectedSourceKind: "edgeFinish"
  }),
  entry({
    id: "pattern-linear",
    bodyName: "Linear pattern",
    sourceType: "linearPatternFeature",
    source: {
      kind: "linearPattern",
      seed: patternSeed,
      direction: [1, 0, 0],
      spacing: 6,
      instanceCount: 3
    },
    sourceGraphNodeCount: 2,
    shapePolicy: "singleShapeOneOrMoreSolids",
    expectedSourceKind: "linearPattern",
    expectedSolidCountMinimum: 3
  }),
  entry({
    id: "pattern-circular",
    bodyName: "Circular pattern",
    sourceType: "circularPatternFeature",
    source: {
      kind: "circularPattern",
      seed: {
        ...patternSeed,
        profile: { ...rectangle.profile, center: [5, 0] }
      },
      axis: { origin: [0, 0, 0], direction: [0, 0, 1] },
      totalAngleDegrees: 360,
      instanceCount: 4
    },
    sourceGraphNodeCount: 2,
    shapePolicy: "singleShapeOneOrMoreSolids",
    expectedSourceKind: "circularPattern",
    expectedSolidCountMinimum: 4
  }),
  entry({
    id: "mirror",
    bodyName: "Mirror",
    sourceType: "mirrorFeature",
    source: {
      kind: "mirror",
      seed: {
        ...patternSeed,
        profile: { ...rectangle.profile, center: [2, 0] }
      },
      plane: { point: [0, 0, 0], normal: [1, 0, 0] },
      includeOriginal: false
    },
    sourceGraphNodeCount: 2,
    expectedSourceKind: "mirror"
  }),
  entry({
    id: "shell",
    bodyName: "Shell",
    sourceType: "shellFeature",
    source: {
      kind: "shell",
      target: patternSeed,
      wallThickness: 0.2,
      openFaceStableIds: ["generated:face:body:endCap"]
    },
    sourceGraphNodeCount: 2,
    expectedSourceKind: "shell"
  }),
  ...(
    [
      {
        id: "sweep-line",
        bodyName: "Line sweep",
        pathSegments: [{ start: [0, 0, 0], end: [0, 0, 5] }]
      },
      {
        id: "sweep-arc",
        bodyName: "Arc sweep",
        pathSegments: [
          {
            kind: "arc" as const,
            start: [10, 20, 30] as const,
            end: [15, 20, 35] as const,
            center: [15, 20, 30] as const,
            normal: [0, 1, 0] as const,
            sweepAngleDegrees: 90
          }
        ]
      },
      {
        id: "sweep-g1",
        bodyName: "G1 sweep",
        pathSegments: [
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
        ]
      }
    ] as const
  ).map(({ id, bodyName, pathSegments }) =>
    entry({
      id,
      bodyName,
      sourceType: "sweepFeature",
      source: {
        kind: "sweep",
        profile:
          id === "sweep-arc"
            ? {
                ...sweepProfile,
                placementFrame: {
                  origin: [10, 20, 30],
                  uAxis: [1, 0, 0],
                  vAxis: [0, 1, 0]
                }
              }
            : sweepProfile,
        pathSegments
      },
      sourceGraphNodeCount: 1,
      expectedSourceKind: "sweep"
    })
  ),
  entry({
    id: "loft",
    bodyName: "Loft Ω",
    sourceType: "loftFeature",
    source: {
      kind: "loft",
      sections: [
        {
          sketchPlane: "XY",
          profile: {
            kind: "rectangle",
            center: [0, 0],
            width: 4,
            height: 3
          }
        },
        {
          sketchPlane: "XY",
          profile: { kind: "circle", center: [0, 0], radius: 1 },
          placementFrame: {
            origin: [0, 0, 5],
            uAxis: [1, 0, 0],
            vAxis: [0, 1, 0]
          }
        }
      ]
    },
    sourceGraphNodeCount: 1,
    expectedSourceKind: "loft"
  })
] as const satisfies readonly V21ExactReleaseCorpusEntry[];

export const V21_EXACT_RELEASE_PRIMITIVES = V21_EXACT_RELEASE_CORPUS.slice(
  0,
  5
);

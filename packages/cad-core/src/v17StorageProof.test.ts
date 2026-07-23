import { describe, expect, it } from "vitest";

import {
  CAD_PROJECT_FORMAT_VERSION_V18,
  CAD_PROJECT_FORMAT_VERSION_V20,
  CAD_PROJECT_FORMAT_VERSION_V21,
  CURRENT_CAD_PROJECT_FORMAT_VERSION,
  CadEngine,
  CadProjectImportError,
  createCadProjectSourceIdentity,
  createEmptyTopologyIdentitySourceSnapshot,
  createWcadV2CheckpointEntryPaths,
  encodeWcadCanonicalCbor,
  exportCadProject,
  exportCadProjectToWcad,
  importCadProject,
  parseCadProjectJson,
  readCadProjectWcad,
  type CadProject
} from "./index";

const textEncoder = new TextEncoder();

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type MutableFixtureRecord = Record<string, unknown>;

interface MutableReferenceFixture extends MutableFixtureRecord {
  segments: MutableFixtureRecord[];
}

interface MutableSectionFixture extends MutableFixtureRecord {
  profile: MutableReferenceFixture;
}

interface MutableFeatureFixture extends MutableFixtureRecord {
  profile: MutableReferenceFixture;
  path: MutableReferenceFixture;
  sections: MutableSectionFixture[];
  axis: MutableFixtureRecord;
}

interface MutableSketchFixture extends MutableFixtureRecord {
  entities: MutableFixtureRecord[];
  attachment: MutableFixtureRecord;
}

interface MutableDocumentFixture extends MutableFixtureRecord {
  sketches: MutableSketchFixture[];
  features: MutableFeatureFixture[];
  parameters: MutableFixtureRecord[];
  sketchDimensions: MutableFixtureRecord[];
  sketchConstraints: MutableFixtureRecord[];
}

interface MutableProjectFixture extends MutableFixtureRecord {
  document: MutableDocumentFixture;
}

function mutableProjectFixture(project: CadProject): MutableProjectFixture {
  return project as unknown as MutableProjectFixture;
}

function fixtureAt<T>(
  values: readonly T[],
  index: number,
  collection: string
): T {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`Missing ${collection} fixture at index ${index}.`);
  }
  return value;
}

function omitFixtureFields(
  value: object,
  fields: readonly string[]
): MutableFixtureRecord {
  const copy = { ...(value as unknown as MutableFixtureRecord) };
  for (const field of fields) delete copy[field];
  return copy;
}

function findSketchEntityFixture(
  project: MutableProjectFixture,
  sketchIndex: number,
  entityId: string
): MutableFixtureRecord {
  const entity = project.document.sketches[sketchIndex]?.entities.find(
    (candidate) => candidate.id === entityId
  );
  if (!entity) throw new Error(`Missing sketch entity fixture: ${entityId}.`);
  return entity;
}

function createEmptyProject(): CadProject {
  return exportCadProject(new CadEngine());
}

type HistoricalDocumentFragment = Record<string, unknown>;

function historicalSketch(
  id: string,
  entities: readonly HistoricalDocumentFragment[],
  extras: HistoricalDocumentFragment = {}
): HistoricalDocumentFragment {
  return { id, name: id, plane: "XY", entities, ...extras };
}

function historicalProject(
  version: number,
  fragment: HistoricalDocumentFragment
): CadProject {
  const document: HistoricalDocumentFragment = {
    units: "mm",
    objects: [],
    nextObjectNumber: 1
  };
  if (version >= 2) {
    Object.assign(document, {
      sketches: [],
      nextSketchNumber: 1,
      nextSketchEntityNumber: 1
    });
  }
  if (version >= 3) {
    Object.assign(document, {
      features: [],
      nextFeatureNumber: 1,
      nextBodyNumber: 1
    });
  }
  if (version >= 5) document.namedReferences = [];
  if (version >= 7) {
    Object.assign(document, {
      parameters: [],
      sketchDimensions: [],
      nextParameterNumber: 1,
      nextSketchDimensionNumber: 1
    });
  }
  if (version >= 8) {
    Object.assign(document, {
      sketchConstraints: [],
      nextSketchConstraintNumber: 1
    });
  }
  return {
    schemaVersion: `web-cad.project.v${version}`,
    document: { ...document, ...fragment },
    history: [],
    redoStack: []
  } as unknown as CadProject;
}

const BASE_RECTANGLE_SKETCH = historicalSketch("base_sketch", [
  {
    id: "base_rect",
    kind: "rectangle",
    center: [0, 0],
    width: 4,
    height: 3
  }
]);

const BASE_EXTRUDE_V3 = {
  id: "base_extrude",
  kind: "extrude",
  sketchId: "base_sketch",
  entityId: "base_rect",
  profileKind: "rectangle",
  depth: 3,
  bodyId: "base_body"
} as const;

function historicalConstraintProject(version: number): CadProject {
  const constraints: Record<number, HistoricalDocumentFragment> = {
    8: { kind: "horizontal", entityId: "line_1" },
    9: {
      kind: "fixed",
      entityId: "point_1",
      target: { entityId: "point_1", role: "position" },
      coordinate: [1, 0]
    },
    10: {
      kind: "coincident",
      entityId: "point_1",
      primaryTarget: { entityId: "point_1", role: "position" },
      secondaryTarget: { entityId: "line_1", role: "start" }
    },
    11: {
      kind: "midpoint",
      entityId: "line_1",
      lineEntityId: "line_1",
      target: { entityId: "point_1", role: "position" }
    },
    12: {
      kind: "parallel",
      entityId: "line_2",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2"
    },
    13: {
      kind: "perpendicular",
      entityId: "line_2",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2"
    }
  };
  const secondLine =
    version === 12
      ? { id: "line_2", kind: "line", start: [0, 1], end: [2, 1] }
      : { id: "line_2", kind: "line", start: [0, 0], end: [0, 2] };
  return historicalProject(version, {
    sketches: [
      historicalSketch("constraint_sketch", [
        { id: "line_1", kind: "line", start: [0, 0], end: [2, 0] },
        secondLine,
        {
          id: "point_1",
          kind: "point",
          point: version === 10 ? [0, 0] : [1, 0]
        }
      ])
    ],
    sketchConstraints: [
      {
        id: `constraint_v${version}`,
        name: `V${version} constraint`,
        sketchId: "constraint_sketch",
        ...constraints[version]
      }
    ]
  });
}

function createMigrationCorpus(): readonly {
  readonly version: number;
  readonly marker: string;
  readonly project: CadProject;
}[] {
  const fixture = (
    version: number,
    marker: string,
    fragment: HistoricalDocumentFragment
  ) => ({
    version,
    marker,
    project: historicalProject(version, fragment)
  });
  return [
    fixture(1, "object", {
      objects: [
        {
          id: "v1_box",
          kind: "box",
          dimensions: { width: 1, height: 2, depth: 3 },
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          }
        }
      ]
    }),
    fixture(2, "sketch", {
      sketches: [
        historicalSketch("v2_sketch", [
          { id: "v2_point", kind: "point", point: [1, 2] }
        ])
      ]
    }),
    fixture(3, "extrude defaults", {
      sketches: [BASE_RECTANGLE_SKETCH],
      features: [BASE_EXTRUDE_V3]
    }),
    fixture(4, "generated-face attachment", {
      sketches: [
        BASE_RECTANGLE_SKETCH,
        historicalSketch("v4_attached", [], {
          attachment: {
            kind: "generatedFace",
            bodyId: "base_body",
            faceStableId: "generated:face:base_body:endCap",
            sourceFeatureId: "base_extrude",
            sourceSketchId: "base_sketch",
            sourceSketchEntityId: "base_rect",
            faceRole: "endCap"
          }
        })
      ],
      features: [BASE_EXTRUDE_V3]
    }),
    fixture(5, "named reference", {
      sketches: [BASE_RECTANGLE_SKETCH],
      features: [BASE_EXTRUDE_V3],
      namedReferences: [
        {
          name: "V5 top",
          bodyId: "base_body",
          stableId: "generated:face:base_body:endCap",
          kind: "face"
        }
      ]
    }),
    fixture(6, "named reference clone", {
      sketches: [BASE_RECTANGLE_SKETCH],
      features: [BASE_EXTRUDE_V3],
      namedReferences: [
        {
          name: "V5 top",
          bodyId: "base_body",
          stableId: "generated:face:base_body:endCap",
          kind: "face"
        }
      ]
    }),
    fixture(7, "parameter dimension", {
      sketches: [
        historicalSketch("v7_sketch", [
          {
            id: "v7_rect",
            kind: "rectangle",
            center: [0, 0],
            width: 2,
            height: 1
          }
        ])
      ],
      parameters: [{ id: "v7_parameter", name: "Width", value: 2 }],
      sketchDimensions: [
        {
          id: "v7_dimension",
          name: "Width",
          sketchId: "v7_sketch",
          entityId: "v7_rect",
          target: { entityKind: "rectangle", role: "width" },
          valueSource: { type: "parameter", parameterId: "v7_parameter" }
        }
      ]
    }),
    ...[8, 9, 10, 11, 12, 13].map((version) => ({
      version,
      marker: `constraint v${version}`,
      project: historicalConstraintProject(version)
    })),
    fixture(14, "revolve default", {
      sketches: [
        historicalSketch("v14_sketch", [
          {
            id: "v14_rect",
            kind: "rectangle",
            center: [2, 0],
            width: 1,
            height: 2
          },
          { id: "v14_axis", kind: "line", start: [0, -2], end: [0, 2] }
        ])
      ],
      features: [
        {
          id: "v14_revolve",
          kind: "revolve",
          sketchId: "v14_sketch",
          entityId: "v14_rect",
          profileKind: "rectangle",
          axis: {
            type: "sketchLine",
            sketchId: "v14_sketch",
            entityId: "v14_axis"
          },
          angleDegrees: 180,
          bodyId: "v14_body"
        }
      ]
    }),
    fixture(15, "hole union", {
      sketches: [
        BASE_RECTANGLE_SKETCH,
        historicalSketch("v15_hole_sketch", [
          {
            id: "v15_circle",
            kind: "circle",
            center: [0, 0],
            radius: 0.5
          }
        ])
      ],
      features: [
        BASE_EXTRUDE_V3,
        {
          id: "v15_hole",
          kind: "hole",
          targetBodyId: "base_body",
          sketchId: "v15_hole_sketch",
          circleEntityId: "v15_circle",
          depthMode: "blind",
          depth: 1,
          direction: "negative",
          bodyId: "v15_body"
        }
      ]
    }),
    fixture(16, "chamfer", {
      sketches: [BASE_RECTANGLE_SKETCH],
      features: [
        BASE_EXTRUDE_V3,
        {
          id: "v16_chamfer",
          kind: "chamfer",
          targetBodyId: "base_body",
          edgeStableId: "generated:edge:base_body:start:uMin",
          distance: 0.2,
          bodyId: "v16_body"
        }
      ]
    }),
    fixture(17, "advanced constraint", {
      sketches: [
        historicalSketch("v17_sketch", [
          { id: "v17_line", kind: "line", start: [-2, 0], end: [2, 0] },
          {
            id: "v17_circle",
            kind: "circle",
            center: [0, 1],
            radius: 1
          }
        ])
      ],
      sketchConstraints: [
        {
          id: "v17_tangent",
          name: "Tangent",
          sketchId: "v17_sketch",
          entityId: "v17_circle",
          kind: "tangent",
          primaryTarget: { entityId: "v17_line", entityKind: "line" },
          secondaryTarget: { entityId: "v17_circle", entityKind: "circle" }
        }
      ]
    }),
    fixture(18, "topology identity", {
      sketches: [BASE_RECTANGLE_SKETCH],
      features: [BASE_EXTRUDE_V3],
      topologyIdentity: {
        schemaVersion: "web-cad.project.v18",
        settings: {
          contractVersion: "partbench.topology-identity.v1",
          matchingPolicy: "evidence-scored-explicit-repair",
          checkpointPolicy: "required-for-topology-anchors",
          minimumAutomaticConfidence: "high",
          allowSilentRetargeting: false
        },
        checkpoints: [],
        anchors: [],
        repairs: []
      }
    }),
    fixture(19, "pattern mirror shell expression", {
      sketches: [BASE_RECTANGLE_SKETCH],
      features: [
        BASE_EXTRUDE_V3,
        {
          id: "v19_pattern",
          kind: "linearPattern",
          seedBodyId: "base_body",
          axis: "x",
          spacing: 6,
          instanceCount: 3,
          bodyId: "v19_pattern_body"
        },
        {
          id: "v19_mirror",
          kind: "mirror",
          seedBodyId: "v19_pattern_body",
          mirrorPlane: "YZ",
          includeOriginal: true,
          bodyId: "v19_mirror_body"
        },
        {
          id: "v19_shell",
          kind: "shell",
          targetBodyId: "v19_mirror_body",
          wallThickness: 0.25,
          openFaceRefs: [],
          bodyId: "v19_shell_body"
        }
      ],
      parameters: [
        {
          id: "v19_parameter",
          name: "Pitch",
          value: 6,
          expression: "2 * 3"
        }
      ]
    }),
    fixture(20, "legacy profile consumers", {
      sketches: [
        historicalSketch("v20_profile", [
          {
            id: "v20_rect",
            kind: "rectangle",
            center: [2, 0],
            width: 2,
            height: 1
          },
          {
            id: "v20_circle",
            kind: "circle",
            center: [0, 0],
            radius: 1
          },
          { id: "v20_axis", kind: "line", start: [0, -2], end: [0, 2] }
        ]),
        historicalSketch(
          "v20_path",
          [
            {
              id: "v20_path_line",
              kind: "line",
              start: [0, 0],
              end: [0, 5]
            }
          ],
          { plane: "XZ" }
        ),
        historicalSketch("v20_loft", [
          {
            id: "v20_loft_circle",
            kind: "circle",
            center: [0, 0],
            radius: 2
          }
        ])
      ],
      features: [
        {
          id: "v20_extrude",
          kind: "extrude",
          sketchId: "v20_profile",
          entityId: "v20_rect",
          profileKind: "rectangle",
          depth: 2,
          side: "negative",
          bodyId: "v20_extrude_body"
        },
        {
          id: "v20_revolve",
          kind: "revolve",
          sketchId: "v20_profile",
          entityId: "v20_rect",
          profileKind: "rectangle",
          axis: {
            type: "sketchLine",
            sketchId: "v20_profile",
            entityId: "v20_axis"
          },
          angleDegrees: 180,
          bodyId: "v20_revolve_body"
        },
        {
          id: "v20_sweep",
          kind: "sweep",
          profileSketchId: "v20_profile",
          profileEntityId: "v20_circle",
          pathSketchId: "v20_path",
          pathEntityIds: ["v20_path_line"],
          bodyId: "v20_sweep_body"
        },
        {
          id: "v20_loft_feature",
          kind: "loft",
          sections: [
            { sketchId: "v20_profile", entityId: "v20_circle" },
            { sketchId: "v20_loft", entityId: "v20_loft_circle" }
          ],
          bodyId: "v20_loft_body"
        }
      ]
    })
  ];
}

function entity(
  id: string,
  kind: "line" | "rectangle" | "circle",
  values: Record<string, unknown>
): Record<string, unknown> {
  return { id, kind, ...values, construction: false };
}

function sketch(
  id: string,
  entities: readonly Record<string, unknown>[],
  plane: "XY" | "XZ" | "YZ" = "XY"
): Record<string, unknown> {
  return { id, name: id, plane, entities };
}

function createNormalizedV21Project(): CadProject {
  const empty = createEmptyProject();
  return {
    ...empty,
    schemaVersion: CAD_PROJECT_FORMAT_VERSION_V21,
    document: {
      ...empty.document,
      sketches: [
        sketch("profiles", [
          entity("rect", "rectangle", {
            center: [0, 0],
            width: 4,
            height: 3
          }),
          entity("circle_a", "circle", { center: [0, 0], radius: 1 }),
          entity("circle_b", "circle", { center: [2, 0], radius: 1 }),
          entity("circle_c", "circle", { center: [4, 0], radius: 1 }),
          entity("circle_d", "circle", { center: [6, 0], radius: 1 }),
          entity("axis", "line", { start: [0, -3], end: [0, 3] })
        ]) as never,
        sketch(
          "path",
          [entity("path_1", "line", { start: [0, 0], end: [0, 5] })],
          "XZ"
        ) as never,
        sketch("loft_a", [
          entity("loft_rect_a", "rectangle", {
            center: [0, 0],
            width: 2,
            height: 2
          })
        ]) as never,
        sketch("loft_b", [
          entity("loft_rect_b", "rectangle", {
            center: [0, 0],
            width: 3,
            height: 3
          })
        ]) as never
      ],
      sketchConstraints: [
        {
          id: "concentric_1",
          name: "Concentric circles",
          sketchId: "profiles",
          entityId: "circle_b",
          kind: "concentric",
          primaryTarget: { entityId: "circle_a", entityKind: "circle" },
          secondaryTarget: { entityId: "circle_b", entityKind: "circle" }
        },
        {
          id: "equal_radius_1",
          name: "Equal circle radii",
          sketchId: "profiles",
          entityId: "circle_d",
          kind: "equalRadius",
          primaryTarget: { entityId: "circle_c", entityKind: "circle" },
          secondaryTarget: { entityId: "circle_d", entityKind: "circle" }
        }
      ] as never,
      features: [
        {
          id: "extrude_1",
          kind: "extrude",
          profile: { kind: "entity", sketchId: "profiles", entityId: "rect" },
          operationMode: "newBody",
          depth: 4,
          side: "positive",
          bodyId: "body_extrude"
        },
        {
          id: "revolve_1",
          kind: "revolve",
          profile: {
            kind: "entity",
            sketchId: "profiles",
            entityId: "circle_a"
          },
          axis: { type: "sketchLine", sketchId: "profiles", entityId: "axis" },
          angleDegrees: 180,
          operationMode: "newBody",
          bodyId: "body_revolve"
        },
        {
          id: "sweep_1",
          kind: "sweep",
          profile: {
            kind: "entity",
            sketchId: "profiles",
            entityId: "circle_b"
          },
          path: {
            kind: "entity",
            sketchId: "path",
            entityId: "path_1",
            orientation: "forward"
          },
          bodyId: "body_sweep"
        },
        {
          id: "loft_1",
          kind: "loft",
          sections: [
            {
              profile: {
                kind: "entity",
                sketchId: "loft_a",
                entityId: "loft_rect_a"
              }
            },
            {
              profile: {
                kind: "entity",
                sketchId: "loft_b",
                entityId: "loft_rect_b"
              }
            }
          ],
          bodyId: "body_loft"
        }
      ] as never
    }
  };
}

function createOrderedWireAndChainProject(): CadProject {
  const project = mutableProjectFixture(clone(createNormalizedV21Project()));
  fixtureAt(project.document.sketches, 1, "sketch").entities.push(
    entity("path_2", "line", { start: [0, 5], end: [5, 5] })
  );
  fixtureAt(project.document.features, 0, "feature").profile = {
    kind: "wire",
    sketchId: "path",
    segments: [
      { entityId: "path_1", orientation: "forward" },
      { entityId: "path_2", orientation: "reverse" }
    ]
  };
  fixtureAt(project.document.features, 2, "feature").path = {
    kind: "chain",
    sketchId: "path",
    segments: [
      { entityId: "path_1", orientation: "forward" },
      { entityId: "path_2", orientation: "forward" }
    ]
  };
  return project as unknown as CadProject;
}

function expectV21Issue(project: unknown, path: string): void {
  try {
    parseCadProjectJson(JSON.stringify(project));
    throw new Error(`Expected V21 source rejection at ${path}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(CadProjectImportError);
    expect((error as CadProjectImportError).issues).toContainEqual(
      expect.objectContaining({ code: "SCHEMA_V21_SOURCE_INVALID", path })
    );
  }
}

function expectProjectIssue(
  project: unknown,
  code: string,
  path: string
): void {
  try {
    parseCadProjectJson(JSON.stringify(project));
    throw new Error(`Expected ${code} at ${path}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(CadProjectImportError);
    expect((error as CadProjectImportError).issues).toContainEqual(
      expect.objectContaining({ code, path })
    );
  }
}

describe("V17 V21 storage proof", () => {
  it("preserves committed history, redo, and historical op payloads through JSON and WCAD", async () => {
    const engine = new CadEngine();
    engine.apply({
      op: "scene.createBox",
      id: "box_1",
      name: "Legacy V1 box",
      dimensions: { width: 1, height: 2, depth: 3 }
    });
    engine.apply({
      op: "sketch.create",
      id: "sketch_1",
      name: "V2 sketch",
      plane: "XY"
    });
    engine.apply({
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "rect_1",
      center: [0, 0],
      width: 4,
      height: 2
    });
    engine.apply({
      op: "feature.extrude",
      id: "legacy_extrude_committed",
      bodyId: "legacy_body_committed",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 3,
      side: "symmetric",
      operationMode: "newBody"
    });
    engine.apply({
      op: "feature.extrude",
      id: "legacy_extrude_redo",
      bodyId: "legacy_body_redo",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 5,
      side: "negative",
      operationMode: "newBody"
    });
    engine.undo();

    const legacy = exportCadProject(engine);
    const source: CadProject = {
      ...legacy,
      schemaVersion: CAD_PROJECT_FORMAT_VERSION_V21,
      document: {
        ...legacy.document,
        sketches: legacy.document.sketches.map((entry) => ({
          ...entry,
          entities: entry.entities.map((item) => ({
            ...item,
            construction: false
          }))
        })) as never,
        features: legacy.document.features.map((feature) => {
          const record = feature as unknown as MutableFixtureRecord;
          const rest = omitFixtureFields(feature, [
            "sketchId",
            "entityId",
            "profileKind"
          ]);
          return {
            ...rest,
            profile: {
              kind: "entity",
              sketchId: record.sketchId,
              entityId: record.entityId
            }
          };
        }) as never
      }
    };
    const expectedOps = {
      history: source.history.map((transaction) => transaction.ops),
      redo: source.redoStack.map((transaction) => transaction.ops)
    };
    const json = parseCadProjectJson(JSON.stringify(source));

    expect(json.history).toHaveLength(4);
    expect(json.redoStack).toHaveLength(1);
    expect({
      history: json.history.map((transaction) => transaction.ops),
      redo: json.redoStack.map((transaction) => transaction.ops)
    }).toEqual(expectedOps);
    const committedLegacyOp = json.history
      .flatMap((transaction) => transaction.ops)
      .find((op) => op.op === "feature.extrude");
    const redoLegacyOp = json.redoStack[0]?.ops[0];
    expect(committedLegacyOp).toEqual({
      op: "feature.extrude",
      id: "legacy_extrude_committed",
      bodyId: "legacy_body_committed",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 3,
      side: "symmetric",
      operationMode: "newBody"
    });
    expect(redoLegacyOp).toEqual({
      op: "feature.extrude",
      id: "legacy_extrude_redo",
      bodyId: "legacy_body_redo",
      sketchId: "sketch_1",
      entityId: "rect_1",
      depth: 5,
      side: "negative",
      operationMode: "newBody"
    });
    expect(committedLegacyOp).not.toHaveProperty("profile");
    expect(redoLegacyOp).not.toHaveProperty("profile");
    const jsonEngine = importCadProject(json);
    jsonEngine.redo();
    expect(
      jsonEngine.getDocument().features.get("legacy_extrude_redo")
    ).toMatchObject({
      kind: "extrude",
      profile: { kind: "entity", sketchId: "sketch_1", entityId: "rect_1" }
    });

    const packed = await exportCadProjectToWcad(source);
    const read = await readCadProjectWcad(packed.bytes);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect({
      history: read.project.history.map((transaction) => transaction.ops),
      redo: read.project.redoStack.map((transaction) => transaction.ops)
    }).toEqual(expectedOps);
    expect(read.project.redoStack[0]?.ops[0]).toEqual(redoLegacyOp);
    const wcadEngine = importCadProject(read.project);
    wcadEngine.redo();
    expect(
      wcadEngine.getDocument().features.get("legacy_extrude_redo")
    ).toMatchObject({
      kind: "extrude",
      profile: { kind: "entity", sketchId: "sketch_1", entityId: "rect_1" }
    });
  });

  it("emits byte-stable canonical document and command CBOR", async () => {
    expect([...encodeWcadCanonicalCbor({ z: 1, a: { y: 2, x: 3 } })]).toEqual([
      ...encodeWcadCanonicalCbor({ a: { x: 3, y: 2 }, z: 1 })
    ]);

    const source = createNormalizedV21Project();
    const first = await exportCadProjectToWcad(source);
    const second = await exportCadProjectToWcad(clone(source));
    expect([...first.documentBytes]).toEqual([...second.documentBytes]);
    expect([...first.commandsBytes]).toEqual([...second.commandsBytes]);
    expect(first.sourceIdentity).toEqual(second.sourceIdentity);
  });

  it("preserves V21 topology checkpoint bytes and source identities in WCAD v2", async () => {
    const source = mutableProjectFixture(clone(createNormalizedV21Project()));
    const checkpointId = "checkpoint_v21";
    const paths = createWcadV2CheckpointEntryPaths(checkpointId);
    const placeholderIdentity = {
      algorithm: "partbench-source-v1",
      sha256: "1111111111111111111111111111111111111111111111111111111111111111"
    };
    source.document.topologyIdentity = {
      ...createEmptyTopologyIdentitySourceSnapshot(),
      checkpoints: [
        {
          checkpointId,
          bodyId: "body_extrude",
          sourceFeatureId: "extrude_1",
          sourceIdentity: placeholderIdentity,
          packageVersion: "partbench.wcad.v2",
          projectSchemaVersion: CAD_PROJECT_FORMAT_VERSION_V18,
          brepEntryPath: paths.brep,
          topologyEntryPath: paths.topology,
          signatureEntryPath: paths.signature,
          status: "active",
          diagnostics: []
        }
      ]
    };
    const topology = {
      source: "kernel-derived",
      status: "ready",
      entityCounts: {
        bodyCount: 0,
        solidCount: 0,
        faceCount: 0,
        wireCount: 0,
        edgeCount: 0,
        vertexCount: 0,
        loopCount: 0,
        coedgeCount: 0,
        axisCount: 0
      },
      entityCount: 0,
      entities: [],
      unsupportedEntityKinds: [],
      adjacencyAvailable: true,
      signatureAlgorithm: "partbench-derived-topology-snapshot-v1",
      signature: "v21_topology_signature",
      diagnostics: []
    };
    const payload = {
      checkpointId,
      bodyId: "body_extrude",
      sourceFeatureId: "extrude_1",
      kernel: {
        boundary: "geometry-kernel" as const,
        snapshotAlgorithm: "partbench-derived-topology-snapshot-v1" as const
      },
      tolerance: {
        linearTolerance: 0.001,
        angularToleranceDegrees: 0.01
      },
      brepBytes: textEncoder.encode("stable V21 B-rep bytes"),
      topologyBytes: encodeWcadCanonicalCbor(topology),
      signatureBytes: encodeWcadCanonicalCbor({
        checkpointId,
        signatureAlgorithm: topology.signatureAlgorithm,
        signature: topology.signature,
        entityCount: 0,
        entities: []
      })
    };
    const packed = await exportCadProjectToWcad(
      source as unknown as CadProject,
      {
        topologyCheckpoints: [payload]
      }
    );
    const read = await readCadProjectWcad(packed.bytes);

    if (!read.ok) {
      throw new Error(JSON.stringify(read.issues, null, 2));
    }
    expect(read.ok).toBe(true);
    expect(read.sourceIdentity).toEqual(packed.sourceIdentity);
    expect(read.project.document.topologyIdentity).toEqual(
      source.document.topologyIdentity
    );
    expect(read.checkpointPayloads).toHaveLength(1);
    expect(read.checkpointPayloads?.[0]?.manifestEntry.sourceIdentity).toEqual(
      packed.sourceIdentity
    );
    expect([...(read.checkpointPayloads?.[0]?.brepBytes ?? [])]).toEqual([
      ...payload.brepBytes
    ]);
    expect([...(read.checkpointPayloads?.[0]?.topologyBytes ?? [])]).toEqual([
      ...payload.topologyBytes
    ]);
    expect([...(read.checkpointPayloads?.[0]?.signatureBytes ?? [])]).toEqual([
      ...payload.signatureBytes
    ]);
  });

  it("imports representative V1-V20 migration families through the current normalizer", () => {
    const corpus = createMigrationCorpus();
    expect(corpus.map(({ version }) => version)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1)
    );

    const rawV3 = mutableProjectFixture(corpus[2]!.project);
    expect(rawV3.document).not.toHaveProperty("namedReferences");
    expect(rawV3.document).not.toHaveProperty("parameters");
    expect(rawV3.document.features[0]).not.toHaveProperty("side");
    expect(rawV3.document.features[0]).not.toHaveProperty("operationMode");

    const rawV4 = mutableProjectFixture(corpus[3]!.project);
    expect(rawV4.document).not.toHaveProperty("namedReferences");
    expect(
      fixtureAt(rawV4.document.sketches, 1, "sketch").attachment
    ).toMatchObject({
      kind: "generatedFace",
      sourceFeatureId: "base_extrude",
      sourceSketchId: "base_sketch",
      sourceSketchEntityId: "base_rect"
    });

    const rawV14 = mutableProjectFixture(corpus[13]!.project);
    expect(rawV14.document).not.toHaveProperty("topologyIdentity");
    expect(rawV14.document.features[0]).not.toHaveProperty("operationMode");

    const rawV15 = mutableProjectFixture(corpus[14]!.project);
    expect(rawV15.document).not.toHaveProperty("topologyIdentity");
    expect(rawV15.document.features[1]).toMatchObject({
      kind: "hole",
      depthMode: "blind",
      direction: "negative"
    });

    const rawV17 = mutableProjectFixture(corpus[16]!.project);
    expect(rawV17.document).not.toHaveProperty("topologyIdentity");
    expect(
      fixtureAt(
        fixtureAt(rawV17.document.sketches, 0, "sketch").entities,
        0,
        "entity"
      )
    ).not.toHaveProperty("construction");
    expect(
      fixtureAt(rawV17.document.sketchConstraints, 0, "constraint")
    ).toMatchObject({
      kind: "tangent",
      primaryTarget: { entityKind: "line" },
      secondaryTarget: { entityKind: "circle" }
    });

    const rawV18 = mutableProjectFixture(corpus[17]!.project);
    expect(rawV18.document.topologyIdentity).toEqual(
      expect.objectContaining({
        schemaVersion: "web-cad.project.v18",
        checkpoints: [],
        anchors: [],
        repairs: []
      })
    );

    const rawV19 = mutableProjectFixture(corpus[18]!.project);
    const rawV19Pattern = rawV19.document.features[1];
    const rawV19Mirror = rawV19.document.features[2];
    expect(rawV19Pattern).toMatchObject({ axis: "x" });
    expect(rawV19Pattern).not.toHaveProperty("direction");
    expect(rawV19Pattern).not.toHaveProperty("instances");
    expect(rawV19Mirror).toMatchObject({ mirrorPlane: "YZ" });
    expect(rawV19Mirror).not.toHaveProperty("plane");
    expect(rawV19.document.features[3]).toMatchObject({ kind: "shell" });
    expect(rawV19.document.parameters[0]).toMatchObject({
      expression: "2 * 3"
    });

    const rawV20 = mutableProjectFixture(corpus[19]!.project);
    expect(
      fixtureAt(
        fixtureAt(rawV20.document.sketches, 0, "sketch").entities,
        0,
        "entity"
      )
    ).not.toHaveProperty("construction");
    expect(rawV20.document.features[0]).toMatchObject({
      sketchId: "v20_profile",
      entityId: "v20_rect"
    });
    expect(rawV20.document.features[0]).not.toHaveProperty("profile");
    expect(rawV20.document.features[2]).toMatchObject({
      profileSketchId: "v20_profile",
      pathEntityIds: ["v20_path_line"]
    });
    expect(rawV20.document.features[2]).not.toHaveProperty("path");
    expect(
      fixtureAt(
        fixtureAt(rawV20.document.features, 3, "feature").sections,
        0,
        "section"
      )
    ).toEqual({
      sketchId: "v20_profile",
      entityId: "v20_circle"
    });

    for (const { version, marker, project } of corpus) {
      const parsed = parseCadProjectJson(JSON.stringify(project));
      const expectedSchema =
        version <= 16
          ? CURRENT_CAD_PROJECT_FORMAT_VERSION
          : version === 19
            ? CAD_PROJECT_FORMAT_VERSION_V20
            : `web-cad.project.v${version}`;
      expect(
        parsed.schemaVersion,
        `V${version} ${marker} normalized schema`
      ).toBe(expectedSchema);
      const restored = importCadProject(parsed);
      const document = restored.getDocument();
      const sourceRecordCount =
        document.objects.size +
        document.sketches.size +
        document.parameters.size +
        document.sketchDimensions.size +
        document.sketchConstraints.size +
        document.features.size +
        document.namedReferences.size +
        (document.topologyIdentity ? 1 : 0);
      expect(sourceRecordCount, `V${version} ${marker} source`).toBeGreaterThan(
        0
      );
      const reexported = exportCadProject(restored);
      if (version === 1) {
        expect(reexported.document.objects).toEqual([
          expect.objectContaining({ id: "v1_box" })
        ]);
      } else if (version === 2) {
        expect(reexported.document.sketches).toEqual([
          expect.objectContaining({ id: "v2_sketch" })
        ]);
      } else if (version === 3) {
        expect(reexported.document.features).toContainEqual(
          expect.objectContaining({
            id: "base_extrude",
            kind: "extrude",
            side: "positive",
            operationMode: "newBody"
          })
        );
      } else if (version === 4) {
        expect(reexported.document.sketches).toContainEqual(
          expect.objectContaining({
            id: "v4_attached",
            attachment: expect.objectContaining({ kind: "generatedFace" })
          })
        );
      } else if (version === 5 || version === 6) {
        expect(reexported.document.namedReferences).toContainEqual(
          expect.objectContaining({ name: "V5 top" })
        );
      } else if (version === 7) {
        expect(reexported.document.parameters).toContainEqual(
          expect.objectContaining({ id: "v7_parameter" })
        );
        expect(reexported.document.sketchDimensions).toContainEqual(
          expect.objectContaining({ id: "v7_dimension" })
        );
      } else if (version >= 8 && version <= 13) {
        expect(reexported.document.sketchConstraints).toContainEqual(
          expect.objectContaining({ id: `constraint_v${version}` })
        );
      } else if (version === 14) {
        expect(reexported.document.features).toContainEqual(
          expect.objectContaining({
            id: "v14_revolve",
            kind: "revolve",
            operationMode: "newBody"
          })
        );
      } else if (version === 15) {
        expect(reexported.document.features).toContainEqual(
          expect.objectContaining({
            id: "v15_hole",
            kind: "hole",
            depthMode: "blind",
            direction: "negative"
          })
        );
      } else if (version === 16) {
        expect(reexported.document.features).toContainEqual(
          expect.objectContaining({ id: "v16_chamfer", kind: "chamfer" })
        );
      } else if (version === 17) {
        expect(reexported.document.sketchConstraints).toContainEqual(
          expect.objectContaining({ id: "v17_tangent", kind: "tangent" })
        );
      } else if (version === 18) {
        expect(reexported.document.topologyIdentity).toBeDefined();
      } else if (version === 19) {
        expect(reexported.document.features).toContainEqual(
          expect.objectContaining({
            id: "v19_pattern",
            kind: "linearPattern",
            direction: { kind: "globalAxis", axis: "x" },
            instances: expect.any(Array)
          })
        );
        expect(reexported.document.features).toContainEqual(
          expect.objectContaining({
            id: "v19_mirror",
            kind: "mirror",
            plane: { kind: "standardPlane", plane: "YZ", offset: 0 }
          })
        );
        expect(reexported.document.features).toContainEqual(
          expect.objectContaining({ id: "v19_shell", kind: "shell" })
        );
        expect(reexported.document.parameters).toContainEqual(
          expect.objectContaining({
            id: "v19_parameter",
            expression: "2 * 3"
          })
        );
      }
    }

    const v20 = importCadProject(
      parseCadProjectJson(JSON.stringify(corpus[19]!.project))
    ).getDocument();
    expect(v20.features.get("v20_extrude")).toMatchObject({
      profile: {
        kind: "entity",
        sketchId: "v20_profile",
        entityId: "v20_rect"
      }
    });
    expect(v20.features.get("v20_revolve")).toMatchObject({
      profile: {
        kind: "entity",
        sketchId: "v20_profile",
        entityId: "v20_rect"
      }
    });
    expect(v20.features.get("v20_sweep")).toMatchObject({
      profile: {
        kind: "entity",
        sketchId: "v20_profile",
        entityId: "v20_circle"
      },
      path: {
        kind: "entity",
        sketchId: "v20_path",
        entityId: "v20_path_line",
        orientation: "forward"
      }
    });
    expect(v20.features.get("v20_loft_feature")).toMatchObject({
      sections: [
        {
          profile: {
            kind: "entity",
            sketchId: "v20_profile",
            entityId: "v20_circle"
          }
        },
        {
          profile: {
            kind: "entity",
            sketchId: "v20_loft",
            entityId: "v20_loft_circle"
          }
        }
      ]
    });
  });

  it("hashes actual wire and chain segment order and orientation", () => {
    const source = createOrderedWireAndChainProject();
    const baseline = createCadProjectSourceIdentity(source).sha256;
    const variants = [
      (project: MutableProjectFixture) =>
        fixtureAt(
          project.document.features,
          0,
          "feature"
        ).profile.segments.reverse(),
      (project: MutableProjectFixture) => {
        fixtureAt(
          fixtureAt(project.document.features, 0, "feature").profile.segments,
          0,
          "profile segment"
        ).orientation = "reverse";
      },
      (project: MutableProjectFixture) =>
        fixtureAt(
          project.document.features,
          2,
          "feature"
        ).path.segments.reverse(),
      (project: MutableProjectFixture) => {
        fixtureAt(
          fixtureAt(project.document.features, 2, "feature").path.segments,
          1,
          "path segment"
        ).orientation = "reverse";
      }
    ];

    for (const mutate of variants) {
      const changed = mutableProjectFixture(clone(source));
      mutate(changed);
      expect(
        createCadProjectSourceIdentity(changed as unknown as CadProject).sha256
      ).not.toBe(baseline);
    }
  });

  it("reports exact V21 paths for malformed normalized references", () => {
    const dangling = mutableProjectFixture(
      clone(createOrderedWireAndChainProject())
    );
    fixtureAt(
      fixtureAt(dangling.document.features, 0, "feature").profile.segments,
      1,
      "profile segment"
    ).entityId = "missing";
    expectV21Issue(
      dangling,
      "$.document.features[0].profile.segments[1].entityId"
    );

    const mixedSketch = mutableProjectFixture(
      clone(createOrderedWireAndChainProject())
    );
    fixtureAt(
      fixtureAt(mixedSketch.document.features, 0, "feature").profile.segments,
      1,
      "profile segment"
    ).entityId = "axis";
    expectV21Issue(
      mixedSketch,
      "$.document.features[0].profile.segments[1].entityId"
    );

    const invalidOrientation = mutableProjectFixture(
      clone(createOrderedWireAndChainProject())
    );
    fixtureAt(
      fixtureAt(invalidOrientation.document.features, 0, "feature").profile
        .segments,
      0,
      "profile segment"
    ).orientation = "clockwise";
    expectV21Issue(
      invalidOrientation,
      "$.document.features[0].profile.segments[0].orientation"
    );

    const crossSketchAxis = mutableProjectFixture(
      clone(createNormalizedV21Project())
    );
    fixtureAt(crossSketchAxis.document.features, 1, "feature").axis = {
      type: "sketchLine",
      sketchId: "path",
      entityId: "path_1"
    };
    expectV21Issue(crossSketchAxis, "$.document.features[1].axis.sketchId");
  });

  it("downgrades normalized nontriggers and circle-only radius constraints to V20", () => {
    const saved = exportCadProject(
      importCadProject(
        parseCadProjectJson(JSON.stringify(createNormalizedV21Project()))
      )
    );

    expect(saved.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);
    expect(saved.document.features).toEqual([
      expect.objectContaining({
        kind: "extrude",
        sketchId: "profiles",
        entityId: "rect",
        profileKind: "rectangle"
      }),
      expect.objectContaining({
        kind: "revolve",
        sketchId: "profiles",
        entityId: "circle_a",
        profileKind: "circle"
      }),
      expect.objectContaining({
        kind: "sweep",
        profileSketchId: "profiles",
        profileEntityId: "circle_b",
        pathSketchId: "path",
        pathEntityIds: ["path_1"]
      }),
      expect.objectContaining({
        kind: "loft",
        sections: [
          { sketchId: "loft_a", entityId: "loft_rect_a" },
          { sketchId: "loft_b", entityId: "loft_rect_b" }
        ]
      })
    ]);
    for (const feature of saved.document.features) {
      expect(feature).not.toHaveProperty("profile");
      expect(feature).not.toHaveProperty("path");
    }
    expect(saved.document.sketchConstraints).toEqual([
      expect.objectContaining({
        kind: "concentric",
        primaryCircleEntityId: "circle_a",
        secondaryCircleEntityId: "circle_b"
      }),
      expect.objectContaining({
        kind: "equalRadius",
        primaryCircleEntityId: "circle_c",
        secondaryCircleEntityId: "circle_d"
      })
    ]);
    for (const constraint of saved.document.sketchConstraints) {
      expect(constraint).not.toHaveProperty("primaryTarget");
      expect(constraint).not.toHaveProperty("secondaryTarget");
    }
  });

  it("validates generated-face attachments against normalized V21 extrude sources", () => {
    const source = mutableProjectFixture(clone(createNormalizedV21Project()));
    source.document.sketches.push({
      id: "attached_sketch",
      name: "Attached sketch",
      plane: "XY",
      attachment: {
        kind: "generatedFace",
        bodyId: "body_extrude",
        faceStableId: "generated:face:body_extrude:endCap",
        sourceFeatureId: "extrude_1",
        sourceSketchId: "profiles",
        sourceSketchEntityId: "rect",
        faceRole: "endCap"
      },
      entities: []
    });

    expect(() => parseCadProjectJson(JSON.stringify(source))).not.toThrow();

    const provenanceCases: readonly [field: string, value: string][] = [
      ["sourceFeatureId", "revolve_1"],
      ["sourceSketchId", "loft_a"],
      ["sourceSketchEntityId", "circle_a"]
    ];
    for (const [field, value] of provenanceCases) {
      const mismatched = mutableProjectFixture(
        clone(source as unknown as CadProject)
      );
      fixtureAt(mismatched.document.sketches, 4, "sketch").attachment[field] =
        value;
      expectProjectIssue(
        mismatched,
        "INVALID_SKETCH",
        `$.document.sketches[4].attachment.${field}`
      );
    }
    const wrongStableId = mutableProjectFixture(
      clone(source as unknown as CadProject)
    );
    fixtureAt(
      wrongStableId.document.sketches,
      4,
      "sketch"
    ).attachment.faceStableId = "generated:face:body_extrude:startCap";
    expectProjectIssue(
      wrongStableId,
      "INVALID_SKETCH",
      "$.document.sketches[4].attachment.faceStableId"
    );
  });

  it("enforces the Slice A profile-consumer allow and deny matrix structurally", () => {
    expect(() =>
      parseCadProjectJson(JSON.stringify(createNormalizedV21Project()))
    ).not.toThrow();
    expect(() =>
      parseCadProjectJson(JSON.stringify(createOrderedWireAndChainProject()))
    ).not.toThrow();

    const revolveWire = mutableProjectFixture(
      clone(createNormalizedV21Project())
    );
    fixtureAt(revolveWire.document.sketches, 0, "sketch").entities.push(
      entity("profile_line_2", "line", { start: [0, 3], end: [3, 3] })
    );
    fixtureAt(revolveWire.document.features, 1, "feature").profile = {
      kind: "wire",
      sketchId: "profiles",
      segments: [
        { entityId: "axis", orientation: "forward" },
        { entityId: "profile_line_2", orientation: "forward" }
      ]
    };
    expect(() =>
      parseCadProjectJson(JSON.stringify(revolveWire))
    ).not.toThrow();

    const deniedConsumers: readonly [
      path: string,
      featureIndex: number,
      mutate: (feature: MutableFeatureFixture) => void
    ][] = [
      [
        "$.document.features[2].profile.kind",
        2,
        (feature) => {
          feature.profile = {
            kind: "wire",
            sketchId: "profiles",
            segments: [
              { entityId: "axis", orientation: "forward" },
              { entityId: "profile_line_2", orientation: "forward" }
            ]
          };
        }
      ],
      [
        "$.document.features[3].sections[0].profile.kind",
        3,
        (feature) => {
          fixtureAt(feature.sections, 0, "section").profile = {
            kind: "wire",
            sketchId: "profiles",
            segments: [
              { entityId: "axis", orientation: "forward" },
              { entityId: "profile_line_2", orientation: "forward" }
            ]
          };
        }
      ]
    ];
    for (const [path, featureIndex, mutate] of deniedConsumers) {
      const denied = mutableProjectFixture(
        clone(revolveWire as unknown as CadProject)
      );
      mutate(fixtureAt(denied.document.features, featureIndex, "feature"));
      expectV21Issue(denied, path);
    }
  });

  it("allows construction guides for axes and paths but rejects every solid profile", () => {
    const guides = mutableProjectFixture(clone(createNormalizedV21Project()));
    findSketchEntityFixture(guides, 0, "axis").construction = true;
    findSketchEntityFixture(guides, 1, "path_1").construction = true;
    expect(() => parseCadProjectJson(JSON.stringify(guides))).not.toThrow();

    const profileCases: readonly [entityId: string, path: string][] = [
      ["rect", "$.document.features[0].profile.entityId"],
      ["circle_a", "$.document.features[1].profile.entityId"],
      ["circle_b", "$.document.features[2].profile.entityId"],
      ["loft_rect_a", "$.document.features[3].sections[0].profile.entityId"]
    ];
    for (const [entityId, path] of profileCases) {
      const denied = mutableProjectFixture(clone(createNormalizedV21Project()));
      for (const sourceSketch of denied.document.sketches) {
        const profileEntity = sourceSketch.entities.find(
          (item) => item.id === entityId
        );
        if (profileEntity) profileEntity.construction = true;
      }
      expectV21Issue(denied, path);
    }
  });

  it("rejects mixed legacy and normalized fields for every consumer and radius target", () => {
    const cases: readonly [
      path: string,
      mutate: (project: MutableProjectFixture) => void
    ][] = [
      [
        "$.document.features[0].sketchId",
        (p) =>
          (fixtureAt(p.document.features, 0, "feature").sketchId = "profiles")
      ],
      [
        "$.document.features[1].entityId",
        (p) =>
          (fixtureAt(p.document.features, 1, "feature").entityId = "circle_a")
      ],
      [
        "$.document.features[2].pathEntityIds",
        (p) =>
          (fixtureAt(p.document.features, 2, "feature").pathEntityIds = [
            "path_1"
          ])
      ],
      [
        "$.document.features[3].sections[0].sketchId",
        (p) =>
          (fixtureAt(
            fixtureAt(p.document.features, 3, "feature").sections,
            0,
            "section"
          ).sketchId = "loft_a")
      ],
      [
        "$.document.sketchConstraints[0].primaryCircleEntityId",
        (p) =>
          (fixtureAt(
            p.document.sketchConstraints,
            0,
            "constraint"
          ).primaryCircleEntityId = "circle_a")
      ],
      [
        "$.document.sketchConstraints[1].secondaryCircleEntityId",
        (p) =>
          (fixtureAt(
            p.document.sketchConstraints,
            1,
            "constraint"
          ).secondaryCircleEntityId = "circle_d")
      ]
    ];

    for (const [path, mutate] of cases) {
      const mixed = mutableProjectFixture(clone(createNormalizedV21Project()));
      mutate(mixed);
      expectV21Issue(mixed, path);
    }
  });
});

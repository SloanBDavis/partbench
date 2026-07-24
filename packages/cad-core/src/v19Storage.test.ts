import { describe, expect, it } from "vitest";
import {
  CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION,
  type SemanticDiff,
  type SketchDimensionSnapshotV22
} from "@web-cad/cad-protocol";
import {
  CAD_PROJECT_FORMAT_VERSION_V16,
  CAD_PROJECT_FORMAT_VERSION_V21,
  CAD_PROJECT_FORMAT_VERSION_V22,
  CadEngine,
  CadProjectImportError,
  canonicalizeSemanticDiffForReplay,
  createCadProjectSourceIdentity,
  exportCadProject,
  exportCadProjectToWcad,
  getCadProjectFormatVersionForDocument,
  importCadProject,
  parseCadProjectJson,
  readCadProjectWcad,
  type CadProject,
  type Transaction
} from "./index";

function createCircleProject(): CadProject {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_1",
      id: "circle_1",
      center: [0, 0],
      radius: 2
    }
  ]);
  const project = exportCadProject(engine);
  return {
    ...project,
    history: [],
    redoStack: [],
    document: {
      ...project.document,
      sketches: project.document.sketches.map((sketch) => ({
        ...sketch,
        entities: sketch.entities.map((entity) => ({
          ...entity,
          construction: false
        }))
      }))
    }
  };
}

function createV22DimensionProject(role: "radius" | "diameter"): CadProject {
  const base = createCircleProject();
  const dimension: SketchDimensionSnapshotV22 = {
    id: "skdim_1",
    name: role === "diameter" ? "Diameter" : "Radius",
    sketchId: "sketch_1",
    target: {
      kind: "entityScalar",
      entityId: "circle_1",
      entityKind: "circle",
      role
    },
    valueSource: { type: "literal", value: role === "diameter" ? 4 : 2 }
  };
  return {
    ...base,
    schemaVersion: CAD_PROJECT_FORMAT_VERSION_V22,
    document: {
      ...base.document,
      sketchDimensions: [dimension],
      nextSketchDimensionNumber: 2
    }
  };
}

function createTwoLineProject(): CadProject {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_1",
      start: [0, 0],
      end: [4, 0]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_2",
      start: [0, 3],
      end: [4, 3]
    }
  ]);
  const project = exportCadProject(engine);
  return {
    ...project,
    history: [],
    redoStack: [],
    document: {
      ...project.document,
      sketches: project.document.sketches.map((sketch) => ({
        ...sketch,
        entities: sketch.entities.map((entity) => ({
          ...entity,
          construction: false
        }))
      }))
    }
  };
}

function emptyTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: "tx_v19",
    status: "committed",
    ops: [],
    diff: { created: [], modified: [], deleted: [] },
    ...overrides
  };
}

describe("V19 minimum-triggered V22 storage", () => {
  it("selects V22 from live dimensions and retained history or redo", () => {
    const diameter = createV22DimensionProject("diameter");
    expect(getCadProjectFormatVersionForDocument(diameter.document)).toBe(
      CAD_PROJECT_FORMAT_VERSION_V22
    );

    const base = createCircleProject();
    const history = emptyTransaction({
      ops: [
        {
          op: "sketch.dimension.create",
          name: "Radius",
          sketchId: "sketch_1",
          target: {
            kind: "entityScalar",
            entityId: "circle_1",
            entityKind: "circle",
            role: "radius"
          },
          value: 2
        }
      ]
    });
    expect(
      getCadProjectFormatVersionForDocument(base.document, [history], [])
    ).toBe(CAD_PROJECT_FORMAT_VERSION_V22);

    const redo = emptyTransaction({
      status: "undone",
      diff: {
        created: [],
        modified: [],
        deleted: [],
        sketches: { curveEdits: [] }
      }
    });
    expect(
      getCadProjectFormatVersionForDocument(base.document, [], [redo])
    ).toBe(CAD_PROJECT_FORMAT_VERSION_V22);

    const normalizedConstraint = emptyTransaction({
      ops: [
        {
          op: "sketch.constraint.create",
          id: "skcon_fixed",
          name: "Fixed center",
          sketchId: "sketch_1",
          kind: "fixed",
          target: {
            entityId: "circle_1",
            entityKind: "circle",
            role: "center"
          }
        }
      ]
    });
    expect(
      getCadProjectFormatVersionForDocument(
        base.document,
        [normalizedConstraint],
        []
      )
    ).toBe(CAD_PROJECT_FORMAT_VERSION_V22);

    const regionDiff = emptyTransaction({
      diff: {
        created: [],
        modified: [],
        deleted: [],
        features: {
          created: [
            {
              id: "feat_1",
              kind: "extrude",
              bodyId: "body_1",
              sketchId: "sketch_1",
              profile: {
                kind: "regions",
                sketchId: "sketch_1",
                regions: [
                  {
                    outer: { kind: "entity", entityId: "circle_1" },
                    holes: []
                  }
                ]
              },
              depth: 1,
              side: "positive",
              operationMode: "newBody"
            }
          ]
        }
      }
    });
    expect(
      getCadProjectFormatVersionForDocument(base.document, [regionDiff], [])
    ).toBe(CAD_PROJECT_FORMAT_VERSION_V22);
  });

  it("lowers a lossless normalized scalar dimension when no trigger remains", () => {
    const engine = importCadProject(createV22DimensionProject("radius"));
    const saved = exportCadProject(engine);

    expect(saved.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V16);
    expect(saved.document.sketchDimensions).toEqual([
      {
        id: "skdim_1",
        name: "Radius",
        sketchId: "sketch_1",
        entityId: "circle_1",
        target: { entityKind: "circle", role: "radius" },
        valueSource: { type: "literal", value: 2 }
      }
    ]);
  });

  it("normalizes a V21 legacy dimension in memory and lowers it losslessly on export", () => {
    const base = createCircleProject();
    const legacy: CadProject = {
      ...base,
      schemaVersion: CAD_PROJECT_FORMAT_VERSION_V21,
      document: {
        ...base.document,
        sketchDimensions: [
          {
            id: "skdim_1",
            name: "Radius",
            sketchId: "sketch_1",
            entityId: "circle_1",
            target: { entityKind: "circle", role: "radius" },
            valueSource: { type: "literal", value: 2 }
          }
        ],
        nextSketchDimensionNumber: 2
      }
    };

    const engine = importCadProject(legacy);
    const live = engine.getDocument().sketchDimensions.get("skdim_1");
    expect(live).toEqual({
      id: "skdim_1",
      name: "Radius",
      sketchId: "sketch_1",
      target: {
        kind: "entityScalar",
        entityId: "circle_1",
        entityKind: "circle",
        role: "radius"
      },
      valueSource: { type: "literal", value: 2 }
    });

    const saved = exportCadProject(engine);
    expect(saved.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V16);
    expect(saved.document.sketchDimensions).toEqual(
      legacy.document.sketchDimensions
    );
  });

  it("loads relational V22 dimensions, queries them safely, blocks referenced deletion, and scales only linear literals", () => {
    const base = createTwoLineProject();
    const thirdLine = {
      id: "line_3",
      kind: "line" as const,
      start: [0, 0] as const,
      end: [0, 4] as const,
      construction: false
    };
    const project: CadProject = {
      ...base,
      schemaVersion: CAD_PROJECT_FORMAT_VERSION_V22,
      document: {
        ...base.document,
        sketches: base.document.sketches.map((sketch) => ({
          ...sketch,
          entities: [...sketch.entities, thirdLine]
        })),
        sketchDimensions: [
          {
            id: "skdim_pair",
            name: "Vertical separation",
            sketchId: "sketch_1",
            target: {
              kind: "pointPair",
              primary: {
                entityId: "line_1",
                entityKind: "line",
                role: "start"
              },
              secondary: {
                entityId: "line_2",
                entityKind: "line",
                role: "start"
              },
              measurement: "vertical",
              direction: "positive"
            },
            valueSource: { type: "literal", value: 3 }
          },
          {
            id: "skdim_point_line",
            name: "Point to line",
            sketchId: "sketch_1",
            target: {
              kind: "pointLineDistance",
              point: {
                entityId: "line_2",
                entityKind: "line",
                role: "start"
              },
              lineEntityId: "line_1",
              side: "left"
            },
            valueSource: { type: "literal", value: 3 }
          },
          {
            id: "skdim_angle",
            name: "Line angle",
            sketchId: "sketch_1",
            target: {
              kind: "lineAngle",
              primaryLineEntityId: "line_1",
              secondaryLineEntityId: "line_3",
              sense: "counterclockwise"
            },
            valueSource: { type: "literal", value: 90 }
          }
        ],
        nextSketchEntityNumber: 4,
        nextSketchDimensionNumber: 4
      }
    };

    const engine = importCadProject(project);
    const dimensions = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "sketch.dimensions", sketchId: "sketch_1" }
    });
    expect(dimensions).toMatchObject({
      ok: true,
      dimensionCount: 3,
      dimensions: [
        { sourceShape: "v22", id: "skdim_pair", status: "healthy" },
        { sourceShape: "v22", id: "skdim_point_line", status: "healthy" },
        { sourceShape: "v22", id: "skdim_angle", status: "healthy" }
      ]
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "sketch.dimension.get", id: "skdim_angle" }
      })
    ).toMatchObject({
      ok: true,
      dimension: {
        sourceShape: "v22",
        id: "skdim_angle",
        effectiveValue: 90
      }
    });
    expect(
      engine.executeQuery({
        version: "cadops.v1",
        query: { query: "sketch.solverStatus", sketchId: "sketch_1" }
      })
    ).toMatchObject({
      ok: true,
      dimensionCount: 3,
      dimensions: [
        {
          sourceShape: "v22",
          dimensionId: "skdim_pair",
          status: "healthy"
        },
        {
          sourceShape: "v22",
          dimensionId: "skdim_point_line",
          status: "healthy"
        },
        {
          sourceShape: "v22",
          dimensionId: "skdim_angle",
          status: "healthy"
        }
      ]
    });
    const projectHealth = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.health" }
    });
    expect(projectHealth).toMatchObject({
      ok: true,
      sketchDimensionCount: 3,
      sketchDimensions: [
        {
          sourceShape: "v22",
          dimensionId: "skdim_pair"
        },
        {
          sourceShape: "v22",
          dimensionId: "skdim_point_line"
        },
        {
          sourceShape: "v22",
          dimensionId: "skdim_angle"
        }
      ]
    });
    if (projectHealth.ok && projectHealth.query === "project.health") {
      expect(
        projectHealth.sketchDimensions.every(
          (dimension) => !("entityId" in dimension)
        )
      ).toBe(true);
    }

    expect(() =>
      engine.apply({
        op: "sketch.deleteEntity",
        sketchId: "sketch_1",
        entityId: "line_2"
      })
    ).toThrow(/referenced by dimension/);

    engine.apply({
      op: "document.updateUnits",
      units: "cm",
      mode: "preservePhysicalSize"
    });
    const saved = exportCadProject(engine);
    expect(saved.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V22);
    expect(saved.document.sketchDimensions).toEqual([
      expect.objectContaining({
        id: "skdim_pair",
        valueSource: { type: "literal", value: 0.3 }
      }),
      expect.objectContaining({
        id: "skdim_point_line",
        valueSource: { type: "literal", value: 0.3 }
      }),
      expect.objectContaining({
        id: "skdim_angle",
        valueSource: { type: "literal", value: 90 }
      })
    ]);
  });

  it("replays legacy dimension history beside an independent V22 trigger without rewriting source", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "line_1",
        start: [0, 0],
        end: [4, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "line_2",
        start: [0, 1],
        end: [4, 1]
      }
    ]);
    engine.apply({
      op: "sketch.dimension.create",
      id: "skdim_1",
      name: "Legacy length",
      sketchId: "sketch_1",
      entityId: "line_1",
      target: { entityKind: "line", role: "length" },
      value: 4
    });
    engine.apply({
      op: "sketch.constraint.create",
      id: "skcon_fixed",
      name: "Fixed start",
      sketchId: "sketch_1",
      kind: "fixed",
      target: {
        entityId: "line_1",
        entityKind: "line",
        role: "start"
      }
    });

    const saved = exportCadProject(engine);
    expect(saved.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V22);
    const dimensionTransaction = saved.history[1]!;
    expect(dimensionTransaction.ops[0]).toMatchObject({
      op: "sketch.dimension.create",
      entityId: "line_1",
      target: { entityKind: "line", role: "length" }
    });
    expect(
      dimensionTransaction.diff.sketchDimensions?.created?.[0]
    ).not.toHaveProperty("sourceShape");

    const reexported = exportCadProject(importCadProject(saved));
    expect(reexported.history).toEqual(saved.history);
    expect(reexported.document).toEqual(saved.document);
  });

  it("rejects V19-only retained history and redo in lower-schema projects", () => {
    const base = createTwoLineProject();
    const historyTrigger = emptyTransaction({
      ops: [
        {
          op: "sketch.constraint.create",
          id: "skcon_equal",
          name: "Equal lengths",
          sketchId: "sketch_1",
          kind: "equalLength",
          primaryLineEntityId: "line_1",
          secondaryLineEntityId: "line_2"
        }
      ]
    });
    const redoTrigger = emptyTransaction({
      status: "undone",
      diff: {
        created: [],
        modified: [],
        deleted: [],
        sketches: { curveEdits: [] }
      }
    });

    expect(() =>
      importCadProject({
        ...base,
        schemaVersion: CAD_PROJECT_FORMAT_VERSION_V21,
        history: [historyTrigger]
      })
    ).toThrow(CadProjectImportError);
    expect(() =>
      importCadProject({
        ...base,
        schemaVersion: CAD_PROJECT_FORMAT_VERSION_V21,
        redoStack: [redoTrigger]
      })
    ).toThrow(CadProjectImportError);
  });

  it("round-trips V22 diameter source through JSON, canonical source identity, and WCAD v2", async () => {
    const parsed = parseCadProjectJson(
      JSON.stringify(createV22DimensionProject("diameter"))
    );
    const saved = exportCadProject(importCadProject(parsed));

    expect(saved.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V22);
    expect(saved.document.sketchDimensions[0]).toMatchObject({
      target: {
        kind: "entityScalar",
        entityId: "circle_1",
        entityKind: "circle",
        role: "diameter"
      }
    });

    const identityBefore = createCadProjectSourceIdentity(saved);
    const packaged = await exportCadProjectToWcad(saved);
    expect(packaged.manifest.packageVersion).toBe(
      CAD_TOPOLOGY_IDENTITY_PACKAGE_VERSION
    );
    expect(packaged.manifest.document.schemaVersion).toBe(
      CAD_PROJECT_FORMAT_VERSION_V22
    );
    expect(packaged.diagnostics).toEqual([
      expect.objectContaining({
        code: "SCHEMA_UPGRADED_TO_V22",
        schemaVersion: CAD_PROJECT_FORMAT_VERSION_V22
      })
    ]);

    const read = await readCadProjectWcad(packaged.bytes);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.project).toEqual(saved);
    expect(read.sourceIdentity).toEqual(identityBefore);
  });

  it("retains canonical regions profiles as a live V22 trigger", () => {
    const base = createCircleProject();
    const project: CadProject = {
      ...base,
      schemaVersion: CAD_PROJECT_FORMAT_VERSION_V22,
      document: {
        ...base.document,
        features: [
          {
            id: "feat_1",
            kind: "extrude",
            profile: {
              kind: "regions",
              sketchId: "sketch_1",
              regions: [
                {
                  outer: { kind: "entity", entityId: "circle_1" },
                  holes: []
                }
              ]
            },
            operationMode: "newBody",
            depth: 5,
            side: "positive",
            bodyId: "body_1"
          }
        ],
        nextFeatureNumber: 2,
        nextBodyNumber: 2
      }
    };

    const saved = exportCadProject(importCadProject(project));
    expect(saved.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V22);
    expect(saved.document.features[0]).toEqual(project.document.features[0]);
  });

  it("rejects cross-sketch and non-canonical geometric region source during import", () => {
    const crossSketchEngine = new CadEngine();
    crossSketchEngine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "First", plane: "XY" },
      { op: "sketch.create", id: "sketch_2", name: "Second", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        id: "circle_1",
        center: [0, 0],
        radius: 2
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_2",
        id: "circle_2",
        center: [0, 0],
        radius: 2
      }
    ]);
    const crossSketchBase = exportCadProject(crossSketchEngine);
    const crossSketchProject: CadProject = {
      ...crossSketchBase,
      schemaVersion: CAD_PROJECT_FORMAT_VERSION_V22,
      history: [],
      redoStack: [],
      document: {
        ...crossSketchBase.document,
        sketches: crossSketchBase.document.sketches.map((sketch) => ({
          ...sketch,
          entities: sketch.entities.map((entity) => ({
            ...entity,
            construction: false
          }))
        })),
        features: [
          {
            id: "feat_1",
            kind: "extrude",
            profile: {
              kind: "regions",
              sketchId: "sketch_1",
              regions: [
                {
                  outer: { kind: "entity", entityId: "circle_2" },
                  holes: []
                }
              ]
            },
            operationMode: "newBody",
            depth: 5,
            side: "positive",
            bodyId: "body_1"
          }
        ],
        nextFeatureNumber: 2,
        nextBodyNumber: 2
      }
    };

    expect(() => importCadProject(crossSketchProject)).toThrow(
      /SKETCH_REGION_ENTITY_MISSING/
    );

    const orderEngine = new CadEngine();
    orderEngine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "outer",
        center: [0, 0],
        width: 20,
        height: 20
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        id: "circle_a",
        center: [-4, 0],
        radius: 1
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        id: "circle_Z",
        center: [4, 0],
        radius: 1
      }
    ]);
    const orderBase = exportCadProject(orderEngine);
    const nonCanonical: CadProject = {
      ...orderBase,
      schemaVersion: CAD_PROJECT_FORMAT_VERSION_V22,
      history: [],
      redoStack: [],
      document: {
        ...orderBase.document,
        sketches: orderBase.document.sketches.map((sketch) => ({
          ...sketch,
          entities: sketch.entities.map((entity) => ({
            ...entity,
            construction: false
          }))
        })),
        features: [
          {
            id: "feat_1",
            kind: "extrude",
            profile: {
              kind: "regions",
              sketchId: "sketch_1",
              regions: [
                {
                  outer: { kind: "entity", entityId: "outer" },
                  holes: [
                    { kind: "entity", entityId: "circle_a" },
                    { kind: "entity", entityId: "circle_Z" }
                  ]
                }
              ]
            },
            operationMode: "newBody",
            depth: 5,
            side: "positive",
            bodyId: "body_1"
          }
        ],
        nextFeatureNumber: 2,
        nextBodyNumber: 2
      }
    };
    expect(() => importCadProject(nonCanonical)).toThrow(/must be canonical/);
  });

  it("rejects mixed legacy and V22 dimension fields before replacing state", () => {
    const mixed = JSON.parse(
      JSON.stringify(createV22DimensionProject("diameter"))
    ) as {
      document: { sketchDimensions: Record<string, unknown>[] };
    };
    mixed.document.sketchDimensions[0]!.entityId = "circle_1";

    expect(() => parseCadProjectJson(JSON.stringify(mixed))).toThrow(
      CadProjectImportError
    );
  });

  it("rejects relational target aliases and out-of-domain V22 values", () => {
    const base = createTwoLineProject();
    const withDimension = (
      target: SketchDimensionSnapshotV22["target"],
      value: number
    ): CadProject => ({
      ...base,
      schemaVersion: CAD_PROJECT_FORMAT_VERSION_V22,
      document: {
        ...base.document,
        sketchDimensions: [
          {
            id: "skdim_1",
            name: "Invalid",
            sketchId: "sketch_1",
            target,
            valueSource: { type: "literal", value }
          }
        ],
        nextSketchDimensionNumber: 2
      }
    });

    expect(() =>
      importCadProject(
        withDimension(
          {
            kind: "pointPair",
            primary: {
              entityId: "line_1",
              entityKind: "line",
              role: "start"
            },
            secondary: {
              entityId: "line_1",
              entityKind: "line",
              role: "start"
            },
            measurement: "distance"
          },
          1
        )
      )
    ).toThrow(CadProjectImportError);
    expect(() =>
      importCadProject(
        withDimension(
          {
            kind: "pointLineDistance",
            point: {
              entityId: "line_1",
              entityKind: "line",
              role: "start"
            },
            lineEntityId: "line_1",
            side: "left"
          },
          1
        )
      )
    ).toThrow(CadProjectImportError);
    expect(() =>
      importCadProject(
        withDimension(
          {
            kind: "pointPair",
            primary: {
              entityId: "line_1",
              entityKind: "line",
              role: "start"
            },
            secondary: {
              entityId: "line_2",
              entityKind: "line",
              role: "start"
            },
            measurement: "distance"
          },
          0
        )
      )
    ).toThrow(CadProjectImportError);
  });

  it("canonicalizes legacy and V22 dimension refs for replay without rewriting source", () => {
    const legacy = {
      created: [],
      modified: [],
      deleted: [],
      sketchDimensions: {
        created: [
          {
            id: "skdim_1",
            name: "Radius",
            sketchId: "sketch_1",
            entityId: "circle_1",
            target: { entityKind: "circle", role: "radius" },
            parameterId: "param_1"
          }
        ]
      }
    } as const;
    const v22 = {
      created: [],
      modified: [],
      deleted: [],
      sketchDimensions: {
        created: [
          {
            sourceShape: "v22",
            id: "skdim_1",
            name: "Radius",
            sketchId: "sketch_1",
            target: {
              kind: "entityScalar",
              entityId: "circle_1",
              entityKind: "circle",
              role: "radius"
            },
            parameterId: "param_1"
          }
        ]
      }
    } as const;

    const legacyBefore = JSON.stringify(legacy);
    expect(canonicalizeSemanticDiffForReplay(legacy)).toEqual(
      canonicalizeSemanticDiffForReplay(v22)
    );
    expect(JSON.stringify(legacy)).toBe(legacyBefore);
  });

  it("canonicalizes historical wire-orientation diff evidence for replay only", () => {
    const after = {
      kind: "wire",
      sketchId: "sketch_1",
      segments: [
        { entityId: "line_1", orientation: "forward" },
        { entityId: "line_2", orientation: "reverse" }
      ]
    } as const;
    const legacy = {
      created: [],
      modified: [],
      deleted: [],
      features: {
        inputReferences: [
          {
            featureId: "feat_1",
            inputKind: "profile",
            after,
            profileOrientationNormalized: true,
            affectedSketchIds: ["sketch_1"],
            affectedEntityIds: ["line_1", "line_2"]
          }
        ]
      }
    } as unknown as SemanticDiff;
    const current: SemanticDiff = {
      created: [],
      modified: [],
      deleted: [],
      features: {
        inputReferences: [
          {
            featureId: "feat_1",
            inputKind: "profile",
            after,
            normalization: {
              outerOrientationsChanged: [
                '["wire",["line_1","forward"],["line_2","reverse"]]'
              ],
              holeOrientationsChanged: [],
              cyclicStartsChanged: [],
              holeOrderChanged: false,
              regionOrderChanged: false
            },
            affectedSketchIds: ["sketch_1"],
            affectedEntityIds: ["line_1", "line_2"]
          }
        ]
      }
    };

    const before = JSON.stringify(legacy);
    expect(canonicalizeSemanticDiffForReplay(legacy)).toEqual(
      canonicalizeSemanticDiffForReplay(current)
    );
    expect(JSON.stringify(legacy)).toBe(before);
  });

  it("preserves original transaction op and diff shapes across legacy load/export", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        id: "circle_1",
        center: [0, 0],
        radius: 2
      },
      {
        op: "feature.extrude",
        id: "feat_1",
        bodyId: "body_1",
        sketchId: "sketch_1",
        entityId: "circle_1",
        depth: 5
      }
    ]);
    const project = exportCadProject(engine);
    const originalTransactions = JSON.parse(
      JSON.stringify({
        history: project.history,
        redoStack: project.redoStack
      })
    );

    const saved = exportCadProject(importCadProject(project));
    expect({
      history: saved.history,
      redoStack: saved.redoStack
    }).toEqual(originalTransactions);
    expect(saved.history[0]?.ops[2]).not.toHaveProperty("side");
    expect(saved.history[0]?.ops[2]).not.toHaveProperty("operationMode");
  });
});

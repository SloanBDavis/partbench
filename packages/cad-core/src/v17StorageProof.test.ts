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

function createEmptyProject(): CadProject {
  return exportCadProject(new CadEngine());
}

function stampLegacyProject(project: CadProject, version: number): CadProject {
  const source = project.document as unknown as Record<string, unknown>;
  const document: Record<string, unknown> = {
    units: source.units,
    objects: source.objects,
    nextObjectNumber: source.nextObjectNumber
  };
  const copy = (keys: readonly string[]) => {
    for (const key of keys) document[key] = source[key];
  };
  if (version >= 2) {
    copy(["sketches", "nextSketchNumber", "nextSketchEntityNumber"]);
  }
  if (version >= 3) {
    copy(["features", "nextFeatureNumber", "nextBodyNumber"]);
  }
  if (version >= 5) copy(["namedReferences"]);
  if (version >= 7) {
    copy([
      "parameters",
      "sketchDimensions",
      "nextParameterNumber",
      "nextSketchDimensionNumber"
    ]);
  }
  if (version >= 8) {
    copy(["sketchConstraints", "nextSketchConstraintNumber"]);
  }
  if (version >= 18 && source.topologyIdentity) {
    copy(["topologyIdentity"]);
  }
  return {
    schemaVersion: `web-cad.project.v${version}`,
    document,
    history: [],
    redoStack: []
  } as unknown as CadProject;
}

function createBaseExtrudeEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "base_sketch", name: "Base", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "base_sketch",
      id: "base_rect",
      center: [0, 0],
      width: 4,
      height: 3
    },
    {
      op: "feature.extrude",
      id: "base_extrude",
      bodyId: "base_body",
      sketchId: "base_sketch",
      entityId: "base_rect",
      depth: 3
    }
  ]);
  return engine;
}

function createConstraintProject(version: number): CadProject {
  const engine = new CadEngine();
  const secondLine =
    version === 12
      ? { start: [0, 1] as const, end: [2, 1] as const }
      : { start: [0, 0] as const, end: [0, 2] as const };
  engine.applyBatch([
    {
      op: "sketch.create",
      id: "constraint_sketch",
      name: "Constraint",
      plane: "XY"
    },
    {
      op: "sketch.addLine",
      sketchId: "constraint_sketch",
      id: "line_1",
      start: [0, 0],
      end: [2, 0]
    },
    {
      op: "sketch.addLine",
      sketchId: "constraint_sketch",
      id: "line_2",
      ...secondLine
    },
    {
      op: "sketch.addPoint",
      sketchId: "constraint_sketch",
      id: "point_1",
      point: version === 10 ? [0, 0] : [1, 0]
    }
  ]);
  const constraints: Record<number, any> = {
    8: { kind: "horizontal", entityId: "line_1" },
    9: { kind: "fixed", target: { entityId: "point_1", role: "position" } },
    10: {
      kind: "coincident",
      primaryTarget: { entityId: "point_1", role: "position" },
      secondaryTarget: { entityId: "line_1", role: "start" }
    },
    11: {
      kind: "midpoint",
      lineEntityId: "line_1",
      target: { entityId: "point_1", role: "position" }
    },
    12: {
      kind: "parallel",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2"
    },
    13: {
      kind: "perpendicular",
      primaryLineEntityId: "line_1",
      secondaryLineEntityId: "line_2"
    }
  };
  engine.apply({
    op: "sketch.constraint.create",
    id: `constraint_v${version}`,
    name: `V${version} constraint`,
    sketchId: "constraint_sketch",
    ...constraints[version]
  } as never);
  return exportCadProject(engine);
}

function createV20ConsumerMigrationProject(): CadProject {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "v20_profile", name: "Profile", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "v20_profile",
      id: "v20_rect",
      center: [2, 0],
      width: 2,
      height: 1
    },
    {
      op: "sketch.addCircle",
      sketchId: "v20_profile",
      id: "v20_circle",
      center: [0, 0],
      radius: 1
    },
    {
      op: "sketch.addLine",
      sketchId: "v20_profile",
      id: "v20_axis",
      start: [0, -2],
      end: [0, 2]
    },
    { op: "sketch.create", id: "v20_path", name: "Path", plane: "XZ" },
    {
      op: "sketch.addLine",
      sketchId: "v20_path",
      id: "v20_path_line",
      start: [0, 0],
      end: [0, 5]
    },
    { op: "sketch.create", id: "v20_loft", name: "Loft", plane: "XY" },
    {
      op: "sketch.addCircle",
      sketchId: "v20_loft",
      id: "v20_loft_circle",
      center: [0, 0],
      radius: 2
    },
    {
      op: "feature.extrude",
      id: "v20_extrude",
      bodyId: "v20_extrude_body",
      sketchId: "v20_profile",
      entityId: "v20_rect",
      depth: 2
    },
    {
      op: "feature.revolve",
      id: "v20_revolve",
      bodyId: "v20_revolve_body",
      sketchId: "v20_profile",
      entityId: "v20_rect",
      axis: {
        type: "sketchLine",
        sketchId: "v20_profile",
        entityId: "v20_axis"
      },
      angleDegrees: 180
    },
    {
      op: "feature.sweep",
      id: "v20_sweep",
      bodyId: "v20_sweep_body",
      profileSketchId: "v20_profile",
      profileEntityId: "v20_circle",
      pathSketchId: "v20_path",
      pathEntityIds: ["v20_path_line"]
    }
  ]);
  const project = exportCadProject(engine) as any;
  project.document.features.push({
    id: "v20_loft_feature",
    kind: "loft",
    bodyId: "v20_loft_body",
    sections: [
      { sketchId: "v20_profile", entityId: "v20_circle" },
      { sketchId: "v20_loft", entityId: "v20_loft_circle" }
    ]
  });
  return stampLegacyProject(project, 20);
}

function createMigrationCorpus(): readonly {
  readonly version: number;
  readonly marker: string;
  readonly project: CadProject;
}[] {
  const fixture = (version: number, marker: string, engine: CadEngine) => ({
    version,
    marker,
    project: stampLegacyProject(exportCadProject(engine), version)
  });
  const box = new CadEngine();
  box.apply({
    op: "scene.createBox",
    id: "v1_box",
    dimensions: { width: 1, height: 2, depth: 3 }
  });
  const sketchOnly = new CadEngine();
  sketchOnly.applyBatch([
    { op: "sketch.create", id: "v2_sketch", name: "V2 sketch", plane: "XY" },
    {
      op: "sketch.addPoint",
      sketchId: "v2_sketch",
      id: "v2_point",
      point: [1, 2]
    }
  ]);
  const v4 = createBaseExtrudeEngine();
  v4.apply({
    op: "sketch.createOnFace",
    id: "v4_attached",
    name: "Attached",
    bodyId: "base_body",
    faceStableId: "generated:face:base_body:endCap"
  });
  const v5 = createBaseExtrudeEngine();
  v5.apply({
    op: "reference.nameGenerated",
    name: "V5 top",
    bodyId: "base_body",
    stableId: "generated:face:base_body:endCap"
  });
  const v7 = new CadEngine();
  v7.applyBatch([
    { op: "sketch.create", id: "v7_sketch", name: "V7", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "v7_sketch",
      id: "v7_rect",
      center: [0, 0],
      width: 2,
      height: 1
    },
    { op: "parameter.create", id: "v7_parameter", name: "Width", value: 2 },
    {
      op: "sketch.dimension.create",
      id: "v7_dimension",
      name: "Width",
      sketchId: "v7_sketch",
      entityId: "v7_rect",
      target: { entityKind: "rectangle", role: "width" },
      parameterId: "v7_parameter"
    }
  ]);
  const v14 = new CadEngine();
  v14.applyBatch([
    { op: "sketch.create", id: "v14_sketch", name: "V14", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "v14_sketch",
      id: "v14_rect",
      center: [2, 0],
      width: 1,
      height: 2
    },
    {
      op: "sketch.addLine",
      sketchId: "v14_sketch",
      id: "v14_axis",
      start: [0, -2],
      end: [0, 2]
    },
    {
      op: "feature.revolve",
      id: "v14_revolve",
      bodyId: "v14_body",
      sketchId: "v14_sketch",
      entityId: "v14_rect",
      axis: {
        type: "sketchLine",
        sketchId: "v14_sketch",
        entityId: "v14_axis"
      },
      angleDegrees: 180
    }
  ]);
  const v15 = createBaseExtrudeEngine();
  v15.applyBatch([
    { op: "sketch.create", id: "v15_hole_sketch", name: "Hole", plane: "XY" },
    {
      op: "sketch.addCircle",
      sketchId: "v15_hole_sketch",
      id: "v15_circle",
      center: [0, 0],
      radius: 0.5
    },
    {
      op: "feature.hole",
      id: "v15_hole",
      bodyId: "v15_body",
      targetBodyId: "base_body",
      sketchId: "v15_hole_sketch",
      circleEntityId: "v15_circle",
      depthMode: "blind",
      depth: 1,
      direction: "positive"
    }
  ]);
  const v16 = createBaseExtrudeEngine();
  v16.apply({
    op: "feature.chamfer",
    id: "v16_chamfer",
    bodyId: "v16_body",
    targetBodyId: "base_body",
    edgeStableId: "generated:edge:base_body:start:uMin",
    distance: 0.2
  });
  const v17 = new CadEngine();
  v17.applyBatch([
    { op: "sketch.create", id: "v17_sketch", name: "V17", plane: "XY" },
    {
      op: "sketch.addLine",
      sketchId: "v17_sketch",
      id: "v17_line",
      start: [-2, 0],
      end: [2, 0]
    },
    {
      op: "sketch.addCircle",
      sketchId: "v17_sketch",
      id: "v17_circle",
      center: [0, 1],
      radius: 1
    }
  ]);
  const v17Project = exportCadProject(v17) as any;
  v17Project.document.sketchConstraints = [
    {
      id: "v17_tangent",
      name: "Tangent",
      sketchId: "v17_sketch",
      entityId: "v17_circle",
      kind: "tangent",
      primaryTarget: { entityId: "v17_line", entityKind: "line" },
      secondaryTarget: { entityId: "v17_circle", entityKind: "circle" }
    }
  ];
  const v18Project = exportCadProject(createBaseExtrudeEngine()) as any;
  v18Project.document.topologyIdentity =
    createEmptyTopologyIdentitySourceSnapshot();
  const v19 = createBaseExtrudeEngine();
  v19.apply({
    op: "feature.linearPattern",
    id: "v19_pattern",
    bodyId: "v19_body",
    seedBodyId: "base_body",
    direction: { kind: "globalAxis", axis: "x" },
    spacing: 6,
    instanceCount: 3
  });
  const v19Project = exportCadProject(v19) as any;
  const v19Pattern = v19Project.document.features.find(
    (feature: any) => feature.id === "v19_pattern"
  );
  delete v19Pattern.direction;
  delete v19Pattern.instances;
  v19Pattern.axis = "x";

  return [
    fixture(1, "object", box),
    fixture(2, "sketch", sketchOnly),
    fixture(3, "extrude", createBaseExtrudeEngine()),
    fixture(4, "attachment", v4),
    fixture(5, "named reference", v5),
    fixture(6, "named reference clone", v5),
    fixture(7, "parameter dimension", v7),
    ...[8, 9, 10, 11, 12, 13].map((version) => ({
      version,
      marker: `constraint v${version}`,
      project: stampLegacyProject(createConstraintProject(version), version)
    })),
    fixture(14, "revolve", v14),
    fixture(15, "hole", v15),
    fixture(16, "chamfer", v16),
    {
      version: 17,
      marker: "advanced constraint",
      project: stampLegacyProject(v17Project, 17)
    },
    {
      version: 18,
      marker: "topology identity",
      project: stampLegacyProject(v18Project, 18)
    },
    {
      version: 19,
      marker: "pattern",
      project: stampLegacyProject(v19Project, 19)
    },
    {
      version: 20,
      marker: "all profile consumers",
      project: createV20ConsumerMigrationProject()
    }
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
  const project = clone(createNormalizedV21Project()) as any;
  project.document.sketches[1].entities.push(
    entity("path_2", "line", { start: [0, 5], end: [5, 5] })
  );
  project.document.features[0].profile = {
    kind: "wire",
    sketchId: "path",
    segments: [
      { entityId: "path_1", orientation: "forward" },
      { entityId: "path_2", orientation: "reverse" }
    ]
  };
  project.document.features[2].path = {
    kind: "chain",
    sketchId: "path",
    segments: [
      { entityId: "path_1", orientation: "forward" },
      { entityId: "path_2", orientation: "forward" }
    ]
  };
  return project;
}

function expectV21Issue(project: CadProject, path: string): void {
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
  project: CadProject,
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
        features: legacy.document.features.map((feature: any) => {
          const {
            sketchId,
            entityId,
            profileKind: _profileKind,
            ...rest
          } = feature;
          return {
            ...rest,
            profile: { kind: "entity", sketchId, entityId }
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
    const source = clone(createNormalizedV21Project()) as any;
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
    const packed = await exportCadProjectToWcad(source, {
      topologyCheckpoints: [payload]
    });
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
          expect.objectContaining({ id: "base_extrude", kind: "extrude" })
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
          expect.objectContaining({ id: "v14_revolve", kind: "revolve" })
        );
      } else if (version === 15) {
        expect(reexported.document.features).toContainEqual(
          expect.objectContaining({ id: "v15_hole", kind: "hole" })
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
          expect.objectContaining({ id: "v19_pattern", kind: "linearPattern" })
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
      (project: any) => project.document.features[0].profile.segments.reverse(),
      (project: any) => {
        project.document.features[0].profile.segments[0].orientation =
          "reverse";
      },
      (project: any) => project.document.features[2].path.segments.reverse(),
      (project: any) => {
        project.document.features[2].path.segments[1].orientation = "reverse";
      }
    ];

    for (const mutate of variants) {
      const changed = clone(source);
      mutate(changed);
      expect(createCadProjectSourceIdentity(changed).sha256).not.toBe(baseline);
    }
  });

  it("downgrades normalized nontriggers and circle-only radius constraints to V20", () => {
    const saved = exportCadProject(
      importCadProject(
        parseCadProjectJson(JSON.stringify(createNormalizedV21Project()))
      )
    ) as any;

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
    const source = clone(createNormalizedV21Project()) as any;
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
      const mismatched = clone(source) as any;
      mismatched.document.sketches[4].attachment[field] = value;
      expectProjectIssue(
        mismatched,
        "INVALID_SKETCH",
        `$.document.sketches[4].attachment.${field}`
      );
    }
    const wrongStableId = clone(source) as any;
    wrongStableId.document.sketches[4].attachment.faceStableId =
      "generated:face:body_extrude:startCap";
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

    const revolveWire = clone(createNormalizedV21Project()) as any;
    revolveWire.document.sketches[0].entities.push(
      entity("profile_line_2", "line", { start: [0, 3], end: [3, 3] })
    );
    revolveWire.document.features[1].profile = {
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
      mutate: (feature: any) => void
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
          feature.sections[0].profile = {
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
      const denied = clone(revolveWire) as any;
      mutate(denied.document.features[featureIndex]);
      expectV21Issue(denied, path);
    }
  });

  it("allows construction guides for axes and paths but rejects every solid profile", () => {
    const guides = clone(createNormalizedV21Project()) as any;
    guides.document.sketches[0].entities.find(
      (item: any) => item.id === "axis"
    ).construction = true;
    guides.document.sketches[1].entities.find(
      (item: any) => item.id === "path_1"
    ).construction = true;
    expect(() => parseCadProjectJson(JSON.stringify(guides))).not.toThrow();

    const profileCases: readonly [entityId: string, path: string][] = [
      ["rect", "$.document.features[0].profile.entityId"],
      ["circle_a", "$.document.features[1].profile.entityId"],
      ["circle_b", "$.document.features[2].profile.entityId"],
      ["loft_rect_a", "$.document.features[3].sections[0].profile.entityId"]
    ];
    for (const [entityId, path] of profileCases) {
      const denied = clone(createNormalizedV21Project()) as any;
      for (const sourceSketch of denied.document.sketches) {
        const profileEntity = sourceSketch.entities.find(
          (item: any) => item.id === entityId
        );
        if (profileEntity) profileEntity.construction = true;
      }
      expectV21Issue(denied, path);
    }
  });

  it("rejects mixed legacy and normalized fields for every consumer and radius target", () => {
    const cases: readonly [path: string, mutate: (project: any) => void][] = [
      [
        "$.document.features[0].sketchId",
        (p) => (p.document.features[0].sketchId = "profiles")
      ],
      [
        "$.document.features[1].entityId",
        (p) => (p.document.features[1].entityId = "circle_a")
      ],
      [
        "$.document.features[2].pathEntityIds",
        (p) => (p.document.features[2].pathEntityIds = ["path_1"])
      ],
      [
        "$.document.features[3].sections[0].sketchId",
        (p) => (p.document.features[3].sections[0].sketchId = "loft_a")
      ],
      [
        "$.document.sketchConstraints[0].primaryCircleEntityId",
        (p) =>
          (p.document.sketchConstraints[0].primaryCircleEntityId = "circle_a")
      ],
      [
        "$.document.sketchConstraints[1].secondaryCircleEntityId",
        (p) =>
          (p.document.sketchConstraints[1].secondaryCircleEntityId = "circle_d")
      ]
    ];

    for (const [path, mutate] of cases) {
      const mixed = clone(createNormalizedV21Project());
      mutate(mixed);
      expectV21Issue(mixed, path);
    }
  });
});
